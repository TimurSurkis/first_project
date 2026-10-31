import { EditorSelection } from '@codemirror/state'
import { keymap } from '@codemirror/view'

const TABLE_TEMPLATE = '| Колонка 1 | Колонка 2 |\n| --- | --- |\n|  |  |'

function changeLines(view, transform) {
  const { state } = view
  const { from, to } = state.selection.main
  const first = state.doc.lineAt(from).number
  const last = state.doc.lineAt(to).number
  const changes = []

  for (let number = first; number <= last; number++) {
    const line = state.doc.line(number)
    const text = transform(line.text, number - first)
    if (text !== line.text) changes.push({ from: line.from, to: line.to, insert: text })
  }

  view.dispatch({ changes })
  return true
}

function toggleWrap(view, before, after = before, placeholder = 'текст') {
  const { state } = view
  const { from, to } = state.selection.main
  const selected = state.sliceDoc(from, to)
  const textBefore = state.sliceDoc(Math.max(0, from - before.length), from)
  const textAfter = state.sliceDoc(to, to + after.length)

  if (selected && textBefore === before && textAfter === after) {
    view.dispatch({
      changes: [
        { from: from - before.length, to: from, insert: '' },
        { from: to, to: to + after.length, insert: '' },
      ],
      selection: EditorSelection.range(from - before.length, to - before.length),
    })
    return true
  }

  const content = selected || placeholder
  view.dispatch({
    changes: { from, to, insert: before + content + after },
    selection: EditorSelection.range(from + before.length, from + before.length + content.length),
  })
  return true
}

function togglePrefix(pattern, prefix) {
  return (view) =>
    changeLines(view, (text) => (pattern.test(text) ? text.replace(pattern, '') : prefix + text))
}

function toggleOrderedList(view) {
  return changeLines(view, (text, index) =>
    /^\d+\. /.test(text) ? text.replace(/^\d+\. /, '') : `${index + 1}. ${text}`,
  )
}

export function setHeading(view, level) {
  return changeLines(view, (text) => {
    const match = text.match(/^(#{1,6}) /)
    const clean = text.replace(/^#{1,6} /, '')
    if (match && match[1].length === level) return clean
    return '#'.repeat(level) + ' ' + clean
  })
}

function insertLink(view) {
  const { state } = view
  const { from, to } = state.selection.main
  const label = state.sliceDoc(from, to) || 'текст'
  const url = 'https://'
  const urlFrom = from + label.length + 3

  view.dispatch({
    changes: { from, to, insert: `[${label}](${url})` },
    selection: EditorSelection.range(urlFrom, urlFrom + url.length),
  })
  return true
}

function insertCodeBlock(view) {
  const { state } = view
  const { from, to } = state.selection.main
  const body = state.sliceDoc(from, to)

  view.dispatch({
    changes: { from, to, insert: '```\n' + body + '\n```' },
    selection: EditorSelection.range(from + 4, from + 4 + body.length),
  })
  return true
}

function insertTable(view) {
  const { state } = view
  const line = state.doc.lineAt(state.selection.main.from)
  const lead = line.text ? '\n\n' : ''
  const start = line.to + lead.length + 2

  view.dispatch({
    changes: { from: line.to, insert: lead + TABLE_TEMPLATE },
    selection: EditorSelection.range(start, start + 'Колонка 1'.length),
  })
  return true
}

export const headingLevels = [1, 2, 3, 4, 5, 6]

export const formatCommands = [
  { label: 'Ж', title: 'Жирный (Ctrl+B)', key: 'Mod-b', run: (view) => toggleWrap(view, '**') },
  { label: 'К', title: 'Курсив (Ctrl+I)', key: 'Mod-i', run: (view) => toggleWrap(view, '*') },
  {
    label: 'З',
    title: 'Зачёркнутый (Ctrl+Shift+X)',
    key: 'Mod-Shift-x',
    run: (view) => toggleWrap(view, '~~'),
  },
  { label: 'Код', title: 'Встроенный код (Ctrl+E)', key: 'Mod-e', run: (view) => toggleWrap(view, '`') },
  { label: 'Список', title: 'Маркированный список', run: togglePrefix(/^- /, '- ') },
  { label: '1. Список', title: 'Нумерованный список', run: toggleOrderedList },
  { label: 'Цитата', title: 'Цитата (Ctrl+Shift+Q)', key: 'Mod-Shift-q', run: togglePrefix(/^> /, '> ') },
  { label: 'Чекбокс', title: 'Чекбокс', run: togglePrefix(/^- \[[ xX]\] /, '- [ ] ') },
  { label: 'Ссылка', title: 'Ссылка (Ctrl+K)', key: 'Mod-k', run: insertLink },
  {
    label: 'Блок кода',
    title: 'Блок кода (Ctrl+Shift+C)',
    key: 'Mod-Shift-c',
    run: insertCodeBlock,
  },
  { label: 'Таблица', title: 'Таблица', run: insertTable },
]

export const markdownKeymap = keymap.of([
  ...formatCommands
    .filter((command) => command.key)
    .map(({ key, run }) => ({ key, run })),
  ...headingLevels.map((level) => ({
    key: `Mod-Alt-${level}`,
    run: (view) => setHeading(view, level),
  })),
])
