// pages/bookdetail/index.js
import { booksPath } from "../../utils/index";
Page({
  /**
   * 页面的初始数据
   */
  data: {
    id: "",
    title: "",
    loading: true,
    content: "",
    currentPosition: 0, // 当前阅读位置（字符索引）
    chunkSize: 10000, // 每次加载的字符数（约20KB，可根据实际调整）
    totalLength: 0, // 小说总长度
    hasMore: true, // 是否还有更多内容
    encoding: "utf-8",
    lineHeight: 36,
    lineHeightMax: 48,
    lineHeightMin: 28,
    fontSizeMax: 32,
    fontSizeMin: 10,
    fontSize: 16,
    mode: "sunny",
    showHeader: false,
    showFooter: false,
    showChapters: false,
    chapters: [],
  },

  async getDetail() {
    try {
      const res = await wx.cloud.callFunction({
        name: "getBooks",
        data: {
          bookId: this.data.id,
        },
      });

      let book = res.result.data?.books?.[0] || {};
      console.log("getDetail", book);
      this.setData({
        title: book.title,
        encoding: book.encoding,
        totalLength: book.size,
      });
    } catch (error) {
      console.log("读取文件失败", error);
      this.setData({
        loading: false,
      });
    }
  },

  // 读取指定范围的内容片段
  async readContentChunk(start, length) {
    try {
      console.log("readContentChunk", this.data);

      let fullContent = "";
      const encoding = this.data.encoding;
      const fs = wx.getFileSystemManager();
      console.log(`检测到文件编码: ${encoding}`);
      let decoder;
      if (typeof TextDecoder !== "undefined") {
        decoder = new TextDecoder(encoding);
      } else {
        const { TextDecoder } = require("text-decoding");
        decoder = new TextDecoder(encoding);
      }
      const buffer = await fs.readFileSync(`${booksPath}/${this.data.id}`);
      const arr = new Uint8Array(buffer);
      fullContent = decoder.decode(arr);

      // 截取指定范围的片段（考虑边界情况）
      const end = Math.min(start + length, fullContent.length);
      const chunk = fullContent.substring(start, end);

      this.setData({ hasMore: end < fullContent.length });

      return chunk;
    } catch (err) {
      console.error("读取内容片段失败:", err);
      return "";
    }
  },

  // 加载更多内容（滚动到底部时触发）
  async loadMoreContent() {
    if (this.data.loading || !this.data.hasMore) return;

    this.setData({ loading: true });
    try {
      const nextChunk = await this.readContentChunk(
        this.data.currentPosition,
        this.data.chunkSize
      );

      // 追加内容（而非替换）
      this.setData({
        bookContent: this.data.bookContent + nextChunk,
        currentPosition: this.data.currentPosition + this.data.chunkSize,
        loading: false,
      });
    } catch (err) {
      console.error("加载更多内容失败:", err);
      this.setData({ loading: false });
    }
  },

  // 加载初始内容（首屏）
  async loadInitialContent() {
    this.setData({ loading: true });
    try {
      const content = await this.readContentChunk(0, this.data.chunkSize);
      this.setData({
        content,
        currentPosition: this.data.chunkSize,
        loading: false,
      });
    } catch (err) {
      console.error("加载初始内容失败:", err);
      this.setData({ loading: false });
    }
  },

  // 监听滚动事件，接近底部时加载更多
  onScroll(e) {
    console.log("onScroll", this.data.hasMore);
    // const { scrollTop, scrollHeight, clientHeight } = e.detail;
    // // 当距离底部小于200px时加载更多
    // if (scrollHeight - scrollTop - clientHeight < 200) {
    //   this.loadMoreContent();
    // }
  },

  async getChapters() {
    try {
      const res = (await wx.getStorageSync("chapters")) || {};
      const chapters = res?.[this.data.id] ?? [];
      this.setData({
        chapters,
      });
    } catch (error) {
      console.error(error);
    }
  },

  switchFooter() {
    this.setData({
      showFooter: !this.data.showFooter,
    });
  },
  switchChapters() {
    this.setData({
      showChapters: !this.data.showChapters,
    });
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

  /**
   * 生命周期函数--监听页面加载
   */
  async onLoad(options) {
    console.log(options);
    try {
      if (options.id) {
        await this.setData({ id: options.id });
        await this.getDetail();
        await this.getChapters();
        await this.loadInitialContent();
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
