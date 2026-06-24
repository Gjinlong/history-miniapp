'use strict';
/**
 * 云函数：getRandomQuestion
 * 功能：从题库中随机抽取一道历史题目
 * 返回：{ code: 0, data: 题目对象 }
 */
const db = uniCloud.database()
const $ = db.command.aggregate

exports.main = async (event, context) => {
  try {
    const { _id } = event
    if (!_id) {
      return { code: -1, msg: "用户身份缺失" }
    }

    // 1. 获取题库总数量
    const questionColl = db.collection("question")
    const countQuestion = await questionColl.count()
    const totalQuestion = countQuestion.total
    if (totalQuestion === 0) {
      return { code: -1, msg: "题库暂无题目，请管理员添加" }
    }

    // 2. 查询用户信息，拿到用户累计答题总数
    const userColl = db.collection("users")
    const userRes = await userColl.where({ _id }).get()
    if (userRes.data.length === 0) {
      return { code: -1, msg: "用户不存在" }
    }
    const userInfo = userRes.data[0]
    const userAnswerCount = userInfo.totalAnswer || 0

    // 3. 查询当前用户所有已作答题目ID
    const recordColl = db.collection("record")
    const recordRes = await recordColl.where({ _id }).get()
    // 提取已答题目id数组
    const answeredIdList = recordRes.data.map(item => item.qid)

    // 4. 判断是否已经答完全部题目
    if (userAnswerCount >= totalQuestion) {
      return { code: 1, msg: "恭喜！您已完成全部历史题库，暂无新题目" }
    }


    // 5. 随机筛选一条用户未答过的题目
    // 5. 随机筛选一条用户未答过的题目
const targetRes = await questionColl
  .aggregate() // 开启聚合管道
  .match({
    _id: db.command.nin(answeredIdList) // 使用聚合专用的 $.nin 操作符
  })
  .sample({ size: 1 }) // 随机取 1 条
  .end() // 执行

    if (targetRes.data && targetRes.data.length > 0) {
      return {
        code: 0,
        data: targetRes.data[0],
        totalQuestion,
        userAnswerCount
      }
    } else {
      // 理论不会走到这里，兜底提示
      return { code: -1, msg: "暂未找到未作答题目" }
    }

  } catch (e) {
    console.error("获取随机题目异常：", e)
    return { code: -1, msg: "加载题目失败，请稍后重试" ,e}
  }
}