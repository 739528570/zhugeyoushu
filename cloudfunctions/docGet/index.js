// 云函数入口文件
const cloud = require('wx-server-sdk')
const db = require('./database/index')

cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV }) // 使用当前云环境

// 云函数入口函数
exports.main = async (event = {}, context) => {
  try {
    const wxContext = cloud.getWXContext()

    const list = await db.document.getList({
      openid: wxContext.OPENID,
      ...event
    })
  
    return {
      code: 200,
      message: '',
      data: list,
      success: true
    }
  } catch (error) {
    return { code: 500, message: '服务器错误', success: false }
  }
}