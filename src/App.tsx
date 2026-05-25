import Sidebar from './components/Sidebar'
import ScriptRunner from './components/ScriptRunner'
import { useStore } from './store/useStore'

export default function App() {
  const scripts = useStore((s) => s.scripts)
  const selectedScriptId = useStore((s) => s.selectedScriptId)
  const selectedScript = scripts.find((s) => s.id === selectedScriptId) ?? null

  return (
    <div style={{ display: 'flex', height: '100vh', overflow: 'hidden' }}>
      <Sidebar />
      <div style={{ flex: 1, overflow: 'hidden', background: 'var(--bg-main)' }}>
        {selectedScript ? (
          <ScriptRunner key={selectedScript.id} script={selectedScript} />
        ) : (
          <div style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            height: '100%',
            color: 'var(--text-faint)',
            flexDirection: 'column',
            gap: 8,
          }}>
            <div style={{ fontSize: 32 }}>[ ]</div>
            <span>Select a script to get started</span>
          </div>
        )}
      </div>
    </div>
  )
}
