import os

file_path = "src/features/homework/pages/MyHomeworkLessonPage.jsx"
with open(file_path, "r", encoding="utf-8") as f:
    content = f.read()

# 1. Remove hidden sm:block
content = content.replace(
  '<div className="homework-quiz-body !p-0 hidden sm:block">',
  '<div className="homework-quiz-body !p-0">'
)

# 2. Remove the duplicated secondary block explicitly
start_match = '<div className="homework-quiz-body block sm:hidden">'
end_match = '      <p className="homework-item-meta">Selections are kept locally on this page while you work.</p>'

start_idx = content.find(start_match)
if start_idx != -1:
    end_idx = content.find(end_match, start_idx)
    if end_idx != -1:
        content = content[:start_idx] + content[end_idx:]

with open(file_path, "w", encoding="utf-8") as f:
    f.write(content)

print("Fixed double rendering in MyHomeworkLessonPage.jsx")
