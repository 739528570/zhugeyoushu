// 小说章节信息提取云函数
const cloud = require("wx-server-sdk");
cloud.init({
  env: cloud.DYNAMIC_CURRENT_ENV,
});
const db = cloud.database();
// const cheerio = require('cheerio')
const pdfParse = require("pdf-parse");

// 卷名匹配规则
const VOLUME_PATTERNS = [
  /^[第]?([一二三四五六七八九十百千万\d]{1,4})[卷部篇集册](.*)$/,
  /^(Volume|Book|Part)\s*([一二三四五六七八九十百千万\d]{1,4})\s*[:：]?(.*)$/i,
  /^[第]?([一二三四五六七八九十百千万\d]{1,4})[ ]?[分卷](.*)$/,
];

// 章节匹配规则
const CHAPTER_PATTERNS = [
  /^[第]([一二三四五六七八九十百千万\d]{1,4})[章回节篇幕](.*)$/,
  /^([一二三四五六七八九十百千万\d]{1,4})[章回节篇幕](.*)$/,
  /^(\d{1,4})\s+(.*)$/,
  /^(\d{1,4})[.、]\s*(.*)$/,
  /^(Chapter|Section|Ep)\s*(\d{1,4})\s*[:：]?(.*)$/i,
  /^(序章|序幕|前言|引言|后记|终章|尾声|附录)(.*)$/i,
];

// 校验并保存章节数据
async function validateAndSaveResult(chapterCollData) {
  const validChapters = chapterCollData.filter(
    (item) => item.type === "chapter" && item.title && !isNaN(item.seqId)
  );

  if (validChapters.length === 0) {
    console.log("未匹配到章节，创建基础结构");
    chapterCollData = createFallbackChapters(content.length);
  }

  console.log("validateAndSaveResult", chapterCollData);
  // 保存到数据库的逻辑（暂未实现）
}

// 创建默认章节结构
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

  const chapters = Array.from({ length: chapterCount }, (_, i) => ({
    type: "chapter",
    seqId: i + 1,
    title: `第${i + 1}章`,
    parentId: defaultVolume._id,
    startPosition: i * 10000,
    startLine: Math.floor((i * 10000) / 20),
    createTime: db.serverDate(),
    updateTime: db.serverDate(),
  }));

  return [defaultVolume, ...chapters];
}

/**
 * 解析TXT格式小说的章节信息
 * @param {String} content 文本内容
 * @returns {Object} 解析结果
 */
function parseTxtToChapterColl(content) {
  // 文本预处理
  const cleanContent = content
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

  // 逐行解析
  for (const [lineIndex, line] of lines.entries()) {
    let matchResult = null;

    // 匹配卷
    for (const pattern of VOLUME_PATTERNS) {
      matchResult = line.match(pattern);
      if (matchResult) {
        hasVolume = true;
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
    }

    // 匹配章节
    for (const pattern of CHAPTER_PATTERNS) {
      matchResult = line.match(pattern);
      if (matchResult) {
        chapterSeq++;
        let seqId, title;

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

        const chapterData = {
          type: "chapter",
          seqId,
          title,
          parentId: currentVolumeId || null,
          startPosition: lineIndex * 20,
          startLine: lineIndex,
          createTime: db.serverDate(),
          updateTime: db.serverDate(),
        };
        chapterCollData.push(chapterData);
        break;
      }
    }
  }

  // 如果没有卷但有章节，自动创建默认卷
  if (!hasVolume && chapterCollData.some((item) => item.type === "chapter")) {
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

    chapterCollData.forEach((item) => {
      if (item.type === "chapter") item.parentId = defaultVolume._id;
    });

    chapterCollData.unshift(defaultVolume);
  }

  // 如果解析结果为空，创建基础章节结构
  if (chapterCollData.length === 0) {
    const totalChars = cleanContent.length;
    const chapterCount = Math.max(1, Math.ceil(totalChars / 10000));

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

    for (let i = 0; i < chapterCount; i++) {
      chapterCollData.push({
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
 * 中文数字转阿拉伯数字
 * @param {String} chineseNum 中文数字（如"一""十一""一百二"）
 * @returns {Number} 阿拉伯数字，转换失败返回-1
 */
function chineseToNumber(chineseNum) {
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

  if (/^十[一二三四五六七八九十]?$/.test(chineseNum)) {
    return chineseNum === "十" ? 10 : 10 + numMap[chineseNum[1]];
  }

  if (/^[一二三四五六七八九十]百[一二三四五六七八九十]?$/.test(chineseNum)) {
    const baiIndex = chineseNum.indexOf("百");
    const baiPart = numMap[chineseNum[baiIndex - 1]] * 100;
    const gePart = chineseNum[baiIndex + 1]
      ? numMap[chineseNum[baiIndex + 1]] || 0
      : 0;
    return baiPart + gePart;
  }

  if (numMap[chineseNum]) return numMap[chineseNum];

  const arabicNum = parseInt(chineseNum);
  return !isNaN(arabicNum) ? arabicNum : -1;
}

/**
 * 主函数：根据文件类型解析章节信息
 */
exports.main = async (event) => {
  try {
    const { bookId, fileType = "TXT", fileUrl, encoding } = event;
    const wxContext = cloud.getWXContext();
    const openid = wxContext.OPENID;

    if (!bookId || !fileType || !fileUrl) {
      return { code: 400, message: "参数不完整", success: false };
    }

    const downloadResult = await cloud.downloadFile({ fileID: fileUrl });
    const decoder = new TextDecoder(encoding);
    const fileContent = decoder.decode(downloadResult.fileContent);

    let chaptersResult;
    switch (fileType.toUpperCase()) {
      case "TXT":
        chaptersResult = parseTxtToChapterColl(fileContent);
        break;
      case "EPUB":
      case "PDF":
        return { code: 400, message: "暂不支持的文件类型", success: false };
      default:
        return { code: 400, message: "不支持的文件类型", success: false };
    }

    await validateAndSaveResult(chaptersResult);
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
    return { code: 500, message: "章节解析失败", error: err, success: false };
  }
};
