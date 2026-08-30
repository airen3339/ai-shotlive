/**
 * 小说解析器 — 上传 .txt 文件，自动识别卷/章结构
 *
 * 能力：
 *  - 正则识别"第X章/卷"格式（支持中文数字 + 阿拉伯数字）
 *  - 章节标题提取与内容切分
 *  - 字数统计与章节范围描述
 *  - 输出结构化章节列表
 */
import fs from 'fs';
import path from 'path';

// ===== 中文数字映射 =====
const CN_NUM_MAP: Record<string, number> = {
  零: 0, 一: 1, 二: 2, 三: 3, 四: 4, 五: 5,
  六: 6, 七: 7, 八: 8, 九: 9, 十: 10,
  百: 100, 千: 1000, 万: 10000,
};

function cnToArabic(cn: string): number | null {
  if (!cn) return null;
  const num = parseInt(cn, 10);
  if (!isNaN(num)) return num;

  // 尝试映射中文数字
  let result = 0;
  let temp = 0;
  for (const ch of cn) {
    const val = CN_NUM_MAP[ch];
    if (val === undefined) return null;
    if (val >= 10) {
      temp = (temp || 1) * val;
      result += temp;
      temp = 0;
    } else {
      temp = val;
    }
  }
  result += temp;
  return result || null;
}

export interface NovelChapter {
  chapterNumber: number;
  title: string;
  content: string;
  wordCount: number;
  startLine: number;
  endLine: number;
}

export interface NovelParseResult {
  title: string;
  totalWords: number;
  chapters: NovelChapter[];
  parseErrors: string[];
}

// ===== 章节识别正则 =====
// 匹配："第X章 ..."、"第X卷 ..."、"Chapter X ..."
const CHAPTER_REGEX = /^第\s*([零一二三四五六七八九十百千万\d]+)\s*[章节卷][\s：:]+(.*)/;
const CHAPTER_REGEX_NUMBERED = /^(?:Chapter\s+)?(\d+)[\.\s、：:]+\s*(.*)/i;

/**
 * 解析小说文件，返回结构化章节列表
 */
export function parseNovelFile(filePath: string): NovelParseResult {
  const content = fs.readFileSync(filePath, 'utf-8');
  return parseNovelText(content);
}

/**
 * 解析小说文本，返回结构化章节列表
 */
export function parseNovelText(text: string): NovelParseResult {
  const lines = text.split(/\r?\n/);
  const chapters: NovelChapter[] = [];
  const parseErrors: string[] = [];

  let currentChapter: {
    chapterNumber: number;
    title: string;
    contentLines: string[];
    startLine: number;
  } | null = null;

  let titleLines: string[] = [];
  let foundFirstChapter = false;
  let chapterNumber = 0;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();

    // 尝试匹配章节标题
    let match = line.match(CHAPTER_REGEX);
    let title = '';
    let chapNum: number | null = null;

    if (match) {
      chapNum = cnToArabic(match[1]);
      title = match[2]?.trim() || '';
    } else {
      match = line.match(CHAPTER_REGEX_NUMBERED);
      if (match) {
        chapNum = parseInt(match[1], 10);
        title = match[2]?.trim() || '';
      }
    }

    if (chapNum !== null && (line.length < 80 || title)) {
      // 找到章节标题
      foundFirstChapter = true;

      // 保存上一个章节
      if (currentChapter) {
        const chapterContent = currentChapter.contentLines.join('\n');
        chapters.push({
          chapterNumber: currentChapter.chapterNumber,
          title: currentChapter.title,
          content: chapterContent,
          wordCount: countChineseWords(chapterContent),
          startLine: currentChapter.startLine,
          endLine: i - 1,
        });
      }

      chapterNumber++;
      currentChapter = {
        chapterNumber: chapterNumber,
        title: title || `Chapter ${chapterNumber}`,
        contentLines: [],
        startLine: i,
      };
    } else if (foundFirstChapter && currentChapter) {
      currentChapter.contentLines.push(lines[i]);
    } else if (!foundFirstChapter) {
      titleLines.push(line);
    }
  }

  // 保存最后一个章节
  if (currentChapter) {
    const chapterContent = currentChapter.contentLines.join('\n');
    chapters.push({
      chapterNumber: currentChapter.chapterNumber,
      title: currentChapter.title,
      content: chapterContent,
      wordCount: countChineseWords(chapterContent),
      startLine: currentChapter.startLine,
      endLine: lines.length - 1,
    });
  }

  const bookTitle = titleLines.find(l => l.length > 0) || '未命名小说';
  const totalWords = chapters.reduce((sum, c) => sum + c.wordCount, 0);

  return { title: bookTitle, totalWords, chapters, parseErrors };
}

/**
 * 统计中文字符数 + 英文单词数
 */
function countChineseWords(text: string): number {
  const chineseChars = (text.match(/[\u4e00-\u9fff]/g) || []).length;
  const englishWords = (text.match(/[a-zA-Z]+/g) || []).length;
  return chineseChars + englishWords;
}

/**
 * 生成章节范围描述（如 "第1章 ~ 第5章，共 12,345 字"）
 */
export function describeChapterRange(chapters: NovelChapter[]): string {
  if (chapters.length === 0) return '';
  const first = chapters[0].chapterNumber;
  const last = chapters[chapters.length - 1].chapterNumber;
  const total = chapters.reduce((sum, c) => sum + c.wordCount, 0);
  if (chapters.length === 1) {
    return `第${first}章 · ${total.toLocaleString()} 字`;
  }
  return `第${first}章 ~ 第${last}章 · 共 ${total.toLocaleString()} 字`;
}

/**
 * 截取章节内容的前 N 个字符作为预览
 */
export function previewChapter(chapter: NovelChapter, maxLen: number = 200): string {
  if (chapter.content.length <= maxLen) return chapter.content;
  return chapter.content.slice(0, maxLen) + '…';
}

/**
 * 合并多个章节的文本内容（用于生成剧本）
 */
export function mergeChapters(chapters: NovelChapter[], maxChars?: number): string {
  let merged = chapters.map((c, i) =>
    `【第${c.chapterNumber}章 ${c.title}】\n\n${c.content}`
  ).join('\n\n---\n\n');

  if (maxChars && merged.length > maxChars) {
    merged = merged.slice(0, maxChars) + '\n\n[内容已截断，仅保留前 '
      + maxChars + ' 字符]';
  }
  return merged;
}
