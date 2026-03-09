import { Badge } from "@/components/ui/badge";
import RichTextBlock from "./RichTextBlock";
import QuizBlock from "./QuizBlock";
import BlockSurfaceCard from "./shared/BlockSurfaceCard";
import BlockHeader from "./shared/BlockHeader";
import { resolveTaskBlockId } from "./blockUtils";

export default function PassageBlock({
  block,
  nestedQuizBlocks = [],
  quizSelections,
  onSelectQuizOption,
  isQuizDisabled,
}) {
  const passageText = String(block?.data?.text || "");
  const hasPassageText = passageText.trim() !== "";

  return (
    <div className="space-y-4">
      <BlockSurfaceCard className="border-amber-300 bg-gradient-to-br from-white via-amber-50/60 to-white">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <BlockHeader
            title="Passage"
            description="Đọc đoạn văn trước, sau đó trả lời câu hỏi bên dưới."
          />
          <Badge variant="outline" className="rounded-full px-3 py-1 text-xs font-semibold">
            Reading
          </Badge>
        </div>

        {hasPassageText ? (
          <RichTextBlock value={passageText} className="text-sm leading-7 text-slate-800" />
        ) : (
          <p className="text-sm text-slate-500">Passage is empty.</p>
        )}
      </BlockSurfaceCard>

      {nestedQuizBlocks.length > 0 ? (
        <div className="space-y-3">
          {nestedQuizBlocks.map((quizBlock, quizIndex) => {
            const quizContent = (
              <QuizBlock
                block={quizBlock}
                titlePrefix={`Question Set ${quizIndex + 1}`}
                selectedOptionsByQuestionKey={quizSelections}
                onSelectOption={onSelectQuizOption}
                disabled={isQuizDisabled}
                showQuestionPalette
                variant="passage"
              />
            );

            return (
              <div
                key={resolveTaskBlockId(quizBlock) || `passage-quiz-${quizIndex}`}
                data-testid="task-content-block"
                data-block-type="quiz"
              >
                {quizContent}
              </div>
            );
          })}
        </div>
      ) : null}
    </div>
  );
}


