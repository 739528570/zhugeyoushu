// 文档上传云函数：处理文档上传、格式解析和元数据存储
const cloud = require('wx-server-sdk')
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })
const db = cloud.database()
const fs = require('fs')
const path = require('path')

exports.main = async (event, context) => {
  try {
    const { openid, fileBuffer, fileName, fileType } = event
    
    // 1. 验证参数
    if (!openid || !fileBuffer || !fileName || !fileType) {
      return { code: 400, message: '参数缺失', success: false }
    }
    
    // 2. 提取文件元数据
    const fileExt = fileName.split('.').pop().toLowerCase()
    const fileSize = Buffer.byteLength(fileBuffer) / 1024 // KB
    const timestamp = Date.now()
    const cloudPath = `documents/${openid}/${timestamp}-${fileName}`
    
    // 3. 上传文件到云存储
    const uploadResult = await cloud.uploadFile({
      cloudPath,
      fileContent: Buffer.from(fileBuffer, 'base64')
    })
    
    if (!uploadResult.fileID) {
      return { code: 500, message: '文件上传失败', success: false }
    }
    
    // 4. 保存文档信息到数据库
    const docResult = await db.collection('Document').add({
      data: {
        openid,
        title: fileName,
        type: fileType.toUpperCase(),
        size: Math.round(fileSize * 100) / 100,
        createTime: new Date(),
        updateTime: new Date(),
        lastReadPos: 0,
        fileUrl: uploadResult.fileID,
        coverUrl: '' // 可后续添加封面生成逻辑
      }
    })
    
    return {
      code: 200,
      message: '文档上传成功',
      data: {
        docId: docResult._id,
        fileUrl: uploadResult.fileID
      },
      success: true
    }
  } catch (err) {
    console.error('文档上传失败:', err)
    return { code: 500, message: '服务器错误', success: false }
  }
}
