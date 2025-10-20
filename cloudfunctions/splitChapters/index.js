// 小说章节信息提取云函数
const cloud = require("wx-server-sdk");
cloud.init({
  env: cloud.DYNAMIC_CURRENT_ENV,
});
const db = cloud.database();
// const cheerio = require('cheerio')
const pdfParse = require("pdf-parse");

/**
 * 解析TXT格式小说的章节信息
 * @param {String} content 文本内容
 * @returns {Object} 解析结果
 */
function parseTxtToChapterColl(originalContent) {
  const CHAPTER_PATTERNS = [
    /^(\d{1,4})[.、]\s*(.*)$/,
    /^[第]([一二三四五六七八九十百千万\d]{1,4})[章回节篇幕](.*)$/,
    /^(\d{1,4})\s+(.*)$/,
    /^([一二三四五六七八九十百千万\d]{1,4})[章回节篇幕](.*)$/,
    /^(序章|序幕|前言|引言|后记|终章|尾声|附录)(.*)$/i,
    /^(Chapter|Section|Ep)\s*(\d{1,4})\s*[:：]?(.*)$/i,
  ];

  // 1. 准确记录每行的起始位置和换行符长度
  const linesInfo = [];
  let lineIndex = 0;

  // 使用更准确的行分割方法，考虑不同换行符
  const lineBreakRegex = /\r\n|\n|\r/g;
  let lastIndex = 0;
  let match;

  while ((match = lineBreakRegex.exec(originalContent)) !== null) {
    const lineEnd = match.index;
    const lineContent = originalContent.substring(lastIndex, lineEnd);
    const lineBreakLength = match[0].length; // 记录换行符实际长度

    const trimmedLine = lineContent.trim();

    if (trimmedLine.length >= 2 && trimmedLine.length <= 50) {
      linesInfo.push({
        original: lineContent,
        trimmed: trimmedLine,
        startPos: lastIndex, // 行的实际起始位置（包含前导空白）
        lineBreakLength: lineBreakLength,
        lineIndex: lineIndex,
        isPotentialChapter: /^[\d第序前引后终尾附]|^(Chapter|Section|Ep)/i.test(
          trimmedLine
        ),
      });
    }

    lastIndex = lineEnd + lineBreakLength;
    lineIndex++;
  }

  // 处理最后一行（如果没有换行符结尾）
  if (lastIndex < originalContent.length) {
    const lineContent = originalContent.substring(lastIndex);
    const trimmedLine = lineContent.trim();

    if (trimmedLine.length >= 2 && trimmedLine.length <= 50) {
      linesInfo.push({
        original: lineContent,
        trimmed: trimmedLine,
        startPos: lastIndex,
        lineBreakLength: 0, // 最后一行没有换行符
        lineIndex: lineIndex,
        isPotentialChapter: /^[\d第序前引后终尾附]|^(Chapter|Section|Ep)/i.test(
          trimmedLine
        ),
      });
    }
  }

  const chapterCollData = [];
  let chapterSeq = 0;

  // 2. 匹配章节标题
  for (const lineInfo of linesInfo) {
    if (!lineInfo.isPotentialChapter) continue;

    const cleanLine = lineInfo.trimmed;
    let matchResult = null;

    for (const pattern of CHAPTER_PATTERNS) {
      matchResult = cleanLine.match(pattern);
      if (matchResult) {
        chapterSeq++;

        let seqId, title;

        if (pattern === CHAPTER_PATTERNS[5]) {
          // 英文章节特殊处理
          seqId = parseInt(matchResult[2]) || chapterSeq;
          title = matchResult[3] ? matchResult[3].trim() : `Chapter ${seqId}`;
        } else if (matchResult.length >= 3) {
          const numStr = matchResult[1] || matchResult[2];
          seqId = chineseToNumber(numStr);
          if (seqId === -1) seqId = chapterSeq;
          title = matchResult[2] ? matchResult[2].trim() : `第${seqId}章`;
        } else {
          seqId = chapterSeq;
          title = cleanLine;
        }

        // 关键修复：使用包含前导空白的原始行起始位置
        // 这样截取时能准确包含章节标题行的完整内容
        const chapterData = {
          seqId,
          title,
          startPosition: lineInfo.startPos, // 包含前导空白的准确位置
          startLine: lineInfo.lineIndex,
          createTime: db.serverDate(),
          updateTime: db.serverDate(),
        };

        chapterCollData.push(chapterData);
        break;
      }
    }
  }

  // 3. 准确计算每章的结束位置
  if (chapterCollData.length > 0) {
    const contentLength = originalContent.length;

    for (let i = 0; i < chapterCollData.length; i++) {
      const currentChapter = chapterCollData[i];

      if (i < chapterCollData.length - 1) {
        const nextChapter = chapterCollData[i + 1];
        // 结束位置是下一章开始位置的前一个字符
        // 这样当前章内容包含从startPosition到endPosition-1
        currentChapter.endPosition = nextChapter.startPosition;
      } else {
        // 最后一章结束位置是文件末尾
        currentChapter.endPosition = contentLength;
      }
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
 * 优化版中文数字转换（添加缓存）
 */
const chineseNumCache = new Map();
function chineseToNumber(chineseNum) {
  // 缓存检查
  if (chineseNumCache.has(chineseNum)) {
    return chineseNumCache.get(chineseNum);
  }

  // 提前判断是否为纯数字
  const arabicNum = parseInt(chineseNum, 10);
  if (!isNaN(arabicNum)) {
    chineseNumCache.set(chineseNum, arabicNum);
    return arabicNum;
  }

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
    壹: 1,
    贰: 2,
    叁: 3,
    肆: 4,
    伍: 5,
    陆: 6,
    柒: 7,
    捌: 8,
    玖: 9,
    拾: 10,
    佰: 100,
    仟: 1000,
  };

  let result = -1;

  // 简化常见模式匹配
  if (/^十[一二三四五六七八九]?$/.test(chineseNum)) {
    result = chineseNum === "十" ? 10 : 10 + numMap[chineseNum[1]];
  } else if (
    /^[一二三四五六七八九]百[零一二三四五六七八九]?$/.test(chineseNum)
  ) {
    const baiIndex = chineseNum.indexOf("百");
    const baiPart = numMap[chineseNum[baiIndex - 1]] * 100;
    const gePart = chineseNum[baiIndex + 1]
      ? numMap[chineseNum[baiIndex + 1]] || 0
      : 0;
    result = baiPart + gePart;
  } else {
    result = numMap[chineseNum] ?? -1;
  }

  chineseNumCache.set(chineseNum, result);
  return result;
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
