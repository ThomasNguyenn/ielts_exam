# Kế hoạch triển khai hệ thống bài tập tháng

## Mục tiêu

- **Thêm module "Bài tập tháng"** cho giáo viên trong hệ thống hiện tại.
- Cho phép **giáo viên tạo các nhiệm vụ (tasks) theo template**: xem video + tóm tắt, nghe audio + chép, chép tay bài đọc, skim, shadowing, viết supporting sentences, v.v.
- Cho phép **học sinh xem bài tập theo tháng/tuần và nộp bài trực tiếp** (text, ảnh, audio) trên frontend.

## Thiết kế backend

- **Model mới: `MonthlyAssignment`** (MongoDB)
- Các trường chính:
- `title`, `description`, `month`, `week`, `due_date`.
- `tasks`: mảng các task con (xem chi tiết dưới).
- `created_by` (ref User), `target_group` (lớp/nhóm hoặc toàn bộ), `is_active`.
- **Model mới: `MonthlyAssignmentSubmission`**
- Liên kết giữa **học sinh – assignment – task**.
- Trường:
- `assignment_id`, `task_id` (subdocument id trong assignment), `student_id`.
- `text_answer` (tóm tắt, ghi chú, supporting sentences…),
- `image_urls` (ảnh chép tay),
- `audio_urls` (ghi âm shadowing / kể lại…),
- `status` (submitted/graded), `score` (optional), `teacher_feedback`.
- **Kiểu `Task` bên trong `MonthlyAssignment`**
- Các field chung:
- `_id`, `type`, `title`, `instruction`, `order`.
- `resource`: link YouTube/audio/bài đọc, hoặc ID nội dung trong hệ thống.
- `min_words` / `max_words` (cho task viết),
- `requires_text`, `requires_image`, `requires_audio` (flags để biết cần form nào).
- **Enum `type` đề xuất (mapping từ mô tả của bạn):**
- `WATCH_AND_SUMMARIZE` – xem YouTube, viết tóm tắt 100–150 từ.
- `LISTEN_AND_TRANSCRIBE` – nghe audio, chép lại từng đoạn, upload ảnh bản chép.
- `HANDWRITING_READING` – chép lại bài đọc, gạch chân từ/collocation, upload ảnh.
- `SKIM_AND_KEYPOINTS` – dùng kỹ thuật skim, viết key 4–5 từ/đoạn, upload ảnh/ text.
- `SHADOWING` – shadowing 2 phút đầu video, upload audio + (tùy chọn) video.
- `WRITE_SUPPORTING_SENTENCES` – viết 1–2 câu hỗ trợ cho 3 topic sentences.
- **Route & controller mới** (ví dụ trong `backend/routes/monthlyAssignment.route.js` và `backend/controllers/monthlyAssignment.controller.js`):
- `POST /api/monthly-assignments` (teacher/admin): tạo assignment + danh sách tasks.
- `GET /api/monthly-assignments` (teacher/admin): list theo tháng/nhóm.
- `GET /api/monthly-assignments/me` (student): lấy assignments applicable cho học sinh.
- `GET /api/monthly-assignments/:id` (auth): chi tiết assignment + tasks.
- `POST /api/monthly-assignments/:id/tasks/:taskId/submit` (student): nộp bài;
- Body multipart (FormData) hỗ trợ: text, ảnh (1-n), audio (1-n).
- `GET /api/monthly-assignments/:id/submissions` (teacher): xem bài đã nộp.
- `PUT /api/monthly-assignments/submissions/:submissionId/grade` (teacher): chấm điểm/feedback.
- **Upload file tái sử dụng hạ tầng DO Spaces hiện tại**
- Tạo các helper trong `[backend/services/objectStorage.service.js]` hoặc file mới:
- `uploadAssignmentImageObject`, `uploadAssignmentAudioObject` với prefix riêng, ví dụ:
- `assignments/images/...`,
- `assignments/audio/...`.
- Middleware `multer` mới giống `handleSectionAudioUpload` nhưng cho phép:
- nhiều file ảnh (`images[]`) và 1 file audio (`audio`).

## Thiết kế frontend

- **Khu vực giáo viên (Admin/Teacher UI)**
- Trang mới: `ManageMonthlyAssignments` (ví dụ trong `[frontend/src/pages/admin/MonthlyAssignments.jsx]`)
- Danh sách assignment theo tháng (filter by `month`, `week`).
- Nút "Tạo bài tập tháng".
- Form "Tạo/Chỉnh sửa bài tập tháng":
- Chọn: tháng (YYYY-MM), tuần (1–4), nhóm học sinh (class/group).
- Nhập tiêu đề, mô tả chung.
- **Dynamic list các task**:
- Dropdown chọn `type` (6 loại nêu trên).
- Tuỳ theo `type` hiện các field khác nhau:
  - Link YouTube / audio / PDF / ID bài đọc.
  - Giới hạn từ (100–150), yêu cầu nộp (text/ảnh/audio).
- Editor rich text/markdown nhỏ để nhập "Hướng dẫn chi tiết" – bạn có thể copy/paste nguyên các đoạn mô tả kỹ thuật skim/shadowing/handwriting hiện tại.
- Gửi form → gọi `api.createMonthlyAssignment` (thêm client mới trong `[frontend/src/shared/api/client.js]`).

- **Khu vực học sinh**
- Trang mới: `MyMonthlyAssignments` (ví dụ `[frontend/src/pages/student/MonthlyAssignments.jsx]`)
- Lấy dữ liệu từ `GET /api/monthly-assignments/me`.
- Group theo tháng/tuần, hiển thị progress (số task đã nộp / tổng).
- Trang chi tiết: `MonthlyAssignmentDetail`:
- Hiển thị từng task với:
- Loại task, hướng dẫn chi tiết (có format), link resource (YouTube/audio/bài đọc).
- Nút mở form nộp bài.
- **Form nộp bài theo loại task**:
- `WATCH_AND_SUMMARIZE` → textarea giới hạn 100–150 từ + hiển thị counter.
- `LISTEN_AND_TRANSCRIBE` → upload 1–3 ảnh bản chép tay (preview), optional text note.
- `HANDWRITING_READING` → upload ảnh + ô gõ vài collocations đã gạch chân (optional).
- `SKIM_AND_KEYPOINTS` → textarea/hoặc upload ảnh note, giới hạn mỗi đoạn ≤5 từ.
- `SHADOWING` → upload audio/video file (mp3/mp4, giới hạn dung lượng).
- `WRITE_SUPPORTING_SENTENCES` → 3 block input, mỗi block 1–2 câu supporting.
- Sau khi submit, hiển thị trạng thái: "Đã nộp", "Đã chấm", kèm feedback nếu có.

- **API client mới trong frontend** (`[frontend/src/shared/api/client.js]`)
- Thêm:
- `getMonthlyAssignments`, `getMyMonthlyAssignments`,
- `createMonthlyAssignment`, `updateMonthlyAssignment`, `deleteMonthlyAssignment`,
- `submitMonthlyTask` (gửi `FormData`),
- `getMonthlyAssignmentSubmissions`, `gradeMonthlySubmission`.

## Mapping chi tiết từ mô tả -> Task type

- **Xem YouTube + viết tóm tắt 100–150 từ**
- `type: WATCH_AND_SUMMARIZE`
- `resource.youtubeUrl`, `min_words = 100`, `max_words = 150`, `requires_text = true`.
- **Nghe audio + chép tay từng đoạn, upload ảnh**
- `type: LISTEN_AND_TRANSCRIBE`
- `resource.audioUrl`, `requires_image = true`.
- **Chép tay bài đọc, gạch chân từ/collocations, ghi nghĩa**
- `type: HANDWRITING_READING`
- `resource.readingContentId` hoặc `readingText` embed.
- `requires_image = true`, optional `requires_text = true` (note các từ/collocations).
- **Dùng kỹ thuật skim, ghi ND chính từng đoạn (≤ 5 từ)**
- `type: SKIM_AND_KEYPOINTS`
- `resource.readingContentId` hoặc link.
- `requires_text = true` (nhập key points) hoặc `requires_image = true` (ảnh vở).
- **Nghe 1 lần, tập trung tối đa rồi kể lại bằng tiếng Việt (ghi âm)**
- Có thể là biến thể của `SHADOWING` hoặc riêng `LISTEN_AND_RETELL`:
- `requires_audio = true`, hiển thị hướng dẫn tiếng Việt như bạn mô tả.
- **Shadowing 2 phút đầu video**
- `type: SHADOWING`
- `resource.youtubeUrl`, `requires_audio = true`, `shadowing_duration_seconds = 120`.
- **Viết 1–2 câu hỗ trợ cho 3 topic sentences**
- `type: WRITE_SUPPORTING_SENTENCES`
- `resource.topicSentences` (mảng 3 câu), `requires_text = true` với cấu trúc 3 block.

## Quyền truy cập & bảo mật

- Chỉ **role teacher/admin** mới:
- Tạo/sửa/xoá `MonthlyAssignment`.
- Xem toàn bộ submissions + chấm điểm.
- Học sinh chỉ được:
- Xem assignments dành cho mình.
- CRUD submissions **của chính mình** (có thể cho phép sửa trước deadline).
- Upload file dùng **rate limit & size limit** giống audio/image hiện có (`uploadRateLimit`, `SECTION_AUDIO_MAX_BYTES` / config riêng cho ảnh & audio assignment).

## Bước triển khai cụ thể

1. **Thêm models & schema backend** (`MonthlyAssignment`, `MonthlyAssignmentSubmission`) trong `[backend/models]`.
2. **Tạo routes + controllers** cho monthly assignments & submissions trong `[backend/routes/monthlyAssignment.route.js]` và `[backend/controllers/monthlyAssignment.controller.js]`.
3. **Mở rộng `objectStorage.service.js`** để hỗ trợ upload ảnh/audio cho assignments với prefix riêng.
4. **Thêm API client** trong `[frontend/src/shared/api/client.js]` cho monthly assignments.
5. **Tạo UI giáo viên** (list + create/edit form) trong thư mục admin trên frontend.
6. **Tạo UI học sinh** (list assignments, chi tiết, form nộp) và tích hợp với API.
7. **Test end-to-end** với từng loại task (upload file, giới hạn từ, hiển thị hướng dẫn, submissions/feedback).
8. **Viết tài liệu hướng dẫn cho giáo viên** cách tạo từng loại task dựa trên các mô tả bạn cung cấp.