// pages/bookdetail/index.js
import { booksPath } from "../../utils/index";
Page({
  data: {
    // 内容相关
    contentChunks: [], // 内容分片数组
    currentChunkIndex: 0, // 当前显示的分片索引
    totalLength: 0, // 小说总字符数
    isLoading: false, // 加载中状态
    initLoading: true, // 初始化配置加载中

    // 阅读相关
    targetScrollTop: 0, // 跳转滚动位置
    fontSize: 16, // 字体大小
    lineHeight: 1.8, // 行高
    theme: "light", // 主题（light/dark）
    title: "",
    chapters: [],
    encoding: "utf-8",
    showHeaderBar: false,
    showFooterBar: false,
    showChapters: false,

    // 缓存
    lineHeightMax: 3.0,
    lineHeightMin: 1.0,
    fontSizeMax: 32,
    fontSizeMin: 10,
    windowHeight: 0,
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
    this.bookId = options.id;
    this.filePath = `${booksPath}/${options.id}`;
    await this.getLocalConfig();
    // 读取保存的阅读进度
    await this.loadReadingProgress();
    // 初始化阅读器
    await this.initReader();
  },

  // 初始化阅读器
  async initReader() {
    try {
      // 1. 检查文件是否存在
      await this.checkFileExists();

      // 2. 获取文件信息（总长度等）
      await this.getDetail();
      await this.getChapters();

      // 3. 根据保存的进度决定加载哪个分片
      let { chunkIndex, scrollTop } = this.readingProgress;

      // 确保加载的分片索引有效
      if (chunkIndex >= this.data.chapters.length) {
        chunkIndex = 1;
      }

      // 4. 加载初始分片（当前进度分片和下一个分片）
      await this.loadInitialChunks(chunkIndex);

      // 5. 如果有保存的滚动位置，恢复滚动
      if (scrollTop > 0) {
        // 使用setTimeout确保DOM已更新
        setTimeout(() => {
          this.setData(
            {
              targetScrollTop: scrollTop,
            },
            () => {
              this.setData({ initLoading: false });
            }
          );
        }, 100);
      } else {
        this.setData({ initLoading: false });
      }
    } catch (err) {
      console.error("初始化阅读器失败:", err);
    }
  },

  async getLocalConfig() {
    try {
      const readerConfig = await wx.getStorageSync("readerConfig");
      console.log("getLocalConfig", readerConfig);
      this.setData(
        Object.assign(
          {
            barHeight: wx.getWindowInfo().statusBarHeight + 46,
            windowHeight: wx.getWindowInfo().windowHeight,
          },
          readerConfig
        )
      );
    } catch (error) {
      console.error("GET STORAGE CONFIG ERROR:", error);
    }
  },
  async setLocalConfig(data) {
    try {
      const readerConfig = (await wx.getStorageSync("readerConfig")) || {};
      await wx.setStorageSync("readerConfig", {
        ...readerConfig,
        ...data,
      });
    } catch (error) {
      console.error("SET STORAGE CONFIG ERROR:", error);
    }
  },
  async getDetail() {
    try {
      const res = await wx.cloud.callFunction({
        name: "getBooks",
        data: {
          bookId: this.bookId,
        },
      });

      let book = res.result.data?.books?.[0] || {};
      this.setData({
        title: book.title,
        encoding: book.encoding,
        totalLength: book.totalLength,
      });
    } catch (error) {
      console.error("读取文件失败", error);
    }
  },
  // 修改loadInitialChunks方法，支持指定起始分片
  async loadInitialChunks(startChunkIndex) {
    this.data.isLoading = true;

    try {
      // 计算需要加载的三个分片索引（当前、前一个、后一个）
      const loadIndexes = new Set();
      // 添加当前分片
      loadIndexes.add(startChunkIndex);
      // 添加前一个分片（如果存在）
      if (startChunkIndex > 0) {
        loadIndexes.add(startChunkIndex - 1);
      }
      // 添加后一个分片（如果存在）
      if (startChunkIndex + 1 < this.data.chapters.length) {
        loadIndexes.add(startChunkIndex + 1);
      }
      if (startChunkIndex === 0) {
        loadIndexes.add(startChunkIndex + 2);
      }

      // 转换为有序数组
      const indexes = Array.from(loadIndexes).sort((a, b) => a - b);

      // 并行加载需要的分片
      const chunks = await Promise.all(
        indexes.map((index) => this.loadChunk(index))
      );

      return new Promise((resolve) => {
        this.setData(
          {
            contentChunks: this.chunkComponent(chunks),
            currentChunkIndex: startChunkIndex,
          },
          () => {
            this.data.isLoading = false;
            resolve(); // setData完成后 resolve
          }
        );
      });
    } catch (err) {
      this.data.isLoading = false;
      throw err;
    }
  },
  // 加载指定分片
  loadChunk(chunkIndex) {
    return new Promise(async (resolve, reject) => {
      const chapters = this.data.chapters;
      const start = chunkIndex === 0 ? 0 : chapters[chunkIndex].startPosition;
      const end = chapters[chunkIndex + 1].startPosition;

      try {
        // 读取并解码指定范围的内容
        const content = await this.readContentChunk(start, end);

        resolve({
          id: `chunk-${chunkIndex + 1}`,
          content,
          index: chunkIndex,
        });
      } catch (err) {
        console.error(`加载分片${chunkIndex}失败:`, err);
        reject(err);
      }
    });
  },
  // 新增换行符格式化方法
  formatLineBreaks(content) {
    if (!content) return "";
    // 处理各种换行符：↵、\n、\r\n
    return content
      .replace(/↵/g, "\n") // 先将可视换行符转换为标准换行
      .replace(/\r\n/g, "\n") // 统一Windows换行符
      .replace(/\n/g, "<br>"); // 转换为HTML换行标签
  },
  // 读取指定范围的内容片段
  async readContentChunk(start, end) {
    try {
      let fullContent = "";
      const encoding = this.data.encoding;
      const fs = wx.getFileSystemManager();
      let decoder;
      if (typeof TextDecoder !== "undefined") {
        decoder = new TextDecoder(encoding);
      } else {
        const { TextDecoder } = require("text-decoding");
        decoder = new TextDecoder(encoding);
      }
      const buffer = await fs.readFileSync(this.filePath);
      const arr = new Uint8Array(buffer);
      fullContent = decoder.decode(arr);

      // 截取指定范围的片段（考虑边界情况）
      const chunk = fullContent.substring(start, end);

      return this.formatLineBreaks(chunk);
    } catch (err) {
      console.error("读取内容片段失败:", err);
      return "";
    }
  },
  // 加载更多内容
  async loadMore(isPrev) {
    try {
      const currentIndex = this.data.currentChunkIndex;
      if (currentIndex <= 0 || this.data.isLoading) {
        return;
      }
      this.data.isLoading = true;
      const nextIndex = isPrev ? currentIndex - 1 : currentIndex + 1;

      const nextChunk = await this.loadChunk(nextIndex);

      // 更新分片数组
      const newChunks = isPrev
        ? [nextChunk, ...this.data.contentChunks].slice(0, 3)
        : [...this.data.contentChunks, nextChunk].slice(1);

      // 更新数据
      this.setData({
        contentChunks: this.chunkComponent(newChunks, isPrev ? 0 : 2),
      });
      this.data.isLoading = false;
    } catch (err) {
      console.error("加载更多失败:", err);
      this.data.isLoading = false;
    }
  },
  // 跳转到指定章节
  async jumpToChapter(e) {
    this.setData({
      showHeaderBar: false,
      showFooterBar: false,
      showChapters: false,
    });
    const chapterId = e.currentTarget.dataset.chapterid;
    console.log("jumpToChapter", chapterId);
    await this.loadInitialChunks(chapterId - 1);
    wx.pageScrollTo({
      selector: `#chunk-${chapterId}`,
      duration: 0,
    });
  },
  // 滚动事件处理
  onScroll(e) {
    const { scrollTop, scrollHeight } = e.detail;
    this.scrollTop = scrollTop;

    // 节流控制：300ms内只能触发一次加载
    const now = Date.now();
    if (now - this.lastLoadTime < 1000 || this.data.isLoading) {
      return;
    }

    const barHeight = this.data.barHeight;
    const contentChunksLength = this.data.contentChunks.length;
    const chunkHeight = (scrollHeight - barHeight) / contentChunksLength;

    if (!this.chunkHeight) {
      this.chunkHeight = chunkHeight;
    }

    // 向下滚动至最后一分片时，加载下一分片
    if (scrollTop > chunkHeight * (contentChunksLength - 1) + barHeight) {
      if (this.data.currentChunkIndex != this.data.contentChunks[2].index) {
        this.data.currentChunkIndex = this.data.contentChunks[2].index;
      }
      this.loadMore();
      this.lastLoadTime = now;
    }

    // 向上滚动动至第一分片时，加载上一分片
    if (scrollTop < chunkHeight + barHeight) {
      if (this.data.currentChunkIndex != this.data.contentChunks[0].index) {
        this.data.currentChunkIndex = this.data.contentChunks[0].index;
      }
      this.lastLoadTime = now;
      this.loadMore(true);
    }

    if (
      scrollTop > chunkHeight + barHeight &&
      scrollTop < chunkHeight * (contentChunksLength - 1) + barHeight &&
      this.data.currentChunkIndex != this.data.contentChunks[1].index
    ) {
      this.data.currentChunkIndex = this.data.contentChunks[1].index;
    }
  },

  // 新增：读取保存的阅读进度
  async loadReadingProgress() {
    try {
      const progressData = await wx.getStorageSync(
        `readingProgress_${this.bookId}`
      );
      if (progressData) {
        this.readingProgress = {
          chunkIndex: progressData.chunkIndex || 0,
          scrollTop: progressData.scrollTop || 0,
        };
      } else {
        this.readingProgress = { chunkIndex: 0, scrollTop: 0 };
      }
    } catch (err) {
      console.error("读取阅读进度失败:", err);
      this.readingProgress = { chunkIndex: 0, scrollTop: 0 };
    }
  },

  // 修改saveReadingProgress方法，增加更详细的进度信息
  saveReadingProgress() {
    const { currentChunkIndex } = this.data;
    const scrollTop = this.scrollTop;
    const readingProgress = {
      chunkIndex: currentChunkIndex,
      scrollTop,
      updateTime: Date.now(),
    };

    // 保存进度
    wx.setStorage({
      key: `readingProgress_${this.bookId}`,
      data: readingProgress,
    });
  },

  async getChapters() {
    try {
      const res = (await wx.getStorageSync("chapters")) || {};
      const chapters = res?.[this.bookId] ?? [];
      this.setData({
        chapters,
      });
    } catch (error) {
      console.error(error);
    }
  },

  ragging() {
    if (this.data.showFooterBar && this.data.showHeaderBar) {
      this.setData({ showFooterBar: false, showHeaderBar: false });
    } else if (this.data.showFooterBar) {
      this.setData({ showFooterBar: false });
    } else if (this.data.showHeaderBar) {
      this.setData({ showHeaderBar: false });
    }
  },

  // 切换主题
  toggleTheme() {
    const theme = this.data.theme === "light" ? "dark" : "light";
    this.setData({
      theme,
    });
    this.setLocalConfig({ theme });
  },
  // 调整字体大小
  adjustFontSize(e) {
    const { type } = e.currentTarget.dataset;
    let fontSize = type === "set" ? e.detail.value : this.data.fontSize;

    if (type === "increase" && fontSize < this.data.fontSizeMax) {
      fontSize += 2;
    } else if (type === "decrease" && fontSize > this.data.fontSizeMin) {
      fontSize -= 2;
    } else if (type === "set") {
    }
    this.setLocalConfig({ fontSize });
    this.setData({
      fontSize,
    });
  },
  // 调整字体大小
  adjustLineHeight(e) {
    const { type } = e.currentTarget.dataset;
    let { lineHeight } = this.data;

    if (type === "increase" && lineHeight < this.data.lineHeightMax) {
      lineHeight += 0.1;
    } else if (type === "decrease" && lineHeight > this.data.lineHeightMin) {
      lineHeight -= 0.1;
    }
    lineHeight = parseFloat(lineHeight.toFixed(1));
    this.setLocalConfig({ lineHeight });
    // 字体大小改变时，重新计算分片大小并刷新当前内容
    this.setData({
      lineHeight,
    });
  },
  // 检查文件是否存在
  checkFileExists() {
    return new Promise((resolve, reject) => {
      const fs = wx.getFileSystemManager();
      fs.access({
        path: this.filePath,
        success: () => resolve(),
        fail: () => reject(new Error("文件不存在")),
      });
    });
  },
  chunkComponent(chunks, inx) {
    return chunks.map((item, index) =>
      inx === undefined || index === inx
        ? {
            ...item,
            content: `<div style="width: 90%;margin: ${
              inx !== undefined ? inx : index === 0 ? this.data.barHeight : 0
            }px auto 0;">${item.content}</div>`,
          }
        : item
    );
  },

  ongesture(e) {
    console.log(e)
  },

  // 页面卸载时保存阅读进度
  onUnload() {
    this.saveReadingProgress();
  },

  switchFooter(e) {
    if (e.detail.y / this.data.windowHeight < 0.5) {
      this.setData({
        showHeaderBar: !this.data.showHeaderBar,
      });
    } else {
      this.setData({
        showFooterBar: !this.data.showFooterBar,
      });
    }
  },
  switchChapters() {
    const showChapters = !this.data.showChapters;
    this.setData({
      showChapters,
    });
    if (showChapters) {
      console.log("jump Chapters", this.data.currentChunkIndex + 1);
      wx.pageScrollTo({
        selector: `.chapter-id-${this.data.currentChunkIndex + 1}`,
        duration: 0,
      });
    }
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
