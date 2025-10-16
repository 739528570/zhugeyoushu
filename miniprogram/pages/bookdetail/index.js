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
    showHeader: false,
    showFooter: false,
    showChapters: false,

    // 缓存
    bookId: "", // 当前书籍ID
    filePath: "",
    windowHeight: 0,
    lineHeightMax: 48,
    lineHeightMin: 28,
    fontSizeMax: 32,
    fontSizeMin: 10,
    preloadedChunk: null, // 预加载的分片内容
    maxPreloadChunks: 1, // 最多预加载1个分片
    maxConcurrentLoads: 1, // 最多同时加载1个分片
  },

  /**
   * 生命周期函数--监听页面加载
   */
  async onLoad(options) {
    if (!options.id) {
      wx.showToast({
        title: "参数错误",
        icon: "none",
      });
      this.backHome();
      return;
    }
    this.data.bookId = options.id;
    this.data.filePath = `${booksPath}/${options.id}`;
    this.lastLoadTime = 0; // 初始化最后加载时间
    this.isLoadingMore = false; // 初始化加载锁
    // 读取保存的阅读进度
    this.loadReadingProgress();
    // 初始化阅读器
    this.initReader();
  },

  // 初始化阅读器
  async initReader() {
    try {
      // 1. 检查文件是否存在
      await this.checkFileExists();

      // 2. 获取文件信息（总长度等）
      await this.getDetail();
      await this.getChapters();
      await this.getLocalConfig();

      // 3. 计算总分片数
      this.calculateTotalChunks();

      // 4. 根据保存的进度决定加载哪个分片
      let loadChunkIndex = this.readingProgress.chunkIndex;

      // 确保加载的分片索引有效
      if (loadChunkIndex >= this.data.totalChunks) {
        loadChunkIndex = Math.max(0, this.data.totalChunks - 1);
      }

      // 5. 加载初始分片（当前进度分片和下一个分片）
      await this.loadInitialChunks(loadChunkIndex);

      // 6. 如果有保存的滚动位置，恢复滚动
      if (this.readingProgress.scrollTop > 0) {
        // 使用setTimeout确保DOM已更新
        setTimeout(() => {
          this.setData({ scrollTop: this.readingProgress.scrollTop });
        }, 100);
      }
    } catch (err) {
      console.error("初始化阅读器失败:", err);
      this.setData({
        error: "加载书籍失败: " + (err.message || "未知错误"),
      });
    }
  },

  async getLocalConfig() {
    try {
      let fontSize = 16;
      let theme = "light";
      const fontSizeLocal = await wx.getStorageSync("fontSize");
      if (fontSizeLocal) {
        fontSize = String(fontSizeLocal);
      }
      const themeLocal = await wx.getStorageSync("theme");
      if (themeLocal) {
        theme = themeLocal;
      }
      this.setData({
        theme,
        fontSize,
        barHeight: wx.getWindowInfo().statusBarHeight + 46,
        windowHeight: wx.getWindowInfo().windowHeight,
      });
    } catch (error) {}
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
          bookId: this.data.bookId,
        },
      });

      let book = res.result.data?.books?.[0] || {};
      console.log("getDetail", book);
      this.setData({
        title: book.title,
        encoding: book.encoding,
        totalLength: book.totalLength,
      });
    } catch (error) {
      console.log("读取文件失败", error);
    }
  },

  // 计算总分片数
  calculateTotalChunks() {
    const chunkSize = this.getChunkSize(); // 获取分片大小
    const totalChunks = Math.ceil(this.data.totalLength / chunkSize);
    this.setData({
      totalChunks,
    });
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

  // 修改loadInitialChunks方法，支持指定起始分片
  async loadInitialChunks(startChunkIndex) {
    this.setData({ isLoading: true });

    try {
      // 加载指定的起始分片
      const chunk0 = await this.loadChunk(startChunkIndex);

      // 预加载下一个分片
      const nextIndex = startChunkIndex + 1;
      const hasNext = nextIndex < this.data.totalChunks;
      let chunk1 = null;

      if (hasNext) {
        chunk1 = await this.loadChunk(nextIndex);
      }

      // 准备分片数组
      const contentChunks = [chunk0];
      if (chunk1) contentChunks.push(chunk1);

      // 更新数据
      this.setData({
        contentChunks,
        currentChunkIndex: startChunkIndex,
        isLoading: false,
        hasMore: hasNext,
      });

      // 预加载下一个分片
      if (hasNext) {
        this.preloadNextChunk(nextIndex + 1);
      }
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
      const buffer = await fs.readFileSync(this.data.filePath);
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
    // 限制预加载：只预加载一个，且当前没有预加载任务
    if (
      this.data.isPreloading ||
      nextIndex >= this.data.totalChunks ||
      this.data.preloadedChunk
    ) {
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
    // 双重检查，防止并发加载
    if (this.data.isLoading || !this.data.hasMore || this.isLoadingMore) {
      return;
    }

    // 添加加载锁
    this.isLoadingMore = true;
    this.setData({ isLoading: true });
    try {
      const nextIndex = this.data.currentChunkIndex + 1;
      let nextChunk;
      console.log("loadMore", nextIndex, this.data.contentChunks);

      // 优先使用预加载的分片
      if (
        this.data.preloadedChunk &&
        this.data.preloadedChunk.index === nextIndex
      ) {
        nextChunk = this.data.preloadedChunk;
        this.setData({ preloadedChunk: null });
      } else {
        // 否则直接加载下一个分片（只加载一个）
        nextChunk = await this.loadChunk(nextIndex);
      }

      // 更新分片数组（只保留最近5个分片）
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

      // 预加载下一个分片（只预加载一个）
      if (hasMore) {
        this.preloadNextChunk(nextIndex + 1);
      }
    } catch (err) {
      console.error("加载更多失败:", err);
      this.setData({
        isLoading: false,
        error: "加载失败，请重试",
      });
    } finally {
      // 释放加载锁
      this.isLoadingMore = false;
    }
  },

  // 滚动事件处理
  onScroll(e) {
    const { scrollTop, scrollHeight } = e.detail;

    // 节流控制：300ms内只能触发一次加载
    const now = Date.now();
    if (now - this.lastLoadTime < 300) {
      return;
    }
    // this.setData({ scrollTop });

    // 计算滚动进度
    const scrollableHeight = scrollHeight - this.data.windowHeight;
    if (scrollableHeight <= 0) return; // 避免除以0

    const scrollProgress = scrollTop / scrollableHeight;

    // 调整触发阈值为85%，减少提前加载的频率
    if (scrollProgress > 0.85 && !this.data.isLoading && this.data.hasMore) {
      this.lastLoadTime = now;
      this.loadMore();
    }
  },

  // 重新加载
  retryLoad() {
    this.setData({
      error: "",
    });
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
    this.setData(
      {
        fontSize,
      },
      () => {
        this.refreshCurrentContent();
      }
    );
  },

  // 切换主题
  toggleTheme() {
    const theme = this.data.theme === "light" ? "dark" : "light";
    this.setData({
      theme,
    });
    wx.setStorage({
      key: "theme",
      data: theme,
    });
  },

  // 调整字体大小
  adjustLineHeight(e) {
    const { type } = e.currentTarget.dataset;
    let { lineHeight } = this.data;

    if (type === "increase" && lineHeight < this.data.lineHeightMax) {
      lineHeight += 2;
    } else if (type === "decrease" && lineHeight > this.data.lineHeightMin) {
      lineHeight -= 2;
    }
    wx.setStorage({
      key: "lineHeight",
      data: lineHeight,
    });
    // 字体大小改变时，重新计算分片大小并刷新当前内容
    this.setData(
      {
        lineHeight,
      },
      () => {
        this.refreshCurrentContent();
      }
    );
  },

  setFontSize(event) {
    const fontSize = event.detail.value;
    this.setData(
      {
        fontSize,
      },
      () => {
        this.refreshCurrentContent();
      }
    );
    wx.setStorage({
      key: "fontSize",
      data: fontSize,
    });
  },

  // 刷新当前内容（字体大小改变时）
  async refreshCurrentContent() {
    this.setData({
      isLoading: true,
    });

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
      this.setData({
        isLoading: false,
      });
    }
  },

  // 页面卸载时保存阅读进度
  onUnload() {
    this.saveReadingProgress();
  },

  // 新增：读取保存的阅读进度
  loadReadingProgress() {
    const { bookId } = this.data;
    try {
      const progressData = wx.getStorageSync(`readingProgress_${bookId}`);
      if (progressData) {
        this.readingProgress = {
          chunkIndex: progressData.chunkIndex || 0,
          scrollTop: progressData.scrollTop || 0,
          progress: progressData.progress || 0,
        };
        console.log(
          `恢复阅读进度: 分片${this.readingProgress.chunkIndex}, 进度${this.readingProgress.progress}%`
        );
      } else {
        this.readingProgress = { chunkIndex: 0, scrollTop: 0, progress: 0 };
      }
    } catch (err) {
      console.error("读取阅读进度失败:", err);
      this.readingProgress = { chunkIndex: 0, scrollTop: 0, progress: 0 };
    }
  },

  // 修改saveReadingProgress方法，增加更详细的进度信息
  saveReadingProgress() {
    const { bookId, currentChunkIndex, scrollTop, totalLength, contentChunks } =
      this.data;

    // 计算更精确的进度
    const currentChunk = contentChunks.find(
      (chunk) => chunk.index === currentChunkIndex
    );
    let currentPosition = currentChunkIndex * this.getChunkSize();
    // 如果找到当前分片，根据滚动位置估算更精确的进度
    if (currentChunk) {
      const chunkHeight = this.calculateChunkHeight(currentChunk);
      if (chunkHeight > 0) {
        const chunkScrollProgress = scrollTop / chunkHeight;
        currentPosition += Math.floor(
          currentChunk.content.length * chunkScrollProgress
        );
      }
    }

    // 计算总体进度百分比
    const progress =
      totalLength > 0 ? Math.floor((currentPosition / totalLength) * 100) : 0;
    console.log(
      "saveReadingProgress",
      scrollTop,
      currentChunkIndex,
      currentPosition,
      progress
    );

    // 保存进度
    wx.setStorage({
      key: `readingProgress_${bookId}`,
      data: {
        chunkIndex: currentChunkIndex,
        scrollTop,
        position: currentPosition,
        progress,
        updateTime: new Date().getTime(),
      },
    });
  },

  // 新增：计算分片内容高度（用于更精确的进度计算）
  calculateChunkHeight(chunk) {
    // 在实际项目中，可以通过创建临时节点测量高度
    // 这里使用估算值：每个字符约占1.5倍字体高度
    const { fontSize, lineHeight } = this.data;
    const lineHeightPx = fontSize * lineHeight;
    const charPerLine = Math.floor(300 / fontSize); // 假设每行约300px宽
    const lines = Math.ceil(chunk.content.length / charPerLine);

    return lines * lineHeightPx;
  },

  async getChapters() {
    try {
      const res = (await wx.getStorageSync("chapters")) || {};
      const chapters = res?.[this.data.bookId] ?? [];
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
