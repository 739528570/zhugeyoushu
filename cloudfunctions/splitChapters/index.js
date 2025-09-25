// 小说自动分章节云函数
const cloud = require('wx-server-sdk')
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })
const db = cloud.database()

// 章节标题模式正则（支持多种格式）
const CHAPTER_PATTERNS = [
  // 匹配 "第一章 标题"、"第1章 标题" 格式
  /^[\s　]*第[零一二三四五六七八九十百千万\d]+[章节回卷篇集部][\s　:：]+(.+?)[\s　]*$/,
  // 匹配 "1. 标题"、"01. 标题" 格式
  /^[\s　]*\d+[\.、:：][\s　]+(.+?)[\s　]*$/,
  // 匹配 "【第一章】标题" 格式
  /^[\s　]*【第[零一二三四五六七八九十百千万\d]+[章节回]】[\s　]*(.+?)[\s　]*$/,
  // 匹配 "第一章" 无标题格式
  /^[\s　]*第[零一二三四五六七八九十百千万\d]+[章节回卷篇集部][\s　]*$/,
  // 匹配 "壹、标题" 中文数字格式
  /^[\s　]*[壹贰叁肆伍陆柒捌玖拾佰仟]+[、.][\s　]*(.+?)[\s　]*$/
]

// 章节分割主函数
exports.main = async function (event) {
  try {
    const { docId, openid, content = '', type = 'TXT' } = event
    
    if (!docId || !openid || !content) {
      return { code: 400, message: '参数不完整', success: false }
    }
    
    // 根据文件类型选择不同的分割策略
    let chapters
    if (type === 'EPUB') {
      // EPUB已有章节结构，直接解析
      chapters = parseEpubChapters(content)
    } else {
      // TXT文本自动分割章节
      chapters = splitTxtChapters(content)
    }
    
    // 保存章节信息到数据库
    await saveChaptersToDB({
      docId,
      openid,
      chapters,
      totalChapters: chapters.length
    })
    
    return {
      code: 200,
      data: { chapters, totalChapters: chapters.length },
      success: true
    }
  } catch (err) {
    console.error('分章节失败:', err)
    return { code: 500, message: '分章节处理失败', success: false }
  }
}

// TXT文本分割章节
function splitTxtChapters(content) {
  const chapters = []
  let currentChapter = {
    title: '前言',
    start: 0,
    end: 0,
    content: ''
  }
  let currentPosition = 0
  
  // 按换行分割文本行
  const lines = content.split(/\r\n|\n|\r/)
  
  lines.forEach((line, lineIndex) => {
    // 记录当前行在全文中的位置
    const lineStart = currentPosition
    const lineEnd = currentPosition + line.length + 1 // +1 是换行符长度
    currentPosition = lineEnd
    
    // 判断是否为章节标题行
    const isChapterTitle = isChapterTitleLine(line)
    
    if (isChapterTitle && chapters.length > 0) {
      // 结束当前章节
      currentChapter.end = lineStart
      currentChapter.content = content.substring(currentChapter.start, currentChapter.end)
      chapters.push(currentChapter)
      
      // 开始新章节
      currentChapter = {
        title: getChapterTitle(line),
        start: lineStart,
        end: lineEnd,
        content: ''
      }
    } else if (isChapterTitle && chapters.length === 0) {
      // 第一个章节标题
      currentChapter.title = getChapterTitle(line)
      currentChapter.start = lineStart
    }
  })
  
  // 添加最后一个章节
  currentChapter.end = content.length
  currentChapter.content = content.substring(currentChapter.start, currentChapter.end)
  chapters.push(currentChapter)
  
  // 如果没有识别到任何章节，作为单章节处理
  if (chapters.length === 1 && chapters[0].title === '前言') {
    chapters[0].title = '全文'
  }
  
  return chapters
}

// 解析EPUB章节（EPUB本身包含章节结构）
function parseEpubChapters(content) {
  // 实际项目中需要解析EPUB的opf文件和html内容
  // 这里简化处理，假设content是章节数组
  if (Array.isArray(content)) {
    return content.map((chapter, index) => ({
      title: chapter.title || `第${index + 1}章`,
      start: chapter.start || 0,
      end: chapter.end || 0,
      content: chapter.content || ''
    }))
  }
  
  // 处理失败时默认按TXT方式分割
  return splitTxtChapters(content)
}

// 判断是否为章节标题行
function isChapterTitleLine(line) {
  // 过滤过短的行（至少2个字符）
  if (line.trim().length < 2) return false
  
  // 测试是否匹配任何一种章节标题模式
  return CHAPTER_PATTERNS.some(pattern => pattern.test(line.trim()))
}

// 提取章节标题文本
function getChapterTitle(line) {
  const trimmedLine = line.trim()
  
  for (const pattern of CHAPTER_PATTERNS) {
    const match = trimmedLine.match(pattern)
    if (match) {
      // 如果有副标题则返回副标题，否则返回完整匹配
      return match[1] || match[0]
    }
  }
  
  return trimmedLine
}

// 保存章节信息到数据库
async function saveChaptersToDB({ docId, openid, chapters, totalChapters }) {
  // 更新文档表中的总章节数
  await db.collection('documents')
    .where({ _id: docId, openid })
    .update({
      data: {
        totalChapters,
        hasChapters: true,
        updateTime: db.serverDate()
      }
    })
  
  // 先删除该文档已有的章节信息（如果有）
  await db.collection('chapters')
    .where({ docId, openid })
    .remove()
  
  // 批量添加章节信息
  if (chapters.length > 0) {
    const batchSize = 50
    for (let i = 0; i < chapters.length; i += batchSize) {
      const batch = db.batch()
      const batchChapters = chapters.slice(i, i + batchSize)
      
      batchChapters.forEach((chapter, index) => {
        batch.add({
          data: {
            docId,
            openid,
            chapterIndex: i + index, // 章节序号
            title: chapter.title,
            start: chapter.start,
            end: chapter.end,
            createTime: db.serverDate()
          }
        })
      })
      
      await batch.commit()
    }
  }
}
