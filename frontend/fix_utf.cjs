const fs = require('fs');
const files = [
  'src/features/tests/pages/exam/components/ExamResultView.jsx',
  'src/features/tests/pages/exam/utils/examMappers.js',
  'src/features/tests/pages/exam/utils/examStorage.js'
];
for(const f of files) {
  let content = fs.readFileSync(f, 'utf8');
  try {
    let fixed = Buffer.from(content, 'latin1').toString('utf8');
    // Save it if it seems to have valid Vietnamese characters
    // e.g. "đáp án", "Thời gian", "Lỗi", "điểm"
    // Just saving it back if it's different.
    if (fixed !== content && !fixed.includes('')) {
       console.log('Successfully decoded: ' + f);
       fs.writeFileSync(f, fixed, 'utf8');
    } else {
       console.log('Did not replace ' + f + ' (might contain  or was identical)');
    }
  } catch(e) {
    console.log('Error decoding ' + f);
  }
}
