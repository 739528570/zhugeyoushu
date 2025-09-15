// 书籍上传云函数：处理书籍上传、格式解析和元数据存储
const DocOperations = require('./docOperations')

 async function Upload (event, context) {
  try {
    const {
      openid,
      fileName,
      fileSize,
      fileType,
      fileUrl
    } = event
    console.log(event)
    
    // 添加书籍示例
    const docResult = await DocOperations.addDoc({
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
      message: '服务器错误: upload',
      success: false
    }
  }
}

module.exports = Upload
