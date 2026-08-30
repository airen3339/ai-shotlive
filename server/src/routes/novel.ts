/**
 * 小说与剧本管理路由
 *
 * POST /api/novel/upload    — 上传 .txt 文件并解析
 * POST /api/novel/parse     — 解析已存在的文件路径
 * POST /api/novel/generate  — 基于章节生成剧本（AI）
 * GET  /api/novel/chapters/:projectId — 获取项目的章节列表
 */
import { Router, Response } from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { authMiddleware, AuthRequest } from '../middleware/auth.js';
import { getPool, isSqlite } from '../config/database.js';
import { RowDataPacket } from 'mysql2';
import { parseNovelFile, mergeChapters, describeChapterRange, type NovelChapter } from '../services/novelParser.js';
import { generateText } from '../services/aiEngine.js';

const router = Router();
router.use(authMiddleware);

// ===== 文件上传配置 =====
const UPLOADS_DIR = process.env.UPLOADS_DIR || path.resolve(process.cwd(), 'data', 'uploads');
fs.mkdirSync(UPLOADS_DIR, { recursive: true });

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, UPLOADS_DIR),
  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname);
    cb(null, `novel_${Date.now()}_${Math.random().toString(36).slice(2, 8)}${ext}`);
  },
});

const upload = multer({
  storage,
  fileFilter: (_req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    if (ext === '.txt') {
      cb(null, true);
    } else {
      cb(new Error('仅支持 .txt 文件'));
    }
  },
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB
});

// ===== POST /api/novel/upload — 上传小说并解析 =====
router.post('/upload', upload.single('file'), (req: AuthRequest, res: Response) => {
  try {
    if (!req.file) { res.status(400).json({ error: '请上传 .txt 文件' }); return; }

    const filePath = req.file.path;
    const result = parseNovelFile(filePath);

    res.json({
      filename: req.file.originalname,
      filePath: req.file.filename,
      ...result,
    });
  } catch (err: any) {
    console.error('小说解析失败:', err.message);
    res.status(500).json({ error: err.message || '小说解析失败' });
  }
});

// ===== POST /api/novel/parse — 解析已上传的文件 =====
router.post('/parse', (req: AuthRequest, res: Response) => {
  try {
    const { filePath } = req.body;
    if (!filePath) { res.status(400).json({ error: '缺少 filePath' }); return; }

    const absPath = path.resolve(UPLOADS_DIR, filePath);
    if (!fs.existsSync(absPath)) { res.status(404).json({ error: '文件不存在' }); return; }

    const result = parseNovelFile(absPath);
    res.json(result);
  } catch (err: any) {
    console.error('小说解析失败:', err.message);
    res.status(500).json({ error: err.message || '小说解析失败' });
  }
});

// ===== POST /api/novel/generate — 基于章节生成剧本 =====
router.post('/generate', async (req: AuthRequest, res: Response) => {
  try {
    const { filePath, chapterIndices, language, style, episodeTitle } = req.body;
    if (!filePath) { res.status(400).json({ error: '缺少 filePath' }); return; }

    const absPath = path.resolve(UPLOADS_DIR, filePath);
    if (!fs.existsSync(absPath)) { res.status(404).json({ error: '文件不存在' }); return; }

    const parsed = parseNovelFile(absPath);

    // 选择指定章节
    let selectedChapters: NovelChapter[];
    if (chapterIndices && Array.isArray(chapterIndices) && chapterIndices.length > 0) {
      selectedChapters = chapterIndices.map((i: number) => parsed.chapters[i]);
    } else {
      selectedChapters = parsed.chapters;
    }

    // 合并内容并限制长度
    const merged = mergeChapters(selectedChapters, 16000);
    const range = describeChapterRange(selectedChapters);

    // 构建系统提示
    const systemPrompt = `你是一位资深的影视编剧，擅长将小说改编为视觉剧本。

请将以下${range}的小说内容改编为一个结构化的剧本。

要求输出严格 JSON 格式（不要加 markdown 标记）：
{
  "title": "剧本标题",
  "genre": "类型（如 都市/玄幻/悬疑）",
  "logline": "一句话梗概，不超过50字",
  "scenes": [
    {
      "id": "scene_1",
      "title": "场景标题",
      "description": "场景环境与氛围描述（30-60字）",
      "characters": ["角色1", "角色2"],
      "shots": [
        {
          "id": "shot_1_1",
          "description": "具体的镜头画面描述（含动作、表情、构图）",
          "cameraAngle": "镜头角度（中景/特写/全景/鸟瞰等）",
          "duration": 3
        }
      ]
    }
  ],
  "characters": [
    {
      "id": "char_1",
      "name": "角色名",
      "description": "角色性格与背景",
      "appearance": "角色外貌特征（用于AI生成图像）"
    }
  ]
}

要求：
1. 场景 3-8 个，每个包含 2-5 个镜头
2. 角色 2-6 个，appearance 描述详细（发型/服装/体型/标志性特征）
3. 语言：${language || '中文'}，视觉风格：${style || '电影写实'}`;

    const userPrompt = `请将以下小说内容改编为剧本：\n\n${merged}`;

    const result = await generateText(req.userId!, userPrompt, {
      systemPrompt,
      temperature: 0.7,
      maxTokens: 8192,
    });

    // 解析 JSON
    let parsedJson: any;
    try {
      let text = result.content.trim();
      const fenceMatch = text.match(/```(?:json)?\s*([\s\S]*?)```/i);
      if (fenceMatch) text = fenceMatch[1].trim();
      const start = text.indexOf('{');
      const end = text.lastIndexOf('}');
      if (start >= 0 && end > start) text = text.slice(start, end + 1);
      parsedJson = JSON.parse(text);
    } catch {
      parsedJson = { raw: result.content };
    }

    res.json({
      range,
      episodeTitle: episodeTitle || range,
      script: parsedJson,
      rawContent: result.content,
    });
  } catch (err: any) {
    console.error('剧本生成失败:', err.message);
    res.status(500).json({ error: err.message || '剧本生成失败' });
  }
});

export default router;
