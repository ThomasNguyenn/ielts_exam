const DEFAULT_HOMEWORK_DUE_TZ_OFFSET_MINUTES = 7 * 60;
const MAX_TZ_OFFSET_MINUTES = 14 * 60;
const DATE_ONLY_PATTERN = /^(\d{4})-(\d{2})-(\d{2})$/;
const DATE_PREFIX_PATTERN = /^(\d{4})-(\d{2})-(\d{2})(?:$|[T\s])/;
const LEGACY_MIDNIGHT_UTC_PATTERN = /^(\d{4})-(\d{2})-(\d{2})T00:00(?::00(?:\.0{1,3})?)?(?:Z|[+-]00:00)$/i;

const clampOffsetMinutes = (value) => {
  const parsed = Number.parseInt(String(value ?? ""), 10);
  if (!Number.isFinite(parsed)) return DEFAULT_HOMEWORK_DUE_TZ_OFFSET_MINUTES;
  return Math.max(-MAX_TZ_OFFSET_MINUTES, Math.min(MAX_TZ_OFFSET_MINUTES, parsed));
};

const resolveEnvDueOffsetMinutes = () => {
  try {
    const raw = import.meta?.env?.VITE_HOMEWORK_DUE_TZ_OFFSET_MINUTES;
    return clampOffsetMinutes(raw);
  } catch {
    return DEFAULT_HOMEWORK_DUE_TZ_OFFSET_MINUTES;
  }
};

export const HOMEWORK_DUE_TZ_OFFSET_MINUTES = resolveEnvDueOffsetMinutes();

const toNumber = (value) => Number.parseInt(String(value || ""), 10);

const isValidDateParts = (year, month, day) => {
  if (!Number.isFinite(year) || !Number.isFinite(month) || !Number.isFinite(day)) return false;
  const date = new Date(Date.UTC(year, month - 1, day));
  return (
    date.getUTCFullYear() === year
    && date.getUTCMonth() === month - 1
    && date.getUTCDate() === day
  );
};

const buildDateAtOffset = ({
  year,
  month,
  day,
  hours = 0,
  minutes = 0,
  seconds = 0,
  milliseconds = 0,
  offsetMinutes = HOMEWORK_DUE_TZ_OFFSET_MINUTES,
}) => {
  if (!isValidDateParts(year, month, day)) return null;
  const utcMs = Date.UTC(
    year,
    month - 1,
    day,
    hours,
    minutes,
    seconds,
    milliseconds,
  ) - (Number(offsetMinutes) || 0) * 60 * 1000;
  const nextDate = new Date(utcMs);
  return Number.isNaN(nextDate.getTime()) ? null : nextDate;
};

const toOffsetDayKeyFromDate = (date, offsetMinutes = HOMEWORK_DUE_TZ_OFFSET_MINUTES) => {
  if (!(date instanceof Date) || Number.isNaN(date.getTime())) return "";
  const shifted = new Date(date.getTime() + (Number(offsetMinutes) || 0) * 60 * 1000);
  const year = shifted.getUTCFullYear();
  const month = String(shifted.getUTCMonth() + 1).padStart(2, "0");
  const day = String(shifted.getUTCDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
};

const parseDateParts = (value) => {
  const normalized = String(value || "").trim();
  if (!normalized) return null;
  const match = normalized.match(DATE_ONLY_PATTERN);
  if (!match) return null;
  const year = toNumber(match[1]);
  const month = toNumber(match[2]);
  const day = toNumber(match[3]);
  if (!isValidDateParts(year, month, day)) return null;
  return { year, month, day };
};

const parseDatePrefixParts = (value) => {
  const normalized = String(value || "").trim();
  if (!normalized) return null;
  const match = normalized.match(DATE_PREFIX_PATTERN);
  if (!match) return null;
  const year = toNumber(match[1]);
  const month = toNumber(match[2]);
  const day = toNumber(match[3]);
  if (!isValidDateParts(year, month, day)) return null;
  return { year, month, day };
};

const formatDatePartsDayKey = ({ year, month, day } = {}) => {
  if (!isValidDateParts(year, month, day)) return "";
  return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
};

const buildDueBoundaryAtDayEnd = (dateParts, offsetMinutes) =>
  buildDateAtOffset({
    ...dateParts,
    hours: 23,
    minutes: 59,
    seconds: 59,
    milliseconds: 999,
    offsetMinutes,
  });

const isMidnightUtcDate = (date) =>
  date.getUTCHours() === 0
  && date.getUTCMinutes() === 0
  && date.getUTCSeconds() === 0
  && date.getUTCMilliseconds() === 0;

export const resolveHomeworkDueBoundary = (
  value,
  { offsetMinutes = HOMEWORK_DUE_TZ_OFFSET_MINUTES } = {},
) => {
  if (!value) return null;

  if (value instanceof Date) {
    if (Number.isNaN(value.getTime())) return null;
    if (isMidnightUtcDate(value)) {
      return buildDateAtOffset({
        year: value.getUTCFullYear(),
        month: value.getUTCMonth() + 1,
        day: value.getUTCDate(),
        hours: 23,
        minutes: 59,
        seconds: 59,
        milliseconds: 999,
        offsetMinutes,
      });
    }
    return new Date(value.getTime());
  }

  const normalized = String(value || "").trim();
  if (!normalized) return null;

  const dateOnlyParts = parseDateParts(normalized);
  if (dateOnlyParts) {
    return buildDueBoundaryAtDayEnd(dateOnlyParts, offsetMinutes);
  }

  const legacyMidnightMatch = normalized.match(LEGACY_MIDNIGHT_UTC_PATTERN);
  if (legacyMidnightMatch) {
    return buildDueBoundaryAtDayEnd({
      year: toNumber(legacyMidnightMatch[1]),
      month: toNumber(legacyMidnightMatch[2]),
      day: toNumber(legacyMidnightMatch[3]),
    }, offsetMinutes);
  }

  const datePrefixParts = parseDatePrefixParts(normalized);
  const parsed = new Date(normalized);
  if (datePrefixParts) {
    if (Number.isNaN(parsed.getTime())) {
      return buildDueBoundaryAtDayEnd(datePrefixParts, offsetMinutes);
    }
    const parsedDayKey = toOffsetDayKeyFromDate(parsed, offsetMinutes);
    const literalDayKey = formatDatePartsDayKey(datePrefixParts);
    if (parsedDayKey && literalDayKey && parsedDayKey !== literalDayKey) {
      return buildDueBoundaryAtDayEnd(datePrefixParts, offsetMinutes);
    }
  }

  if (Number.isNaN(parsed.getTime())) return null;
  if (isMidnightUtcDate(parsed)) {
    return buildDueBoundaryAtDayEnd({
      year: parsed.getUTCFullYear(),
      month: parsed.getUTCMonth() + 1,
      day: parsed.getUTCDate(),
    }, offsetMinutes);
  }
  return parsed;
};

export const resolveHomeworkDueCutoffTimestamp = (
  value,
  { offsetMinutes = HOMEWORK_DUE_TZ_OFFSET_MINUTES } = {},
) => {
  const dueBoundary = resolveHomeworkDueBoundary(value, { offsetMinutes });
  if (!dueBoundary) return null;
  return dueBoundary.getTime();
};

export const resolveHomeworkDueDayKey = (
  value,
  { offsetMinutes = HOMEWORK_DUE_TZ_OFFSET_MINUTES } = {},
) => {
  const dueBoundary = resolveHomeworkDueBoundary(value, { offsetMinutes });
  if (!dueBoundary) return "";
  return toOffsetDayKeyFromDate(dueBoundary, offsetMinutes);
};

export const resolveHomeworkDayEndTimestamp = (
  dayKey,
  { offsetMinutes = HOMEWORK_DUE_TZ_OFFSET_MINUTES } = {},
) => {
  const parts = parseDateParts(dayKey);
  if (!parts) return null;
  const endOfDay = buildDateAtOffset({
    ...parts,
    hours: 23,
    minutes: 59,
    seconds: 59,
    milliseconds: 999,
    offsetMinutes,
  });
  return endOfDay ? endOfDay.getTime() : null;
};

export const getHomeworkTodayDayKey = (
  { now = new Date(), offsetMinutes = HOMEWORK_DUE_TZ_OFFSET_MINUTES } = {},
) => {
  const normalizedNow = now instanceof Date ? now : new Date(now);
  if (Number.isNaN(normalizedNow.getTime())) return "";
  return toOffsetDayKeyFromDate(normalizedNow, offsetMinutes);
};
