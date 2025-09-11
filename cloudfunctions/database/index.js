// 数据库操作入口函数
// 统一管理文档和笔记的所有数据库操作
const cloud = require('wx-server-sdk')
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })
const db = cloud.database()

// 导入子模块
const DocOperations = require('./docOperations')
const NoteOperations = require('./noteOperations')

/**
 * 数据库初始化函数
 * 用于创建必要的索引（首次部署时调用）
 */
async function initDatabase() {
  try {
    // 为文档集合创建openid索引
    await db.collection('documents').createIndex({
      indexName: 'openid_index',
      keys: { openid: 1 },
      unique: false,
      sparse: false
    })
    
    // 为笔记集合创建复合索引(openid + docId)
    await db.collection('notes').createIndex({
      indexName: 'openid_docid_index',
      keys: { openid: 1, docId: 1 },
      unique: false,
      sparse: false
    })
    
    console.log('数据库索引创建成功')
    return { success: true, message: '数据库初始化完成' }
  } catch (err) {
    console.error('数据库初始化失败:', err)
    return { success: false, message: '数据库初始化失败', error: err.message }
  }
}

/**
 * 文档相关操作入口
 */
const document = {
  /**
   * 上传新文档
   * @param {Object} docInfo 文档信息
   * @returns {Promise<Object>} 操作结果
   */
  add: async (docInfo) => {
    return await DocOperations.addDoc(docInfo)
  },
  
  /**
   * 获取文档列表
   * @param {Object} params 查询参数
   * @returns {Promise<Object>} 文档列表
   */
  getList: async (params) => {
    return await DocOperations.getDocList(params)
  },
  
  /**
   * 获取文档详情
   * @param {Object} params 查询参数
   * @returns {Promise<Object>} 文档详情
   */
  getDetail: async (params) => {
    return await DocOperations.getDocDetail(params)
  },
  
  /**
   * 删除文档
   * @param {Object} params 删除参数
   * @returns {Promise<Object>} 操作结果
   */
  delete: async (params) => {
    // 删除文档时同时删除关联的笔记
    const deleteDocResult = await DocOperations.deleteDoc(params)
    if (deleteDocResult.success) {
      await NoteOperations.deleteNotesByDocId(params)
    }
    return deleteDocResult
  },
  
  /**
   * 更新阅读进度
   * @param {Object} params 更新参数
   * @returns {Promise<Object>} 操作结果
   */
  updateReadPos: async (params) => {
    return await DocOperations.updateReadPosition(params)
  },
  
  /**
   * 解析文档内容
   * @param {Object} params 解析参数
   * @returns {Promise<Object>} 解析结果
   */
  parseContent: async (params) => {
    return await DocOperations.parseDocumentContent(params)
  }
}

/**
 * 笔记相关操作入口
 */
const note = {
  /**
   * 添加笔记
   * @param {Object} noteInfo 笔记信息
   * @returns {Promise<Object>} 操作结果
   */
  add: async (noteInfo) => {
    return await NoteOperations.addNote(noteInfo)
  },
  
  /**
   * 获取文档的所有笔记
   * @param {Object} params 查询参数
   * @returns {Promise<Object>} 笔记列表
   */
  getByDoc: async (params) => {
    return await NoteOperations.getDocNotes(params)
  },
  
  /**
   * 按标签获取笔记
   * @param {Object} params 查询参数
   * @returns {Promise<Object>} 笔记列表
   */
  getByTag: async (params) => {
    return await NoteOperations.getNotesByTag(params)
  },
  
  /**
   * 更新笔记
   * @param {Object} params 更新参数
   * @returns {Promise<Object>} 操作结果
   */
  update: async (params) => {
    return await NoteOperations.updateNote(params)
  },
  
  /**
   * 删除笔记
   * @param {Object} params 删除参数
   * @returns {Promise<Object>} 操作结果
   */
  delete: async (params) => {
    return await NoteOperations.deleteNote(params)
  }
}

// 导出数据库操作入口
module.exports = {
  init: initDatabase,
  document,
  note,
  // 导出数据库实例和命令，供特殊场景使用
  db,
  _: db.command
}
