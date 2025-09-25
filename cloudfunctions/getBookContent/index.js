// 云函数入口文件
const cloud = require('wx-server-sdk')
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV }) // 使用当前云环境
const db = cloud.database()

// 云函数入口函数
exports.main = async function (event, context) {
  try {
    const { docId, start = 0, end = 500 } = event
    const wxContext = cloud.getWXContext();
    const openid = wxContext.OPENID;
    
    if (!openid) {
      return { code: 400, message: '用户标识不能为空', success: false }
    }
    if (!docId) {
      return { code: 400, message: '书籍ID不能为空', success: false }
    }
    
    // 获取书籍信息
    // 构建查询条件
    let query = db.collection('books').where({ openid, _id: docId })

    const doc = await query.get()

    if (doc.data.length === 0) {
      return { code: 404, message: '书籍不存在', success: false }
    }
    
    // 2. 下载文件内容
    const fileContent = await cloud.downloadFile({
      fileID: doc.data[0].fileUrl
    })
    
    // 3. 处理不同格式的内容提取
    let content = ''
    const buffer = fileContent.fileContent
    
    switch (doc.data[0].type) {
      case 'TXT':
        // 自动识别编码（简化版，实际可引入chardet库）
        content = buffer.toString('utf8').replace(/\r\n/g, '\n')
        break
      case 'EPUB':
        // 实际项目中需引入epub解析库
        content = 'EPUB内容预览（完整解析需引入专业库）'
        break
      // case 'PDF':
      //   // 文本型PDF需引入pdf-parse库
      //   content = 'PDF内容预览（完整解析需引入专业库）'
      //   break
      default:
        return { code: 415, message: '不支持的文件格式', success: false }
    }
    
    // 4. 分片返回内容
    const slicedContent = content.slice(start, end)
    
    return {
      code: 200,
      data: {
        ...doc.data[0],
        content: slicedContent,
        totalLength: content.length,
        hasMore: end < content.length
      },
      success: true
    }
  } catch (err) {
    console.error('书籍解析失败:', err)
    return { code: 500, message: '解析失败', success: false }
  }
}