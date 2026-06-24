'use strict';
/**
 * 云函数：getRankList
 * 功能：获取排行榜，双维度排序（正确率降序 → 答题总数降序）
 * 返回：{ code: 0, data: 用户数组 }
 */
const db = uniCloud.database()
const usersCollection = db.collection('users')

exports.main = async (event, context) => {
	
	const {_id} = event
	
  try {
    // 查询所有用户，按正确率降序、答题总数降序排列
    const res = await usersCollection
      .where({
        totalAnswer: db.command.gt(0)  // 只显示有过答题记录的用户
      })
      .orderBy('accuracy', 'desc')
      .orderBy('totalAnswer', 'desc')
      .limit(100)
      .field({
        _id: true,
        avatar: true,
        nickName: true,
        totalAnswer: true,
        rightCount: true,
        accuracy: true,
        title: true
      })
      .get()
    
    const rankList = res.data || []
    // 单独查询用户自己的排名并单独返回
    let userRank = -1
    if (_id) {
      const userIndex = rankList.findIndex(user => user._id === _id)
      if (userIndex !== -1) {
        userRank = userIndex + 1 // 排名从1开始
      } else {
        // 如果用户不在前100名中，查询其排名
        const countRes = await usersCollection
          .where({
            totalAnswer: db.command.gt(0),
            $or: [
              { accuracy: db.command.gt(res.data[res.data.length - 1].accuracy) },
              { 
                accuracy: res.data[res.data.length - 1].accuracy,
                totalAnswer: db.command.gt(res.data[res.data.length - 1].totalAnswer)
              }
            ]
          })
          .count()
        userRank = countRes.total + 1
      }
    }
  
	
	
    return { code: 0, data: rankList, userRank }
    
  } catch (e) {
    console.error('[getRankList] 异常:', e)
    return { code: -1, msg: '服务异常：' + e.message }
  }
}