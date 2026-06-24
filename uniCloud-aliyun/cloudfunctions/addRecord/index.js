'use strict';
/**
 * 云函数：submitAnswer
 * 功能：判断答题对错，更新用户答题数据，记录错题，重新计算称号
 * 入参：{ questionId: string, userAnswer: string, isCorrect: boolean }
 * 返回：{ code: 0, data: 更新后的用户对象 }
 */
const db = uniCloud.database()
const usersCollection = db.collection('users')
const recordCollection = db.collection('record')

/**
 * 根据正确率计算称号
 */
function calcTitle(accuracy) {
  if (accuracy >= 0.9) return '历史学家'
  if (accuracy >= 0.8) return '历史达人'
  if (accuracy >= 0.7) return '历史爱好者'
  if (accuracy >= 0.6) return '历史学徒'
  return '历史新手'
}

exports.main = async (event, context) => {
  try {
    const uid = event.uid
    
    if (!uid) {
      return { code: -1, msg: '未获取到用户身份' }
    }
    
    const { questionId, userAnswer, isCorrect } = event
    
    if (!questionId || !userAnswer) {
      return { code: -1, msg: '参数不完整' }
    }
    
    // 查找用户
    const userRes = await usersCollection.where({ _id:uid }).get()
    if (!userRes.data || userRes.data.length === 0) {
      return { code: -1, msg: '用户不存在，请重新登录' }
    }
    
    const user = userRes.data[0]
    const userId = user._id
    
    // 计算新数据
    const newTotalAnswer = (user.totalAnswer || 0) + 1
    const newRightCount = isCorrect ? (user.rightCount || 0) + 1 : (user.rightCount || 0)
    const newAccuracy = newTotalAnswer > 0 ? parseFloat((newRightCount / newTotalAnswer).toFixed(4)) : 0
    const newTitle = calcTitle(newAccuracy)
    
    // 构建更新对象
    const updateData = {
      totalAnswer: newTotalAnswer,
      rightCount: newRightCount,
      accuracy: newAccuracy,
      title: newTitle,
      updatedAt: Date.now()
    }
    
    // 如果答错，添加错题记录
    if (!isCorrect) {
      const errorRecord = {
        qid: questionId,
        userAnswer: userAnswer,
        createdAt: Date.now()
      }
      // 使用 push 添加到 errorList 数组
      await usersCollection.doc(userId).update({
        ...updateData,
        errorList: db.command.push([errorRecord])
      })
    } else {
      await usersCollection.doc(userId).update(updateData)
    }
	
	
	// 添加答题记录
	const newRecord = {
	  qid: questionId,
	  uid:uid,
	  userAnswer:userAnswer,
	  isCorrect:isCorrect,
	  createdAt: Date.now()
	}
	
	await recordCollection.add(newRecord)
    
    // 返回更新后的用户信息
    const updatedRes = await usersCollection.doc(userId).get()
    console.log('[submitAnswer] 答题更新完成，正确率:', newAccuracy, '称号:', newTitle)
    return { code: 0, data: updatedRes.data[0] }
    
  } catch (e) {
    console.error('[submitAnswer] 异常:', e)
    return { code: -1, msg: '服务异常：' + e.message }
  }
}