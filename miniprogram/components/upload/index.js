// components/upload/index.js
Component({

  /**
   * 组件的属性列表
   */
  properties: {

  },

  /**
   * 组件的初始数据
   */
  data: {
    // 上传进度
    progress: 0,
    // 是否显示进度条
    showProgress: false,
    // 当前上传的文件名
    uploadFileName: '',
    // 上传是否完成
    uploadComplete: false,
    // 上传是否成功
    uploadSuccess: false,
    // 结果消息
    resultMessage: '',
    // 上传任务对象（用于取消上传）
    uploadTask: null,
    // 支持的文件格式
    supportFormats: ['txt', 'epub', 'pdf']
  },

  /**
   * 组件的方法列表
   */
  methods: {
    // 选择文件
    chooseFile(event) {
      const file = event.detail.file
      const {
        name,
        size
      } = file

      // 1. 验证文件大小（不超过50MB）
      if (size > 50 * 1024 * 1024) {
        wx.showToast({
          title: '文件过大（最大50MB）',
          icon: 'none',
          duration: 2000
        })
        return
      }

      // 2. 验证文件格式
      const fileExt = name.split('.').pop().toLowerCase()
      if (!this.data.supportFormats.includes(fileExt)) {
        wx.showToast({
          title: '不支持的文件格式',
          icon: 'none',
          duration: 2000
        })
        return
      }
      this.setData({
        showProgress: true,
        uploadFileName: name,
        progress: 0,
        uploadComplete: false,
        uploadSuccess: false,
        resultMessage: ''
      })

      event.detail.callback(true)
    },

    // 上传到云存储并调用云函数记录
    uploadToCloud(event) {
      const file = event.detail.file
      console.log('uploadToCloud', file)

      const {
        url,
        name,
        size
      } = file


      const fileExt = name.split('.').pop().toLowerCase()
      // if (!openid) {
      //   wx.showToast({
      //     title: '用户信息获取失败',
      //     icon: 'none',
      //     duration: 2000
      //   })
      //   this.setData({
      //     showProgress: false
      //   })
      //   return
      // }

      // 1. 生成云存储路径
      const cloudPath = `documents/${Date.now()}-${name}`

      console.log('uploadToCloud -- start', url, cloudPath)

      // 2. 创建上传任务
      const uploadTask = wx.cloud.uploadFile({
        cloudPath,
        fileContent: url,
        fail: (err) => {
          console.log('fail', err)

        },
      })

      // 保存任务对象用于取消上传
      // this.setData({
      //   uploadTask
      // })

      // 3. 等待上传完成
      // uploadTask.then(res => {
      //   console.log('uploadTask', res)
      //   // 上传成功，调用云函数记录文档信息
      //   return wx.cloud.callFunction({
      //     name: 'docUpload',
      //     data: {
      //       // openid,
      //       fileUrl: res.fileID,
      //       fileName: name,
      //       fileType: fileExt.toUpperCase(),
      //       fileSize: size
      //     }
      //   })
      // }).then(docResult => {
      //   // 处理云函数返回结果
      //   console.log('then', res)
      //   const {
      //     code,
      //     data,
      //     message
      //   } = docResult.result

      //   if (code === 200) {
      //     this.setData({
      //       uploadComplete: true,
      //       uploadSuccess: true,
      //       resultMessage: `文档已保存，可在"书架"中查看\nID: ${data.docId}`
      //     })
      //   } else {
      //     this.setData({
      //       uploadComplete: true,
      //       uploadSuccess: false,
      //       resultMessage: `保存文档信息失败: ${message}`
      //     })
      //   }
      // }).catch(err => {
      //   console.error('上传失败:', err)
      //   this.setData({
      //     uploadComplete: true,
      //     uploadSuccess: false,
      //     resultMessage: `上传失败: ${err.message || '未知错误'}`
      //   })
      // })
    },

    // 取消上传
    cancelUpload() {
      if (this.data.uploadTask) {
        this.data.uploadTask.abort()
        this.setData({
          showProgress: false,
          uploadTask: null,
          uploadFileName: '',
          progress: 0
        })
        wx.showToast({
          title: '已取消上传',
          icon: 'none',
          duration: 2000
        })
      }
    },

  }
})