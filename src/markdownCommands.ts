import { EditorSelection } from '@codemirror/state'
import type { Extension } from '@codemirror/state'
import { EditorView, keymap } from '@codemirror/view'
import type { Command } from '@codemirror/view'
import {
  LuBold,
  LuCode,
  LuFileCode,
  LuItalic,
  LuLink,
  LuList,
  LuListOrdered,
  LuQuote,
  LuSquareCheck,
  LuStrikethrough,
  LuTable,
} from 'react-icons/lu'
import type { FormatCommand, HeadingLevel, Translate } from './types'

function changeLines(
	view: EditorView,
	transform: (text: string, index: number) => string,
): boolean {
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

function toggleWrap(
	view: EditorView,
	before: string,
	after: string,
	placeholder: string,
): boolean {
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

function togglePrefix(pattern: RegExp, prefix: string): Command {
  return (view) =>
    changeLines(view, (text) => (pattern.test(text) ? text.replace(pattern, '') : prefix + text))
}

function toggleOrderedList(view: EditorView): boolean {
  return changeLines(view, (text, index) =>
    /^\d+\. /.test(text) ? text.replace(/^\d+\. /, '') : `${index + 1}. ${text}`,
  )
}

export function setHeading(view: EditorView, level: HeadingLevel): boolean {
  return changeLines(view, (text) => {
    const match = text.match(/^(#{1,6}) /)
    const clean = text.replace(/^#{1,6} /, '')
		if (match?.[1]?.length === level) return clean
    return '#'.repeat(level) + ' ' + clean
  })
}

function insertLink(view: EditorView, placeholder: string): boolean {
  const { state } = view
  const { from, to } = state.selection.main
  const label = state.sliceDoc(from, to) || placeholder
  const url = 'https://'
  const urlFrom = from + label.length + 3

  view.dispatch({
    changes: { from, to, insert: `[${label}](${url})` },
    selection: EditorSelection.range(urlFrom, urlFrom + url.length),
  })
  return true
}

function insertCodeBlock(view: EditorView): boolean {
  const { state } = view
  const { from, to } = state.selection.main
  const body = state.sliceDoc(from, to)

  view.dispatch({
    changes: { from, to, insert: '```\n' + body + '\n```' },
    selection: EditorSelection.range(from + 4, from + 4 + body.length),
  })
  return true
}

function insertTable(
	view: EditorView,
	firstColumn: string,
	secondColumn: string,
): boolean {
  const { state } = view
  const line = state.doc.lineAt(state.selection.main.from)
  const lead = line.text ? '\n\n' : ''
  const table = `| ${firstColumn} | ${secondColumn} |\n| --- | --- |\n|  |  |`
  const start = line.to + lead.length + 2

  view.dispatch({
    changes: { from: line.to, insert: lead + table },
    selection: EditorSelection.range(start, start + firstColumn.length),
  })
  return true
}

export const headingLevels = [1, 2, 3, 4, 5, 6] as const satisfies readonly HeadingLevel[]

export function createFormatCommands(t: Translate): FormatCommand[] {
  const text = t('format.textPlaceholder')

  return [
    {
      id: 'bold',
      group: 'inline',
      icon: LuBold,
      title: t('format.bold'),
      key: 'Mod-b',
      run: (view) => toggleWrap(view, '**', '**', text),
    },
    {
      id: 'italic',
      group: 'inline',
      icon: LuItalic,
      title: t('format.italic'),
      key: 'Mod-i',
      run: (view) => toggleWrap(view, '*', '*', text),
    },
    {
      id: 'strike',
      group: 'inline',
      icon: LuStrikethrough,
      title: t('format.strike'),
      key: 'Mod-Shift-x',
      run: (view) => toggleWrap(view, '~~', '~~', text),
    },
    {
      id: 'code',
      group: 'inline',
      icon: LuCode,
      title: t('format.code'),
      key: 'Mod-e',
      run: (view) => toggleWrap(view, '`', '`', text),
    },
    {
      id: 'list',
      group: 'block',
      icon: LuList,
      title: t('format.list'),
      run: togglePrefix(/^- /, '- '),
    },
    {
      id: 'ordered',
      group: 'block',
      icon: LuListOrdered,
      title: t('format.ordered'),
      run: toggleOrderedList,
    },
    {
      id: 'quote',
      group: 'block',
      icon: LuQuote,
      title: t('format.quote'),
      key: 'Mod-Shift-q',
      run: togglePrefix(/^> /, '> '),
    },
    {
      id: 'checklist',
      group: 'block',
      icon: LuSquareCheck,
      title: t('format.checklist'),
      run: togglePrefix(/^- \[[ xX]\] /, '- [ ] '),
    },
    {
      id: 'link',
      group: 'insert',
      icon: LuLink,
      title: t('format.link'),
      key: 'Mod-k',
      run: (view) => insertLink(view, text),
    },
    {
      id: 'codeblock',
      group: 'insert',
      icon: LuFileCode,
      title: t('format.codeBlock'),
      key: 'Mod-Shift-c',
      run: insertCodeBlock,
    },
    {
      id: 'table',
      group: 'insert',
      icon: LuTable,
      title: t('format.table'),
      run: (view) =>
        insertTable(view, t('format.tableColumn1'), t('format.tableColumn2')),
    },
  ]
}

export function createMarkdownKeymap(t: Translate): Extension {
  const commands = createFormatCommands(t)

  return keymap.of([
		...commands
			.filter(
				(command): command is FormatCommand & { key: string } =>
					command.key !== undefined,
			)
			.map(({ key, run }) => ({ key, run })),
    ...headingLevels.map((level) => ({
      key: `Mod-Alt-${level}`,
	      run: (view: EditorView) => setHeading(view, level),
    })),
  ])
}
