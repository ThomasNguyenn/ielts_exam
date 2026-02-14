import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import mongoose from 'mongoose';
import dotenv from 'dotenv';
import SkillModule from './models/SkillModule.model.js';

dotenv.config();

const SCRIPT_DIR = path.dirname(fileURLToPath(import.meta.url));
const DEFAULT_SEED_PATH = path.join(SCRIPT_DIR, 'data', 'skill-modules.seed.json');

const getSeedFilePath = () => {
    const cliPath = process.argv[2];
    if (cliPath && String(cliPath).trim()) {
        return path.resolve(process.cwd(), cliPath);
    }
    if (process.env.SKILL_MODULES_SEED_FILE && String(process.env.SKILL_MODULES_SEED_FILE).trim()) {
        return path.resolve(process.cwd(), process.env.SKILL_MODULES_SEED_FILE);
    }
    return DEFAULT_SEED_PATH;
};

const normalizeModulePayload = (raw, index) => {
    const moduleNumber = Number(raw?.moduleNumber) || index + 1;
    const order = Number(raw?.order) || moduleNumber;

    return {
        moduleNumber,
        order,
        title: String(raw?.title || '').trim(),
        description: String(raw?.description || '').trim(),
        icon: String(raw?.icon || '📚').trim() || '📚',
        estimatedMinutes: Math.max(1, Number(raw?.estimatedMinutes) || 10),
        isActive: raw?.isActive !== false,
        content: {
            lesson: String(raw?.content?.lesson || '').trim(),
            videoUrl: String(raw?.content?.videoUrl || '').trim(),
            examples: Array.isArray(raw?.content?.examples) ? raw.content.examples : [],
            keyPoints: Array.isArray(raw?.content?.keyPoints) ? raw.content.keyPoints : [],
            resources: Array.isArray(raw?.content?.resources) ? raw.content.resources : [],
            checkpointQuiz: Array.isArray(raw?.content?.checkpointQuiz) ? raw.content.checkpointQuiz : [],
        },
        unlockRequirement: {
            minimumScore: Math.max(1, Math.min(100, Number(raw?.unlockRequirement?.minimumScore) || 70)),
        },
    };
};

async function seedSkillModules() {
    try {
        const seedFilePath = getSeedFilePath();
        const rawFile = await fs.readFile(seedFilePath, 'utf8');
        const parsed = JSON.parse(rawFile);

        if (!Array.isArray(parsed) || parsed.length === 0) {
            throw new Error('Seed file must contain a non-empty JSON array of modules');
        }

        await mongoose.connect(process.env.MONGO_URI);
        console.log('Connected to MongoDB');
        console.log(`Loading modules from: ${seedFilePath}`);

        const modulesPayload = parsed.map(normalizeModulePayload);

        await SkillModule.deleteMany({});
        console.log('Cleared existing skill modules');

        const modules = await SkillModule.insertMany(modulesPayload);
        console.log(`Inserted ${modules.length} skill modules`);

        for (let i = 1; i < modules.length; i++) {
            await SkillModule.findByIdAndUpdate(modules[i]._id, {
                'unlockRequirement.previousModule': modules[i - 1]._id,
            });
        }
        console.log('Linked module prerequisites in sequence');

        console.log('\nSkill modules created:');
        modules.forEach((module) => {
            console.log(`  Module ${module.moduleNumber}: ${module.title}`);
        });

        console.log('\nSeed completed successfully');
        process.exit(0);
    } catch (error) {
        console.error('Error seeding skill modules:', error);
        process.exit(1);
    }
}

seedSkillModules();
