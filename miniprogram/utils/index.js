const userDataPath = wx.env.USER_DATA_PATH; // 获取用户目录路径
export const booksPath = `${userDataPath}/books`; // 组合完整路径

// 防抖函数
export function debounce(func, wait) {
  let timeout;
  return function executedFunction(...args) {
    const later = () => {
      clearTimeout(timeout);
      func.apply(this, args);
    };
    clearTimeout(timeout);
    timeout = setTimeout(later, wait);
  };
}