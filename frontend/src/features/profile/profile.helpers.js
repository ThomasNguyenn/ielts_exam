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

const TIER_LEVEL = Object.freeze({
  bronze: 1,
  silver: 2,
  gold: 3,
  diamond: 4,
});

const BADGE_STYLE_BY_TIER = Object.freeze({
  bronze: {
    iconClass: "text-amber-700",
    shellClass:
      "relative size-20 rounded-full bg-gradient-to-b from-amber-100 to-amber-50 flex items-center justify-center border-4 border-amber-200 shadow-sm group-hover:scale-105 transition-transform",
    levelClass:
      "absolute -bottom-1 bg-amber-500 text-white text-[10px] font-bold px-2 py-0.5 rounded-full",
    wrapperClass: "flex flex-col items-center text-center gap-3 group relative",
  },
  silver: {
    iconClass: "text-slate-600",
    shellClass:
      "relative size-20 rounded-full bg-gradient-to-b from-slate-100 to-slate-50 flex items-center justify-center border-4 border-slate-300 shadow-sm group-hover:scale-105 transition-transform",
    levelClass:
      "absolute -bottom-1 bg-slate-500 text-white text-[10px] font-bold px-2 py-0.5 rounded-full",
    wrapperClass: "flex flex-col items-center text-center gap-3 group relative",
  },
  gold: {
    iconClass: "text-yellow-600",
    shellClass:
      "relative size-20 rounded-full bg-gradient-to-b from-yellow-100 to-yellow-50 flex items-center justify-center border-4 border-yellow-200 shadow-sm group-hover:scale-105 transition-transform",
    levelClass:
      "absolute -bottom-1 bg-yellow-500 text-white text-[10px] font-bold px-2 py-0.5 rounded-full",
    wrapperClass: "flex flex-col items-center text-center gap-3 group relative",
  },
  diamond: {
    iconClass: "text-sky-600",
    shellClass:
      "relative size-20 rounded-full bg-gradient-to-b from-sky-100 to-indigo-50 flex items-center justify-center border-4 border-sky-200 shadow-sm group-hover:scale-105 transition-transform",
    levelClass:
      "absolute -bottom-1 bg-sky-600 text-white text-[10px] font-bold px-2 py-0.5 rounded-full",
    wrapperClass: "flex flex-col items-center text-center gap-3 group relative",
  },
  locked: {
    iconClass: "text-slate-400",
    shellClass:
      "relative size-20 rounded-full bg-slate-100 flex items-center justify-center border-4 border-slate-200 border-dashed",
    levelClass: "",
    wrapperClass:
      "flex flex-col items-center text-center gap-3 group opacity-60 grayscale hover:grayscale-0 transition-all cursor-help relative",
  },
});

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
const roundOne = (value) => Math.round(Number(value || 0) * 10) / 10;

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
      averageBandDelta: roundOne(toNumber(sourceSummary.averageBandDelta, 0)),
      totalStudyHours: Math.max(0, toNumber(sourceSummary.totalStudyHours, 0)),
      remainingStudyHours: Math.max(0, toNumber(sourceSummary.remainingStudyHours, 0)),
    },
    skills,
    badges: Array.isArray(dashboard?.badges) ? dashboard.badges : [],
    recentActivities: Array.isArray(dashboard?.recentActivities) ? dashboard.recentActivities : [],
  };
};

const toTimestamp = (value) => {
  const date = new Date(value || 0);
  return Number.isNaN(date.getTime()) ? 0 : date.getTime();
};

const formatUnlockDate = (value) => {
  const date = new Date(value || 0);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
};

const isEmojiLikeIcon = (value = "") => /[^\x00-\x7F]/.test(String(value || "").trim());

const fallbackIconByTier = (tier) => {
  if (tier === "diamond") return "diamond";
  if (tier === "gold") return "workspace_premium";
  if (tier === "silver") return "military_tech";
  return "emoji_events";
};

export const mergeBadges = (achievementDefinitions, userAchievements, options = {}) => {
  const limit = Math.max(0, Math.round(toNumber(options.limit, 10)));
  const definitions = Array.isArray(achievementDefinitions) ? achievementDefinitions : [];
  const unlockedItems = Array.isArray(userAchievements) ? userAchievements : [];

  const unlockedByKey = new Map();
  for (const item of unlockedItems) {
    const key = String(item?.achievementKey || item?.key || "").trim();
    if (!key || unlockedByKey.has(key)) continue;
    unlockedByKey.set(key, item);
  }

  const sorted = definitions
    .filter((item) => item && typeof item === "object")
    .slice()
    .sort((a, b) => {
      const aKey = String(a?.key || "");
      const bKey = String(b?.key || "");
      const aUnlocked = unlockedByKey.has(aKey) ? 0 : 1;
      const bUnlocked = unlockedByKey.has(bKey) ? 0 : 1;
      if (aUnlocked !== bUnlocked) return aUnlocked - bUnlocked;

      if (aUnlocked === 0 && bUnlocked === 0) {
        const aDate = toTimestamp(unlockedByKey.get(aKey)?.unlockedAt);
        const bDate = toTimestamp(unlockedByKey.get(bKey)?.unlockedAt);
        if (aDate !== bDate) return bDate - aDate;
      }

      const aOrder = toNumber(a?.order, Number.MAX_SAFE_INTEGER);
      const bOrder = toNumber(b?.order, Number.MAX_SAFE_INTEGER);
      if (aOrder !== bOrder) return aOrder - bOrder;

      return String(a?.title || "").localeCompare(String(b?.title || ""));
    })
    .slice(0, limit);

  return sorted.map((achievement, index) => {
    const key = String(achievement?.key || `achievement-${index + 1}`);
    const unlockedEntry = unlockedByKey.get(key);
    const unlocked = Boolean(unlockedEntry);
    const tier = String(achievement?.tier || "").trim().toLowerCase();
    const style = unlocked
      ? (BADGE_STYLE_BY_TIER[tier] || BADGE_STYLE_BY_TIER.bronze)
      : BADGE_STYLE_BY_TIER.locked;
    const rawIcon = String(achievement?.icon || "").trim();
    const iconType = isEmojiLikeIcon(rawIcon) ? "emoji" : "symbol";
    const icon = rawIcon || fallbackIconByTier(tier);
    const unlockDate = formatUnlockDate(unlockedEntry?.unlockedAt);
    const subtitle = unlocked
      ? (unlockDate ? `Unlocked ${unlockDate}` : "Unlocked")
      : (String(achievement?.description || "").trim() || "Not unlocked yet.");

    return {
      key,
      title: String(achievement?.title || "Achievement"),
      subtitle,
      icon,
      iconType,
      unlocked,
      level: unlocked ? (TIER_LEVEL[tier] || 1) : 0,
      iconClass: style.iconClass,
      shellClass: style.shellClass,
      levelClass: style.levelClass,
      wrapperClass: style.wrapperClass,
      tooltip: unlocked ? "" : String(achievement?.description || "").trim(),
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
