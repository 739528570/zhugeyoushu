// 笔记表操作工具类
const cloud = require('wx-server-sdk')
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })
const db = cloud.database()
const _ = db.command

/**
 * 笔记表结构定义（在云开发控制台手动创建集合时参考）
 * 集合名：notes
 * 索引：{ openid: 1, docId: 1 }（复合索引，用于查询特定书籍的笔记）
 */

class NoteOperations {
  /**
   * 添加笔记
   * @param {Object} noteInfo 笔记信息
   * @returns {Promise<Object>} 操作结果
   */
  static async addNote(noteInfo) {
    try {
      const { openid, docId, content, type, position, timestamp, color = 'yellow', tag = '' } = noteInfo
      
      // 验证必填参数
      if (!openid || !docId || !content || !type || position === undefined || !timestamp) {
        return { code: 400, message: '缺少必要的笔记信息', success: false }
      }
      
      // 验证书籍是否存在
      const doc = await db.collection('books')
        .where({ _id: docId, openid })
        .get()
      
      if (doc.data.length === 0) {
        return { code: 404, message: '关联书籍不存在', success: false }
      }
      
      const result = await db.collection('notes').add({
        data: {
          openid,
          docId,
          content,
          type, // highlight/note
          position,
          timestamp,
          color,
          tag,
          createTime: db.serverDate(),
          updateTime: db.serverDate()
        }
      })
      
      return {
        code: 200,
        data: { noteId: result._id },
        message: '笔记添加成功',
        success: true
      }
    } catch (err) {
      console.error('添加笔记失败:', err)
      return { code: 500, message: '笔记添加失败', success: false }
    }
  }

  /**
   * 获取书籍的所有笔记
   * @param {Object} params 查询参数
   * @returns {Promise<Object>} 笔记列表
   */
  static async getDocNotes(params) {
    try {
      const { openid, docId } = params
      
      if (!openid || !docId) {
        return { code: 400, message: '参数不完整', success: false }
      }
      
      const notes = await db.collection('notes')
        .where({ openid, docId })
        .orderBy('timestamp', 'asc')
        .get()
      
      return {
        code: 200,
        data: { notes: notes.data },
        success: true
      }
    } catch (err) {
      console.error('获取笔记列表失败:', err)
      return { code: 500, message: '获取笔记列表失败', success: false }
    }
  }

  /**
   * 更新笔记
   * @param {Object} params 更新参数
   * @returns {Promise<Object>} 操作结果
   */
  static async updateNote(params) {
    try {
      const { openid, noteId, content, color, tag } = params
      
      if (!openid || !noteId) {
        return { code: 400, message: '参数不完整', success: false }
      }
      
      // 验证笔记归属
      const note = await db.collection('notes')
        .where({ _id: noteId, openid })
        .get()
      
      if (note.data.length === 0) {
        return { code: 403, message: '无权操作此笔记', success: false }
      }
      
      // 构建更新数据
      const updateData = { updateTime: db.serverDate() }
      if (content !== undefined) updateData.content = content
      if (color !== undefined) updateData.color = color
      if (tag !== undefined) updateData.tag = tag
      
      await db.collection('notes').doc(noteId).update({
        data: updateData
      })
      
      return { code: 200, message: '笔记已更新', success: true }
    } catch (err) {
      console.error('更新笔记失败:', err)
      return { code: 500, message: '更新笔记失败', success: false }
    }
  }

  /**
   * 删除笔记
   * @param {Object} params 删除参数
   * @returns {Promise<Object>} 操作结果
   */
  static async deleteNote(params) {
    try {
      const { openid, noteId } = params
      
      if (!openid || !noteId) {
        return { code: 400, message: '参数不完整', success: false }
      }
      
      // 验证笔记归属
      const note = await db.collection('notes')
        .where({ _id: noteId, openid })
        .get()
      
      if (note.data.length === 0) {
        return { code: 403, message: '无权操作此笔记', success: false }
      }
      
      await db.collection('notes').doc(noteId).remove()
      
      return { code: 200, message: '笔记已删除', success: true }
    } catch (err) {
      console.error('删除笔记失败:', err)
      return { code: 500, message: '删除笔记失败', success: false }
    }
  }
}

module.exports = NoteOperations
