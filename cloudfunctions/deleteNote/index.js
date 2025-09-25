// 云函数入口文件
const cloud = require("wx-server-sdk");
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV }); // 使用当前云环境
const db = cloud.database()

/**
 * 删除笔记
 * @param {Object} params 删除参数
 * @returns {Promise<Object>} 操作结果
 */
exports.main = async function (params) {
  try {
    const wxContext = cloud.getWXContext();
    const openid = wxContext.OPENID;
    const { noteId } = params;

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

    await db.collection("notes").doc(noteId).remove();

    return { code: 200, message: "笔记已删除", success: true };
  } catch (err) {
    console.error("删除笔记失败:", err);
    return { code: 500, message: "删除笔记失败", success: false };
  }
};
