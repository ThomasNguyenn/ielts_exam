import crypto from "crypto";
import { DeleteObjectCommand, PutObjectCommand, S3Client } from "@aws-sdk/client-s3";

const DEFAULT_SECTION_AUDIO_PREFIX = "sections/audio";
const DEFAULT_SECTION_AUDIO_MAX_BYTES = 50 * 1024 * 1024;

const DEFAULT_HOMEWORK_PREFIX = "homework";
const DEFAULT_HOMEWORK_RESOURCE_PREFIX = "homework/resources";
const DEFAULT_HOMEWORK_SUBMISSION_IMAGE_PREFIX = "homework/submissions/images";
const DEFAULT_HOMEWORK_SUBMISSION_AUDIO_PREFIX = "homework/submissions/audio";
const DEFAULT_HOMEWORK_IMAGE_MAX_BYTES = 5 * 1024 * 1024;
const DEFAULT_HOMEWORK_IMAGE_MAX_FILES = 10;
const DEFAULT_HOMEWORK_AUDIO_MAX_BYTES = 50 * 1024 * 1024;
const DEFAULT_HOMEWORK_RESOURCE_MAX_BYTES = 50 * 1024 * 1024;

let sharedClient = null;
let sharedClientKey = "";

const trimString = (value) => String(value || "").trim();

const trimSlashes = (value) =>
  trimString(value)
    .replace(/^\/+/, "")
    .replace(/\/+$/, "");

const trimTrailingSlashes = (value) => trimString(value).replace(/\/+$/, "");

const parsePositiveInt = (value, fallback) => {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0) return fallback;
  return Math.floor(parsed);
};

const ensureUrlHasProtocol = (value) => {
  const raw = trimString(value);
  if (!raw) return "";
  if (/^https?:\/\//i.test(raw)) return raw;
  return `https://${raw}`;
};

const normalizeSpacesEndpoint = (endpoint, bucket) => {
  const endpointRaw = trimTrailingSlashes(endpoint);
  if (!endpointRaw) return "";

  try {
    const parsed = new URL(ensureUrlHasProtocol(endpointRaw));
    const bucketValue = trimString(bucket).toLowerCase();
    const hostname = String(parsed.hostname || "");

    if (bucketValue && hostname.toLowerCase().startsWith(`${bucketValue}.`)) {
      parsed.hostname = hostname.slice(bucketValue.length + 1);
    }

    const basePath =
      parsed.pathname && parsed.pathname !== "/"
        ? parsed.pathname.replace(/\/+$/, "")
        : "";
    return `${parsed.protocol}//${parsed.hostname}${basePath}`;
  } catch {
    return endpointRaw;
  }
};

const createStorageError = (statusCode, code, message) => {
  const error = new Error(message);
  error.statusCode = statusCode;
  error.code = code;
  return error;
};

const inferRegionFromEndpoint = (endpoint) => {
  try {
    const { hostname } = new URL(ensureUrlHasProtocol(endpoint));
    const match = hostname.match(/(?:^|\.)([a-z0-9-]+)\.digitaloceanspaces\.com$/i);
    return match?.[1] || "";
  } catch {
    return "";
  }
};

const sanitizeScopeId = (value, fallback = "temp") => {
  const normalized = trimString(value).replace(/[^a-zA-Z0-9_-]+/g, "-");
  return normalized || fallback;
};

const sanitizeFilename = (value) => {
  const normalized = trimString(value || "file")
    .toLowerCase()
    .replace(/[^a-z0-9._-]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^\.+/, "");
  if (!normalized) return "file";
  return normalized.slice(0, 120);
};

const encodeKeyForUrl = (key) =>
  String(key || "")
    .split("/")
    .filter(Boolean)
    .map((segment) => encodeURIComponent(segment))
    .join("/");

const normalizeObjectKey = (key) => trimSlashes(key);

const startsWithPrefix = (key, prefix) => {
  const normalizedKey = normalizeObjectKey(key);
  const normalizedPrefix = trimSlashes(prefix);
  if (!normalizedKey || !normalizedPrefix) return false;
  return normalizedKey === normalizedPrefix || normalizedKey.startsWith(`${normalizedPrefix}/`);
};

const startsWithAnyPrefix = (key, prefixes = []) =>
  (Array.isArray(prefixes) ? prefixes : []).some((prefix) => startsWithPrefix(key, prefix));

const resolveObjectStorageConfig = () => {
  const bucket = trimString(process.env.DO_SPACES_BUCKET);
  const endpoint = normalizeSpacesEndpoint(process.env.DO_SPACES_ENDPOINT, bucket);
  const accessKeyId = trimString(process.env.DO_SPACES_ACCESS_KEY_ID || process.env.DO_SPACES_KEY);
  const secretAccessKey = trimString(process.env.DO_SPACES_SECRET_ACCESS_KEY || process.env.DO_SPACES_SECRET);
  const region = trimString(process.env.DO_SPACES_REGION) || inferRegionFromEndpoint(endpoint) || "us-east-1";
  const cdnBaseUrl = trimTrailingSlashes(process.env.DO_SPACES_CDN_BASE_URL);

  const sectionAudioPrefix = trimSlashes(process.env.DO_SPACES_SECTION_AUDIO_PREFIX || DEFAULT_SECTION_AUDIO_PREFIX);
  const sectionAudioMaxBytes = parsePositiveInt(process.env.SECTION_AUDIO_MAX_BYTES, DEFAULT_SECTION_AUDIO_MAX_BYTES);

  const homeworkPrefix = trimSlashes(process.env.DO_SPACES_HOMEWORK_PREFIX || DEFAULT_HOMEWORK_PREFIX);
  const homeworkResourcePrefix = trimSlashes(
    process.env.DO_SPACES_HOMEWORK_RESOURCE_PREFIX || `${homeworkPrefix}/resources`,
  ) || DEFAULT_HOMEWORK_RESOURCE_PREFIX;
  const homeworkSubmissionImagePrefix = trimSlashes(
    process.env.DO_SPACES_HOMEWORK_SUBMISSION_IMAGE_PREFIX || `${homeworkPrefix}/submissions/images`,
  ) || DEFAULT_HOMEWORK_SUBMISSION_IMAGE_PREFIX;
  const homeworkSubmissionAudioPrefix = trimSlashes(
    process.env.DO_SPACES_HOMEWORK_SUBMISSION_AUDIO_PREFIX || `${homeworkPrefix}/submissions/audio`,
  ) || DEFAULT_HOMEWORK_SUBMISSION_AUDIO_PREFIX;

  const homeworkImageMaxBytes = parsePositiveInt(process.env.HOMEWORK_IMAGE_MAX_BYTES, DEFAULT_HOMEWORK_IMAGE_MAX_BYTES);
  const homeworkImageMaxFiles = parsePositiveInt(process.env.HOMEWORK_IMAGE_MAX_FILES, DEFAULT_HOMEWORK_IMAGE_MAX_FILES);
  const homeworkAudioMaxBytes = parsePositiveInt(process.env.HOMEWORK_AUDIO_MAX_BYTES, DEFAULT_HOMEWORK_AUDIO_MAX_BYTES);
  const homeworkResourceMaxBytes = parsePositiveInt(
    process.env.HOMEWORK_RESOURCE_MAX_BYTES,
    DEFAULT_HOMEWORK_RESOURCE_MAX_BYTES,
  );

  return {
    endpoint,
    bucket,
    accessKeyId,
    secretAccessKey,
    region,
    cdnBaseUrl,
    sectionAudioPrefix: sectionAudioPrefix || DEFAULT_SECTION_AUDIO_PREFIX,
    sectionAudioMaxBytes,
    homeworkPrefix: homeworkPrefix || DEFAULT_HOMEWORK_PREFIX,
    homeworkResourcePrefix,
    homeworkSubmissionImagePrefix,
    homeworkSubmissionAudioPrefix,
    homeworkImageMaxBytes,
    homeworkImageMaxFiles,
    homeworkAudioMaxBytes,
    homeworkResourceMaxBytes,
  };
};

const isConfigReady = (config) =>
  Boolean(config.endpoint && config.bucket && config.accessKeyId && config.secretAccessKey);

const getClient = () => {
  const config = resolveObjectStorageConfig();
  if (!isConfigReady(config)) {
    throw createStorageError(
      503,
      "OBJECT_STORAGE_NOT_CONFIGURED",
      "Object storage is not configured",
    );
  }

  const key = `${config.endpoint}|${config.region}|${config.accessKeyId}|${config.bucket}`;
  if (!sharedClient || sharedClientKey !== key) {
    sharedClient = new S3Client({
      region: config.region,
      endpoint: config.endpoint,
      credentials: {
        accessKeyId: config.accessKeyId,
        secretAccessKey: config.secretAccessKey,
      },
      forcePathStyle: false,
    });
    sharedClientKey = key;
  }

  return { client: sharedClient, config };
};

const buildObjectPublicUrl = (key) => {
  const normalizedKey = normalizeObjectKey(key);
  if (!normalizedKey) {
    throw createStorageError(400, "INVALID_OBJECT_KEY", "Object key is required");
  }

  const config = resolveObjectStorageConfig();
  const encodedKey = encodeKeyForUrl(normalizedKey);

  if (config.cdnBaseUrl) {
    return `${config.cdnBaseUrl}/${encodedKey}`;
  }

  try {
    const parsed = new URL(config.endpoint);
    const hostname = parsed.hostname;
    const basePath = parsed.pathname && parsed.pathname !== "/" ? parsed.pathname.replace(/\/+$/, "") : "";
    const bucketPrefix = `${config.bucket.toLowerCase()}.`;
    const hostWithBucket = hostname.toLowerCase().startsWith(bucketPrefix)
      ? hostname
      : `${config.bucket}.${hostname}`;
    return `${parsed.protocol}//${hostWithBucket}${basePath}/${encodedKey}`;
  } catch {
    throw createStorageError(500, "INVALID_OBJECT_STORAGE_ENDPOINT", "Invalid object storage endpoint");
  }
};

const uploadObject = async ({ key, buffer, contentType, size }) => {
  const normalizedKey = normalizeObjectKey(key);
  if (!normalizedKey) {
    throw createStorageError(400, "INVALID_OBJECT_KEY", "Object key is required");
  }
  if (!Buffer.isBuffer(buffer)) {
    throw createStorageError(400, "INVALID_UPLOAD_BODY", "Upload buffer is required");
  }

  const { client, config } = getClient();

  await client.send(
    new PutObjectCommand({
      Bucket: config.bucket,
      Key: normalizedKey,
      Body: buffer,
      ContentType: contentType || "application/octet-stream",
      ContentLength: Number.isFinite(Number(size)) ? Number(size) : buffer.length,
      CacheControl: "public, max-age=31536000, immutable",
      ACL: "public-read",
    }),
  );

  return {
    key: normalizedKey,
    url: buildObjectPublicUrl(normalizedKey),
  };
};

const uploadObjectWithPrefixGuard = async ({
  key,
  allowedPrefixes,
  outOfScopeCode,
  outOfScopeMessage,
  buffer,
  contentType,
  size,
}) => {
  const normalizedKey = normalizeObjectKey(key);
  if (!startsWithAnyPrefix(normalizedKey, allowedPrefixes)) {
    throw createStorageError(400, outOfScopeCode, outOfScopeMessage);
  }
  return uploadObject({ key: normalizedKey, buffer, contentType, size });
};

const deleteObjectWithPrefixGuard = async ({
  key,
  allowedPrefixes,
  outOfScopeCode,
  outOfScopeMessage,
}) => {
  const normalizedKey = normalizeObjectKey(key);
  if (!normalizedKey) return { deleted: false, key: null };
  if (!startsWithAnyPrefix(normalizedKey, allowedPrefixes)) {
    throw createStorageError(400, outOfScopeCode, outOfScopeMessage);
  }

  const { client, config } = getClient();
  await client.send(
    new DeleteObjectCommand({
      Bucket: config.bucket,
      Key: normalizedKey,
    }),
  );
  return { deleted: true, key: normalizedKey };
};

const buildObjectKey = ({ prefix, segments = [], originalFileName }) => {
  const safePrefix = trimSlashes(prefix);
  const safeSegments = (Array.isArray(segments) ? segments : [])
    .map((item) => sanitizeScopeId(item))
    .filter(Boolean);
  const uniqueSuffix = `${Date.now()}-${crypto.randomBytes(5).toString("hex")}`;
  const safeFilename = sanitizeFilename(originalFileName);
  return [safePrefix, ...safeSegments, `${uniqueSuffix}-${safeFilename}`]
    .filter(Boolean)
    .join("/");
};

const getHomeworkAllowedPrefixes = () => {
  const config = resolveObjectStorageConfig();
  return [
    config.homeworkResourcePrefix,
    config.homeworkSubmissionImagePrefix,
    config.homeworkSubmissionAudioPrefix,
  ].filter(Boolean);
};

export const getSectionAudioUploadLimitBytes = () => resolveObjectStorageConfig().sectionAudioMaxBytes;
export const getSectionAudioKeyPrefix = () => resolveObjectStorageConfig().sectionAudioPrefix;

export const getHomeworkKeyPrefix = () => resolveObjectStorageConfig().homeworkPrefix;
export const getHomeworkResourceKeyPrefix = () => resolveObjectStorageConfig().homeworkResourcePrefix;
export const getHomeworkSubmissionImageKeyPrefix = () => resolveObjectStorageConfig().homeworkSubmissionImagePrefix;
export const getHomeworkSubmissionAudioKeyPrefix = () => resolveObjectStorageConfig().homeworkSubmissionAudioPrefix;
export const getHomeworkImageUploadLimitBytes = () => resolveObjectStorageConfig().homeworkImageMaxBytes;
export const getHomeworkImageMaxFiles = () => resolveObjectStorageConfig().homeworkImageMaxFiles;
export const getHomeworkAudioUploadLimitBytes = () => resolveObjectStorageConfig().homeworkAudioMaxBytes;
export const getHomeworkResourceUploadLimitBytes = () => resolveObjectStorageConfig().homeworkResourceMaxBytes;

export const isObjectStorageConfigured = () => isConfigReady(resolveObjectStorageConfig());

export const isSectionAudioStorageKeyAllowed = (key) =>
  startsWithPrefix(key, getSectionAudioKeyPrefix());

export const isHomeworkStorageKeyAllowed = (key) =>
  startsWithAnyPrefix(key, getHomeworkAllowedPrefixes());

export const buildSectionAudioObjectKey = ({ originalFileName, sectionId }) =>
  buildObjectKey({
    prefix: getSectionAudioKeyPrefix(),
    segments: [sanitizeScopeId(sectionId)],
    originalFileName,
  });

export const buildSectionAudioPublicUrl = (key) => buildObjectPublicUrl(key);

export const uploadSectionAudioObject = async ({ key, buffer, contentType, size }) =>
  uploadObjectWithPrefixGuard({
    key,
    allowedPrefixes: [getSectionAudioKeyPrefix()],
    outOfScopeCode: "OBJECT_STORAGE_KEY_OUT_OF_SCOPE",
    outOfScopeMessage: "Object key is outside allowed prefix",
    buffer,
    contentType: contentType || "audio/mpeg",
    size,
  });

export const deleteSectionAudioObject = async (key) =>
  deleteObjectWithPrefixGuard({
    key,
    allowedPrefixes: [getSectionAudioKeyPrefix()],
    outOfScopeCode: "OBJECT_STORAGE_DELETE_OUT_OF_SCOPE",
    outOfScopeMessage: "Refusing to delete object outside section audio prefix",
  });

export const buildHomeworkResourceObjectKey = ({
  assignmentId,
  taskId,
  originalFileName,
}) =>
  buildObjectKey({
    prefix: getHomeworkResourceKeyPrefix(),
    segments: [sanitizeScopeId(assignmentId), sanitizeScopeId(taskId)],
    originalFileName,
  });

export const buildHomeworkSubmissionImageObjectKey = ({
  assignmentId,
  taskId,
  studentId,
  originalFileName,
}) =>
  buildObjectKey({
    prefix: getHomeworkSubmissionImageKeyPrefix(),
    segments: [sanitizeScopeId(assignmentId), sanitizeScopeId(taskId), sanitizeScopeId(studentId)],
    originalFileName,
  });

export const buildHomeworkSubmissionAudioObjectKey = ({
  assignmentId,
  taskId,
  studentId,
  originalFileName,
}) =>
  buildObjectKey({
    prefix: getHomeworkSubmissionAudioKeyPrefix(),
    segments: [sanitizeScopeId(assignmentId), sanitizeScopeId(taskId), sanitizeScopeId(studentId)],
    originalFileName,
  });

export const uploadHomeworkResourceObject = async ({ key, buffer, contentType, size }) =>
  uploadObjectWithPrefixGuard({
    key,
    allowedPrefixes: [getHomeworkResourceKeyPrefix()],
    outOfScopeCode: "HOMEWORK_RESOURCE_KEY_OUT_OF_SCOPE",
    outOfScopeMessage: "Homework resource key is outside allowed prefix",
    buffer,
    contentType,
    size,
  });

export const uploadHomeworkSubmissionImageObject = async ({ key, buffer, contentType, size }) =>
  uploadObjectWithPrefixGuard({
    key,
    allowedPrefixes: [getHomeworkSubmissionImageKeyPrefix()],
    outOfScopeCode: "HOMEWORK_SUBMISSION_IMAGE_KEY_OUT_OF_SCOPE",
    outOfScopeMessage: "Homework submission image key is outside allowed prefix",
    buffer,
    contentType,
    size,
  });

export const uploadHomeworkSubmissionAudioObject = async ({ key, buffer, contentType, size }) =>
  uploadObjectWithPrefixGuard({
    key,
    allowedPrefixes: [getHomeworkSubmissionAudioKeyPrefix()],
    outOfScopeCode: "HOMEWORK_SUBMISSION_AUDIO_KEY_OUT_OF_SCOPE",
    outOfScopeMessage: "Homework submission audio key is outside allowed prefix",
    buffer,
    contentType,
    size,
  });

export const deleteHomeworkObject = async (key) =>
  deleteObjectWithPrefixGuard({
    key,
    allowedPrefixes: getHomeworkAllowedPrefixes(),
    outOfScopeCode: "HOMEWORK_DELETE_OUT_OF_SCOPE",
    outOfScopeMessage: "Refusing to delete object outside homework prefixes",
  });
