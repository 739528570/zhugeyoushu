// components/footer/index.js
Component({
  options: {
    styleIsolation: 'shared',
  },
  /**
   * 组件的属性列表
   */
  properties: {
    active: {
      type: String,
    },
  },

  /**
   * 组件的初始数据
   */
  data: {
    icon: {
      bookshelfactive: '/statics/images/bookshelfactive.svg',
      bookshelf: '/statics/images/bookshelf.svg',
      bookmarkactive: '/statics/images/bookmarkactive.svg',
      bookmark: '/statics/images/bookmark.svg',
    },
  },
  /**
   * 组件的方法列表
   */
  methods: {
    handleTap: (e) => {
      const active = e.currentTarget.dataset.active;
      wx.navigateTo({
        url: `/pages/${active}/index`,
      });
    }
  },
});