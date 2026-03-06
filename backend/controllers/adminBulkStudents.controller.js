import bcrypt from "bcryptjs";
import User from "../models/User.model.js";
import { ROLE_STUDENT } from "../utils/role.utils.js";
import { handleControllerError, sendControllerError } from "../utils/controllerError.js";

const DEFAULT_PASSWORD = "Scots2026";
const MAX_STUDENTS_PER_BULK = 300;

const normalizeName = (value) => String(value || "").trim();

const parseNames = (body = {}) => {
  if (Array.isArray(body.names)) {
    return body.names.map(normalizeName).filter(Boolean);
  }

  const rawNames = String(body.rawNames || "");
  if (!rawNames.trim()) return [];

  return rawNames
    .split(/[\n,;]+/g)
    .map(normalizeName)
    .filter(Boolean);
};

const slugifyLocalPart = (value) => String(value || "")
  .normalize("NFD")
  .replace(/[\u0300-\u036f]/g, "")
  .replace(/đ/gi, "d")
  .toLowerCase()
  .replace(/[^a-z0-9\s]/g, " ")
  .replace(/\s+/g, "")
  .trim();

const pickUniqueEmail = async (baseLocalPart, orderIndex) => {
  const safeBase = String(baseLocalPart || "student").trim() || "student";
  let suffix = Number(orderIndex || 0) + 1;

  while (suffix < 1_000_000) {
    const candidate = `${safeBase}${suffix}@scots.local`;
    const existingUser = await User.findOne({ email: candidate }).select("_id").lean();
    if (!existingUser) return candidate;
    suffix += 1;
  }

  return `${safeBase}${Date.now()}@scots.local`;
};

export const createBulkStudents = async (req, res) => {
  try {
    const names = parseNames(req.body || {});

    if (names.length === 0) {
      return sendControllerError(req, res, {
        statusCode: 400,
        message: "Please provide at least one student name",
      });
    }

    if (names.length > MAX_STUDENTS_PER_BULK) {
      return sendControllerError(req, res, {
        statusCode: 400,
        message: `Maximum ${MAX_STUDENTS_PER_BULK} students per request`,
      });
    }

    const passwordHash = await bcrypt.hash(DEFAULT_PASSWORD, 10);
    const createdStudents = [];

    for (let index = 0; index < names.length; index += 1) {
      const studentName = names[index];
      const emailBase = slugifyLocalPart(studentName) || "student";
      const autoEmail = await pickUniqueEmail(emailBase, index);

      const createdUser = await User.create({
        name: studentName,
        email: autoEmail,
        password: passwordHash,
        role: ROLE_STUDENT,
        isConfirmed: true,
        createdByTeacherBulk: true,
        mustCompleteFirstLogin: true,
        firstLoginCompletedAt: null,
      });

      createdStudents.push({
        _id: createdUser._id,
        name: createdUser.name,
        email: createdUser.email,
        role: createdUser.role,
        mustCompleteFirstLogin: Boolean(createdUser.mustCompleteFirstLogin),
      });
    }

    return res.status(201).json({
      success: true,
      message: `Created ${createdStudents.length} student account(s) successfully`,
      data: {
        students: createdStudents,
        defaultPassword: DEFAULT_PASSWORD,
      },
    });
  } catch (error) {
    return handleControllerError(req, res, error, { route: "admin.createBulkStudents" });
  }
};
