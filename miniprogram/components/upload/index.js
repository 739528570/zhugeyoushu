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
    async chooseFile(event) {
      wx.chooseMessageFile({
        count: 1,
        type: 'file',
        success(res) {
          console.log(res)
          // const file = event.detail.file
          // const {
          //   name,
          //   size,
          //   url
          // } = file
          // // 1. 验证文件大小（不超过50MB）
          // if (size > 50 * 1024 * 1024) {
          //   wx.showToast({
          //     title: '文件过大（最大50MB）',
          //     icon: 'none',
          //     duration: 2000
          //   })
          //   return
          // }

          // // 2. 验证文件格式
          // const fileExt = name.split('.').pop().toLowerCase()
          // if (!this.data.supportFormats.includes(fileExt)) {
          //   wx.showToast({
          //     title: '不支持的文件格式',
          //     icon: 'none',
          //     duration: 2000
          //   })
          //   return
          // }
          // this.setData({
          //   showProgress: true,
          //   uploadFileName: name,
          //   progress: 0,
          //   uploadComplete: false,
          //   uploadSuccess: false,
          //   resultMessage: ''
          // })
        }
      })

      // event.detail.callback(true)
    },

    // 上传到云存储并调用云函数记录
    async uploadToCloud(event) {
      const info = await wx.cloud.callFunction({
        name: 'getWXContext',
      })
      const openid = info.result?.openid
      const file = event.detail.file
      console.log('uploadToCloud', file, openid)

      const {
        url,
        name,
        size
      } = file


      const fileExt = name.split('.').pop().toLowerCase()
      const fileName = name.split('.').shift()
      if (!openid) {
        wx.showToast({
          title: '用户信息获取失败',
          icon: 'none',
          duration: 2000
        })
        this.setData({
          showProgress: false
        })
        return
      }

      // 1. 生成云存储路径
      const cloudPath = `documents/${openid}/${Date.now()}-${fileName}`
      // 2. 创建上传任务
      const uploadTask = wx.cloud.uploadFile({
        cloudPath,
        filePath: url,
        success: res => {
          console.log('success', {
            openid,
            fileUrl: res.fileID,
            fileName: fileName,
            fileType: fileExt.toUpperCase(),
            fileSize: size
          })
          wx.cloud.callFunction({
            name: 'docUpload',
            data: {
              openid,
              fileUrl: res.fileID,
              fileName: fileName,
              fileType: fileExt.toUpperCase(),
              fileSize: size
            }
          }).then(docResult => {
            // 处理云函数返回结果
            const {
              code
            } = docResult.result
            console.log('wx.cloud.callFunction', docResult)
            if (code === 200) {
              this.setData({
                showProgress: false,
                uploadComplete: true,
                uploadSuccess: true,
              })
              this.triggerEvent('onOk', {}, {});
            } else {
              this.setData({
                showProgress: false,
                uploadComplete: true,
                uploadSuccess: false,
              })
            }
          }).catch(err => {
            console.error('上传失败:', err)
            this.setData({
              showProgress: false,
              uploadComplete: true,
              uploadSuccess: false,
            })
            wx.showToast({
              title: '上传失败，请稍后重试',
              icon: 'none',
              duration: 2000
            })
          })
        },
        fail: (err) => {
          console.error('wx.cloud.uploadFile fail', err)
          this.setData({
            showProgress: false,
            uploadComplete: true,
            uploadSuccess: false,
          })
          wx.showToast({
            title: '上传失败，请稍后重试',
            icon: 'none',
            duration: 2000
          })
        },
      })

      // 保存任务对象用于取消上传
      this.setData({
        uploadTask
      })
      uploadTask.onProgressUpdate((res) => {
        this.setData({
          progress: res.progress
        })
      });
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