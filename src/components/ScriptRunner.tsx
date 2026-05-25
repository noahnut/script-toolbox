import { useState, useEffect, useRef } from 'react'
import { invoke } from '@tauri-apps/api/core'
import { listen } from '@tauri-apps/api/event'
import type { Script, OutputLine, ScriptMeta } from '../types'
import CodeEditor from './CodeEditor'

function TypeBadge({ type }: { type: Script['type'] }) {
  return (
    <span style={{
      fontSize: 11,
      padding: '2px 8px',
      borderRadius: 3,
      background: type === 'shell' ? '#1a3a1a' : '#1a2a3a',
      color: type === 'shell' ? 'var(--green)' : 'var(--blue)',
    }}>
      {type === 'shell' ? 'Shell' : 'Python'}
    </span>
  )
}

// ── parameter form ─────────────────────────────────────────────────────────

function ParamForm({
  params,
  values,
  onChange,
}: {
  params: ScriptMeta['params']
  values: Record<string, string>
  onChange: (name: string, value: string) => void
}) {
  if (params.length === 0) return null

  return (
    <div style={{
      padding: '12px 20px 16px',
      borderBottom: '1px solid var(--border)',
      background: 'var(--bg-app)',
    }}>
      <div style={{ fontSize: 11, color: 'var(--text-faint)', marginBottom: 10, letterSpacing: '0.06em' }}>
        PARAMETERS
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {params.map((p) => (
          <div key={p.name} style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
            <div style={{ width: 130, flexShrink: 0, paddingTop: 6 }}>
              <span style={{ fontFamily: "'SF Mono', monospace", fontSize: 12 }}>{p.name}</span>
              {p.required && (
                <span title="Required" style={{ color: 'var(--red)', marginLeft: 2, fontSize: 12 }}>*</span>
              )}
              {!p.required && p.defaultValue !== null && (
                <span style={{ color: 'var(--text-faint)', fontSize: 10, display: 'block', marginTop: 1 }}>
                  default: {p.defaultValue}
                </span>
              )}
            </div>
            <div style={{ flex: 1 }}>
              <input
                value={values[p.name] ?? ''}
                onChange={(e) => onChange(p.name, e.target.value)}
                placeholder={p.description || p.name}
                style={{
                  width: '100%',
                  padding: '5px 10px',
                  background: '#3c3c3c',
                  border: '1px solid transparent',
                  borderRadius: 3,
                  color: 'var(--text)',
                  fontFamily: "'SF Mono', monospace",
                  fontSize: 12,
                  outline: 'none',
                }}
                onFocus={(e) => ((e.target as HTMLInputElement).style.borderColor = 'var(--accent)')}
                onBlur={(e) => ((e.target as HTMLInputElement).style.borderColor = 'transparent')}
              />
              {p.description && (
                <div style={{ fontSize: 11, color: 'var(--text-faint)', marginTop: 3, paddingLeft: 2 }}>
                  {p.description}
                </div>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

// ── main component ─────────────────────────────────────────────────────────

export default function ScriptRunner({ script }: { script: Script }) {
  const [output, setOutput] = useState<OutputLine[]>([])
  const [isRunning, setIsRunning] = useState(false)
  const [meta, setMeta] = useState<ScriptMeta | null>(null)
  const [paramValues, setParamValues] = useState<Record<string, string>>({})
  const outputRef = useRef<HTMLDivElement>(null)

  const [isEditing, setIsEditing] = useState(false)
  const [editContent, setEditContent] = useState('')
  const [isSaving, setIsSaving] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)

  // Load metadata whenever the selected script changes
  useEffect(() => {
    setOutput([])
    setMeta(null)
    setParamValues({})
    setIsEditing(false)
    setEditContent('')
    setSaveError(null)

    invoke<ScriptMeta>('parse_script_meta', { path: script.path })
      .then((m) => {
        setMeta(m)
        const defaults: Record<string, string> = {}
        for (const p of m.params) {
          defaults[p.name] = p.defaultValue ?? ''
        }
        setParamValues(defaults)
      })
      .catch(() => {})
  }, [script.id, script.path])

  // Subscribe to output events for the lifetime of this component
  useEffect(() => {
    const cleanups: Array<() => void> = []

    listen<{ type: string; text: string }>('script-output', (e) => {
      setOutput((prev) => [
        ...prev,
        { type: e.payload.type as 'stdout' | 'stderr', text: e.payload.text },
      ])
    }).then((fn) => cleanups.push(fn))

    listen<{ exit_code: number; success: boolean }>('script-finished', (e) => {
      setIsRunning(false)
      setOutput((prev) => [
        ...prev,
        { type: 'system', text: `Process exited with code ${e.payload.exit_code}` },
      ])
    }).then((fn) => cleanups.push(fn))

    return () => cleanups.forEach((fn) => fn())
  }, [])

  useEffect(() => {
    if (outputRef.current) {
      outputRef.current.scrollTop = outputRef.current.scrollHeight
    }
  }, [output])

  function setParam(name: string, value: string) {
    setParamValues((prev) => ({ ...prev, [name]: value }))
  }

  async function runScript() {
    // Validate required params before running
    if (meta) {
      for (const p of meta.params) {
        if (p.required && !paramValues[p.name]?.trim()) {
          setOutput([{ type: 'stderr', text: `Parameter "${p.name}" is required` }])
          return
        }
      }
    }

    // Build the display command line (env vars + program + path)
    const envStr = Object.entries(paramValues)
      .filter(([, v]) => v !== '')
      .map(([k, v]) => `${k}=${v}`)
      .join(' ')
    const prog = script.type === 'shell' ? 'bash' : 'python3'
    const cmdLine = envStr ? `${envStr} ${prog} ${script.path}` : `${prog} ${script.path}`

    setOutput([{ type: 'system', text: `$ ${cmdLine}` }])
    setIsRunning(true)

    try {
      await invoke('run_script', {
        scriptPath: script.path,
        scriptType: script.type,
        params: paramValues,
      })
    } catch (err) {
      setIsRunning(false)
      setOutput((prev) => [...prev, { type: 'stderr', text: String(err) }])
    }
  }

  async function enterEditMode() {
    try {
      const content = await invoke<string>('read_file', { path: script.path })
      setEditContent(content)
      setIsEditing(true)
      setSaveError(null)
    } catch (err) {
      setSaveError(String(err))
    }
  }

  async function saveEdit() {
    setIsSaving(true)
    setSaveError(null)
    try {
      await invoke('write_file', { path: script.path, content: editContent })
      setIsEditing(false)
      // Re-parse metadata in case @description / @param annotations changed
      invoke<ScriptMeta>('parse_script_meta', { path: script.path })
        .then((m) => {
          setMeta(m)
          const defaults: Record<string, string> = {}
          for (const p of m.params) {
            if (!paramValues[p.name]) defaults[p.name] = p.defaultValue ?? ''
          }
          setParamValues((prev) => ({ ...defaults, ...prev }))
        })
        .catch(() => {})
    } catch (err) {
      setSaveError(String(err))
    } finally {
      setIsSaving(false)
    }
  }

  function cancelEdit() {
    setIsEditing(false)
    setEditContent('')
    setSaveError(null)
  }

  const lineColor = (type: OutputLine['type']) => {
    if (type === 'stderr') return 'var(--red)'
    if (type === 'system') return 'var(--blue)'
    return 'var(--text)'
  }

  // ── render ─────────────────────────────────────────────────────────────────

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden' }}>

      {/* header */}
      <div style={{
        padding: '14px 20px 12px',
        borderBottom: '1px solid var(--border)',
        background: 'var(--bg-main)',
        flexShrink: 0,
      }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
          <div style={{ flex: 1, overflow: 'hidden' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 4 }}>
              <span style={{ fontSize: 15, fontWeight: 600 }}>{script.name}</span>
              <TypeBadge type={script.type} />
            </div>
            <div style={{ fontSize: 11, color: 'var(--text-dim)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {script.path}
            </div>
            {meta?.description && (
              <div style={{ fontSize: 12, color: 'var(--text-dim)', marginTop: 5 }}>
                {meta.description}
              </div>
            )}
          </div>

          <div style={{ display: 'flex', gap: 6, flexShrink: 0, marginTop: 2 }}>
            {isEditing ? (
              <>
                <button
                  onClick={cancelEdit}
                  style={{ padding: '6px 14px', background: '#3c3c3c', color: 'var(--text-dim)', borderRadius: 4, fontSize: 13 }}
                >
                  Cancel
                </button>
                <button
                  onClick={saveEdit}
                  disabled={isSaving}
                  style={{ padding: '6px 18px', background: 'var(--accent)', color: '#fff', borderRadius: 4, fontSize: 13, opacity: isSaving ? 0.7 : 1 }}
                >
                  {isSaving ? 'Saving…' : 'Save'}
                </button>
              </>
            ) : (
              <>
                <button
                  onClick={enterEditMode}
                  style={{ padding: '6px 14px', background: '#3c3c3c', color: 'var(--text-dim)', borderRadius: 4, fontSize: 13 }}
                  onMouseEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.color = 'var(--text)' }}
                  onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.color = 'var(--text-dim)' }}
                >
                  Edit
                </button>
                <button
                  onClick={runScript}
                  disabled={isRunning}
                  style={{ padding: '6px 18px', background: isRunning ? '#1a3a1a' : 'var(--accent)', color: '#fff', borderRadius: 4, fontSize: 13, opacity: isRunning ? 0.7 : 1 }}
                >
                  {isRunning ? 'Running…' : '▶  Run'}
                </button>
              </>
            )}
          </div>
        </div>
      </div>

      {/* scrollable body */}
      {isEditing ? (
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
          {saveError && (
            <div style={{ padding: '6px 20px', fontSize: 12, color: 'var(--red)', borderBottom: '1px solid var(--border)', flexShrink: 0 }}>
              {saveError}
            </div>
          )}
          <CodeEditor
            value={editContent}
            onChange={setEditContent}
            language={script.type}
          />
        </div>
      ) : (
        <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column' }}>

          {/* parameters */}
          {meta && meta.params.length > 0 && (
            <ParamForm params={meta.params} values={paramValues} onChange={setParam} />
          )}

          {/* output terminal */}
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minHeight: 200 }}>
            <div style={{
              padding: '6px 20px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              color: 'var(--text-faint)',
              fontSize: 11,
              userSelect: 'none',
              borderBottom: output.length > 0 ? '1px solid #2a2a2a' : undefined,
            }}>
              <span>Output</span>
              {output.length > 0 && (
                <button
                  onClick={() => setOutput([])}
                  style={{ color: 'var(--text-faint)', fontSize: 11 }}
                  onMouseEnter={(e) => ((e.currentTarget as HTMLButtonElement).style.color = 'var(--text)')}
                  onMouseLeave={(e) => ((e.currentTarget as HTMLButtonElement).style.color = 'var(--text-faint)')}
                >
                  Clear
                </button>
              )}
            </div>

            <div
              ref={outputRef}
              style={{
                flex: 1,
                overflowY: 'auto',
                padding: '10px 20px 20px',
                fontFamily: "'SF Mono', 'Fira Code', 'Roboto Mono', monospace",
                fontSize: 12,
                lineHeight: 1.7,
                background: 'var(--bg-app)',
              }}
            >
              {output.length === 0 ? (
                <span style={{ color: 'var(--text-faint)' }}>
                  {meta && meta.params.length > 0
                    ? 'Fill in the parameters above, then press Run.'
                    : 'Press Run to execute the script.'}
                </span>
              ) : (
                output.map((line, i) => (
                  <div
                    key={i}
                    style={{ color: lineColor(line.type), whiteSpace: 'pre-wrap', wordBreak: 'break-all' }}
                  >
                    {line.text}
                  </div>
                ))
              )}
              {isRunning && <span style={{ color: 'var(--text-faint)' }}>▌</span>}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
