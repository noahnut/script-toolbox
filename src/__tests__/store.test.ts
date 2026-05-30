import { beforeEach, describe, it, expect } from 'vitest'
import { useStore } from '../store/useStore'

const reset = () => {
  useStore.setState({
    folders: [],
    scripts: [],
    selectedScriptId: null,
    selectedFolderId: null,
    searchQuery: '',
    history: {},
  })
}

beforeEach(reset)

// ── folders ────────────────────────────────────────────────────────────────

describe('addFolder', () => {
  it('creates a root folder', () => {
    useStore.getState().addFolder('Deploy')
    const { folders } = useStore.getState()
    expect(folders).toHaveLength(1)
    expect(folders[0].name).toBe('Deploy')
    expect(folders[0].parentId).toBeNull()
  })

  it('creates a nested folder', () => {
    useStore.getState().addFolder('Parent')
    const parentId = useStore.getState().folders[0].id
    useStore.getState().addFolder('Child', parentId)
    const { folders } = useStore.getState()
    expect(folders).toHaveLength(2)
    expect(folders[1].parentId).toBe(parentId)
  })
})

describe('renameFolder', () => {
  it('changes the name', () => {
    useStore.getState().addFolder('Old')
    const id = useStore.getState().folders[0].id
    useStore.getState().renameFolder(id, 'New')
    expect(useStore.getState().folders[0].name).toBe('New')
  })
})

describe('removeFolder', () => {
  it('removes the folder', () => {
    useStore.getState().addFolder('ToRemove')
    const id = useStore.getState().folders[0].id
    useStore.getState().removeFolder(id)
    expect(useStore.getState().folders).toHaveLength(0)
  })

  it('removes descendant folders recursively', () => {
    useStore.getState().addFolder('Root')
    const rootId = useStore.getState().folders[0].id
    useStore.getState().addFolder('Child', rootId)
    useStore.getState().addFolder('Grandchild', useStore.getState().folders[1].id)
    expect(useStore.getState().folders).toHaveLength(3)

    useStore.getState().removeFolder(rootId)
    expect(useStore.getState().folders).toHaveLength(0)
  })

  it('removes scripts that belong to deleted folders', () => {
    useStore.getState().addFolder('Scripts')
    const folderId = useStore.getState().folders[0].id
    useStore.getState().addScript({ name: 'deploy', type: 'shell', path: '/deploy.sh', folderId })
    expect(useStore.getState().scripts).toHaveLength(1)

    useStore.getState().removeFolder(folderId)
    expect(useStore.getState().scripts).toHaveLength(0)
  })

  it('clears selectedFolderId when the selected folder is deleted', () => {
    useStore.getState().addFolder('ToDelete')
    const id = useStore.getState().folders[0].id
    useStore.setState({ selectedFolderId: id })
    useStore.getState().removeFolder(id)
    expect(useStore.getState().selectedFolderId).toBeNull()
  })
})

// ── scripts ────────────────────────────────────────────────────────────────

describe('addScript', () => {
  it('adds a script with a generated id', () => {
    useStore.getState().addScript({ name: 'hello', type: 'shell', path: '/hello.sh', folderId: null })
    const { scripts } = useStore.getState()
    expect(scripts).toHaveLength(1)
    expect(scripts[0].name).toBe('hello')
    expect(scripts[0].id).toBeTruthy()
  })
})

describe('addScripts', () => {
  it('batch-adds multiple scripts', () => {
    useStore.getState().addScripts([
      { name: 'a', type: 'shell', path: '/a.sh', folderId: null },
      { name: 'b', type: 'python', path: '/b.py', folderId: null },
    ])
    expect(useStore.getState().scripts).toHaveLength(2)
  })

  it('assigns unique ids to each script', () => {
    useStore.getState().addScripts([
      { name: 'x', type: 'shell', path: '/x.sh', folderId: null },
      { name: 'y', type: 'shell', path: '/y.sh', folderId: null },
    ])
    const [a, b] = useStore.getState().scripts
    expect(a.id).not.toBe(b.id)
  })
})

describe('removeScript', () => {
  it('removes the script by id', () => {
    useStore.getState().addScript({ name: 'del', type: 'shell', path: '/del.sh', folderId: null })
    const id = useStore.getState().scripts[0].id
    useStore.getState().removeScript(id)
    expect(useStore.getState().scripts).toHaveLength(0)
  })

  it('clears selectedScriptId when the selected script is removed', () => {
    useStore.getState().addScript({ name: 's', type: 'shell', path: '/s.sh', folderId: null })
    const id = useStore.getState().scripts[0].id
    useStore.setState({ selectedScriptId: id })
    useStore.getState().removeScript(id)
    expect(useStore.getState().selectedScriptId).toBeNull()
  })
})

describe('moveScript', () => {
  it('reassigns a script to a different folder', () => {
    useStore.getState().addFolder('A')
    useStore.getState().addFolder('B')
    const [folderA, folderB] = useStore.getState().folders
    useStore.getState().addScript({ name: 's', type: 'shell', path: '/s.sh', folderId: folderA.id })
    const scriptId = useStore.getState().scripts[0].id

    useStore.getState().moveScript(scriptId, folderB.id)
    expect(useStore.getState().scripts[0].folderId).toBe(folderB.id)
  })

  it('moves a script out of all folders (null)', () => {
    useStore.getState().addFolder('F')
    const folderId = useStore.getState().folders[0].id
    useStore.getState().addScript({ name: 's', type: 'shell', path: '/s.sh', folderId })
    const scriptId = useStore.getState().scripts[0].id

    useStore.getState().moveScript(scriptId, null)
    expect(useStore.getState().scripts[0].folderId).toBeNull()
  })
})

// ── search ────────────────────────────────────────────────────────────────

describe('setSearchQuery', () => {
  it('stores the query string', () => {
    useStore.getState().setSearchQuery('deploy')
    expect(useStore.getState().searchQuery).toBe('deploy')
  })

  it('empty string clears the query', () => {
    useStore.getState().setSearchQuery('x')
    useStore.getState().setSearchQuery('')
    expect(useStore.getState().searchQuery).toBe('')
  })
})

// ── selection ─────────────────────────────────────────────────────────────

describe('setSelectedScript / setSelectedFolder', () => {
  it('sets selected script id', () => {
    useStore.getState().addScript({ name: 's', type: 'shell', path: '/s.sh', folderId: null })
    const id = useStore.getState().scripts[0].id
    useStore.getState().setSelectedScript(id)
    expect(useStore.getState().selectedScriptId).toBe(id)
  })

  it('sets selected folder id', () => {
    useStore.getState().addFolder('F')
    const id = useStore.getState().folders[0].id
    useStore.getState().setSelectedFolder(id)
    expect(useStore.getState().selectedFolderId).toBe(id)
  })
})
