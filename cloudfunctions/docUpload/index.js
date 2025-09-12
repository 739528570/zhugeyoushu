// 文档上传云函数：处理文档上传、格式解析和元数据存储
const db = require('../database/index')

exports.main = async (event, context) => {
  try {
    const {
      openid,
      fileName,
      fileSize,
      fileType,
      fileUrl
    } = event
    console.log(event)
    
    // 添加文档示例
    const docResult = await db.document.add({
      openid: openid,
      title: fileName,
      type: fileType,
      size: fileSize,
      fileUrl: fileUrl
    })
    console.log(docResult)
    return {
      code: 200,
      message: '上传成功',
      // data: {
      //   docId: docResult._id,
      //   fileUrl: uploadResult.fileID
      // },
      success: true
    }
  } catch (err) {
    console.error('上传失败:', err)
    return {
      code: 500,
      message: '服务器错误',
      success: false
    }
  }
}