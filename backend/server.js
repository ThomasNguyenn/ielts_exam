import express from 'express';
import cors from 'cors';
import { connectDB } from './config/db.js';

import passageRoutes from './routes/passage.route.js';
import sectionRoutes from './routes/section.route.js';
import testRoutes from './routes/test.route.js';
import writingRoutes from './routes/writing.route.js';
import practiceRoutes from './routes/practiceRoutes.js';
import authRoutes from './routes/auth.route.js';

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

app.listen(PORT, () => {
    connectDB();
    console.log(`Server is running on port ${PORT}`);
});

