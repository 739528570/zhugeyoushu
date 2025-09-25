// 云函数入口文件
const cloud = require("wx-server-sdk");
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV }); // 使用当前云环境
const db = cloud.database();

/**
 * 更新笔记
 * @param {Object} params 更新参数
 * @returns {Promise<Object>} 操作结果
 */
exports.main = async function (params) {
  try {
    const wxContext = cloud.getWXContext();
    const openid = wxContext.OPENID;
    const { noteId, content, color, tag } = params;

    if (!openid || !noteId) {
      return { code: 400, message: "参数不完整", success: false };
    }

    // 验证笔记归属
    const note = await db
      .collection("notes")
      .where({ _id: noteId, openid })
      .get();

    if (note.data.length === 0) {
      return { code: 403, message: "无权操作此笔记", success: false };
    }

    // 构建更新数据
    const updateData = { updateTime: db.serverDate() };
    if (content !== undefined) updateData.content = content;
    if (color !== undefined) updateData.color = color;
    if (tag !== undefined) updateData.tag = tag;

    await db.collection("notes").doc(noteId).update({
      data: updateData,
    });

    return { code: 200, message: "笔记已更新", success: true };
  } catch (err) {
    console.error("更新笔记失败:", err);
    return { code: 500, message: "更新笔记失败", success: false };
  }
};
