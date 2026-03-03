import crypto from "crypto";
import { DeleteObjectCommand, PutObjectCommand, S3Client } from "@aws-sdk/client-s3";

const DEFAULT_SECTION_AUDIO_PREFIX = "sections/audio";
const DEFAULT_SECTION_AUDIO_MAX_BYTES = 50 * 1024 * 1024;

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

    // Misconfig guard:
    // Some deployments set endpoint to "https://<bucket>.<region>.digitaloceanspaces.com".
    // The AWS SDK will then prepend the bucket again for virtual-hosted requests, producing:
    // "<bucket>.<bucket>.<region>.digitaloceanspaces.com" which fails TLS altname validation.
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

const resolveObjectStorageConfig = () => {
  const bucket = trimString(process.env.DO_SPACES_BUCKET);
  const endpoint = normalizeSpacesEndpoint(process.env.DO_SPACES_ENDPOINT, bucket);
  const accessKeyId = trimString(process.env.DO_SPACES_ACCESS_KEY_ID || process.env.DO_SPACES_KEY);
  const secretAccessKey = trimString(process.env.DO_SPACES_SECRET_ACCESS_KEY || process.env.DO_SPACES_SECRET);
  const region = trimString(process.env.DO_SPACES_REGION) || inferRegionFromEndpoint(endpoint) || "us-east-1";
  const cdnBaseUrl = trimTrailingSlashes(process.env.DO_SPACES_CDN_BASE_URL);
  const sectionAudioPrefix = trimSlashes(process.env.DO_SPACES_SECTION_AUDIO_PREFIX || DEFAULT_SECTION_AUDIO_PREFIX);
  const sectionAudioMaxBytes = parsePositiveInt(process.env.SECTION_AUDIO_MAX_BYTES, DEFAULT_SECTION_AUDIO_MAX_BYTES);

  return {
    endpoint,
    bucket,
    accessKeyId,
    secretAccessKey,
    region,
    cdnBaseUrl,
    sectionAudioPrefix: sectionAudioPrefix || DEFAULT_SECTION_AUDIO_PREFIX,
    sectionAudioMaxBytes,
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

const normalizeSectionAudioKey = (key) => trimSlashes(key);

const sanitizeSectionId = (value) => {
  const normalized = trimString(value).replace(/[^a-zA-Z0-9_-]+/g, "-");
  return normalized || "temp";
};

const sanitizeFilename = (value) => {
  const normalized = trimString(value || "audio")
    .toLowerCase()
    .replace(/[^a-z0-9._-]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^\.+/, "");

  if (!normalized) return "audio";
  return normalized.slice(0, 120);
};

const encodeKeyForUrl = (key) =>
  String(key || "")
    .split("/")
    .filter(Boolean)
    .map((segment) => encodeURIComponent(segment))
    .join("/");

export const getSectionAudioUploadLimitBytes = () => resolveObjectStorageConfig().sectionAudioMaxBytes;

export const getSectionAudioKeyPrefix = () => resolveObjectStorageConfig().sectionAudioPrefix;

export const isObjectStorageConfigured = () => isConfigReady(resolveObjectStorageConfig());

export const isSectionAudioStorageKeyAllowed = (key) => {
  const normalized = normalizeSectionAudioKey(key);
  if (!normalized) return false;
  const prefix = getSectionAudioKeyPrefix();
  return normalized.startsWith(`${prefix}/`);
};

export const buildSectionAudioObjectKey = ({ originalFileName, sectionId }) => {
  const prefix = getSectionAudioKeyPrefix();
  const scopedSectionId = sanitizeSectionId(sectionId);
  const safeFilename = sanitizeFilename(originalFileName);
  const uniqueSuffix = `${Date.now()}-${crypto.randomBytes(5).toString("hex")}`;
  return `${prefix}/${scopedSectionId}/${uniqueSuffix}-${safeFilename}`;
};

export const buildSectionAudioPublicUrl = (key) => {
  const normalizedKey = normalizeSectionAudioKey(key);
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

export const uploadSectionAudioObject = async ({
  key,
  buffer,
  contentType,
  size,
}) => {
  const normalizedKey = normalizeSectionAudioKey(key);
  if (!normalizedKey) {
    throw createStorageError(400, "INVALID_OBJECT_KEY", "Object key is required");
  }
  if (!isSectionAudioStorageKeyAllowed(normalizedKey)) {
    throw createStorageError(
      400,
      "OBJECT_STORAGE_KEY_OUT_OF_SCOPE",
      "Object key is outside allowed prefix",
    );
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
      ContentType: contentType || "audio/mpeg",
      ContentLength: Number.isFinite(Number(size)) ? Number(size) : buffer.length,
      CacheControl: "public, max-age=31536000, immutable",
      ACL: "public-read",
    }),
  );

  return {
    key: normalizedKey,
    url: buildSectionAudioPublicUrl(normalizedKey),
  };
};

export const deleteSectionAudioObject = async (key) => {
  const normalizedKey = normalizeSectionAudioKey(key);
  if (!normalizedKey) return { deleted: false, key: null };
  if (!isSectionAudioStorageKeyAllowed(normalizedKey)) {
    throw createStorageError(
      400,
      "OBJECT_STORAGE_DELETE_OUT_OF_SCOPE",
      "Refusing to delete object outside section audio prefix",
    );
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
