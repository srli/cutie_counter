import Placeholder from '@tiptap/extension-placeholder'
import { EditorContent, useEditor, type Editor as TipTap } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import { useEffect } from 'react'
import { countWords } from '../engine/progress'

interface Props {
  initial: string
  onChange: (html: string, words: number) => void
  onReady?: (editor: TipTap) => void
}

export function Editor({ initial, onChange, onReady }: Props) {
  const editor = useEditor({
    extensions: [
      StarterKit.configure({ heading: { levels: [1, 2, 3] }, codeBlock: false, code: false }),
      Placeholder.configure({ placeholder: 'Jot down a thought…' }),
    ],
    content: initial,
    autofocus: 'end',
    onUpdate: ({ editor }) => onChange(editor.getHTML(), countWords(editor.getText({ blockSeparator: '\n' }))),
  })

  useEffect(() => { if (editor) onReady?.(editor) }, [editor, onReady])

  const btn = (label: string, active: boolean, run: () => void, title: string) => (
    <button className={`tool ${active ? 'on' : ''}`} onMouseDown={(e) => { e.preventDefault(); run() }} title={title}>{label}</button>
  )

  return (
    <div className="editor-wrap">
      {editor && (
        <div className="editor-tools" role="toolbar">
          {btn('H1', editor.isActive('heading', { level: 1 }), () => editor.chain().focus().toggleHeading({ level: 1 }).run(), 'Chapter heading')}
          {btn('H2', editor.isActive('heading', { level: 2 }), () => editor.chain().focus().toggleHeading({ level: 2 }).run(), 'Section heading')}
          {btn('B', editor.isActive('bold'), () => editor.chain().focus().toggleBold().run(), 'Bold')}
          {btn('I', editor.isActive('italic'), () => editor.chain().focus().toggleItalic().run(), 'Italic')}
          {btn('❝', editor.isActive('blockquote'), () => editor.chain().focus().toggleBlockquote().run(), 'Quote')}
          {btn('⁂', false, () => editor.chain().focus().setHorizontalRule().run(), 'Scene break')}
        </div>
      )}
      <EditorContent editor={editor} className="editor" />
    </div>
  )
}
