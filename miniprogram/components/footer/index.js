// components/footer/index.js
Component({

  /**
   * 组件的属性列表
   */
  properties: {

  },

  /**
   * 组件的初始数据
   */
  data: {
    active: 0,
  },

  /**
   * 组件的方法列表
   */
  methods: {
    onChange(event) {
      wx.navigateTo({
        url: event.detail,
      })
    },
    onLoad: function(options) {
      // 页面创建时执行
      console.log('**', options)
    },
  },
})