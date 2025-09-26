// components/upload/index.js
import {
  booksPath
} from "../../utils/index";

Component({
  options: {
    multipleSlots: true, // 在组件定义时的选项中启用多slot支持
  },
  /**
   * 组件的属性列表
   */
  properties: {},

  /**
   * 组件的初始数据
   */
  data: {
    show: false,
    // 上传进度
    progress: 0,
    // 是否显示进度条
    showProgress: false,
    // 当前上传的文件名
    uploadFileName: "",
    // 上传是否完成
    uploadComplete: false,
    // 上传是否成功
    uploadSuccess: false,
    // 结果消息
    resultMessage: "",
    // 上传任务对象（用于取消上传）
    uploadTask: null,
    // 支持的文件格式
    supportFormats: ["txt", "epub", "pdf"],
  },

  /**
   * 组件的方法列表
   */
  methods: {
    // 选择文件
    async chooseFile(event) {
      if (this.data.showProgress) return;
      const that = this;
      wx.chooseMessageFile({
        count: 1,
        type: "file",
        extension: that.data.supportFormats,
        success(res) {
          console.log(res);
          const file = res.tempFiles[0];
          const {
            name,
            size
          } = file;
          // 1. 验证文件大小（不超过50MB）
          if (size > 50 * 1024 * 1024) {
            wx.showToast({
              title: "文件过大（最大50MB）",
              icon: "none",
              duration: 2000,
            });
            return;
          }

          // 2. 验证文件格式
          const fileExt = name.split(".").pop().toLowerCase();
          if (!that.data.supportFormats.includes(fileExt)) {
            wx.showToast({
              title: "不支持的文件格式",
              icon: "none",
              duration: 2000,
            });
            return;
          }
          that.setData({
            show: true,
            showProgress: true,
            uploadFileName: name,
            progress: 0,
            uploadComplete: false,
            uploadSuccess: false,
            resultMessage: "",
          });
          that.uploadToCloud(file);
        },
      });
    },

    // 上传到云存储并调用云函数记录
    async uploadToCloud(file) {
      const that = this;
      const app = getApp();
      const info = await wx.cloud.callFunction({
        name: "getWXContext",
      });
      const openid = info.result?.openid;
      console.log("uploadToCloud", file, openid);
      const {
        path,
        name,
        size
      } = file;
      const fileExt = name.split(".").pop().toLowerCase();
      const fileName = name.split(".").shift();
      if (!openid) {
        wx.showToast({
          title: "用户信息获取失败",
          icon: "none",
          duration: 2000,
        });
        that.setData({
          showProgress: false,
        });
        return;
      }

      // 云存储路径
      const cloudPath = `books/${openid}/${Date.now()}-${fileName}`;

      // 创建上传任务
      const uploadTask = wx.cloud.uploadFile({
        cloudPath,
        filePath: path,
        success: async res => {
          try {
            console.log('uploadFile success', res)
            // 上传DB
            const bookResult = await wx.cloud.callFunction({
              name: 'uploadBook',
              data: {
                fileUrl: res.fileID,
                fileName: fileName,
                fileType: fileExt.toUpperCase(),
                fileSize: size
              }
            })
            if (!bookResult.result._id) throw bookResult;
            console.log('wx.cloud.callFunction', bookResult, file)
            // 本地缓存
            await app.addLocalFile(bookResult.result._id, path)
            that.setData({
              show: false,
              showProgress: false,
              uploadComplete: true,
              uploadSuccess: true,
            })
            that.triggerEvent('onOk', {}, {});
            that.setData({
              progress: 0
            });
          } catch (error) {
            console.error(error)
            that.setData({
              show: false,
              showProgress: false,
              uploadComplete: true,
              uploadSuccess: false,
              progress: 0
            })
            wx.showToast({
              title: '上传失败，请稍后重试',
              icon: 'none',
              duration: 2000
            })
          }
        },
        fail: (err) => {
          console.error('wx.cloud.uploadFile fail', err)
          that.setData({
            show: false,
            showProgress: false,
            uploadComplete: true,
            uploadSuccess: false,
            progress: 0
          })
          wx.showToast({
            title: '上传失败，请稍后重试',
            icon: 'none',
            duration: 2000
          })
        },
      })

      // 保存任务对象用于取消上传
      that.setData({
        uploadTask
      })
      uploadTask.onProgressUpdate((res) => {
        that.setData({
          progress: res.progress
        })
      });
    },

    // 取消上传
    cancelUpload() {
      if (this.data.uploadTask) {
        this.data.uploadTask.abort();
        this.setData({
          showProgress: false,
          uploadTask: null,
          uploadFileName: "",
          progress: 0,
        });
        wx.showToast({
          title: "已取消上传",
          icon: "none",
          duration: 2000,
        });
      }
    },
  },
});