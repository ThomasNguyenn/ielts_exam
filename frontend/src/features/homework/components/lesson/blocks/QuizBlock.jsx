import {
  Drawer,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
  DrawerTrigger,
} from "@/components/ui/drawer";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import {
  buildQuizQuestionKey,
  resolveQuizLayout,
  resolveQuizQuestions,
  resolveTaskBlockId,
} from "./blockUtils";
import RichTextBlock from "./RichTextBlock";
import BlockSurfaceCard from "./shared/BlockSurfaceCard";
import BlockHeader from "./shared/BlockHeader";

export default function QuizBlock({
  block,
  titlePrefix = "Quiz",
  selectedOptionsByQuestionKey = {},
  onSelectOption,
  disabled = false,
  showQuestionPalette = false,
  variant = "default",
}) {
  const questions = resolveQuizQuestions(block);
  if (!questions.length) return null;

  const blockId = resolveTaskBlockId(block);
  const quizLayout = resolveQuizLayout(block);
  const answeredCount = questions.reduce((count, questionItem, questionIndex) => {
    const questionKey = buildQuizQuestionKey({
      blockId,
      questionId: questionItem.id,
      questionIndex,
    });
    return selectedOptionsByQuestionKey[questionKey] ? count + 1 : count;
  }, 0);

  const quizPanel = (
    <BlockSurfaceCard
      className={cn(
        "border-sky-200 bg-gradient-to-br from-white via-sky-50/60 to-white",
        variant === "passage" && "border-slate-200 bg-white",
      )}
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <BlockHeader
          title={titlePrefix}
          description={`${answeredCount}/${questions.length} ${"\u0063\u00E2\u0075 \u0111\u00E3 \u0074\u0072\u1EA3 \u006C\u1EDDi"}`}
        />
        <Badge variant="secondary" className="rounded-full px-3 py-1 text-xs font-semibold">
          {questions.length} {"\u0063\u00E2\u0075"}
        </Badge>
      </div>

      <div className="space-y-3">
        {questions.map((questionItem, questionIndex) => {
          const questionKey = buildQuizQuestionKey({
            blockId,
            questionId: questionItem.id,
            questionIndex,
          });
          return (
            <div
              key={questionItem.id || `${resolveTaskBlockId(block)}-question-${questionIndex}`}
              className="space-y-3 rounded-2xl border border-dashed border-slate-300 bg-white/90 p-3"
            >
              {questions.length > 1 ? (
                <p className="text-xs font-bold uppercase tracking-wide text-slate-500">
                  Question {questionIndex + 1}
                </p>
              ) : null}

              <RichTextBlock value={questionItem.question} className="text-sm leading-7 text-slate-800" />

              {questionItem.options.length ? (
                <div className={cn("grid gap-2", quizLayout === "grid" && "md:grid-cols-2")}>
                  {questionItem.options.map((option, optionIndex) => {
                    const isSelected = selectedOptionsByQuestionKey[questionKey] === String(option?.id || "");
                    return (
                      <Button
                        key={String(option?.id || `${questionItem.id}-option-${optionIndex}`)}
                        type="button"
                        variant={isSelected ? "default" : "outline"}
                        className={cn("h-auto items-start justify-start gap-2 whitespace-normal py-2 text-left")}
                        onClick={() => onSelectOption?.({
                          questionKey,
                          optionId: String(option?.id || ""),
                        })}
                        disabled={disabled}
                      >
                        <span className="inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full border border-current text-xs font-bold">
                          {String.fromCharCode(65 + optionIndex)}
                        </span>
                        <span className="text-sm leading-6">
                          {String(option?.text || "").trim() || `Option ${optionIndex + 1}`}
                        </span>
                      </Button>
                    );
                  })}
                </div>
              ) : null}
            </div>
          );
        })}
      </div>

      <p className="text-xs text-slate-500">Lựa chọn được lưu cục bộ trong khi bạn làm bài.</p>
    </BlockSurfaceCard>
  );

  return (
    <div className="space-y-3">
      <div className="hidden md:block">{quizPanel}</div>
      <div className="md:hidden">
        <Drawer>
          <DrawerTrigger asChild>
            <Button type="button" className="w-full rounded-2xl" disabled={disabled}>
              Mở quiz ({answeredCount}/{questions.length})
            </Button>
          </DrawerTrigger>
          <DrawerContent className="max-h-[88vh]">
            <DrawerHeader>
              <DrawerTitle>{titlePrefix}</DrawerTitle>
            </DrawerHeader>
            <div className="max-h-[72vh] overflow-y-auto px-4 pb-4">{quizPanel}</div>
          </DrawerContent>
        </Drawer>
      </div>
    </div>
  );
}
