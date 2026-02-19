import express from 'express';
import { verifyToken, isTeacherOrAdmin } from "../middleware/auth.middleware.js";

import { getAllPassages, getPassageById, createPassage, updatePassage, deletePassage, generatePassageInsights } from '../controllers/passage.controller.js';
const router = express.Router();

router.get("/", getAllPassages);
router.post("/ai/question-insights", verifyToken, isTeacherOrAdmin, generatePassageInsights);
router.get("/:id", getPassageById);
router.post("/", verifyToken, isTeacherOrAdmin, createPassage);
router.put("/:id", verifyToken, isTeacherOrAdmin, updatePassage);
router.delete("/:id", verifyToken, isTeacherOrAdmin, deletePassage);

export default router;
