Page({
  data: {
    bookmarks: [] // 书签列表数据
  },

  onLoad: function (options) {
    this.loadBookmarks();
  },

  onPullDownRefresh: function () {
    this.loadBookmarks().then(() => {
      wx.stopPullDownRefresh();
    });
  },

  // 加载书签数据
  loadBookmarks: function () {
    return new Promise((resolve) => {
      // 从本地缓存或云数据库加载书签数据
      const bookmarks = wx.getStorageSync('bookmarks');
      bookmarks && this.setData({
        bookmarks: Object.entries(bookmarks).map(([key, value]) =>
          ({ id: key, bookmark: value, title: value[0].title })) || []
      });

      resolve();
    });
  },

  // 点击书签事件
  onBookmarkClick: function (event) {
    const item = event.currentTarget.dataset.item;

    if (item) {
      wx.navigateTo({
        url: `/pages/bookdetail/index?bookId=${
          item.bookId
        }&chapterId=${
          item.chapterId
        }&page=${
          item.page
        }`,
      });
    }
  },

  // 删除书签
  deleteBookmark: function (event) {
    const bookmarkId = event.currentTarget.dataset.id;

    wx.showModal({
      title: '确认删除',
      content: '确定要删除这个书签吗？',
      confirmColor: '#ee0a24',
      success: (res) => {
        if (res.confirm) {
          const newBookmarks = this.data.bookmarks.filter(item => item.id !== bookmarkId);

          this.setData({ bookmarks: newBookmarks });

          // 更新本地存储
          wx.setStorageSync('bookmarks', newBookmarks);

          wx.showToast({
            title: '删除成功',
            icon: 'success',
            duration: 1500
          });
        }
      }
    });
  },

  // 清空所有书签
  clearAllBookmarks: function () {
    if (this.data.bookmarks.length === 0) {
      wx.showToast({
        title: '暂无书签可清空',
        icon: 'none'
      });
      return;
    }

    wx.showModal({
      title: '确认清空',
      content: '确定要清空所有书签吗？此操作不可撤销',
      confirmColor: '#ee0a24',
      success: (res) => {
        if (res.confirm) {
          this.setData({ bookmarks: [] });
          wx.setStorageSync('bookmarks', []);

          wx.showToast({
            title: '清空成功',
            icon: 'success',
            duration: 1500
          });
        }
      }
    });
  },

  // 跳转到阅读器
  goToReader: function () {
    wx.navigateTo({
      url: '/pages/book/index'
    });
  },
});