import { useLayoutEffect, useRef, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import {
  normalizeBlockId,
  normalizeMatchingPairData,
  resolveMatchColorClass,
  resolveMatchingData,
} from "./blockUtils";
import BlockSurfaceCard from "./shared/BlockSurfaceCard";
import BlockHeader from "./shared/BlockHeader";

const MATCH_LINE_COLORS = {
  emerald: "#10b981",
  sky: "#0ea5e9",
  amber: "#f59e0b",
  fuchsia: "#d946ef",
  teal: "#14b8a6",
  rose: "#f43f5e",
  indigo: "#6366f1",
  lime: "#84cc16",
};

const getItemLabel = (item, fallbackLabel, itemIndex) =>
  String(item?.text || "").trim() || `${fallbackLabel} ${itemIndex + 1}`;

export default function MatchingBlock({
  block,
  matchingSelection,
  onMatchingLeftClick,
  onMatchingRightClick,
  isMatchingDisabled,
}) {
  const matchingData = resolveMatchingData(block);
  if (matchingData.leftItems.length === 0 && matchingData.rightItems.length === 0) return null;

  const localSelection = matchingSelection && typeof matchingSelection === "object"
    ? matchingSelection
    : {};

  const selectedLeftId = normalizeBlockId(localSelection.selected_left_id);
  const normalizedPairs = (Array.isArray(localSelection.matches) ? localSelection.matches : [])
    .map((pair, pairIndex) => ({ ...normalizeMatchingPairData(pair, pairIndex), __pairIndex: pairIndex }));

  const leftIdSet = new Set(matchingData.leftItems.map((item) => normalizeBlockId(item?.id)).filter(Boolean));
  const rightIdSet = new Set(matchingData.rightItems.map((item) => normalizeBlockId(item?.id)).filter(Boolean));

  const usedLeftIds = new Set();
  const usedRightIds = new Set();
  const visiblePairs = [];
  normalizedPairs.forEach((pair) => {
    if (!pair.left_id || !pair.right_id) return;
    if (!leftIdSet.has(pair.left_id) || !rightIdSet.has(pair.right_id)) return;
    if (usedLeftIds.has(pair.left_id) || usedRightIds.has(pair.right_id)) return;
    usedLeftIds.add(pair.left_id);
    usedRightIds.add(pair.right_id);
    visiblePairs.push(pair);
  });

  const pairByLeftId = new Map(visiblePairs.map((pair) => [pair.left_id, pair]));
  const pairByRightId = new Map(visiblePairs.map((pair) => [pair.right_id, pair]));
  const leftLabelById = new Map(
    matchingData.leftItems.map((item, index) => [normalizeBlockId(item?.id), getItemLabel(item, "Left item", index)]),
  );
  const rightLabelById = new Map(
    matchingData.rightItems.map((item, index) => [normalizeBlockId(item?.id), getItemLabel(item, "Right item", index)]),
  );

  const canInteract = !Boolean(isMatchingDisabled);
  const selectedLeftLabel = selectedLeftId ? leftLabelById.get(selectedLeftId) || selectedLeftId : "";

  const boardRef = useRef(null);
  const leftRefs = useRef(new Map());
  const rightRefs = useRef(new Map());
  const [lineSegments, setLineSegments] = useState([]);

  const registerLeftRef = (itemId) => (node) => {
    const normalizedId = normalizeBlockId(itemId);
    if (!normalizedId) return;
    if (node) leftRefs.current.set(normalizedId, node);
    else leftRefs.current.delete(normalizedId);
  };

  const registerRightRef = (itemId) => (node) => {
    const normalizedId = normalizeBlockId(itemId);
    if (!normalizedId) return;
    if (node) rightRefs.current.set(normalizedId, node);
    else rightRefs.current.delete(normalizedId);
  };

  useLayoutEffect(() => {
    const board = boardRef.current;
    if (!board) return;

    const computeSegments = () => {
      const boardRect = board.getBoundingClientRect();
      const nextSegments = visiblePairs
        .map((pair) => {
          const leftNode = leftRefs.current.get(pair.left_id);
          const rightNode = rightRefs.current.get(pair.right_id);
          if (!leftNode || !rightNode) return null;

          const leftRect = leftNode.getBoundingClientRect();
          const rightRect = rightNode.getBoundingClientRect();
          return {
            key: `${pair.left_id}-${pair.right_id}`,
            x1: leftRect.right - boardRect.left,
            y1: leftRect.top + leftRect.height / 2 - boardRect.top,
            x2: rightRect.left - boardRect.left,
            y2: rightRect.top + rightRect.height / 2 - boardRect.top,
            color: MATCH_LINE_COLORS[pair.color_key] || MATCH_LINE_COLORS.emerald,
          };
        })
        .filter(Boolean);

      setLineSegments(nextSegments);
    };

    let animationFrameId = null;
    const scheduleCompute = () => {
      if (animationFrameId) cancelAnimationFrame(animationFrameId);
      animationFrameId = requestAnimationFrame(computeSegments);
    };

    scheduleCompute();
    window.addEventListener("resize", scheduleCompute);

    let resizeObserver = null;
    if (typeof ResizeObserver !== "undefined") {
      resizeObserver = new ResizeObserver(scheduleCompute);
      resizeObserver.observe(board);
      leftRefs.current.forEach((node) => resizeObserver.observe(node));
      rightRefs.current.forEach((node) => resizeObserver.observe(node));
    }

    return () => {
      if (animationFrameId) cancelAnimationFrame(animationFrameId);
      window.removeEventListener("resize", scheduleCompute);
      if (resizeObserver) resizeObserver.disconnect();
    };
  }, [matchingData.leftItems, matchingData.rightItems, selectedLeftId, visiblePairs]);

  return (
    <BlockSurfaceCard>
      <BlockHeader title="Table Matching" description="Chạm một item bên trái, rồi chạm item bên phải để ghép cặp." />
      {matchingData.prompt ? <p className="text-sm leading-7 text-slate-700">{matchingData.prompt}</p> : null}

      <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2">
        <Badge variant="outline" className="rounded-full">
          Đã ghép: {visiblePairs.length} cặp
        </Badge>
        <p className="text-xs text-slate-600">
          {selectedLeftId
            ? `Đang chọn: ${selectedLeftLabel}. Chạm một item bên phải để ghép.`
            : "Chọn item bên trái trước để bắt đầu."}
        </p>
      </div>

      <div className="hidden md:block">
        <div ref={boardRef} className="relative overflow-hidden rounded-2xl border border-slate-200 bg-white p-4">
          <svg className="pointer-events-none absolute inset-0 z-0 h-full w-full" aria-hidden="true">
            {lineSegments.map((segment) => (
              <g key={segment.key}>
                <line
                  x1={segment.x1}
                  y1={segment.y1}
                  x2={segment.x2}
                  y2={segment.y2}
                  stroke={segment.color}
                  strokeWidth="2.5"
                  strokeLinecap="round"
                  opacity="0.9"
                />
                <circle cx={segment.x1} cy={segment.y1} r="3.5" fill={segment.color} />
                <circle cx={segment.x2} cy={segment.y2} r="3.5" fill={segment.color} />
              </g>
            ))}
          </svg>

          <div className="relative z-10 grid grid-cols-2 gap-10">
            <div className="space-y-2">
              <p className="text-xs font-bold uppercase tracking-wide text-slate-500">Terms</p>
              {matchingData.leftItems.map((item, itemIndex) => {
                const itemId = normalizeBlockId(item?.id);
                const pair = pairByLeftId.get(itemId);
                const colorClass = pair ? resolveMatchColorClass(pair.color_key, pair.__pairIndex || 0) : "";
                const isSelected = itemId && selectedLeftId === itemId;
                return (
                  <button
                    key={item.id || `left-${itemIndex}`}
                    ref={registerLeftRef(itemId)}
                    type="button"
                    onClick={() => onMatchingLeftClick?.(itemId)}
                    disabled={!canInteract}
                    className={cn(
                      "w-full rounded-xl border px-3 py-3 text-left text-sm transition",
                      "disabled:cursor-not-allowed disabled:opacity-60",
                      pair
                        ? cn("border-2 font-semibold", colorClass)
                        : isSelected
                          ? "border-primary bg-primary/10 text-primary"
                          : "border-slate-200 bg-white hover:border-slate-300",
                    )}
                  >
                    {getItemLabel(item, "Left item", itemIndex)}
                  </button>
                );
              })}
            </div>

            <div className="space-y-2">
              <p className="text-xs font-bold uppercase tracking-wide text-slate-500">Definitions</p>
              {matchingData.rightItems.map((item, itemIndex) => {
                const itemId = normalizeBlockId(item?.id);
                const pair = pairByRightId.get(itemId);
                const colorClass = pair ? resolveMatchColorClass(pair.color_key, pair.__pairIndex || 0) : "";
                const canChoose = Boolean(selectedLeftId) || Boolean(pair);
                return (
                  <button
                    key={item.id || `right-${itemIndex}`}
                    ref={registerRightRef(itemId)}
                    type="button"
                    onClick={() => onMatchingRightClick?.(itemId)}
                    disabled={!canInteract || !canChoose}
                    className={cn(
                      "w-full rounded-xl border px-3 py-3 text-left text-sm transition",
                      "disabled:cursor-not-allowed disabled:opacity-60",
                      pair
                        ? cn("border-2 font-semibold", colorClass)
                        : selectedLeftId
                          ? "border-slate-300 bg-white hover:border-slate-400"
                          : "border-slate-200 bg-slate-50",
                    )}
                  >
                    {getItemLabel(item, "Right item", itemIndex)}
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      </div>

      <div className="space-y-3 md:hidden">
        <div className="rounded-xl border border-slate-200 bg-white p-3">
          <p className="text-xs font-bold uppercase tracking-wide text-slate-500">Terms</p>
          <div className="mt-2 space-y-2">
            {matchingData.leftItems.map((item, itemIndex) => {
              const itemId = normalizeBlockId(item?.id);
              const pair = pairByLeftId.get(itemId);
              const colorClass = pair ? resolveMatchColorClass(pair.color_key, pair.__pairIndex || 0) : "";
              const isSelected = itemId && selectedLeftId === itemId;
              return (
                <button
                  key={item.id || `mobile-left-${itemIndex}`}
                  type="button"
                  onClick={() => onMatchingLeftClick?.(itemId)}
                  disabled={!canInteract}
                  className={cn(
                    "w-full rounded-lg border px-3 py-2 text-left text-sm transition",
                    "disabled:cursor-not-allowed disabled:opacity-60",
                    pair
                      ? cn("border-2 font-semibold", colorClass)
                      : isSelected
                        ? "border-primary bg-primary/10 text-primary"
                        : "border-slate-200 bg-white",
                  )}
                >
                  {getItemLabel(item, "Left item", itemIndex)}
                </button>
              );
            })}
          </div>
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-3">
          <p className="text-xs font-bold uppercase tracking-wide text-slate-500">Definitions</p>
          <div className="mt-2 space-y-2">
            {matchingData.rightItems.map((item, itemIndex) => {
              const itemId = normalizeBlockId(item?.id);
              const pair = pairByRightId.get(itemId);
              const colorClass = pair ? resolveMatchColorClass(pair.color_key, pair.__pairIndex || 0) : "";
              const canChoose = Boolean(selectedLeftId) || Boolean(pair);
              return (
                <button
                  key={item.id || `mobile-right-${itemIndex}`}
                  type="button"
                  onClick={() => onMatchingRightClick?.(itemId)}
                  disabled={!canInteract || !canChoose}
                  className={cn(
                    "w-full rounded-lg border px-3 py-2 text-left text-sm transition",
                    "disabled:cursor-not-allowed disabled:opacity-60",
                    pair
                      ? cn("border-2 font-semibold", colorClass)
                      : selectedLeftId
                        ? "border-slate-300 bg-white"
                        : "border-slate-200 bg-slate-50",
                  )}
                >
                  {getItemLabel(item, "Right item", itemIndex)}
                </button>
              );
            })}
          </div>
        </div>

        <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
          <p className="text-xs font-bold uppercase tracking-wide text-slate-500">Matched Pairs</p>
          {visiblePairs.length === 0 ? (
            <p className="mt-2 text-sm text-slate-500">Chưa có cặp nào được ghép.</p>
          ) : (
            <div className="mt-2 space-y-2">
              {visiblePairs.map((pair) => {
                const colorClass = resolveMatchColorClass(pair.color_key, pair.__pairIndex || 0);
                const leftText = leftLabelById.get(pair.left_id) || pair.left_id;
                const rightText = rightLabelById.get(pair.right_id) || pair.right_id;
                return (
                  <div
                    key={`mobile-pair-${pair.left_id}-${pair.right_id}`}
                    className={cn("grid grid-cols-[1fr_auto_1fr] items-center gap-2 rounded-lg border px-2 py-2 text-xs", colorClass)}
                  >
                    <span className="truncate">{leftText}</span>
                    <span className="font-black">↔</span>
                    <span className="truncate text-right">{rightText}</span>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </BlockSurfaceCard>
  );
}
