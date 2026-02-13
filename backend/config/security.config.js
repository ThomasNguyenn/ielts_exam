import dotenv from "dotenv";

dotenv.config();

const requireEnv = (name) => {
  const value = process.env[name];
  if (!value || !value.trim()) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value.trim();
};

const normalizeGiftcode = (value) => {
  if (!value || typeof value !== "string") return null;
  const trimmed = value.trim().toUpperCase();
  return trimmed || null;
};

const parseGiftcodesFromJson = () => {
  const raw = process.env.ROLE_GIFTCODES_JSON || process.env.STAFF_GIFTCODES_JSON;
  if (!raw) return {};

  try {
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
      return {};
    }

    return Object.entries(parsed).reduce((acc, [code, role]) => {
      const normalizedCode = normalizeGiftcode(code);
      const normalizedRole = typeof role === "string" ? role.trim().toLowerCase() : "";

      if (!normalizedCode) return acc;
      if (normalizedRole !== "teacher" && normalizedRole !== "admin") return acc;

      acc[normalizedCode] = normalizedRole;
      return acc;
    }, {});
  } catch (error) {
    console.warn("Invalid ROLE_GIFTCODES_JSON (or STAFF_GIFTCODES_JSON) format. Falling back to individual giftcode env vars.");
    return {};
  }
};

const parseGiftcodes = () => {
  const mapFromJson = parseGiftcodesFromJson();
  if (Object.keys(mapFromJson).length > 0) {
    return mapFromJson;
  }

  const teacherGiftcode = normalizeGiftcode(process.env.TEACHER_GIFTCODE);
  const adminGiftcode = normalizeGiftcode(process.env.ADMIN_GIFTCODE);
  const fallbackMap = {};

  if (teacherGiftcode) fallbackMap[teacherGiftcode] = "teacher";
  if (adminGiftcode) fallbackMap[adminGiftcode] = "admin";

  return fallbackMap;
};

export const JWT_SECRET = requireEnv("JWT_SECRET");
export const VALID_GIFTCODES = parseGiftcodes();
