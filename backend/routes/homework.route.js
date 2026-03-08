import express from "express";
import multer from "multer";
import { verifyToken, isTeacherOrAdmin } from "../middleware/auth.middleware.js";
import { createCacheInvalidator, createResponseCache, getCacheTtlSec } from "../middleware/responseCache.middleware.js";
import { isStudentRole } from "../utils/role.utils.js";
import {
  getHomeworkAssignments,
  getHomeworkAssignmentById,
  getHomeworkAssignmentDashboard,
  getHomeworkGroupById,
  getHomeworkGroups,
  getHomeworkSubmissionById,
  getHomeworkTaskSubmissions,
  getMyHomeworkAssignmentById,
  getMyHomeworkAssignments,
  gradeHomeworkSubmission,
  launchMyHomeworkTaskTracking,
  createHomeworkAssignment,
  createHomeworkGroup,
  deleteHomeworkAssignment,
  deleteHomeworkGroup,
  getHomeworkAssignmentLessonById,
  patchHomeworkAssignmentLessonById,
  patchHomeworkAssignmentOutline,
  updateHomeworkAssignment,
  updateHomeworkAssignmentStatus,
  updateHomeworkGroup,
  uploadHomeworkAssignmentResource,
  upsertMyHomeworkTaskSubmission,
} from "../controllers/homework.controller.js";
import {
  getHomeworkAudioUploadLimitBytes,
  getHomeworkImageMaxFiles,
  getHomeworkImageUploadLimitBytes,
  getHomeworkResourceUploadLimitBytes,
} from "../services/objectStorage.service.js";
import { sendControllerError } from "../utils/controllerError.js";

const router = express.Router();
const MONTH_PATTERN = /^\d{4}-(0[1-9]|1[0-2])$/;

const HOMEWORK_RESOURCE_MAX_BYTES = getHomeworkResourceUploadLimitBytes();
const HOMEWORK_IMAGE_MAX_BYTES = getHomeworkImageUploadLimitBytes();
const HOMEWORK_IMAGE_MAX_FILES = getHomeworkImageMaxFiles();
const HOMEWORK_AUDIO_MAX_BYTES = getHomeworkAudioUploadLimitBytes();
const HOMEWORK_SUBMISSION_MAX_BYTES = Math.max(HOMEWORK_IMAGE_MAX_BYTES, HOMEWORK_AUDIO_MAX_BYTES);

const HOMEWORK_LIST_TTL_SEC = getCacheTtlSec("API_RESPONSE_CACHE_TTL_HOMEWORK_LIST_SEC", 180);
const HOMEWORK_DASHBOARD_TTL_SEC = getCacheTtlSec("API_RESPONSE_CACHE_TTL_HOMEWORK_DASHBOARD_SEC", 180);

const normalizeString = (value) => String(value || "").trim();

const resolveMonthValueForTag = (rawMonth) => {
  const month = normalizeString(rawMonth);
  return MONTH_PATTERN.test(month) ? month : "all";
};

const collectAssignmentTagsFromBody = (body) => {
  const rows = Array.isArray(body?.data) ? body.data : [];
  const uniqueIds = new Set();
  rows.forEach((row) => {
    const id = normalizeString(row?._id || row?.id);
    if (!id) return;
    uniqueIds.add(`homework:assignment:${id}`);
  });
  return Array.from(uniqueIds);
};

const homeworkTeacherListCache = createResponseCache({
  namespace: "homework-assignments-list",
  ttlSec: HOMEWORK_LIST_TTL_SEC,
  scope: "user",
  tags: (req, _res, body) => [
    "homework:list:teacher",
    `homework:month:${resolveMonthValueForTag(req.query?.month)}`,
    ...collectAssignmentTagsFromBody(body),
  ],
});

const homeworkStudentListCache = createResponseCache({
  namespace: "homework-my-list",
  ttlSec: HOMEWORK_LIST_TTL_SEC,
  scope: "user",
  tags: (req, _res, body) => [
    "homework:list:student",
    `homework:month:${resolveMonthValueForTag(req.query?.month)}`,
    `homework:user:${normalizeString(req.user?.userId)}:my-list`,
    ...collectAssignmentTagsFromBody(body),
  ],
});

const homeworkAssignmentDashboardCache = createResponseCache({
  namespace: "homework-assignment-dashboard",
  ttlSec: HOMEWORK_DASHBOARD_TTL_SEC,
  scope: "user",
  tags: (req) => {
    const assignmentId = normalizeString(req.params?.id);
    return [
      "homework:dashboard",
      ...(assignmentId ? [`homework:assignment:${assignmentId}`] : []),
    ];
  },
});

const homeworkTaskSubmissionsCache = createResponseCache({
  namespace: "homework-task-submissions",
  ttlSec: HOMEWORK_DASHBOARD_TTL_SEC,
  scope: "user",
  tags: (req) => {
    const assignmentId = normalizeString(req.params?.id);
    const taskId = normalizeString(req.params?.taskId);
    return [
      "homework:dashboard",
      ...(assignmentId ? [`homework:assignment:${assignmentId}`] : []),
      ...(taskId ? [`homework:task:${taskId}`] : []),
    ];
  },
});

const invalidateHomeworkGroupReads = createCacheInvalidator({
  tags: ["homework:list:teacher", "homework:list:student", "homework:dashboard"],
});

const invalidateHomeworkAssignmentReads = createCacheInvalidator({
  tags: (req) => {
    const assignmentId = normalizeString(req.params?.id);
    return [
      "homework:list:teacher",
      "homework:list:student",
      "homework:dashboard",
      ...(assignmentId ? [`homework:assignment:${assignmentId}`] : []),
    ];
  },
});

const invalidateHomeworkStudentSubmitReads = createCacheInvalidator({
  tags: (req) => {
    const assignmentId = normalizeString(req.params?.assignmentId);
    const taskId = normalizeString(req.params?.taskId);
    return [
      `homework:user:${normalizeString(req.user?.userId)}:my-list`,
      "homework:list:student",
      "homework:dashboard",
      ...(assignmentId ? [`homework:assignment:${assignmentId}`] : []),
      ...(taskId ? [`homework:task:${taskId}`] : []),
    ];
  },
});

const invalidateHomeworkGradeReads = createCacheInvalidator({
  tags: ["homework:list:student", "homework:dashboard", "homework:list:teacher"],
});

const isStudent = (req, res, next) => {
  if (isStudentRole(req.user?.role)) return next();
  return sendControllerError(req, res, {
    statusCode: 403,
    message: "Forbidden: Student access required",
  });
};

const resourceUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: HOMEWORK_RESOURCE_MAX_BYTES, files: 1 },
});

const submissionUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: HOMEWORK_SUBMISSION_MAX_BYTES, files: HOMEWORK_IMAGE_MAX_FILES + 1 },
  fileFilter: (req, file, cb) => {
    const fieldName = String(file?.fieldname || "").trim();
    const mime = String(file?.mimetype || "").toLowerCase();

    if (fieldName === "images") {
      if (!mime.startsWith("image/") && !mime.startsWith("video/")) {
        const error = new Error("Only image/video files are allowed in images[]");
        error.statusCode = 415;
        error.code = "UNSUPPORTED_MEDIA_TYPE";
        return cb(error);
      }
      return cb(null, true);
    }

    if (fieldName === "audio") {
      if (!mime.startsWith("audio/")) {
        const error = new Error("Only audio file is allowed in audio");
        error.statusCode = 415;
        error.code = "UNSUPPORTED_MEDIA_TYPE";
        return cb(error);
      }
      return cb(null, true);
    }

    const fieldError = new Error("Unexpected file field");
    fieldError.statusCode = 400;
    fieldError.code = "BAD_REQUEST";
    return cb(fieldError);
  },
});

const handleResourceUpload = (req, res, next) =>
  resourceUpload.single("resource")(req, res, (error) => {
    if (!error) return next();

    if (error instanceof multer.MulterError && error.code === "LIMIT_FILE_SIZE") {
      return sendControllerError(req, res, {
        statusCode: 413,
        code: "PAYLOAD_TOO_LARGE",
        message: `Resource file exceeds max size of ${HOMEWORK_RESOURCE_MAX_BYTES} bytes`,
      });
    }

    if (error?.statusCode) {
      return sendControllerError(req, res, {
        statusCode: error.statusCode,
        code: error.code,
        message: error.message,
      });
    }

    return next(error);
  });

const handleSubmissionUpload = (req, res, next) =>
  submissionUpload.fields([
    { name: "images", maxCount: HOMEWORK_IMAGE_MAX_FILES },
    { name: "audio", maxCount: 1 },
  ])(req, res, (error) => {
    if (!error) return next();

    if (error instanceof multer.MulterError && error.code === "LIMIT_FILE_SIZE") {
      return sendControllerError(req, res, {
        statusCode: 413,
        code: "PAYLOAD_TOO_LARGE",
        message: `Submission file exceeds max size of ${HOMEWORK_SUBMISSION_MAX_BYTES} bytes`,
      });
    }

    if (error instanceof multer.MulterError && error.code === "LIMIT_UNEXPECTED_FILE") {
      return sendControllerError(req, res, {
        statusCode: 400,
        code: "BAD_REQUEST",
        message: "Unexpected file field or file count limit exceeded",
      });
    }

    if (error?.statusCode) {
      return sendControllerError(req, res, {
        statusCode: error.statusCode,
        code: error.code,
        message: error.message,
      });
    }

    return next(error);
  });

router.use(verifyToken);

router.post("/groups", isTeacherOrAdmin, invalidateHomeworkGroupReads, createHomeworkGroup);
router.get("/groups", isTeacherOrAdmin, getHomeworkGroups);
router.get("/groups/:id", isTeacherOrAdmin, getHomeworkGroupById);
router.put("/groups/:id", isTeacherOrAdmin, invalidateHomeworkGroupReads, updateHomeworkGroup);
router.delete("/groups/:id", isTeacherOrAdmin, invalidateHomeworkGroupReads, deleteHomeworkGroup);

router.post("/assignments", isTeacherOrAdmin, invalidateHomeworkAssignmentReads, createHomeworkAssignment);
router.get("/assignments", isTeacherOrAdmin, homeworkTeacherListCache, getHomeworkAssignments);
router.post("/assignments/upload-resource", isTeacherOrAdmin, handleResourceUpload, uploadHomeworkAssignmentResource);
router.get("/assignments/:id", isTeacherOrAdmin, getHomeworkAssignmentById);
router.put("/assignments/:id", isTeacherOrAdmin, invalidateHomeworkAssignmentReads, updateHomeworkAssignment);
router.patch("/assignments/:id/outline", isTeacherOrAdmin, invalidateHomeworkAssignmentReads, patchHomeworkAssignmentOutline);
router.get("/assignments/:id/lessons/:lessonId", isTeacherOrAdmin, getHomeworkAssignmentLessonById);
router.patch("/assignments/:id/lessons/:lessonId", isTeacherOrAdmin, invalidateHomeworkAssignmentReads, patchHomeworkAssignmentLessonById);
router.patch("/assignments/:id/status", isTeacherOrAdmin, invalidateHomeworkAssignmentReads, updateHomeworkAssignmentStatus);
router.delete("/assignments/:id", isTeacherOrAdmin, invalidateHomeworkAssignmentReads, deleteHomeworkAssignment);

router.get("/me", isStudent, homeworkStudentListCache, getMyHomeworkAssignments);
router.get("/me/:assignmentId", isStudent, getMyHomeworkAssignmentById);
router.post(
  "/me/:assignmentId/tasks/:taskId/tracking/launch",
  isStudent,
  launchMyHomeworkTaskTracking,
);
router.put(
  "/me/:assignmentId/tasks/:taskId/submission",
  isStudent,
  invalidateHomeworkStudentSubmitReads,
  handleSubmissionUpload,
  upsertMyHomeworkTaskSubmission,
);

router.get("/assignments/:id/dashboard", isTeacherOrAdmin, homeworkAssignmentDashboardCache, getHomeworkAssignmentDashboard);
router.get("/assignments/:id/tasks/:taskId/submissions", isTeacherOrAdmin, homeworkTaskSubmissionsCache, getHomeworkTaskSubmissions);
router.get("/submissions/:submissionId", isTeacherOrAdmin, getHomeworkSubmissionById);
router.put("/submissions/:submissionId/grade", isTeacherOrAdmin, invalidateHomeworkGradeReads, gradeHomeworkSubmission);

export default router;
