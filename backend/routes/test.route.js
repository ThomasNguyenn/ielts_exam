import express from 'express';

import { getAllTests, createTest, updateTest, deleteTest, getTheTestById, getExamData, submitExam } from '../controllers/test.controller.js';
const router = express.Router();

router.get("/", getAllTests);
router.post("/", createTest);
router.get("/:id/exam", getExamData);
router.post("/:id/submit", submitExam);
router.get("/:id", getTheTestById);
router.put("/:id", updateTest);
router.delete("/:id", deleteTest);

export default router;