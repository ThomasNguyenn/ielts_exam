const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, 'src', 'features', 'homework', 'pages', 'MyHomeworkLessonPage.jsx');
let content = fs.readFileSync(filePath, 'utf8');

// Add imports
if (!content.includes('import { Carousel,')) {
    content = content.replace(
        'import { ArrowLeft, BookOpen, CheckCircle2 } from "lucide-react";',
        `import { ArrowLeft, BookOpen, CheckCircle2 } from "lucide-react";
import {
  Carousel,
  CarouselContent,
  CarouselItem,
  CarouselNext,
  CarouselPrevious,
} from "@/components/ui/carousel";`
    );
}

// Replace Quiz body
const targetBodyStart = `<div className="homework-quiz-body">`;
const targetBodyEnd = `      <p className="homework-item-meta">Selections are kept locally on this page while you work.</p>`;

const startIndex = content.indexOf(targetBodyStart);
const endIndex = content.indexOf(targetBodyEnd);

if (startIndex !== -1 && endIndex !== -1 && startIndex < endIndex) {
    const originalBody = content.substring(startIndex, endIndex);

    // Re-write the body to use Carousel
    const newBody = `<div className="homework-quiz-body !p-0">
        <Carousel className="w-full">
          <CarouselContent>
            {questions.map((questionItem, questionIndex) => (
              <CarouselItem key={questionItem.id || \`\${resolveTaskBlockId(block)}-question-\${questionIndex}\`}>
                <div className="homework-quiz-question p-4 sm:p-6 mb-2">
                  {questions.length > 1 ? (
                    <p className="homework-quiz-question-label">
                      Question {questionIndex + 1}
                    </p>
                  ) : null}
                  {renderRichTextBlock(questionItem.question, { className: "homework-quiz-question-text" })}
                  {questionItem.options.length ? (
                    <div className={cx("homework-quiz-options", quizLayout === "grid" && "homework-quiz-options--grid")}>
                      {questionItem.options.map((option, optionIndex) => (
                        <button
                          key={String(option?.id || \`\${questionItem.id}-option-\${optionIndex}\`)}
                          type="button"
                          className={cx(
                            "homework-quiz-option",
                            selectedOptionsByQuestionKey[buildQuizQuestionKey({
                              blockId,
                              questionId: questionItem.id,
                              questionIndex,
                            })] === String(option?.id || "")
                            && "homework-quiz-option--selected",
                          )}
                          onClick={() => onSelectOption?.({
                            questionKey: buildQuizQuestionKey({
                              blockId,
                              questionId: questionItem.id,
                              questionIndex,
                            }),
                            optionId: String(option?.id || ""),
                          })}
                          disabled={disabled}
                        >
                          <span className="homework-quiz-option-key">{String.fromCharCode(65 + optionIndex)}</span>
                          <span className="homework-quiz-option-text">
                            {String(option?.text || "").trim() || \`Option \${optionIndex + 1}\`}
                          </span>
                        </button>
                      ))}
                    </div>
                  ) : null}
                </div>
              </CarouselItem>
            ))}
          </CarouselContent>
          {questions.length > 1 && (
            <div className="flex items-center justify-end gap-2 pr-6 pb-4">
              <CarouselPrevious className="static translate-y-0 translate-x-0" />
              <CarouselNext className="static translate-y-0 translate-x-0" />
            </div>
          )}
        </Carousel>
      </div>

`;

    content = content.substring(0, startIndex) + newBody + content.substring(endIndex);
}

fs.writeFileSync(filePath, content, 'utf8');
console.log('Update completed');
