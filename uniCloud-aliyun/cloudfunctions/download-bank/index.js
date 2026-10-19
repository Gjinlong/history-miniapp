'use strict';
/**
 * 云函数：download-bank（聚合题库 → 导出 Excel → 返回给前端）
 * 入参：{ uid }
 * 返回：{ code:0, data:{ fileBase64, count } }   或超大文件时 { fileID, tempFileURL, count }
 *
 * 仅对已购用户（users.paidBank=true）放行，实现"一次付费、无限下载"。
 * Excel 列：序号 / 题干 / 选项A / 选项B / 选项C / 选项D / 正确答案
 *
 * 关键改动（修复"首下载失败、刷新才成功"）：
 * 旧方案把文件上传云存储、返回 tempFileURL，前端再 uni.downloadFile。
 * 但 tempFileURL 走 CDN，新文件有数秒冷文件窗口，iOS 客户端命中冷边缘节点会下载失败，
 * 直到文件变"热"（刷新后）才成功。
 * 新方案：直接用 base64 把文件字节回传给前端，前端写盘后打开。
 * 文件不经过 CDN，无冷文件问题，首下载一次即成功，且无需配置 downloadFile 域名白名单。
 * 仅当文件过大（超过阈值）才退回云存储链接方案。
 */
const db = uniCloud.database();
const xlsx = require('node-xlsx');
const usersColl = db.collection('users');
const questionColl = db.collection('question');

// base64 回传上限：超过此值 callFunction 回包可能过大，改用云存储链接兜底
const MAX_BASE64_BYTES = 1.5 * 1024 * 1024;

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

exports.main = async (event) => {
  try {
    const { uid } = event;
    if (!uid) return { code: -1, msg: '缺少用户ID' };

    // 1. 校验下载权限
    const userRes = await usersColl.doc(uid).get();
    const user = userRes.data && userRes.data[0];
    if (!user || !user.paidBank) {
      return { code: -1, msg: '您尚未开通下载权限，请先购买' };
    }

    // 2. 聚合题库
    const MAX = 5000;
    const qRes = await questionColl.limit(MAX).get();
    const list = qRes.data || [];

    const rows = [['序号', '题干', '选项A', '选项B', '选项C', '选项D', '正确答案']];
    list.forEach((q, i) => {
      const opts = q.options || [];
      rows.push([
        i + 1,
        q.title || '',
        opts[0] || '', opts[1] || '', opts[2] || '', opts[3] || '',
        q.rightAnswer || '',
      ]);
    });
    const count = list.length;

    // 3. 生成 xlsx（内存 Buffer，不写本地文件）
    const buffer = xlsx.build([{ name: '历史题库', data: rows }]);

    // 4. 主路径：直接 base64 回传（无 CDN、无冷文件，前端一次写入即打开）
    if (buffer.length <= MAX_BASE64_BYTES) {
      const fileBase64 = buffer.toString('base64');
      console.log('[download-bank] 直接返回 base64，题目数:', count, '字节:', buffer.length);
      return { code: 0, data: { fileBase64, count } };
    }

    // 5. 兜底：文件过大，仍走云存储链接（需配置 downloadFile 域名白名单）
    console.log('[download-bank] 文件过大，退回云存储，字节:', buffer.length);
    const uploadRes = await uniCloud.uploadFile({
      fileContent: buffer,
      cloudPath: 'bank/' + Date.now() + '.xlsx',
    });
    const fileID = uploadRes.fileID;
    if (!fileID) {
      throw new Error('上传云存储失败：' + JSON.stringify(uploadRes));
    }

    // 等待文件在 CDN 真正可读（真实 GET 校验），再返回链接
    let tempFileURL = '';
    for (let i = 0; i < 8; i++) {
      const urlRes = await uniCloud.getTempFileURL({ fileList: [fileID] });
      tempFileURL = (urlRes && urlRes.fileList && urlRes.fileList[0] && urlRes.fileList[0].tempFileURL) || '';
      if (!tempFileURL) {
        await sleep(500);
        continue;
      }
      try {
        const probe = await uniCloud.httpclient.request(tempFileURL, {
          method: 'GET',
          dataType: 'text',
        });
        if (probe.statusCode === 200 && probe.data) break;
      } catch (e) {
        // 未就绪，稍后重试
      }
      await sleep(700);
    }

    return { code: 0, data: { fileID, tempFileURL, count } };
  } catch (e) {
    console.error('[download-bank] 异常:', e);
    return { code: -1, msg: '生成题库失败：' + e.message };
  }
};
