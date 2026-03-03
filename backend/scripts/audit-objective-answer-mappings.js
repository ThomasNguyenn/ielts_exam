import dotenv from "dotenv";
import mongoose from "mongoose";
import path from "path";
import { fileURLToPath } from "url";
import { connectDB } from "../config/db.js";
import Passage from "../models/Passage.model.js";
import Section from "../models/Section.model.js";
import { validateObjectiveAnswerMappings } from "../services/objectiveAnswerValidation.service.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.join(__dirname, "../.env") });

const formatExpectedOptions = (expectedOptions = []) => {
    if (!Array.isArray(expectedOptions) || expectedOptions.length === 0) return "(no option preview)";
    return expectedOptions.join(" | ");
};

const collectDocumentIssues = (entityType, entity = {}) => {
    const details = validateObjectiveAnswerMappings(entity?.question_groups || []);
    return details.map((detail) => ({
        entityType,
        entityId: String(entity?._id || ""),
        entityTitle: String(entity?.title || ""),
        ...detail,
    }));
};

const auditAnswerMappings = async () => {
    await connectDB();

    const [passages, sections] = await Promise.all([
        Passage.find({}).select("_id title question_groups").lean(),
        Section.find({}).select("_id title question_groups").lean(),
    ]);

    const issues = [
        ...passages.flatMap((passage) => collectDocumentIssues("passage", passage)),
        ...sections.flatMap((section) => collectDocumentIssues("section", section)),
    ];

    if (issues.length === 0) {
        console.log("[audit:answer-mappings] No unresolved option alias mappings found.");
        return 0;
    }

    console.log(`[audit:answer-mappings] Found ${issues.length} unresolved mapping issue(s).`);
    issues.forEach((issue, index) => {
        const location = `${issue.entityType}:${issue.entityId}`;
        const groupLabel = `groupIndex=${issue.groupIndex}`;
        const questionLabel = `question=${issue.questionNumber}`;
        const typeLabel = `type=${issue.groupType}`;
        const invalidLabel = `invalidToken="${issue.invalidToken}"`;
        const expected = formatExpectedOptions(issue.expectedOptions);
        const title = issue.entityTitle ? ` title="${issue.entityTitle}"` : "";
        console.log(
            `${index + 1}. ${location}${title} ${groupLabel} ${questionLabel} ${typeLabel} ${invalidLabel} expected=[${expected}]`,
        );
    });

    return 1;
};

try {
    const exitCode = await auditAnswerMappings();
    process.exitCode = exitCode;
} catch (error) {
    console.error("[audit:answer-mappings] Failed:", error?.message || error);
    process.exitCode = 2;
} finally {
    try {
        await mongoose.connection.close();
    } catch {
        // ignore close errors in scripts
    }
}
