'use strict';
/**
 * 云函数：updateUserInfo
 * 功能：修改当前用户的头像和昵称
 * 入参：{ nickName: string, avatar: string }
 */
const db = uniCloud.database()
const usersCollection = db.collection('users')

exports.main = async (event, context) => {
  try {
    const _id = event.uid
    if (!_id) {
      return { code: -1, msg: '未获取到用户身份' }
    }
    
    const { nickName, avatar } = event
    if (!nickName || nickName.trim().length === 0) {
      return { code: -1, msg: '昵称不能为空' }
    }
    
    // 查找用户
    const userRes = await usersCollection.where({ _id }).get()
    if (!userRes.data || userRes.data.length === 0) {
      return { code: -1, msg: '用户不存在' }
    }
    
    const userId = userRes.data[0]._id
    
    // 更新用户信息
    await usersCollection.doc(userId).update({
      nickName: nickName.trim(),
      avatar: avatar || '',
      updatedAt: Date.now()
    })
    
    // 返回更新后的用户信息
    const updatedRes = await usersCollection.doc(userId).get()
    return { code: 0, data: updatedRes.data[0] }
    
  } catch (e) {
    console.error('[updateUserInfo] 异常:', e)
    return { code: -1, msg: '服务异常：' + e.message }
  }
}