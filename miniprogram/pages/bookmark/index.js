// pages/username/index.js
Page({
  /**
   * 页面的初始数据
   */
  data: {
    url: "",
  },

  /**
   * 生命周期函数--监听页面加载
   */
  onLoad() {
    // 调用云函数获取抖音PC版HTML
    const that = this;
    wx.cloud
      .callFunction({
        name: "proxyWWW",
        data: {
          url: "https://www.douyin.com",
        },
      })
      .then((res) => {
        console.log("html", res);

        if (res.result.success) {
          const htmlUrl = res.result.htmlUrl;
          // 将HTML内容保存到云存储，生成临时链接（因为web-view的src需要是URL）
          that.setData({ url: htmlUrl })
        } else {
          wx.showToast({ title: "加载失败", icon: "none" });
        }
      })
      .catch((err) => {
        console.error("云函数调用失败：", err);
      });
  },

  /**
   * 生命周期函数--监听页面初次渲染完成
   */
  onReady() {},

  /**
   * 生命周期函数--监听页面显示
   */
  onShow() {},

  /**
   * 生命周期函数--监听页面隐藏
   */
  onHide() {},

  /**
   * 生命周期函数--监听页面卸载
   */
  onUnload() {},

  /**
   * 页面相关事件处理函数--监听用户下拉动作
   */
  onPullDownRefresh() {},

  /**
   * 页面上拉触底事件的处理函数
   */
  onReachBottom() {},

  /**
   * 用户点击右上角分享
   */
  onShareAppMessage() {},
});
