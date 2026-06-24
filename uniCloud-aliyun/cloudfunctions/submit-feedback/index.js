'use strict';
const db = uniCloud.database();

exports.main = async (event, context) => {
  try {
    // 1. 获取用户 openid（阿里云环境下可用）
    const {_id} = event;
    if (!_id) {
      return { code: -1, msg: '未获取到用户信息' };
    }

    // 2. 参数校验
    const { stars, wechatId, title, content } = event;
    if (!stars || stars < 1 || stars > 5) {
      return { code: -1, msg: '评分不能为空' };
    }
    if (!content || content.trim().length === 0) {
      return { code: -1, msg: '详细说明不能为空' };
    }

    // 3. 写入数据库
    const feedbackCollection = db.collection('feedbacks');
    await feedbackCollection.add({
      uid: _id,                           // 用户 _id
      stars: stars,                       // 星级
      wechatId: wechatId || '',           // 微信号（可选）
      title: title || '',                 // 标题（可选）
      content: content.trim(),            // 详细内容
      createdAt: Date.now()               // 创建时间
    });

    return {
      code: 0,
      msg: '反馈提交成功'
    };
  } catch (e) {
    console.error('提交反馈失败:', e);
    return {
      code: -1,
      msg: '服务异常，请稍后再试',
	  e
    };
  }
};