import React from "react";
import CloseIcon from "@mui/icons-material/Close";
import RefreshIcon from "@mui/icons-material/Refresh";
import { SKILL_META, SKILL_ORDER, clampTarget } from "../profile.helpers";

export default function EditProfileModal({
  isOpen,
  onClose,
  onSave,
  saving,
  hasUnsavedChanges,
  saveError,
  saveMessage,
  editForm,
  avatarSrc,
  onRegenerateAvatar,
  onEditNameChange,
  onUpdateTarget,
}) {
  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-[100] bg-[#101622]/55 p-4 sm:p-6 flex items-center justify-center"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) {
          onClose();
        }
      }}
    >
      <div className="w-full max-w-4xl bg-white rounded-2xl shadow-xl border border-slate-200 overflow-hidden max-h-[92vh] flex flex-col">
        <div className="flex items-start justify-between px-6 py-5 border-b border-slate-200">
          <div className="space-y-1">
            <h3 className="text-xl font-bold text-slate-900">Edit Profile</h3>
            <p className="text-sm text-slate-500">Update your profile info, avatar seed, and IELTS target bands.</p>
            <div>
              {hasUnsavedChanges ? (
                <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold bg-amber-100 text-amber-700">
                  Unsaved changes
                </span>
              ) : (
                <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold bg-emerald-100 text-emerald-700">
                  All changes saved
                </span>
              )}
            </div>
          </div>

          <button type="button" onClick={onClose} className="text-slate-500 hover:text-slate-800" title="Close">
            <CloseIcon />
          </button>
        </div>

        <div className="p-6 overflow-y-auto">
          <div className="grid grid-cols-1 lg:grid-cols-[250px,1fr] gap-6">
            <aside className="rounded-xl border border-slate-200 bg-[#eef2fb] p-4 h-fit">
              <div className="flex flex-col items-center text-center">
                <div
                  className="size-24 rounded-full bg-center bg-cover bg-no-repeat ring-4 ring-[#1152d4]/20 mb-3"
                  style={{ backgroundImage: `url("${avatarSrc}")` }}
                />
                <p className="font-bold text-slate-900">{String(editForm.name || "Student").trim() || "Student"}</p>
                <p className="text-xs text-slate-500 mt-1">Live avatar preview</p>
              </div>

              <button
                type="button"
                onClick={onRegenerateAvatar}
                className="mt-4 w-full inline-flex items-center justify-center gap-2 px-3 py-2 rounded-lg bg-[#eef2fb] hover:bg-blue-100 text-sm font-medium text-[#1152d4]"
              >
                <RefreshIcon className="text-[18px]" />
                Regenerate Avatar
              </button>

              <p className="mt-3 text-xs text-slate-500">Tip: Keep a short seed so you can reproduce the same avatar later.</p>
            </aside>

            <div className="space-y-6">
              <section className="space-y-4">
                <h4 className="text-sm font-bold tracking-wide text-slate-700 uppercase">Account Info</h4>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <label className="flex flex-col gap-2 text-sm rounded-xl border border-[#dbe8ff] bg-[#f8fbff] p-3">
                    <div className="flex items-center justify-between">
                      <span className="font-semibold text-slate-800">Display Name</span>
                      <span className="text-[11px] font-semibold uppercase tracking-wide text-[#1152d4] bg-[#eef2fb] px-2 py-0.5 rounded-full">
                        Editable
                      </span>
                    </div>
                    <input
                      type="text"
                      value={editForm.name}
                      onChange={(event) => onEditNameChange(event.target.value)}
                      onKeyDown={(event) => event.stopPropagation()}
                      className="rounded-xl border-2 border-[#c7d8ff] bg-white px-3 py-2.5 text-[15px] font-medium text-slate-900 placeholder:text-slate-400 shadow-sm transition focus:border-[#1152d4] focus:ring-4 focus:ring-[#1152d4]/15"
                      placeholder="Enter your display name"
                    />
                    <span className="text-xs text-slate-500">This is the name shown in your profile card.</span>
                  </label>

                  <label className="flex flex-col gap-2 text-sm rounded-xl border border-[#dbe8ff] bg-[#f8fbff] p-3">
                    <div className="flex items-center justify-between">
                      <span className="font-semibold text-slate-800">Avatar Seed</span>
                      <span className="text-[11px] font-semibold uppercase tracking-wide text-[#1152d4] bg-[#eef2fb] px-2 py-0.5 rounded-full">
                        Locked
                      </span>
                    </div>
                    <input
                      type="text"
                      value={editForm.avatarSeed}
                      readOnly
                      tabIndex={-1}
                      autoComplete="off"
                      spellCheck={false}
                      className="rounded-xl border-2 border-slate-200 bg-slate-100 px-3 py-2.5 text-[15px] font-medium text-slate-700 placeholder:text-slate-400 shadow-sm cursor-not-allowed"
                    />
                    <span className="text-xs text-slate-500">Seed is system-managed. Use "Regenerate Avatar" to change it.</span>
                  </label>
                </div>
              </section>

              <section className="space-y-4">
                <h4 className="text-sm font-bold tracking-wide text-slate-700 uppercase">Target Bands</h4>

                <div className="space-y-4">
                  {SKILL_ORDER.map((key) => {
                    const value = clampTarget(editForm.targets?.[key]);

                    return (
                      <div key={key} className="rounded-lg border border-slate-200 p-3">
                        <div className="flex items-center justify-between mb-2">
                          <span className="font-medium text-slate-700">{SKILL_META[key].label}</span>
                          <span className={`text-xs font-bold px-2 py-0.5 rounded ${SKILL_META[key].chipClass}`}>
                            Band {value.toFixed(1)}
                          </span>
                        </div>

                        <div className="grid grid-cols-[1fr,90px] gap-3 items-center">
                          <input
                            type="range"
                            min="0"
                            max="9"
                            step="0.5"
                            value={value}
                            onChange={(event) => onUpdateTarget(key, event.target.value)}
                            className="w-full accent-[#1152d4]"
                          />
                          <input
                            type="number"
                            min="0"
                            max="9"
                            step="0.5"
                            value={value}
                            onChange={(event) => onUpdateTarget(key, event.target.value)}
                            className="rounded-lg border-slate-300 text-sm focus:border-[#1152d4] focus:ring-[#1152d4]/20"
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>
              </section>

              {saveError ? <p className="text-sm text-red-600">{saveError}</p> : null}
              {saveMessage ? <p className="text-sm text-green-600">{saveMessage}</p> : null}
            </div>
          </div>
        </div>

        <div className="px-6 py-4 border-t border-slate-200 flex flex-wrap items-center justify-between gap-3">
          <p className="text-xs text-slate-500">
            Shortcut: <span className="font-semibold">Ctrl + Enter</span> to save
          </p>

          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={onClose}
              disabled={saving}
              className="px-4 py-2 rounded-lg border border-slate-300 text-slate-600 hover:bg-slate-50 disabled:opacity-60"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={onSave}
              disabled={saving || !hasUnsavedChanges}
              className="px-4 py-2 rounded-lg bg-[#1152d4] text-white hover:bg-blue-700 disabled:opacity-60"
            >
              {saving ? "Saving..." : "Save Changes"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
