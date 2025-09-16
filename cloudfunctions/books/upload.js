// 书籍上传云函数：处理书籍上传、格式解析和元数据存储
const DocOperations = require('./docOperations')
const ReadingRecordOperations = require('./readingRecordOperations')

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
      openid,
      title: fileName,
      type: fileType,
      size: fileSize,
      fileUrl: fileUrl
    })

    await ReadingRecordOperations.addRecord({
      openid,
      docId: docResult.data.docId,
      readPage: 1
    })
    return docResult
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
