/**
 * AI 代理服务路由
 *
 * 客户端只负责渲染，所有 AI 调用由服务端发起：
 *   - POST /api/ai/chat    → 文本生成
 *   - POST /api/ai/image   → 图像生成
 *   - POST /api/ai/video   → 视频生成（异步任务）
 *   - GET  /api/ai/status/:taskId → 查询任务状态
 */

import { Router, Response } from 'express';
import { getPool } from '../config/database.js';
import { authMiddleware, AuthRequest } from '../middleware/auth.js';
import { RowDataPacket } from 'mysql2';
import {
  generateText,
  generateImage,
  submitVideoTask,
  checkVideoStatus,
} from '../services/aiEngine.js';

const router = Router();
router.use(authMiddleware);

// ===== 文本生成（同步） =====
router.post('/chat', async (req: AuthRequest, res: Response) => {
  try {
    const { prompt, systemPrompt, temperature, maxTokens } = req.body;
    if (!prompt) { res.status(400).json({ error: '缺少 prompt' }); return; }
    const result = await generateText(req.userId!, prompt, { systemPrompt, temperature, maxTokens });
    res.json(result);
  } catch (err: any) {
    console.error('AI chat failed:', err.message);
    res.status(500).json({ error: err.message || '文本生成失败' });
  }
});

// ===== 图像生成（同步） =====
router.post('/image', async (req: AuthRequest, res: Response) => {
  try {
    const { prompt, width, height, negativePrompt, projectId, episodeId, entityType, entityId } = req.body;
    if (!prompt) { res.status(400).json({ error: '缺少 prompt' }); return; }
    const result = await generateImage(req.userId!, prompt, {
      width, height, negativePrompt,
      projectId, episodeId, entityType, entityId,
    });
    res.json(result);
  } catch (err: any) {
    console.error('AI image failed:', err.message);
    res.status(500).json({ error: err.message || '图像生成失败' });
  }
});

// ===== 视频生成（异步任务） =====
router.post('/video', async (req: AuthRequest, res: Response) => {
  try {
    const { prompt, imageUrl, endImageUrl, duration, aspectRatio, projectId, episodeId } = req.body;
    if (!prompt) { res.status(400).json({ error: '缺少 prompt' }); return; }

    const taskId = await submitVideoTask(req.userId!, prompt, {
      imageUrl, endImageUrl, duration, aspectRatio, projectId, episodeId,
    });
    res.json({ taskId, status: 'pending' });
  } catch (err: any) {
    console.error('AI video failed:', err.message);
    res.status(500).json({ error: err.message || '视频生成失败' });
  }
});

// ===== 查询任务状态 =====
router.get('/status/:taskId', async (req: AuthRequest, res: Response) => {
  try {
    const status = await checkVideoStatus(req.userId!, req.params.taskId as string);
    res.json(status);
  } catch (err: any) {
    console.error('AI status check failed:', err.message);
    res.status(500).json({ error: err.message || '查询任务状态失败' });
  }
});

export default router;
