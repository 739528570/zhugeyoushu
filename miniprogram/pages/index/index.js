// index.js
import Dialog from "@vant/weapp/dialog/dialog";
import { booksPath } from "../../utils/index";
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
        name: "books",
        data: {
          cmd: "getList",
        },
      });
      const cacheFileList = getApp().globalData.cacheFileList ?? [];
      console.log("getlist", cacheFileList);
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
    try {
      const item = data.target.dataset.item;
      console.log("delete", item);
      await Dialog.confirm({
        title: "删除书籍",
        message: `确认删除 ${item.title} ?`,
      });
      await wx.cloud.callFunction({
        name: "books",
        data: {
          cmd: "delete",
          docId: item._id,
        },
      });
      const fs = wx.getFileSystemManager();
      console.log("delete path", `${booksPath}/${item._id}`);
      fs.unlink({
        filePath: `${booksPath}/${item._id}`,
        success: async () => {
          await fs.readdirSync(booksPath);
          getApp().getLocalFileList();
        },
        complete: async () => {
          await that.getList();
        },
      });
    } catch (error) {
      console.error("error", error);
      wx.showToast({
        title: "删除失败，请稍后重试！",
        icon: "none",
        duration: 2000,
      });
    }
  },
  async gotoDetail(data) {
    console.log(data, data.target.dataset.item._id);
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
      this.setData({ downloadLoading: true });
      const item = data.currentTarget.dataset.item;
      console.log("download", item);
      if (!item) return;
      const file = await wx.cloud.downloadFile({ fileID: item.fileUrl });
      console.log("wx.cloud.downloadFile", file);
      const fs = wx.getFileSystemManager();
      await fs.saveFileSync(file.tempFilePath, `${booksPath}/${item._id}`);
      await getApp().getLocalFileList();
      this.setData({ downloadLoading: false });
      console.log("success", booksPath);
    } catch (error) {
      console.error("error", error);
      this.setData({ downloadLoading: false });
      wx.showToast({
        title: "下载失败，请稍后重试！",
        icon: "none",
        duration: 2000,
      });
    }
  },
  async onLoad(options) {
    await this.getList();
  },
});
