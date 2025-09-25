// 云函数入口文件
const cloud = require("wx-server-sdk");
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV }); // 使用当前云环境
const db = cloud.database()

// 云函数入口函数
exports.main = async function (event = {}, context) {
  try {
    const wxContext = cloud.getWXContext();
    const openid = wxContext.OPENID;
    const { docId } = event;

    if (!openid || !docId) {
      return { code: 400, message: '参数不完整', success: false }
    }
    
    // 验证书籍归属
    const doc = await db.collection('books')
      .where({ _id: docId, openid })
      .get()
    
    if (doc.data.length === 0) {
      return { code: 403, message: '无权操作此书籍', success: false }
    }
    
    // 删除书籍记录
    await db.collection('books').doc(docId).remove()
    
    // 同时删除关联的笔记
    await db.collection('notes')
      .where({ docId, openid })
      .remove()
    // 同时删除关联的书籍记录
    await db.collection('readingRecords')
      .where({ docId, openid })
      .remove()
    
    return { code: 200, message: '书籍已删除', success: true }
  } catch (error) {
    console.log(error);
    return { code: 500, message: '删除书籍失败', success: false }
  }
};
