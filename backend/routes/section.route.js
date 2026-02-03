import express from 'express';

import { getAllSections, getSectionById, createSection, updateSection, deleteSection } from '../controllers/section.controller.js';
const router = express.Router();

router.get("/", getAllSections);
router.get("/:id", getSectionById);
router.post("/", createSection);
router.put("/:id", updateSection);
router.delete("/:id", deleteSection);

export default router;