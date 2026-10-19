'use strict';
/**
 * 云函数：virtual-pay-query（查询用户下载权限）
 * 入参：{ uid? , userId? }
 * 返回：{ code:0, data:{ paidBank:boolean } }
 */
const db = uniCloud.database();
const usersColl = db.collection('users');

exports.main = async (event) => {
  try {
    const id = event.uid || event.userId;
    if (!id) return { code: -1, msg: '缺少用户ID' };
    const res = await usersColl.doc(id).get();
    const paidBank = !!(res.data && res.data[0] && res.data[0].paidBank);
    return { code: 0, data: { paidBank } };
  } catch (e) {
    console.error('[virtual-pay-query] 异常:', e);
    return { code: -1, msg: '查询失败：' + e.message };
  }
};
