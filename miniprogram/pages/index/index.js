// index.js
import Dialog from '@vant/weapp/dialog/dialog';
wx.cloud.init()
Page({
  data: {
    list: [],
    total: 0,
    loading: true
  },
  async getList() {
    try {
      const res = await wx.cloud.callFunction({
        name: 'docGet',
      });
      console.log('**load getlist', res)
      const list = res.result.data?.data?.docs || [];
      const total = res.result.data?.data?.total || 0;
      console.log('**load getlist', list)
      this.setData({
        list,
        total,
        loading: false
      })
    } catch (error) {
      this.setData({
        loading: false
      })
    }
  },
  async delete(data) {
    try {
      console.log('delete', data)
      const item = data.target.dataset.item
      await Dialog.confirm({
        title: '删除书籍',
        message: `确认删除 ${item.title} ?`,
      })
      const res = await wx.cloud.callFunction({
        name: 'docDelete',
        data: {
          docId: item._id
        }
      });
      await this.getList();
      console.log(res)
    } catch (error) {

    }
  },
  async gotoDetail(data) {
    console.log(data, data.target.dataset.item._id)
    try {
      wx.navigateTo({
        url: `/pages/bookdetail/index?id=${data.target.dataset.item._id}`,
      })
    } catch (error) {
      
    }
  },
  async onLoad(options) {
    await this.getList();
  },
});