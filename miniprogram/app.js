import { booksPath } from "./utils/index";

// app.js
App({
  globalData: {
    networkType: "unknown", // 全局网络类型
    isConnected: false, // 全局连接状态
    cacheFileList: [], // 全局缓存文件列表
  },
  onShow(options) {
    // Do something when show.
  },
  onHide() {
    // Do something when hide.
  },
  onError(msg) {
    console.log(msg);
  },
  onLaunch: function () {
    console.log("onLaunch");
    if (!wx.cloud) {
      console.error("请使用 2.2.3 或以上的基础库以使用云能力");
    } else {
      wx.cloud.init({
        traceUser: true,
        env: "cloud1-0gwzt3tn975ea82c",
      });
    }
    // 初始化时立即获取一次网络状态
    this.updateNetworkStatus();
    // 设置全局网络状态监听
    this.setupNetworkListener();

    this.createBooksDir();
  },
  // 更新网络状态到全局
  updateNetworkStatus() {
    wx.getNetworkType({
      success: (res) => {
        console.log("更新网络状态到全局:", res);
        this.globalData.networkType = res.networkType;
        this.globalData.isConnected = res.networkType !== "none";
      },
      fail: (err) => {
        console.error("获取网络类型失败:", err);
        this.globalData.networkType = "unknown";
        this.globalData.isConnected = false;
      },
    });
  },

  // 建立网络监听
  setupNetworkListener() {
    wx.onNetworkStatusChange((res) => {
      console.log("建立网络监听:", res);
      this.globalData.networkType = res.networkType;
      this.globalData.isConnected = res.isConnected;
      // 这里可以触发全局事件或回调，通知所有页面更新
    });
  },

  async createBooksDir() {
    const fs = wx.getFileSystemManager();
    try {
      fs.accessSync(booksPath);
      console.log("目录已存在，无需创建。");
    } catch (e) {
      fs.mkdirSync(booksPath, { recursive: true });
      console.log("目录创建成功！");
    }
    const fileList = await fs.readdirSync(booksPath);
    this.globalData.cacheFileList = fileList;
    console.log("init fileList", fileList);
  },
});
