// 云函数入口文件
const cloud = require("wx-server-sdk");
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV }); // 使用当前云环境
const db = cloud.database();

/**
 * 更新书籍阅读进度
 * @param {Object} params 更新参数
 * @returns {Promise<Object>} 操作结果
 */
exports.main = async function (params) {
  try {
    const wxContext = cloud.getWXContext();
    const openid = wxContext.OPENID;
    const { docId, lastReadPos } = params;

    if (!openid || !docId === undefined || lastReadPos === undefined) {
      return { code: 400, message: "参数不完整", success: false };
    }

    // 验证书籍归属
    const doc = await db
      .collection("books")
      .where({ _id: docId, openid })
      .get();

    if (doc.data.length === 0) {
      return { code: 403, message: "无权操作此书籍", success: false };
    }

    // 更新阅读位置
    await db
      .collection("books")
      .where({ _id: docId })
      .update({
        data: {
          lastReadPos,
          updateTime: db.serverDate(),
        },
      });

    return { code: 200, message: "阅读进度已更新", success: true };
  } catch (err) {
    console.error("更新阅读进度失败:", err);
    return { code: 500, message: "更新阅读进度失败", success: false };
  }
};
