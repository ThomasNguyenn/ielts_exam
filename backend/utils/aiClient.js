const DEFAULT_TIMEOUT_MS = Number(process.env.AI_REQUEST_TIMEOUT_MS || 30000);
const DEFAULT_MAX_ATTEMPTS = Number(process.env.AI_REQUEST_MAX_ATTEMPTS || 3);
const DEFAULT_BASE_DELAY_MS = Number(process.env.AI_RETRY_BASE_DELAY_MS || 500);

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

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

export const parseModelJson = (rawText) => {
  const candidate = extractJsonCandidate(rawText);

  try {
    return JSON.parse(candidate);
  } catch (parseError) {
    try {
      const repaired = sanitizeJsonCandidate(candidate);
      return JSON.parse(repaired);
    } catch (repairError) {
      const error = new SyntaxError(`Failed to parse model JSON: ${repairError.message}`);
      error.code = "MODEL_JSON_PARSE_FAILED";
      error.statusCode = 502;
      error.cause = parseError;
      error.rawPreview = candidate.slice(0, 500);
      throw error;
    }
  }
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
  for (const model of normalizedModels) {
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

      return {
        model,
        data: completion.parsed,
        rawText: completion.content,
      };
    } catch (error) {
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
