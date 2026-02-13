import express from 'express';
import { verifyToken, isTeacherOrAdmin } from "../middleware/auth.middleware.js";

import { getAllSections, getSectionById, createSection, updateSection, deleteSection } from '../controllers/section.controller.js';
const router = express.Router();

router.get("/", getAllSections);
router.get("/:id", getSectionById);
router.post("/", verifyToken, isTeacherOrAdmin, createSection);
router.put("/:id", verifyToken, isTeacherOrAdmin, updateSection);
router.delete("/:id", verifyToken, isTeacherOrAdmin, deleteSection);

export default router;
