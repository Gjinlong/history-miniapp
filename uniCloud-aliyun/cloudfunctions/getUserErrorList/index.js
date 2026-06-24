'use strict';
/**
 * 云函数：getUserErrorList
 * 功能：查询当前用户的所有错题详情（关联question集合）
 * 返回：{ code: 0, data: [{ title, userAnswer, rightAnswer, ... }] }
 */
const db = uniCloud.database()
const usersCollection = db.collection('users')
const questionCollection = db.collection('question')
const recordCollection = db.collection('record')


exports.main = async (event, context) => {
  try {
    const _id = event.uid

    const {page, pageSize} = event
    
    if (!_id) {
      return { code: -1, msg: '未获取到用户身份' }
    }
    
    // 查询用户
    const userRes = await usersCollection.where({ _id }).get()
    if (!userRes.data || userRes.data.length === 0) {
      return { code: -1, msg: '用户不存在' }
    }

    // 获取所有错题页数
    const errorCountRes = await recordCollection.where({
      uid:_id,
      isCorrect: false
    }).count()
    const totalErrors = errorCountRes.total
    const totalPages = Math.ceil(totalErrors / pageSize)

    // 查询recordCollection中该用户的所有isCorrect=false的答题记录，并查询满足page和pageSize的记录
    const recordRes = await recordCollection
      .where({
        uid:_id,
        isCorrect: false
      })
      .orderBy('createdAt', 'desc') // 按照答题时间倒序排列，最新的错题在前面
      .skip((page - 1) * pageSize)
      .limit(pageSize)
      .get()
    

    
    const user = userRes.data[0]
    const errorList = recordRes.data || []
    
    if (errorList.length === 0) {
      return { code: 0, data: [] }
    }
    
    // 提取所有错题ID
    const qidList = errorList.map(item => item.qid)
    
    // 批量查询题目详情
    const questionRes = await questionCollection
      .where({
        _id: db.command.in(qidList)
      })
      .get()
    
    const questionMap = {}
    if (questionRes.data) {
      questionRes.data.forEach(q => {
        questionMap[q._id] = q
      })
    }
    
    // 组装返回数据：每条错题包含题干、用户答案、正确答案
    const resultList = errorList.map(errItem => {
      const q = questionMap[errItem.qid]
      return {
        title: q ? q.title : '题目已删除',
        userAnswer: errItem.userAnswer || '未知',
        rightAnswer: q ? q.rightAnswer : '未知',
        options: q ? q.options : [],
        createdAt: errItem.createdAt
      }
    })
    
    return { code: 0, data: resultList, totalPages }
    
  } catch (e) {
    console.error('[getUserErrorList] 异常:', e)
    return { code: -1, msg: '服务异常：' + e.message }
  }
}