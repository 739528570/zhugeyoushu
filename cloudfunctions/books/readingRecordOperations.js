// 阅读记录操作工具类
const cloud = require('wx-server-sdk')
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })
const db = cloud.database()
const _ = db.command

class ReadingRecordOperations {
  /**
   * 记录页面阅读信息
   * @param {Object} recordInfo 阅读记录信息
   * @returns {Promise<Object>} 操作结果
   */
  static async addRecord(recordInfo) {
    try {
      const { openid, docId, readPage } = recordInfo
      
      if (!openid || !docId || readPage === undefined) {
        return { code: 400, message: '缺少必要的阅读记录信息', success: false }
      }
      
      // 1. 添加阅读记录
      await db.collection('readingRecords').add({
        data: {
          openid,
          docId,
          readPage,
          createTime: db.serverDate()
        }
      })
      
      // 2. 更新文档最后阅读页码
      await db.collection('documents')
        .where({ _id: docId, openid })
        .update({
          data: {
            lastReadPage: readPage,
            updateTime: db.serverDate()
          }
        })
      
      return {
        code: 200,
        message: '阅读记录已保存',
        success: true
      }
    } catch (err) {
      console.error('添加阅读记录失败:', err)
      return { code: 500, message: '阅读记录保存失败', success: false }
    }
  }

  /**
   * 获取文档的阅读记录
   * @param {Object} params 查询参数
   * @returns {Promise<Object>} 阅读记录列表
   */
  static async getDocRecords(params) {
    try {
      const { openid, docId, startDate, endDate } = params
      
      if (!openid || !docId) {
        return { code: 400, message: '参数不完整', success: false }
      }
      
      // 构建查询条件
      const whereCondition = { openid, docId }
      if (startDate && endDate) {
        whereCondition.createTime = _.gte(new Date(startDate)).lte(new Date(endDate))
      }
      
      const records = await db.collection('readingRecords')
        .where(whereCondition)
        .orderBy('createTime', 'desc')
        .get()
      
      return {
        code: 200,
        data: { records: records.data },
        success: true
      }
    } catch (err) {
      console.error('获取阅读记录失败:', err)
      return { code: 500, message: '获取阅读记录失败', success: false }
    }
  }

  /**
   * 获取文档的阅读统计
   * @param {Object} params 查询参数
   * @returns {Promise<Object>} 阅读统计数据
   */
  static async getReadStats(params) {
    try {
      const { openid, docId } = params
      
      if (!openid || !docId) {
        return { code: 400, message: '参数不完整', success: false }
      }
      
      // 获取文档总页数
      const doc = await db.collection('documents')
        .where({ _id: docId, openid })
        .field({ totalPages: true })
        .get()
      
      if (doc.data.length === 0) {
        return { code: 404, message: '文档不存在', success: false }
      }
      
      const totalPages = doc.data[0].totalPages
      
      // 统计已阅读的页数
      const readPagesResult = await db.collection('readingRecords')
        .where({ openid, docId })
        .groupBy('readPage')
        .get()
      
      const readPagesCount = readPagesResult.data.length
      const readPercentage = totalPages > 0 ? Math.round((readPagesCount / totalPages) * 100) : 0
      
      // 统计总阅读时长
      const timeResult = await db.collection('readingRecords')
        .where({ openid, docId })
        .get()
      
      
      return {
        code: 200,
        data: {
          totalPages,
          readPages: readPagesCount,
          readPercentage,
        },
        success: true
      }
    } catch (err) {
      console.error('获取阅读统计失败:', err)
      return { code: 500, message: '获取阅读统计失败', success: false }
    }
  }
}

module.exports = ReadingRecordOperations
