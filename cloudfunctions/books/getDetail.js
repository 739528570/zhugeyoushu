const DocOperations = require('./docOperations')
const cloud = require('wx-server-sdk')

async function GetDetail (event = {}, context) {
  try {
    const wxContext = cloud.getWXContext()

    const doc = await DocOperations.getDetail({
      openid: wxContext.OPENID,
      ...event
    })
    console.log('GetDetail', doc)
    return doc
  } catch (error) {
    return { code: 500, message: '服务器错误: GetDetail', success: false }
  }
}

module.exports = GetDetail
