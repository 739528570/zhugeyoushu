// 云函数入口文件
const cloud = require("wx-server-sdk");
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV }); // 使用当前云环境
const db = cloud.database()

/**
 * 删除笔记
 * @param {Object} data 删除参数
 * @returns {Promise<Object>} 操作结果
 */
exports.main = async function (data) {
  try {
    const wxContext = cloud.getWXContext();
    const openid = wxContext.OPENID;
    const { bookmarkId } = data;
    if (!openid || !bookmarkId) {
      return { code: 400, message: "参数不完整", success: false };
    }

    // 验证笔记归属
    const bookmarks = await db
      .collection("bookmarks")
      .where({ _id: bookmarkId, openid })
      .get();

    if (bookmarks.data.length === 0) {
      return { code: 403, message: "无权操作此书签", success: false };
    }

    await db.collection("bookmarks").doc(bookmarkId).remove();

    return { code: 200, message: "书签已删除", success: true };
  } catch (err) {
    console.error("删除笔记失败:", err);
    return { code: 500, message: "删除笔记失败", success: false };
  }
};
