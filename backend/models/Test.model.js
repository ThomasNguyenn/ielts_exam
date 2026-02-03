import mongoose from 'mongoose';

const TestSchema = new mongoose.Schema({
  _id : { type: String, required: true },
  title: { type: String, required: true }, // VD: "Cambridge 18 - Test 1"
  type: { type: String, enum: ['reading', 'listening'], default: 'reading' }, // Focus on one skill per test

  // Metadata
  created_at: { type: Date, default: Date.now },
  is_active: { type: Boolean, default: true },

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
    }]
});

const Test = mongoose.model('Test', TestSchema);
export default Test;