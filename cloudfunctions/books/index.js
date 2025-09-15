// 云函数入口文件
const cloud = require('wx-server-sdk')
// 云函数入口文件
const Upload = require('./upload')
const GetList = require('./getList')
const Delete = require('./delete')
const GetDetail = require('./getDetail')

cloud.init({
  env: cloud.DYNAMIC_CURRENT_ENV
}) // 使用当前云环境

// 云函数入口函数
exports.main = async (event, context) => {
  try {
    const {
      cmd,
      ...params
    } = event
    if (!cmd) {
      return {
        code: 500,
        message: '缺少参数cmd',
        success: false
      }
    }
    switch (cmd) {
      case 'upload':
        return await Upload(params);
      case 'getList':
        return await GetList(params);
      case 'delete':
        return await Delete(params);
      case 'parse':
        return await Parse(params);
      case 'getDetail':
        return await GetDetail(params);

      default:
        return {
          code: 500, message: '无此接口: ' + cmd, success: false
        }
        break;
    }
  } catch (error) {
    return {
      code: 500,
      message: '服务器错误: index',
      success: false
    }
  }
}