import { useState } from 'react'
import CodeMirror from '@uiw/react-codemirror'
import { markdown } from '@codemirror/lang-markdown'
import './App.css'

function App() {
  const [text, setText] = useState('# Привет!\n\nНачни писать здесь.')

  return (
    <div className="app">
      <header className="toolbar">
        <span>Новый документ</span>
        <span>{text.length} символов</span>
      </header>
      <CodeMirror
        className="editor"
        value={text}
        height="100%"
        extensions={[markdown()]}
        onChange={(value) => setText(value)}
      />
    </div>
  )
}

export default App
