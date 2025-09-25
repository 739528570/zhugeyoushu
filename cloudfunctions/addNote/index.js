// 云函数入口文件
const cloud = require("wx-server-sdk");
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV }); // 使用当前云环境
const db = cloud.database();

/**
 * 添加笔记
 * @param {Object} noteInfo 笔记信息
 * @returns {Promise<Object>} 操作结果
 */
exports.main = async function (noteInfo) {
  try {
    const wxContext = cloud.getWXContext();
    const openid = wxContext.OPENID;
    const {
      docId,
      content,
      type,
      position,
      timestamp,
      color = "yellow",
      tag = "",
    } = noteInfo;

    // 验证必填参数
    if (
      !openid ||
      !docId ||
      !content ||
      !type ||
      position === undefined ||
      !timestamp
    ) {
      return { code: 400, message: "缺少必要的笔记信息", success: false };
    }

    // 验证书籍是否存在
    const doc = await db
      .collection("books")
      .where({ _id: docId, openid })
      .get();

    if (doc.data.length === 0) {
      return { code: 404, message: "关联书籍不存在", success: false };
    }

    const result = await db.collection("notes").add({
      data: {
        openid,
        docId,
        content,
        type, // highlight/note
        position,
        timestamp,
        color,
        tag,
        createTime: db.serverDate(),
        updateTime: db.serverDate(),
      },
    });

    return {
      code: 200,
      data: { noteId: result._id },
      message: "笔记添加成功",
      success: true,
    };
  } catch (err) {
    console.error("添加笔记失败:", err);
    return { code: 500, message: "笔记添加失败", success: false };
  }
};
