// index.js
import Dialog from "@vant/weapp/dialog/dialog";
import {
  booksPath
} from "../../utils/index";
Page({
  data: {
    list: [],
    total: 0,
    loading: true,
    downloadLoading: false,
  },
  async getList() {
    try {
      this.setData({
        loading: true,
      });
      const res = await wx.cloud.callFunction({
        name: "getBooks",
        data: {},
      });
      const cacheFileList = getApp().globalData.cacheFileList ?? [];
      let list = res.result.data?.docs || [];
      const total = res.result.data?.total || 0;

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
      // 删除DB
      await wx.cloud.callFunction({
        name: "deleteBook",
        data: {
          docId: item._id,
        },
      });
      // 删除云存储
      await wx.cloud.deleteFile({
        fileList: [item.fileUrl]
      });
      // 删除本地缓存
      await app.deleteLocalFile(item._id);
    } catch (error) {
      console.error("error", error);
      wx.showToast({
        title: "删除失败，请稍后重试！",
        icon: "none",
        duration: 2000,
      });
    } finally {
      await that.getList();
    }
  },
  async gotoDetail(data) {
    try {
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
        downloadLoading: true
      });
      const item = data.currentTarget.dataset.item;
      const app = getApp();
      if (!item) return;
      // 从云存储下载文件
      const file = await wx.cloud.downloadFile({
        fileID: item.fileUrl
      });
      // 本地缓存
      await app.addLocalFile(item._id, file.tempFilePath);
      this.setData({
        downloadLoading: false
      });
    } catch (error) {
      console.error("error", error);
      this.setData({
        downloadLoading: false
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