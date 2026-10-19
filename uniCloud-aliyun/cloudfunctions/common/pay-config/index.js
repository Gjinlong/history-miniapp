'use strict';
/**
 * 公共模块：虚拟支付配置与工具
 * 所有密钥仅存在于服务端（云函数），绝不暴露给前端。
 * 云函数内通过 const payConfig = require('common/pay-config') 引入。
 *
 * 说明：当前为方式 B（不依赖消息推送）。前端支付成功后，由服务端主动
 * query_order 查单核实 + notify_provide_goods 上报发货 + 标记用户已购。
 */
const crypto = require('crypto');
const db = uniCloud.database();
const ordersColl = db.collection('orders');
const usersColl = db.collection('users');

const CONFIG = {
  APPID: 'wx6c4806f018ac582c',
  // 用于 code2Session 与获取 access_token；建议后续改为环境变量，避免随代码提交
  APPSECRET: 'c3c491ce029cbf5edb8702a4b77b52a5',
  OFFER_ID: '1450636658',
  APP_KEY_PROD: 'YekPyjpxFpVQj2nZEt1tzU08sxqZRhwx',
  APP_KEY_SANDBOX: 'xsYAXzS8d2D3qFoaXhSGulbCwXYtt4j0',
  PRODUCT_ID: 'BANK_DOWNLOAD', // 道具 ID，需与 MP 后台一致
  GOODS_PRICE: 390,            // 单位：分（= 3.9 元）
  ENV: 0,                      // 0 = 现网，1 = 沙箱（测试时改为 1）
};

function getAppKey() {
  return CONFIG.ENV === 1 ? CONFIG.APP_KEY_SANDBOX : CONFIG.APP_KEY_PROD;
}

function hmacSha256Hex(key, data) {
  return crypto.createHmac('sha256', key).update(data, 'utf8').digest('hex');
}

/**
 * 支付签名 paySig：uri + '&' + body，使用 AppKey
 * 注意：body 必须是最终发出去的原始字符串，逐字节一致
 */
function calcPaySig(uri, body, appKey) {
  return hmacSha256Hex(appKey, uri + '&' + body);
}

/**
 * 用户态签名 signature：body，使用 session_key
 */
function calcUserSig(body, sessionKey) {
  return hmacSha256Hex(sessionKey, body);
}

/**
 * 获取并缓存标准 mp access_token（xpay 服务端接口需要）
 * 缓存在 wx_token 集合中，过期前 5 分钟自动刷新
 */
async function getAccessToken() {
  const tokenColl = db.collection('wx_token');
  const res = await tokenColl.where({ type: 'mp' }).get();
  const now = Date.now();
  if (res.data && res.data.length > 0) {
    const t = res.data[0];
    if (t.expireAt && t.expireAt > now + 5 * 60 * 1000) {
      return t.accessToken;
    }
  }
  const url =
    'https://api.weixin.qq.com/cgi-bin/token?grant_type=client_credential' +
    '&appid=' + CONFIG.APPID + '&secret=' + CONFIG.APPSECRET;
  const r = await uniCloud.httpclient.request(url, { dataType: 'json' });
  const token = r.data && r.data.access_token;
  if (!token) {
    throw new Error('获取 access_token 失败：' + JSON.stringify(r.data));
  }
  const expireAt = now + ((r.data.expires_in || 7200) * 1000);
  if (res.data && res.data.length > 0) {
    await tokenColl.doc(res.data[0]._id).update({ accessToken: token, expireAt });
  } else {
    await tokenColl.add({ type: 'mp', accessToken: token, expireAt });
  }
  return token;
}

/**
 * 调用虚拟支付服务端接口（query_order / notify_provide_goods 等）
 * 注意：query_order 与 notify_provide_goods 按官方文档【只需支付签名 pay_sig】，
 * 不需要用户态 signature（session_key）。因此这里默认不传 sessionKey。
 * @param {string} uri  接口路径，含前导斜杠，如 '/xpay/query_order'
 * @param {object} bodyObj 业务参数（放在 POST body）
 * 签名放在 query：access_token / pay_sig
 */
async function callXpayApi(uri, bodyObj) {
  const accessToken = await getAccessToken();
  const body = JSON.stringify(bodyObj);
  const appKey = getAppKey();
  const paySig = calcPaySig(uri, body, appKey);
  const query = 'access_token=' + accessToken + '&pay_sig=' + paySig;
  const fullUrl = 'https://api.weixin.qq.com' + uri + '?' + query;
  const r = await uniCloud.httpclient.request(fullUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    data: body,
    dataType: 'json',
  });
  return r.data;
}

/**
 * 确认单笔订单：查单核实支付 → 上报发货 → 标记已购（幂等）
 * 这是「确认」与「对账恢复」共用的核心逻辑。
 * @param {object} order orders 集合中的订单记录
 * @returns {Promise<{code:number, msg?:string, detail?:any}>}
 */
async function confirmOrder(order) {
  // 1. 查单核实（订单状态嵌套在 order.status，2=已支付待发货，3/4=已发货）
  let qRes;
  for (let i = 0; i < 3; i++) {
    qRes = await callXpayApi('/xpay/query_order', {
      openid: order.openid,
      env: CONFIG.ENV,
      order_id: order.outTradeNo,
    });
    // 268490011 = 数据生成中，稍后重试
    if (qRes && qRes.errcode === 268490011) {
      await new Promise((r) => setTimeout(r, 1200));
      continue;
    }
    break;
  }
  const status = qRes && qRes.order && qRes.order.status;
  const paid =
    qRes && qRes.errcode === 0 && typeof status === 'number' && status >= 2;
  if (!paid) {
    return { code: -2, msg: '暂未查询到支付成功', detail: qRes };
  }

  // 2. 上报发货（仅现金单；errcode 0=成功，268490004=重复/已发货，均视为已发货）
  const dRes = await callXpayApi('/xpay/notify_provide_goods', {
    order_id: order.outTradeNo,
    env: CONFIG.ENV,
  });
  if (!(dRes && (dRes.errcode === 0 || dRes.errcode === 268490004))) {
    return { code: -4, msg: '发货上报失败，请稍后重试', detail: dRes };
  }

  // 3. 标记订单已支付 + 用户已购（幂等：重复调用无害）
  await ordersColl.doc(order._id).update({ status: 'paid', paidAt: Date.now() });
  if (order.uid) {
    await usersColl.doc(order.uid).update({
      paidBank: true,
      paidAt: Date.now(),
      orderIds: db.command.push([order.outTradeNo]),
    });
  }
  return { code: 0, data: { paid: true } };
}

/**
 * 微信 code2Session，换取 openid 与 session_key
 */
async function code2Session(code) {
  const url =
    'https://api.weixin.qq.com/sns/jscode2session?appid=' + CONFIG.APPID +
    '&secret=' + CONFIG.APPSECRET + '&js_code=' + code + '&grant_type=authorization_code';
  const r = await uniCloud.httpclient.request(url, { dataType: 'json' });
  return r.data; // { openid, session_key, ... }
}

module.exports = {
  CONFIG,
  getAppKey,
  hmacSha256Hex,
  calcPaySig,
  calcUserSig,
  getAccessToken,
  callXpayApi,
  confirmOrder,
  code2Session,
};
