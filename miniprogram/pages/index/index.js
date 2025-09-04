// index.js
wx.cloud.init()
Page({
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
  async handleUpload() {
    wx.chooseMessageFile({
      count: 1,
      type: "file",
      extension: ["txt", "epub", "pdf"],
      success: function (res) {
        const file = res.tempFiles?.[0];
        console.log(res);

        wx.cloud.callFunction({
          // 云函数名称
          name: 'docUpload',
          // 传给云函数的参数
          data: file,
          success: function (res) {
            console.log(res)
          },
          fail: console.error
        })
      },
      fail(err) {
        console.error('选择文件失败:', err)
        wx.showToast({
          title: '选择文件失败',
          icon: 'none',
          duration: 2000
        })
      }
    });
  },
  onLoad(options) {},
});