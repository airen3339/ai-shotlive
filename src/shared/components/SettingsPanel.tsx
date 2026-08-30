/**
 * Settings Panel — 模型配置
 *
 * 控制论"开放系统"：用户可在此配置 API 地址和 Token，
 * 选择哪个 provider 负责文本/图像/视频能力。
 */
import { useCallback, useEffect, useState } from 'react'
import {
  X,
  Plus,
  Trash2,
  Settings as SettingsIcon,
  Check,
  AlertCircle,
} from 'lucide-react'
import { providerManager } from '@/providers'
import type { CapabilityRoute, CustomProviderConfig } from '@/providers'

interface Props {
  onClose: () => void
}

type Tab = 'routes' | 'dashscope' | 'volcengine' | 'custom'

export function SettingsPanel({ onClose }: Props) {
  const [activeTab, setActiveTab] = useState<Tab>('routes')
  const [providers, setProviders] = useState<
    Array<{ id: string; name: string; capabilities: string[] }>
  >([])
  const [routes, setRoutes] = useState<CapabilityRoute>({
    textProviderId: 'dashscope',
    imageProviderId: 'volcengine',
    videoProviderId: 'volcengine',
  })
  const [msg, setMsg] = useState<{ type: 'ok' | 'err'; text: string } | null>(null)

  // DashScope form
  const [dashForm, setDashForm] = useState({ apiKey: '', baseUrl: '' })
  // Volcengine form
  const [volcForm, setVolcForm] = useState({ apiKey: '', endpointId: '' })
  // Custom provider form
  const [customForm, setCustomForm] = useState<Partial<CustomProviderConfig>>({
    capabilities: ['text'],
  })
  const [showCustomForm, setShowCustomForm] = useState(false)

  // Load state (App already calls init, but Settings may open before init completes)
  useEffect(() => {
    providerManager.init().then(() => {
      setProviders(providerManager.listProviders())
      setRoutes(providerManager.getRoutes())
    }).catch(err => {
      console.error('[Settings] init failed', err)
      setMsg({ type: 'err', text: `初始化失败: ${err.message}` })
    })
  }, [])

  // Save routes
  const saveRoutes = useCallback(async (r: CapabilityRoute) => {
    try {
      await providerManager.setRoutes(r)
      setRoutes(r)
      setMsg({ type: 'ok', text: '路由已保存' })
    } catch (e) {
      setMsg({
        type: 'err',
        text: e instanceof Error ? e.message : '保存失败',
      })
    }
  }, [])

  // Save built-in provider config
  const saveBuiltIn = useCallback(
    async (providerId: 'dashscope' | 'volcengine', fields: Record<string, string>) => {
      try {
        // 过滤掉空值
        const clean = Object.fromEntries(
          Object.entries(fields).filter(([, v]) => v && !v.startsWith('••••')),
        )
        await providerManager.updateBuiltInConfig(providerId, clean)
        setMsg({ type: 'ok', text: '配置已保存' })
        setProviders(providerManager.listProviders())
      } catch (e) {
        setMsg({
          type: 'err',
          text: e instanceof Error ? e.message : '保存失败',
        })
      }
    },
    [],
  )

  // Add custom provider
  const addCustom = useCallback(async () => {
    if (!customForm.id || !customForm.name || !customForm.baseUrl || !customForm.apiKey) {
      setMsg({ type: 'err', text: '请填写所有必填字段' })
      return
    }
    if (!customForm.capabilities?.length) {
      setMsg({ type: 'err', text: '至少选择一种能力' })
      return
    }
    try {
      await providerManager.addCustomProvider(customForm as CustomProviderConfig)
      setMsg({ type: 'ok', text: `Provider "${customForm.name}" 已添加` })
      setProviders(providerManager.listProviders())
      setCustomForm({ capabilities: ['text'] })
      setShowCustomForm(false)
    } catch (e) {
      setMsg({
        type: 'err',
        text: e instanceof Error ? e.message : '添加失败',
      })
    }
  }, [customForm])

  // Remove custom provider
  const removeCustom = useCallback(async (id: string) => {
    try {
      await providerManager.removeCustomProvider(id)
      setMsg({ type: 'ok', text: '已移除' })
      setProviders(providerManager.listProviders())
      setRoutes(providerManager.getRoutes())
    } catch (e) {
      setMsg({
        type: 'err',
        text: e instanceof Error ? e.message : '移除失败',
      })
    }
  }, [])

  // Auto-clear message
  useEffect(() => {
    if (msg) {
      const t = setTimeout(() => setMsg(null), 3000)
      return () => clearTimeout(t)
    }
  }, [msg])

  // ===== Render =====
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60"
         onClick={onClose}>
      <div className="w-full max-w-2xl max-h-[85vh] overflow-auto surface-raised p-8"
           onClick={(e) => e.stopPropagation()}
           style={{ color: 'var(--color-paper-100)' }}>

        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <SettingsIcon size={20} style={{ color: 'var(--color-amber-leader)' }} />
            <h2 className="text-xl tracking-tight">模型配置</h2>
          </div>
          <button onClick={onClose} className="btn-ghost p-2">
            <X size={16} />
          </button>
        </div>

        {/* Message */}
        {msg && (
          <div className={`mb-4 px-4 py-3 flex items-center gap-2 text-sm ${
            msg.type === 'ok'
              ? 'text-green-400'
              : 'text-red-400'
          }`} style={{ background: 'rgba(128,128,128,0.1)' }}>
            {msg.type === 'ok' ? <Check size={14} /> : <AlertCircle size={14} />}
            {msg.text}
          </div>
        )}

        {/* Tabs */}
        <div className="flex gap-1 mb-6" style={{ borderBottom: '1px solid var(--color-ink-700)' }}>
          {([
            ['routes', '能力路由'],
            ['dashscope', '百炼'],
            ['volcengine', '火山引擎'],
            ['custom', '自定义'],
          ] as [Tab, string][]).map(([tab, label]) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`px-4 py-2 text-sm ${
                activeTab === tab
                  ? 'border-b-2'
                  : 'opacity-50'
              }`}
              style={{
                color: activeTab === tab ? 'var(--color-amber-leader)' : undefined,
                borderColor: activeTab === tab ? 'var(--color-amber-leader)' : 'transparent',
              }}
            >
              {label}
            </button>
          ))}
        </div>

        {/* Tab: Routes */}
        {activeTab === 'routes' && (
          <div className="space-y-6">
            <p className="text-sm" style={{ color: 'var(--color-paper-400)' }}>
              为每种 AI 能力选择使用的 Provider。不同能力可使用不同的 Provider。
            </p>
            <div className="space-y-4">
              <ProviderSelect
                label="文本生成"
                value={routes.textProviderId}
                providers={providers}
                capability="text"
                onChange={(id) => saveRoutes({ ...routes, textProviderId: id })}
              />
              <ProviderSelect
                label="图像生成"
                value={routes.imageProviderId}
                providers={providers}
                capability="image"
                onChange={(id) => saveRoutes({ ...routes, imageProviderId: id })}
              />
              <ProviderSelect
                label="视频生成"
                value={routes.videoProviderId}
                providers={providers}
                capability="video"
                onChange={(id) => saveRoutes({ ...routes, videoProviderId: id })}
              />
            </div>

            {/* Current config summary */}
            <div className="mt-6 p-4" style={{ background: 'rgba(128,128,128,0.05)' }}>
              <div className="text-xs mb-2" style={{ color: 'var(--color-paper-500)' }}>
                当前配置
              </div>
              <div className="grid grid-cols-3 gap-4 text-sm">
                <div>
                  <span style={{ color: 'var(--color-paper-500)' }}>文本：</span>
                  {providers.find(p => p.id === routes.textProviderId)?.name ?? routes.textProviderId}
                </div>
                <div>
                  <span style={{ color: 'var(--color-paper-500)' }}>图像：</span>
                  {providers.find(p => p.id === routes.imageProviderId)?.name ?? routes.imageProviderId}
                </div>
                <div>
                  <span style={{ color: 'var(--color-paper-500)' }}>视频：</span>
                  {providers.find(p => p.id === routes.videoProviderId)?.name ?? routes.videoProviderId}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Tab: DashScope */}
        {activeTab === 'dashscope' && (
          <div className="space-y-4">
            <div>
              <label className="block text-sm mb-1" style={{ color: 'var(--color-paper-400)' }}>
                API Key
              </label>
              <input
                type="password"
                className="w-full px-3 py-2 text-sm"
                style={{ background: 'rgba(128,128,128,0.1)', border: '1px solid var(--color-ink-600)' }}
                value={dashForm.apiKey}
                onChange={(e) => setDashForm(f => ({ ...f, apiKey: e.target.value }))}
                placeholder="输入百炼 API Key"
              />
            </div>
            <div>
              <label className="block text-sm mb-1" style={{ color: 'var(--color-paper-400)' }}>
                API 地址（可选）
              </label>
              <input
                type="text"
                className="w-full px-3 py-2 text-sm"
                style={{ background: 'rgba(128,128,128,0.1)', border: '1px solid var(--color-ink-600)' }}
                value={dashForm.baseUrl}
                onChange={(e) => setDashForm(f => ({ ...f, baseUrl: e.target.value }))}
                placeholder="https://dashscope.aliyuncs.com/compatible-mode/v1"
              />
            </div>
            <button
              className="btn-amber mt-2"
              onClick={() => saveBuiltIn('dashscope', dashForm)}
            >
              保存配置
            </button>
          </div>
        )}

        {/* Tab: Volcengine */}
        {activeTab === 'volcengine' && (
          <div className="space-y-4">
            <div>
              <label className="block text-sm mb-1" style={{ color: 'var(--color-paper-400)' }}>
                API Key
              </label>
              <input
                type="password"
                className="w-full px-3 py-2 text-sm"
                style={{ background: 'rgba(128,128,128,0.1)', border: '1px solid var(--color-ink-600)' }}
                value={volcForm.apiKey}
                onChange={(e) => setVolcForm(f => ({ ...f, apiKey: e.target.value }))}
                placeholder="输入火山引擎 API Key"
              />
            </div>
            <div>
              <label className="block text-sm mb-1" style={{ color: 'var(--color-paper-400)' }}>
                Endpoint ID（可选）
              </label>
              <input
                type="text"
                className="w-full px-3 py-2 text-sm"
                style={{ background: 'rgba(128,128,128,0.1)', border: '1px solid var(--color-ink-600)' }}
                value={volcForm.endpointId}
                onChange={(e) => setVolcForm(f => ({ ...f, endpointId: e.target.value }))}
                placeholder="如使用自定义接入点，填写 Endpoint ID"
              />
            </div>
            <button
              className="btn-amber mt-2"
              onClick={() => saveBuiltIn('volcengine', volcForm)}
            >
              保存配置
            </button>
          </div>
        )}

        {/* Tab: Custom */}
        {activeTab === 'custom' && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <p className="text-sm" style={{ color: 'var(--color-paper-400)' }}>
                添加 OpenAI 兼容的自定义 API 端点
              </p>
              <button
                className="btn-ghost flex items-center gap-1 text-sm"
                onClick={() => setShowCustomForm(!showCustomForm)}
              >
                <Plus size={14} /> 添加
              </button>
            </div>

            {showCustomForm && (
              <div className="p-4 space-y-3" style={{ background: 'rgba(128,128,128,0.05)' }}>
                <div>
                  <label className="block text-xs mb-1" style={{ color: 'var(--color-paper-400)' }}>
                    唯一 ID *
                  </label>
                  <input
                    type="text"
                    className="w-full px-3 py-2 text-sm"
                    style={{ background: 'rgba(128,128,128,0.1)', border: '1px solid var(--color-ink-600)' }}
                    value={customForm.id ?? ''}
                    onChange={(e) => setCustomForm(f => ({ ...f, id: e.target.value.toLowerCase().replace(/[^a-z0-9-_]/g, '') }))}
                    placeholder="my-openai"
                  />
                </div>
                <div>
                  <label className="block text-xs mb-1" style={{ color: 'var(--color-paper-400)' }}>
                    显示名称 *
                  </label>
                  <input
                    type="text"
                    className="w-full px-3 py-2 text-sm"
                    style={{ background: 'rgba(128,128,128,0.1)', border: '1px solid var(--color-ink-600)' }}
                    value={customForm.name ?? ''}
                    onChange={(e) => setCustomForm(f => ({ ...f, name: e.target.value }))}
                    placeholder="我的 OpenAI"
                  />
                </div>
                <div>
                  <label className="block text-xs mb-1" style={{ color: 'var(--color-paper-400)' }}>
                    API 地址 *
                  </label>
                  <input
                    type="text"
                    className="w-full px-3 py-2 text-sm"
                    style={{ background: 'rgba(128,128,128,0.1)', border: '1px solid var(--color-ink-600)' }}
                    value={customForm.baseUrl ?? ''}
                    onChange={(e) => setCustomForm(f => ({ ...f, baseUrl: e.target.value }))}
                    placeholder="https://api.openai.com/v1"
                  />
                </div>
                <div>
                  <label className="block text-xs mb-1" style={{ color: 'var(--color-paper-400)' }}>
                    API Key *
                  </label>
                  <input
                    type="password"
                    className="w-full px-3 py-2 text-sm"
                    style={{ background: 'rgba(128,128,128,0.1)', border: '1px solid var(--color-ink-600)' }}
                    value={customForm.apiKey ?? ''}
                    onChange={(e) => setCustomForm(f => ({ ...f, apiKey: e.target.value }))}
                    placeholder="sk-..."
                  />
                </div>
                <div>
                  <label className="block text-xs mb-1" style={{ color: 'var(--color-paper-400)' }}>
                    支持的能力
                  </label>
                  <div className="flex gap-3">
                    {(['text', 'image', 'video'] as const).map(cap => (
                      <label key={cap} className="flex items-center gap-1 text-sm">
                        <input
                          type="checkbox"
                          checked={customForm.capabilities?.includes(cap) ?? false}
                          onChange={(e) => {
                            const caps = customForm.capabilities ?? []
                            setCustomForm(f => ({
                              ...f,
                              capabilities: e.target.checked
                                ? [...caps, cap]
                                : caps.filter(c => c !== cap),
                            }))
                          }}
                        />
                        {cap === 'text' ? '文本' : cap === 'image' ? '图像' : '视频'}
                      </label>
                    ))}
                  </div>
                </div>
                <div className="flex gap-2 pt-2">
                  <button className="btn-amber text-sm" onClick={addCustom}>
                    确认添加
                  </button>
                  <button className="btn-ghost text-sm" onClick={() => setShowCustomForm(false)}>
                    取消
                  </button>
                </div>
              </div>
            )}

            {/* Existing custom providers */}
            <div className="space-y-2">
              {providers
                .filter(p => !['dashscope', 'volcengine'].includes(p.id))
                .map(p => (
                  <div
                    key={p.id}
                    className="flex items-center justify-between px-4 py-3"
                    style={{ background: 'rgba(128,128,128,0.05)' }}
                  >
                    <div>
                      <div className="text-sm">{p.name}</div>
                      <div className="text-xs" style={{ color: 'var(--color-paper-500)' }}>
                        {p.capabilities.map(c => c === 'text' ? '文本' : c === 'image' ? '图像' : '视频').join(' · ')}
                      </div>
                    </div>
                    <button
                      className="text-red-400 hover:text-red-300"
                      onClick={() => removeCustom(p.id)}
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                ))}
              {providers.filter(p => !['dashscope', 'volcengine'].includes(p.id)).length === 0 && (
                <div className="text-sm text-center py-8" style={{ color: 'var(--color-paper-500)' }}>
                  尚无自定义 Provider
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

// ===== Sub-components =====
function ProviderSelect({
  label,
  value,
  providers,
  capability,
  onChange,
}: {
  label: string
  value: string
  providers: Array<{ id: string; name: string; capabilities: string[] }>
  capability: 'text' | 'image' | 'video'
  onChange: (id: string) => void
}) {
  return (
    <div className="flex items-center gap-4">
      <span className="text-sm min-w-[5rem]" style={{ color: 'var(--color-paper-400)' }}>
        {label}
      </span>
      <select
        className="flex-1 px-3 py-2 text-sm"
        style={{ background: 'rgba(128,128,128,0.1)', border: '1px solid var(--color-ink-600)' }}
        value={value}
        onChange={(e) => onChange(e.target.value)}
      >
        {providers
          .filter(p => p.capabilities.includes(capability))
          .map(p => (
            <option key={p.id} value={p.id}>
              {p.name}
            </option>
          ))}
      </select>
    </div>
  )
}
