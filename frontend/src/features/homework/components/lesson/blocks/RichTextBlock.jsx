import { toSanitizedInnerHtml } from "@/shared/utils/safeHtml";
import { cx, isHtmlLike } from "./blockUtils";

export default function RichTextBlock({ value, className = "text-sm text-slate-700", emptyFallback = null }) {
  const rawText = String(value || "");
  if (!rawText.trim()) return emptyFallback;
  if (!isHtmlLike(rawText)) return <p className={className}>{rawText}</p>;
  return (
    <div
      className={cx(className, "break-words")}
      dangerouslySetInnerHTML={toSanitizedInnerHtml(rawText)}
    />
  );
}


