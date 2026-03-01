import { addKeyToTags, getJson, invalidateTags, setJson } from "../services/responseCache.redis.js";

const DEFAULT_IGNORE_QUERY_KEYS = ["_t", "ts", "timestamp", "_cacheBuster"];
const DEFAULT_RESPONSE_CACHE_TTL_SEC = 120;
const DEFAULT_MAX_PAYLOAD_BYTES = 1024 * 1024;
const SUPPORTED_SCOPES = new Set(["public", "user", "role"]);

const toBoolean = (value, fallback) => {
  if (value === undefined || value === null || value === "") return fallback;
  const normalized = String(value).trim().toLowerCase();
  if (["1", "true", "yes", "on"].includes(normalized)) return true;
  if (["0", "false", "no", "off"].includes(normalized)) return false;
  return fallback;
};

const toPositiveInt = (value, fallback) => {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed < 1) return fallback;
  return Math.floor(parsed);
};

const parseIgnoreQueryKeys = (value) => {
  const source = String(value || "").trim();
  const list = source
    ? source.split(",").map((item) => String(item || "").trim().toLowerCase()).filter(Boolean)
    : DEFAULT_IGNORE_QUERY_KEYS.map((key) => key.toLowerCase());
  return new Set(list);
};

const isCacheEnabled = () =>
  toBoolean(process.env.API_RESPONSE_CACHE_ENABLED, true);

const getDefaultTtlSec = () =>
  toPositiveInt(process.env.API_RESPONSE_CACHE_DEFAULT_TTL_SEC, DEFAULT_RESPONSE_CACHE_TTL_SEC);

const getMaxPayloadBytes = () =>
  toPositiveInt(process.env.API_RESPONSE_CACHE_MAX_PAYLOAD_BYTES, DEFAULT_MAX_PAYLOAD_BYTES);

const getIgnoredQueryKeys = () =>
  parseIgnoreQueryKeys(process.env.API_RESPONSE_CACHE_IGNORE_QUERY_KEYS);

const stableStringify = (value) => {
  if (Array.isArray(value)) {
    return `[${value.map((item) => stableStringify(item)).sort().join(",")}]`;
  }

  if (value && typeof value === "object") {
    const entries = Object.entries(value)
      .sort(([left], [right]) => String(left).localeCompare(String(right)))
      .map(([key, nested]) => `${encodeURIComponent(key)}:${stableStringify(nested)}`);
    return `{${entries.join(",")}}`;
  }

  return encodeURIComponent(String(value ?? ""));
};

const normalizeQuery = (query = {}, ignoredKeys = new Set()) => {
  const entries = Object.entries(query || {})
    .filter(([key, value]) => {
      if (value === undefined || value === null || value === "") return false;
      const normalizedKey = String(key || "").trim().toLowerCase();
      return normalizedKey && !ignoredKeys.has(normalizedKey);
    })
    .map(([key, value]) => [String(key), value])
    .sort(([left], [right]) => left.localeCompare(right));

  if (!entries.length) return "";
  return entries.map(([key, value]) => `${encodeURIComponent(key)}=${stableStringify(value)}`).join("&");
};

const normalizeTagList = (value) => {
  if (!value) return [];
  if (Array.isArray(value)) {
    return [...new Set(value.map((item) => String(item || "").trim()).filter(Boolean))];
  }
  const tag = String(value || "").trim();
  return tag ? [tag] : [];
};

const resolveScopeValue = (scope, req) => {
  if (scope === "user") {
    const userId = String(req.user?.userId || "anonymous");
    const role = String(req.user?.role || "unknown");
    return `u:${userId}|r:${role}`;
  }

  if (scope === "role") {
    return `r:${String(req.user?.role || "guest")}`;
  }

  return "public";
};

const resolvePath = (req) => {
  const base = String(req.baseUrl || "");
  const path = String(req.path || "");
  if (base || path) return `${base}${path}`;
  return String(req.originalUrl || "").split("?")[0];
};

const buildCacheKey = ({ namespace, req, scope, ignoredKeys }) => {
  const scopeValue = resolveScopeValue(scope, req);
  const normalizedQuery = normalizeQuery(req.query, ignoredKeys);
  const path = resolvePath(req);
  return [
    "resp-cache",
    namespace,
    String(req.method || "GET").toUpperCase(),
    path,
    normalizedQuery || "-",
    scopeValue,
  ].join("|");
};

const resolveTags = ({ tags, req, res, body }) => {
  if (typeof tags === "function") {
    return normalizeTagList(tags(req, res, body));
  }
  return normalizeTagList(tags);
};

const toSafeScope = (scope) => {
  const normalized = String(scope || "public").trim().toLowerCase();
  if (!SUPPORTED_SCOPES.has(normalized)) return "public";
  return normalized;
};

export const getCacheTtlSec = (envVarName, fallback) =>
  toPositiveInt(process.env[envVarName], fallback);

export const createResponseCache = ({
  namespace = "default",
  ttlSec,
  scope = "public",
  tags = [],
  enabled = true,
  ignoredQueryKeys,
} = {}) => {
  const resolvedNamespace = String(namespace || "default").trim() || "default";
  const resolvedScope = toSafeScope(scope);

  return async (req, res, next) => {
    if (String(req.method || "").toUpperCase() !== "GET") {
      res.set("X-Cache", "BYPASS");
      return next();
    }

    if (!enabled || !isCacheEnabled()) {
      res.set("X-Cache", "BYPASS");
      return next();
    }

    const ignoredKeys = ignoredQueryKeys || getIgnoredQueryKeys();
    const effectiveTtlSec = toPositiveInt(ttlSec, getDefaultTtlSec());
    const maxPayloadBytes = getMaxPayloadBytes();
    const key = buildCacheKey({
      namespace: resolvedNamespace,
      req,
      scope: resolvedScope,
      ignoredKeys,
    });

    const cachedEntry = await getJson(key);
    if (cachedEntry && Number(cachedEntry.statusCode || 200) === 200 && cachedEntry.body !== undefined) {
      res.set("X-Cache", "HIT");
      return res.status(200).json(cachedEntry.body);
    }

    res.set("X-Cache", "MISS");

    const originalJson = res.json.bind(res);
    res.json = (body) => {
      const statusCode = Number(res.statusCode || 200);
      if (statusCode !== 200) {
        return originalJson(body);
      }

      let payload;
      try {
        payload = { statusCode: 200, body };
        const bytes = Buffer.byteLength(JSON.stringify(payload), "utf8");
        if (bytes > maxPayloadBytes) {
          res.set("X-Cache", "BYPASS");
          return originalJson(body);
        }
      } catch {
        res.set("X-Cache", "BYPASS");
        return originalJson(body);
      }

      const resolvedTags = resolveTags({ tags, req, res, body });
      const jobs = [setJson(key, payload, effectiveTtlSec)];
      if (resolvedTags.length > 0) {
        jobs.push(addKeyToTags(key, resolvedTags, effectiveTtlSec));
      }

      Promise.all(jobs).catch(() => {
        // Cache is best-effort and must never affect request flow.
      });

      return originalJson(body);
    };

    return next();
  };
};

export const createCacheInvalidator = ({
  tags = [],
  enabled = true,
} = {}) => (req, res, next) => {
  if (!enabled || !isCacheEnabled()) return next();

  res.on("finish", () => {
    if (Number(res.statusCode || 500) >= 400) return;
    const resolvedTags = resolveTags({ tags, req, res, body: null });
    if (resolvedTags.length === 0) return;

    invalidateTags(resolvedTags).catch(() => {
      // Invalidation is best-effort and should not break write paths.
    });
  });

  return next();
};
