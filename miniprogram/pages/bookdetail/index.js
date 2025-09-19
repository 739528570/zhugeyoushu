// pages/bookdetail/index.js
wx.cloud.init({
  env: "cloud1-0gwzt3tn975ea82c"
})
Page({
  /**
   * 页面的初始数据
   */
  data: {
    loading: true,
    showHeader: false,
    title: '',
    content: '',
    showFooter: false  
  },

  async getDetail(id) {
    try {
      this.setData({
        loading: true
      })
      let content = ''
      const res = await wx.cloud.callFunction({
        name: 'books',
        data: {
          cmd: 'getDetail',
          id
        }
      });
      console.log('**load getDetail', res)
      const book = res.result.data?.[0] || {};
      const res1 = await wx.cloud.callFunction({
        name: 'books',
        data: {
          cmd: 'parse',
          docId: id
        }
      });
      content = res1.result.data.content
      console.log('**load parse', res1)

      this.setData({
        content,
        title: book.title,
        loading: false
      })
    } catch (error) {
      this.setData({
        loading: false
      })
    }
  },

  async getPage() {

  },

  backHome() {
    wx.navigateBack()
  },

  handleTap() {
    this.setData({
      showFooter: !this.data.showFooter
    })
  },

  /**
   * 生命周期函数--监听页面加载
   */
  async onLoad(options) {
    console.log(options)
    if (options.id) {
      await this.getDetail(options.id)
    }
  },

  /**
   * 生命周期函数--监听页面初次渲染完成
   */
  onReady() {

  },

  /**
   * 生命周期函数--监听页面显示
   */
  onShow() {

  },

  /**
   * 生命周期函数--监听页面隐藏
   */
  onHide() {

  },

  /**
   * 生命周期函数--监听页面卸载
   */
  onUnload() {

  },

  /**
   * 页面相关事件处理函数--监听用户下拉动作
   */
  onPullDownRefresh() {

  },

  /**
   * 页面上拉触底事件的处理函数
   */
  onReachBottom() {

  },

  /**
   * 用户点击右上角分享
   */
  onShareAppMessage() {

  }
})