import React from "react";
import { Link } from "react-router-dom";
import { SKILL_META, SKILL_ORDER, formatBand, toNumber } from "../profile.helpers";

export default function ProfileSidebar({
  profileName,
  memberSince,
  targetBand,
  avatarSrc,
  onOpenEditor,
  skills,
}) {
  return (
    <aside className="lg:col-span-3 flex flex-col gap-6">
      <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6 flex flex-col items-center text-center">
        <div className="relative mb-4">
          <div
            className="bg-center bg-no-repeat bg-cover rounded-full size-24 ring-4 ring-[#1152d4]/10"
            style={{ backgroundImage: `url("${avatarSrc}")` }}
          />
          <button
            type="button"
            onClick={onOpenEditor}
            className="absolute bottom-0 right-0 bg-white p-1.5 rounded-full shadow-md border border-slate-100 cursor-pointer hover:text-[#1152d4] transition-colors"
            title="Edit profile"
          >
            <span className="material-symbols-outlined text-[18px] block">edit</span>
          </button>
        </div>

        <h1 className="text-slate-900 text-xl font-bold mb-1">{profileName}</h1>
        <p className="text-slate-500 text-sm mb-4">Member Since: {memberSince}</p>

        <div className="w-full bg-[#1152d4]/5 rounded-xl p-4 border border-[#1152d4]/10">
          <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1">Target Band</p>
          <p className="text-3xl font-bold text-[#1152d4]">{formatBand(targetBand)}</p>
        </div>
      </div>

      <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6">
        <h3 className="text-lg font-bold text-slate-900 mb-4 flex items-center gap-2">
          <span className="material-symbols-outlined text-[#1152d4]">bar_chart</span>
          Skill Mastery
        </h3>

        <div className="space-y-5">
          {SKILL_ORDER.map((key) => {
            const meta = SKILL_META[key];
            const skill = skills?.[key] || { band: 0, progressPct: 0 };
            const progress = Math.max(0, Math.min(100, toNumber(skill.progressPct, 0)));

            return (
              <div key={key}>
                <div className="flex justify-between items-end mb-1">
                  <span className="text-sm font-medium text-slate-700">{meta.label}</span>
                  <span className={`text-xs font-bold px-2 py-0.5 rounded ${meta.chipClass}`}>
                    Band {formatBand(skill.band)}
                  </span>
                </div>
                <div className="h-2 w-full bg-slate-100 rounded-full overflow-hidden">
                  <div className={`h-full rounded-full ${meta.barClass}`} style={{ width: `${progress}%` }} />
                </div>
              </div>
            );
          })}
        </div>

        <div className="mt-6 pt-4 border-t border-slate-100">
          <Link
            to="/analytics"
            className="text-sm text-[#1152d4] font-medium hover:underline flex items-center gap-1 justify-center"
          >
            View Detailed Analytics
            <span className="material-symbols-outlined text-[16px]">arrow_forward</span>
          </Link>
        </div>
      </div>
    </aside>
  );
}
