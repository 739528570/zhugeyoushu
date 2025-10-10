// pages/bookdetail/index.js
import { booksPath } from "../../utils/index";
Page({
  data: {
    // 内容相关
    contentChunks: [], // 内容分片数组（每个分片约10KB）
    currentChunkIndex: 0, // 当前显示的分片索引
    totalChunks: 0, // 总分片数
    totalLength: 0, // 小说总字符数

    // 状态控制
    isLoading: false, // 加载中状态
    isPreloading: false, // 预加载状态
    hasMore: true, // 是否还有更多内容
    error: "", // 错误信息

    currentPosition: 0, // 当前阅读位置（字符索引）
    chunkSize: 10000, // 每次加载的字符数（约20KB，可根据实际调整）

    // 阅读相关
    scrollTop: 0, // 滚动位置
    fontSize: 16, // 字体大小
    lineHeight: 36, // 行高
    theme: "light", // 主题（light/dark）
    title: "",
    chapters: [],
    encoding: "utf-8",
    lineHeightMax: 48,
    lineHeightMin: 28,
    mode: "sunny",
    showHeader: false,
    showFooter: false,
    showChapters: false,

    windowHeight: 0,
  },
  bookData: {
    bookId: "",
  },

  /**
   * 生命周期函数--监听页面加载
   */
  async onLoad(options) {
    try {
      if (!options.id) {
        wx.showToast({ title: "参数错误", icon: "none" });
        wx.navigateBack();
        return;
      }
      await this.setData({
        windowHeight: wx.getWindowInfo().windowHeight,
      });
      this.bookData.bookId = options.id;
      // 初始化阅读器
      this.initReader();

      await this.getDetail();
      await this.getChapters();
      await this.loadInitialContent();
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

  // 初始化阅读器
  async initReader() {
    try {
      // 1. 检查文件是否存在
      await this.checkFileExists();

      // 2. 获取文件信息（总长度等）
      await this.getDetail();

      // 3. 计算总分片数
      this.calculateTotalChunks();

      // 4. 加载初始分片（前2片，确保首屏足够内容）
      await this.loadInitialChunks();
    } catch (err) {
      console.error("初始化阅读器失败:", err);
      this.setData({ error: "加载书籍失败: " + (err.message || "未知错误") });
    }
  },

  // 检查文件是否存在
  checkFileExists() {
    return new Promise((resolve, reject) => {
      const fs = wx.getFileSystemManager();
      fs.access({
        path: this.data.filePath,
        success: () => resolve(),
        fail: () => reject(new Error("文件不存在")),
      });
    });
  },

  async getDetail() {
    try {
      const res = await wx.cloud.callFunction({
        name: "getBooks",
        data: {
          bookId: this.bookData.bookId,
        },
      });

      let book = res.result.data?.books?.[0] || {};
      console.log("getDetail", book);
      // 估算总字符数（1KB ≈ 500个汉字）
      const totalLength = Math.floor(book.size * 0.5);
      this.setData({
        title: book.title,
        encoding: book.encoding,
        totalLength: totalLength,
      });
    } catch (error) {
      console.log("读取文件失败", error);
    }
  },

  // 计算总分片数
  calculateTotalChunks() {
    const chunkSize = this.getChunkSize(); // 获取分片大小
    const totalChunks = Math.ceil(this.data.totalLength / chunkSize);
    this.setData({ totalChunks });
  },

  // 获取分片大小（根据字体大小动态调整）
  getChunkSize() {
    // 字体越大，单屏显示内容越少，分片可以更小
    if (this.data.fontSize >= 20) {
      return 5000; // 大字体：5000字符/片
    } else if (this.data.fontSize >= 18) {
      return 7000; // 中文字体：7000字符/片
    } else {
      return 10000; // 小字体：10000字符/片
    }
  },

  // 加载初始分片
  async loadInitialChunks() {
    this.setData({ isLoading: true });

    try {
      // 加载第0片
      const chunk0 = await this.loadChunk(0);

      // 预加载第1片（提升用户体验）
      const chunk1 = await this.loadChunk(1);

      // 更新数据
      this.setData({
        contentChunks: [chunk0, chunk1],
        currentChunkIndex: 0,
        isLoading: false,
        hasMore: this.data.totalChunks > 1,
      });

      // 开始预加载第2片
      this.preloadNextChunk(2);
    } catch (err) {
      this.setData({ isLoading: false });
      throw err;
    }
  },

  // 加载指定分片
  loadChunk(chunkIndex) {
    return new Promise(async (resolve, reject) => {
      const chunkSize = this.getChunkSize();
      const start = chunkIndex * chunkSize;
      const end = start + chunkSize;

      try {
        // 读取并解码指定范围的内容
        const content = await this.readContentChunk(start, end);

        resolve({
          id: `chunk-${chunkIndex}`,
          content,
          index: chunkIndex,
        });
      } catch (err) {
        console.error(`加载分片${chunkIndex}失败:`, err);
        reject(err);
      }
    });
  },

  // 读取指定范围的内容片段
  async readContentChunk(start, end) {
    try {
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
      const buffer = await fs.readFileSync(
        `${booksPath}/${this.bookData.bookId}`
      );
      const arr = new Uint8Array(buffer);
      fullContent = decoder.decode(arr);

      // 截取指定范围的片段（考虑边界情况）
      const chunk = fullContent.substring(start, end);

      // this.setData({ hasMore: end < fullContent.length });
      return chunk;
    } catch (err) {
      console.error("读取内容片段失败:", err);
      return "";
    }
  },

  // 预加载下一个分片
  async preloadNextChunk(nextIndex) {
    if (this.data.isPreloading || nextIndex >= this.data.totalChunks) {
      return;
    }

    this.setData({ isPreloading: true });

    try {
      const nextChunk = await this.loadChunk(nextIndex);
      this.setData({ preloadedChunk: nextChunk });
    } catch (err) {
      console.error(`预加载分片${nextIndex}失败:`, err);
    } finally {
      this.setData({ isPreloading: false });
    }
  },

  // 加载更多内容
  async loadMore() {
    // 检查是否可以加载更多
    if (this.data.isLoading || !this.data.hasMore) {
      return;
    }

    this.setData({ isLoading: true });

    try {
      const nextIndex = this.data.currentChunkIndex + 1;
      let nextChunk;

      // 优先使用预加载的分片
      if (
        this.data.preloadedChunk &&
        this.data.preloadedChunk.index === nextIndex
      ) {
        nextChunk = this.data.preloadedChunk;
        this.setData({ preloadedChunk: null });
      } else {
        // 否则直接加载
        nextChunk = await this.loadChunk(nextIndex);
      }

      // 更新分片数组（只保留最近5个分片，避免内存溢出）
      const newChunks = [...this.data.contentChunks, nextChunk];
      const keepChunks = newChunks.slice(Math.max(0, newChunks.length - 5));

      // 检查是否还有更多内容
      const hasMore = nextIndex + 1 < this.data.totalChunks;

      // 更新数据
      this.setData({
        contentChunks: keepChunks,
        currentChunkIndex: nextIndex,
        hasMore,
        isLoading: false,
      });

      // 预加载下一个分片
      if (hasMore) {
        this.preloadNextChunk(nextIndex + 1);
      }
    } catch (err) {
      console.error("加载更多失败:", err);
      this.setData({
        isLoading: false,
        error: "加载失败，请重试",
      });
    }
  },

  // 加载更多内容（滚动到底部时触发）
  async loadMoreContent() {
    if (this.preloadedChunk) {
      // 使用预加载的内容
      this.setData({
        bookContent: this.data.bookContent + this.preloadedChunk,
        currentPosition: this.data.currentPosition + this.data.chunkSize,
        isLoading: false,
      });
      this.preloadedChunk = null; // 清空缓存
      return;
    }

    if (this.data.isLoading || !this.data.hasMore) return;

    this.setData({ isLoading: true });
    try {
      const nextChunk = await this.readContentChunk(
        this.data.currentPosition,
        this.data.chunkSize
      );

      // 追加内容（而非替换）
      this.setData({
        bookContent: this.data.bookContent + nextChunk,
        currentPosition: this.data.currentPosition + this.data.chunkSize,
        isLoading: false,
      });
    } catch (err) {
      console.error("加载更多内容失败:", err);
      this.setData({ isLoading: false });
    }
  },

  // 滚动事件处理
  onScroll(e) {
    const { scrollTop, scrollHeight } = e.detail;
    // this.setData({ scrollTop });

    // 计算滚动进度
    const scrollProgress =
      scrollTop / (scrollHeight - this.data.windowHeight) || 0;

    // 当滚动超过当前内容的70%时，加载更多
    if (scrollProgress > 0.7) {
      this.loadMore();
    }
  },

  // 重新加载
  retryLoad() {
    this.setData({ error: "" });
    this.initReader();
  },

  // 调整字体大小
  adjustFontSize(e) {
    const { type } = e.currentTarget.dataset;
    let { fontSize } = this.data;

    if (type === "increase" && fontSize < this.data.fontSizeMax) {
      fontSize += 2;
    } else if (type === "decrease" && fontSize > this.data.fontSizeMin) {
      fontSize -= 2;
    }
    wx.setStorage({
      key: "fontSize",
      data: fontSize,
    });
    // 字体大小改变时，重新计算分片大小并刷新当前内容
    this.setData({ fontSize }, () => {
      this.refreshCurrentContent();
    });
  },

  // 切换主题
  toggleTheme() {
    const theme = this.data.theme === "light" ? "dark" : "light";
    this.setData({ theme });
    wx.setStorage({
      key: "theme",
      data: theme,
    });
    wx.setNavigationBarColor({
      frontColor: theme === "light" ? "#000000" : "#ffffff",
      backgroundColor: theme === "light" ? "#ffffff" : "#333333",
    });
  },

  // 刷新当前内容（字体大小改变时）
  async refreshCurrentContent() {
    this.setData({ isLoading: true });

    try {
      // 重新计算总分片数
      this.calculateTotalChunks();

      // 重新加载当前和下一个分片
      const currentChunk = await this.loadChunk(this.data.currentChunkIndex);
      const nextChunk = this.data.hasMore
        ? await this.loadChunk(this.data.currentChunkIndex + 1)
        : null;

      const contentChunks = [currentChunk];
      if (nextChunk) contentChunks.push(nextChunk);

      this.setData({
        contentChunks,
        isLoading: false,
      });
    } catch (err) {
      console.error("刷新内容失败:", err);
      this.setData({ isLoading: false });
    }
  },

  // 页面卸载时保存阅读进度
  onUnload() {
    this.saveReadingProgress();
  },

  // 保存阅读进度
  saveReadingProgress() {
    const { bookId, currentChunkIndex, scrollTop, totalLength } = this.data;
    const progress = Math.floor(
      ((currentChunkIndex * this.getChunkSize()) / totalLength) * 100
    );

    wx.setStorageSync(`readingProgress_${bookId}`, {
      chunkIndex: currentChunkIndex,
      scrollTop,
      progress,
      updateTime: new Date().getTime(),
    });
  },

  // 加载初始内容（首屏）
  async loadInitialContent() {
    this.setData({ isLoading: true });
    try {
      const content = await this.readContentChunk(0, this.data.chunkSize);
      this.setData({
        content,
        currentPosition: this.data.chunkSize,
        isLoading: false,
      });
    } catch (err) {
      console.error("加载初始内容失败:", err);
      this.setData({ isLoading: false });
    }
  },

  async getChapters() {
    try {
      const res = (await wx.getStorageSync("chapters")) || {};
      const chapters = res?.[this.bookData.bookId] ?? [];
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
