// 小说章节信息提取云函数
const cloud = require("wx-server-sdk");
cloud.init({
  env: cloud.DYNAMIC_CURRENT_ENV,
});
const db = cloud.database();
// const cheerio = require('cheerio')
const pdfParse = require("pdf-parse");

// 优化后的卷名匹配规则
const VOLUME_PATTERNS = [
  // 严格匹配带"卷/部/篇"的标题
  /^[第]?([一二三四五六七八九十百千万\d]{1,4})[卷部篇集册](.*)$/,
  // 匹配英文卷名
  /^(Volume|Book|Part)\s*([一二三四五六七八九十百千万\d]{1,4})\s*[:：]?(.*)$/i,
  // 匹配明确的分卷标题
  /^[第]?([一二三四五六七八九十百千万\d]{1,4})[ ]?[分卷](.*)$/,
];

// 增强后的章节匹配正则
const CHAPTER_PATTERNS = [
  // 基础章节格式
  /^[第]([一二三四五六七八九十百千万\d]{1,4})[章回节篇幕](.*)$/,
  // 无"第"字的章节（如"一章 标题"）
  /^([一二三四五六七八九十百千万\d]{1,4})[章回节篇幕](.*)$/,
  // 数字+标题（如"1 标题"、"01 标题"）
  /^(\d{1,4})\s+(.*)$/,
  // 带点的数字标题（如"1. 标题"、"001. 标题"）
  /^(\d{1,4})[.、]\s*(.*)$/,
  // 英文章节（Chapter/Section）
  /^(Chapter|Section|Ep)\s*(\d{1,4})\s*[:：]?(.*)$/i,
  // 特殊章节（序章、终章等）
  /^(序章|序幕|前言|引言|后记|终章|尾声|附录)(.*)$/i,
];

// 云函数中添加解析结果校验
async function validateAndSaveResult(chapterCollData) {
  // 1. 检查是否有有效章节
  const validChapters = chapterCollData.filter(
    (item) => item.type === "chapter" && item.title && !isNaN(item.seqId)
  );

  // 2. 如果有效章节为0，创建基础结构
  if (validChapters.length === 0) {
    console.log("未匹配到章节，创建基础结构");
    chapterCollData = createFallbackChapters(content.length);
  }
  console.log('validateAndSaveResult', chapterCollData)
  // 3. 保存到数据库
  // await db.collection("chapters").where({ bookId, openid }).remove();
  // const batch = db.collection("chapters").batch();
  // chapterCollData.forEach((item) => batch.add({ data: item }));
  // return await batch.commit();
}

// 保底章节结构创建函数
function createFallbackChapters(contentLength) {
  const chapterCount = Math.max(1, Math.ceil(contentLength / 10000));
  const defaultVolume = {
    type: "volume",
    seqId: 1,
    title: "正文",
    parentId: null,
    startPosition: 0,
    startLine: 0,
    createTime: db.serverDate(),
    updateTime: db.serverDate(),
  };

  const chapters = [];
  for (let i = 0; i < chapterCount; i++) {
    chapters.push({
      type: "chapter",
      seqId: i + 1,
      title: `第${i + 1}章`,
      parentId: defaultVolume._id,
      startPosition: i * 10000,
      startLine: Math.floor((i * 10000) / 20),
      createTime: db.serverDate(),
      updateTime: db.serverDate(),
    });
  }

  return [defaultVolume, ...chapters];
}

/**
 * 解析TXT格式小说的章节信息
 * @param {String} content 文本内容
 * @returns {Object} 解析结果
 */
function parseTxtToChapterColl(content) {
  // 1. 文本预处理
  let cleanContent = content
    .replace(/^声明:[\s\S]*?------------/i, "")
    .replace(/^[-=]{5,}$/gm, "")
    .replace(/^\s*$/gm, "");
  const lines = cleanContent
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line.length >= 2 && line.length <= 50);

  const chapterCollData = [];
  let currentVolumeId = null;
  let volumeSeq = 0;
  let chapterSeq = 0;

  // 新增：标记是否已解析到卷
  let hasVolume = false;

  // 2. 逐行解析
  for (let lineIndex = 0; lineIndex < lines.length; lineIndex++) {
    const line = lines[lineIndex];
    let isVolume = false;
    let isChapter = false;
    let matchResult = null;

    // 2.1 匹配卷（仍然支持有卷的情况）
    for (const pattern of VOLUME_PATTERNS) {
      matchResult = line.match(pattern);
      if (matchResult) {
        isVolume = true;
        hasVolume = true; // 标记已找到卷
        break;
      }
    }

    if (isVolume) {
      // 卷处理逻辑（同之前）
      volumeSeq++;
      const chineseNumStr = matchResult[1];
      const seqId =
        chineseToNumber(chineseNumStr) === -1
          ? volumeSeq
          : chineseToNumber(chineseNumStr);
      const title = matchResult[2] ? matchResult[2].trim() : `第${seqId}卷`;
      const startPosition = lineIndex * 20;

      const volumeData = {
        type: "volume",
        seqId,
        title,
        parentId: null,
        startPosition,
        startLine: lineIndex,
        createTime: db.serverDate(),
        updateTime: db.serverDate(),
      };
      chapterCollData.push(volumeData);
      currentVolumeId = volumeData._id;
      continue;
    }

    // 2.2 匹配章节（关键优化：无论是否有卷，都可以解析章节）
    for (const pattern of CHAPTER_PATTERNS) {
      matchResult = line.match(pattern);
      if (matchResult) {
        isChapter = true;
        break;
      }
    }

    if (isChapter) {
      chapterSeq++;
      let seqId;
      let title;

      if (matchResult.length === 4) {
        const chineseNumStr = matchResult[2];
        seqId =
          chineseToNumber(chineseNumStr) === -1
            ? chapterSeq
            : chineseToNumber(chineseNumStr);
        title = matchResult[3] ? matchResult[3].trim() : `第${seqId}章`;
      } else {
        const chineseNumStr = matchResult[1];
        seqId =
          chineseToNumber(chineseNumStr) === -1
            ? chapterSeq
            : chineseToNumber(chineseNumStr);
        title = matchResult[2] ? matchResult[2].trim() : `第${seqId}章`;
      }

      const startPosition = lineIndex * 20;

      // 章节数据（关键优化：如果没有卷，parentId设为null）
      const chapterData = {
        type: "chapter",
        seqId,
        title,
        parentId: currentVolumeId || null, // 无卷时为null
        startPosition,
        startLine: lineIndex,
        createTime: db.serverDate(),
        updateTime: db.serverDate(),
      };
      chapterCollData.push(chapterData);
    }
  }

  // 3. 关键优化：如果没有卷但有章节，自动创建一个默认卷
  if (
    !hasVolume &&
    chapterCollData.filter((item) => item.type === "chapter").length > 0
  ) {
    const defaultVolume = {
      type: "volume",
      seqId: 1,
      title: "正文", // 默认卷名
      parentId: null,
      startPosition: 0,
      startLine: 0,
      createTime: db.serverDate(),
      updateTime: db.serverDate(),
    };

    // 将所有章节关联到默认卷
    chapterCollData.forEach((item) => {
      if (item.type === "chapter") {
        item.parentId = defaultVolume._id;
      }
    });

    // 添加默认卷到集合最前面
    chapterCollData.unshift(defaultVolume);
  }

  // 4. 最终防护：如果解析结果为空，创建基础章节结构
  if (chapterCollData.length === 0) {
    // 按固定长度拆分章节（保底方案）
    const totalChars = cleanContent.length;
    const chapterCount = Math.max(1, Math.ceil(totalChars / 10000)); // 每10000字符一章

    // 创建默认卷
    const defaultVolume = {
      type: "volume",
      seqId: 1,
      title: "正文",
      parentId: null,
      startPosition: 0,
      startLine: 0,
      createTime: db.serverDate(),
      updateTime: db.serverDate(),
    };
    chapterCollData.push(defaultVolume);

    // 创建章节
    for (let i = 0; i < chapterCount; i++) {
      chapterCollData.push({
        type: "chapter",
        seqId: i + 1,
        title: `第${i + 1}章`,
        parentId: defaultVolume._id,
        startPosition: i * 10000,
        startLine: Math.floor((i * 10000) / 20), // 估算行号
        createTime: db.serverDate(),
        updateTime: db.serverDate(),
      });
    }
  }

  return chapterCollData;
}

/**
 * 解析EPUB格式小说的章节信息
 * @param {Buffer} epubBuffer EPUB文件缓冲区
 * @returns {Promise<Object>} 解析结果
 */
// async function parseEpubChapters(epubBuffer) {
//   const JSZip = require('jszip')
//   // 将缓冲区转换为Node.js可读流（关键修复）
//   const stream = Readable.from(epubBuffer);
//   const zip = await JSZip.loadAsync(stream); // 使用Node.js流加载

//   // 查找EPUB的内容文件
//   let contentFile = null
//   const fileNames = Object.keys(zip.files)

//   // 尝试找到content.opf文件
//   for (const fileName of fileNames) {
//     if (fileName.toLowerCase().includes('content.opf')) {
//       contentFile = fileName
//       break
//     }
//   }

//   if (!contentFile) {
//     throw new Error('无法找到EPUB内容文件')
//   }

//   // 解析content.opf获取章节信息
//   const contentData = await zip.file(contentFile).async('string')
//   const $ = cheerio.load(contentData, {
//     xmlMode: true
//   })

//   const result = {
//     volumes: [],
//     chapters: [],
//     structure: []
//   }

//   let currentVolume = null
//   let chapterIndex = 0

//   // 解析spine获取章节顺序
//   $('spine itemref').each((i, elem) => {
//     const idref = $(elem).attr('idref')

//     // 查找对应的item
//     const item = $(`item[id="${idref}"]`)
//     const href = item.attr('href')
//     const title = item.attr('title') || `第${i+1}章`

//     // 判断是否为卷
//     let isVolume = false
//     let volumeMatch = null

//     if (title) {
//       for (const pattern of VOLUME_PATTERNS) {
//         volumeMatch = title.match(pattern)
//         if (volumeMatch) {
//           isVolume = true
//           break
//         }
//       }
//     }

//     if (isVolume) {
//       const volumeId = volumeMatch ? parseInt(volumeMatch[1]) : i + 1
//       currentVolume = {
//         id: volumeId,
//         title,
//         href,
//         chapterCount: 0
//       }
//       result.volumes.push(currentVolume)
//       result.structure.push({
//         type: 'volume',
//         id: volumeId,
//         title,
//         href,
//         position: i
//       })
//     } else {
//       // 章节处理
//       let chapterId = i + 1
//       let chapterTitle = title

//       // 尝试从标题中提取章节号
//       if (title) {
//         for (const pattern of CHAPTER_PATTERNS) {
//           const chapterMatch = title.match(pattern)
//           if (chapterMatch && chapterMatch[1]) {
//             chapterId = parseInt(chapterMatch[1])
//             break
//           }
//         }
//       }

//       const chapter = {
//         id: chapterId,
//         title: chapterTitle,
//         href,
//         position: i,
//         volumeId: currentVolume ? currentVolume.id : null
//       }

//       result.chapters.push(chapter)
//       result.structure.push({
//         type: 'chapter',
//         id: chapterId,
//         title: chapterTitle,
//         href,
//         volumeId: currentVolume ? currentVolume.id : null,
//         position: i
//       })

//       if (currentVolume) {
//         currentVolume.chapterCount++
//       }

//       chapterIndex++
//     }
//   })

//   return result
// }

/**
 * 解析PDF格式小说的章节信息
 * @param {Buffer} pdfBuffer PDF文件缓冲区
 * @returns {Promise<Object>} 解析结果
 */
// async function parsePdfChapters(pdfBuffer) {
//   const data = await pdfParse(pdfBuffer);
//   const content = data.text;

//   // PDF解析逻辑类似TXT，但需要处理分页符
//   const lines = content
//     .split(/\r?\n|\f/) // 处理换行和分页符
//     .map((line) => line.trim())
//     .filter((line) => line.length > 2 && line.length < 50);

//   // 复用TXT解析逻辑
//   const result = parseTxtChapters(lines.join("\n"));

//   // 补充PDF特有的页码信息
//   result.pages = data.numpages;

//   return result;
// }

/**
 * 中文数字转阿拉伯数字（支持一~十、百、千，覆盖小说常见场景）
 * @param {String} chineseNum 中文数字（如"一""十一""一百二"）
 * @returns {Number} 阿拉伯数字，转换失败返回-1
 */
function chineseToNumber(chineseNum) {
  // 基础数字映射
  const numMap = {
    零: 0,
    一: 1,
    二: 2,
    三: 3,
    四: 4,
    五: 5,
    六: 6,
    七: 7,
    八: 8,
    九: 9,
    十: 10,
    百: 100,
    千: 1000,
  };

  // 处理“十一~九十九”（如“十一”=11，“九十一”=91）
  if (/^十[一二三四五六七八九十]?$/.test(chineseNum)) {
    if (chineseNum === "十") return 10;
    return 10 + numMap[chineseNum[1]];
  }

  // 处理“一百~九百九十九”（如“一百二”=120，“三百零五”暂不支持，简化为300）
  if (/^[一二三四五六七八九十]百[一二三四五六七八九十]?$/.test(chineseNum)) {
    const baiIndex = chineseNum.indexOf("百");
    const baiPart = numMap[chineseNum[baiIndex - 1]] * 100;
    const gePart = chineseNum[baiIndex + 1]
      ? numMap[chineseNum[baiIndex + 1]] || 0
      : 0;
    return baiPart + gePart;
  }

  // 直接映射（一~九、十、百、千）
  if (numMap[chineseNum]) return numMap[chineseNum];

  // 若为阿拉伯数字字符串，直接转换（如“12”→12）
  const arabicNum = parseInt(chineseNum);
  if (!isNaN(arabicNum)) return arabicNum;

  // 转换失败返回-1（后续处理默认值）
  return -1;
}

/**
 * 主函数：根据文件类型解析章节信息
 */
exports.main = async (event, context) => {
  try {
    const { bookId, fileType = "TXT", fileUrl } = event;
    const wxContext = cloud.getWXContext();
    const openid = wxContext.OPENID;
    if (!bookId || !fileType || !fileUrl) {
      return {
        code: 400,
        message: "参数不完整",
        success: false,
      };
    }

    // 1. 从云存储下载文件
    // const doc = await db.collection('documents')
    //   .where({
    //     _id: bookId,
    //     openid
    //   })
    //   .get()

    // if (doc.data.length === 0) {
    //   return {
    //     code: 404,
    //     message: '文档不存在',
    //     success: false
    //   }
    // }

    // const fileUrl = doc.data[0].fileUrl
    const downloadResult = await cloud.downloadFile({
      fileID: fileUrl,
    });
    const fileContent = downloadResult.fileContent;

    // 2. 根据文件类型解析章节
    let chaptersResult = null;

    switch (fileType.toUpperCase()) {
      case "TXT":
        chaptersResult = parseTxtToChapterColl(
          fileContent.toString("utf8"),
          bookId,
          openid
        );
        break;
      case "EPUB":
        // chaptersResult = await parseEpubChapters(fileContent)
        break;
      case "PDF":
        // chaptersResult = await parsePdfChapters(fileContent);
        break;
      default:
        return {
          code: 400,
          message: "不支持的文件类型",
          success: false,
        };
    }
    console.log("chaptersResult", chaptersResult);
    await validateAndSaveResult(chaptersResult)
    // 3. 保存章节信息到数据库
    await db.collection("chapters").add({
      data: {
        bookId,
        openid,
        chapters: chaptersResult,
        totalChapters: chaptersResult.length,
        updateTime: db.serverDate(),
      },
    });

    return {
      code: 200,
      data: chaptersResult,
      message: "章节解析成功",
      success: true,
    };
  } catch (err) {
    console.error("章节解析失败:", err);
    return {
      code: 500,
      message: "章节解析失败",
      error: err.message,
      success: false,
    };
  }
};
