import mongoose from 'mongoose';

const TestSchema = new mongoose.Schema({
  _id: { type: String, required: true },
  title: { type: String, required: true }, // VD: "Cambridge 18 - Test 1"
  category: { type: String, default: 'Uncategorized', trim: true }, // e.g., "Cambridge 18"
  type: { type: String, enum: ['reading', 'listening', 'writing'], default: 'reading' }, // Focus on one skill per test

  // Duration in minutes (60 for reading, 35 for listening, default 45 for writing)
  duration: { type: Number, default: 60 },

  // Metadata
  created_at: { type: Date, default: Date.now },
  is_active: { type: Boolean, default: true },
  is_real_test: { type: Boolean, default: false },

  // LIÊN KẾT: Một mảng chứa ID của các Passage
  // Thứ tự trong mảng này chính là thứ tự bài thi (Passage 1, 2, 3)
  reading_passages: [
    {
      type: String,
      ref: 'Passage'
      // Tên model bạn đã export ở file Passage.js
    }
  ],
  listening_sections: [
    {
      type: String,
      ref: 'Section'
      // Tên model bạn đã export ở file Section.js
    }
  ],
  // LIÊN KẾT: Mảng chứa ID của các Writing tasks
  // Thứ tự trong mảng này chính là thứ tự bài viết (Writing Task 1, 2)
  writing_tasks: [
    {
      type: String,
      ref: 'Writing'
    }
  ]
});

// Static method to create or update a test with multiple writing tasks
TestSchema.statics.add = async function (testId, title, type, readingPassageIds, listeningSectionIds, writingTaskIds) {
  try {
    const testData = {
      _id: testId,
      title,
      type,
      reading_passages: readingPassageIds || [],
      listening_sections: listeningSectionIds || [],
      writing_tasks: writingTaskIds || [],
      is_active: true,
      created_at: new Date()
    };

    // Upsert: update if exists, otherwise create new
    const test = await this.findOneAndUpdate(
      { _id: testId },
      testData,
      { upsert: true, new: true, runValidators: true }
    );
    return test;
  } catch (error) {
    throw new Error(`Error creating/updating test: ${error.message}`);
  }
};

// Static method to add writing tasks to an existing test
TestSchema.statics.addWritingTasks = async function (testId, writingTaskIds) {
  try {
    const test = await this.findById(testId);
    if (!test) {
      throw new Error('Test not found');
    }

    // Add new writing task IDs (avoid duplicates)
    const existingIds = test.writing_tasks.map(id => id.toString());
    const newIds = writingTaskIds.filter(id => !existingIds.includes(id.toString()));

    test.writing_tasks = [...test.writing_tasks, ...newIds];
    await test.save();
    return test;
  } catch (error) {
    throw new Error(`Error adding writing tasks: ${error.message}`);
  }
};

const Test = mongoose.model('Test', TestSchema);
export default Test;
