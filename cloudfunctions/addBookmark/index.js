// 云函数入口文件
const cloud = require("wx-server-sdk");
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV }); // 使用当前云环境
const db = cloud.database();

/**
 * 添加书签
 * @param {Object} params 笔记信息
 * @returns {Promise<Object>} 操作结果
 */
exports.main = async function (params) {
  try {
    const wxContext = cloud.getWXContext();
    const openid = wxContext.OPENID;
    const {
      bookId,
      title,
      chapterId,
      chapterTitle,
      page,
      text,
      timestamp,
    } = params;
    console.log(params)
    // 验证必填参数
    if (
      !openid ||
      !bookId ||
      !title ||
      !chapterId ||
      !chapterTitle ||
      !text ||
      !timestamp
    ) {
      return { code: 400, message: "缺少必要的笔记信息", success: false };
    }

    // 验证书籍是否存在
    const doc = await db
      .collection("books")
      .where({ _id: bookId, openid })
      .get();

    if (doc.data.length === 0) {
      return { code: 404, message: "关联书籍不存在", success: false };
    }

    await db.collection("bookmarks").add({
      data: {
        title,
        openid,
        bookId,
        chapterId,
        chapterTitle,
        page,
        text,
        timestamp,
        createTime: Date.now(),
      },
    });

    return {
      code: 200,
      message: "书签添加成功",
      success: true,
    };
  } catch (err) {
    console.error("书签笔记失败:", err);
    return { code: 500, message: "书签添加失败", success: false };
  }
};
