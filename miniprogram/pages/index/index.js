// index.js
import Dialog from "@vant/weapp/dialog/dialog";
import { booksPath } from "../../utils/index";
wx.cloud.init({
  env: "cloud1-0gwzt3tn975ea82c",
});
Page({
  data: {
    list: [],
    total: 0,
    loading: true,
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
      console.log("**load getlist", res);
      const list = res.result.data?.docs || [];
      const total = res.result.data?.total || 0;

      this.setData({
        list,
        total,
        loading: false,
      });
    } catch (error) {
      this.setData({
        loading: false,
      });
    }
  },
  async delete(data) {
    try {
      console.log("delete", data);
      const item = data.target.dataset.item;
      await Dialog.confirm({
        title: "删除书籍",
        message: `确认删除 ${item.title} ?`,
      });
      const res = await wx.cloud.callFunction({
        name: "books",
        data: {
          cmd: "delete",
          docId: item._id,
        },
      });
      await this.getList();
      console.log(res);
    } catch (error) {}
  },
  async gotoDetail(data) {
    console.log(data, data.target.dataset.item._id);
    try {
      wx.navigateTo({
        url: `/pages/bookdetail/index?id=${data.target.dataset.item._id}`,
      });
    } catch (error) {}
  },
  async download(data) {
    try {
      console.log(data);
    } catch (error) {}
  },
  async onLoad(options) {
    const fs = wx.getFileSystemManager();
    try {
      fs.accessSync(booksPath);
      console.log('目录已存在，无需创建。');
    } catch (e) {
      fs.mkdirSync(booksPath, { recursive: true });
      console.log('目录创建成功！');
    }
    fs.getSavedFileList({
      success: (res) => {
        console.log("success", res);
      },
      fail: (err) => {
        console.log("fail", err);
      },
    });
    await this.getList();
  },
});
