import os

file_path = "src/features/homework/pages/MyHomeworkLessonPage.jsx"
with open(file_path, "r", encoding="utf-8") as f:
    content = f.read()

# Add imports
import_target = 'import { ArrowLeft, BookOpen, CheckCircle2 } from "lucide-react";'
import_replacement = '''import { ArrowLeft, BookOpen, CheckCircle2 } from "lucide-react";
import {
  Carousel,
  CarouselContent,
  CarouselItem,
  CarouselNext,
  CarouselPrevious,
} from "@/components/ui/carousel";'''

if "Carousel," not in content:
    content = content.replace(import_target, import_replacement)

# Replace Body
body_start = '<div className="homework-quiz-body">'
body_end = '      <p className="homework-item-meta">Selections are kept locally on this page while you work.</p>'

start_idx = content.find(body_start)
end_idx = content.find(body_end)

if start_idx != -1 and end_idx != -1 and start_idx < end_idx:
    new_body = '''<div className="homework-quiz-body !p-0">
        <Carousel className="w-full">
          <CarouselContent>
            {questions.map((questionItem, questionIndex) => (
              <CarouselItem key={questionItem.id || `${resolveTaskBlockId(block)}-question-${questionIndex}`}>
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
                          key={String(option?.id || `${questionItem.id}-option-${optionIndex}`)}
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
                            {String(option?.text || "").trim() || `Option ${optionIndex + 1}`}
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
            <div className="flex justify-end gap-2 pr-6 pb-4">
              <CarouselPrevious className="static translate-y-0 translate-x-0" />
              <CarouselNext className="static translate-y-0 translate-x-0" />
            </div>
          )}
        </Carousel>
      </div>

'''
    content = content[:start_idx] + new_body + content[end_idx:]

with open(file_path, "w", encoding="utf-8") as f:
    f.write(content)

print("Patch applied successfully.")
