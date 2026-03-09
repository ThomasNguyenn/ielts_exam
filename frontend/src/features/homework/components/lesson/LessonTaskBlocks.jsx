import { getTaskBlockKey, normalizeTaskBlockType } from "@/features/homework/pages/myHomeworkStudentUtils";
import {
  DictationBlock,
  FindMistakeBlock,
  GapfillBlock,
  InstructionBlock,
  MatchingBlock,
  MediaBlock,
  PassageBlock,
  QuizBlock,
  TitleBlock,
} from "./blocks";
import {
  resolveQuizParentPassageBlockId,
  resolveTaskBlockId,
} from "./blocks/blockUtils";
import { buildLessonBlockAnchorId } from "./lessonViewModel";

export default function LessonTaskBlocks({
  taskBlocks = [],
  selectedTaskId = "",
  renderContext = {},
  blockActions = {},
}) {
  const selectedTask = renderContext?.selectedTask;
  const selectedTaskIndex = renderContext?.selectedTaskIndex >= 0 ? renderContext.selectedTaskIndex : 0;
  const canInteract = Boolean(renderContext?.canInteract);
  const shouldUseDictationTranscript = Boolean(renderContext?.shouldUseDictationTranscript);
  const textAnswerPlaceholder = String(renderContext?.textAnswerPlaceholder || "Type your answer here...");

  const findMistakeSelections = blockActions?.findMistakeSelections || {};
  const gapfillSelections = blockActions?.gapfillSelections || {};
  const quizSelections = blockActions?.quizSelections || {};
  const matchingSelections = blockActions?.matchingSelections || {};
  const draft = blockActions?.draft || {};
  const lessonContentBlocks = taskBlocks.filter((block) => normalizeTaskBlockType(block?.type) !== "internal");

  const dictationBlocks = lessonContentBlocks.filter((block) => normalizeTaskBlockType(block?.type) === "dictation");
  const hasDictationBlock = dictationBlocks.length > 0;
  const primaryDictationBlockIndex = lessonContentBlocks.findIndex(
    (block) => normalizeTaskBlockType(block?.type) === "dictation",
  );
  const primaryDictationBlockId = hasDictationBlock ? resolveTaskBlockId(dictationBlocks[0]) : "";

  const passageBlockIdSet = new Set(
    lessonContentBlocks
      .filter((block) => normalizeTaskBlockType(block?.type) === "passage")
      .map((block) => resolveTaskBlockId(block))
      .filter(Boolean),
  );

  const nestedQuizBlocksByPassageId = lessonContentBlocks.reduce((grouped, block) => {
    const blockType = normalizeTaskBlockType(block?.type);
    if (blockType !== "quiz") return grouped;
    const parentPassageBlockId = resolveQuizParentPassageBlockId(block);
    if (!parentPassageBlockId) return grouped;
    if (!passageBlockIdSet.has(parentPassageBlockId)) return grouped;
    const current = grouped.get(parentPassageBlockId) || [];
    grouped.set(parentPassageBlockId, [...current, block]);
    return grouped;
  }, new Map());

  const renderers = {
    title: (props) => <TitleBlock block={props.block} />,
    instruction: (props) => <InstructionBlock value={props.block?.data?.text || ""} />,
    video: (props) => <MediaBlock block={props.block} task={props.task} taskIndex={props.taskIndex} />,
    passage: (props) => (
      <PassageBlock
        block={props.block}
        nestedQuizBlocks={props.nestedQuizBlocks}
        quizSelections={props.quizSelections}
        onSelectQuizOption={props.onSelectQuizOption}
        isQuizDisabled={props.isQuizDisabled}
      />
    ),
    quiz: (props) => (
      <QuizBlock
        block={props.block}
        selectedOptionsByQuestionKey={props.quizSelections}
        onSelectOption={props.onSelectQuizOption}
        disabled={props.isQuizDisabled}
        showQuestionPalette
      />
    ),
    matching: (props) => (
      <MatchingBlock
        block={props.block}
        matchingSelection={props.matchingSelection}
        onMatchingLeftClick={props.onMatchingLeftClick}
        onMatchingRightClick={props.onMatchingRightClick}
        isMatchingDisabled={props.isMatchingDisabled}
      />
    ),
    gapfill: (props) => (
      <GapfillBlock
        block={props.block}
        selectedByBlankKey={props.gapfillSelections}
        onChangeBlank={props.onChangeGapfillBlank}
        disabled={props.isGapfillDisabled}
      />
    ),
    find_mistake: (props) => (
      <FindMistakeBlock
        block={props.block}
        selectedByLineKey={props.findMistakeSelections}
        onSelectToken={props.onSelectFindMistakeToken}
        disabled={props.isFindMistakeDisabled}
      />
    ),
    dictation: (props) => (
      <DictationBlock
        block={props.block}
        draft={props.draft}
        onChangeTextAnswer={props.onChangeTextAnswer}
        onClearTextAnswer={props.onClearTextAnswer}
        disabled={props.isDictationDisabled}
        showTranscriptInput={props.showDictationTranscriptInput}
        textPlaceholder={props.dictationTextPlaceholder}
      />
    ),
  };

  return (
    <div className="space-y-4">
      {lessonContentBlocks.map((block, blockIndex) => {
        const blockType = normalizeTaskBlockType(block?.type);
        const parentPassageBlockId = resolveQuizParentPassageBlockId(block);
        if (
          blockType === "quiz"
          && parentPassageBlockId
          && passageBlockIdSet.has(parentPassageBlockId)
        ) {
          return null;
        }

        const renderBlock = renderers[blockType];
        if (!renderBlock) return null;

        const currentBlockId = resolveTaskBlockId(block) || `task-block-${blockIndex + 1}`;
        const blockKey = getTaskBlockKey({ taskId: selectedTaskId, block, fallbackIndex: blockIndex });
        const blockAnchorId = buildLessonBlockAnchorId({ taskId: selectedTaskId, blockKey });

        const content = renderBlock({
          block: {
            ...block,
          },
          task: selectedTask,
          taskIndex: selectedTaskIndex,
          nestedQuizBlocks:
            blockType === "passage" ? nestedQuizBlocksByPassageId.get(currentBlockId) || [] : [],
          findMistakeSelections,
          onSelectFindMistakeToken: blockActions?.onSelectFindMistakeToken,
          isFindMistakeDisabled: !canInteract,
          gapfillSelections,
          onChangeGapfillBlank: blockActions?.onChangeGapfillBlank,
          isGapfillDisabled: !canInteract,
          quizSelections,
          onSelectQuizOption: blockActions?.onSelectQuizOption,
          isQuizDisabled: !canInteract,
          matchingSelection: matchingSelections[currentBlockId] || { selected_left_id: "", matches: [] },
          onMatchingLeftClick: (leftItemId) => blockActions?.onMatchingLeftClick?.(currentBlockId, leftItemId),
          onMatchingRightClick: (rightItemId) => blockActions?.onMatchingRightClick?.(currentBlockId, rightItemId),
          isMatchingDisabled: !canInteract,
          draft,
          onChangeTextAnswer: (value) => blockActions?.onChangeTextAnswer?.(value),
          onClearTextAnswer: () => blockActions?.onClearTextAnswer?.(),
          isDictationDisabled: !canInteract,
          showDictationTranscriptInput:
            shouldUseDictationTranscript
            && (
              primaryDictationBlockId
                ? currentBlockId === primaryDictationBlockId
                : blockIndex === primaryDictationBlockIndex
            ),
          dictationTextPlaceholder: textAnswerPlaceholder,
        });

        if (!content) return null;

        return (
          <div
            key={blockKey}
            id={blockAnchorId}
            data-testid="task-content-block"
            data-task-id={selectedTaskId}
            data-block-type={blockType}
          >
            {content}
          </div>
        );
      })}
    </div>
  );
}

