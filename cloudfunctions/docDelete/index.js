// 云函数入口文件
const cloud = require('wx-server-sdk')
const db = require('../database/index')

cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV }) // 使用当前云环境

// 云函数入口函数
exports.main = async (event = {}, context) => {
  try {
    const wxContext = cloud.getWXContext()

    const doc = await db.document.delete({
      openid: wxContext.OPENID,
      docId: event.docId
    })
  
    return {
      code: 200,
      message: '',
      success: true
    }
  } catch (error) {
    console.log(error)
    return { code: 500, message: '服务器错误', success: false }
  }
}