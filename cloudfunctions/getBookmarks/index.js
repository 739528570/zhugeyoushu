// 云函数入口文件
const cloud = require("wx-server-sdk");
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV }); // 使用当前云环境
const db = cloud.database()

/**
 * 获取书籍的所有书签
 * @param {Object} params 查询参数
 * @returns {Promise<Object>} 笔记列表
 */
exports.main = async function (params) {
  try {
    const wxContext = cloud.getWXContext();
    const openid = wxContext.OPENID;
    const { bookId } = params;

    if (!openid) {
      return { code: 400, message: "参数不完整", success: false };
    }

    const res = await db
      .collection("bookmarks")
      .where({ openid, bookId })
      .orderBy("timestamp", "asc")
      .get();

    if (bookId) {
      const bookmarks = res.data.filter(item => item.bookId === bookId);
      return { [bookId]: bookmarks };
    }

    const bookmarks = res.data.reduce((pre, cur) => {
      if (pre[cur.bookId]) {
        return { ...pre, [cur.bookId]: [...pre[cur.bookId], cur] }
      } else {
        return { ...pre, [cur.bookId]: [cur] }
      }
    }, {})

    return bookmarks;
  } catch (err) {
    console.error("获取笔记列表失败:", err);
    return { code: 500, message: "获取笔记列表失败", success: false };
  }
};
