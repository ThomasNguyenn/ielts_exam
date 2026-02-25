export const DEFAULT_TARGETS = Object.freeze({
  listening: 0,
  reading: 0,
  writing: 0,
  speaking: 0,
});

export const DEFAULT_DASHBOARD = Object.freeze({
  summary: {
    totalMockTests: 0,
    weeklyDelta: 0,
    averageBandScore: 0,
    averageBandDelta: 0,
    totalStudyHours: 0,
    remainingStudyHours: 0,
  },
  skills: {
    reading: { band: 0, progressPct: 0 },
    listening: { band: 0, progressPct: 0 },
    speaking: { band: 0, progressPct: 0 },
    writing: { band: 0, progressPct: 0 },
  },
  badges: [],
  recentActivities: [],
});

export const SKILL_ORDER = ["reading", "listening", "speaking", "writing"];

export const SKILL_META = Object.freeze({
  reading: {
    label: "Reading",
    chipClass: "text-[#1152d4] bg-[#1152d4]/10",
    barClass: "bg-[#1152d4]",
  },
  listening: {
    label: "Listening",
    chipClass: "text-green-600 bg-green-500/10",
    barClass: "bg-green-500",
  },
  speaking: {
    label: "Speaking",
    chipClass: "text-amber-500 bg-amber-500/10",
    barClass: "bg-amber-500",
  },
  writing: {
    label: "Writing",
    chipClass: "text-amber-500 bg-amber-500/10",
    barClass: "bg-amber-500",
  },
});

const BADGE_TEMPLATES = Object.freeze([
  {
    key: "writing_warrior",
    title: "Writing Warrior",
    subtitle: "Submitted 20 Essays",
    icon: "military_tech",
    unlocked: true,
    level: 3,
    iconClass: "text-yellow-600",
    shellClass:
      "relative size-20 rounded-full bg-gradient-to-b from-yellow-100 to-yellow-50 flex items-center justify-center border-4 border-yellow-200 shadow-sm group-hover:scale-105 transition-transform",
    levelClass:
      "absolute -bottom-1 bg-yellow-500 text-white text-[10px] font-bold px-2 py-0.5 rounded-full",
    wrapperClass: "flex flex-col items-center text-center gap-3 group",
  },
  {
    key: "vocab_master",
    title: "Vocab Master",
    subtitle: "Learned 500 words",
    icon: "psychology",
    unlocked: true,
    level: 2,
    iconClass: "text-slate-500",
    shellClass:
      "relative size-20 rounded-full bg-gradient-to-b from-slate-100 to-slate-50 flex items-center justify-center border-4 border-slate-300 shadow-sm group-hover:scale-105 transition-transform",
    levelClass:
      "absolute -bottom-1 bg-slate-400 text-white text-[10px] font-bold px-2 py-0.5 rounded-full",
    wrapperClass: "flex flex-col items-center text-center gap-3 group",
  },
  {
    key: "streak_7_day",
    title: "7-Day Streak",
    subtitle: "Consistent learner",
    icon: "local_fire_department",
    unlocked: true,
    level: 1,
    iconClass: "text-orange-600",
    shellClass:
      "relative size-20 rounded-full bg-gradient-to-b from-orange-100 to-orange-50 flex items-center justify-center border-4 border-orange-200 shadow-sm group-hover:scale-105 transition-transform",
    levelClass:
      "absolute -bottom-1 bg-orange-500 text-white text-[10px] font-bold px-2 py-0.5 rounded-full",
    wrapperClass: "flex flex-col items-center text-center gap-3 group",
  },
  {
    key: "speaking_pro",
    title: "Speaking Pro",
    subtitle: "Complete 5 mock interviews",
    icon: "record_voice_over",
    unlocked: false,
    level: 0,
    iconClass: "text-slate-400",
    shellClass:
      "relative size-20 rounded-full bg-slate-100 flex items-center justify-center border-4 border-slate-200 border-dashed",
    wrapperClass:
      "flex flex-col items-center text-center gap-3 group opacity-60 grayscale hover:grayscale-0 transition-all cursor-help relative",
    tooltip: "Score Band 7.0+ in 3 consecutive speaking tests to unlock.",
  },
  {
    key: "grammar_guru",
    title: "Grammar Guru",
    subtitle: "Score 100% in Grammar",
    icon: "workspace_premium",
    unlocked: false,
    level: 0,
    iconClass: "text-slate-400",
    shellClass:
      "relative size-20 rounded-full bg-slate-100 flex items-center justify-center border-4 border-slate-200 border-dashed",
    wrapperClass:
      "flex flex-col items-center text-center gap-3 group opacity-60 grayscale hover:grayscale-0 transition-all cursor-help relative",
  },
]);

const ACTIVITY_VISUAL = Object.freeze({
  writing: {
    icon: "edit_note",
    iconWrapClass: "size-8 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center",
  },
  listening: {
    icon: "headphones",
    iconWrapClass: "size-8 rounded-lg bg-purple-50 text-purple-600 flex items-center justify-center",
  },
  reading: {
    icon: "book",
    iconWrapClass: "size-8 rounded-lg bg-orange-50 text-orange-600 flex items-center justify-center",
  },
  speaking: {
    icon: "record_voice_over",
    iconWrapClass: "size-8 rounded-lg bg-teal-50 text-teal-600 flex items-center justify-center",
  },
  default: {
    icon: "task",
    iconWrapClass: "size-8 rounded-lg bg-slate-100 text-slate-500 flex items-center justify-center",
  },
});

const roundHalf = (value) => Math.round(Number(value || 0) * 2) / 2;

export const toNumber = (value, fallback = 0) => {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : fallback;
};

export const clampTarget = (value) => {
  const numeric = toNumber(value, 0);
  return Math.max(0, Math.min(9, roundHalf(numeric)));
};

export const normalizeTargets = (targets = {}) => ({
  listening: clampTarget(targets.listening),
  reading: clampTarget(targets.reading),
  writing: clampTarget(targets.writing),
  speaking: clampTarget(targets.speaking),
});

export const averageTargetBand = (targets = DEFAULT_TARGETS) => {
  const values = ["listening", "reading", "writing", "speaking"]
    .map((key) => toNumber(targets[key], 0))
    .filter((value) => value > 0);

  if (!values.length) return 0;
  return roundHalf(values.reduce((sum, value) => sum + value, 0) / values.length);
};

export const sanitizeAvatarSeed = (value, fallback = "ielts-student") => {
  const seed = String(value ?? "").trim();
  if (seed) return seed.slice(0, 120);
  return String(fallback || "ielts-student").trim().slice(0, 120);
};

export const fallbackAvatarSeed = (user = {}) => {
  const candidate = [user.avatarSeed, user.email, user.name, user._id, user.id].find((item) =>
    String(item || "").trim(),
  );
  return sanitizeAvatarSeed(candidate, "ielts-student");
};

export const createAvatarUrl = (seed) => {
  const params = new URLSearchParams({
    seed: sanitizeAvatarSeed(seed),
    backgroundColor: "b6e3f4,c0aede,d1d4f9,ffd5dc",
  });
  return `https://api.dicebear.com/9.x/micah/svg?${params.toString()}`;
};

export const formatBand = (value) => toNumber(value, 0).toFixed(1);

export const formatMemberSince = (dateValue) => {
  const date = new Date(dateValue || Date.now());
  if (Number.isNaN(date.getTime())) return "Unknown";
  return date.toLocaleDateString("en-US", { month: "short", year: "numeric" });
};

export const formatActivityDate = (dateValue) => {
  const date = new Date(dateValue || Date.now());
  if (Number.isNaN(date.getTime())) return "-";
  return date.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
};

export const formatActivityType = (value = "") =>
  String(value || "")
    .trim()
    .replace(/_/g, " ")
    .replace(/\b\w/g, (char) => char.toUpperCase());

export const scoreBadgeClass = (score, status) => {
  const completed = String(status || "").toLowerCase() === "completed";
  const numeric = Number(score);

  if (!completed || !Number.isFinite(numeric)) return "bg-slate-100 text-slate-600";
  if (numeric >= 7) return "bg-green-100 text-green-700";
  if (numeric >= 6) return "bg-yellow-100 text-yellow-700";
  return "bg-red-100 text-red-700";
};

export const normalizeDashboard = (dashboard, targets) => {
  const safeTargets = normalizeTargets(targets);
  const sourceSummary = dashboard?.summary || {};
  const sourceSkills = dashboard?.skills || {};

  const fallbackSkills = {
    reading: { band: safeTargets.reading, progressPct: Math.round((safeTargets.reading / 9) * 100) },
    listening: { band: safeTargets.listening, progressPct: Math.round((safeTargets.listening / 9) * 100) },
    speaking: { band: safeTargets.speaking, progressPct: Math.round((safeTargets.speaking / 9) * 100) },
    writing: { band: safeTargets.writing, progressPct: Math.round((safeTargets.writing / 9) * 100) },
  };

  const skills = {};
  for (const key of SKILL_ORDER) {
    skills[key] = {
      band: clampTarget(sourceSkills?.[key]?.band ?? fallbackSkills[key].band),
      progressPct: Math.max(
        0,
        Math.min(
          100,
          Math.round(toNumber(sourceSkills?.[key]?.progressPct, fallbackSkills[key].progressPct)),
        ),
      ),
    };
  }

  return {
    summary: {
      totalMockTests: Math.max(0, Math.round(toNumber(sourceSummary.totalMockTests, 0))),
      weeklyDelta: Math.max(0, Math.round(toNumber(sourceSummary.weeklyDelta, 0))),
      averageBandScore: clampTarget(sourceSummary.averageBandScore),
      averageBandDelta: roundHalf(toNumber(sourceSummary.averageBandDelta, 0)),
      totalStudyHours: Math.max(0, toNumber(sourceSummary.totalStudyHours, 0)),
      remainingStudyHours: Math.max(0, toNumber(sourceSummary.remainingStudyHours, 0)),
    },
    skills,
    badges: Array.isArray(dashboard?.badges) ? dashboard.badges : [],
    recentActivities: Array.isArray(dashboard?.recentActivities) ? dashboard.recentActivities : [],
  };
};

export const mergeBadges = (apiBadges) => {
  const sourceBadges = Array.isArray(apiBadges) ? apiBadges : [];
  return BADGE_TEMPLATES.map((template, index) => {
    const fromKey = sourceBadges.find((item) => String(item?.key || "") === template.key);
    const source = fromKey || sourceBadges[index] || {};
    const unlocked = source.unlocked ?? template.unlocked;
    const level = unlocked ? Math.max(1, Math.min(9, Math.round(toNumber(source.level, template.level)))) : 0;

    return {
      ...template,
      title: String(source.title || template.title),
      subtitle: String(source.subtitle || template.subtitle),
      tooltip: source.tooltip ? String(source.tooltip) : template.tooltip,
      unlocked: Boolean(unlocked),
      level,
    };
  });
};

export const getActivityVisual = (type) => {
  const key = String(type || "").toLowerCase();
  return ACTIVITY_VISUAL[key] || ACTIVITY_VISUAL.default;
};

export const ensureProfileFonts = () => {
  const fonts = [
    {
      id: "profile-font-lexend",
      href: "https://fonts.googleapis.com/css2?family=Lexend:wght@300;400;500;600;700&display=swap",
    },
    {
      id: "profile-font-material-symbols",
      href: "https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:wght,FILL@100..700,0..1&display=swap",
    },
  ];

  for (const font of fonts) {
    if (document.getElementById(font.id)) continue;
    const link = document.createElement("link");
    link.id = font.id;
    link.rel = "stylesheet";
    link.href = font.href;
    document.head.appendChild(link);
  }
};
