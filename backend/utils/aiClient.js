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

  if (code === "AI_TIMEOUT" || code === "ETIMEDOUT" || code === "ECONNRESET" || code === "ECONNABORTED") {
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

const extractJsonCandidate = (text) => {
  const trimmed = String(text || "")
    .replace(/```json/gi, "")
    .replace(/```/g, "")
    .trim();

  const firstOpen = trimmed.indexOf("{");
  const lastClose = trimmed.lastIndexOf("}");
  if (firstOpen !== -1 && lastClose !== -1 && lastClose > firstOpen) {
    return trimmed.slice(firstOpen, lastClose + 1);
  }
  return trimmed;
};

export const parseModelJson = (rawText) => {
  const candidate = extractJsonCandidate(rawText);
  return JSON.parse(candidate);
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
}) => {
  const normalizedModels = (models || []).filter(Boolean);
  if (normalizedModels.length === 0) {
    throw new Error("No OpenAI model provided for AI request");
  }

  let lastError;
  for (const model of normalizedModels) {
    try {
      const completion = await runWithRetry({
        label: `OpenAI:${model}`,
        timeoutMs,
        maxAttempts,
        operation: () => openai.chat.completions.create(createPayload(model)),
      });

      const content = completion?.choices?.[0]?.message?.content;
      if (!content) {
        throw new Error(`OpenAI returned empty content for model ${model}`);
      }

      return {
        model,
        data: parseModelJson(content),
        rawText: content,
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
        operation: () => model.generateContent(contents),
      });

      const response = await result.response;
      const rawText = response?.text?.() || "";
      if (!rawText.trim()) {
        throw new Error(`Gemini returned empty content for model ${modelName}`);
      }

      return {
        model: modelName,
        data: parseModelJson(rawText),
        rawText,
      };
    } catch (error) {
      lastError = error;
    }
  }

  throw lastError || new Error("Gemini request failed");
};
