// index.js
import Dialog from "@vant/weapp/dialog/dialog";
import { booksPath } from "../../utils/index";

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
      const cacheFileList = getApp().globalData.cacheFileList ?? [];
      console.log("getlist", cacheFileList);
      let list = res.result.data?.docs || [];
      const total = res.result.data?.total || 0;

      if (cacheFileList.length) {
        list = list.map((item) => {
          if (
            cacheFileList.includes(
              `${item.title}.${item.type.toLocaleLowerCase()}`
            )
          ) {
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
    await this.getList();
  },
});
