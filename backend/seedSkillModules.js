import mongoose from 'mongoose';
import dotenv from 'dotenv';
import SkillModule from './models/SkillModule.model.js';

dotenv.config();

const skillModulesData = [
    {
        moduleNumber: 1,
        order: 1,
        title: "Understanding Task Requirements",
        description: "Learn how to analyze IELTS writing questions and identify exactly what is being asked.",
        icon: "📚",
        estimatedMinutes: 10,
        content: {
            lesson: `
# Understanding Task Requirements

## Learning Objectives
By the end of this module, you will be able to:
- Identify different IELTS Task 2 question types
- Extract key requirements from any writing prompt
- Recognize what the examiner is looking for

## Why This Matters
One of the most common mistakes students make is **not fully addressing the question**. This can limit your Task Response score to Band 5 or below, even if your English is excellent.

## IELTS Task 2 Question Types

### 1. Opinion (Agree/Disagree)
**Example:** *"Do you agree or disagree that technology has improved our lives?"*

**What you must do:**
- State your position clearly
- Support with reasons and examples
- Address the opposing view (optional but recommended for Band 7+)

### 2. Discussion
**Example:** *"Discuss both views and give your own opinion."*

**What you must do:**
- Present both perspectives fairly
- Give your personal stance
- Use balanced structure

### 3. Advantage/Disadvantage
**Example:** *"Do the advantages of working from home outweigh the disadvantages?"*

**What you must do:**
- Discuss BOTH advantages and disadvantages
- Make a judgment (which outweighs which)

### 4. Problem/Solution
**Example:** *"What are the causes of pollution and what solutions can you suggest?"*

**What you must do:**
- Identify multiple causes
- Propose practical solutions

### 5. Two-Part Question
**Example:** *"Why is this happening? What measures can be taken?"*

**What you must do:**
- Answer BOTH parts equally
- Organize clearly (one part per body paragraph)

## The 3-Step Analysis Method

### Step 1: Underline Keywords
Look for:
- **Topic words** (e.g., "technology", "education")
- **Instruction words** (e.g., "discuss", "agree", "causes")
- **Limiting words** (e.g., "only", "most important", "recent years")

### Step 2: Identify the Question Type
Match it to one of the 5 types above.

### Step 3: Create a Mental Checklist
Ask yourself: *What must I include to fully answer this?*

## Practice Example

**Question:** *"Some people believe that studying abroad is essential for career success, while others think local education is sufficient. Discuss both views and give your own opinion."*

**Analysis:**
- **Type:** Discussion + Opinion
- **Keywords:** studying abroad, career success, local education
- **Requirements:**
  ✓ View 1: Why studying abroad helps careers
  ✓ View 2: Why local education is enough
  ✓ My opinion: Which I support (or balanced view)

## Common Mistakes to Avoid

❌ Only discussing one side in a "discuss both views" question
❌ Forgetting to give your opinion when asked
❌ Writing about a different topic entirely
❌ Focusing on advantages only when asked about both

## Key Takeaway
**Before you start planning your essay, spend 2-3 minutes analyzing the question. This ensures you:** stay on topic and address all parts of the task.
            `,
            keyPoints: [
                "There are 5 main IELTS Task 2 question types",
                "Underline keywords to identify requirements",
                "Create a mental checklist before writing",
                "Missing even one requirement can lower your score"
            ],
            checkpointQuiz: [
                {
                    question: "Question: 'Do you agree or disagree that children should learn foreign languages at primary school?' What type is this?",
                    options: ["Opinion (Agree/Disagree)", "Discussion", "Advantage/Disadvantage", "Problem/Solution"],
                    correctAnswer: 0,
                    explanation: "This is an Opinion question because it asks you to state whether you agree or disagree."
                },
                {
                    question: "How many parts must you address in: 'What are the main causes of obesity and what solutions can you propose?'",
                    options: ["1 part", "2 parts", "3 parts", "4 parts"],
                    correctAnswer: 1,
                    explanation: "This is a two-part question: (1) causes of obesity, (2) solutions."
                },
                {
                    question: "In a 'discuss both views and give your opinion' question, can you skip giving your opinion?",
                    options: ["Yes, it's optional", "No, it's required", "Only if you discuss both views well", "Depends on the topic"],
                    correctAnswer: 1,
                    explanation: "When the question explicitly asks for your opinion, you MUST provide it. Skipping it will lower your Task Response score."
                }
            ]
        }
    },
    {
        moduleNumber: 2,
        order: 2,
        title: "Crafting Strong Thesis Statements",
        description: "Master the art of writing clear, direct thesis statements that guide your entire essay.",
        icon: "🎯",
        estimatedMinutes: 12,
        unlockRequirement: {
            minimumScore: 70
        },
        content: {
            lesson: `
# Crafting Strong Thesis Statements

## What is a Thesis Statement?
A thesis statement is **one or two sentences** in your introduction that:
1. Directly answers the question
2. Previews your main points
3. Takes a clear position

Think of it as a **promise to the reader** about what you'll discuss.

## Why It Matters for IELTS
Examiners look for your thesis in the introduction. A clear thesis shows:
- You understand the question (Task Response)
- Your essay is well-organized (Coherence & Cohesion)

**Band 7+** essays have clear, well-positioned thesis statements.

## The Formula

### For Opinion Essays:
**"I [agree/disagree] that [restate topic] because [reason 1] and [reason 2]."**

**Example:**
*Question: Do you agree that remote work is better than office work?*

*Thesis: I strongly agree that remote work is superior to traditional office work because it offers greater flexibility and reduces commuting stress.*

### For Discussion Essays:
**"While [view 1], I believe [view 2] because [reason]."**

**Example:**
*Thesis: While some argue that online education lacks personal interaction, I believe it is the future of learning because of its accessibility and customization.*

### For Advantage/Disadvantage:
**"Despite [disadvantages], I believe the advantages of [topic], such as [advantage 1] and [advantage 2], outweigh the drawbacks."**

## Position in Essay
Your thesis should appear **at the end of your introduction**, after:
1. Background sentence (paraphrase the question)
2. Thesis statement (your direct answer)

## Common Mistakes

❌ **Too vague:** "Technology has both good and bad sides."
✅ **Clear:** "Technology has improved education through online resources and collaborative tools."

❌ **Too long:** (A 4-sentence thesis that rambles)
✅ **Concise:** 1-2 sentences maximum

❌ **Missing:** Not stating your position at all
✅ **Direct:** "I completely agree that..."

## Practice

**Question:** *"Some people think art classes are essential in schools. Others believe they are a waste of time. Discuss both views and give your opinion."*

**Weak Thesis:**
"Art classes have supporters and critics."

**Strong Thesis:**
"While some view art education as non-essential, I believe art classes are crucial for developing creativity and emotional intelligence in students."

## Key Takeaway
A strong thesis is clear, direct, and answers the question completely. Spend time crafting it—it guides your entire essay.
            `,
            keyPoints: [
                "Thesis = Direct answer + Preview of main points",
                "Place at the end of your introduction",
                "Keep it 1-2 sentences maximum",
                "Must take a clear position"
            ],
            examples: [
                "I strongly agree that governments should prioritize public health over economic growth because preventive care reduces long-term costs and improves quality of life.",
                "While online shopping offers convenience, I believe traditional retail provides better customer experience through personal service and immediate product access."
            ],
            checkpointQuiz: [
                {
                    question: "Where should your thesis statement appear?",
                    options: ["First sentence of introduction", "End of introduction", "Start of body paragraph", "In the conclusion"],
                    correctAnswer: 1,
                    explanation: "The thesis should be at the END of the introduction, after you've provided background context."
                },
                {
                    question: "Which is a stronger thesis? Question: 'Do you agree that social media harms mental health?'",
                    options: [
                        "Social media has good and bad effects.",
                        "I agree that social media harms mental health because it promotes comparison and reduces face-to-face interaction.",
                        "Social media is very popular nowadays.",
                        "Some people use social media, others don't."
                    ],
                    correctAnswer: 1,
                    explanation: "Option 2 is strongest because it takes a clear position and gives specific reasons."
                },
                {
                    question: "How long should a thesis statement be?",
                    options: ["1-2 sentences", "A full paragraph", "3-4 sentences", "Just one word"],
                    correctAnswer: 0,
                    explanation: "Keep your thesis concise: 1-2 sentences maximum."
                }
            ]
        }
    },
    {
        moduleNumber: 3,
        order: 3,
        title: "Paragraph Structure (PEEL Method)",
        description: "Learn the PEEL framework to write well-developed body paragraphs that score highly.",
        icon: "🏗️",
        estimatedMinutes: 15,
        unlockRequirement: {
            minimumScore: 70
        },
        content: {
            lesson: `
# Paragraph Structure: The PEEL Method

## What is PEEL?
PEEL is a framework for organizing body paragraphs:

**P** - Point (Topic Sentence)
**E** - Explanation
**E** - Example
**L** - Link back to the question

This structure ensures your ideas are **fully developed** (key for Band 7+).

## Breaking Down PEEL

### P - Point (Topic Sentence)
- **What it is:** The first sentence that states your main idea
- **Function:** Tells the reader what this paragraph is about
- **Example:** "Remote work significantly reduces commuting stress."

### E - Explanation
- **What it is:** 2-3 sentences explaining WHY your point is true
- **Function:** Develops your idea with reasoning
- **Example:** "Traditional office jobs require employees to spend 1-2 hours daily traveling, which causes fatigue and reduces productivity. By working from home, professionals can eliminate this unproductive time and start their day feeling more energized."

### E - Example
- **What it is:** A specific illustration or evidence
- **Function:** Makes your argument concrete and convincing
- **Example:** "For instance, a recent study by Stanford University found that remote workers reported 25% less stress and 13% higher productivity compared to their office counterparts."

### L - Link
- **What it is:** Final sentence connecting back to your thesis or the question
- **Function:** Shows how this paragraph supports your overall argument
- **Example:** "Therefore, the flexibility of remote work clearly contributes to better employee well-being and performance."

## Full PEEL Paragraph Example

**Question:** *Do you agree that remote work is better than office work?*

**PEEL Paragraph:**

**[P]** Remote work significantly contributes to better work-life balance. 

**[E]** Unlike traditional office schedules that require strict 9-to-5 presence, remote work allows employees to structure their day around both professional and personal commitments. This flexibility means parents can attend school events, individuals can schedule medical appointments without taking leave, and workers can optimize their productivity during their peak energy hours rather than conforming to arbitrary schedules. 

**[E]** For example, Microsoft Japan's four-day workweek experiment in 2019, which included remote work options, resulted in a 40% increase in productivity and significantly improved employee satisfaction scores. 

**[L]** Thus, the autonomy provided by remote work creates a healthier integration of professional and personal life, making it superior to conventional office arrangements.

## Common Mistakes

❌ **Missing Explanation:** Jumping straight from Point to Example
Wrong: "Remote work is better. For example, many people work from home."

❌ **No Link:** Ending abruptly without connecting to the main argument

❌ **Weak Examples:** Vague or hypothetical examples
Wrong: "I think people are happier at home."
Right: "According to a 2020 survey of 1,000 remote workers..."

## Practice Structure

For each body paragraph, ask yourself:
1. ✓ Did I state my main point clearly?
2. ✓ Did I explain WHY this point matters?
3. ✓ Did I give a specific example or evidence?
4. ✓ Did I link back to my thesis/question?

## Key Takeaway
PEEL ensures your paragraphs are **fully developed**. Band 5-6 essays often state points without explaining them. Band 7+ essays use PEEL to develop ideas thoroughly.
            `,
            keyPoints: [
                "PEEL = Point, Explanation, Example, Link",
                "Every body paragraph should follow this structure",
                "Explanation is often the longest part (2-3 sentences)",
                "Always link back to your main argument"
            ],
            examples: [
                "Point: Urban green spaces improve mental health.\nExplanation: Access to nature reduces stress hormones and provides a peaceful environment for relaxation...\nExample: Research from the University of Exeter showed that...\nLink: Therefore, investing in parks is essential for public wellbeing."
            ],
            checkpointQuiz: [
                {
                    question: "What does the first 'E' in PEEL stand for?",
                    options: ["Evidence", "Explanation", "Example", "Evaluation"],
                    correctAnswer: 1,
                    explanation: "The first E is Explanation—you explain WHY your point is valid before giving an example."
                },
                {
                    question: "What is the purpose of the 'Link' in PEEL?",
                    options: [
                        "To start a new topic",
                        "To introduce an example",
                        "To connect the paragraph back to the thesis",
                        "To summarize the entire essay"
                    ],
                    correctAnswer: 2,
                    explanation: "The Link connects your paragraph's main point back to your overall thesis or the question."
                },
                {
                    question: "Which part of PEEL is typically the longest?",
                    options: ["Point", "Explanation", "Example", "Link"],
                    correctAnswer: 1,
                    explanation: "Explanation is usually 2-3 sentences where you develop your reasoning in detail."
                }
            ]
        }
    }
];

async function seedSkillModules() {
    try {
        // Connect to MongoDB
        await mongoose.connect(process.env.MONGO_URI);
        console.log('✅ Connected to MongoDB');

        // Clear existing modules
        await SkillModule.deleteMany({});
        console.log('🗑️  Cleared existing skill modules');

        // Insert new modules
        const modules = await SkillModule.insertMany(skillModulesData);
        console.log(`✅ Inserted ${modules.length} skill modules`);

        // Link prerequisites
        for (let i = 1; i < modules.length; i++) {
            await SkillModule.findByIdAndUpdate(modules[i]._id, {
                'unlockRequirement.previousModule': modules[i - 1]._id
            });
        }
        console.log('🔗 Linked module prerequisites');

        console.log('\n📚 Skill Modules Created:');
        modules.forEach(m => {
            console.log(`  ${m.icon} Module ${m.moduleNumber}: ${m.title}`);
        });

        console.log('\n✅ Seed completed successfully!');
        process.exit(0);
    } catch (error) {
        console.error('❌ Error seeding skill modules:', error);
        process.exit(1);
    }
}

seedSkillModules();
