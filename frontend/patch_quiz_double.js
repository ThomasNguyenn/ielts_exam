const fs = require('fs');
const path = require('path');
const file = 'c:\\Users\\nminh\\Desktop\\LearnReact\\frontend\\src\\features\\homework\\pages\\MyHomeworkLessonPage.jsx';
let content = fs.readFileSync(file, 'utf8');

// 1. Remove the hidden sm:block from the main quiz body so it shows everywhere
content = content.replace(
    '<div className="homework-quiz-body !p-0 hidden sm:block">',
    '<div className="homework-quiz-body !p-0">'
);

// 2. Remove the duplicated secondary block entirely
const startMatch = '<div className="homework-quiz-body block sm:hidden">';
const startIdx = content.indexOf(startMatch);

if (startIdx !== -1) {
    // Find where it ends
    const endMatch = '      <p className="homework-item-meta">Selections are kept locally on this page while you work.</p>';
    const endIdx = content.indexOf(endMatch, startIdx);

    if (endIdx !== -1) {
        // Cut out the duplicate list entirely
        content = content.substring(0, startIdx) + content.substring(endIdx);
    }
}

fs.writeFileSync(file, content, 'utf8');
console.log('Fixed double rendering in MyHomeworkLessonPage.jsx');
