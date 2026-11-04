import { defaultKeymap, history, historyKeymap } from '@codemirror/commands';
import { markdown } from '@codemirror/lang-markdown';
import { HighlightStyle, bracketMatching, syntaxHighlighting } from '@codemirror/language';
import { EditorState } from '@codemirror/state';
import {
  Decoration,
  EditorView,
  MatchDecorator,
  ViewPlugin,
  drawSelection,
  keymap,
  placeholder,
  type DecorationSet,
  type ViewUpdate,
} from '@codemirror/view';
import { tags } from '@lezer/highlight';
import { useEffect, useRef } from 'react';

export interface EditorCursor {
  line: number;
  column: number;
}

export interface MarkdownEditorProps {
  path: string;
  value: string;
  onChange: (value: string) => void;
  onSave: () => void;
  onCursorChange?: (cursor: EditorCursor) => void;
}

const highlightStyle = HighlightStyle.define([
  { tag: tags.heading1, fontWeight: '600', color: 'var(--an-text-primary)' },
  { tag: tags.heading2, fontWeight: '600', color: 'var(--an-text-primary)' },
  { tag: tags.heading3, fontWeight: '600', color: 'var(--an-text-primary)' },
  { tag: tags.heading4, fontWeight: '600', color: 'var(--an-text-secondary)' },
  { tag: tags.link, color: 'var(--an-accent)' },
  { tag: tags.url, color: 'var(--an-accent)' },
  { tag: tags.emphasis, fontStyle: 'italic' },
  { tag: tags.strong, fontWeight: '600' },
  { tag: tags.monospace, fontFamily: 'var(--an-font-code)', fontSize: 'var(--an-font-size-code)' },
  { tag: tags.quote, color: 'var(--an-text-secondary)' },
  { tag: tags.meta, color: 'var(--an-text-tertiary)' },
  { tag: tags.processingInstruction, color: 'var(--an-text-tertiary)' },
  { tag: tags.comment, color: 'var(--an-text-tertiary)' },
]);

const wikiDecorator = new MatchDecorator({
  regexp: /\[\[[^\]\n]+\]\]/g,
  decoration: Decoration.mark({ class: 'cm-wikilink' }),
});

const wikiLinks = ViewPlugin.fromClass(
  class WikiLinks {
    decorations: DecorationSet;
    constructor(view: EditorView) {
      this.decorations = wikiDecorator.createDeco(view);
    }
    update(update: ViewUpdate) {
      this.decorations = wikiDecorator.updateDeco(update, this.decorations);
    }
  },
  { decorations: (plugin) => plugin.decorations },
);

const editorTheme = EditorView.theme({
  '&': {
    height: '100%',
    backgroundColor: 'var(--an-bg-base)',
    color: 'var(--an-text-primary)',
  },
  '&.cm-focused': { outline: 'none' },
  '.cm-scroller': {
    fontFamily: 'var(--an-font-ui)',
    lineHeight: 'var(--an-line-body)',
  },
  '.cm-content': {
    maxWidth: 'var(--an-editor-max-width)',
    margin: '0 auto',
    padding: '48px 24px 40vh',
    caretColor: 'var(--an-accent)',
    fontSize: 'var(--an-font-size-body)',
  },
  '.cm-cursor, .cm-dropCursor': {
    borderLeftColor: 'var(--an-accent)',
  },
  '&.cm-focused .cm-selectionBackground, .cm-selectionBackground': {
    backgroundColor: 'color-mix(in srgb, var(--an-accent) 24%, transparent)',
  },
  '.cm-placeholder': {
    color: 'var(--an-text-tertiary)',
  },
  '.cm-wikilink': {
    color: 'var(--an-accent)',
    backgroundColor: 'color-mix(in srgb, var(--an-accent) 12%, transparent)',
    borderRadius: '4px',
  },
});

function cursorFrom(state: EditorState): EditorCursor {
  const pos = state.selection.main.head;
  const line = state.doc.lineAt(pos);
  return { line: line.number, column: pos - line.from + 1 };
}

export function MarkdownEditor({
  path,
  value,
  onChange,
  onSave,
  onCursorChange,
}: MarkdownEditorProps) {
  const hostRef = useRef<HTMLDivElement>(null);
  const viewRef = useRef<EditorView | null>(null);
  const externalRef = useRef(false);
  const onChangeRef = useRef(onChange);
  const onSaveRef = useRef(onSave);
  const onCursorRef = useRef(onCursorChange);
  onChangeRef.current = onChange;
  onSaveRef.current = onSave;
  onCursorRef.current = onCursorChange;

  useEffect(() => {
    const parent = hostRef.current;
    if (!parent) return;

    const view = new EditorView({
      parent,
      state: EditorState.create({
        doc: value,
        extensions: [
          history(),
          drawSelection(),
          bracketMatching(),
          markdown(),
          syntaxHighlighting(highlightStyle),
          wikiLinks,
          editorTheme,
          EditorView.lineWrapping,
          placeholder('开始写点什么…'),
          keymap.of([
            {
              key: 'Mod-s',
              preventDefault: true,
              run: () => {
                onSaveRef.current();
                return true;
              },
            },
            ...historyKeymap,
            ...defaultKeymap,
          ]),
          EditorView.updateListener.of((update) => {
            if (update.docChanged && !externalRef.current) {
              onChangeRef.current(update.state.doc.toString());
            }
            if (update.docChanged || update.selectionSet) {
              onCursorRef.current?.(cursorFrom(update.state));
            }
          }),
        ],
      }),
    });
    viewRef.current = view;
    onCursorRef.current?.(cursorFrom(view.state));
    view.focus();

    return () => {
      view.destroy();
      viewRef.current = null;
    };
  }, [path]);

  useEffect(() => {
    const view = viewRef.current;
    if (!view) return;
    const current = view.state.doc.toString();
    if (current === value) return;
    externalRef.current = true;
    view.dispatch({ changes: { from: 0, to: current.length, insert: value } });
    externalRef.current = false;
  }, [path, value]);

  return <div className="markdown-editor" ref={hostRef} />;
}
