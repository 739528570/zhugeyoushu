// pages/bookdetail/index.js
import { booksPath } from "../../utils/index";
Page({
  /**
   * 页面的初始数据
   */
  data: {
    lineHeight: 36,
    lineHeightMax: 48,
    lineHeightMin: 28,
    fontSizeMax: 32,
    fontSizeMin: 10,
    fontSize: 16,
    mode: "sunny",
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
        name: "getBooks",
        data: {
          bookId: id,
        },
      });

      const cacheFileList = getApp().globalData.cacheFileList ?? [];
      let book = res.result.data?.books?.[0] || {};
      console.log("getDetail", res, cacheFileList);

      if (cacheFileList.length && cacheFileList.includes(book._id)) {
        const fs = wx.getFileSystemManager();
        console.log(`检测到文件编码: ${book.encoding}`);
        let decoder;
        if (typeof TextDecoder !== "undefined") {
          // 优先使用环境自带的 TextDecoder
          decoder = new TextDecoder(book.encoding);
        } else {
          // 降级方案：使用 text-decoding 库
          const { TextDecoder } = require("text-decoding");
          decoder = new TextDecoder(book.encoding);
        }
        const buffer = await fs.readFileSync(`${booksPath}/${book._id}`);
        const arr = new Uint8Array(buffer);
        content = decoder.decode(arr);
      }

      this.setData({
        content,
        title: book.title,
        loading: false,
      });
    } catch (error) {
      console.log("读取文件失败", error);
      this.setData({
        loading: false,
      });
    }
  },

  fontSizePlus() {
    let fontSize = this.data.fontSize;
    if (fontSize >= this.data.fontSizeMax) return;
    this.setData({
      fontSize: ++fontSize,
    });
    wx.setStorage({
      key: "fontSize",
      data: fontSize,
    });
  },
  fontSizeMinus() {
    let fontSize = this.data.fontSize;
    if (fontSize <= this.data.fontSizeMin) return;
    this.setData({
      fontSize: --fontSize,
    });
    wx.setStorage({
      key: "fontSize",
      data: fontSize,
    });
  },
  setFontSize(event) {
    const fontSize = event.detail.value;
    this.setData({
      fontSize,
    });
    wx.setStorage({
      key: "fontSize",
      data: fontSize,
    });
  },
  cutModeLight() {
    const mode = "light";
    this.setData({
      mode,
    });
    wx.setStorage({
      key: "mode",
      data: mode,
    });
  },
  cutModeSunny() {
    const mode = "sunny";
    this.setData({
      mode,
    });
    wx.setStorage({
      key: "mode",
      data: mode,
    });
  },
  lineHeightPlus() {
    let lineHeight = this.data.lineHeight;
    if (lineHeight >= this.data.lineHeightMax) return;
    this.setData({
      lineHeight: ++lineHeight,
    });
    wx.setStorage({
      key: "lineHeight",
      data: lineHeight,
    });
  },
  lineHeightMinus() {
    let lineHeight = this.data.lineHeight;
    if (lineHeight <= this.data.lineHeightMin) return;
    this.setData({
      lineHeight: --lineHeight,
    });
    wx.setStorage({
      key: "lineHeight",
      data: lineHeight,
    });
  },

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
    try {
      if (options.id) {
        await this.getDetail(options.id);
      }
      let fontSize = 16;
      let mode = "sunny";
      const fontSizeLocal = await wx.getStorageSync("fontSize");
      if (fontSizeLocal) {
        fontSize = String(fontSizeLocal);
      }
      const modeLocal = await wx.getStorageSync("mode");
      if (modeLocal) {
        mode = modeLocal;
      }
      this.setData({
        mode,
        fontSize,
        barHeight: wx.getWindowInfo().statusBarHeight + 46,
      });
    } catch (e) {
      console.error("load", e);
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
