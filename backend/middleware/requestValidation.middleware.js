const WRITE_METHODS = new Set(["POST", "PUT", "PATCH", "DELETE"]);

const MAX_DEPTH = 12;
const MAX_ARRAY_LENGTH = 1000;
const MAX_STRING_LENGTH = 200000;
const MAX_KEY_LENGTH = 100;

const toPositiveInt = (value, fallback) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? Math.floor(parsed) : fallback;
};

const DEFAULT_MAX_KEYS = toPositiveInt(process.env.REQUEST_VALIDATION_MAX_KEYS, 1000);
const HOMEWORK_ASSIGNMENT_MAX_KEYS = toPositiveInt(
  process.env.REQUEST_VALIDATION_HOMEWORK_ASSIGNMENT_MAX_KEYS,
  20000,
);

const HOMEWORK_ASSIGNMENT_ROUTE_PATTERNS = [
  /^\/api\/homework\/assignments$/,
  /^\/api\/homework\/assignments\/[^/]+$/,
  /^\/api\/homework\/assignments\/[^/]+\/outline$/,
  /^\/api\/homework\/assignments\/[^/]+\/lessons\/[^/]+$/,
];

const resolveMaxKeysForRequest = (req) => {
  const method = String(req?.method || "").toUpperCase();
  const path = String(req?.path || "");

  if (!["POST", "PUT", "PATCH"].includes(method)) return DEFAULT_MAX_KEYS;

  const isHomeworkAssignmentWrite = HOMEWORK_ASSIGNMENT_ROUTE_PATTERNS.some((pattern) =>
    pattern.test(path),
  );
  if (isHomeworkAssignmentWrite) return HOMEWORK_ASSIGNMENT_MAX_KEYS;

  return DEFAULT_MAX_KEYS;
};

const hasInvalidKey = (key) => {
  if (typeof key !== "string") return true;
  if (!key || key.length > MAX_KEY_LENGTH) return true;
  if (key.startsWith("$")) return true;
  if (key.includes(".")) return true;
  if (key.includes("\0")) return true;
  return false;
};

const inspectNode = (node, state, path, depth, limits) => {
  const { maxKeys } = limits;
  if (depth > MAX_DEPTH) {
    throw new Error(`Payload nesting too deep at ${path}`);
  }

  if (node === null || node === undefined) return;

  if (typeof node === "string") {
    if (node.length > MAX_STRING_LENGTH) {
      throw new Error(`String too long at ${path}`);
    }
    return;
  }

  if (typeof node !== "object") return;

  if (Array.isArray(node)) {
    if (node.length > MAX_ARRAY_LENGTH) {
      throw new Error(`Array too large at ${path}`);
    }

    for (let index = 0; index < node.length; index += 1) {
      inspectNode(node[index], state, `${path}[${index}]`, depth + 1, limits);
    }
    return;
  }

  const keys = Object.keys(node);
  state.keyCount += keys.length;
  if (state.keyCount > maxKeys) {
    throw new Error("Payload has too many keys");
  }

  for (const key of keys) {
    if (hasInvalidKey(key)) {
      throw new Error(`Invalid key '${key}' at ${path}`);
    }
    inspectNode(node[key], state, `${path}.${key}`, depth + 1, limits);
  }
};

const isMultipartRequest = (req) => {
  const contentType = req.headers["content-type"] || "";
  return contentType.startsWith("multipart/form-data");
};

export const validateWriteRequestBody = (req, res, next) => {
  if (!WRITE_METHODS.has(req.method)) return next();
  if (isMultipartRequest(req)) return next();
  if (req.body === undefined || req.body === null) return next();

  if (typeof req.body !== "object") {
    return res.status(400).json({
      success: false,
      error: {
        code: "INVALID_PAYLOAD",
        message: "Request body must be a valid JSON object or array",
      },
    });
  }

  try {
    inspectNode(req.body, { keyCount: 0 }, "body", 0, {
      maxKeys: resolveMaxKeysForRequest(req),
    });
    return next();
  } catch (error) {
    return res.status(400).json({
      success: false,
      error: {
        code: "INVALID_PAYLOAD",
        message: error.message,
      },
    });
  }
};
