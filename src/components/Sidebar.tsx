import { useState, useRef, useEffect, createContext, useContext } from 'react'
import { invoke } from '@tauri-apps/api/core'
import { open } from '@tauri-apps/plugin-dialog'
import { useStore } from '../store/useStore'
import type { AppFolder, Script } from '../types'

interface ScriptFile {
  name: string
  path: string
  script_type: string
  readme_path?: string
}

// ── drag context ───────────────────────────────────────────────────────────
// Pointer-event based drag — no HTML5 DnD (unreliable in WKWebView).
// The drop target is found with document.elementsFromPoint at mouseup.
// Folders expose their id via data-folder-id; "All Scripts" uses "__all__".

interface DragCtx {
  draggingScript: Script | null
  draggingFolder: AppFolder | null
  overDataFolderId: string | undefined  // '__all__' | folder-uuid | undefined (not over any target)
  startDrag: (script: Script, e: React.MouseEvent) => void
  startFolderDrag: (folder: AppFolder, e: React.MouseEvent) => void
}

const DragContext = createContext<DragCtx>({
  draggingScript: null,
  draggingFolder: null,
  overDataFolderId: undefined,
  startDrag: () => {},
  startFolderDrag: () => {},
})

// ── ScriptRow ──────────────────────────────────────────────────────────────

function ScriptRow({ script, depth = 0 }: { script: Script; depth?: number }) {
  const { draggingScript, startDrag } = useContext(DragContext)
  const selectedScriptId = useStore((s) => s.selectedScriptId)
  const setSelectedScript = useStore((s) => s.setSelectedScript)
  const removeScript = useStore((s) => s.removeScript)
  const isSelected = selectedScriptId === script.id
  const isDragging = draggingScript?.id === script.id

  return (
    <div
      onMouseDown={(e) => {
        if ((e.target as HTMLElement).closest('button')) return
        e.preventDefault()
        startDrag(script, e)
      }}
      onClick={() => setSelectedScript(script.id)}
      style={{
        display: 'flex', alignItems: 'center', gap: 6,
        padding: `4px 8px 4px ${8 + depth * 16}px`,
        cursor: isDragging ? 'grabbing' : 'pointer',
        background: isSelected ? 'var(--bg-selected)' : undefined,
        opacity: isDragging ? 0.35 : 1,
        userSelect: 'none',
      }}
      onMouseEnter={(e) => { if (!isSelected && !isDragging) (e.currentTarget as HTMLDivElement).style.background = 'var(--bg-hover)' }}
      onMouseLeave={(e) => { if (!isSelected) (e.currentTarget as HTMLDivElement).style.background = '' }}
    >
      <span style={{
        fontSize: 10, padding: '1px 5px', borderRadius: 3, flexShrink: 0,
        background: script.type === 'shell' ? '#1a3a1a' : '#1a2a3a',
        color: script.type === 'shell' ? 'var(--green)' : 'var(--blue)',
      }}>
        {script.type === 'shell' ? 'sh' : 'py'}
      </span>
      <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
        {script.name}
      </span>
      <button
        title="Remove"
        onClick={(e) => { e.stopPropagation(); removeScript(script.id) }}
        style={{ color: 'var(--text-faint)', fontSize: 14, lineHeight: 1, padding: '0 2px', flexShrink: 0 }}
        onMouseEnter={(e) => ((e.currentTarget as HTMLButtonElement).style.color = 'var(--red)')}
        onMouseLeave={(e) => ((e.currentTarget as HTMLButtonElement).style.color = 'var(--text-faint)')}
      >×</button>
    </div>
  )
}

// ── FolderNode ─────────────────────────────────────────────────────────────

function FolderNode({ folder, depth, onRename, onDelete }: {
  folder: AppFolder
  depth: number
  onRename: (id: string, current: string) => void
  onDelete: (id: string) => void
}) {
  const [open_, setOpen] = useState(true)
  const [menuPos, setMenuPos] = useState<{ x: number; y: number } | null>(null)
  const { draggingScript, draggingFolder, overDataFolderId, startFolderDrag } = useContext(DragContext)
  const folders = useStore((s) => s.folders)
  const scripts = useStore((s) => s.scripts)
  const selectedFolderId = useStore((s) => s.selectedFolderId)
  const setSelectedFolder = useStore((s) => s.setSelectedFolder)

  const children = folders.filter((f) => f.parentId === folder.id)
  const folderScripts = scripts.filter((sc) => sc.folderId === folder.id)
  const isSelected = selectedFolderId === folder.id
  const isDraggingThis = draggingFolder?.id === folder.id
  const isDropTarget = !isDraggingThis && overDataFolderId === folder.id &&
    (draggingScript !== null || draggingFolder !== null)

  useEffect(() => {
    if (!menuPos) return
    const h = () => setMenuPos(null)
    window.addEventListener('click', h)
    return () => window.removeEventListener('click', h)
  }, [menuPos])

  // Outer wrapper carries data-folder-id so the entire folder area is a drop target,
  // not just the header row. Nested folders' own data-folder-id takes priority because
  // elementsFromPoint returns frontmost elements first.
  return (
    <div data-folder-id={folder.id}>
      <div
        data-folder-id={folder.id}
        onMouseDown={(e) => {
          if (e.button !== 0 || (e.target as HTMLElement).closest('button')) return
          e.preventDefault()
          startFolderDrag(folder, e)
        }}
        onClick={() => { setSelectedFolder(folder.id); setOpen((v) => !v) }}
        onContextMenu={(e) => { e.preventDefault(); setMenuPos({ x: e.clientX, y: e.clientY }) }}
        style={{
          display: 'flex', alignItems: 'center', gap: 5,
          padding: `4px 8px 4px ${8 + depth * 16}px`,
          cursor: isDraggingThis ? 'grabbing' : (draggingScript || draggingFolder) ? 'copy' : 'pointer',
          userSelect: 'none',
          opacity: isDraggingThis ? 0.35 : 1,
          background: isDropTarget ? 'rgba(14,99,156,0.3)' : isSelected ? 'var(--bg-selected)' : undefined,
          outline: isDropTarget ? '1px dashed var(--accent)' : undefined,
          outlineOffset: '-1px',
          borderRadius: isDropTarget ? 2 : 0,
        }}
        onMouseEnter={(e) => { if (!isSelected && !isDropTarget && !isDraggingThis) (e.currentTarget as HTMLDivElement).style.background = 'var(--bg-hover)' }}
        onMouseLeave={(e) => { if (!isSelected && !isDropTarget) (e.currentTarget as HTMLDivElement).style.background = '' }}
      >
        <span style={{ fontSize: 10, color: 'var(--text-dim)', width: 10 }}>
          {open_ ? '▾' : '▸'}
        </span>
        <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {folder.name}
        </span>
        <span style={{ fontSize: 10, color: 'var(--text-faint)' }}>{folderScripts.length}</span>
      </div>

      {open_ && (
        <div style={{ position: 'relative' }}>
          {/* vertical guide line showing nesting depth */}
          <div style={{
            position: 'absolute', top: 0, bottom: 0, pointerEvents: 'none',
            left: 8 + depth * 16 + 5,
            width: 1,
            background: 'rgba(255,255,255,0.07)',
          }} />
          {children.map((child) => (
            <FolderNode key={child.id} folder={child} depth={depth + 1} onRename={onRename} onDelete={onDelete} />
          ))}
          {folderScripts.map((sc) => <ScriptRow key={sc.id} script={sc} depth={depth + 1} />)}
        </div>
      )}

      {menuPos && (
        <div
          onClick={(e) => e.stopPropagation()}
          style={{
            position: 'fixed', top: menuPos.y, left: menuPos.x,
            background: '#2d2d30', border: '1px solid var(--border)',
            borderRadius: 4, zIndex: 1000, minWidth: 140,
            boxShadow: '0 4px 12px rgba(0,0,0,0.4)', overflow: 'hidden',
          }}
        >
          {[
            { label: 'Rename', action: () => { setMenuPos(null); onRename(folder.id, folder.name) } },
            { label: 'Delete', action: () => { setMenuPos(null); onDelete(folder.id) }, danger: true },
          ].map(({ label, action, danger }) => (
            <div key={label} onClick={action}
              style={{ padding: '7px 14px', cursor: 'pointer', color: danger ? 'var(--red)' : 'var(--text)' }}
              onMouseEnter={(e) => ((e.currentTarget as HTMLDivElement).style.background = 'var(--bg-hover)')}
              onMouseLeave={(e) => ((e.currentTarget as HTMLDivElement).style.background = '')}
            >{label}</div>
          ))}
        </div>
      )}
    </div>
  )
}

// ── InlineInput ────────────────────────────────────────────────────────────

function InlineInput({ placeholder, initial, onCommit, onCancel }: {
  placeholder: string; initial?: string
  onCommit: (v: string) => void; onCancel: () => void
}) {
  const [value, setValue] = useState(initial ?? '')
  const ref = useRef<HTMLInputElement>(null)
  useEffect(() => { ref.current?.focus(); ref.current?.select() }, [])
  return (
    <input ref={ref} value={value} placeholder={placeholder}
      onChange={(e) => setValue(e.target.value)}
      onKeyDown={(e) => {
        if (e.key === 'Enter' && value.trim()) { onCommit(value.trim()); return }
        if (e.key === 'Escape') onCancel()
      }}
      onBlur={() => { if (value.trim()) onCommit(value.trim()); else onCancel() }}
      style={{
        margin: '4px 8px', padding: '4px 8px',
        background: '#3c3c3c', border: '1px solid var(--accent)',
        borderRadius: 3, color: 'var(--text)',
        width: 'calc(100% - 16px)', outline: 'none',
      }}
    />
  )
}

// ── Sidebar ────────────────────────────────────────────────────────────────

export default function Sidebar() {
  const folders = useStore((s) => s.folders)
  const scripts = useStore((s) => s.scripts)
  const searchQuery = useStore((s) => s.searchQuery)
  const selectedFolderId = useStore((s) => s.selectedFolderId)
  const selectedScriptId = useStore((s) => s.selectedScriptId)
  const {
    addFolder, renameFolder, removeFolder,
    addScript, addScripts, moveScript, moveFolder,
    setSelectedFolder, setSearchQuery,
  } = useStore()

  const [newFolderParent, setNewFolderParent] = useState<string | null | undefined>(undefined)
  const [renaming, setRenaming] = useState<{ id: string; current: string } | null>(null)

  // ── drag state ────────────────────────────────────────────────────────────

  const [draggingScript, setDraggingScript] = useState<Script | null>(null)
  const [draggingFolder, setDraggingFolder] = useState<AppFolder | null>(null)
  const [overDataFolderId, setOverDataFolderId] = useState<string | undefined>(undefined)
  const ghostRef = useRef<HTMLDivElement>(null)

  function getDataFolderIdAt(x: number, y: number): string | undefined {
    for (const el of document.elementsFromPoint(x, y)) {
      const fid = (el as HTMLElement).dataset?.folderId
      if (fid !== undefined) return fid
    }
    return undefined
  }

  function startDrag(script: Script, e: React.MouseEvent) {
    const startX = e.clientX
    const startY = e.clientY
    let active = false

    const onMove = (me: MouseEvent) => {
      if (!active) {
        if (Math.hypot(me.clientX - startX, me.clientY - startY) < 6) return
        active = true
        setDraggingScript(script)
        document.body.style.cursor = 'grabbing'
        document.body.style.userSelect = 'none'
      }

      // Move ghost
      if (ghostRef.current) {
        ghostRef.current.style.left = `${me.clientX + 14}px`
        ghostRef.current.style.top = `${me.clientY - 10}px`
      }

      setOverDataFolderId(getDataFolderIdAt(me.clientX, me.clientY))
    }

    const onUp = (me: MouseEvent) => {
      document.removeEventListener('mousemove', onMove)
      document.removeEventListener('mouseup', onUp)
      document.body.style.cursor = ''
      document.body.style.userSelect = ''

      if (active) {
        const target = getDataFolderIdAt(me.clientX, me.clientY)
        if (target !== undefined) {
          moveScript(script.id, target === '__all__' ? null : target)
        }
      }

      setDraggingScript(null)
      setOverDataFolderId(undefined)
    }

    document.addEventListener('mousemove', onMove)
    document.addEventListener('mouseup', onUp)
  }

  function startFolderDrag(folder: AppFolder, e: React.MouseEvent) {
    const startX = e.clientX
    const startY = e.clientY
    let active = false

    const onMove = (me: MouseEvent) => {
      if (!active) {
        if (Math.hypot(me.clientX - startX, me.clientY - startY) < 6) return
        active = true
        setDraggingFolder(folder)
        document.body.style.cursor = 'grabbing'
        document.body.style.userSelect = 'none'
      }
      if (ghostRef.current) {
        ghostRef.current.style.left = `${me.clientX + 14}px`
        ghostRef.current.style.top = `${me.clientY - 10}px`
      }
      setOverDataFolderId(getDataFolderIdAt(me.clientX, me.clientY))
    }

    const onUp = (me: MouseEvent) => {
      document.removeEventListener('mousemove', onMove)
      document.removeEventListener('mouseup', onUp)
      document.body.style.cursor = ''
      document.body.style.userSelect = ''

      if (active) {
        const target = getDataFolderIdAt(me.clientX, me.clientY)
        if (target !== undefined) {
          moveFolder(folder.id, target === '__all__' ? null : target)
        }
      }

      setDraggingFolder(null)
      setOverDataFolderId(undefined)
    }

    document.addEventListener('mousemove', onMove)
    document.addEventListener('mouseup', onUp)
  }

  const drag: DragCtx = { draggingScript, draggingFolder, overDataFolderId, startDrag, startFolderDrag }

  // ── add / import ──────────────────────────────────────────────────────────

  async function handleAddScript() {
    const sel = await open({
      multiple: true,
      filters: [{ name: 'Scripts', extensions: ['sh', 'py'] }],
    }) as string[] | string | null
    if (!sel) return
    for (const path of Array.isArray(sel) ? sel : [sel]) {
      const ext = path.split('.').pop()
      const type: Script['type'] = ext === 'py' ? 'python' : 'shell'
      const name = path.split('/').pop()?.replace(/\.(sh|py)$/, '') ?? path
      addScript({ name, type, path, folderId: selectedFolderId ?? null })
    }
  }

  async function handleImportFolder() {
    const dir = await open({ directory: true, multiple: false }) as string | null
    if (!dir) return
    const files = await invoke<ScriptFile[]>('scan_folder', { folderPath: dir })
    if (files.length === 0) return
    addFolder(dir.split('/').pop() ?? 'Imported', selectedFolderId ?? null)
    const all = useStore.getState().folders
    const newId = all[all.length - 1].id
    addScripts(files.map((f) => ({
      name: f.name,
      type: f.script_type === 'python' ? 'python' : 'shell',
      path: f.path,
      folderId: newId,
      readmePath: f.readme_path,
    })))
  }

  // ── derived ───────────────────────────────────────────────────────────────

  const rootFolders = folders.filter((f) => f.parentId === null)
  const unfiledScripts = scripts.filter((sc) => sc.folderId === null)
  const searchResults = searchQuery.trim()
    ? scripts.filter((sc) => sc.name.toLowerCase().includes(searchQuery.toLowerCase()))
    : []
  const isDragging = draggingScript !== null || draggingFolder !== null
  const allScriptsIsTarget = isDragging && overDataFolderId === '__all__'

  // ── render ─────────────────────────────────────────────────────────────────

  return (
    <DragContext.Provider value={drag}>
      {/* drag ghost — follows the cursor, pointer-events:none so it doesn't block hit testing */}
      <div
        ref={ghostRef}
        style={{
          display: isDragging ? 'block' : 'none',
          position: 'fixed', pointerEvents: 'none', zIndex: 9999,
          background: '#2d2d30', border: '1px solid var(--accent)',
          borderRadius: 4, padding: '3px 10px',
          fontSize: 12, color: 'var(--text)', whiteSpace: 'nowrap',
          boxShadow: '0 2px 8px rgba(0,0,0,0.5)',
        }}
      >
        {(draggingScript ?? draggingFolder)?.name}
      </div>

      <div style={{
        width: 260, flexShrink: 0,
        background: 'var(--bg-app)', borderRight: '1px solid var(--border)',
        display: 'flex', flexDirection: 'column', overflow: 'hidden',
      }}>
        {/* search */}
        <div style={{ padding: '10px 8px 6px', flexShrink: 0 }}>
          <input
            value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search scripts..."
            style={{
              width: '100%', padding: '5px 10px',
              background: '#3c3c3c', border: '1px solid transparent',
              borderRadius: 4, color: 'var(--text)', outline: 'none',
            }}
            onFocus={(e) => ((e.target as HTMLInputElement).style.borderColor = 'var(--accent)')}
            onBlur={(e) => ((e.target as HTMLInputElement).style.borderColor = 'transparent')}
          />
        </div>

        {/* tree / results */}
        <div style={{ flex: 1, overflowY: 'auto', overflowX: 'hidden' }}>
          {searchQuery.trim() ? (
            <div>
              <div style={{ padding: '4px 8px 2px', color: 'var(--text-faint)', fontSize: 11 }}>
                {searchResults.length} result{searchResults.length !== 1 ? 's' : ''}
              </div>
              {searchResults.map((sc) => <ScriptRow key={sc.id} script={sc} />)}
            </div>
          ) : (
            <>
              {/* All Scripts — drop target to remove from any folder */}
              <div
                data-folder-id="__all__"
                onClick={() => setSelectedFolder(null)}
                style={{
                  padding: '5px 8px', cursor: 'pointer', userSelect: 'none',
                  display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                  background: allScriptsIsTarget
                    ? 'rgba(14,99,156,0.3)'
                    : selectedFolderId === null && !selectedScriptId
                      ? 'var(--bg-selected)' : undefined,
                  outline: allScriptsIsTarget ? '1px dashed var(--accent)' : undefined,
                  outlineOffset: '-1px',
                }}
                onMouseEnter={(e) => { if (selectedFolderId !== null && !allScriptsIsTarget) (e.currentTarget as HTMLDivElement).style.background = 'var(--bg-hover)' }}
                onMouseLeave={(e) => { if (selectedFolderId !== null && !allScriptsIsTarget) (e.currentTarget as HTMLDivElement).style.background = '' }}
              >
                <span>All Scripts</span>
                <span style={{ color: 'var(--text-faint)', fontSize: 11 }}>{scripts.length}</span>
              </div>

              {selectedFolderId === null && unfiledScripts.map((sc) => <ScriptRow key={sc.id} script={sc} />)}

              {renaming && (
                <InlineInput
                  placeholder="Folder name" initial={renaming.current}
                  onCommit={(name) => { renameFolder(renaming.id, name); setRenaming(null) }}
                  onCancel={() => setRenaming(null)}
                />
              )}

              {rootFolders.map((f) => (
                <FolderNode key={f.id} folder={f} depth={0}
                  onRename={(id, cur) => setRenaming({ id, current: cur })}
                  onDelete={(id) => { if (window.confirm('Delete this folder and all its scripts?')) removeFolder(id) }}
                />
              ))}

              {newFolderParent !== undefined && (
                <InlineInput
                  placeholder="Group name"
                  onCommit={(name) => { addFolder(name, newFolderParent); setNewFolderParent(undefined) }}
                  onCancel={() => setNewFolderParent(undefined)}
                />
              )}
            </>
          )}
        </div>

        {/* action bar */}
        <div style={{
          borderTop: '1px solid var(--border)', padding: '6px 4px',
          display: 'flex', gap: 2, flexShrink: 0,
        }}>
          {[
            { label: '+ Script',  title: 'Add script file(s)',         action: handleAddScript },
            { label: '+ Folder',  title: 'Import a folder of scripts', action: handleImportFolder },
            { label: '+ Group',   title: 'Create an empty group',      action: () => setNewFolderParent(selectedFolderId) },
          ].map(({ label, title, action }) => (
            <button key={label} title={title} onClick={action}
              style={{
                flex: 1, padding: '5px 0',
                background: '#2d2d30', border: '1px solid var(--border)',
                borderRadius: 3, color: 'var(--text-dim)', fontSize: 11,
              }}
              onMouseEnter={(e) => { const b = e.currentTarget as HTMLButtonElement; b.style.background = 'var(--accent)'; b.style.color = '#fff' }}
              onMouseLeave={(e) => { const b = e.currentTarget as HTMLButtonElement; b.style.background = '#2d2d30'; b.style.color = 'var(--text-dim)' }}
            >{label}</button>
          ))}
        </div>
      </div>
    </DragContext.Provider>
  )
}
