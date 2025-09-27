// index.js
import Dialog from "@vant/weapp/dialog/dialog";
Page({
  data: {
    list: [],
    total: 0,
    loading: true,
    downloadLoading: false,
    loadingText: "缓存中",
  },
  async getList() {
    try {
      const app = getApp();
      this.setData({
        loading: true,
      });
      const res = await wx.cloud.callFunction({
        name: "getBooks",
        data: {},
      });
      const cacheFileList = app.globalData.cacheFileList ?? [];
      let list = res.result.data?.books || [];
      const total = res.result.data?.total || 0;

      // 缓存列表信息
      await app.updateStorageBooks(list);

      if (cacheFileList.length) {
        list = list.map((item) => {
          if (cacheFileList.includes(item._id)) {
            return {
              ...item,
              isLocal: true,
            };
          }
          return item;
        });
      }
      console.log("getBooks", list);

      this.setData({
        list,
        total,
        loading: false,
      });
    } catch (error) {
      console.error("error", error);
      wx.showToast({
        title: "获取列表失败，请稍后重试！",
        icon: "none",
        duration: 2000,
      });
      this.setData({
        loading: false,
      });
    }
  },
  async delete(data) {
    const that = this;
    const app = getApp();
    try {
      const item = data.target.dataset.item;
      await Dialog.confirm({
        title: "删除书籍",
        message: `确认删除 ${item.title} ?`,
      });
      this.setData({
        loadingText: "删除中",
        downloadLoading: true,
      });
      // 删除DB
      await wx.cloud.callFunction({
        name: "deleteBook",
        data: {
          bookId: item._id,
        },
      });
      // 删除云存储
      await wx.cloud.deleteFile({
        fileList: [item.fileUrl],
      });
      // 删除本地缓存
      await app.deleteLocalFile(item._id);
      // 删除章节标题缓存
      await app.deleteStorageChapter(item._id);
    } catch (error) {
      console.error("error", error);
      wx.showToast({
        title: "删除失败，请稍后重试！",
        icon: "none",
        duration: 2000,
      });
    } finally {
      await that.getList();
      this.setData({
        downloadLoading: false,
      });
    }
  },
  async gotoDetail(data) {
    try {
      if (!data.target.dataset.item.isLocal) {
        await this.download(data);
      }
      wx.navigateTo({
        url: `/pages/bookdetail/index?id=${data.target.dataset.item._id}`,
      });
    } catch (error) {
      console.error("error", error);
      wx.showToast({
        title: "跳转失败，请稍后重试！",
        icon: "none",
        duration: 2000,
      });
    }
  },
  async download(data) {
    try {
      this.setData({
        loadingText: "缓存中",
        downloadLoading: true,
      });
      const item = data.currentTarget.dataset.item;
      const app = getApp();
      if (!item) return;
      // 获取文章标题
      const res = await wx.cloud.callFunction({
        name: "getChapter",
        data: { bookId: item._id },
      });
      const chapters = res.result.data?.chapters;
      if (chapters?.length) {
        await app.addStorageChapter(item._id, chapters);
      }
      // 从云存储下载文件
      const file = await wx.cloud.downloadFile({
        fileID: item.fileUrl,
      });
      // 本地缓存
      await app.addLocalFile(item._id, file.tempFilePath);
      await this.getList();
      this.setData({
        downloadLoading: false,
      });
    } catch (error) {
      console.error("error", error);
      this.setData({
        downloadLoading: false,
      });
      wx.showToast({
        title: "缓存失败，请稍后重试！",
        icon: "none",
        duration: 2000,
      });
    }
  },
  async onLoad(options) {
    await this.getList();
  },
});
