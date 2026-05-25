export interface AppFolder {
  id: string
  name: string
  parentId: string | null
}

export interface Script {
  id: string
  name: string
  type: 'shell' | 'python'
  path: string
  folderId: string | null
  readmePath?: string
}

export interface OutputLine {
  type: 'stdout' | 'stderr' | 'system'
  text: string
}

export interface ParamDef {
  name: string
  required: boolean
  defaultValue: string | null
  description: string
}

export interface ScriptMeta {
  description: string
  params: ParamDef[]
}
