import express from 'express';

import { getAllPassages, getPassageById, createPassage, updatePassage, deletePassage } from '../controllers/passage.controller.js';
const router = express.Router();

router.get("/", getAllPassages);
router.get("/:id", getPassageById);
router.post("/", createPassage);
router.put("/:id", updatePassage);
router.delete("/:id", deletePassage);

export default router;