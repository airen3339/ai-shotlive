/**
 * AI Engine — 服务端 AI 调用引擎
 *
 * 根据用户配置的 Provider 调用对应的 AI 服务。
 * 所有 AI 调用在服务端执行，客户端只接收结果。
 */

import { getPool, isSqlite } from '../config/database.js';
import { RowDataPacket } from 'mysql2';
import fs from 'fs';
import path from 'path';

// ===== 类型定义 =====
interface AiConfig {
  dashscope: { apiKey: string; baseUrl?: string; textModel?: string; imageModel?: string }
  volcengine: { apiKey: string; endpointId?: string; region?: string; imageModel?: string; videoModel?: string }
  custom: Array<{ id: string; name: string; baseUrl: string; apiKey: string; capabilities: string[] }>
  routes: { textProviderId: string; imageProviderId: string; videoProviderId: string }
}

// ===== 获取用户 AI 配置 =====
export async function getAiConfig(userId: number): Promise<AiConfig | null> {
  const pool = getPool();
  const sql = isSqlite()
    ? "SELECT data FROM model_registry WHERE user_id = ?"
    : "SELECT data FROM model_registry WHERE user_id = ?";

  const [rows] = await pool.execute<RowDataPacket[]>(sql, [userId]);
  if (rows.length === 0 || !rows[0].data) return null;
  try {
    const parsed = JSON.parse(rows[0].data);
    // Normalize: routes might be missing
    if (!parsed.routes) parsed.routes = { textProviderId: 'dashscope', imageProviderId: 'volcengine', videoProviderId: 'volcengine' };
    return parsed;
  } catch {
    return null;
  }
}

// ===== 保存用户 AI 配置 =====
export async function saveAiConfig(userId: number, config: AiConfig): Promise<void> {
  const pool = getPool();
  const data = JSON.stringify(config);
  if (isSqlite()) {
    await pool.execute(
      `INSERT INTO user_preferences (user_id, preference_key, data)
       VALUES (?, 'ai_config', ?)
       ON CONFLICT(user_id, preference_key) DO UPDATE SET data = excluded.data`,
      [userId, data]
    );
  } else {
    await pool.execute(
      `INSERT INTO user_preferences (user_id, preference_key, data)
       VALUES (?, 'ai_config', ?)
       ON DUPLICATE KEY UPDATE data = VALUES(data)`,
      [userId, data]
    );
  }
}

// ===== 工具函数 =====
const sleep = (ms: number) => new Promise(r => setTimeout(r, ms));
const MAX_RETRIES = 3;
const RETRY_BACKOFF_MS = 1000;

async function fetchWithRetry(url: string, init: RequestInit): Promise<Response> {
  let lastErr: unknown;
  for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
    try {
      const res = await fetch(url, init);
      if (res.status >= 500) {
        lastErr = new Error(`服务端错误 (${res.status})`);
        await sleep(RETRY_BACKOFF_MS * Math.pow(2, attempt));
        continue;
      }
      if (!res.ok) {
        const text = await res.text().catch(() => '');
        const code = res.status === 401 ? 'AUTH_INVALID' : res.status === 429 ? 'QUOTA_EXCEEDED' : 'CLIENT_ERROR';
        const err = new Error(`请求失败 (${res.status}): ${text.slice(0, 200)}`);
        (err as any).code = code;
        throw err;
      }
      return res;
    } catch (err: any) {
      if (err.code === 'CLIENT_ERROR' || err.code === 'AUTH_INVALID' || err.code === 'QUOTA_EXCEEDED') throw err;
      lastErr = err;
      if (attempt < MAX_RETRIES - 1) {
        await sleep(RETRY_BACKOFF_MS * Math.pow(2, attempt));
      }
    }
  }
  throw new Error(`网络请求失败: ${lastErr instanceof Error ? lastErr.message : '未知错误'}`);
}

// ===== 文本生成 =====
export async function generateText(
  userId: number,
  prompt: string,
  options?: { systemPrompt?: string; temperature?: number; maxTokens?: number },
): Promise<{ content: string }> {
  const config = await getAiConfig(userId);
  const routes = config?.routes || { textProviderId: 'dashscope' };
  const providerId = routes.textProviderId;

  if (providerId === 'dashscope') {
    const apiKey = config?.dashscope?.apiKey;
    if (!apiKey) throw new Error('请先配置百炼 API Key');
    const baseUrl = config.dashscope.baseUrl || 'https://dashscope.aliyuncs.com/compatible-mode/v1';
    const textModel = config.dashscope.textModel || 'qwen-plus';

    const messages: any[] = [];
    if (options?.systemPrompt) messages.push({ role: 'system', content: options.systemPrompt });
    messages.push({ role: 'user', content: prompt });

    const body = {
      model: textModel,
      messages,
      temperature: options?.temperature ?? 0.7,
      max_tokens: options?.maxTokens ?? 4096,
    };

    const res = await fetchWithRetry(`${baseUrl}/chat/completions`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });

    const data: any = await res.json();
    const content = data?.choices?.[0]?.message?.content;
    if (!content) throw new Error('文本生成返回为空');
    return { content };
  }

  // 自定义 provider (OpenAI 兼容)
  const custom = config?.custom?.find(c => c.id === providerId);
  if (custom && custom.capabilities.includes('text')) {
    const messages: any[] = [];
    if (options?.systemPrompt) messages.push({ role: 'system', content: options.systemPrompt });
    messages.push({ role: 'user', content: prompt });

    const res = await fetchWithRetry(`${custom.baseUrl}/chat/completions`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${custom.apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ model: 'gpt-4o', messages, temperature: options?.temperature ?? 0.7, max_tokens: options?.maxTokens ?? 4096 }),
    });

    const data: any = await res.json();
    const content = data?.choices?.[0]?.message?.content;
    if (!content) throw new Error('文本生成返回为空');
    return { content };
  }

  throw new Error(`文本 Provider "${providerId}" 未配置或不可用`);
}

// ===== 下载远程 URL 到本地文件 =====
async function downloadRemoteFile(remoteUrl: string, localPath: string): Promise<string | null> {
  try {
    const DATA_ROOT = process.env.DATA_DIR || path.resolve(process.cwd(), 'data');
    const absPath = path.resolve(DATA_ROOT, '..', localPath);

    // Ensure directory exists
    fs.mkdirSync(path.dirname(absPath), { recursive: true });

    const res = await fetchWithRetry(remoteUrl, { method: 'GET' });
    const contentType = res.headers.get('content-type') || 'image/png';

    // Remove URL params (signatures etc.)
    const cleanType = contentType.split(';')[0];
    const mimeExtMap: Record<string, string> = {
      'image/png': '.png', 'image/jpeg': '.jpg', 'image/jpg': '.jpg',
      'image/webp': '.webp', 'image/gif': '.gif',
      'video/mp4': '.mp4', 'video/webm': '.webm', 'video/quicktime': '.mov',
    };

    // Determine proper extension
    const ext = mimeExtMap[cleanType] || '.bin';
    const finalPath = absPath.replace(/\.(png|jpg|jpeg|webp|gif|mp4|webm|mov|bin)$/, ext);

    const buffer = Buffer.from(await res.arrayBuffer());
    fs.writeFileSync(finalPath, buffer);

    return localPath.replace(/\.(png|jpg|jpeg|webp|gif|mp4|webm|mov|bin)$/, ext).replace(/\\/g, '/');
  } catch (e) {
    console.error(`  ⚠ 下载远程文件失败: ${remoteUrl}`, (e as Error).message);
    return null;
  }
}

// ===== 图像生成 =====
export async function generateImage(
  userId: number,
  prompt: string,
  options?: { width?: number; height?: number; negativePrompt?: string; projectId?: string; episodeId?: string; entityType?: string; entityId?: string },
): Promise<{ url: string }> {
  const config = await getAiConfig(userId);
  const routes = config?.routes || { imageProviderId: 'volcengine' };
  const providerId = routes.imageProviderId;

  if (providerId === 'volcengine') {
    const apiKey = config?.volcengine?.apiKey;
    if (!apiKey) throw new Error('请先配置火山引擎 API Key');
    const width = options?.width ?? 1920;
    const height = options?.height ?? 1920;
    const imageModel = config.volcengine.imageModel || 'doubao-seedream-4-5-251128';

    // 判断是否为 Ark 平台 key
    const isArkKey = apiKey.startsWith('ark-');

    if (isArkKey) {
      // Ark 平台要求至少 3,686,400 像素（约 1920×1920）
      const MIN_PIXELS = 3686400;
      let finalW = width;
      let finalH = height;
      if (finalW * finalH < MIN_PIXELS) {
        const scale = Math.sqrt(MIN_PIXELS / (finalW * finalH));
        finalW = Math.ceil(finalW * scale);
        finalH = Math.ceil(finalH * scale);
      }

      // Ark 平台 — OpenAI 兼容接口
      const body: any = {
        model: imageModel,
        prompt,
        size: `${finalW}x${finalH}`,
        seed: Math.floor(Math.random() * 2 ** 31),
      };
      if (options?.negativePrompt) body.negative_prompt = options.negativePrompt;

      const url = `https://ark.cn-beijing.volces.com/api/v3/images/generations`;
      const res = await fetchWithRetry(url, {
        method: 'POST',
        headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });

      const data: any = await res.json();
      let imageUrl = data?.data?.[0]?.url;
      if (!imageUrl && data?.data?.[0]?.b64_json) imageUrl = `data:image/png;base64,${data.data[0].b64_json}`;
      if (!imageUrl) throw new Error('图像生成返回格式异常: ' + JSON.stringify(data).slice(0, 300));

      // 如果是远程 URL 且提供了项目上下文，下载到本地
      if (imageUrl.startsWith('http') && options?.projectId && options?.episodeId && options?.entityType && options?.entityId) {
        const relPath = `data/${options.projectId}/${options.episodeId}/${options.entityType}/${options.entityId}.png`;
        const localPath = await downloadRemoteFile(imageUrl, relPath);
        if (localPath) return { url: localPath };
        // 下载失败，回退到远程 URL
      }

      return { url: imageUrl };
    }

    // 火山引擎视觉开放平台（旧版）
    const body: any = {
      req_key: 'img2img_seedream',
      prompt,
      width, height,
      model_version: imageModel,
      seed: Math.floor(Math.random() * 2 ** 31),
    };
    if (options?.negativePrompt) body.negative_prompt = options.negativePrompt;

    const url = `https://visual.volcengineapi.com/?Action=CVProcess&Version=2022-08-31`;
    const res = await fetchWithRetry(url, {
      method: 'POST',
      headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });

    const data: any = await res.json();
    if (data?.data?.image_urls?.[0]) {
      return { url: data.data.image_urls[0] };
    }
    if (data?.data?.binary_data_base64?.[0]) {
      return { url: `data:image/png;base64,${data.data.binary_data_base64[0]}` };
    }
    throw new Error('图像生成返回格式异常');
  }

  if (providerId === 'dashscope') {
    const apiKey = config?.dashscope?.apiKey;
    if (!apiKey) throw new Error('请先配置百炼 API Key');
    const baseUrl = config.dashscope.baseUrl || 'https://dashscope.aliyuncs.com/compatible-mode/v1';
    const width = options?.width ?? 1024;
    const height = options?.height ?? 1024;

    const body = {
      model: 'wanx2.1-t2i-turbo',
      prompt,
      n: 1,
      size: `${width}x${height}`,
    };

    const res = await fetchWithRetry(`${baseUrl}/images/generations`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json', 'X-DashScope-Async': 'enable' },
      body: JSON.stringify(body),
    });

    const data: any = await res.json();
    if (data?.data?.[0]?.url) return { url: data.data[0].url };

    // 异步任务
    const taskId = data?.output?.task_id;
    if (taskId) {
      return await pollDashScopeImageTask(taskId, apiKey);
    }
    throw new Error('图像任务提交失败');
  }

  // 自定义 provider
  const custom = config?.custom?.find(c => c.id === providerId);
  if (custom && custom.capabilities.includes('image')) {
    const res = await fetchWithRetry(`${custom.baseUrl}/images/generations`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${custom.apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ model: 'dall-e-3', prompt, n: 1, size: `${options?.width ?? 1024}x${options?.height ?? 1024}` }),
    });
    const data: any = await res.json();
    if (data?.data?.[0]?.url) return { url: data.data[0].url };
    if (data?.data?.[0]?.b64_json) return { url: `data:image/png;base64,${data.data[0].b64_json}` };
    throw new Error('图像生成返回格式异常');
  }

  throw new Error(`图像 Provider "${providerId}" 未配置或不可用`);
}

async function pollDashScopeImageTask(taskId: string, apiKey: string): Promise<{ url: string }> {
  const NATIVE_BASE = 'https://dashscope.aliyuncs.com/api/v1';
  const POLL_INTERVAL = 3000;
  const MAX_WAIT = 10 * 60 * 1000;
  const start = Date.now();
  while (Date.now() - start < MAX_WAIT) {
    const res = await fetchWithRetry(`${NATIVE_BASE}/tasks/${taskId}`, {
      method: 'GET',
      headers: { Authorization: `Bearer ${apiKey}` },
    });
    const data: any = await res.json();
    const status = data?.output?.task_status;
    if (status === 'SUCCEEDED') {
      const url = data?.output?.results?.[0]?.url || data?.output?.video_url || data?.data?.[0]?.url;
      if (!url) throw new Error('任务完成但未返回 URL');
      return { url };
    }
    if (status === 'FAILED') throw new Error(`图像任务失败: ${data?.output?.message ?? '未知错误'}`);
    await sleep(POLL_INTERVAL);
  }
  throw new Error('图像任务超时');
}

// ===== 视频生成（异步任务） =====
export async function submitVideoTask(
  userId: number,
  prompt: string,
  options?: { imageUrl?: string; endImageUrl?: string; duration?: number; aspectRatio?: string; projectId?: string; episodeId?: string },
): Promise<string> {
  const config = await getAiConfig(userId);
  const routes = config?.routes || { videoProviderId: 'volcengine' };
  const providerId = routes.videoProviderId;

  // 创建任务记录
  const pool = getPool();
  const taskId = `video_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;

  if (isSqlite()) {
    await pool.execute(
      `INSERT INTO generation_tasks (id, user_id, project_id, type, status, params, created_at)
       VALUES (?, ?, '', 'video', 'pending', ?, datetime('now'))`,
      [taskId, userId, JSON.stringify({ prompt, imageUrl: options?.imageUrl, endImageUrl: options?.endImageUrl, duration: options?.duration, aspectRatio: options?.aspectRatio, projectId: options?.projectId, episodeId: options?.episodeId })]
    );
  } else {
    await pool.execute(
      `INSERT INTO generation_tasks (id, user_id, project_id, type, status, params, created_at)
       VALUES (?, ?, '', 'video', 'pending', ?, NOW())`,
      [taskId, userId, JSON.stringify({ prompt, imageUrl: options?.imageUrl, endImageUrl: options?.endImageUrl, duration: options?.duration, aspectRatio: options?.aspectRatio, projectId: options?.projectId, episodeId: options?.episodeId })]
    );
  }

  if (providerId === 'volcengine') {
    const apiKey = config?.volcengine?.apiKey;
    if (!apiKey) {
      await updateTaskStatus(userId, taskId, 'failed', null, '未配置火山引擎 API Key');
      throw new Error('未配置火山引擎 API Key');
    }
    const videoModel = config.volcengine.videoModel || 'doubao-seedance-1-5-pro-251215';

    // Seedance 视频生成 — 使用内容生成任务端点
    // POST /api/v3/contents/generations/tasks
    const body: any = {
      model: videoModel,
      content: [
        {
          type: 'text',
          text: prompt,
        },
      ],
      duration: options?.duration ?? 5,
    };
    if (options?.imageUrl) {
      body.content.push({
        type: 'image_url',
        image_url: { url: options.imageUrl },
      });
    }
    if (options?.endImageUrl) {
      body.content.push({
        type: 'image_url',
        image_url: { url: options.endImageUrl },
      });
    }
    if (options?.aspectRatio) body.ratio = options.aspectRatio;

    const ARK_BASE = 'https://ark.cn-beijing.volces.com/api/v3';
    const res = await fetchWithRetry(`${ARK_BASE}/contents/generations/tasks`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });

    const data: any = await res.json();
    const externalTaskId = data?.id || data?.output?.task_id;
    if (!externalTaskId) {
      await updateTaskStatus(userId, taskId, 'failed', null, `提交失败: ${data?.error?.message ?? '未返回任务ID'}`);
      throw new Error('提交视频任务失败');
    }

    // 保存外部任务 ID（数据库列为 provider_task_id）
    await pool.execute(
      isSqlite()
        ? `UPDATE generation_tasks SET provider_task_id = ? WHERE id = ?`
        : `UPDATE generation_tasks SET provider_task_id = ? WHERE id = ?`,
      [externalTaskId, taskId]
    );

    await updateTaskStatus(userId, taskId, 'pending', null, null);
    return taskId;
  }

  await updateTaskStatus(userId, taskId, 'failed', null, `视频 Provider "${providerId}" 未配置`);
  throw new Error(`视频 Provider "${providerId}" 未配置或不可用`);
}

// ===== 更新任务状态 =====
async function updateTaskStatus(
  userId: number,
  taskId: string,
  status: string,
  resultUrl: string | null,
  error: string | null,
): Promise<void> {
  const pool = getPool();
  if (isSqlite()) {
    await pool.execute(
      `UPDATE generation_tasks SET status = ?, result = ?, error = ?, updated_at = datetime('now') WHERE id = ?`,
      [status, resultUrl, error, taskId]
    );
  } else {
    await pool.execute(
      `UPDATE generation_tasks SET status = ?, result = ?, error = ?, updated_at = NOW() WHERE id = ?`,
      [status, resultUrl, error, taskId]
    );
  }
}

// ===== 查询任务状态 =====
export async function checkVideoStatus(userId: number, taskId: string): Promise<{
  taskId: string; status: string; progress?: number; resultUrl?: string; error?: string;
}> {
  const pool = getPool();
  const [rows] = await pool.execute<RowDataPacket[]>(
    `SELECT status, result, error, provider_task_id FROM generation_tasks WHERE id = ? AND user_id = ?`,
    [taskId, userId]
  );

  if (rows.length === 0) throw new Error('任务不存在');

  const row = rows[0];
  const status = row.status as string;

  if (status === 'completed' || status === 'failed') {
    return {
      taskId, status, progress: status === 'completed' ? 100 : 0,
      resultUrl: row.result || undefined, error: row.error || undefined,
    };
  }

  // 如果正在处理且有外部任务 ID，轮询外部服务
  if (status === 'pending' || status === 'processing') {
    const externalId = row.provider_task_id as string;
    if (externalId) {
      const config = await getAiConfig(userId);
      const apiKey = config?.volcengine?.apiKey;
      if (apiKey) {
        const ARK_BASE = 'https://ark.cn-beijing.volces.com/api/v3';
        try {
          const res = await fetchWithRetry(`${ARK_BASE}/contents/generations/tasks/${externalId}`, {
            method: 'GET',
            headers: { Authorization: `Bearer ${apiKey}` },
          });
          const data: any = await res.json();
          // Ark contents/generations/tasks 响应格式: { id, status, content: { video_url } }
          const raw = data?.status;

          let newStatus: string;
          if (raw === 'succeeded' || raw === 'completed' || raw === 'success') newStatus = 'completed';
          else if (raw === 'failed' || raw === 'cancelled') newStatus = 'failed';
          else if (raw === 'running' || raw === 'processing') newStatus = 'processing';
          else newStatus = 'pending';

          if (newStatus === 'completed') {
            let resultUrl = data?.content?.video_url || data?.video_url;
            // 下载视频到本地
            if (resultUrl && resultUrl.startsWith('http')) {
              const [rows2] = await pool.execute<RowDataPacket[]>(
                `SELECT params FROM generation_tasks WHERE id = ?`,
                [taskId]
              );
              let projectId = '';
              let episodeId = '';
              try {
                const params = JSON.parse(rows2[0]?.params || '{}');
                projectId = params.projectId || '';
                episodeId = params.episodeId || 'default';
              } catch {}
              const relPath = `data/${projectId || 'default'}/${episodeId}/video/${taskId}.mp4`;
              const localPath = await downloadRemoteFile(resultUrl, relPath);
              if (localPath) {
                resultUrl = localPath;
                console.log(`  ✅ 视频已下载到本地: ${localPath}`);
              } else {
                console.log(`  ⚠ 视频下载失败，使用远程 URL`);
              }
            }
            await updateTaskStatus(userId, taskId, newStatus, resultUrl, null);
            return { taskId, status: newStatus, resultUrl };
          }

          if (newStatus === 'failed') {
            const errMsg = data?.error?.message || data?.status_message || '视频生成失败';
            await updateTaskStatus(userId, taskId, newStatus, null, errMsg);
            return { taskId, status: newStatus, error: errMsg };
          }

          // 更新进度/状态但不改变结果
          await pool.execute(
            isSqlite()
              ? `UPDATE generation_tasks SET status = ?, updated_at = datetime('now') WHERE id = ?`
              : `UPDATE generation_tasks SET status = ?, updated_at = NOW() WHERE id = ?`,
            [newStatus, taskId]
          );
          return { taskId, status: newStatus };
        } catch {
          // 轮询失败，不改变数据库状态
        }
      }
    }
    return { taskId, status, progress: status === 'processing' ? 50 : 0 };
  }

  return { taskId, status, progress: 0 };
}
