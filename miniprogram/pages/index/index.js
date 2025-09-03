// index.js
Page({
  data: {},
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
          success: function(res) {
            console.log(res)
          },
          fail: console.error
        })
      },
      fail: console.error,
    });
  },
  onLoad(options) {},
});
