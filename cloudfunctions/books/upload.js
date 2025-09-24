// 书籍上传云函数：处理书籍上传、格式解析和元数据存储
const DocOperations = require("./docOperations");
const ReadingRecordOperations = require("./readingRecordOperations");
const fs = require("fs");
const path = require("path");

async function Upload(event, context) {
  try {
    const { openid, fileName, fileSize, fileType, fileUrl } = event;
    console.log(event);

    // ADD 书籍 to DB
    const docResult = await DocOperations.addDoc({
      openid,
      title: fileName,
      type: fileType,
      size: fileSize,
      fileUrl: fileUrl,
    });
    const docId = docResult.data.docId;

    await ReadingRecordOperations.addRecord({
      openid,
      docId,
      readPage: 1,
    });

    //  自动分章节处理（上传后异步处理，不阻塞主流程）

    await processChapters({
      docId,
      openid,
      content: textContent,
      type: fileType,
      totalPages,
      pageSize,
    });

    // 7. 返回上传结果
    return {
      code: 200,
      data: {
        docId,
        fileUrl: uploadResult.fileID,
        title: getTitleFromFileName(fileName),
        totalPages,
      },
      message: "文档上传成功，正在处理章节...",
      success: true,
    };
    return docResult;
  } catch (err) {
    console.error("上传失败:", err);
    return {
      code: 500,
      message: "服务器错误: upload",
      success: false,
    };
  }
}

// 辅助函数：检测并转换TXT编码
function detectAndConvertEncoding(buffer) {
  // 尝试常见编码
  const encodings = ["utf8", "gbk", "gb2312", "big5"];

  for (const encoding of encodings) {
    try {
      const decoded = iconv.decode(buffer, encoding);
      // 简单验证：如果包含大量乱码字符（�）则认为解码失败
      if (decoded.indexOf("�") < 0) {
        return decoded;
      }
    } catch (e) {
      // 解码失败，尝试下一种编码
      continue;
    }
  }

  // 所有编码都尝试失败，返回默认UTF8解码
  return iconv.decode(buffer, "utf8");
}

// 辅助函数：解析EPUB文件（简化版）
async function parseEpubFile(buffer) {
  // 实际项目中应使用epub解析库如epub2
  // 这里简化处理，仅返回文本内容
  return {
    fullText: buffer.toString("utf8").replace(/<[^>]+>/g, ""), // 简单去除HTML标签
    chapters: [], // 实际实现中应解析出章节结构
  };
}

// 辅助函数：解析PDF文件
async function parsePdfFile(buffer, openid) {
  // 调用OCR云函数处理PDF
  const ocrResult = await cloud.callFunction({
    name: "pdfOcrParse",
    data: {
      buffer: buffer.toString("base64"),
      openid,
    },
  });

  return {
    text: ocrResult.result.data.text || "",
  };
}

module.exports = Upload;
