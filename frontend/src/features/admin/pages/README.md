# Teacher Input Guide (Passage/Section)

Muc tieu cua file nay: huong dan **giao vien nhap de** theo tung dang cau hoi, de `Exam` tu render dung UI.

File render thi sinh:

- `src/features/tests/components/exam/StepContent.jsx`

File nhap de giao vien:

- `src/features/admin/pages/AddEditPassage.jsx`
- `src/features/admin/pages/AddSection.jsx`
- `src/features/admin/pages/QuestionGroup.jsx`

## 1) Nguyen tac nhap nhanh cho giao vien

Moi `Question Group` giao vien chi can:

1. Chon `Question Type`.
2. Nhap `Instructions` (neu can).
3. Nhap noi dung theo dung mau cua type (o bang ben duoi).
4. Nhap dap an dung o `Correct Answer(s)`.

`Exam` se render theo `type`:

- radio/choice cho cau trac nghiem
- o trong theo `[so]` cho completion/gap-fill
- drag-drop cho matching/summary

## 2) Theo tung Question Type (teacher-facing)

### A. `true_false_notgiven`

Giao vien nhap:

- `Question Text`
- `Correct Answer(s)`: `TRUE` hoac `FALSE` hoac `NOT GIVEN`

Khong can nhap options.
`Exam` tu render 3 lua chon: `TRUE`, `FALSE`, `NOT GIVEN`.

### B. `yes_no_notgiven`

Giao vien nhap:

- `Question Text`
- `Correct Answer(s)`: `YES` hoac `NO` hoac `NOT GIVEN`

Khong can nhap options.
`Exam` tu render 3 lua chon: `YES`, `NO`, `NOT GIVEN`.

### C. `mult_choice`

Giao vien nhap:

- `Question Text`
- Block `Options` cua cau hoi (A, B, C, D...)
- Chon dap an dung bang nut `ID` ben trai tung option (A/B/C/...)
- `Correct Answer(s)` la **read-only**, he thong tu dong dien theo ID da chon

Neu la dang "chon N dap an":

- Dat `Layout = checkbox`
- `Sync Question Slots` de tao N slot data
- UI chi hien **1 shared editor** (khong lap lai N card)
- Click nhieu ID option de toggle dap an dung
- `Correct Answer(s)` hien danh sach ID theo CSV (`A, C, D`)
- Moi slot trong group se duoc dong bo cung 1 danh sach dap an
- Save chi hop le khi so ID da chon = `required_count` (hoac fallback bang so slot)

### D. Matching (`matching_headings`, `matching_features`, `matching_info`, `matching_information`, `matching`)

Giao vien nhap:

- Block `Headings / Labels`: danh sach cap `id + text`
- `Question Text` cho tung dong can match (vd: Paragraph A/B/C)
- `Correct Answer(s)`: co the nhap `id` hoac `text` (uu tien `id`)

Rieng `matching_information`:

- Co nut `Generate from range`.
- Nhap `A-G` hoac `I-VII` de tao nhanh danh sach:
  - `{ id: "A", text: "A" } ...`
  - `{ id: "I", text: "I" } ...`
- Generate se **replace** list hien tai, sau do giao vien van co the sua tay.

Neu de co chen `[so]` trong passage/content thi `Exam` se gan o drag-drop ngay tai cho do.

### E. Completion co option pool

Ap dung cho:

- `summary_completion`
- `note_completion`
- `table_completion`
- `form_completion`
- `listening_map`

Giao vien nhap:

- `Reference Text` (hoac text cua group) co placeholder: `[1]`, `[2]`, ...
- `Options List` (group-level) de keo tha/chon
- Danh sach `Questions` chi de map so thu tu (`q_number`) va dap an
- `Correct Answer(s)`: id option dung (thuong la A/B/C hoac ma id tu dinh nghia)

Luu y:

- Placeholder hop le: `[1]`, `[Q1]`, `[ 1 ]`
- So trong `[]` phai khop `q_number`
- Rieng `summary_completion` co 2 mode runtime:
  - Neu `Options List` co item hop le (`id` hoac `text`) => Exam render drag-drop.
  - Neu `Options List` rong/khong hop le => Exam tu dong render nhu `note_completion` (text input cho moi placeholder).

### E1. `diagram_label_completion` (new workflow)

Giao vien nhap:

- `Diagram Image` (upload hoac URL)
- `ListQuestion` (so dong = so input can co tren anh)
- `Question Text` la **optional** (co the de trong)
- `Correct Answer(s)` theo tung dong

Luu y:

- Neu `Question Text` de trong, Exam van hien `Q{number}` + input.
- `Options List` khong dung cho type nay nua.

### E2. `flow_chart_completion` + `plan_map_diagram` (new workflow)

Giao vien nhap:

- `ListSteps` (moi step 1 dong text)
- Dat placeholder trong step: `[1]`, `[2]`, ...
- Bam `Sync Questions from [n]` de tao/cap nhat answer rows
- Nhap `Correct Answer(s)` cho tung `q_number`

Luu y:

- `Options List` khong dung cho 2 type nay nua.
- Exam render steps theo chieu doc, co mui ten xuong giua cac step.

### F. `gap_fill` (legacy) / `note_completion`

Theo yeu cau workflow giao vien:

- Nhap doan text co lo trong bang placeholder `[1]`, `[2]`, ...
- Khong can viet `Question Text` dai dong
- Moi lo trong can 1 question row de nhap:
  - `q_number` trung voi so trong `[]`
  - `Correct Answer(s)` la dap an cua o do

Noi cach khac: voi gap-fill/note completion, phan quan trong la **placeholder + dap an theo so**, khong phai viet them cau hoi dai.

Luu y he thong:
- `gap_fill` la alias legacy.
- Khi luu moi trong Manage, he thong chuan hoa ve `note_completion`.

### G. `sentence_completion`, `short_answer`

Giao vien nhap:

- `Question Text`
- `Correct Answer(s)` (co the nhieu dap an, cach nhau boi dau phay)

## 3) Rule quan trong de khong bi lech de

### Rule 1: So thu tu

- `q_number` phai dung logic va khop voi placeholder neu co (`[n]`).

### Rule 2: Dap an nhieu gia tri

- Co the nhap nhieu dap an dung: `answer 1, answer 2, answer 3`.

### Rule 3: Option/Heading rong se bi bo khi save

- Option/Heading nao rong se khong gui len payload.

### Rule 4: Completion/GAP fill uu tien text block

- Neu da dung text block voi `[n]`, giao vien chi can quan tam map so + dap an.

### Rule 5: Option-based answer mapping duoc validate khi Save

- Ap dung cho: `mult_choice`, nhom matching, va completion co option pool.
- Neu token trong `Correct Answer(s)` khong map duoc vao `id/label/text` hop le, backend tra `400` va block save.
- Rieng `mult_choice` + `checkbox`: frontend block save neu so dap an da chon khong dung `required_count`.

## 4) Minimal checklist truoc khi Save

1. Type da dung chua?
2. So trong `[n]` da khop `q_number` chua?
3. Moi question da co `Correct Answer(s)` chua?
4. Matching/completion da co pool (`Headings`/`Options`) day du chua?
