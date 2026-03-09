const DEFAULT_LESSON_XP = 100;
const DEFAULT_CHEST_XP = 200;
const DEFAULT_CHEST_INTERVAL = 3;

const OFFSET_CLASSES = [
  "self-center",
  "self-end mr-4 md:mr-16",
  "self-start ml-4 md:ml-16",
  "self-end mr-3 md:mr-10",
  "self-start ml-3 md:ml-10",
];

const toNumber = (value, fallback = 0) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
};

const normalizeOrder = (value, fallback = 0) =>
  Number.isFinite(Number(value)) ? Number(value) : fallback;

const clampPercent = (value) => {
  const parsed = toNumber(value, 0);
  if (parsed < 0) return 0;
  if (parsed > 100) return 100;
  return Math.round(parsed);
};

export const buildSectionGroups = ({ assignment, tasks = [] }) => {
  const rawSections = Array.isArray(assignment?.sections) ? assignment.sections : [];
  const normalizedSections = rawSections
    .map((section, sectionIndex) => ({
      ...section,
      __sourceIndex: sectionIndex,
      __order: normalizeOrder(section?.order, sectionIndex),
    }))
    .sort((a, b) => (a.__order === b.__order ? a.__sourceIndex - b.__sourceIndex : a.__order - b.__order))
    .map((section, sectionIndex) => {
      const lessons = (Array.isArray(section?.lessons) ? section.lessons : [])
        .map((lesson, lessonIndex) => ({
          ...lesson,
          __sourceIndex: lessonIndex,
          __order: normalizeOrder(lesson?.order, lessonIndex),
        }))
        .sort((a, b) => (a.__order === b.__order ? a.__sourceIndex - b.__sourceIndex : a.__order - b.__order))
        .map(({ __sourceIndex, __order, ...lesson }) => lesson);

      const title = String(section?.name || section?.title || "").trim() || `Section ${sectionIndex + 1}`;
      return {
        _id: section?._id || `section-${sectionIndex}`,
        title,
        lessons,
      };
    })
    .filter((section) => section.lessons.length > 0);

  if (normalizedSections.length > 0) return normalizedSections;

  const fallbackTasks = Array.isArray(tasks) ? tasks : [];
  return fallbackTasks.length > 0
    ? [
        {
          _id: "section-fallback",
          title: "Lessons",
          lessons: fallbackTasks.map((task) => ({
            _id: task?._id,
            name: task?.title || "",
            title: task?.title || "",
            instruction: task?.instruction || "",
          })),
        },
      ]
    : [];
};

export const resolveRewardConfig = (assignment = {}) => ({
  lessonXp: toNumber(assignment?.reward_path?.lesson_xp, DEFAULT_LESSON_XP) || DEFAULT_LESSON_XP,
  chestXp: toNumber(assignment?.reward_path?.chest_xp, DEFAULT_CHEST_XP) || DEFAULT_CHEST_XP,
  chestInterval: Math.max(1, toNumber(assignment?.reward_path?.chest_interval, DEFAULT_CHEST_INTERVAL) || DEFAULT_CHEST_INTERVAL),
});

const buildFlattenLessons = ({ sectionGroups = [], submissionsByTaskId }) => {
  const rows = [];
  const submissionMap = submissionsByTaskId instanceof Map ? submissionsByTaskId : new Map();
  sectionGroups.forEach((section, sectionIndex) => {
    const sectionTitle = String(section?.title || `Section ${sectionIndex + 1}`).trim();
    (Array.isArray(section?.lessons) ? section.lessons : []).forEach((lesson, lessonIndex) => {
      const taskId = String(lesson?._id || "");
      const submission = submissionMap.get(taskId);
      const isDone = Boolean(submission);
      const lessonTitle = String(lesson?.name || lesson?.title || "").trim() || `Lesson ${lessonIndex + 1}`;
      rows.push({
        key: taskId || `lesson-${sectionIndex}-${lessonIndex}`,
        taskId,
        sectionTitle,
        lessonTitle,
        lessonIndex,
        isDone,
        submission,
      });
    });
  });
  return rows;
};

const buildChestMetaByRequiredLessons = ({
  assignment,
  completedLessons,
  totalLessons,
  rewardConfig,
}) => {
  const fromApi = Array.isArray(assignment?.reward_path?.chest_nodes) ? assignment.reward_path.chest_nodes : [];
  const fromApiMap = new Map();
  fromApi.forEach((node) => {
    const requiredLessons = toNumber(node?.required_lessons, 0);
    if (!requiredLessons) return;
    const chestKey = String(node?.chest_key || `chest-${requiredLessons}`).trim();
    fromApiMap.set(requiredLessons, {
      chestKey,
      requiredLessons,
      xpAmount: toNumber(node?.xp_amount, rewardConfig.chestXp) || rewardConfig.chestXp,
      claimed: Boolean(node?.claimed),
      unlocked: Boolean(node?.unlocked),
      claimedAt: String(node?.claimed_at || "").trim() || null,
    });
  });

  const claimedSet = new Set(
    (Array.isArray(assignment?.reward_claims?.claimed_chest_keys) ? assignment.reward_claims.claimed_chest_keys : [])
      .map((value) => String(value || "").trim())
      .filter(Boolean),
  );

  const milestones = [];
  for (let value = rewardConfig.chestInterval; value <= totalLessons; value += rewardConfig.chestInterval) {
    milestones.push(value);
  }

  return milestones.map((requiredLessons) => {
    const fromApiValue = fromApiMap.get(requiredLessons) || null;
    const chestKey = fromApiValue?.chestKey || `chest-${requiredLessons}`;
    const claimed = fromApiValue?.claimed || claimedSet.has(chestKey);
    const unlocked = fromApiValue?.unlocked ?? (completedLessons >= requiredLessons);
    return {
      chestKey,
      requiredLessons,
      xpAmount: fromApiValue?.xpAmount || rewardConfig.chestXp,
      claimed,
      unlocked,
      claimedAt: fromApiValue?.claimedAt || null,
    };
  });
};

const resolveOffsetClass = (index) => OFFSET_CLASSES[index % OFFSET_CLASSES.length];

export const buildJourneyViewModel = ({
  assignment,
  sectionGroups = [],
  submissionsByTaskId,
}) => {
  const rewardConfig = resolveRewardConfig(assignment);
  const lessons = buildFlattenLessons({ sectionGroups, submissionsByTaskId });
  const totalLessons = lessons.length;
  const doneLessonsCount = lessons.reduce((count, lesson) => (lesson.isDone ? count + 1 : count), 0);
  const completedLessons = toNumber(assignment?.reward_path?.completed_lessons, doneLessonsCount);
  const firstPendingIndex = lessons.findIndex((lesson) => !lesson.isDone);
  const currentLessonIndex = firstPendingIndex >= 0 ? firstPendingIndex : -1;

  const chestMeta = buildChestMetaByRequiredLessons({
    assignment,
    completedLessons,
    totalLessons,
    rewardConfig,
  });
  const chestMetaByMilestone = new Map(chestMeta.map((item) => [item.requiredLessons, item]));

  const lessonNodes = lessons.map((lesson, lessonIndex) => {
    const isCurrent = lessonIndex === currentLessonIndex;
    const status = lesson.isDone ? "done" : isCurrent ? "current" : "open";
    return {
      kind: "lesson",
      key: lesson.key,
      taskId: lesson.taskId,
      title: lesson.lessonTitle,
      sectionTitle: lesson.sectionTitle,
      status,
      xp: rewardConfig.lessonXp,
      actionLabel: status === "done" ? "Review" : status === "current" ? "Start lesson" : "Open lesson",
      offsetClass: "",
    };
  });

  const nodes = [];
  lessonNodes.forEach((lesson, lessonIndex) => {
    nodes.push({
      ...lesson,
      offsetClass: resolveOffsetClass(nodes.length),
    });
    const milestone = lessonIndex + 1;
    if (milestone % rewardConfig.chestInterval !== 0) return;
    if (milestone > totalLessons) return;
    const chest = chestMetaByMilestone.get(milestone);
    if (!chest) return;
    nodes.push({
      kind: "chest",
      key: chest.chestKey,
      chestKey: chest.chestKey,
      requiredLessons: chest.requiredLessons,
      claimed: chest.claimed,
      unlocked: chest.unlocked,
      xp: chest.xpAmount,
      claimedAt: chest.claimedAt,
      offsetClass: resolveOffsetClass(nodes.length),
    });
  });

  const claimedChestCount = chestMeta.reduce((count, chest) => (chest.claimed ? count + 1 : count), 0);
  const progressPercent = totalLessons > 0 ? clampPercent((completedLessons / totalLessons) * 100) : 0;
  const earnedXp = (completedLessons * rewardConfig.lessonXp) + (claimedChestCount * rewardConfig.chestXp);
  const currentLesson = lessonNodes.find((node) => node.status === "current")
    || lessonNodes.find((node) => node.status !== "done")
    || null;

  return {
    rewardConfig,
    nodes,
    lessons: lessonNodes,
    progressPercent,
    completedLessons,
    totalLessons,
    claimedChestCount,
    earnedXp,
    currentLesson,
    totalChestCount: chestMeta.length,
  };
};
