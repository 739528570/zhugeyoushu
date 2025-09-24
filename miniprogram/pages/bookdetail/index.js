// pages/bookdetail/index.js
import { booksPath } from "../../utils/index";

Page({
  /**
   * 页面的初始数据
   */
  data: {
    loading: true,
    showHeader: false,
    title: "",
    content: "",
    showFooter: false,
  },

  async getDetail(id) {
    try {
      this.setData({
        loading: true,
      });
      let content = "";
      const res = await wx.cloud.callFunction({
        name: "books",
        data: {
          cmd: "getDetail",
          id,
        },
      });
      console.log("**load getDetail", res);
      const cacheFileList = getApp().globalData.cacheFileList ?? [];
      const book = res.result.data?.[0] || {};

      if (cacheFileList.length && cacheFileList.includes(book._id)) {
        const fs = wx.getFileSystemManager();
        content = await fs.readFileSync(`${booksPath}/${book._id}`, 'utf-8', 0, 1000);
        console.log('readFileSync', content)
      } else {
        const res1 = await wx.cloud.callFunction({
          name: "books",
          data: {
            cmd: "parse",
            docId: id,
          },
        });
        content = res1.result.data.content;
      }

      this.setData({
        content,
        title: book.title,
        loading: false,
      });
    } catch (error) {
      console.log('读取文件失败', error)
      this.setData({
        loading: false,
      });
    }
  },

  async getPage() {},

  backHome() {
    wx.navigateBack();
  },

  handleTap() {
    this.setData({
      showFooter: !this.data.showFooter,
    });
  },

  /**
   * 生命周期函数--监听页面加载
   */
  async onLoad(options) {
    console.log(options);
    if (options.id) {
      await this.getDetail(options.id);
    }
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
