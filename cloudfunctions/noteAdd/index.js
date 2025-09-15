// 添加笔记云函数：处理高亮、批注等笔记类型的存储
const cloud = require('wx-server-sdk')
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })
const db = cloud.database()

exports.main = async (event, context) => {
  try {
    const { openid, docId, content, type, position, color, tag } = event
    
    // 1. 验证参数
    if (!openid || !docId || !content || !type || position === undefined) {
      return { code: 400, message: '笔记参数不完整', success: false }
    }
    
    // 2. 验证书籍是否存在
    const docCheck = await db.collection('Document')
      .where({ _id: docId, openid })
      .count()
      
    if (docCheck.total === 0) {
      return { code: 404, message: '书籍不存在或无权限', success: false }
    }
    
    // 3. 保存笔记到数据库
    const noteResult = await db.collection('Note').add({
      data: {
        openid,
        doc_id: docId,
        content,
        type, // highlight/note/doodle
        position, // 字符偏移量
        timestamp: Date.now(),
        color: color || 'yellow',
        tag: tag || '',
        createTime: new Date(),
        updateTime: new Date()
      }
    })
    
    return {
      code: 200,
      message: '笔记添加成功',
      data: { noteId: noteResult._id },
      success: true
    }
  } catch (err) {
    console.error('添加笔记失败:', err)
    return { code: 500, message: '服务器错误', success: false }
  }
}
