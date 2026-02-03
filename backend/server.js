import express from 'express';
import { connectDB } from './config/db.js';

import passageRoutes from './routes/passage.route.js';
import sectionRoutes from './routes/section.route.js';
import testRoutes from './routes/test.route.js';
const app = express();
const PORT = process.env.PORT || 5000;

app.use(express.json());

app.use("/api/passages", passageRoutes);
app.use("/api/sections", sectionRoutes);
app.use("/api/tests", testRoutes);

app.listen(PORT, () => {
    connectDB();
    console.log(`Server is running on port ${PORT}`);
});

