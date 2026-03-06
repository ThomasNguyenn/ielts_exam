import { useEffect, useMemo, useRef } from "react";
import { EditorContent, useEditor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Placeholder from "@tiptap/extension-placeholder";
import Link from "@tiptap/extension-link";
import { Bold, Heading2, Italic, Link2, List, Unlink } from "lucide-react";
import { Button } from "@/components/ui/button";

const normalizeText = (value) => String(value ?? "");
const HTML_TAG_PATTERN = /<\/?[a-z][\s\S]*>/i;

const escapeHtml = (value) =>
  String(value || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");

const plainTextToHtml = (value) => {
  const normalized = normalizeText(value);
  if (!normalized.trim()) return "<p></p>";
  return normalized
    .split(/\n{2,}/)
    .map((paragraph) => `<p>${escapeHtml(paragraph).replace(/\n/g, "<br />")}</p>`)
    .join("");
};

const editorText = (editor) => editor.getText({ blockSeparator: "\n\n" });
const isHtmlValue = (value) => HTML_TAG_PATTERN.test(normalizeText(value));
const toEditorHtml = (value) => {
  const normalized = normalizeText(value);
  if (!normalized.trim()) return "<p></p>";
  return isHtmlValue(normalized) ? normalized : plainTextToHtml(normalized);
};
const getEditorOutputValue = (editor, outputFormat) => {
  if (outputFormat === "text") return editorText(editor);
  return editorText(editor).trim() ? editor.getHTML() : "";
};
const normalizeLinkHref = (value) => {
  const href = String(value || "").trim();
  if (!href) return "";
  if (/^(https?:\/\/|mailto:)/i.test(href)) return href;
  if (/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(href)) return `mailto:${href}`;
  if (/^(\/|#)/.test(href)) return href;
  return `https://${href}`;
};
const cx = (...values) => values.filter(Boolean).join(" ");

export default function HomeworkRichTextEditor({
  value,
  onChange,
  placeholder = "Type here...",
  minHeight = 160,
  className,
  contentClassName,
  outputFormat = "html",
}) {
  const lastSyncedTextRef = useRef(normalizeText(value));
  const outputFormatRef = useRef(outputFormat);

  useEffect(() => {
    outputFormatRef.current = outputFormat;
  }, [outputFormat]);

  const extensions = useMemo(
    () => [
      StarterKit.configure({
        heading: { levels: [2] },
      }),
      Link.configure({
        openOnClick: false,
        autolink: true,
        protocols: ["http", "https", "mailto"],
      }),
      Placeholder.configure({
        placeholder,
      }),
    ],
    [placeholder],
  );

  const editor = useEditor({
    extensions,
    content: toEditorHtml(value),
    onUpdate: ({ editor: currentEditor }) => {
      const nextText = getEditorOutputValue(currentEditor, outputFormatRef.current);
      lastSyncedTextRef.current = nextText;
      onChange?.(nextText);
    },
    editorProps: {
      attributes: {
        class: "homework-rich-editor__prosemirror",
      },
    },
  });

  useEffect(() => {
    if (!editor) return;
    const incomingText = normalizeText(value);
    if (incomingText === lastSyncedTextRef.current) return;
    editor.commands.setContent(toEditorHtml(incomingText), false);
    lastSyncedTextRef.current = incomingText;
  }, [editor, value]);

  if (!editor) return null;

  const wrapSelectionWithBrackets = () => {
    const { from, to, empty } = editor.state.selection;
    if (empty) {
      editor
        .chain()
        .focus()
        .insertContentAt({ from, to }, "[]")
        .setTextSelection(from + 1)
        .run();
      return;
    }
    const selectedText = editor.state.doc.textBetween(from, to, "\n");
    editor
      .chain()
      .focus()
      .insertContentAt({ from, to }, `[${selectedText}]`)
      .run();
  };

  const setOrEditLink = () => {
    const previousHref = editor.getAttributes("link")?.href || "";
    const rawHref = window.prompt("Nhập URL liên kết", previousHref);
    if (rawHref == null) return;

    const href = normalizeLinkHref(rawHref);
    if (!href) {
      editor.chain().focus().extendMarkRange("link").unsetLink().run();
      return;
    }

    editor.chain().focus().extendMarkRange("link").setLink({ href }).run();
  };

  const unsetLink = () => {
    editor.chain().focus().extendMarkRange("link").unsetLink().run();
  };

  return (
    <div
      className={cx("homework-rich-editor", className)}
      style={{ "--homework-editor-min-height": `${Math.max(96, Number(minHeight) || 160)}px` }}
    >
      <div className="homework-rich-editor__toolbar">
        <Button
          type="button"
          size="icon"
          variant={editor.isActive("bold") ? "default" : "outline"}
          className="h-8 w-8"
          onMouseDown={(event) => event.preventDefault()}
          onClick={() => editor.chain().focus().toggleBold().run()}
          aria-label="Toggle bold"
        >
          <Bold className="h-4 w-4" />
        </Button>

        <Button
          type="button"
          size="icon"
          variant={editor.isActive("italic") ? "default" : "outline"}
          className="h-8 w-8"
          onMouseDown={(event) => event.preventDefault()}
          onClick={() => editor.chain().focus().toggleItalic().run()}
          aria-label="Toggle italic"
        >
          <Italic className="h-4 w-4" />
        </Button>

        <Button
          type="button"
          size="icon"
          variant={editor.isActive("heading", { level: 2 }) ? "default" : "outline"}
          className="h-8 w-8"
          onMouseDown={(event) => event.preventDefault()}
          onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}
          aria-label="Toggle heading"
        >
          <Heading2 className="h-4 w-4" />
        </Button>

        <Button
          type="button"
          size="icon"
          variant={editor.isActive("bulletList") ? "default" : "outline"}
          className="h-8 w-8"
          onMouseDown={(event) => event.preventDefault()}
          onClick={() => editor.chain().focus().toggleBulletList().run()}
          aria-label="Toggle bullet list"
        >
          <List className="h-4 w-4" />
        </Button>

        <Button
          type="button"
          size="icon"
          variant={editor.isActive("link") ? "default" : "outline"}
          className="h-8 w-8"
          onMouseDown={(event) => event.preventDefault()}
          onClick={setOrEditLink}
          aria-label="Insert or edit link"
        >
          <Link2 className="h-4 w-4" />
        </Button>

        <Button
          type="button"
          size="icon"
          variant="outline"
          className="h-8 w-8"
          onMouseDown={(event) => event.preventDefault()}
          onClick={unsetLink}
          aria-label="Remove link"
          disabled={!editor.isActive("link")}
        >
          <Unlink className="h-4 w-4" />
        </Button>

        <Button
          type="button"
          variant="outline"
          className="h-8 px-2 text-xs font-semibold"
          onMouseDown={(event) => event.preventDefault()}
          onClick={wrapSelectionWithBrackets}
          aria-label="Wrap selection with brackets"
        >
          []
        </Button>
      </div>

      <EditorContent
        editor={editor}
        className={cx("homework-rich-editor__content", contentClassName)}
      />
    </div>
  );
}
