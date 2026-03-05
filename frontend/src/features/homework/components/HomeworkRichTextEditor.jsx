import { useEffect, useMemo, useRef } from "react";
import { EditorContent, useEditor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Placeholder from "@tiptap/extension-placeholder";
import { Bold, Heading2, Italic, List } from "lucide-react";
import { Button } from "@/components/ui/button";

const normalizeText = (value) => String(value ?? "");

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
const cx = (...values) => values.filter(Boolean).join(" ");

export default function HomeworkRichTextEditor({
  value,
  onChange,
  placeholder = "Type here...",
  minHeight = 160,
  className,
  contentClassName,
}) {
  const lastSyncedTextRef = useRef(normalizeText(value));

  const extensions = useMemo(
    () => [
      StarterKit.configure({
        heading: { levels: [2] },
      }),
      Placeholder.configure({
        placeholder,
      }),
    ],
    [placeholder],
  );

  const editor = useEditor({
    extensions,
    content: plainTextToHtml(value),
    onUpdate: ({ editor: currentEditor }) => {
      const nextText = editorText(currentEditor);
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
    editor.commands.setContent(plainTextToHtml(incomingText), false);
    lastSyncedTextRef.current = incomingText;
  }, [editor, value]);

  if (!editor) return null;

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
      </div>

      <EditorContent
        editor={editor}
        className={cx("homework-rich-editor__content", contentClassName)}
      />
    </div>
  );
}
