import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  GAPFILL_MODE_NUMBERED,
  GAPFILL_MODE_PARAGRAPH,
  normalizeGapfillBlockData,
  parseGapfillTemplate,
} from "@/features/homework/pages/gapfill.utils";
import { resolveTaskBlockId } from "./blockUtils";
import BlockSurfaceCard from "./shared/BlockSurfaceCard";
import BlockHeader from "./shared/BlockHeader";

const EMPTY_SELECT_VALUE = "__homework_empty__";

const renderGapfillTemplateParts = ({
  parsedTemplate,
  lineKey,
  selectedByBlankKey = {},
  onChangeBlank,
  disabled = false,
}) => {
  return parsedTemplate.parts.map((part, partIndex) => {
    if (part.kind === "text") {
      return (
        <span key={`${lineKey}-text-${partIndex}`} className="whitespace-pre-wrap break-words">
          {part.text}
        </span>
      );
    }

    const blankKey = `${lineKey}:${Number.isFinite(Number(part.blankIndex)) ? Number(part.blankIndex) : partIndex}`;

    if (part.type === "choice") {
      const currentValue = String(selectedByBlankKey[blankKey] || "");
      return (
        <span key={`${lineKey}-blank-${partIndex}`} className="mx-1 inline-flex min-w-28 align-middle">
          <Select
            value={currentValue || EMPTY_SELECT_VALUE}
            onValueChange={(value) => onChangeBlank?.(blankKey, value === EMPTY_SELECT_VALUE ? "" : value)}
            disabled={disabled}
          >
            <SelectTrigger className="h-8 min-w-28 rounded-md border-slate-300 bg-white px-2 text-xs">
              <SelectValue placeholder="Choose" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={EMPTY_SELECT_VALUE}>Choose</SelectItem>
              {(Array.isArray(part.options) ? part.options : []).map((option, optionIndex) => (
                <SelectItem key={`${lineKey}-option-${partIndex}-${optionIndex}`} value={option}>
                  {option}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </span>
      );
    }

    return (
      <Input
        key={`${lineKey}-blank-${partIndex}`}
        type="text"
        className="mx-1 inline-flex h-8 min-w-24 rounded-md border-slate-300 px-2 text-xs"
        placeholder={`Blank ${(part.blankIndex || 0) + 1}`}
        value={String(selectedByBlankKey[blankKey] || "")}
        onChange={(event) => onChangeBlank?.(blankKey, event.target.value)}
        disabled={disabled}
      />
    );
  });
};

export default function GapfillBlock({
  block,
  selectedByBlankKey = {},
  onChangeBlank,
  disabled = false,
}) {
  const gapfillData = normalizeGapfillBlockData(block?.data || {});
  const prompt = String(gapfillData?.prompt || "").trim();
  const templates = gapfillData.mode === GAPFILL_MODE_PARAGRAPH
    ? [String(gapfillData?.paragraph_text || "")]
    : Array.isArray(gapfillData?.numbered_items)
      ? gapfillData.numbered_items
      : [];
  const hasContent = templates.some((template) => String(template || "").trim() !== "");
  if (!hasContent) return null;

  return (
    <BlockSurfaceCard>
      <BlockHeader title="Gap Filling" description="Điền từ vào các ô trống." />
      {prompt ? <p className="text-sm leading-7 text-slate-700">{prompt}</p> : null}

      <div className="space-y-3">
        {templates.map((template, templateIndex) => {
          const parsedTemplate = parseGapfillTemplate(template);
          const lineKey = `${resolveTaskBlockId(block)}-${templateIndex}`;

          if (gapfillData.mode === GAPFILL_MODE_NUMBERED) {
            return (
              <div key={lineKey} className="flex items-start gap-2">
                <span className="pt-1 text-xs font-medium text-slate-500">{templateIndex + 1}.</span>
                <p className="min-w-0 flex-1 break-words text-sm leading-7">
                  {renderGapfillTemplateParts({
                    parsedTemplate,
                    lineKey,
                    selectedByBlankKey,
                    onChangeBlank,
                    disabled,
                  })}
                </p>
              </div>
            );
          }

          return (
            <p key={lineKey} className="break-words text-sm leading-7">
              {renderGapfillTemplateParts({
                parsedTemplate,
                lineKey,
                selectedByBlankKey,
                onChangeBlank,
                disabled,
              })}
            </p>
          );
        })}
      </div>
    </BlockSurfaceCard>
  );
}


