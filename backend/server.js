import express from 'express';
import cors from 'cors';
import { connectDB } from './config/db.js';

import passageRoutes from './routes/passage.route.js';
import sectionRoutes from './routes/section.route.js';
import testRoutes from './routes/test.route.js';
import writingRoutes from './routes/writing.route.js';
import practiceRoutes from './routes/practiceRoutes.js';
import authRoutes from './routes/auth.route.js';
import vocabularyRoutes from './routes/vocabularyRoutes.js';
import adminRoutes from './routes/admin.route.js';
import speakingRoutes from './routes/speaking.routes.js';
import path from 'path';
import fs from 'fs';

const app = express();
const PORT = process.env.PORT || 5000;

app.use(cors());
app.use(express.json());

app.use("/api/auth", authRoutes);
app.use("/api/passages", passageRoutes);
app.use("/api/sections", sectionRoutes);
app.use("/api/tests", testRoutes);
app.use("/api/writings", writingRoutes);
app.use("/api/practice", practiceRoutes);
app.use("/api/vocabulary", vocabularyRoutes);
app.use("/api/admin", adminRoutes);
app.use("/api/speaking", speakingRoutes);

// Serve static files from uploads directory
const uploadDir = path.join(process.cwd(), 'uploads');
if (!fs.existsSync(uploadDir)) {
    fs.mkdirSync(uploadDir, { recursive: true });
}
app.use("/uploads", express.static(uploadDir));

app.listen(PORT, () => {
    connectDB();
    console.log(`Server is running on port ${PORT}`);
});

