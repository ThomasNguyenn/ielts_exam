import React from "react";
import { Link } from "react-router-dom";
import {
  formatActivityDate,
  formatActivityType,
  formatBand,
  getActivityVisual,
  scoreBadgeClass,
} from "../profile.helpers";

export default function ProfileMainContent({ summary, badges, activities }) {
  return (
    <div className="lg:col-span-9 flex flex-col gap-6">
      <section>
        <h2 className="text-slate-900 text-2xl font-bold mb-4">Performance Summary</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="bg-white rounded-xl p-6 shadow-sm border border-slate-200 flex items-start justify-between hover:border-[#1152d4]/30 transition-colors group">
            <div className="flex flex-col gap-1">
              <p className="text-slate-500 text-sm font-medium">Total Mock Tests</p>
              <p className="text-slate-900 text-3xl font-bold tracking-tight">{summary.totalMockTests}</p>
              <p className="text-green-600 text-sm font-medium flex items-center gap-1 bg-green-50 w-fit px-2 py-0.5 rounded-full mt-1">
                <span className="material-symbols-outlined text-[16px]">trending_up</span>
                +{summary.weeklyDelta} this week
              </p>
            </div>
            <div className="size-10 rounded-full bg-blue-50 text-blue-600 flex items-center justify-center group-hover:bg-blue-100 transition-colors">
              <span className="material-symbols-outlined">quiz</span>
            </div>
          </div>

          <div className="bg-white rounded-xl p-6 shadow-sm border border-slate-200 flex items-start justify-between hover:border-[#1152d4]/30 transition-colors group">
            <div className="flex flex-col gap-1">
              <p className="text-slate-500 text-sm font-medium">Average Band Score</p>
              <p className="text-slate-900 text-3xl font-bold tracking-tight">{formatBand(summary.averageBandScore)}</p>
              <p className="text-green-600 text-sm font-medium flex items-center gap-1 bg-green-50 w-fit px-2 py-0.5 rounded-full mt-1">
                <span className="material-symbols-outlined text-[16px]">trending_up</span>
                {summary.averageBandDelta >= 0 ? "+" : ""}
                {formatBand(summary.averageBandDelta)} vs last month
              </p>
            </div>
            <div className="size-10 rounded-full bg-purple-50 text-purple-600 flex items-center justify-center group-hover:bg-purple-100 transition-colors">
              <span className="material-symbols-outlined">analytics</span>
            </div>
          </div>

          <div className="bg-white rounded-xl p-6 shadow-sm border border-slate-200 flex items-start justify-between hover:border-[#1152d4]/30 transition-colors group">
            <div className="flex flex-col gap-1">
              <p className="text-slate-500 text-sm font-medium">Total Study Hours</p>
              <p className="text-slate-900 text-3xl font-bold tracking-tight">{summary.totalStudyHours}h</p>
              <p className="text-slate-500 text-sm font-medium flex items-center gap-1 bg-slate-50 w-fit px-2 py-0.5 rounded-full mt-1">
                <span className="material-symbols-outlined text-[16px]">schedule</span>
                {summary.remainingStudyHours}h remaining
              </p>
            </div>
            <div className="size-10 rounded-full bg-orange-50 text-orange-600 flex items-center justify-center group-hover:bg-orange-100 transition-colors">
              <span className="material-symbols-outlined">timer</span>
            </div>
          </div>
        </div>
      </section>

      <section className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-slate-900 text-xl font-bold">Achievement Badges</h2>
          <Link to="/achievements" className="text-sm text-[#1152d4] font-medium hover:underline">
            View All
          </Link>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-6">
          {badges.map((badge) => (
            <div key={badge.key} className={badge.wrapperClass}>
              <div className={badge.shellClass}>
                <span className={`material-symbols-outlined text-4xl ${badge.iconClass}`}>{badge.icon}</span>
                {badge.unlocked ? (
                  <div
                    className={
                      badge.levelClass ||
                      "absolute -bottom-1 bg-[#1152d4] text-white text-[10px] font-bold px-2 py-0.5 rounded-full"
                    }
                  >
                    Lvl {badge.level}
                  </div>
                ) : null}
              </div>

              <div>
                <p className="text-sm font-bold text-slate-900 leading-tight">{badge.title}</p>
                <p className="text-xs text-slate-500">{badge.subtitle}</p>
              </div>

              {!badge.unlocked && badge.tooltip ? (
                <div className="absolute bottom-full mb-2 hidden group-hover:block w-32 bg-slate-800 text-white text-xs rounded p-2 z-10 shadow-lg">
                  {badge.tooltip}
                </div>
              ) : null}
            </div>
          ))}
        </div>
      </section>

      <section className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6 flex-1">
        <h2 className="text-slate-900 text-xl font-bold mb-4">Recent Activity</h2>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm whitespace-nowrap">
            <thead>
              <tr className="text-slate-500 border-b border-slate-100">
                <th className="pb-3 font-medium pl-2">Task Name</th>
                <th className="pb-3 font-medium">Type</th>
                <th className="pb-3 font-medium">Date</th>
                <th className="pb-3 font-medium">Score</th>
                <th className="pb-3 font-medium text-right pr-2">Action</th>
              </tr>
            </thead>

            <tbody className="divide-y divide-slate-100">
              {activities.length ? (
                activities.map((activity, index) => {
                  const visual = getActivityVisual(activity?.type);
                  const completed = String(activity?.status || "").toLowerCase() === "completed";
                  const score = Number(activity?.score);
                  const hasScore = completed && Number.isFinite(score);

                  return (
                    <tr key={String(activity?.id || `activity-${index}`)} className="group hover:bg-slate-50 transition-colors">
                      <td className="py-4 pl-2 font-medium text-slate-900 flex items-center gap-3">
                        <div className={visual.iconWrapClass}>
                          <span className="material-symbols-outlined text-[18px]">{visual.icon}</span>
                        </div>
                        {String(activity?.taskName || "Practice Activity")}
                      </td>
                      <td className="py-4 text-slate-500">{formatActivityType(activity?.type || "Practice")}</td>
                      <td className="py-4 text-slate-500">{formatActivityDate(activity?.date)}</td>
                      <td className="py-4">
                        <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-bold ${scoreBadgeClass(activity?.score, activity?.status)}`}>
                          {hasScore ? `Band ${formatBand(score)}` : "Pending"}
                        </span>
                      </td>
                      <td className="py-4 text-right pr-2">
                        <button
                          type="button"
                          className="text-slate-400 hover:text-[#1152d4] transition-colors"
                          title="View activity"
                        >
                          <span className="material-symbols-outlined">visibility</span>
                        </button>
                      </td>
                    </tr>
                  );
                })
              ) : (
                <tr>
                  <td colSpan={5} className="py-6 pl-2 text-slate-500">
                    No recent activity yet.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        <div className="mt-4 flex justify-center">
          <button type="button" className="text-sm font-medium text-slate-500 hover:text-[#1152d4] transition-colors flex items-center gap-1">
            View All Activity
            <span className="material-symbols-outlined text-[16px]">expand_more</span>
          </button>
        </div>
      </section>
    </div>
  );
}
