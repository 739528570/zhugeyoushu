// pages/bookdetail/index.js
import { booksPath } from "../../utils/index";
const app = getApp();
// 翻页动画类型
const ANIMATION_TYPES = {
  SLIDE: "slide", // 滑动效果
  FADE: "fade", // 淡入淡出
  FLIP: "flip", // 翻页效果
  NONE: "none", // 无动画
};

Page({
  data: {
    book: {},
    // 阅读内容
    chapterId: 0,
    chapterContent: "",
    chapters: [],

    // 分页数据
    pages: [],
    currentPage: 0,
    totalPages: 0,
    currentPageText: "",
    nextPageText: "",
    prevPageText: "",

    // 翻页状态
    isAnimating: false,
    pageAnimationClass: "",
    animationType: ANIMATION_TYPES.SLIDE,
    showPrevPage: false,
    showNextPage: false,

    // 手势跟踪
    touchStartX: 0,
    touchStartY: 0,
    touchCurrentX: 0,
    isSwiping: false,
    swipeDirection: null,
    swipeDistance: 0,

    // 阅读设置
    fontSize: 16,
    lineHeight: 1.6,
    pagePadding: 10,
    fontIndex: 0,
    fontFamilies: ["系统字体", "宋体", "黑体", "楷体"],

    // 页面样式
    pageStyle: "",
    pageWidth: 0,
    pageHeight: 0,

    // UI状态
    showSettings: false,
    isAnimating: false,

    // Canvas测量
    canvasWidth: 300,
    canvasHeight: 500,
    measureContext: null,
  },

  async onLoad(options) {
    this.bookId = options.id;
    this.filePath = `${booksPath}/${options.id}`;
    await this.initBook();
    await this.getChapters();
    this.initChapter(this.data.chapterId);
    this.initPageSize(); // 初始化页面尺寸后

    // 异步初始化Canvas上下文
    this.initMeasureContext()
      .then(() => {
        this.calculatePages(); // 开始计算分页
        this.updateDisplayPage();
      })
      .catch((err) => {
        console.error("Canvas初始化失败:", err);
      });
  },

  // 初始化章节内容
  async initBook() {
    try {
      const books = (await wx.getStorageSync("books")) || [];
      const book = books.find((item) => item._id === this.bookId);
      if (book) {
        this.setData({
          book,
          chapterId: book.readingProgress.chapterId,
          currentPage: book.readingProgress.page,
        });
      }
    } catch (error) {
      wx.showToast({
        title: "加载书籍失败",
        icon: "none",
      });
    }
  },

  // 初始化章节内容
  async initChapter(chapterId) {
    try {
      const content = await this.loadChapterData(chapterId);
      this.setData({
        chapterContent: content,
      });

      // 恢复阅读进度
      // this.restoreReadingProgress();
    } catch (error) {
      console.error(error);
      wx.showToast({
        title: "加载章节失败",
        icon: "none",
      });
    }
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

  // 初始化页面尺寸
  initPageSize() {
    // 计算阅读区域尺寸（考虑导航栏和进度条高度）
    const query = wx.createSelectorQuery();
    query.select("#readerContent").boundingClientRect();
    query.exec((res) => {
      if (res[0]) {
        const pageWidth = res[0].width; // 减去左右边距
        const pageHeight = res[0].height; // 减去上下边距和进度条

        this.setData({
          pageWidth: pageWidth,
          pageHeight: pageHeight,
          canvasWidth: pageWidth,
          canvasHeight: pageHeight,
        });

        this.updatePageStyle();
      }
    });
  },

  // 新版 - 异步获取上下文并初始化画布
  initMeasureContext() {
    return new Promise((resolve, reject) => {
      const query = wx.createSelectorQuery();
      query
        .select("#measureCanvas")
        .fields({ node: true, size: true })
        .exec((res) => {
          if (!res[0] || !res[0].node) {
            reject(new Error("未能获取到Canvas节点"));
            return;
          }

          const canvas = res[0].node;
          const ctx = canvas.getContext("2d");

          // 初始化画布大小（解决高分屏模糊问题）
          const dpr = wx.getWindowInfo().pixelRatio;
          const width = res[0].width;
          const height = res[0].height;

          canvas.width = width * dpr;
          canvas.height = height * dpr;
          ctx.scale(dpr, dpr);

          // 设置默认字体（使用标准font属性）
          ctx.font = `${this.data.fontSize}px ${this.getFontFamily()}`;
          ctx.textBaseline = "top"; // 直接赋值，而非调用方法
          ctx.textAlign = "left";
          ctx.fillStyle = "#000000";

          this.measureCanvas = canvas;
          this.setData({ measureContext: ctx });

          console.log("Canvas 2D 初始化成功，字体设置:", ctx.font);
          resolve();
        });
    });
  },

  // 更新页面样式
  updatePageStyle() {
    const {
      fontSize,
      lineHeight,
      pagePadding,
      fontIndex,
      fontFamilies,
    } = this.data;
    const fontFamily = this.getFontFamily(fontFamilies[fontIndex]);

    const style = `
      padding: ${pagePadding}px;
      font-size: ${fontSize}px;
      line-height: ${lineHeight};
      font-family: ${fontFamily};
    `;

    this.setData({ pageStyle: style });
  },

  // 获取字体族映射
  getFontFamily(fontName) {
    const fontMap = {
      系统字体: "-apple-system, BlinkMacSystemFont, sans-serif",
      宋体: "SimSun, serif",
      黑体: "SimHei, sans-serif",
      楷体: "KaiTi, serif",
    };
    return fontMap[fontName] || fontMap["系统字体"];
  },

  // 核心分页计算函数
  async calculatePages() {
    const {
      chapterContent,
      fontSize,
      lineHeight,
      pagePadding,
      pageWidth,
      pageHeight,
    } = this.data;

    if (!chapterContent || !pageWidth || !pageHeight) {
      setTimeout(() => this.calculatePages(), 100);
      return;
    }

    // 清空现有分页
    this.setData({ pages: [] });

    // 计算实际文本区域尺寸
    const textWidth = pageWidth - pagePadding * 2;
    const textHeight = pageHeight - pagePadding * 2;
    const actualLineHeight = fontSize * lineHeight;

    // 配置测量上下文
    const ctx = this.data.measureContext;
    // ctx.setFontSize(fontSize);
    ctx.font = `${fontSize}px sans-serif`;
    ctx.textBaseline = "top";

    const pages = [];
    let currentPageText = "";
    let currentPageHeight = 0;
    let currentLineText = "";
    let currentLineWidth = 0;

    // 处理文本中的特殊字符和格式
    const processedContent = this.preprocessContent(chapterContent);

    // 逐字符分析
    for (let i = 0; i < processedContent.length; i++) {
      const char = processedContent[i];

      // 测量字符宽度
      const charWidth = this.measureTextWidth(ctx, char);

      // 检查是否需要换行
      if (currentLineWidth + charWidth > textWidth) {
        // 处理避头尾规则
        const processedLine = this.processLineBreak(currentLineText, char);
        // currentPageText += processedLine.lineText + '\n';
        currentPageText += processedLine.lineText;
        currentLineText = processedLine.remainingText + char;
        currentLineWidth = this.measureTextWidth(ctx, currentLineText);
        currentPageHeight += actualLineHeight;
      } else {
        currentLineText += char;
        currentLineWidth += charWidth;
      }

      // 检查是否需要换页
      if (currentPageHeight + actualLineHeight > textHeight) {
        pages.push(currentPageText.trim());
        currentPageText = "";
        currentPageHeight = 0;

        // 处理跨页字符
        if (currentLineText) {
          const lineResult = this.processPageBreak(currentLineText);
          // currentPageText = lineResult.currentText + '\n';
          currentPageText = lineResult.currentText;
          currentLineText = lineResult.nextText;
          currentLineWidth = this.measureTextWidth(ctx, currentLineText);
          currentPageHeight = actualLineHeight;
        }
      }

      // 处理换行符
      if (char === "\n") {
        // currentPageText += currentLineText + '\n';
        currentPageText += currentLineText;
        currentLineText = "";
        currentLineWidth = 0;
        currentPageHeight += actualLineHeight;

        if (currentPageHeight + actualLineHeight > textHeight) {
          pages.push(currentPageText.trim());
          currentPageText = "";
          currentPageHeight = 0;
        }
      }
    }

    // 添加最后一页
    if (currentPageText || currentLineText) {
      pages.push((currentPageText + currentLineText).trim());
    }

    await this.setData({
      pages: pages,
      totalPages: pages.length,
    });

    // this.updateDisplayPage();
    // this.saveReadingProgress();
  },

  // 新版测量 - 符合Web标准
  measureTextWidth(ctx, text) {
    // 先设置正确的字体属性
    ctx.font = `${this.data.fontSize}px ${this.getFontFamily()}`;

    // 然后进行测量
    const textMetrics = ctx.measureText(text);
    return textMetrics.width;
  },

  // 预处理内容
  preprocessContent(content) {
    // 统一换行符
    // let processed = content.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
    let processed = content.replace(/\r\n/g, "\n");

    // 处理连续空格
    processed = processed.replace(/[ ]+/g, " ");

    // 处理特殊标点
    processed = processed.replace(/\.{3,}/g, "…");

    return processed;
  },

  // 处理行尾换行（避头尾规则）
  processLineBreak(lineText, nextChar) {
    const lineBreakChars = [
      "，",
      "。",
      "！",
      "？",
      "；",
      "」",
      "》",
      "”",
      "》",
    ];
    const headBreakChars = ["「", "《", "“"];

    let currentLine = lineText;
    let remainingText = "";

    // 如果行尾是标点，且下一个字符是起始标点，调整换行位置
    if (
      lineBreakChars.includes(lineText.slice(-1)) &&
      headBreakChars.includes(nextChar)
    ) {
      // 将行尾字符移到下一行
      remainingText = lineText.slice(-1);
      currentLine = lineText.slice(0, -1);
    }

    return {
      lineText: currentLine,
      remainingText: remainingText,
    };
  },

  // 处理页尾换行
  processPageBreak(lineText) {
    // 简单的页尾处理：在最近的空格或标点处分页
    const breakPoints = [" ", "，", "。", "！", "？", "；"];

    for (let i = lineText.length - 1; i >= 0; i--) {
      if (breakPoints.includes(lineText[i])) {
        return {
          currentText: lineText.slice(0, i + 1),
          nextText: lineText.slice(i + 1),
        };
      }
    }

    // 如果没有合适的断点，强制在中间分割
    const splitIndex = Math.floor(lineText.length / 2);
    return {
      currentText: lineText.slice(0, splitIndex) + "-",
      nextText: lineText.slice(splitIndex),
    };
  },

  // 手势翻页 - 触摸开始
  onTouchStart(e) {
    if (this.data.isAnimating) return;

    const touch = e.touches[0];
    this.setData({
      touchStartX: touch.clientX,
      touchStartY: touch.clientY,
      touchCurrentX: touch.clientX,
      isSwiping: false,
      swipeDirection: null,
      swipeDistance: 0,
    });
  },

  // 手势翻页 - 触摸移动
  onTouchMove(e) {
    if (this.data.isAnimating || !this.data.touchStartX) return;

    const touch = e.touches[0];
    const deltaX = touch.clientX - this.data.touchStartX;
    const deltaY = touch.clientY - this.data.touchStartY;

    // 判断是否为水平滑动
    if (
      !this.data.isSwiping &&
      Math.abs(deltaX) > 5 &&
      Math.abs(deltaX) > Math.abs(deltaY)
    ) {
      this.setData({
        isSwiping: true,
        swipeDirection: deltaX > 0 ? "right" : "left",
      });
    }

    if (this.data.isSwiping) {
      // e.preventDefault();

      // 限制滑动距离
      const maxDistance = this.data.pageWidth * 0.8;
      let distance = Math.abs(deltaX);
      if (distance > maxDistance) distance = maxDistance;

      this.setData({
        touchCurrentX: touch.clientX,
        swipeDistance: distance,
      });

      // 实时更新页面位置（滑动跟随效果）
      this.updatePagePosition(deltaX);
    }
  },

  // 手势翻页 - 触摸结束
  onTouchEnd(e) {
    if (!this.data.isSwiping || !this.data.touchStartX) {
      this.resetPagePosition();
      return;
    }

    const deltaX = this.data.touchCurrentX - this.data.touchStartX;
    const threshold = this.data.pageWidth * 0.2; // 滑动阈值

    if (Math.abs(deltaX) > threshold) {
      // 超过阈值，执行翻页
      if (deltaX > 0) {
        this.prevPage();
      } else {
        this.nextPage();
      }
    } else {
      // 未超过阈值，回弹到原位置
      this.resetPagePosition();
    }

    this.setData({
      touchStartX: 0,
      isSwiping: false,
      swipeDistance: 0,
    });
  },

  // 更新页面位置（滑动跟随）
  updatePagePosition(deltaX) {
    const translateX = deltaX * 0.5; // 减缓滑动速度
    this.setData({
      pageAnimationClass: `translate-x-${translateX}`,
    });
  },

  // 重置页面位置
  resetPagePosition() {
    this.setData({
      pageAnimationClass: "",
    });
  },

  // 点击翻页 - 左侧点击
  onTapPrev(e) {
    if (this.data.isAnimating) return;
    this.prevPage();
  },

  // 点击翻页 - 右侧点击
  onTapNext(e) {
    if (this.data.isAnimating) return;
    this.nextPage();
  },

  // 翻到上一页
  async prevPage() {
    if (this.data.isAnimating || this.data.currentPage <= 0) {
      if (this.data.currentPage <= 0) {
        const nextChapterId = this.data.chapterId - 1;
        if (nextChapterId < 0) {
          this.showLastPageTip();
        } else {
          this.prevChapter();
        }
      }
      return;
    }

    this.goToPage(this.data.currentPage - 1, "right");
  },

  // 翻到下一页
  async nextPage() {
    if (
      this.data.isAnimating ||
      this.data.currentPage >= this.data.totalPages - 1
    ) {
      if (this.data.currentPage >= this.data.totalPages - 1) {
        const nextChapterId = this.data.chapterId + 1;
        if (nextChapterId > this.data.chapters.length) {
          this.showLastPageTip();
        } else {
          this.nextChapter()
        }
      }
      return;
    }

    this.goToPage(this.data.currentPage + 1, "left");
  },

  // 显示第一页提示
  showFirstPageTip() {
    wx.showToast({
      title: '已经是第一页了',
      icon: 'none',
      duration: 1000
    });
  },

  // 显示最后一页提示
  showLastPageTip() {
    wx.showToast({
      title: '已经是最后一页了',
      icon: 'none',
      duration: 1000
    });
  },

  // 核心翻页方法
  goToPage(pageNum, direction = "left") {
    if (
      pageNum < 0 ||
      pageNum >= this.data.totalPages ||
      this.data.isAnimating
    ) {
      return;
    }

    // 设置动画状态
    this.setData({
      isAnimating: true,
      showPrevPage: direction === "right",
      showNextPage: direction === "left",
    });

    // 执行翻页动画
    this.startPageAnimation(direction, () => {
      // 动画完成后的回调
      this.setData({
        currentPage: pageNum,
        isAnimating: false,
        pageAnimationClass: "",
        showPrevPage: false,
        showNextPage: false,
      });

      this.updateDisplayPage();
      // this.saveReadingProgress();

      // 预加载相邻页面
      this.preloadAdjacentPages();
    });
  },

  // 开始翻页动画
  startPageAnimation(direction, callback) {
    const animationClass = direction === "left" ? "slide-left" : "slide-right";

    this.setData({
      pageAnimationClass: animationClass,
    });

    // 动画完成后执行回调
    setTimeout(() => {
      if (callback) callback();
    }, 300);
  },

  // 预加载相邻页面
  preloadAdjacentPages() {
    const { currentPage, totalPages, pages } = this.data;

    // 预加载上一页
    if (currentPage > 0) {
      this.setData({
        prevPageText: pages[currentPage - 1] || "",
      });
    }

    // 预加载下一页
    if (currentPage < totalPages - 1) {
      this.setData({
        nextPageText: pages[currentPage + 1] || "",
      });
    }
  },

  // 更新显示页面
  updateDisplayPage() {
    const { pages, currentPage } = this.data;

    if (pages.length === 0 || currentPage < 0 || currentPage >= pages.length) {
      return;
    }

    this.setData({
      currentPageText: pages[currentPage] || "",
      prevPageText: currentPage > 0 ? pages[currentPage - 1] : "",
      nextPageText:
        currentPage < pages.length - 1 ? pages[currentPage + 1] : "",
    });
  },

  // 跳转到指定页（用于目录跳转）
  jumpToPage(pageNum) {
    if (pageNum === this.data.currentPage) return;

    const direction = pageNum > this.data.currentPage ? "left" : "right";
    this.goToPage(pageNum, direction);
  },

  // 跳转到下一章
  async nextChapter() {
    // 这里需要实现获取下一章逻辑
    wx.showToast({
      title: "加载下一章...",
      icon: "loading",
    });
    await this.initChapter(this.data.chapterId + 1);
    await this.calculatePages();
    await this.setData({
      chapterId: this.data.chapterId + 1,
      currentPage: 0
    });
    this.goToPage(0, "left");
  },

  // 跳转到上一章
  async prevChapter() {
    // 这里需要实现获取上一章逻辑
    wx.showToast({
      title: "加载上一章...",
      icon: "loading",
    });
    await this.initChapter(this.data.chapterId - 1);
    await this.calculatePages();
    this.setData({
      chapterId: this.data.chapterId - 1,
      currentPage: this.data.totalPages - 1
    });
    this.goToPage(0, "right");
  },

  // 切换动画效果
  switchAnimationType(type) {
    if (Object.values(ANIMATION_TYPES).includes(type)) {
      this.setData({
        animationType: type,
      });

      wx.showToast({
        title: `已切换为${this.getAnimationName(type)}`,
        icon: "success",
      });
    }
  },

  // 获取动画名称
  getAnimationName(type) {
    const names = {
      [ANIMATION_TYPES.SLIDE]: "滑动效果",
      [ANIMATION_TYPES.FADE]: "淡入淡出",
      [ANIMATION_TYPES.FLIP]: "翻页效果",
      [ANIMATION_TYPES.NONE]: "无动画",
    };
    return names[type] || "未知效果";
  },

  // 当阅读设置（如字体大小）变更时
  onFontSizeChange(e) {
    this.setData({ fontSize: e.detail.value });
    this.updatePageStyle();
    // 确保Canvas上下文就绪后重新计算
    if (this.data.measureContext) {
      this.recalculatePages();
    } else {
      this.initMeasureContext().then(() => this.recalculatePages());
    }
  },

  onLineHeightChange(e) {
    this.setData({ lineHeight: parseFloat(e.detail.value) });
    this.updatePageStyle();
    this.recalculatePages();
  },

  onPaddingChange(e) {
    this.setData({ pagePadding: e.detail.value });
    this.updatePageStyle();
    this.recalculatePages();
  },

  onFontChange(e) {
    this.setData({ fontIndex: parseInt(e.detail.value) });
    this.updatePageStyle();
    this.recalculatePages();
  },

  onAnimationChange(e) {
    const type = e.detail.value;
    this.switchAnimationType(type);
  },

  // 重新计算分页（防抖处理）
  recalculatePages: debounce(function () {
    this.calculatePages();
    this.updateDisplayPage();
  }, 300),

  // 窗口尺寸变化处理
  onWindowResize() {
    this.initPageSize();
    setTimeout(() => {
      this.calculatePages();
      this.updateDisplayPage();
    }, 300);
  },

  // 阅读进度管理
  async saveReadingProgress() {
    try {
      const readingProgress = {
        chapterId: this.data.chapterId,
        page: this.data.currentPage,
      };

      // await wx.setStorageSync('readingProgress', progress);
      // 调用云函数同步进度
      await wx.cloud.callFunction({
        name: "updateBookReadPos",
        data: {
          bookId: this.bookId,
          readingProgress,
        },
      });
    } catch (error) {
      console.error("同步进度失败:", error);
    }
  },

  restoreReadingProgress() {
    try {
      const progress = wx.getStorageSync("readingProgress");
      if (progress && progress.chapterId === this.data.chapterId) {
        this.goToPage(progress.page);
      } else {
        this.goToPage(0);
      }
    } catch (error) {
      console.error(error);
    }
  },

  // UI操作
  toggleSettings() {
    this.setData({ showSettings: !this.data.showSettings });
  },

  addBookmark() {
    const bookmark = {
      chapterId: this.data.chapterId,
      chapterTitle: this.data.chapterTitle,
      page: this.data.currentPage,
      text: this.data.currentPageText.substring(0, 50) + "...",
      timestamp: Date.now(),
    };
    console.log("bookmark", bookmark);
    // 保存书签
    let bookmarks = wx.getStorageSync("bookmarks") || [];
    bookmarks.unshift(bookmark);
    wx.setStorageSync("bookmarks", bookmarks.slice(0, 100)); // 限制数量

    wx.showToast({
      title: "添加书签成功",
      icon: "success",
    });
  },

  showChapterList() {
    // wx.navigateTo({
    //   url: `/pages/chapter-list/chapter-list?bookId=${this.data.bookId}`
    // });
  },

  onBack() {
    wx.navigateBack();
  },

  // 加载章节数据
  async loadChapterData(chapterId) {
    const chapters = this.data.chapters;
    const start = chapterId === 0 ? 0 : chapters[chapterId].startPosition;
    const end = chapters[chapterId].endPosition;

    let fullContent = "";
    const encoding = this.data.book.encoding;
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
    console.log("chunk", chapterId, chunk);
    return chunk;
  },
});

// 防抖函数
function debounce(func, wait) {
  let timeout;
  return function executedFunction(...args) {
    const later = () => {
      clearTimeout(timeout);
      func.apply(this, args);
    };
    clearTimeout(timeout);
    timeout = setTimeout(later, wait);
  };
}
