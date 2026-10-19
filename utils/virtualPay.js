/**
 * 虚拟支付 + 下载题库 前端封装
 * 方式 B（不依赖消息推送）：前端 success → 服务端查单 + 上报发货 → 标记已购
 *
 * iOS 现已覆盖：wx.requestVirtualPayment 由微信按设备自动路由
 * —— 安卓走微信支付、iOS 走 Apple Pay，前端无需区分平台。
 * 注意：iOS 不支持沙箱环境，仅现网（env=0）可测，且有最低 1 元限制（3.9 元满足）。
 */
const PRODUCT_ID = 'BANK_DOWNLOAD';

/**
 * 是否 iOS 设备
 */
export function isIOS() {
  try {
    const sys = uni.getSystemInfoSync();
    return sys.platform === 'ios';
  } catch (e) {
    return false;
  }
}

/**
 * 查询用户是否已购下载权限
 */
export async function checkEntitlement(uid) {
  if (!uid) return false;
  try {
    const res = await uniCloud.callFunction({ name: 'virtual-pay-query', data: { uid } });
    return !!(res.result && res.result.code === 0 && res.result.data && res.result.data.paidBank);
  } catch (e) {
    return false;
  }
}

/**
 * 微信登录拿 code
 */
function wxLogin() {
  return new Promise((resolve, reject) => {
    wx.login({
      success: (r) => (r.code ? resolve(r.code) : reject(new Error('wx.login 失败'))),
      fail: reject,
    });
  });
}

/**
 * 发起支付购买下载权限（安卓与 iOS 通用；iOS 由微信自动路由到 Apple Pay）
 * @returns {Promise<{success:boolean, paid?:boolean}>}
 */
export async function pay(uid) {
  try {
    uni.showLoading({ title: '下单中...', mask: true });
    const code = await wxLogin();
    const orderRes = await uniCloud.callFunction({
      name: 'virtual-pay-order',
      data: { code, productId: PRODUCT_ID, uid },
    });
    uni.hideLoading();

    if (!orderRes.result || orderRes.result.code !== 0) {
      uni.showToast({ title: orderRes.result?.msg || '下单失败', icon: 'none' });
      return { success: false };
    }

    const { signData, paySig, signature, mode, outTradeNo } = orderRes.result.data;

    // 拉起微信虚拟支付
    await new Promise((resolve, reject) => {
      wx.requestVirtualPayment({
        signData,
        paySig,
        signature,
        mode,
        success: resolve,
        fail: (err) => {
          const msg = err.errMsg || '';
          if (msg.indexOf('cancel') > -1) {
            uni.showToast({ title: '已取消支付', icon: 'none' });
          } else {
            uni.showModal({
              title: '支付失败',
              content: `错误码: ${err.errno || ''}\n${err.errMsg || ''}`,
            });
          }
          reject(err);
        },
      });
    });

    // 支付成功 → 服务端确认（查单可能有秒级延迟，重试几次）
    let confirmed = false;
    for (let i = 0; i < 4 && !confirmed; i++) {
      if (i > 0) await new Promise((r) => setTimeout(r, 1500));
      uni.showLoading({ title: '确认中...', mask: true });
      const confirmRes = await uniCloud.callFunction({
        name: 'virtual-pay-confirm',
        data: { outTradeNo },
      });
      uni.hideLoading();
      if (confirmRes.result && confirmRes.result.code === 0) {
        confirmed = true;
      } else if (confirmRes.result && confirmRes.result.code === -4) {
        // 发货上报失败，下一次循环继续重试
        continue;
      }
    }

    if (confirmed) {
      uni.showToast({ title: '开通成功，可无限下载', icon: 'success' });
      return { success: true, paid: true };
    }

    // 仍不确定 → 轮询云端权益兜底
    const ok = await pollConfirm(uid);
    return { success: ok, paid: ok };
  } catch (e) {
    uni.hideLoading();
    console.error('[virtualPay.pay] 异常:', e);
    return { success: false };
  }
}

/**
 * 支付确认轮询（确认环节偶发延迟时兜底）
 */
async function pollConfirm(uid) {
  for (let i = 0; i < 6; i++) {
    await new Promise((r) => setTimeout(r, 1500));
    const ent = await checkEntitlement(uid);
    if (ent) return true;
  }
  uni.showToast({ title: '支付成功，稍后下拉刷新即可下载', icon: 'none' });
  return false;
}

/**
 * 对账恢复：用户已付款但云端未标记时，找回并标记（不会重复扣款）
 * @returns {Promise<boolean>} 是否恢复成功（已购）
 */
export async function reconcile(uid) {
  if (!uid) return false;
  try {
    const res = await uniCloud.callFunction({ name: 'virtual-pay-reconcile', data: { uid } });
    return !!(res.result && res.result.code === 0 && res.result.data && res.result.data.paid);
  } catch (e) {
    return false;
  }
}

/**
 * 小工具：延时
 */
function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

/**
 * 下载题库（已购用户）：云端生成 Excel 后本地打开
 * 文件名固定为「史海识趣题库.xlsx」
 *
 * 云函数已在服务端等待文件就绪才返回 tempFileURL，故前端无需重试。
 * 仅保留一次 GET-tempFileURL 兜底（极端情况下服务端未返回链接时）。
 */
export async function download(uid) {
  try {
    uni.showLoading({ title: '生成题库中...', mask: true });
    const res = await uniCloud.callFunction({ name: 'download-bank', data: { uid } });
    uni.hideLoading();

    if (!res.result || res.result.code !== 0) {
      uni.showToast({ title: res.result?.msg || '生成失败', icon: 'none' });
      return;
    }

    const { fileBase64, fileID, tempFileURL, count } = res.result.data || {};
    if (!fileBase64 && !fileID) {
      uni.showToast({ title: '文件生成中，请重试', icon: 'none' });
      return;
    }

    // 主路径：云端直接返回 base64，前端写盘后打开（文件不经过 CDN，首下载即成功）
    if (fileBase64) {
      const savedPath = (wx.env.USER_DATA_PATH || '') + '/史海识趣题库.xlsx';
      try {
        const fm = wx.getFileSystemManager();
        fm.writeFileSync(savedPath, fileBase64, 'base64');
        uni.showLoading({ title: '打开中...', mask: true });
        await new Promise((resolve) => {
          uni.openDocument({
            filePath: savedPath,
            fileType: 'xlsx',
            showMenu: true, // 允许用户转发/保存
            success: resolve,
            fail: () => {
              // 极端情况下退而用原路径再试一次
              uni.openDocument({
                filePath: savedPath,
                fileType: 'xlsx',
                showMenu: true,
                complete: resolve,
              });
            },
          });
        });
        uni.hideLoading();
        console.log('[virtualPay.download] 已打开题库(base64)，题目数:', count);
        return;
      } catch (e) {
        console.error('[virtualPay.download] base64 写盘失败，退回云存储:', e);
        // 写盘失败则继续下面的云存储兜底路径
      }
    }

    // 兜底路径：云端返回的是云存储链接（文件过大时），需配置 downloadFile 域名白名单
    let fileURL = tempFileURL || '';
    if (!fileURL && fileID) {
      try {
        const urlRes = await uniCloud.getTempFileURL({ fileList: [fileID] });
        fileURL = (urlRes.fileList && urlRes.fileList[0] && urlRes.fileList[0].tempFileURL) || '';
      } catch (e) {
        fileURL = '';
      }
    }
    if (!fileURL) {
      uni.showToast({ title: '获取下载链接失败，请重试', icon: 'none' });
      return;
    }

    let dl = null;
    try {
      dl = await new Promise((resolve, reject) => {
        uni.downloadFile({ url: fileURL, success: resolve, fail: reject });
      });
    } catch (e) {
      dl = null;
    }
    if (!dl || dl.statusCode !== 200 || !dl.tempFilePath) {
      uni.showToast({ title: '下载失败，请重试', icon: 'none' });
      return;
    }

    const savedPath = (wx.env.USER_DATA_PATH || '') + '/史海识趣题库.xlsx';
    let openPath = dl.tempFilePath;
    try {
      const fm = wx.getFileSystemManager();
      fm.copyFileSync(dl.tempFilePath, savedPath);
      openPath = savedPath;
    } catch (e) {
      // 复制失败则退而使用原始临时文件
    }

    uni.showLoading({ title: '打开中...', mask: true });
    await new Promise((resolve) => {
      uni.openDocument({
        filePath: openPath,
        fileType: 'xlsx',
        showMenu: true,
        success: resolve,
        fail: () => {
          uni.openDocument({
            filePath: dl.tempFilePath,
            fileType: 'xlsx',
            showMenu: true,
            complete: resolve,
          });
        },
      });
    });
    uni.hideLoading();
    console.log('[virtualPay.download] 已打开题库(云存储)，题目数:', count);
  } catch (e) {
    uni.hideLoading();
    console.error('[virtualPay.download] 异常:', e);
    uni.showToast({ title: '下载失败', icon: 'none' });
  }
}
