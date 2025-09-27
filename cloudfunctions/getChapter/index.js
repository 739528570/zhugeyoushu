// 云函数入口文件
const cloud = require("wx-server-sdk");
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV }); // 使用当前云环境
const db = cloud.database()

// 云函数入口函数
exports.main = async function (event = {}, context) {
  try {
    const { bookId } = event;

    if (!bookId) {
      return { code: 400, message: "缺少必要参数bookId", success: false };
    }

    // 构建查询条件
    let query = db.collection("chapters").where({ bookId });

    // 分页查询
    const chapters = await query.get();

    return {
      code: 200,
      data: {
        chapters: chapters.data,
      },
      success: true,
    };
  } catch (error) {
    return { code: 500, message: '获取书籍列表失败', success: false }
  }
};
