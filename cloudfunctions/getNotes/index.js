// 云函数入口文件
const cloud = require("wx-server-sdk");
const db = cloud.database()
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV }); // 使用当前云环境

/**
 * 获取书籍的所有笔记
 * @param {Object} params 查询参数
 * @returns {Promise<Object>} 笔记列表
 */
exports.main = async function (params) {
  try {
    const wxContext = cloud.getWXContext();
    const openid = wxContext.OPENID;
    const { bookId } = params;

    if (!openid || !bookId) {
      return { code: 400, message: "参数不完整", success: false };
    }

    const notes = await db
      .collection("notes")
      .where({ openid, bookId })
      .orderBy("timestamp", "asc")
      .get();

    return {
      code: 200,
      data: { notes: notes.data },
      success: true,
    };
  } catch (err) {
    console.error("获取笔记列表失败:", err);
    return { code: 500, message: "获取笔记列表失败", success: false };
  }
};
