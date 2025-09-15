// 书籍表操作工具类
const cloud = require('wx-server-sdk')
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })
const db = cloud.database()
const _ = db.command

/**
 * 书籍表结构定义（在云开发控制台手动创建集合时参考）
 * 集合名：documents
 * 索引：openid（普通索引，用于查询用户书籍）
 */

class DocOperations {
  /**
   * 新增书籍记录
   * @param {Object} docInfo 书籍信息
   * @returns {Promise<Object>} 操作结果
   */
  static async addDoc(docInfo) {
    try {
      const { openid, title, type, size, fileUrl, coverUrl = '' } = docInfo
      
      // 验证必填参数
      if (!openid || !title || !type || !size || !fileUrl) {
        return { code: 400, message: '缺少必要的书籍信息', success: false }
      }
      
      const result = await db.collection('documents').add({
        data: {
          openid,
          title,
          type,
          size,
          fileUrl,
          coverUrl,
          lastReadPos: 0, // 初始阅读位置
          createTime: db.serverDate(),
          updateTime: db.serverDate()
        }
      })
      
      return {
        code: 200,
        data: { docId: result._id },
        message: '书籍记录创建成功',
        success: true
      }
    } catch (err) {
      console.error('新增书籍失败:', err)
      return { code: 500, message: '书籍记录创建失败', success: false }
    }
  }

  /**
   * 获取用户书籍列表
   * @param {Object} params 查询参数
   * @returns {Promise<Object>} 书籍列表
   */
  static async getDocList(params) {
    try {
      const { openid, page = 1, size = 10, type = '' } = params
      
      if (!openid) {
        return { code: 400, message: '用户标识不能为空', success: false }
      }
      
      // 构建查询条件
      let query = db.collection('documents').where({ openid })
      if (type) {
        query = query.where({ type })
      }
      
      // 分页查询
      const totalResult = await query.count()
      const docs = await query
        .orderBy('updateTime', 'desc')
        .skip((page - 1) * size)
        .limit(size)
        .get()
      
      return {
        code: 200,
        data: {
          docs: docs.data,
          total: totalResult.total,
          page,
          size
        },
        success: true
      }
    } catch (err) {
      console.error('获取书籍列表失败:', err)
      return { code: 500, message: '获取书籍列表失败', success: false }
    }
  }

  /**
   * 获取用户书籍
   * @param {Object} params 查询参数
   * @returns {Promise<Object>} 书籍列表
   */
  static async getDetail(params) {
    try {
      const { openid, id } = params
      
      if (!openid) {
        return { code: 400, message: '用户标识不能为空', success: false }
      }
      if (!id) {
        return { code: 400, message: '书籍ID不能为空', success: false }
      }
      
      // 构建查询条件
      let query = db.collection('documents').where({ openid, _id: id })

      const doc = await query.get()
      
      return {
        code: 200,
        data: doc.data,
        success: true
      }
    } catch (err) {
      console.error('获取书籍失败:', err)
      return { code: 500, message: '获取书籍失败', success: false }
    }
  }

  /**
   * 更新书籍阅读进度
   * @param {Object} params 更新参数
   * @returns {Promise<Object>} 操作结果
   */
  static async updateReadPos(params) {
    try {
      const { openid, docId, lastReadPos } = params
      
      if (!openid || !docId === undefined || lastReadPos === undefined) {
        return { code: 400, message: '参数不完整', success: false }
      }
      
      // 验证书籍归属
      const doc = await db.collection('documents')
        .where({ _id: docId, openid })
        .get()
      
      if (doc.data.length === 0) {
        return { code: 403, message: '无权操作此书籍', success: false }
      }
      
      // 更新阅读位置
      await db.collection('documents')
        .where({ _id: docId })
        .update({
          data: {
            lastReadPos,
            updateTime: db.serverDate()
          }
        })
      
      return { code: 200, message: '阅读进度已更新', success: true }
    } catch (err) {
      console.error('更新阅读进度失败:', err)
      return { code: 500, message: '更新阅读进度失败', success: false }
    }
  }

  /**
   * 删除书籍
   * @param {Object} params 删除参数
   * @returns {Promise<Object>} 操作结果
   */
  static async deleteDoc(params) {
    try {
      const { openid, docId } = params
      
      if (!openid || !docId) {
        return { code: 400, message: '参数不完整', success: false }
      }
      
      // 验证书籍归属
      const doc = await db.collection('documents')
        .where({ _id: docId, openid })
        .get()
      
      if (doc.data.length === 0) {
        return { code: 403, message: '无权操作此书籍', success: false }
      }
      
      // 删除书籍记录
      await db.collection('documents').doc(docId).remove()
      
      // 同时删除关联的笔记
      await db.collection('notes')
        .where({ docId, openid })
        .remove()
      
      return { code: 200, message: '书籍已删除', success: true }
    } catch (err) {
      console.error('删除书籍失败:', err)
      return { code: 500, message: '删除书籍失败', success: false }
    }
  }
}

module.exports = DocOperations
