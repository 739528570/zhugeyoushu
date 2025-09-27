// 云函数入口文件
const cloud = require("wx-server-sdk");
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV }); // 使用当前云环境
const db = cloud.database()

// 云函数入口函数
exports.main = async function (event = {}, context) {
  try {
    const wxContext = cloud.getWXContext();
    const openid = wxContext.OPENID;
    const { page = 1, size = 10, type = "", bookId } = event;

    if (!openid) {
      return { code: 400, message: "用户标识不能为空", success: false };
    }

    // 构建查询条件
    let query = db.collection("books").where({ openid });
    if (type) {
      query = query.where({ type });
    }
    if (bookId) {
      query = query.where({ _id: bookId });
    }

    // 分页查询
    const totalResult = await query.count();
    const books = await query
      .orderBy("updateTime", "desc")
      .skip((page - 1) * size)
      .limit(size)
      .get();

    return {
      code: 200,
      data: {
        books: books.data,
        total: totalResult.total,
        page,
        size,
      },
      success: true,
    };
  } catch (error) {
    return { code: 500, message: '获取书籍列表失败', success: false }
  }
};
