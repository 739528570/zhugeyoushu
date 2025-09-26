// 小说章节信息提取云函数
const cloud = require('wx-server-sdk')
cloud.init({
  env: cloud.DYNAMIC_CURRENT_ENV
})
const db = cloud.database()
const cheerio = require('cheerio')
const pdfParse = require('pdf-parse')
const {
  Readable
} = require('stream'); // 使用Node.js的stream模块

// 章节标题匹配正则表达式库
const CHAPTER_PATTERNS = [
  // 通用章节格式：第X章/卷/节
  /^[第卷部集](\d{1,4})[章回卷节篇幕集](.*)$/,
  // 数字+标题：1. 标题 / 1-1 标题
  /^(\d{1,4})[.\-](.*)$/,
  // 英文章节：Chapter X / Book X
  /^(Chapter|Book|Section)\s*(\d{1,4})\s*[:：]?(.*)$/i,
  // 卷+章节组合：第一卷 第一章
  /^[第](\d{1,4})[卷部集]\s*[第](\d{1,4})[章回节](.*)$/
]

// 卷/部匹配正则
const VOLUME_PATTERNS = [
  /^[第](\d{1,3})[卷部集篇](.*)$/,
  /^(Volume|Book|Part)\s*(\d{1,3})\s*[:：]?(.*)$/i
]

/**
 * 解析TXT格式小说的章节信息
 * @param {String} content 文本内容
 * @returns {Object} 解析结果
 */
function parseTxtChapters(content) {
  // 按换行分割行，过滤空行和过短行
  const lines = content.split(/\r?\n/)
    .map(line => line.trim())
    .filter(line => line.length > 2 && line.length < 50)

  const result = {
    volumes: [],
    chapters: [],
    structure: [] // 完整结构：[{type: 'volume', id: 1, title: '第一卷', start: 0}, ...]
  }

  let currentVolume = null
  let lineIndex = 0

  for (const line of lines) {
    let isVolume = false
    let isChapter = false
    let matchResult = null

    // 先判断是否为卷/部
    for (const pattern of VOLUME_PATTERNS) {
      matchResult = line.match(pattern)
      if (matchResult) {
        isVolume = true
        break
      }
    }

    if (isVolume) {
      // 处理卷信息
      const volumeId = parseInt(matchResult[1])
      const volumeTitle = matchResult[2] || `第${volumeId}卷`

      currentVolume = {
        id: volumeId,
        title: volumeTitle,
        startLine: lineIndex,
        chapterCount: 0
      }

      result.volumes.push(currentVolume)
      result.structure.push({
        type: 'volume',
        id: volumeId,
        title: volumeTitle,
        position: lineIndex
      })
    } else {
      // 判断是否为章节
      for (const pattern of CHAPTER_PATTERNS) {
        matchResult = line.match(pattern)
        if (matchResult) {
          isChapter = true
          break
        }
      }

      if (isChapter) {
        // 处理章节信息
        let chapterId, chapterTitle

        if (matchResult.length === 3) {
          chapterId = parseInt(matchResult[1])
          chapterTitle = matchResult[2] || `第${chapterId}章`
        } else if (matchResult.length === 4) {
          // 卷+章组合格式
          chapterId = parseInt(matchResult[2])
          chapterTitle = matchResult[3] || `第${matchResult[1]}卷第${chapterId}章`
        }

        const chapter = {
          id: chapterId,
          title: chapterTitle,
          startLine: lineIndex,
          volumeId: currentVolume ? currentVolume.id : null
        }

        result.chapters.push(chapter)
        result.structure.push({
          type: 'chapter',
          id: chapterId,
          title: chapterTitle,
          volumeId: currentVolume ? currentVolume.id : null,
          position: lineIndex
        })

        // 更新当前卷的章节计数
        if (currentVolume) {
          currentVolume.chapterCount++
        }
      }
    }

    lineIndex++
  }

  return result
}

/**
 * 解析EPUB格式小说的章节信息
 * @param {Buffer} epubBuffer EPUB文件缓冲区
 * @returns {Promise<Object>} 解析结果
 */
async function parseEpubChapters(epubBuffer) {
  const JSZip = require('jszip')
  // 将缓冲区转换为Node.js可读流（关键修复）
  const stream = Readable.from(epubBuffer);
  const zip = await JSZip.loadAsync(stream); // 使用Node.js流加载

  // 查找EPUB的内容文件
  let contentFile = null
  const fileNames = Object.keys(zip.files)

  // 尝试找到content.opf文件
  for (const fileName of fileNames) {
    if (fileName.toLowerCase().includes('content.opf')) {
      contentFile = fileName
      break
    }
  }

  if (!contentFile) {
    throw new Error('无法找到EPUB内容文件')
  }

  // 解析content.opf获取章节信息
  const contentData = await zip.file(contentFile).async('string')
  const $ = cheerio.load(contentData, {
    xmlMode: true
  })

  const result = {
    volumes: [],
    chapters: [],
    structure: []
  }

  let currentVolume = null
  let chapterIndex = 0

  // 解析spine获取章节顺序
  $('spine itemref').each((i, elem) => {
    const idref = $(elem).attr('idref')

    // 查找对应的item
    const item = $(`item[id="${idref}"]`)
    const href = item.attr('href')
    const title = item.attr('title') || `第${i+1}章`

    // 判断是否为卷
    let isVolume = false
    let volumeMatch = null

    if (title) {
      for (const pattern of VOLUME_PATTERNS) {
        volumeMatch = title.match(pattern)
        if (volumeMatch) {
          isVolume = true
          break
        }
      }
    }

    if (isVolume) {
      const volumeId = volumeMatch ? parseInt(volumeMatch[1]) : i + 1
      currentVolume = {
        id: volumeId,
        title,
        href,
        chapterCount: 0
      }
      result.volumes.push(currentVolume)
      result.structure.push({
        type: 'volume',
        id: volumeId,
        title,
        href,
        position: i
      })
    } else {
      // 章节处理
      let chapterId = i + 1
      let chapterTitle = title

      // 尝试从标题中提取章节号
      if (title) {
        for (const pattern of CHAPTER_PATTERNS) {
          const chapterMatch = title.match(pattern)
          if (chapterMatch && chapterMatch[1]) {
            chapterId = parseInt(chapterMatch[1])
            break
          }
        }
      }

      const chapter = {
        id: chapterId,
        title: chapterTitle,
        href,
        position: i,
        volumeId: currentVolume ? currentVolume.id : null
      }

      result.chapters.push(chapter)
      result.structure.push({
        type: 'chapter',
        id: chapterId,
        title: chapterTitle,
        href,
        volumeId: currentVolume ? currentVolume.id : null,
        position: i
      })

      if (currentVolume) {
        currentVolume.chapterCount++
      }

      chapterIndex++
    }
  })

  return result
}

/**
 * 解析PDF格式小说的章节信息
 * @param {Buffer} pdfBuffer PDF文件缓冲区
 * @returns {Promise<Object>} 解析结果
 */
async function parsePdfChapters(pdfBuffer) {
  const data = await pdfParse(pdfBuffer)
  const content = data.text

  // PDF解析逻辑类似TXT，但需要处理分页符
  const lines = content.split(/\r?\n|\f/) // 处理换行和分页符
    .map(line => line.trim())
    .filter(line => line.length > 2 && line.length < 50)

  // 复用TXT解析逻辑
  const result = parseTxtChapters(lines.join('\n'))

  // 补充PDF特有的页码信息
  result.pages = data.numpages

  return result
}

/**
 * 主函数：根据文件类型解析章节信息
 */
exports.main = async (event, context) => {
  try {
    const {
      docId,
      fileType = 'TXT',
      fileUrl
    } = event

    if (!docId || !fileType || !fileUrl) {
      return {
        code: 400,
        message: '参数不完整',
        success: false
      }
    }

    // 1. 从云存储下载文件
    // const doc = await db.collection('documents')
    //   .where({
    //     _id: docId,
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
      fileID: fileUrl
    })
    const fileContent = downloadResult.fileContent

    // 2. 根据文件类型解析章节
    let chaptersResult = null

    switch (fileType.toUpperCase()) {
      case 'TXT':
        chaptersResult = parseTxtChapters(fileContent.toString('utf8'))
        break
      case 'EPUB':
        chaptersResult = await parseEpubChapters(fileContent)
        break
      case 'PDF':
        chaptersResult = await parsePdfChapters(fileContent)
        break
      default:
        return {
          code: 400, message: '不支持的文件类型', success: false
        }
    }

    // 3. 保存章节信息到数据库
    await db.collection('books').doc(docId).update({
      data: {
        chapterInfo: chaptersResult,
        totalChapters: chaptersResult.chapters.length,
        totalVolumes: chaptersResult.volumes.length,
        updateTime: db.serverDate()
      }
    })

    return {
      code: 200,
      data: chaptersResult,
      message: '章节解析成功',
      success: true
    }
  } catch (err) {
    console.error('章节解析失败:', err)
    return {
      code: 500,
      message: '章节解析失败',
      error: err.message,
      success: false
    }
  }
}