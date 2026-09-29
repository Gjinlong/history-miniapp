'use strict';
const db = uniCloud.database();

// ========== 修改成你自己的管理密码 ==========
const ADMIN_PASSWORD = 'admin888';

exports.main = async (event, context) => {
  // ============================================
  // 兼容 HTTP URL 化调用：POST 的 JSON body 需要手动解析
  // ============================================
  let params = event;
  if (event.body) {
    try {
      params = typeof event.body === 'string' ? JSON.parse(event.body) : event.body;
    } catch (e) {
      return { code: -1, msg: '请求体解析失败：' + e.message };
    }
  }

  const {
    action,
    password,
    collection,
    data,
    id,
    where,
    limit = 50,
    skip = 0
  } = params;

  // 密码校验
  if (password !== ADMIN_PASSWORD) {
    return { code: -1, msg: '密码错误' };
  }
  if (!collection) {
    return { code: -1, msg: '缺少 collection 参数，可选值：question / users / feedbacks' };
  }

  const coll = db.collection(collection);

  try {
    switch (action) {
      // ==================== 查询列表 ====================
      case 'list': {
        let query = where ? coll.where(where) : coll;

        // ============ 写死排序规则 ============
        if (collection === 'users') {
          // 用户表：按正确率降序，正确率相同则按答题总数降序
          query = query.orderBy('accuracy', 'desc').orderBy('totalAnswer', 'desc');
        } else if (collection === 'question') {
          // 题库表：按 _id 倒序（新题在前）
          query = query.orderBy('_id', 'desc');
        } else if (collection === 'feedbacks') {
          // 反馈表：按创建时间倒序（最新反馈在前）
          query = query.orderBy('createdAt', 'desc');
        }
        // ====================================

        const res = await query.skip(skip).limit(limit).get();
        return { code: 0, data: res.data, total: res.total };
      }

      // ==================== 新增 ====================
      case 'add': {
        if (!data) return { code: -1, msg: '缺少 data' };
        const res = await coll.add(data);
        return { code: 0, id: res.id };
      }

      // ==================== 更新 ====================
      case 'update': {
        if (!id) return { code: -1, msg: '缺少 id' };
        if (!data) return { code: -1, msg: '缺少 data' };
        await coll.doc(id).update(data);
        return { code: 0 };
      }

      // ==================== 删除 ====================
      case 'remove': {
        if (!id) return { code: -1, msg: '缺少 id' };
        await coll.doc(id).remove();
        return { code: 0 };
      }

      // ==================== 未知操作 ====================
      default:
        return { code: -1, msg: '未知操作：' + action };
    }
  } catch (e) {
    return { code: -1, msg: e.message };
  }
};