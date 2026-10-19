'use strict';
/**
 * 云函数：virtual-pay-order（下单 + 双签名）
 * 入参：{ code, productId?, uid? }
 * 返回：{ code:0, data:{ outTradeNo, signData, paySig, signature, mode } }
 *
 * 流程：code2Session → 生成订单号 → 组装 signData → 服务端算 paySig + signature
 * → 落 orders(pending) → 返回签名参数（密钥只留云端）
 */
const db = uniCloud.database();
const payConfig = require('pay-config');
const ordersColl = db.collection('orders');

exports.main = async (event) => {
  try {
    const { code, productId, uid } = event;
    if (!code) return { code: -1, msg: '缺少登录 code' };

    const pid = productId || payConfig.CONFIG.PRODUCT_ID;

    // 1. code2Session 拿 openid + session_key
    const session = await payConfig.code2Session(code);
    const { openid, session_key } = session;
    if (!openid) {
      return { code: -1, msg: '获取 openid 失败：' + JSON.stringify(session) };
    }

    // 2. 生成业务订单号（8-32 位，仅数字/字母/_ - | * @，不以 _ 开头）
    const outTradeNo = 'BANK' + Date.now().toString(36) + Math.floor(Math.random() * 1e6).toString(36);

    // 3. 组装 signData（固定键顺序，前端原样回传）
    const signDataObj = {
      offerId: payConfig.CONFIG.OFFER_ID,
      buyQuantity: 1,
      env: payConfig.CONFIG.ENV,
      currencyType: 'CNY',
      productId: pid,
      goodsPrice: payConfig.CONFIG.GOODS_PRICE,
      outTradeNo: outTradeNo,
      attach: JSON.stringify({ uid: uid || '', openid }),
    };
    const signData = JSON.stringify(signDataObj);

    // 4. 双签名
    const appKey = payConfig.getAppKey();
    const paySig = payConfig.calcPaySig('requestVirtualPayment', signData, appKey);
    const signature = payConfig.calcUserSig(signData, session_key);

    // 5. 落库（session_key 暂存，确认时若过期会用 fresh code 重新换取）
    await ordersColl.add({
      outTradeNo,
      openid,
      uid: uid || '',
      productId: pid,
      fee: payConfig.CONFIG.GOODS_PRICE,
      status: 'pending',
      sessionKey: session_key,
      createdAt: Date.now(),
    });

    console.log('[virtual-pay-order] 下单成功:', outTradeNo, 'openid:', openid);
    return {
      code: 0,
      data: { outTradeNo, signData, paySig, signature, mode: 'short_series_goods' },
    };
  } catch (e) {
    console.error('[virtual-pay-order] 异常:', e);
    return { code: -1, msg: '下单失败：' + e.message };
  }
};
