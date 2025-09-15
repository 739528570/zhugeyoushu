const DocOperations = require('./docOperations')
const cloud = require('wx-server-sdk')

async function GetList (event = {}, context) {
  try {
    const wxContext = cloud.getWXContext()

    const doc = await DocOperations.getDocList({
      openid: wxContext.OPENID,
      ...event
    })
  
    return doc
  } catch (error) {
    return { code: 500, message: '服务器错误: getList', success: false }
  }
}

module.exports = GetList
