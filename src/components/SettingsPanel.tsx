/**
 * SettingsPanel — 模型配置（服务端存储）
 */
import { useCallback, useEffect, useState } from 'react'
import { X, Plus, Trash2, Settings as SettingsIcon, Check, AlertCircle } from 'lucide-react'
import { providerManager } from '@/providers'
import { aiConfig, type AiConfig } from '@/api/client'

interface Props { onClose: () => void }
type Tab = 'routes' | 'dashscope' | 'volcengine' | 'custom'

export function SettingsPanel({ onClose }: Props) {
  const [activeTab, setActiveTab] = useState<Tab>('routes')
  const [config, setConfig] = useState<AiConfig | null>(null)
  const [msg, setMsg] = useState<{ type: 'ok' | 'err'; text: string } | null>(null)
  const [dashForm, setDashForm] = useState({ apiKey: '', baseUrl: '', textModel: '', imageModel: '' })
  const [volcForm, setVolcForm] = useState({ apiKey: '', endpointId: '', imageModel: '', videoModel: '' })
  const [customForm, setCustomForm] = useState<Partial<AiConfig['custom'][0]>>({ capabilities: ['text'] })
  const [showCustomForm, setShowCustomForm] = useState(false)

  useEffect(() => {
    providerManager.init().then(() => {
      const cfg = providerManager.getConfig()
      setConfig(cfg)
      setDashForm({ apiKey: '', baseUrl: cfg.dashscope?.baseUrl || '', textModel: cfg.dashscope?.textModel || '', imageModel: cfg.dashscope?.imageModel || '' })
      setVolcForm({ apiKey: '', endpointId: cfg.volcengine?.endpointId || '', imageModel: cfg.volcengine?.imageModel || '', videoModel: cfg.volcengine?.videoModel || '' })
    }).catch(() => {})
  }, [])

  useEffect(() => { if (msg) { const t = setTimeout(() => setMsg(null), 3000); return () => clearTimeout(t) } }, [msg])

  const saveConfig = useCallback(async (updates: Partial<AiConfig>) => {
    try {
      const current = providerManager.getConfig()
      await providerManager.saveConfig({ ...current, ...updates })
      setConfig(providerManager.getConfig())
      setMsg({ type: 'ok', text: '已保存' })
    } catch (e) { setMsg({ type: 'err', text: e instanceof Error ? e.message : '保存失败' }) }
  }, [])

  const saveDash = useCallback(async () => {
    if (!config) return
    const clean: Record<string, string> = {}
    if (dashForm.baseUrl) clean.baseUrl = dashForm.baseUrl
    if (dashForm.apiKey && !dashForm.apiKey.startsWith('••••')) clean.apiKey = dashForm.apiKey
    if (dashForm.textModel) clean.textModel = dashForm.textModel
    if (dashForm.imageModel) clean.imageModel = dashForm.imageModel
    if (Object.keys(clean).length === 0) return
    await providerManager.updateBuiltInConfig('dashscope', clean)
    setConfig(providerManager.getConfig())
    setMsg({ type: 'ok', text: '已保存' })
  }, [config, dashForm])

  const saveVolc = useCallback(async () => {
    if (!config) return
    const clean: Record<string, string> = {}
    if (volcForm.endpointId) clean.endpointId = volcForm.endpointId
    if (volcForm.apiKey && !volcForm.apiKey.startsWith('••••')) clean.apiKey = volcForm.apiKey
    if (volcForm.imageModel) clean.imageModel = volcForm.imageModel
    if (volcForm.videoModel) clean.videoModel = volcForm.videoModel
    if (Object.keys(clean).length === 0) return
    await providerManager.updateBuiltInConfig('volcengine', clean)
    setConfig(providerManager.getConfig())
    setMsg({ type: 'ok', text: '已保存' })
  }, [config, volcForm])

  const addCustom = useCallback(async () => {
    if (!customForm.id || !customForm.name || !customForm.baseUrl || !customForm.apiKey || !customForm.capabilities?.length) {
      setMsg({ type: 'err', text: '请填写所有必填字段' }); return
    }
    await providerManager.addCustomProvider(customForm as any)
    setCustomForm({ capabilities: ['text'] })
    setShowCustomForm(false)
    setConfig(providerManager.getConfig())
    setMsg({ type: 'ok', text: '已添加' })
  }, [customForm])

  const removeCustom = useCallback(async (id: string) => {
    await providerManager.removeCustomProvider(id)
    setConfig(providerManager.getConfig())
    setMsg({ type: 'ok', text: '已移除' })
  }, [])

  const providers = providerManager.listProviders()

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60" onClick={onClose}>
      <div className="w-full max-w-2xl max-h-[85vh] overflow-auto surface-raised p-8" onClick={e => e.stopPropagation()} style={{ color: 'var(--color-paper-100)' }}>
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3"><SettingsIcon size={20} style={{ color: 'var(--color-amber-leader)' }} /><h2 className="text-xl tracking-tight">模型配置（服务端）</h2></div>
          <button onClick={onClose} className="btn-ghost p-2"><X size={16} /></button>
        </div>
        {msg && <div className={`mb-4 px-4 py-3 flex items-center gap-2 text-sm ${msg.type === 'ok' ? 'text-green-400' : 'text-red-400'}`} style={{ background: 'rgba(128,128,128,0.1)' }}>{msg.type === 'ok' ? <Check size={14} /> : <AlertCircle size={14} />}{msg.text}</div>}
        <div className="flex gap-1 mb-6" style={{ borderBottom: '1px solid var(--color-ink-700)' }}>
          {([['routes','能力路由'],['dashscope','百炼'],['volcengine','火山引擎'],['custom','自定义']] as [Tab,string][]).map(([t,l]) => (
            <button key={t} onClick={() => setActiveTab(t)} className={`px-4 py-2 text-sm ${activeTab === t ? 'border-b-2' : 'opacity-50'}`} style={{ color: activeTab === t ? 'var(--color-amber-leader)' : undefined, borderColor: activeTab === t ? 'var(--color-amber-leader)' : 'transparent' }}>{l}</button>
          ))}
        </div>

        {activeTab === 'routes' && config && (
          <div className="space-y-4">
            {(['textProviderId','imageProviderId','videoProviderId'] as const).map(key => {
              const label = key === 'textProviderId' ? '文本生成' : key === 'imageProviderId' ? '图像生成' : '视频生成'
              return <div key={key} className="flex items-center gap-4"><span className="text-sm min-w-[5rem]" style={{ color: 'var(--color-paper-400)' }}>{label}</span>
                <select className="flex-1 px-3 py-2 text-sm" style={{ background: 'rgba(128,128,128,0.1)', border: '1px solid var(--color-ink-600)' }} value={(config.routes as any)[key]} onChange={e => saveConfig({ routes: { ...config.routes, [key]: e.target.value } })}>{providers.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}</select></div>
            })}
          </div>
        )}

        {activeTab === 'dashscope' && <div className="space-y-4"><div><label className="block text-sm mb-1" style={{ color: 'var(--color-paper-400)' }}>API Key</label><input type="password" className="w-full px-3 py-2 text-sm" style={{ background: 'rgba(128,128,128,0.1)', border: '1px solid var(--color-ink-600)' }} value={dashForm.apiKey} onChange={e => setDashForm(f => ({...f, apiKey: e.target.value}))} placeholder="输入百炼 API Key" /></div><div><label className="block text-sm mb-1" style={{ color: 'var(--color-paper-400)' }}>API 地址</label><input type="text" className="w-full px-3 py-2 text-sm" style={{ background: 'rgba(128,128,128,0.1)', border: '1px solid var(--color-ink-600)' }} value={dashForm.baseUrl} onChange={e => setDashForm(f => ({...f, baseUrl: e.target.value}))} placeholder="https://dashscope.aliyuncs.com/compatible-mode/v1" /></div><div><label className="block text-sm mb-1" style={{ color: 'var(--color-paper-400)' }}>文本模型</label><input type="text" className="w-full px-3 py-2 text-sm font-mono" style={{ background: 'rgba(128,128,128,0.1)', border: '1px solid var(--color-ink-600)' }} value={dashForm.textModel || ''} onChange={e => setDashForm(f => ({...f, textModel: e.target.value}))} placeholder="qwen-plus" /></div><div><label className="block text-sm mb-1" style={{ color: 'var(--color-paper-400)' }}>图像模型</label><input type="text" className="w-full px-3 py-2 text-sm font-mono" style={{ background: 'rgba(128,128,128,0.1)', border: '1px solid var(--color-ink-600)' }} value={dashForm.imageModel || ''} onChange={e => setDashForm(f => ({...f, imageModel: e.target.value}))} placeholder="wanx2.1-t2i-turbo" /></div><button className="btn-amber mt-2" onClick={saveDash}>保存配置</button></div>}

        {activeTab === 'volcengine' && <div className="space-y-4"><div><label className="block text-sm mb-1" style={{ color: 'var(--color-paper-400)' }}>API Key</label><input type="password" className="w-full px-3 py-2 text-sm" style={{ background: 'rgba(128,128,128,0.1)', border: '1px solid var(--color-ink-600)' }} value={volcForm.apiKey} onChange={e => setVolcForm(f => ({...f, apiKey: e.target.value}))} placeholder="输入火山引擎 API Key" /></div><div><label className="block text-sm mb-1" style={{ color: 'var(--color-paper-400)' }}>Endpoint ID</label><input type="text" className="w-full px-3 py-2 text-sm" style={{ background: 'rgba(128,128,128,0.1)', border: '1px solid var(--color-ink-600)' }} value={volcForm.endpointId} onChange={e => setVolcForm(f => ({...f, endpointId: e.target.value}))} placeholder="可选" /></div><div><label className="block text-sm mb-1" style={{ color: 'var(--color-paper-400)' }}>图像模型</label><input type="text" className="w-full px-3 py-2 text-sm font-mono" style={{ background: 'rgba(128,128,128,0.1)', border: '1px solid var(--color-ink-600)' }} value={volcForm.imageModel || ''} onChange={e => setVolcForm(f => ({...f, imageModel: e.target.value}))} placeholder="doubao-seedream-4-5-251128" /></div><div><label className="block text-sm mb-1" style={{ color: 'var(--color-paper-400)' }}>视频模型</label><input type="text" className="w-full px-3 py-2 text-sm font-mono" style={{ background: 'rgba(128,128,128,0.1)', border: '1px solid var(--color-ink-600)' }} value={volcForm.videoModel || ''} onChange={e => setVolcForm(f => ({...f, videoModel: e.target.value}))} placeholder="doubao-seedance-1-5-pro-251215" /></div><button className="btn-amber mt-2" onClick={saveVolc}>保存配置</button></div>}

        {activeTab === 'custom' && <div className="space-y-4"><div className="flex items-center justify-between"><p className="text-sm" style={{ color: 'var(--color-paper-400)' }}>自定义 OpenAI 兼容端点</p><button className="btn-ghost flex items-center gap-1 text-sm" onClick={() => setShowCustomForm(!showCustomForm)}><Plus size={14} /> 添加</button></div>{showCustomForm && <div className="p-4 space-y-3" style={{ background: 'rgba(128,128,128,0.05)' }}>{['id','name','baseUrl','apiKey'].map(f => (<div key={f}><label className="block text-xs mb-1" style={{ color: 'var(--color-paper-400)' }}>{f}</label><input type={f === 'apiKey' ? 'password' : 'text'} className="w-full px-3 py-2 text-sm" style={{ background: 'rgba(128,128,128,0.1)', border: '1px solid var(--color-ink-600)' }} value={(customForm as any)[f] || ''} onChange={e => setCustomForm(p => ({...p, [f]: e.target.value}))} /></div>))}<div><label className="block text-xs mb-1" style={{ color: 'var(--color-paper-400)' }}>能力</label><div className="flex gap-3">{(['text','image','video'] as const).map(c => (<label key={c} className="flex items-center gap-1 text-sm"><input type="checkbox" checked={customForm.capabilities?.includes(c)} onChange={e => { const caps = customForm.capabilities || []; setCustomForm(p => ({...p, capabilities: e.target.checked ? [...caps, c] : caps.filter(x => x !== c)})) }} />{c === 'text' ? '文本' : c === 'image' ? '图像' : '视频'}</label>))}</div></div><div className="flex gap-2"><button className="btn-amber text-sm" onClick={addCustom}>确认添加</button><button className="btn-ghost text-sm" onClick={() => setShowCustomForm(false)}>取消</button></div></div>}{(config?.custom || []).map(p => (<div key={p.id} className="flex items-center justify-between px-4 py-3" style={{ background: 'rgba(128,128,128,0.05)' }}><div><div className="text-sm">{p.name}</div><div className="text-xs" style={{ color: 'var(--color-paper-500)' }}>{p.capabilities.map(c => c === 'text' ? '文本' : c === 'image' ? '图像' : '视频').join(' · ')}</div></div><button className="text-red-400" onClick={() => removeCustom(p.id)}><Trash2 size={14} /></button></div>))}{(config?.custom || []).length === 0 && <div className="text-sm text-center py-8" style={{ color: 'var(--color-paper-500)' }}>尚无自定义 Provider</div>}</div>}
      </div>
    </div>
  )
}
