// 云函数入口文件
const cloud = require('wx-server-sdk')
const DocOperations = require('./docOperations')


// 云函数入口函数
async function Delete (event = {}, context) {
  try {
    const wxContext = cloud.getWXContext()

    const doc = await DocOperations.deleteDoc({
      openid: wxContext.OPENID,
      docId: event.docId
    })
  
    return doc
  } catch (error) {
    console.log(error)
    return { code: 500, message: '服务器错误: delete', success: false }
  }
}

module.exports = Delete
