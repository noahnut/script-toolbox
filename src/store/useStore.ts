import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { AppFolder, Script } from '../types'

function uid(): string {
  return crypto.randomUUID()
}

interface State {
  folders: AppFolder[]
  scripts: Script[]
  selectedScriptId: string | null
  selectedFolderId: string | null
  searchQuery: string
}

interface Actions {
  addFolder: (name: string, parentId?: string | null) => void
  renameFolder: (id: string, name: string) => void
  removeFolder: (id: string) => void
  addScript: (script: Omit<Script, 'id'>) => void
  addScripts: (scripts: Omit<Script, 'id'>[]) => void
  removeScript: (id: string) => void
  moveScript: (scriptId: string, folderId: string | null) => void
  moveFolder: (folderId: string, newParentId: string | null) => void
  setSelectedScript: (id: string | null) => void
  setSelectedFolder: (id: string | null) => void
  setSearchQuery: (q: string) => void
}

export const useStore = create<State & Actions>()(
  persist(
    (set) => ({
      folders: [],
      scripts: [],
      selectedScriptId: null,
      selectedFolderId: null,
      searchQuery: '',

      addFolder: (name, parentId = null) =>
        set((s) => ({ folders: [...s.folders, { id: uid(), name, parentId }] })),

      renameFolder: (id, name) =>
        set((s) => ({ folders: s.folders.map((f) => (f.id === id ? { ...f, name } : f)) })),

      // Removes a folder and all its descendants (and their scripts)
      removeFolder: (id) =>
        set((s) => {
          const dead = new Set<string>()
          const collect = (fid: string) => {
            dead.add(fid)
            s.folders.filter((f) => f.parentId === fid).forEach((f) => collect(f.id))
          }
          collect(id)
          return {
            folders: s.folders.filter((f) => !dead.has(f.id)),
            scripts: s.scripts.filter((sc) => !dead.has(sc.folderId ?? '')),
            selectedFolderId: dead.has(s.selectedFolderId ?? '') ? null : s.selectedFolderId,
            selectedScriptId: s.scripts
              .filter((sc) => dead.has(sc.folderId ?? ''))
              .some((sc) => sc.id === s.selectedScriptId)
              ? null
              : s.selectedScriptId,
          }
        }),

      addScript: (script) =>
        set((s) => ({ scripts: [...s.scripts, { ...script, id: uid() }] })),

      addScripts: (scripts) =>
        set((s) => ({ scripts: [...s.scripts, ...scripts.map((sc) => ({ ...sc, id: uid() }))] })),

      removeScript: (id) =>
        set((s) => ({
          scripts: s.scripts.filter((sc) => sc.id !== id),
          selectedScriptId: s.selectedScriptId === id ? null : s.selectedScriptId,
        })),

      moveScript: (scriptId, folderId) =>
        set((s) => ({
          scripts: s.scripts.map((sc) => sc.id === scriptId ? { ...sc, folderId } : sc),
        })),

      moveFolder: (folderId, newParentId) =>
        set((s) => {
          // Collect folderId + all its descendants to guard against cycles
          const subtree = new Set<string>()
          const collect = (id: string) => {
            subtree.add(id)
            s.folders.filter((f) => f.parentId === id).forEach((f) => collect(f.id))
          }
          collect(folderId)
          if (newParentId !== null && subtree.has(newParentId)) return s
          return {
            folders: s.folders.map((f) => f.id === folderId ? { ...f, parentId: newParentId } : f),
          }
        }),

      setSelectedScript: (id) => set({ selectedScriptId: id }),
      setSelectedFolder: (id) => set({ selectedFolderId: id }),
      setSearchQuery: (q) => set({ searchQuery: q }),
    }),
    { name: 'script-toolbox' }
  )
)
