// 小说章节信息提取云函数
const cloud = require("wx-server-sdk");
cloud.init({
  env: cloud.DYNAMIC_CURRENT_ENV,
});
const db = cloud.database();
// const cheerio = require('cheerio')
const pdfParse = require("pdf-parse");

// 章节匹配规则
const CHAPTER_PATTERNS = [
  /^[第]([一二三四五六七八九十百千万\d]{1,4})[章回节篇幕](.*)$/,
  /^([一二三四五六七八九十百千万\d]{1,4})[章回节篇幕](.*)$/,
  /^(\d{1,4})\s+(.*)$/,
  /^(\d{1,4})[.、]\s*(.*)$/,
  /^(Chapter|Section|Ep)\s*(\d{1,4})\s*[:：]?(.*)$/i,
  /^(序章|序幕|前言|引言|后记|终章|尾声|附录)(.*)$/i,
];

/**
 * 解析TXT格式小说的章节信息
 * @param {String} content 文本内容
 * @returns {Object} 解析结果
 */
function parseTxtToChapterColl(originalContent) {
  // 接收原始内容而非处理后内容
  // 1. 先记录原始文本每行的起始位置（含所有字符，包括换行符）
  const linePositions = []; // 存储每行在原始文本中的起始索引
  const originalLines = []; // 存储原始行（未trim，未过滤）
  let currentPosition = 0;

  // 逐字符扫描，精准分割行并记录位置（处理所有换行符情况）
  let currentLine = [];
  for (let i = 0; i < originalContent.length; i++) {
    const char = originalContent[i];
    currentLine.push(char);

    // 检测换行符
    if (char === "\n") {
      originalLines.push(currentLine.join(""));
      linePositions.push(currentPosition);
      currentPosition = i + 1; // 下一行起始位置（跳过当前换行符）
      currentLine = [];
    } else if (
      char === "\r" &&
      i + 1 < originalContent.length &&
      originalContent[i + 1] === "\n"
    ) {
      // 处理\r\n（占2字节）
      currentLine.push(originalContent[i + 1]); // 包含\n
      originalLines.push(currentLine.join(""));
      linePositions.push(currentPosition);
      currentPosition = i + 2; // 跳过\r\n
      currentLine = [];
      i++; // 跳过已处理的\n
    }
  }
  // 处理最后一行（无换行符结尾）
  if (currentLine.length > 0) {
    originalLines.push(currentLine.join(""));
    linePositions.push(currentPosition);
  }

  // 2. 文本预处理（仅用于标题识别，不影响位置计算）
  const cleanLines = originalLines
    .map((line) => line.trim())
    .filter((line) => line.length >= 2 && line.length <= 50);

  const chapterCollData = [];
  let chapterSeq = 0;

  // 3. 逐行匹配标题（用cleanLines识别，用originalLines的位置）
  for (const [lineIndex, cleanLine] of cleanLines.entries()) {
    // 找到原始行的索引（因为cleanLines是过滤后的，需映射回originalLines）
    const originalLineIndex = originalLines.findIndex(
      (originalLine, idx) =>
        originalLine.trim() === cleanLine && idx >= lineIndex
    );
    if (originalLineIndex === -1) continue;

    // 原始行的起始位置（核心：用原始文本的位置）
    const startPosition = linePositions[originalLineIndex];

    let matchResult = null;

    // 匹配章节（位置用startPosition）
    for (const pattern of CHAPTER_PATTERNS) {
      matchResult = cleanLine.match(pattern);
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
          seqId,
          title,
          startPosition, // 原始文本中的起始位置
          startLine: originalLineIndex, // 原始行号
          createTime: db.serverDate(),
          updateTime: db.serverDate(),
        };
        chapterCollData.push(chapterData);
        break;
      }
    }
  }

  // 在循环解析完成后补充endPosition
  for (let i = 0; i < chapterCollData.length; i++) {
    const current = chapterCollData[i];
    const next = chapterCollData[i + 1];
    current.endPosition = next ? next.startPosition : originalContent.length;
  }
  console.log("章节解析结果:", chapterCollData);
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

    // await validateAndSaveResult(chaptersResult);
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
