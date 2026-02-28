import { useEffect, useMemo, useRef, useState } from "react";
import { api } from "@/shared/api/client";
import {
  Award,
  ChevronLeft,
  ChevronRight,
  Crown,
  Lock,
  Medal,
  RefreshCcw,
  Star,
  Trophy,
  Zap,
} from "lucide-react";
import "./AchievementsPage.css";

const PAGE_SIZE = 12;

const CATEGORY_LABELS = {
  all: "All",
  streak: "Streak",
  test: "Tests",
  writing: "Writing",
  speaking: "Speaking",
  module: "Modules",
  score: "Scores",
  vocabulary: "Vocabulary",
  xp: "XP",
  mastery: "Mastery",
};

const TIER_META = {
  bronze: { label: "Bronze", className: "bronze" },
  silver: { label: "Silver", className: "silver" },
  gold: { label: "Gold", className: "gold" },
  diamond: { label: "Diamond", className: "diamond" },
};

const toNumber = (value, fallback = 0) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
};

const toTitleCase = (value = "") =>
  String(value || "")
    .replace(/[_-]+/g, " ")
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");

function useAnimatedCount(target, durationMs = 1400) {
  const safeTarget = Number.isFinite(Number(target)) ? Number(target) : 0;
  const [value, setValue] = useState(0);
  const valueRef = useRef(0);

  useEffect(() => {
    valueRef.current = value;
  }, [value]);

  useEffect(() => {
    const mediaQuery =
      typeof window !== "undefined" && window.matchMedia
        ? window.matchMedia("(prefers-reduced-motion: reduce)")
        : null;

    if (mediaQuery?.matches) {
      setValue(safeTarget);
      return undefined;
    }

    const startValue = valueRef.current;
    const delta = safeTarget - startValue;
    if (delta === 0) return undefined;

    const start = performance.now();
    let rafId = 0;

    const frame = (now) => {
      const progress = Math.min((now - start) / durationMs, 1);
      const eased = 1 - Math.pow(1 - progress, 3);
      setValue(Math.round(startValue + delta * eased));

      if (progress < 1) {
        rafId = requestAnimationFrame(frame);
      } else {
        setValue(safeTarget);
      }
    };

    rafId = requestAnimationFrame(frame);
    return () => cancelAnimationFrame(rafId);
  }, [durationMs, safeTarget]);

  return value;
}

const initialDataState = {
  definitions: [],
  userAchievements: [],
  leaderboard: [],
  myRank: null,
};

export default function AchievementsPage() {
  const [activeTab, setActiveTab] = useState("achievements");
  const [activeCategory, setActiveCategory] = useState("all");
  const [currentPage, setCurrentPage] = useState(1);
  const [definitions, setDefinitions] = useState(initialDataState.definitions);
  const [userAchievements, setUserAchievements] = useState(initialDataState.userAchievements);
  const [leaderboard, setLeaderboard] = useState(initialDataState.leaderboard);
  const [myRank, setMyRank] = useState(initialDataState.myRank);
  const [loading, setLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState("");

  const fetchData = async () => {
    setLoading(true);
    setErrorMessage("");

    const [defRes, myRes, lbRes, rankRes] = await Promise.allSettled([
      api.getAchievementDefinitions(),
      api.getMyAchievements(),
      api.getLeaderboard({ limit: 20 }),
      api.getMyRank(),
    ]);

    const nextDefinitions =
      defRes.status === "fulfilled" && defRes.value?.success
        ? defRes.value.data || []
        : initialDataState.definitions;
    const nextUserAchievements =
      myRes.status === "fulfilled" && myRes.value?.success
        ? myRes.value.data || []
        : initialDataState.userAchievements;
    const nextLeaderboard =
      lbRes.status === "fulfilled" && lbRes.value?.success
        ? lbRes.value.data || []
        : initialDataState.leaderboard;
    const nextMyRank =
      rankRes.status === "fulfilled" && rankRes.value?.success
        ? rankRes.value.data || null
        : initialDataState.myRank;

    setDefinitions(Array.isArray(nextDefinitions) ? nextDefinitions : []);
    setUserAchievements(Array.isArray(nextUserAchievements) ? nextUserAchievements : []);
    setLeaderboard(Array.isArray(nextLeaderboard) ? nextLeaderboard : []);
    setMyRank(nextMyRank || null);

    const hasAnyFailure = [defRes, myRes, lbRes, rankRes].some((item) => item.status === "rejected");
    if (hasAnyFailure) {
      setErrorMessage("Some data could not be loaded. Showing available information.");
    }

    setLoading(false);
  };

  useEffect(() => {
    void fetchData();
  }, []);

  const unlockedMap = useMemo(() => {
    const map = new Map();
    userAchievements.forEach((item) => {
      const key = String(item?.achievementKey || item?.key || "").trim();
      if (key) {
        map.set(key, item);
      }
    });
    return map;
  }, [userAchievements]);

  const unlockedCount = unlockedMap.size;
  const totalCount = definitions.length;
  const completionPercent = totalCount > 0 ? Math.round((unlockedCount / totalCount) * 100) : 0;

  const animatedUnlocked = useAnimatedCount(unlockedCount, 1600);
  const animatedXp = useAnimatedCount(toNumber(myRank?.xp, 0), 1600);

  const categoryEntries = useMemo(() => {
    const counts = definitions.reduce((acc, item) => {
      const key = String(item?.category || "all").trim().toLowerCase();
      if (!key) return acc;
      acc.set(key, (acc.get(key) || 0) + 1);
      return acc;
    }, new Map());

    const base = [{ key: "all", label: CATEGORY_LABELS.all, count: definitions.length }];
    const knownKeys = new Set(Object.keys(CATEGORY_LABELS).filter((key) => key !== "all"));

    Object.entries(CATEGORY_LABELS).forEach(([key, label]) => {
      if (key === "all") return;
      if (counts.has(key)) {
        base.push({ key, label, count: counts.get(key) });
      }
    });

    counts.forEach((count, key) => {
      if (knownKeys.has(key)) return;
      base.push({ key, label: toTitleCase(key), count });
    });

    return base;
  }, [definitions]);

  const filteredAchievements = useMemo(
    () =>
      definitions.filter((achievement) => {
        if (activeCategory === "all") return true;
        return String(achievement?.category || "").toLowerCase() === activeCategory;
      }),
    [activeCategory, definitions],
  );

  const sortedAchievements = useMemo(
    () =>
      [...filteredAchievements].sort((a, b) => {
        const aUnlocked = unlockedMap.has(a.key) ? 0 : 1;
        const bUnlocked = unlockedMap.has(b.key) ? 0 : 1;
        if (aUnlocked !== bUnlocked) return aUnlocked - bUnlocked;
        return toNumber(a.order, 0) - toNumber(b.order, 0);
      }),
    [filteredAchievements, unlockedMap],
  );

  const totalPages = Math.max(1, Math.ceil(sortedAchievements.length / PAGE_SIZE));
  const safePage = Math.min(currentPage, totalPages);
  const paginatedAchievements = sortedAchievements.slice(
    (safePage - 1) * PAGE_SIZE,
    safePage * PAGE_SIZE,
  );

  useEffect(() => {
    setCurrentPage((prev) => Math.min(prev, totalPages));
  }, [totalPages]);

  const setCategory = (categoryKey) => {
    setActiveCategory(categoryKey);
    setCurrentPage(1);
  };

  const rankList = useMemo(
    () =>
      leaderboard
        .map((item, index) => ({
          ...item,
          rank: toNumber(item?.rank, index + 1),
          xp: toNumber(item?.xp, 0),
          level: toNumber(item?.level, 0),
          totalAchievements: toNumber(item?.totalAchievements, 0),
          name: String(item?.name || "Student"),
        }))
        .sort((a, b) => a.rank - b.rank),
    [leaderboard],
  );

  const topThree = rankList.slice(0, 3);
  const podiumOrder = [1, 0, 2];

  return (
    <div className="achv-page">
      <div className="achv-shell">
        <section className="achv-header-card">
          <div className="achv-header-main">
            <div className="achv-title-wrap">
              <h1>
                <Trophy size={24} />
                Achievements Hub
              </h1>
              <p>Track rewards, monitor progression, and compare rank with other learners.</p>
            </div>
            <button type="button" className="achv-refresh-btn" onClick={() => void fetchData()} disabled={loading}>
              <RefreshCcw size={15} />
              Refresh
            </button>
          </div>

          <div className="achv-stat-grid">
            <article className="achv-stat-card">
              <div className="achv-stat-icon">
                <Award size={16} />
              </div>
              <span>Unlocked</span>
              <strong>{loading ? "--" : animatedUnlocked}</strong>
              <small>{totalCount} total badges</small>
            </article>
            <article className="achv-stat-card">
              <div className="achv-stat-icon">
                <Zap size={16} />
              </div>
              <span>Total XP</span>
              <strong>{loading ? "--" : animatedXp.toLocaleString()}</strong>
              <small>Career points</small>
            </article>
            <article className="achv-stat-card">
              <div className="achv-stat-icon">
                <Star size={16} />
              </div>
              <span>Level</span>
              <strong>{loading ? "--" : `Lv.${toNumber(myRank?.level, 0)}`}</strong>
              <small>{String(myRank?.levelTitle || "Beginner")}</small>
            </article>
            <article className="achv-stat-card">
              <div className="achv-stat-icon">
                <Medal size={16} />
              </div>
              <span>Global Rank</span>
              <strong>{loading ? "--" : `#${toNumber(myRank?.rank, 0) || "-"}`}</strong>
              <small>{completionPercent}% completion</small>
            </article>
          </div>

          <div className="achv-progress-wrap">
            <div className="achv-progress-label">
              <span>Completion</span>
              <span>{completionPercent}%</span>
            </div>
            <div className="achv-progress-track">
              <div className="achv-progress-fill" style={{ width: `${completionPercent}%` }} />
            </div>
          </div>
        </section>

        <section className="achv-content-card">
          <div className="achv-tabs">
            <button
              type="button"
              className={`achv-tab ${activeTab === "achievements" ? "active" : ""}`}
              onClick={() => setActiveTab("achievements")}
            >
              <Trophy size={15} />
              Achievements
            </button>
            <button
              type="button"
              className={`achv-tab ${activeTab === "leaderboard" ? "active" : ""}`}
              onClick={() => setActiveTab("leaderboard")}
            >
              <Crown size={15} />
              Leaderboard
            </button>
          </div>

          {errorMessage ? (
            <div className="achv-inline-alert" role="status">
              {errorMessage}
            </div>
          ) : null}

          {activeTab === "achievements" ? (
            <>
              <div className="achv-filter-row">
                {categoryEntries.map((entry) => (
                  <button
                    type="button"
                    key={entry.key}
                    className={`achv-filter-btn ${activeCategory === entry.key ? "active" : ""}`}
                    onClick={() => setCategory(entry.key)}
                  >
                    {entry.label}
                    <span>{entry.count}</span>
                  </button>
                ))}
              </div>

              {loading ? (
                <div className="achv-grid">
                  {Array.from({ length: PAGE_SIZE }).map((_, index) => (
                    <article key={`ach-skeleton-${index}`} className="achv-card achv-card--skeleton" aria-hidden="true">
                      <div className="achv-card-head">
                        <div className="achv-skeleton achv-skeleton-icon" />
                        <div className="achv-skeleton-block">
                          <div className="achv-skeleton achv-skeleton-title" />
                          <div className="achv-skeleton achv-skeleton-subtitle" />
                        </div>
                      </div>
                      <div className="achv-skeleton achv-skeleton-line" />
                      <div className="achv-skeleton achv-skeleton-line short" />
                    </article>
                  ))}
                </div>
              ) : sortedAchievements.length === 0 ? (
                <div className="achv-empty-card">No achievements found for this category.</div>
              ) : (
                <>
                  <div className="achv-grid">
                    {paginatedAchievements.map((achievement) => {
                      const key = String(achievement?.key || "");
                      const unlockedInfo = unlockedMap.get(key);
                      const isUnlocked = Boolean(unlockedInfo);
                      const isHiddenLocked = Boolean(achievement?.hidden) && !isUnlocked;
                      const tierKey = String(achievement?.tier || "").toLowerCase();
                      const tier = TIER_META[tierKey] || { label: "General", className: "general" };
                      const unlockedDate = unlockedInfo?.unlockedAt
                        ? new Date(unlockedInfo.unlockedAt).toLocaleDateString()
                        : null;
                      const cardIcon = isHiddenLocked ? "?" : String(achievement?.icon || "A");

                      return (
                        <article
                          key={
                            key ||
                            `achievement-${toNumber(achievement?.order, 0)}-${String(
                              achievement?.title || "item",
                            )}`
                          }
                          className={`achv-card tier-${tier.className} ${isUnlocked ? "unlocked" : "locked"} ${
                            isHiddenLocked ? "hidden" : ""
                          }`}
                        >
                          <div className="achv-card-head">
                            <div className="achv-card-icon" aria-hidden="true">
                              {cardIcon}
                            </div>
                            <div>
                              <h3>{isHiddenLocked ? "Hidden Achievement" : String(achievement?.title || "Achievement")}</h3>
                              <p>{isHiddenLocked ? "Hidden" : tier.label}</p>
                            </div>
                          </div>

                          <p className="achv-card-desc">
                            {isHiddenLocked
                              ? "Complete more activities to reveal this milestone."
                              : String(achievement?.description || "No description available.")}
                          </p>

                          <div className="achv-card-foot">
                            <span className="achv-xp-chip">
                              <Zap size={12} />
                              {isHiddenLocked ? "?? XP" : `+${toNumber(achievement?.xpReward, 0)} XP`}
                            </span>
                            {isUnlocked ? (
                              <span className="achv-date-chip">Unlocked {unlockedDate || "recently"}</span>
                            ) : (
                              <span className="achv-lock-chip">
                                <Lock size={12} />
                                Locked
                              </span>
                            )}
                          </div>
                        </article>
                      );
                    })}
                  </div>

                  {totalPages > 1 ? (
                    <div className="achv-pagination">
                      <button
                        type="button"
                        className="achv-page-btn"
                        disabled={safePage <= 1}
                        onClick={() => setCurrentPage((prev) => Math.max(1, prev - 1))}
                      >
                        <ChevronLeft size={15} />
                        Previous
                      </button>
                      <span className="achv-page-info">
                        Page {safePage} / {totalPages}
                        <small>{sortedAchievements.length} items</small>
                      </span>
                      <button
                        type="button"
                        className="achv-page-btn"
                        disabled={safePage >= totalPages}
                        onClick={() => setCurrentPage((prev) => Math.min(totalPages, prev + 1))}
                      >
                        Next
                        <ChevronRight size={15} />
                      </button>
                    </div>
                  ) : null}
                </>
              )}
            </>
          ) : (
            <>
              <div className="achv-leaderboard-wrap">
                {topThree.length >= 3 ? (
                  <div className="achv-podium">
                    {podiumOrder.map((index) => {
                      const student = topThree[index];
                      if (!student) return null;
                      const orderClass = index === 0 ? "first" : index === 1 ? "second" : "third";
                      const medal = index === 0 ? "#1" : index === 1 ? "#2" : "#3";

                      return (
                        <article key={`${student._id || student.name}-${student.rank}`} className={`achv-podium-card ${orderClass}`}>
                          <span className="achv-podium-medal">{medal}</span>
                          <h3>{student.name}</h3>
                          <p>{student.xp.toLocaleString()} XP</p>
                          <span>
                            Lv.{student.level} {student.levelTitle || ""}
                          </span>
                        </article>
                      );
                    })}
                  </div>
                ) : null}

                <div className="achv-table-card">
                  <table className="achv-table">
                    <thead>
                      <tr>
                        <th>Rank</th>
                        <th>Name</th>
                        <th>Level</th>
                        <th>XP</th>
                        <th>Badges</th>
                      </tr>
                    </thead>
                    <tbody>
                      {rankList.length > 0 ? (
                        rankList.map((student) => {
                          const isMe =
                            myRank && toNumber(student.rank, 0) > 0 && toNumber(student.rank, 0) === toNumber(myRank.rank, -1);
                          return (
                            <tr key={`${student._id || student.name}-${student.rank}`} className={isMe ? "me" : ""}>
                              <td>
                                <strong>#{student.rank}</strong>
                              </td>
                              <td>{student.name}</td>
                              <td>
                                <span className="achv-level-chip">
                                  <Star size={10} />
                                  Lv.{student.level}
                                </span>
                              </td>
                              <td>{student.xp.toLocaleString()}</td>
                              <td>{student.totalAchievements}</td>
                            </tr>
                          );
                        })
                      ) : (
                        <tr>
                          <td colSpan={5} className="achv-table-empty">
                            Leaderboard data is not available yet.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>

                {myRank ? (
                  <div className="achv-my-rank">
                    <article>
                      <span>Your Rank</span>
                      <strong>#{toNumber(myRank.rank, 0)}</strong>
                    </article>
                    <article>
                      <span>Your XP</span>
                      <strong>{toNumber(myRank.xp, 0).toLocaleString()}</strong>
                    </article>
                    <article>
                      <span>Level</span>
                      <strong>Lv.{toNumber(myRank.level, 0)}</strong>
                    </article>
                    <article>
                      <span>Badges</span>
                      <strong>{toNumber(myRank.totalAchievements, 0)}</strong>
                    </article>
                  </div>
                ) : null}
              </div>
            </>
          )}
        </section>
      </div>
    </div>
  );
}
