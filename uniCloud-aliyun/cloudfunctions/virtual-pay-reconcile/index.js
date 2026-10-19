'use strict';
/**
 * 云函数：virtual-pay-reconcile（对账恢复）
 * 入参：{ uid }
 * 返回：{ code:0, data:{ paid:true } } | { code:-2, msg:'未找到已支付订单' }
 *
 * 作用：用户已付款但云端因确认环节失败而未标记 paidBank 时，
 * 点击下载会先走这里——找回该用户最近的 pending 订单，向微信核实是否真的已支付，
 * 已支付则上报发货并标记已购（不会再向用户收一次钱）。
 * 找不到已支付订单时返回 -2，由前端继续走正常支付流程。
 */
const db = uniCloud.database();
const payConfig = require('pay-config');
const ordersColl = db.collection('orders');

exports.main = async (event) => {
  try {
    const { uid } = event;
    if (!uid) return { code: -1, msg: '缺少 uid' };

    const res = await ordersColl
      .where({ uid, status: 'pending' })
      .orderBy('createdAt', 'desc')
      .get();
    if (!res.data || res.data.length === 0) {
      return { code: -2, msg: '未找到待确认订单' };
    }

    // 逐笔确认（通常只有一笔），任一笔成功即视为已购
    for (const order of res.data) {
      const r = await payConfig.confirmOrder(order);
      if (r.code === 0) {
        return { code: 0, data: { paid: true } };
      }
      console.log('[virtual-pay-reconcile] 订单未支付:', order.outTradeNo, r.msg);
    }
    return { code: -2, msg: '未找到已支付订单' };
  } catch (e) {
    console.error('[virtual-pay-reconcile] 异常:', e);
    return { code: -1, msg: '对账失败：' + e.message };
  }
};
