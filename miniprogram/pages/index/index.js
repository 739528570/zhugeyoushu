// index.js
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
  async onLoad(options) {
    await this.getList();
  },
});