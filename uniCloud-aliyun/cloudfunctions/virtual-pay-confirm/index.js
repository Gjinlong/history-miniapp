'use strict';
/**
 * 云函数：virtual-pay-confirm（确认支付 + 上报发货 + 标记已购）
 * 入参：{ outTradeNo }
 * 返回：{ code:0, data:{ paid:true } } | { code:-2/-4, msg, detail }
 *
 * 方式 B 核心：前端支付 success 后调用本函数。
 * 实际查单/上报/标记逻辑在 common/pay-config 的 confirmOrder 中（与对账恢复共用）。
 */
const db = uniCloud.database();
const payConfig = require('pay-config');
const ordersColl = db.collection('orders');

exports.main = async (event) => {
  try {
    const { outTradeNo } = event;
    if (!outTradeNo) return { code: -1, msg: '缺少订单号' };

    const orderRes = await ordersColl.where({ outTradeNo }).get();
    if (!orderRes.data || orderRes.data.length === 0) {
      return { code: -1, msg: '订单不存在' };
    }
    const order = orderRes.data[0];

    // 已发货直接返回，保证幂等
    if (order.status === 'paid') {
      return { code: 0, data: { paid: true }, msg: '已发货' };
    }

    return await payConfig.confirmOrder(order);
  } catch (e) {
    console.error('[virtual-pay-confirm] 异常:', e);
    return { code: -1, msg: '确认失败：' + e.message };
  }
};
