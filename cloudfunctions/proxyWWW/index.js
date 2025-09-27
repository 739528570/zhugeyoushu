// 云函数入口文件
const cloud = require("wx-server-sdk");
const rp = require("request-promise"); // 需先安装：npm install request-promise

cloud.init();

// 模拟PC端Chrome的User-Agent
const PC_USER_AGENT =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/112.0.0.0 Safari/537.36";

// 云函数入口函数
exports.main = async (event, context) => {
  const { url = "https://www.douyin.com" } = event; // 默认为抖音PC版首页

  try {
    // 1. 用PC端UA请求抖音网页
    const html = await rp({
      uri: url,
      headers: {
        "User-Agent": PC_USER_AGENT,
        Referer: "https://www.douyin.com/", // 模拟 referer，降低反爬风险
        Accept:
          "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
      },
      timeout: 10000, // 超时时间10秒
    });

    // 2. 处理HTML中的资源链接（关键步骤）
    // 将绝对路径的资源（如//s3.pstatp.com/...）替换为云函数代理路径
    // 注意：此步骤仅为示例，实际需根据抖音的资源域名灵活处理
    const processedHtml = html
      .replace(/src="\/\/([^"]+)"/g, 'src="https://$1"') // 补全协议头
      .replace(/href="\/\/([^"]+)"/g, 'href="https://$1"')
      // 替换链接为云函数代理（可选，避免直接访问被拦截）
      .replace(/https?:\/\/([^\/]+)\//g, (match, domain) => {
        // 仅代理抖音相关域名，避免无意义代理
        if (
          domain.includes("douyin") ||
          domain.includes("tiktok") ||
          domain.includes("pstatp")
        ) {
          return `/cloudfunction/proxyDouyin?url=${encodeURIComponent(match)}`;
        }
        return match;
      });

    const cloudPath = `douyin-pc-${Date.now()}.html`;

    const uploadRes = await cloud.uploadFile({
      cloudPath,
      fileContent: processedHtml,
    });
    console.log("uploadRes", uploadRes);

    const fileRes = await cloud.getTempFileURL({
      fileList: [uploadRes.fileID],
    });
    const htmlUrl = fileRes.fileList[0].tempFileURL;

    return {
      success: true,
      htmlUrl,
    };
  } catch (err) {
    console.error("请求失败：", err);
    return {
      success: false,
      errMsg: err.message || "请求抖音网页失败",
    };
  }
};
