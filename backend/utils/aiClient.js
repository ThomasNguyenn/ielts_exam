const DEFAULT_TIMEOUT_MS = Number(process.env.AI_REQUEST_TIMEOUT_MS || 30000);
const DEFAULT_MAX_ATTEMPTS = Number(process.env.AI_REQUEST_MAX_ATTEMPTS || 3);
const DEFAULT_BASE_DELAY_MS = Number(process.env.AI_RETRY_BASE_DELAY_MS || 500);
const MODEL_DEMOTE_ERROR_THRESHOLD = Number(process.env.AI_MODEL_DEMOTE_ERROR_THRESHOLD || 3);
const MODEL_DEMOTE_WINDOW_MS = Number(process.env.AI_MODEL_DEMOTE_WINDOW_MS || 300000);
const JSON_REPAIR_MAX_TRIM_CHARS = Number(process.env.AI_JSON_REPAIR_MAX_TRIM_CHARS || 800);
const modelHealthState = new Map();

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const toModelErrorSignature = (error) => {
  const code = String(error?.code || "").toUpperCase();
  const message = String(error?.message || "").toLowerCase();
  if (code === "MODEL_JSON_PARSE_FAILED") return "model_json_parse_failed";
  if (message.includes("empty content")) return "empty_content";
  return "";
};

const isDemotableModelError = (error) => Boolean(toModelErrorSignature(error));

const registerModelSuccess = (model) => {
  if (!model) return;
  modelHealthState.delete(model);
};

const registerModelFailure = (model, error) => {
  if (!model || !isDemotableModelError(error)) return;

  const now = Date.now();
  const previous = modelHealthState.get(model) || {
    failures: 0,
    lastFailureAt: 0,
    demotedUntil: 0,
  };
  const withinWindow = now - Number(previous.lastFailureAt || 0) <= MODEL_DEMOTE_WINDOW_MS;
  const failures = withinWindow ? Number(previous.failures || 0) + 1 : 1;
  const nextState = {
    failures,
    lastFailureAt: now,
    demotedUntil: Number(previous.demotedUntil || 0),
  };

  if (failures >= MODEL_DEMOTE_ERROR_THRESHOLD) {
    nextState.demotedUntil = now + MODEL_DEMOTE_WINDOW_MS;
    nextState.failures = 0;
  }

  modelHealthState.set(model, nextState);
};

const prioritizeHealthyModels = (models = []) => {
  const now = Date.now();
  const healthy = [];
  const demoted = [];

  models.forEach((model) => {
    const state = modelHealthState.get(model);
    const isDemoted = Number(state?.demotedUntil || 0) > now;
    if (isDemoted) {
      demoted.push(model);
      return;
    }
    healthy.push(model);
  });

  return [...healthy, ...demoted];
};

const withTimeout = async (promiseFactory, timeoutMs, timeoutMessage) => {
  let timeoutHandle;
  const timeoutPromise = new Promise((_, reject) => {
    timeoutHandle = setTimeout(() => {
      const timeoutError = new Error(timeoutMessage);
      timeoutError.code = "AI_TIMEOUT";
      reject(timeoutError);
    }, timeoutMs);
  });

  try {
    return await Promise.race([promiseFactory(), timeoutPromise]);
  } finally {
    clearTimeout(timeoutHandle);
  }
};

const isRetryableError = (error) => {
  const statusCode = Number(error?.status || error?.statusCode || 0);
  const code = String(error?.code || "").toUpperCase();

  if (
    code === "AI_TIMEOUT" ||
    code === "ETIMEDOUT" ||
    code === "ECONNRESET" ||
    code === "ECONNABORTED" ||
    code === "MODEL_JSON_PARSE_FAILED"
  ) {
    return true;
  }

  if ([408, 409, 425, 429].includes(statusCode)) {
    return true;
  }

  if (statusCode >= 500 && statusCode <= 599) {
    return true;
  }

  return false;
};

const findJsonBoundary = (text, startIndex) => {
  const stack = [];
  let inString = false;
  let escaped = false;

  for (let i = startIndex; i < text.length; i += 1) {
    const char = text[i];

    if (inString) {
      if (escaped) {
        escaped = false;
        continue;
      }

      if (char === "\\") {
        escaped = true;
        continue;
      }

      if (char === "\"") {
        inString = false;
      }
      continue;
    }

    if (char === "\"") {
      inString = true;
      continue;
    }

    if (char === "{" || char === "[") {
      stack.push(char);
      continue;
    }

    if (char === "}" || char === "]") {
      const previous = stack.pop();
      const isMatch = (previous === "{" && char === "}") || (previous === "[" && char === "]");
      if (!isMatch) {
        return -1;
      }
      if (stack.length === 0) {
        return i;
      }
    }
  }

  return -1;
};

const extractJsonCandidate = (text) => {
  const trimmed = String(text || "")
    .replace(/```json/gi, "")
    .replace(/```/g, "")
    .trim();

  const firstObject = trimmed.indexOf("{");
  const firstArray = trimmed.indexOf("[");

  let start = -1;
  if (firstObject === -1) {
    start = firstArray;
  } else if (firstArray === -1) {
    start = firstObject;
  } else {
    start = Math.min(firstObject, firstArray);
  }

  if (start !== -1) {
    const end = findJsonBoundary(trimmed, start);
    if (end !== -1 && end > start) {
      return trimmed.slice(start, end + 1);
    }
  }

  return trimmed;
};

const nextNonWhitespace = (text, startIndex) => {
  for (let i = startIndex; i < text.length; i += 1) {
    if (!/\s/.test(text[i])) return text[i];
  }
  return "";
};

const sanitizeJsonCandidate = (value) => {
  const raw = String(value || "")
    .replace(/^\uFEFF/, "")
    .replace(/[\u201C\u201D]/g, "\"")
    .replace(/[\u2018\u2019]/g, "'");

  let output = "";
  let inString = false;
  let escaped = false;

  for (let i = 0; i < raw.length; i += 1) {
    const char = raw[i];

    if (inString) {
      if (escaped) {
        output += char;
        escaped = false;
        continue;
      }

      if (char === "\\") {
        output += char;
        escaped = true;
        continue;
      }

      if (char === "\"") {
        const nextChar = nextNonWhitespace(raw, i + 1);
        if (nextChar === "," || nextChar === "}" || nextChar === "]" || nextChar === ":" || nextChar === "") {
          output += char;
          inString = false;
        } else {
          output += "\\\"";
        }
        continue;
      }

      if (char === "\n") {
        output += "\\n";
        continue;
      }
      if (char === "\r") {
        output += "\\r";
        continue;
      }
      if (char === "\t") {
        output += "\\t";
        continue;
      }

      const code = char.charCodeAt(0);
      if (code < 0x20) {
        output += `\\u${code.toString(16).padStart(4, "0")}`;
        continue;
      }

      output += char;
      continue;
    }

    if (char === "\"") {
      inString = true;
      output += char;
      continue;
    }

    output += char;
  }

  return output.replace(/,\s*([}\]])/g, "$1");
};

const parseJsonSafe = (value) => {
  try {
    return {
      ok: true,
      data: JSON.parse(value),
      error: null,
    };
  } catch (error) {
    return {
      ok: false,
      data: null,
      error,
    };
  }
};

const closeJsonContainers = (stack = []) => stack
  .slice()
  .reverse()
  .map((token) => (token === "{" ? "}" : "]"))
  .join("");

const repairTruncatedJsonCandidate = (value) => {
  const raw = String(value || "");
  let output = "";
  let inString = false;
  let escaped = false;
  const stack = [];

  for (let i = 0; i < raw.length; i += 1) {
    const char = raw[i];

    if (inString) {
      output += char;
      if (escaped) {
        escaped = false;
        continue;
      }
      if (char === "\\") {
        escaped = true;
        continue;
      }
      if (char === "\"") {
        inString = false;
      }
      continue;
    }

    if (char === "\"") {
      inString = true;
      output += char;
      continue;
    }

    if (char === "{" || char === "[") {
      stack.push(char);
      output += char;
      continue;
    }

    if (char === "}" || char === "]") {
      const previous = stack[stack.length - 1];
      const isMatch = (previous === "{" && char === "}") || (previous === "[" && char === "]");
      if (isMatch) {
        stack.pop();
        output += char;
      }
      continue;
    }

    output += char;
  }

  let repaired = output.trimEnd();
  if (inString) {
    repaired += "\"";
  }

  while (/[,:]\s*$/.test(repaired)) {
    repaired = repaired.replace(/[,:]\s*$/, "").trimEnd();
  }

  repaired += closeJsonContainers(stack);
  repaired = repaired.replace(/,\s*([}\]])/g, "$1");

  return repaired;
};

export const parseModelJson = (rawText) => {
  const candidate = extractJsonCandidate(rawText);
  const directResult = parseJsonSafe(candidate);
  if (directResult.ok) {
    return directResult.data;
  }

  const sanitized = sanitizeJsonCandidate(candidate);
  const sanitizedResult = parseJsonSafe(sanitized);
  if (sanitizedResult.ok) {
    return sanitizedResult.data;
  }

  const maxTrim = Math.max(
    0,
    Math.min(
      Number.isFinite(JSON_REPAIR_MAX_TRIM_CHARS) ? JSON_REPAIR_MAX_TRIM_CHARS : 0,
      Math.max(0, sanitized.length - 2),
    ),
  );
  let lastRepairError = sanitizedResult.error || directResult.error;

  for (let trimChars = 0; trimChars <= maxTrim; trimChars += 1) {
    const partial = trimChars === 0
      ? sanitized
      : sanitized.slice(0, sanitized.length - trimChars).trimEnd();
    if (!partial) {
      break;
    }

    const repaired = repairTruncatedJsonCandidate(partial);
    const repairedResult = parseJsonSafe(repaired);
    if (repairedResult.ok) {
      return repairedResult.data;
    }
    lastRepairError = repairedResult.error || lastRepairError;
  }

  const error = new SyntaxError(`Failed to parse model JSON: ${lastRepairError?.message || "Unknown parser error"}`);
  error.code = "MODEL_JSON_PARSE_FAILED";
  error.statusCode = 502;
  error.cause = directResult.error || sanitizedResult.error || lastRepairError;
  error.rawPreview = candidate.slice(0, 500);
  throw error;
};

export const runWithRetry = async ({
  label,
  operation,
  timeoutMs = DEFAULT_TIMEOUT_MS,
  maxAttempts = DEFAULT_MAX_ATTEMPTS,
  baseDelayMs = DEFAULT_BASE_DELAY_MS,
}) => {
  let lastError;

  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    try {
      return await withTimeout(
        operation,
        timeoutMs,
        `${label} timed out after ${timeoutMs}ms`,
      );
    } catch (error) {
      lastError = error;
      const shouldRetry = attempt < maxAttempts && isRetryableError(error);
      if (!shouldRetry) {
        break;
      }

      const delayMs = baseDelayMs * (2 ** (attempt - 1));
      await sleep(delayMs);
    }
  }

  throw lastError;
};

export const requestOpenAIJsonWithFallback = async ({
  openai,
  models,
  createPayload,
  timeoutMs = DEFAULT_TIMEOUT_MS,
  maxAttempts = DEFAULT_MAX_ATTEMPTS,
  baseDelayMs = DEFAULT_BASE_DELAY_MS,
}) => {
  if (!openai?.chat?.completions?.create) {
    throw new Error("OpenAI client is not initialized");
  }

  const normalizedModels = (models || [])
    .filter(Boolean)
    .filter((model, index, list) => list.indexOf(model) === index);
  if (normalizedModels.length === 0) {
    throw new Error("No OpenAI model provided for AI request");
  }
  const orderedModels = prioritizeHealthyModels(normalizedModels);

  const extractTextFromChatMessageContent = (content) => {
    if (typeof content === "string") {
      return content.trim();
    }

    if (Array.isArray(content)) {
      const merged = content
        .map((item) => {
          if (typeof item === "string") return item;
          if (item?.type === "text" && typeof item?.text === "string") return item.text;
          if (item?.type === "output_text" && typeof item?.text === "string") return item.text;
          if (typeof item?.text === "string") return item.text;
          return "";
        })
        .filter(Boolean)
        .join("\n")
        .trim();

      return merged;
    }

    return "";
  };

  let lastError;
  for (const model of orderedModels) {
    try {
      const completion = await runWithRetry({
        label: `OpenAI:${model}`,
        timeoutMs,
        maxAttempts,
        baseDelayMs,
        operation: async () => {
          const response = await openai.chat.completions.create(createPayload(model));
          const choice = response?.choices?.[0] || null;
          const message = choice?.message || null;
          const content = extractTextFromChatMessageContent(message?.content);
          const refusal = String(message?.refusal || "").trim();

          if (!content) {
            const finishReason = String(choice?.finish_reason || "").trim();
            if (refusal) {
              throw new Error(`OpenAI refusal for model ${model}: ${refusal}`);
            }

            if (finishReason) {
              throw new Error(`OpenAI returned empty content for model ${model} (finish_reason=${finishReason})`);
            }

            throw new Error(`OpenAI returned empty content for model ${model}`);
          }
          return {
            content,
            parsed: parseModelJson(content),
          };
        },
      });

      registerModelSuccess(model);
      return {
        model,
        data: completion.parsed,
        rawText: completion.content,
      };
    } catch (error) {
      registerModelFailure(model, error);
      lastError = error;
    }
  }

  throw lastError || new Error("OpenAI request failed");
};

export const requestGeminiJsonWithFallback = async ({
  genAI,
  models,
  contents,
  generationConfig,
  timeoutMs = DEFAULT_TIMEOUT_MS,
  maxAttempts = DEFAULT_MAX_ATTEMPTS,
  baseDelayMs = DEFAULT_BASE_DELAY_MS,
}) => {
  const normalizedModels = (models || []).filter(Boolean);
  if (normalizedModels.length === 0) {
    throw new Error("No Gemini model provided for AI request");
  }

  let lastError;
  for (const modelName of normalizedModels) {
    try {
      const model = genAI.getGenerativeModel({
        model: modelName,
        generationConfig,
      });

      const result = await runWithRetry({
        label: `Gemini:${modelName}`,
        timeoutMs,
        maxAttempts,
        baseDelayMs,
        operation: async () => {
          const responseResult = await model.generateContent(contents);
          const response = await responseResult.response;
          const rawText = response?.text?.() || "";
          if (!rawText.trim()) {
            throw new Error(`Gemini returned empty content for model ${modelName}`);
          }
          return {
            rawText,
            parsed: parseModelJson(rawText),
          };
        },
      });

      return {
        model: modelName,
        data: result.parsed,
        rawText: result.rawText,
      };
    } catch (error) {
      lastError = error;
    }
  }

  throw lastError || new Error("Gemini request failed");
};
