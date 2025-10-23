// 云函数入口文件
const cloud = require("wx-server-sdk");
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV }); // 使用当前云环境
const db = cloud.database();

// 云函数入口函数
exports.main = async function (event, context) {
  try {
    const wxContext = cloud.getWXContext();
    const openid = wxContext.OPENID;
    console.log('upload', event)
    const { fileName, fileType, fileSize, fileUrl, coverUrl = "", encoding, totalLength } = event;
    // 验证必填参数
    if (!openid || !fileName || !fileType || !fileSize || !fileUrl) {
      return { code: 400, message: "缺少必要的书籍信息", success: false };
    }

    const result = await db.collection("books").add({
      data: {
        openid,
        title: fileName,
        type: fileType,
        size: fileSize,
        fileUrl: fileUrl,
        totalLength,
        encoding,
        coverUrl,
        createTime: db.serverDate(),
        updateTime: db.serverDate(),
        readingProgress: {
          chapterId: 0,
          page: 0,
        },
      },
    });

    // await cloud.callFunction({
    //   name: 'splitChapters',
    //   data: {
    //     bookId: result._id,
    //     fileType,
    //     fileUrl
    //   }
    // })
    console.log(result)
    return result;
  } catch (err) {
    console.error("上传失败:", err);
    return {
      code: 500,
      message: "上传失败",
      success: false,
      error: err
    };
  }
};
