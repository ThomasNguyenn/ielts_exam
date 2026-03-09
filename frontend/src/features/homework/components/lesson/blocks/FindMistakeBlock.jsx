import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { normalizeFindMistakeBlockData, parseGapfillTemplate } from "@/features/homework/pages/gapfill.utils";
import { resolveTaskBlockId } from "./blockUtils";
import BlockSurfaceCard from "./shared/BlockSurfaceCard";
import BlockHeader from "./shared/BlockHeader";

const renderFindMistakeTemplateParts = ({
  parsedTemplate,
  lineKey,
  selectedTokenKey,
  onSelectToken,
  disabled = false,
}) => {
  return parsedTemplate.parts.map((part, partIndex) => {
    if (part.kind === "text") {
      return (
        <span key={`${lineKey}-text-${partIndex}`} className="whitespace-pre-wrap">
          {part.text}
        </span>
      );
    }

    if (part.type === "choice") {
      return (
        <span key={`${lineKey}-blank-${partIndex}`} className="mx-1 inline-flex flex-wrap items-center gap-1 align-middle">
          {part.options.map((option, optionIndex) => {
            const tokenKey = `${partIndex}:${optionIndex}`;
            const isSelected = selectedTokenKey === tokenKey;
            return (
              <Button
                key={`${lineKey}-option-${partIndex}-${optionIndex}`}
                type="button"
                size="sm"
                variant={isSelected ? "default" : "outline"}
                disabled={disabled}
                className="h-7 rounded-full px-2 text-xs"
                onClick={() => onSelectToken?.(lineKey, tokenKey)}
              >
                {option}
              </Button>
            );
          })}
        </span>
      );
    }

    const tokenKey = `${partIndex}`;
    const isSelected = selectedTokenKey === tokenKey;
    return (
      <Button
        key={`${lineKey}-plain-${partIndex}`}
        type="button"
        size="sm"
        variant={isSelected ? "default" : "outline"}
        disabled={disabled}
        className={cn("mx-1 h-7 rounded-full px-2 text-xs")}
        onClick={() => onSelectToken?.(lineKey, tokenKey)}
      >
        {part.correctAnswer}
      </Button>
    );
  });
};

export default function FindMistakeBlock({
  block,
  selectedByLineKey = {},
  onSelectToken,
  disabled = false,
}) {
  const findMistakeData = normalizeFindMistakeBlockData(block?.data || {});
  const prompt = String(findMistakeData?.prompt || "").trim();
  const templates = Array.isArray(findMistakeData?.numbered_items) ? findMistakeData.numbered_items : [];
  const hasContent = templates.some((template) => String(template || "").trim() !== "");
  if (!hasContent) return null;

  return (
    <BlockSurfaceCard>
      <BlockHeader title="Find Mistake" description="Tìm lỗi sai trong từng dòng." />
      {prompt ? <p className="text-sm leading-7 text-slate-700">{prompt}</p> : null}

      <div className="space-y-3">
        {templates.map((template, templateIndex) => {
          const parsedTemplate = parseGapfillTemplate(template);
          const lineKey = `${resolveTaskBlockId(block)}-find-${templateIndex}`;
          return (
            <div key={lineKey} className="flex items-start gap-2">
              <span className="pt-2 text-xs font-medium text-slate-500">{templateIndex + 1}.</span>
              <p className="text-sm leading-7">
                {renderFindMistakeTemplateParts({
                  parsedTemplate,
                  lineKey,
                  selectedTokenKey: selectedByLineKey[lineKey] || "",
                  onSelectToken,
                  disabled,
                })}
              </p>
            </div>
          );
        })}
      </div>
    </BlockSurfaceCard>
  );
}
