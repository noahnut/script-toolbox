import { useEffect, useRef } from 'react'
import { basicSetup, EditorView } from 'codemirror'
import { EditorState } from '@codemirror/state'
import { keymap } from '@codemirror/view'
import { indentWithTab } from '@codemirror/commands'
import { StreamLanguage } from '@codemirror/language'
import { python } from '@codemirror/lang-python'
import { shell } from '@codemirror/legacy-modes/mode/shell'
import { oneDark } from '@codemirror/theme-one-dark'

const fillHeight = EditorView.theme({
  '&': { height: '100%' },
  '.cm-scroller': { overflow: 'auto' },
})

export default function CodeEditor({ value, onChange, language }: {
  value: string
  onChange: (v: string) => void
  language: 'shell' | 'python'
}) {
  const containerRef = useRef<HTMLDivElement>(null)
  const viewRef = useRef<EditorView | null>(null)
  const onChangeRef = useRef(onChange)
  onChangeRef.current = onChange

  // Recreate the editor when the language changes
  useEffect(() => {
    if (!containerRef.current) return

    const langExt = language === 'python' ? python() : StreamLanguage.define(shell)

    const view = new EditorView({
      state: EditorState.create({
        doc: value,
        extensions: [
          basicSetup,
          langExt,
          oneDark,
          fillHeight,
          keymap.of([indentWithTab]),
          EditorView.updateListener.of((update) => {
            if (update.docChanged) onChangeRef.current(update.state.doc.toString())
          }),
        ],
      }),
      parent: containerRef.current,
    })

    viewRef.current = view
    return () => { view.destroy(); viewRef.current = null }
  }, [language]) // value intentionally omitted — synced below

  // Sync content when the selected script changes (without changing language)
  useEffect(() => {
    const view = viewRef.current
    if (!view) return
    const current = view.state.doc.toString()
    if (current !== value) {
      view.dispatch({ changes: { from: 0, to: current.length, insert: value } })
    }
  }, [value])

  return <div ref={containerRef} style={{ flex: 1, minHeight: 0 }} />
}
