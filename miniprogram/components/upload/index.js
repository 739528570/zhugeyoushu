// components/upload/index.js
import chardet from "chardet";
Component({
  options: {
    multipleSlots: true, // 在组件定义时的选项中启用多slot支持
    styleIsolation: 'shared',
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
    uploadLoading: false,
    loadingText: "上传中",
  },

  /**
   * 组件的方法列表
   */
  methods: {
    // 选择文件
    async chooseFile(event) {
      const that = this;
      wx.chooseMessageFile({
        count: 1,
        type: "file",
        extension: that.data.supportFormats,
        success(res) {
          console.log(res);
          const file = res.tempFiles[0];
          const { name, size } = file;

          // 验证文件
          if (!that.validateFile(name, size)) return;

          that.setData({
            show: true,
            uploadFileName: name,
            uploadComplete: false,
            uploadSuccess: false,
            resultMessage: "",
            uploadLoading: true,
            loadingText: "上传中",
          });
          that.uploadToCloud(file);
        },
      });
    },

    // 验证文件大小和格式
    validateFile(name, size) {
      const that = this;
      // 1. 验证文件大小（不超过50MB）
      if (size > 50 * 1024 * 1024) {
        wx.showToast({
          title: "文件过大（最大50MB）",
          icon: "none",
          duration: 2000,
        });
        return false;
      }

      // 2. 验证文件格式
      const fileExt = name.split(".").pop().toLowerCase();
      if (!that.data.supportFormats.includes(fileExt)) {
        wx.showToast({
          title: "不支持的文件格式",
          icon: "none",
          duration: 2000,
        });
        return false;
      }
      return true;
    },

    // 上传到云存储并调用云函数记录
    async uploadToCloud(file) {
      const that = this;
      const app = getApp();
      const fs = wx.getFileSystemManager();
      const info = await wx.cloud.callFunction({
        name: "getWXContext",
      });
      const openid = info.result?.openid;
      const { path, name, size } = file;
      const fileExt = name.split(".").pop().toLowerCase();
      const fileName = name.split(".").shift();
      // 验证用户信息
      if (!openid) {
        that.handleError("用户信息获取失败");
        return;
      }

      // 云存储路径
      const cloudPath = `books/${openid}/${Date.now()}-${fileName}`;
      const arrayBuffer = await fs.readFileSync(path);
      const uint8Array = new Uint8Array(arrayBuffer);
      const encoding =
        chardet.detect(uint8Array)?.toLocaleLowerCase?.() || "utf8";
      console.log("encoding", encoding);

      let fullContent = "";
      let decoder;
      if (typeof TextDecoder !== "undefined") {
        decoder = new TextDecoder(encoding);
      } else {
        const { TextDecoder } = require("text-decoding");
        decoder = new TextDecoder(encoding);
      }
      fullContent = decoder.decode(uint8Array);

      // 创建上传任务
      const uploadTask = wx.cloud.uploadFile({
        cloudPath,
        filePath: path,
        success: async (res) => {
          try {
            console.log("uploadFile success", res);
            // 上传DB
            const bookResult = await wx.cloud.callFunction({
              name: "uploadBook",
              data: {
                fileUrl: res.fileID,
                fileName: fileName,
                fileType: fileExt.toUpperCase(),
                fileSize: size,
                totalLength: fullContent.length,
                encoding,
              },
            });
            const bookId = bookResult.result._id;
            if (!bookId) throw bookResult;
            that.setData({
              loadingText: "提取文章标题中",
            });
            // 章节标题提取
            const resp = await wx.cloud.callFunction({
              name: "splitChapters",
              data: {
                bookId,
                fileType: fileExt.toUpperCase(),
                fileUrl: res.fileID,
                encoding,
              },
            });
            console.log("splitChapters", resp);
            // 本地缓存
            await app.addLocalFile(bookId, path);
            await app.addStorageChapter(bookId, resp.result.data || []);
            that.setData({
              show: false,
              uploadLoading: false,
              uploadComplete: true,
              uploadSuccess: true,
            });
            that.triggerEvent("onOk", {}, {});
          } catch (error) {
            that.handleError("上传失败，请稍后重试", error);
          }
        },
        fail: (err) => {
          that.handleError("上传失败，请稍后重试", err);
        },
      });

      // 保存任务对象用于取消上传
      that.setData({
        uploadTask,
      });
      // uploadTask.onProgressUpdate((res) => {
      //   that.setData({
      //     progress: res.progress,
      //   });
      // });
    },

    // 统一错误处理
    handleError(message, error = null) {
      const that = this;
      if (error) console.error(error);
      that.triggerEvent("onOk", {}, {});
      that.setData({
        show: false,
        uploadLoading: false,
        uploadComplete: true,
        uploadSuccess: false,
      });
      wx.showToast({
        title: message,
        icon: "none",
        duration: 2000,
      });
    },

    // 取消上传
    cancelUpload() {
      if (this.data.uploadTask) {
        this.data.uploadTask.abort();
        this.setData({
          uploadLoading: false,
          uploadTask: null,
          uploadFileName: "",
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
