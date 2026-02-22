import { useCallback, useEffect, useRef, useState } from 'react';
import './LessonEditor.css';

export default function LessonEditor({ value = '', onChange }) {
  const [lessonContent, setLessonContent] = useState('');
  const editorRef = useRef(null);
  const savedRangeRef = useRef(null);

  useEffect(() => {
    const nextValue = typeof value === 'string' ? value : '';
    setLessonContent(nextValue);
    if (editorRef.current && editorRef.current.innerHTML !== nextValue) {
      editorRef.current.innerHTML = nextValue;
    }
  }, [value]);

  const emitChange = useCallback(() => {
    if (!editorRef.current) return;
    const html = editorRef.current.innerHTML;
    setLessonContent(html);
    if (onChange) onChange(html);
  }, [onChange]);

  const saveSelection = useCallback(() => {
    const selection = window.getSelection();
    if (!selection || selection.rangeCount === 0 || !editorRef.current) return;
    const range = selection.getRangeAt(0);
    if (editorRef.current.contains(range.commonAncestorContainer)) {
      savedRangeRef.current = range.cloneRange();
    }
  }, []);

  const restoreSelection = useCallback(() => {
    const selection = window.getSelection();
    if (!selection || !savedRangeRef.current) return;
    selection.removeAllRanges();
    selection.addRange(savedRangeRef.current);
  }, []);

  const runCommand = useCallback(
    (command, commandValue = null) => {
      if (!editorRef.current) return;
      editorRef.current.focus();
      restoreSelection();
      document.execCommand(command, false, commandValue);
      emitChange();
      saveSelection();
    },
    [emitChange, restoreSelection, saveSelection],
  );

  const handleInsertLink = useCallback(() => {
    if (!editorRef.current) return;
    editorRef.current.focus();
    restoreSelection();
    const url = window.prompt('Enter URL', 'https://');
    if (!url) return;
    editorRef.current.focus();
    restoreSelection();
    document.execCommand('createLink', false, url.trim());
    emitChange();
    saveSelection();
  }, [emitChange, restoreSelection, saveSelection]);

  const handleTextColor = useCallback(() => {
    if (!editorRef.current) return;
    const color = window.prompt('Enter text color (hex or CSS color):', '#1d2327');
    if (!color) return;
    runCommand('foreColor', color.trim());
  }, [runCommand]);

  const runToolbarAction = useCallback((event, action) => {
    event.preventDefault();
    action();
  }, []);

  return (
    <div className="lesson-editor" data-html-length={lessonContent.length}>
      <div className="lesson-editor-toolbar" role="toolbar" aria-label="Lesson formatting toolbar">
        <button type="button" className="lesson-editor-btn" onMouseDown={(event) => runToolbarAction(event, () => runCommand('bold'))} title="Bold">
          B
        </button>
        <button type="button" className="lesson-editor-btn" onMouseDown={(event) => runToolbarAction(event, () => runCommand('italic'))} title="Italic">
          I
        </button>
        <button type="button" className="lesson-editor-btn" onMouseDown={(event) => runToolbarAction(event, () => runCommand('underline'))} title="Underline">
          U
        </button>
        <button type="button" className="lesson-editor-btn" onMouseDown={(event) => runToolbarAction(event, handleTextColor)} title="Text color">
          Color
        </button>
        <button type="button" className="lesson-editor-btn" onMouseDown={(event) => runToolbarAction(event, () => runCommand('formatBlock', '<h1>'))} title="Heading 1">
          H1
        </button>
        <button type="button" className="lesson-editor-btn" onMouseDown={(event) => runToolbarAction(event, () => runCommand('formatBlock', '<h2>'))} title="Heading 2">
          H2
        </button>
        <button type="button" className="lesson-editor-btn" onMouseDown={(event) => runToolbarAction(event, () => runCommand('formatBlock', '<h3>'))} title="Heading 3">
          H3
        </button>
        <button
          type="button"
          className="lesson-editor-btn"
          onMouseDown={(event) => runToolbarAction(event, () => runCommand('insertUnorderedList'))}
          title="Bullet list"
        >
          Bullets
        </button>
        <button
          type="button"
          className="lesson-editor-btn"
          onMouseDown={(event) => runToolbarAction(event, () => runCommand('insertOrderedList'))}
          title="Numbered list"
        >
          Numbered
        </button>
        <button type="button" className="lesson-editor-btn" onMouseDown={(event) => runToolbarAction(event, handleInsertLink)} title="Insert link">
          Link
        </button>
        <button type="button" className="lesson-editor-btn" onMouseDown={(event) => runToolbarAction(event, () => runCommand('undo'))} title="Undo">
          Undo
        </button>
        <button type="button" className="lesson-editor-btn" onMouseDown={(event) => runToolbarAction(event, () => runCommand('redo'))} title="Redo">
          Redo
        </button>
      </div>

      <div
        ref={editorRef}
        className="lesson-editor-content"
        contentEditable
        suppressContentEditableWarning
        onInput={() => {
          emitChange();
          saveSelection();
        }}
        onBlur={emitChange}
        onMouseUp={saveSelection}
        onKeyUp={saveSelection}
        onFocus={saveSelection}
        data-placeholder="Write lesson content..."
      />
    </div>
  );
}
