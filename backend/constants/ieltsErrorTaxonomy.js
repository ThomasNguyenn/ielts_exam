const coreDimensions = {
    reading: {
        assessment: [
            {
                code: "R.A.EXPLICIT",
                label: "Thông tin trực tiếp",
                description: "Độ chính xác dựa trên thông tin hiển thị rõ trong bài.",
            },
            {
                code: "R.A.INFERENCE",
                label: "Suy luận",
                description: "Hiểu ý nghĩa ẩn sau, không được nói trực tiếp.",
            },
            {
                code: "R.A.WRITER_VIEW",
                label: "Quan điểm tác giả",
                description: "Nhận diện thái độ hoặc lập trường của người viết.",
            },
            {
                code: "R.A.LOGIC",
                label: "Theo dõi Logic",
                description: "Hiểu các mối quan hệ tương phản, nguyên nhân hoặc trình tự.",
            },
            {
                code: "R.A.MAIN_IDEA",
                label: "Ý chính",
                description: "Xác định nội dung trọng tâm hoặc chức năng của đoạn văn.",
            },
            {
                code: "R.A.PARAPHRASE",
                label: "Diễn đạt lại",
                description: "Kỹ năng nhận diện từ đồng nghĩa và cách diễn đạt tương đương.",
            },
            {
                code: "R.A.FORM",
                label: "Hình thức",
                description: "Lỗi về chính tả, định dạng hoặc giới hạn số từ.",
            },
            {
                code: "R.A.TIME_STRATEGY",
                label: "Quản lý thời gian",
                description: "Khả năng kiểm soát thời gian làm bài hiệu quả.",
            },
        ],
        cognitive: [
            {
                code: "R.C.RETRIEVAL",
                label: "Truy xuất",
                description: "Khả năng tìm tìm vị trí thông tin nhanh chóng.",
            },
            {
                code: "R.C.SEMANTIC_MAPPING",
                label: "Kết nối ngữ nghĩa",
                description: "Ánh xạ ý nghĩa giữa câu hỏi và nội dung bài đọc.",
            },
            {
                code: "R.C.INFERENCE",
                label: "Tư duy suy luận",
                description: "Rút ra kết luận từ các manh mối có sẵn.",
            },
            {
                code: "R.C.DISCOURSE_TRACKING",
                label: "Theo dõi mạch văn",
                description: "Theo dõi mối quan hệ giữa các thành phần trong văn bản.",
            },
            {
                code: "R.C.SCOPE_MONITORING",
                label: "Kiểm soát phạm vi",
                description: "Duy trì sự tập trung vào phạm vi thông tin cần thiết.",
            },
            {
                code: "R.C.EXEC_CONTROL",
                label: "Kiểm soát thực thi",
                description: "Loại bỏ các thông tin gây nhiễu.",
            },
        ],
    },
    listening: {
        assessment: [
            {
                code: "L.A.PHONO_LEXICAL",
                label: "Âm - Từ",
                description: "Khả năng nhận diện từ vựng qua âm thanh.",
            },
            {
                code: "L.A.CONNECTED_SPEECH",
                label: "Biến âm",
                description: "Hiểu các hiện tượng nối âm, nuốt âm trong tiếng Anh.",
            },
            {
                code: "L.A.DISTRACTOR",
                label: "Thông tin gây nhiễu",
                description: "Loại bỏ các thông tin đã bị bác bỏ hoặc thay đổi.",
            },
            {
                code: "L.A.FORM",
                label: "Hình thức",
                description: "Lỗi chính tả, viết hoa hoặc giới hạn từ.",
            },
            {
                code: "L.A.PREDICTIVE",
                label: "Nghe dự đoán",
                description: "Dự đoán thông tin sắp xuất hiện dựa trên ngữ cảnh.",
            },
            {
                code: "L.A.WORKING_MEMORY",
                label: "Trí nhớ ngắn hạn",
                description: "Khả năng ghi nhớ thông tin tạm thời để điền đáp án.",
            },
        ],
        cognitive: [
            {
                code: "L.C.ACOUSTIC",
                label: "Phân biệt âm thanh",
                description: "Phân biệt các âm thanh tương tự nhau.",
            },
            {
                code: "L.C.SEGMENTATION",
                label: "Phân đoạn lời nói",
                description: "Xác định ranh giới giữa các từ trong chuỗi âm thanh.",
            },
            {
                code: "L.C.PREDICTION",
                label: "Dự đoán",
                description: "Cập nhật các giả định khi nghe thông tin mới.",
            },
            {
                code: "L.C.ATTENTION",
                label: "Sự tập trung",
                description: "Phân bổ sự chú ý vào đúng thông tin cần nghe.",
            },
            {
                code: "L.C.WORKING_MEMORY",
                label: "Trí nhớ vận hành",
                description: "Duy trì trình tự thông tin trong đầu.",
            },
        ],
    },
    writing: {
        assessment: [
            {
                code: "W.A.TASK_RESPONSE",
                label: "Đáp ứng yêu cầu",
                description: "Mức độ hoàn thành các yêu cầu của đề bài.",
            },
            {
                code: "W.A.COHERENCE",
                label: "Mạch lạc và Liên kết",
                description: "Sự phát triển ý logic và kết nối giữa các câu đoạn.",
            },
            {
                code: "W.A.LEXICAL",
                label: "Vốn từ vựng",
                description: "Sự phong phú và chính xác trong cách dùng từ.",
            },
            {
                code: "W.A.GRAMMAR",
                label: "Ngữ pháp",
                description: "Sự đa dạng và độ chính xác của các cấu trúc ngữ pháp.",
            },
        ],
        cognitive: [
            {
                code: "W.C.IDEA_GENERATION",
                label: "Hình thành ý tưởng",
                description: "Khả năng tạo ra các ý tưởng phù hợp với đề bài.",
            },
            {
                code: "W.C.PLANNING",
                label: "Lập dàn ý",
                description: "Tổ chức và sắp xếp nội dung bài viết.",
            },
            {
                code: "W.C.LEXICAL_RETRIEVAL",
                label: "Truy xuất từ vựng",
                description: "Khả năng tìm đúng từ khi đang viết.",
            },
            {
                code: "W.C.SYNTAX_CONSTRUCTION",
                label: "Xây dựng cấu trúc",
                description: "Khả năng tạo lập các câu phức hợp.",
            },
            {
                code: "W.C.MONITORING_REVISION",
                label: "Kiểm soát và Chỉnh sửa",
                description: "Xem lại và sửa lỗi trong quá trình viết.",
            },
        ],
    },
    speaking: {
        assessment: [
            {
                code: "S.A.FLUENCY_COHERENCE",
                label: "Trôi chảy và Mạch lạc",
                description: "Độ lưu loát và khả năng phát triển ý tưởng.",
            },
            {
                code: "S.A.LEXICAL",
                label: "Vốn từ vựng",
                description: "Sự phong phú và chính xác trong từ vựng nói.",
            },
            {
                code: "S.A.GRAMMAR",
                label: "Ngữ pháp",
                description: "Sự đa dạng và độ chính xác của cấu trúc câu.",
            },
            {
                code: "S.A.PRONUNCIATION",
                label: "Phát âm",
                description: "Độ dễ hiểu và ngữ điệu khi nói.",
            },
        ],
        cognitive: [
            {
                code: "S.C.REALTIME_PLANNING",
                label: "Lập kế hoạch tức thì",
                description: "Khả năng vừa nói vừa lên ý tưởng cho câu tiếp theo.",
            },
            {
                code: "S.C.LEXICAL_ACCESS",
                label: "Tiếp cận từ vựng",
                description: "Tốc độ tìm và sử dụng từ vựng khi nói.",
            },
            {
                code: "S.C.GRAMMATICAL_ENCODING",
                label: "Mã hóa ngữ pháp",
                description: "Tạo lập cấu trúc câu trong lúc nói.",
            },
            {
                code: "S.C.PHONOLOGICAL_ENCODING",
                label: "Mã hóa âm thanh",
                description: "Tạo ra âm thanh và ngữ điệu đúng chuẩn.",
            },
            {
                code: "S.C.MONITORING",
                label: "Tự kiểm soát",
                description: "Khả năng tự phát hiện và sửa lỗi khi đang nói.",
            },
        ],
    },
};

const dim = { assessment: {}, cognitive: {} };
for (const s of Object.keys(coreDimensions)) {
    for (const a of coreDimensions[s].assessment) dim.assessment[a.code] = a;
    for (const c of coreDimensions[s].cognitive) dim.cognitive[c.code] = c;
}
const qp = {
    note_completion: "NC",
    summary_completion: "SC",
    table_completion: "TC",
    flowchart_completion: "FC",
    sentence_completion: "SEN",
    short_answer: "SA",
    tfng: "TFNG",
    ynng: "YNNG",
    matching_headings: "MH",
    matching_information: "MI",
    matching_features: "MF",
    multiple_choice: "MCQ",
    diagram_labeling: "DL",
    form_completion: "FORM",
    map_labeling: "MAP",
    task1_academic: "T1",
    task2_essay: "T2",
    speaking_part_1: "P1",
    speaking_part_2: "P2",
    speaking_part_3: "P3",
};
const C = (p, q, s) => `${p}.${qp[q] || q.toUpperCase()}.${s}`;
const S = (
    code,
    skill,
    questionType,
    a,
    c,
    errorCategory,
    errorSubtype,
    impactWeight,
) => ({
    code,
    skill,
    questionType,
    a,
    c,
    errorCategory,
    errorSubtype,
    impactWeight,
});
const seeds = [];
const add = (p, skill, q, arr) =>
    arr.forEach((x) =>
        seeds.push(S(C(p, q, x[0]), skill, q, x[3], x[4], x[2], x[1], x[5])),
    );
const rComp = [
    ["SPELL", "SPELLING", "FORM", "R.A.FORM", "R.C.RETRIEVAL", 0.25],
    ["PLUR", "PLURAL_S", "FORM", "R.A.FORM", "R.C.SEMANTIC_MAPPING", 0.4],
    ["WFORM", "WORD_FORM", "FORM", "R.A.FORM", "R.C.SEMANTIC_MAPPING", 0.45],
    ["NUM", "NUMBER_FORMAT", "FORM", "R.A.FORM", "R.C.RETRIEVAL", 0.5],
    ["PN", "PROPER_NOUN_FORMAT", "FORM", "R.A.FORM", "R.C.RETRIEVAL", 0.35],
    ["WLIM", "WORD_LIMIT", "FORM", "R.A.FORM", "R.C.EXEC_CONTROL", 0.55],
    ["OMIT", "INCOMPLETE_ANSWER", "FORM", "R.A.FORM", "R.C.EXEC_CONTROL", 0.5],
    [
        "KEY",
        "KEYWORD_SELECTION_ERROR",
        "LEXICAL",
        "R.A.PARAPHRASE",
        "R.C.SEMANTIC_MAPPING",
        0.6,
    ],
    [
        "SCOPE",
        "SENTENCE_SCOPE_ERROR",
        "DISCOURSE",
        "R.A.EXPLICIT",
        "R.C.SCOPE_MONITORING",
        0.62,
    ],
];
[
    "note_completion",
    "summary_completion",
    "table_completion",
    "flowchart_completion",
].forEach((q) => add("R", "reading", q, rComp));
const rTF = [
    [
        "NGF",
        "NOT_GIVEN_FALSE_CONFUSION",
        "INFERENCE",
        "R.A.INFERENCE",
        "R.C.SCOPE_MONITORING",
        0.78,
    ],
    [
        "NEG",
        "NEGATION_TRAP",
        "INFERENCE",
        "R.A.LOGIC",
        "R.C.DISCOURSE_TRACKING",
        0.75,
    ],
    [
        "PART",
        "PARTIAL_INFO_TRAP",
        "INFERENCE",
        "R.A.INFERENCE",
        "R.C.SCOPE_MONITORING",
        0.72,
    ],
    [
        "OVER",
        "OVER_INFERENCE",
        "INFERENCE",
        "R.A.INFERENCE",
        "R.C.INFERENCE",
        0.74,
    ],
    [
        "QNT",
        "QUANTIFIER_SCOPE",
        "INFERENCE",
        "R.A.LOGIC",
        "R.C.SCOPE_MONITORING",
        0.73,
    ],
    [
        "OPF",
        "OPINION_FACT_CONFUSION",
        "INFERENCE",
        "R.A.WRITER_VIEW",
        "R.C.DISCOURSE_TRACKING",
        0.8,
    ],
];
["tfng", "ynng"].forEach((q) => add("R", "reading", q, rTF));
add("R", "reading", "matching_headings", [
    [
        "MID",
        "MAIN_IDEA_DETAIL_TRAP",
        "DISCOURSE",
        "R.A.MAIN_IDEA",
        "R.C.DISCOURSE_TRACKING",
        0.72,
    ],
    [
        "PFN",
        "PARAGRAPH_FUNCTION_MISREAD",
        "DISCOURSE",
        "R.A.MAIN_IDEA",
        "R.C.DISCOURSE_TRACKING",
        0.7,
    ],
    [
        "SIG",
        "SIGNAL_BLINDNESS",
        "DISCOURSE",
        "R.A.LOGIC",
        "R.C.DISCOURSE_TRACKING",
        0.69,
    ],
    [
        "PARA",
        "PARAPHRASE_CONFUSION",
        "LEXICAL",
        "R.A.PARAPHRASE",
        "R.C.SEMANTIC_MAPPING",
        0.67,
    ],
    [
        "BND",
        "BOUNDARY_SCOPE_DRIFT",
        "DISCOURSE",
        "R.A.MAIN_IDEA",
        "R.C.SCOPE_MONITORING",
        0.71,
    ],
]);
add("R", "reading", "matching_information", [
    [
        "DLOC",
        "DETAIL_LOCATION_DRIFT",
        "DISCOURSE",
        "R.A.EXPLICIT",
        "R.C.SCOPE_MONITORING",
        0.63,
    ],
    [
        "PARA",
        "PARAPHRASE_CONFUSION",
        "LEXICAL",
        "R.A.PARAPHRASE",
        "R.C.SEMANTIC_MAPPING",
        0.66,
    ],
    [
        "CROSS",
        "CROSS_SENTENCE_LINK_FAIL",
        "DISCOURSE",
        "R.A.LOGIC",
        "R.C.DISCOURSE_TRACKING",
        0.68,
    ],
    [
        "REF",
        "REFERENCE_CHAIN_MISS",
        "DISCOURSE",
        "R.A.EXPLICIT",
        "R.C.DISCOURSE_TRACKING",
        0.65,
    ],
]);
add("R", "reading", "multiple_choice", [
    [
        "PARA",
        "MCQ_PARAPHRASE_MISS",
        "LEXICAL",
        "R.A.PARAPHRASE",
        "R.C.SEMANTIC_MAPPING",
        0.73,
    ],
    [
        "DIST",
        "MCQ_DISTRACTOR_TRAP",
        "STRATEGY",
        "R.A.LOGIC",
        "R.C.EXEC_CONTROL",
        0.78,
    ],
    [
        "SCOPE",
        "MCQ_SCOPE_MISMATCH",
        "INFERENCE",
        "R.A.LOGIC",
        "R.C.SCOPE_MONITORING",
        0.76,
    ],
    [
        "EXT",
        "MCQ_EXTREME_LANGUAGE",
        "INFERENCE",
        "R.A.INFERENCE",
        "R.C.EXEC_CONTROL",
        0.74,
    ],
    [
        "QUAL",
        "MCQ_QUALIFIER_TRAP",
        "INFERENCE",
        "R.A.INFERENCE",
        "R.C.SCOPE_MONITORING",
        0.73,
    ],
    [
        "NEGQ",
        "MCQ_NEGATIVE_STEM",
        "STRATEGY",
        "R.A.EXPLICIT",
        "R.C.EXEC_CONTROL",
        0.72,
    ],
    [
        "IEX",
        "MCQ_INFERENCE_EXPLICIT",
        "INFERENCE",
        "R.A.INFERENCE",
        "R.C.SCOPE_MONITORING",
        0.74,
    ],
    [
        "2ST",
        "MCQ_TWO_STEP_REASONING",
        "INFERENCE",
        "R.A.LOGIC",
        "R.C.INFERENCE",
        0.79,
    ],
    [
        "STEM",
        "MCQ_STEM_CONSTRAINT",
        "STRATEGY",
        "R.A.EXPLICIT",
        "R.C.EXEC_CONTROL",
        0.71,
    ],
    [
        "TIME",
        "MCQ_TIME_SEQUENCE",
        "INFERENCE",
        "R.A.LOGIC",
        "R.C.SCOPE_MONITORING",
        0.72,
    ],
]);
add("R", "reading", "matching_features", [
    [
        "ENT",
        "MATCH_ENTITY_ATTRIBUTE",
        "DISCOURSE",
        "R.A.EXPLICIT",
        "R.C.SCOPE_MONITORING",
        0.69,
    ],
    [
        "PRO",
        "MATCH_PRONOUN_REFERENCE",
        "DISCOURSE",
        "R.A.LOGIC",
        "R.C.DISCOURSE_TRACKING",
        0.67,
    ],
    [
        "TIME",
        "MATCH_TIMELINE",
        "INFERENCE",
        "R.A.LOGIC",
        "R.C.SCOPE_MONITORING",
        0.68,
    ],
    [
        "PART",
        "MATCH_PARTIAL",
        "LEXICAL",
        "R.A.PARAPHRASE",
        "R.C.SEMANTIC_MAPPING",
        0.66,
    ],
]);
add("R", "reading", "diagram_labeling", [
    [
        "TYPE",
        "DIAGRAM_LABEL_TYPE",
        "FORM",
        "R.A.FORM",
        "R.C.SEMANTIC_MAPPING",
        0.56,
    ],
    [
        "PART",
        "DIAGRAM_WRONG_PART",
        "DISCOURSE",
        "R.A.EXPLICIT",
        "R.C.SCOPE_MONITORING",
        0.63,
    ],
    [
        "SPAT",
        "DIAGRAM_SPATIAL_RELATION",
        "INFERENCE",
        "R.A.LOGIC",
        "R.C.DISCOURSE_TRACKING",
        0.62,
    ],
    [
        "FORM",
        "FORM_COMPLIANCE_ERROR",
        "FORM",
        "R.A.FORM",
        "R.C.EXEC_CONTROL",
        0.54,
    ],
]);

const lComp = [
    ["SPELL", "SPELLING", "FORM", "L.A.FORM", "L.C.ACOUSTIC", 0.28],
    [
        "HEAR",
        "LISTENING_NOT_HEARD",
        "ATTENTION",
        "L.A.PHONO_LEXICAL",
        "L.C.ATTENTION",
        0.7,
    ],
    [
        "NUM",
        "NUMBER_FORMAT",
        "FORM",
        "L.A.PHONO_LEXICAL",
        "L.C.WORKING_MEMORY",
        0.62,
    ],
    [
        "PN",
        "PROPER_NOUN_FORMAT",
        "FORM",
        "L.A.PHONO_LEXICAL",
        "L.C.ACOUSTIC",
        0.46,
    ],
    [
        "SIM",
        "LISTENING_SIMILAR_SOUND",
        "INFERENCE",
        "L.A.PHONO_LEXICAL",
        "L.C.ACOUSTIC",
        0.69,
    ],
    [
        "DIST",
        "LISTENING_DISTRACTOR_CORRECTION",
        "STRATEGY",
        "L.A.DISTRACTOR",
        "L.C.ATTENTION",
        0.74,
    ],
    [
        "SEG",
        "LISTENING_CONNECTED_SPEECH",
        "LEXICAL",
        "L.A.CONNECTED_SPEECH",
        "L.C.SEGMENTATION",
        0.66,
    ],
    [
        "LATE",
        "LISTENING_LATE_TRANSFER",
        "MEMORY",
        "L.A.WORKING_MEMORY",
        "L.C.WORKING_MEMORY",
        0.64,
    ],
];
[
    "note_completion",
    "form_completion",
    "table_completion",
    "sentence_completion",
].forEach((q) => add("L", "listening", q, lComp));
add("L", "listening", "multiple_choice", [
    [
        "DIST",
        "LISTENING_DISTRACTOR_CORRECTION",
        "STRATEGY",
        "L.A.DISTRACTOR",
        "L.C.ATTENTION",
        0.8,
    ],
    [
        "STEM",
        "LISTENING_STEM_MISUNDERSTANDING",
        "STRATEGY",
        "L.A.PREDICTIVE",
        "L.C.PREDICTION",
        0.72,
    ],
    [
        "NUM",
        "LISTENING_NUMBER_QUANTITY",
        "INFERENCE",
        "L.A.PHONO_LEXICAL",
        "L.C.ACOUSTIC",
        0.7,
    ],
    [
        "SYN",
        "LISTENING_SYNONYM_MISS",
        "LEXICAL",
        "L.A.PHONO_LEXICAL",
        "L.C.SEGMENTATION",
        0.71,
    ],
    [
        "NEGQ",
        "MCQ_NEGATIVE_STEM",
        "STRATEGY",
        "L.A.PREDICTIVE",
        "L.C.ATTENTION",
        0.73,
    ],
    [
        "LAST",
        "LISTENING_LAST_PHRASE_BIAS",
        "MEMORY",
        "L.A.WORKING_MEMORY",
        "L.C.WORKING_MEMORY",
        0.69,
    ],
]);
add("L", "listening", "map_labeling", [
    [
        "ORI",
        "ORIENTATION_ERROR",
        "INFERENCE",
        "L.A.PHONO_LEXICAL",
        "L.C.ATTENTION",
        0.75,
    ],
    [
        "ROUTE",
        "ROUTE_STEP_ERROR",
        "INFERENCE",
        "L.A.CONNECTED_SPEECH",
        "L.C.WORKING_MEMORY",
        0.77,
    ],
    [
        "LAND",
        "LANDMARK_CONFUSION",
        "LEXICAL",
        "L.A.PHONO_LEXICAL",
        "L.C.ACOUSTIC",
        0.7,
    ],
    [
        "SEQ",
        "SEQUENCE_INSTRUCTION_FAILURE",
        "MEMORY",
        "L.A.WORKING_MEMORY",
        "L.C.WORKING_MEMORY",
        0.74,
    ],
    [
        "PLAN",
        "MAP_PLAN_CHANGE_DISTRACTOR",
        "STRATEGY",
        "L.A.DISTRACTOR",
        "L.C.ATTENTION",
        0.76,
    ],
    [
        "VIEW",
        "VIEWPOINT_SHIFT",
        "INFERENCE",
        "L.A.CONNECTED_SPEECH",
        "L.C.PREDICTION",
        0.73,
    ],
    [
        "PREP",
        "PREPOSITION_MISINTERPRETATION",
        "INFERENCE",
        "L.A.CONNECTED_SPEECH",
        "L.C.SEGMENTATION",
        0.72,
    ],
]);

add("W", "writing", "task1_academic", [
    [
        "OVR",
        "WRITING_MISSING_OVERVIEW",
        "TASK",
        "W.A.TASK_RESPONSE",
        "W.C.PLANNING",
        0.85,
    ],
    [
        "KEY",
        "WRITING_KEY_FEATURE_SELECTION",
        "TASK",
        "W.A.TASK_RESPONSE",
        "W.C.IDEA_GENERATION",
        0.8,
    ],
    [
        "COMP",
        "WRITING_INACCURATE_COMPARISON",
        "TASK",
        "W.A.TASK_RESPONSE",
        "W.C.MONITORING_REVISION",
        0.78,
    ],
    [
        "DATA",
        "WRITING_DATA_MISREPORT",
        "TASK",
        "W.A.TASK_RESPONSE",
        "W.C.MONITORING_REVISION",
        0.82,
    ],
    [
        "TRND",
        "WRITING_TREND_DIRECTION",
        "TASK",
        "W.A.TASK_RESPONSE",
        "W.C.MONITORING_REVISION",
        0.76,
    ],
    [
        "GRP",
        "WRITING_GROUPING_FAILURE",
        "COHESION",
        "W.A.COHERENCE",
        "W.C.PLANNING",
        0.74,
    ],
]);
add("W", "writing", "task2_essay", [
    [
        "DEV",
        "WRITING_INSUFFICIENT_DEVELOPMENT",
        "TASK",
        "W.A.TASK_RESPONSE",
        "W.C.IDEA_GENERATION",
        0.86,
    ],
    [
        "POS",
        "WRITING_POSITION_UNCLEAR",
        "TASK",
        "W.A.TASK_RESPONSE",
        "W.C.PLANNING",
        0.83,
    ],
    [
        "PROM",
        "WRITING_PARTIAL_PROMPT",
        "TASK",
        "W.A.TASK_RESPONSE",
        "W.C.PLANNING",
        0.84,
    ],
    [
        "EX",
        "WRITING_IRRELEVANT_EXAMPLE",
        "TASK",
        "W.A.TASK_RESPONSE",
        "W.C.IDEA_GENERATION",
        0.75,
    ],
    [
        "CNT",
        "WRITING_COUNTERARGUMENT_MISSING",
        "TASK",
        "W.A.COHERENCE",
        "W.C.PLANNING",
        0.72,
    ],
    [
        "PROG",
        "WRITING_PROGRESSION_GAP",
        "COHESION",
        "W.A.COHERENCE",
        "W.C.PLANNING",
        0.77,
    ],
]);
[
    [
        "PARA",
        "WRITING_PARAGRAPHING_WEAK",
        "COHESION",
        "W.A.COHERENCE",
        "W.C.PLANNING",
        0.71,
    ],
    [
        "TOPIC",
        "WRITING_TOPIC_SENTENCE_MISSING",
        "COHESION",
        "W.A.COHERENCE",
        "W.C.IDEA_GENERATION",
        0.68,
    ],
    [
        "REF",
        "WRITING_REFERENCE_AMBIGUOUS",
        "COHESION",
        "W.A.COHERENCE",
        "W.C.MONITORING_REVISION",
        0.66,
    ],
    [
        "LINKO",
        "WRITING_LINKER_OVERUSE",
        "COHESION",
        "W.A.COHERENCE",
        "W.C.MONITORING_REVISION",
        0.64,
    ],
    [
        "LINKM",
        "WRITING_MECHANICAL_LINKING",
        "COHESION",
        "W.A.COHERENCE",
        "W.C.MONITORING_REVISION",
        0.63,
    ],
    [
        "LEN",
        "WRITING_LENGTH_UNDER",
        "STRATEGY",
        "W.A.TASK_RESPONSE",
        "W.C.PLANNING",
        0.7,
    ],
].forEach((p) =>
    seeds.push(
        S(`W.CC.${p[0]}`, "writing", "task2_essay", p[3], p[4], p[2], p[1], p[5]),
    ),
);
[
    [
        "COL",
        "WRITING_COLLOCATION_ERROR",
        "LEXICAL",
        "W.A.LEXICAL",
        "W.C.LEXICAL_RETRIEVAL",
        0.69,
    ],
    [
        "REG",
        "WRITING_REGISTER_MISMATCH",
        "LEXICAL",
        "W.A.LEXICAL",
        "W.C.MONITORING_REVISION",
        0.64,
    ],
    [
        "REP",
        "WRITING_LEXICAL_REPETITION",
        "LEXICAL",
        "W.A.LEXICAL",
        "W.C.LEXICAL_RETRIEVAL",
        0.61,
    ],
    [
        "WCH",
        "WRITING_WORD_CHOICE",
        "LEXICAL",
        "W.A.LEXICAL",
        "W.C.LEXICAL_RETRIEVAL",
        0.72,
    ],
    [
        "WF",
        "WRITING_LEXICAL_WORD_FORM",
        "LEXICAL",
        "W.A.LEXICAL",
        "W.C.SYNTAX_CONSTRUCTION",
        0.65,
    ],
    [
        "SPL",
        "WRITING_SPELLING_FREQUENT",
        "FORM",
        "W.A.LEXICAL",
        "W.C.MONITORING_REVISION",
        0.57,
    ],
].forEach((p) =>
    seeds.push(
        S(`W.LR.${p[0]}`, "writing", "task2_essay", p[3], p[4], p[2], p[1], p[5]),
    ),
);
[
    [
        "RNG",
        "WRITING_GR_RANGE_LIMITED",
        "GRAMMAR",
        "W.A.GRAMMAR",
        "W.C.SYNTAX_CONSTRUCTION",
        0.79,
    ],
    [
        "CMPX",
        "WRITING_GR_COMPLEX_ERROR",
        "GRAMMAR",
        "W.A.GRAMMAR",
        "W.C.SYNTAX_CONSTRUCTION",
        0.76,
    ],
    [
        "SVA",
        "WRITING_GR_SVA",
        "GRAMMAR",
        "W.A.GRAMMAR",
        "W.C.MONITORING_REVISION",
        0.63,
    ],
    [
        "TENSE",
        "WRITING_GR_TENSE",
        "GRAMMAR",
        "W.A.GRAMMAR",
        "W.C.MONITORING_REVISION",
        0.66,
    ],
    [
        "AP",
        "WRITING_GR_ARTICLE_PREP",
        "GRAMMAR",
        "W.A.GRAMMAR",
        "W.C.MONITORING_REVISION",
        0.62,
    ],
    [
        "CL",
        "WRITING_GR_CLAUSE_BOUNDARY",
        "GRAMMAR",
        "W.A.GRAMMAR",
        "W.C.SYNTAX_CONSTRUCTION",
        0.65,
    ],
].forEach((p) =>
    seeds.push(
        S(`W.GRA.${p[0]}`, "writing", "task2_essay", p[3], p[4], p[2], p[1], p[5]),
    ),
);

[
    [
        "FL",
        "SPEAKING_FLUENCY_BREAKDOWN",
        "FLUENCY",
        "S.A.FLUENCY_COHERENCE",
        "S.C.REALTIME_PLANNING",
        0.8,
    ],
    [
        "FIL",
        "SPEAKING_FILLER_OVERUSE",
        "FLUENCY",
        "S.A.FLUENCY_COHERENCE",
        "S.C.MONITORING",
        0.65,
    ],
    [
        "REP",
        "SPEAKING_REPETITION_RESTART",
        "FLUENCY",
        "S.A.FLUENCY_COHERENCE",
        "S.C.REALTIME_PLANNING",
        0.67,
    ],
    [
        "SC",
        "SPEAKING_SELF_CORRECTION_CHAIN",
        "FLUENCY",
        "S.A.FLUENCY_COHERENCE",
        "S.C.MONITORING",
        0.68,
    ],
    [
        "EXT",
        "SPEAKING_IDEA_EXTENSION_WEAK",
        "COHERENCE",
        "S.A.FLUENCY_COHERENCE",
        "S.C.REALTIME_PLANNING",
        0.74,
    ],
    [
        "TOP",
        "SPEAKING_TOPIC_DEVELOPMENT",
        "COHERENCE",
        "S.A.FLUENCY_COHERENCE",
        "S.C.REALTIME_PLANNING",
        0.73,
    ],
    [
        "LOG",
        "SPEAKING_LOGICAL_PROGRESS",
        "COHERENCE",
        "S.A.FLUENCY_COHERENCE",
        "S.C.REALTIME_PLANNING",
        0.72,
    ],
    [
        "DM",
        "SPEAKING_DISCOURSE_MARKER_MECH",
        "COHERENCE",
        "S.A.FLUENCY_COHERENCE",
        "S.C.MONITORING",
        0.63,
    ],
].forEach((p) =>
    seeds.push(
        S(
            `S.FC.${p[0]}`,
            "speaking",
            "speaking_part_3",
            p[3],
            p[4],
            p[2],
            p[1],
            p[5],
        ),
    ),
);
[
    [
        "RNG",
        "SPEAKING_LEX_RANGE_LIMITED",
        "LEXICAL",
        "S.A.LEXICAL",
        "S.C.LEXICAL_ACCESS",
        0.77,
    ],
    [
        "WCH",
        "SPEAKING_LEX_WORD_CHOICE",
        "LEXICAL",
        "S.A.LEXICAL",
        "S.C.LEXICAL_ACCESS",
        0.75,
    ],
    [
        "COL",
        "SPEAKING_LEX_COLLOCATION",
        "LEXICAL",
        "S.A.LEXICAL",
        "S.C.LEXICAL_ACCESS",
        0.7,
    ],
    [
        "CIRC",
        "SPEAKING_CIRCUMLOCUTION",
        "LEXICAL",
        "S.A.LEXICAL",
        "S.C.LEXICAL_ACCESS",
        0.66,
    ],
    [
        "RPT",
        "SPEAKING_LEX_REPETITION",
        "LEXICAL",
        "S.A.LEXICAL",
        "S.C.LEXICAL_ACCESS",
        0.62,
    ],
    [
        "REG",
        "SPEAKING_REGISTER_SHIFT",
        "LEXICAL",
        "S.A.LEXICAL",
        "S.C.MONITORING",
        0.58,
    ],
].forEach((p) =>
    seeds.push(
        S(
            `S.LR.${p[0]}`,
            "speaking",
            "speaking_part_2",
            p[3],
            p[4],
            p[2],
            p[1],
            p[5],
        ),
    ),
);
[
    [
        "SIM",
        "SPEAKING_GR_SIMPLE_OVERUSE",
        "GRAMMAR",
        "S.A.GRAMMAR",
        "S.C.GRAMMATICAL_ENCODING",
        0.76,
    ],
    [
        "LINK",
        "SPEAKING_GR_CLAUSE_LINKING",
        "GRAMMAR",
        "S.A.GRAMMAR",
        "S.C.GRAMMATICAL_ENCODING",
        0.69,
    ],
    [
        "TEN",
        "SPEAKING_GR_TENSE",
        "GRAMMAR",
        "S.A.GRAMMAR",
        "S.C.GRAMMATICAL_ENCODING",
        0.65,
    ],
    ["SVA", "SPEAKING_GR_SVA", "GRAMMAR", "S.A.GRAMMAR", "S.C.MONITORING", 0.61],
    [
        "AP",
        "SPEAKING_GR_ART_PREP",
        "GRAMMAR",
        "S.A.GRAMMAR",
        "S.C.MONITORING",
        0.6,
    ],
    [
        "CMPX",
        "SPEAKING_GR_COMPLEX_ATTEMPT",
        "GRAMMAR",
        "S.A.GRAMMAR",
        "S.C.GRAMMATICAL_ENCODING",
        0.72,
    ],
].forEach((p) =>
    seeds.push(
        S(
            `S.GRA.${p[0]}`,
            "speaking",
            "speaking_part_2",
            p[3],
            p[4],
            p[2],
            p[1],
            p[5],
        ),
    ),
);
[
    [
        "INTEL",
        "SPEAKING_PRON_INTELLIGIBILITY",
        "PRONUNCIATION",
        "S.A.PRONUNCIATION",
        "S.C.PHONOLOGICAL_ENCODING",
        0.84,
    ],
    [
        "WST",
        "SPEAKING_PRON_WORD_STRESS",
        "PRONUNCIATION",
        "S.A.PRONUNCIATION",
        "S.C.PHONOLOGICAL_ENCODING",
        0.71,
    ],
    [
        "SST",
        "SPEAKING_PRON_SENTENCE_STRESS",
        "PRONUNCIATION",
        "S.A.PRONUNCIATION",
        "S.C.PHONOLOGICAL_ENCODING",
        0.69,
    ],
    [
        "RHY",
        "SPEAKING_PRON_RHYTHM",
        "PRONUNCIATION",
        "S.A.PRONUNCIATION",
        "S.C.PHONOLOGICAL_ENCODING",
        0.7,
    ],
    [
        "CS",
        "SPEAKING_PRON_CONNECTED_SPEECH",
        "PRONUNCIATION",
        "S.A.PRONUNCIATION",
        "S.C.PHONOLOGICAL_ENCODING",
        0.68,
    ],
    [
        "INTN",
        "SPEAKING_PRON_INTONATION",
        "PRONUNCIATION",
        "S.A.PRONUNCIATION",
        "S.C.PHONOLOGICAL_ENCODING",
        0.67,
    ],
    [
        "FINAL",
        "SPEAKING_PRON_FINAL_SOUND",
        "PRONUNCIATION",
        "S.A.PRONUNCIATION",
        "S.C.PHONOLOGICAL_ENCODING",
        0.66,
    ],
    [
        "VC",
        "SPEAKING_PRON_VOWEL_CONSONANT",
        "PRONUNCIATION",
        "S.A.PRONUNCIATION",
        "S.C.PHONOLOGICAL_ENCODING",
        0.7,
    ],
    [
        "CHUNK",
        "SPEAKING_PRON_PAUSING_CHUNKING",
        "PRONUNCIATION",
        "S.A.PRONUNCIATION",
        "S.C.REALTIME_PLANNING",
        0.68,
    ],
].forEach((p) =>
    seeds.push(
        S(
            `S.PRON.${p[0]}`,
            "speaking",
            "speaking_part_2",
            p[3],
            p[4],
            p[2],
            p[1],
            p[5],
        ),
    ),
);

const rem = {
    FORM: [
        {
            audience: "teacher",
            action: "Kiểm tra danh sách hình thức trước khi chấm điểm.",
            tags: ["form", "accuracy"],
        },
        {
            audience: "student",
            action: "Sử dụng danh sách kiểm tra khi điền đáp án cuối cùng.",
            tags: ["self-check", "exam-strategy"],
        },
    ],
    LEXICAL: [
        {
            audience: "teacher",
            action: "Dạy cách diễn đạt tương đương (paraphrase) và kết hợp từ (collocation) theo từng loại câu hỏi.",
            tags: ["lexical-resource", "paraphrase"],
        },
        {
            audience: "student",
            action: "Luyện tập nối các cách diễn đạt tương đương trong thời gian giới hạn.",
            tags: ["vocabulary", "precision"],
        },
    ],
    INFERENCE: [
        {
            audience: "teacher",
            action: "Làm mẫu logic: Ủng hộ / Mâu thuẫn / Không có.",
            tags: ["inference", "logic"],
        },
        {
            audience: "student",
            action: "Đánh dấu các từ phủ định, từ định lượng và phạm vi thông tin.",
            tags: ["scope", "decision"],
        },
    ],
    DISCOURSE: [
        {
            audience: "teacher",
            action: "Dạy về chức năng đoạn văn và cách theo dõi các tín hiệu liên kết.",
            tags: ["discourse", "structure"],
        },
        {
            audience: "student",
            action: "Theo dõi chuỗi quy chiếu và các từ nối.",
            tags: ["tracking", "cohesion"],
        },
    ],
    STRATEGY: [
        {
            audience: "teacher",
            action: "Ưu tiên kiểm tra và loại trừ đáp án dựa trên câu hỏi (stem) trước.",
            tags: ["strategy", "timing"],
        },
        {
            audience: "student",
            action: "Sử dụng quy trình loại trừ 2 bước và kiểm tra cuối cùng.",
            tags: ["mcq", "decision"],
        },
    ],
    TASK: [
        {
            audience: "teacher",
            action: "Cung cấp phản hồi dựa trên tiêu chí chấm điểm.",
            tags: ["task-response", "band"],
        },
        {
            audience: "student",
            action: "Lên kế hoạch bao phủ tất cả các phần của đề bài trước khi viết nháp.",
            tags: ["planning", "writing"],
        },
    ],
    COHESION: [
        {
            audience: "teacher",
            action: "Hướng dẫn về sự phát triển ý và logic của đoạn văn.",
            tags: ["coherence", "organization"],
        },
        {
            audience: "student",
            action: "Sử dụng cấu trúc: Câu chủ đề + Ý phụ trợ + Câu nối.",
            tags: ["paragraphing", "flow"],
        },
    ],
    GRAMMAR: [
        {
            audience: "teacher",
            action: "Tập trung vào một cấu trúc ngữ pháp mỗi chu kỳ luyện tập.",
            tags: ["grammar", "control"],
        },
        {
            audience: "student",
            action: "Kiểm tra kỹ về thì, sự hòa hợp chủ vị, mạo từ và giới từ.",
            tags: ["editing", "accuracy"],
        },
    ],
    FLUENCY: [
        {
            audience: "teacher",
            action: "Luyện nói theo thời gian với việc lên kế hoạch theo cụm ý.",
            tags: ["fluency", "speaking"],
        },
        {
            audience: "student",
            action: "Giảm tần suất ngập ngừng và từ thừa (filler) thông qua việc nghe lại bản ghi âm.",
            tags: ["self-monitoring", "timed"],
        },
    ],
    PRONUNCIATION: [
        {
            audience: "teacher",
            action: "Ưu tiên độ dễ hiểu, sau đó là ngữ điệu.",
            tags: ["pronunciation", "prosody"],
        },
        {
            audience: "student",
            action: "Luyện tập theo phương pháp Shadowing (nhại lại) trọng âm và các cụm từ nối âm.",
            tags: ["shadowing", "speech"],
        },
    ],
    ATTENTION: [
        {
            audience: "teacher",
            action: "Huấn luyện khả năng lấy lại bình tĩnh và tập trung sau khi lỡ mất thông tin.",
            tags: ["attention", "listening"],
        },
        {
            audience: "student",
            action: "Nhanh chóng bám vào tín hiệu tiếp theo nếu lỡ mất một đoạn.",
            tags: ["focus", "recovery"],
        },
    ],
    MEMORY: [
        {
            audience: "teacher",
            action: "Luyện cách ghi chú ngắn gọn và điền đáp án ngay lập tức.",
            tags: ["memory", "transfer"],
        },
        {
            audience: "student",
            action: "Sử dụng quy trình: Nghe - Ghi chú - Xác nhận.",
            tags: ["working-memory", "drill"],
        },
    ],
    COHERENCE: [
        {
            audience: "teacher",
            action: "Sử dụng cấu trúc: Quan điểm - Lý do - Ví dụ - Kết quả trong khi nói.",
            tags: ["coherence", "speaking"],
        },
        {
            audience: "student",
            action: "Mở rộng mỗi câu trả lời bằng cách đưa ra lý do và ví dụ.",
            tags: ["part3", "idea-development"],
        },
    ],
};

const off = new Set([
    "NOT_GIVEN_FALSE_CONFUSION",
    "NEGATION_TRAP",
    "PARTIAL_INFO_TRAP",
    "OVER_INFERENCE",
    "QUANTIFIER_SCOPE",
    "OPINION_FACT_CONFUSION",
    "MCQ_DISTRACTOR_TRAP",
    "MCQ_SCOPE_MISMATCH",
    "MCQ_NEGATIVE_STEM",
    "MCQ_TWO_STEP_REASONING",
    "ORIENTATION_ERROR",
    "ROUTE_STEP_ERROR",
    "LANDMARK_CONFUSION",
    "SEQUENCE_INSTRUCTION_FAILURE",
    "VIEWPOINT_SHIFT",
    "PREPOSITION_MISINTERPRETATION",
    "WRITING_MISSING_OVERVIEW",
    "WRITING_INSUFFICIENT_DEVELOPMENT",
    "WRITING_PARTIAL_PROMPT",
    "SPEAKING_PRON_INTELLIGIBILITY",
]);
const formNC = new Set([
    "SPELLING",
    "PLURAL_S",
    "WORD_FORM",
    "PROPER_NOUN_FORMAT",
]);
const numNC = new Set(["NUMBER_FORMAT"]);

const hBase = {
    reading: [
        {
            id: "answer_mismatch",
            rule: "normalizeAnswer(userAnswer)!==normalizeAnswer(correctAnswer)",
            fields: ["userAnswer", "correctAnswer"],
            description: "Kiểm tra sự sai khác cơ bản.",
        },
        {
            id: "scope_check",
            rule: "use highlightText/highlightRange for scope alignment",
            fields: ["highlightText", "highlightRange", "questionType", "userAnswer"],
            description: "Kiểm tra phạm vi và vị trí từ khóa.",
        },
    ],
    listening: [
        {
            id: "answer_mismatch",
            rule: "normalizeAnswer(userAnswer)!==normalizeAnswer(correctAnswer)",
            fields: ["userAnswer", "correctAnswer"],
            description: "Kiểm tra sự sai khác cơ bản.",
        },
        {
            id: "audio_alignment",
            rule: "align answer with audioTranscript and word timestamps",
            fields: ["audioTranscript", "wordTimestamps", "userAnswer", "metadata"],
            description: "Kiểm tra lỗi do không nghe được hoặc lỗi khi điền đáp án.",
        },
    ],
    writing: [
        {
            id: "task_coverage",
            rule: "check overview/coverage/development from userAnswer and metadata",
            fields: ["userAnswer", "metadata"],
            description: "Chẩn đoán mức độ đáp ứng yêu cầu đề bài.",
        },
        {
            id: "language_control",
            rule: "check coherence, lexical precision, grammar patterns",
            fields: ["userAnswer", "metadata"],
            description: "Chẩn đoán khả năng kiểm soát ngôn ngữ.",
        },
    ],
    speaking: [
        {
            id: "fluency_profile",
            rule: "detect pauses/fillers/self-repairs from transcript timestamps",
            fields: ["audioTranscript", "wordTimestamps", "metadata"],
            description: "Hồ sơ về độ trôi chảy và mạch lạc.",
        },
        {
            id: "pron_lex_gram_profile",
            rule: "detect pronunciation, lexical, grammar markers",
            fields: ["audioTranscript", "wordTimestamps", "metadata"],
            description: "Hồ sơ về sự đa dạng so với độ chính xác.",
        },
    ],
};
const exBySubtype = {
    SPELLING: [
        {
            correct: "accommodation",
            student: "acommodation",
            whyWrong: "Lỗi chính tả khiến đáp án không khớp với từ trong bài.",
            whatToTeach: "Luyện tập thói quen kiểm tra chính tả các từ phổ biến.",
        },
        {
            correct: "environment",
            student: "enviroment",
            whyWrong: "Thiếu chữ cái gây ra lỗi hình thức.",
            whatToTeach: "Sử dụng các bài tập đánh vần theo cụm.",
        },
    ],
    NUMBER_FORMAT: [
        {
            correct: "15",
            student: "50",
            whyWrong: "Đảo ngược chữ số làm thay đổi giá trị.",
            whatToTeach: "Xác nhận lại các con số trước khi ghi vào tờ đáp án.",
        },
        {
            correct: "25",
            student: "twenty-five",
            whyWrong: "Không tuân thủ định dạng số theo yêu cầu.",
            whatToTeach: "Luyện tập các quy tắc định dạng số cho từng loại bài.",
        },
    ],
    NOT_GIVEN_FALSE_CONFUSION: [
        {
            correct: "NOT GIVEN",
            student: "FALSE",
            whyWrong: "Không có sự mâu thuẫn; thông tin không xuất hiện trong bài.",
            whatToTeach: "Sử dụng quy trình kiểm tra: Ủng hộ / Mâu thuẫn / Không có.",
        },
        {
            correct: "NOT GIVEN",
            student: "NO",
            whyWrong: "Nhận định không được nêu rõ ràng trong bài.",
            whatToTeach: "Phân biệt giữa việc thông tin không có và thông tin bị mâu thuẫn.",
        },
    ],
    ORIENTATION_ERROR: [
        {
            correct: "B",
            student: "D",
            whyWrong: "Áp dụng sai phương hướng hoặc góc nhìn bản đồ.",
            whatToTeach: "Kiểm tra chế độ định hướng bản đồ trước khi theo dõi lộ trình.",
        },
        {
            correct: "north of the cafe",
            student: "south of the cafe",
            whyWrong: "Trục hướng bị đảo ngược.",
            whatToTeach: "Luyện tập cách ánh xạ la bàn lên bản đồ.",
        },
    ],
};

const clone = (x) => JSON.parse(JSON.stringify(x));
const D = (t, code) => {
    const x = dim[t][code];
    if (!x) throw new Error(`Missing ${t} code ${code}`);
    return { code: x.code, label: x.label, description: x.description };
};
const nearRule = (s) =>
    off.has(s.errorSubtype)
        ? {
            enabled: false,
            thresholds: {},
            rationale: "Sai lệch về cấu trúc cốt lõi; không được tính là gần đúng.",
        }
        : formNC.has(s.errorSubtype)
            ? {
                enabled: true,
                mode: "any",
                thresholds: {
                    editDistanceMax: 2,
                    lemmaMatch: true,
                    semanticSimilarityMin: 0.78,
                },
                rationale: "Có khả năng là lỗi hình thức bề mặt.",
            }
            : numNC.has(s.errorSubtype)
                ? {
                    enabled: true,
                    mode: "any",
                    thresholds: { numericValueMatch: true, editDistanceMax: 2 },
                    rationale: "Ý định về số đúng nhưng định dạng hoặc giá trị bị lệch.",
                }
                : {
                    enabled: true,
                    mode: "any",
                    thresholds: {
                        semanticSimilarityMin: 0.8,
                        tokenOverlapMin: 0.5,
                        editDistanceMax: 3,
                    },
                    rationale: "Lỗi suýt đúng về mặt ngữ nghĩa hoặc từ vựng.",
                };

const heur = (s) => {
    const h = [...hBase[s.skill]];
    if (s.errorSubtype === "WORD_LIMIT")
        h.push({
            id: "word_limit",
            rule: "tokenCount(userAnswer)>metadata.wordLimit",
            fields: ["userAnswer", "metadata.wordLimit"],
            description: "Vi phạm giới hạn số từ.",
        });
    if (s.errorSubtype === "NOT_GIVEN_FALSE_CONFUSION")
        h.push({
            id: "absence_vs_contradiction",
            rule: "FALSE/NO chosen without explicit contradiction evidence",
            fields: ["userAnswer", "correctAnswer", "highlightText"],
            description: "Nhầm lẫn giữa NOT GIVEN và FALSE/NO.",
        });
    if (s.errorSubtype === "NEGATION_TRAP")
        h.push({
            id: "polarity_flip",
            rule: "negation/antonym markers conflict with selected polarity",
            fields: ["highlightText", "userAnswer", "correctAnswer"],
            description: "Phát hiện bẫy thông tin trái ngược.",
        });
    if (s.questionType === "map_labeling")
        h.push({
            id: "map_metadata_check",
            rule: "use metadata.mapOrientationMode, metadata.labelType, metadata.expectedPrepositions",
            fields: [
                "metadata.mapOrientationMode",
                "metadata.labelType",
                "metadata.expectedPrepositions",
            ],
            description: "Kiểm tra dữ liệu nhãn bản đồ.",
        });
    if (s.errorSubtype === "ORIENTATION_ERROR")
        h.push({
            id: "orientation_mode_conflict",
            rule: "direction choice conflicts with orientation mode",
            fields: ["metadata.mapOrientationMode", "userAnswer", "correctAnswer"],
            description: "Sai lệch về phương hướng.",
        });
    if (s.errorSubtype === "ROUTE_STEP_ERROR")
        h.push({
            id: "route_sequence",
            rule: "first/then/after route steps mismatch transcript",
            fields: [
                "audioTranscript",
                "wordTimestamps",
                "userAnswer",
                "correctAnswer",
            ],
            description: "Lỗi về thứ tự các bước trong lộ trình.",
        });
    if (s.errorSubtype === "LANDMARK_CONFUSION")
        h.push({
            id: "landmark_similarity",
            rule: "similar sounding landmark selected over target",
            fields: [
                "audioTranscript",
                "metadata.labelType",
                "userAnswer",
                "correctAnswer",
            ],
            description: "Lỗi phân biệt các mốc địa điểm.",
        });
    if (s.errorSubtype === "VIEWPOINT_SHIFT")
        h.push({
            id: "viewpoint_update",
            rule: "left/right mapping not updated after perspective switch",
            fields: [
                "audioTranscript",
                "wordTimestamps",
                "metadata.mapOrientationMode",
            ],
            description: "Lỗi thay đổi điểm nhìn/góc nhìn.",
        });
    if (s.errorSubtype === "PREPOSITION_MISINTERPRETATION")
        h.push({
            id: "preposition_relation",
            rule: "opposite/next to/across mapping is inconsistent with target",
            fields: [
                "metadata.expectedPrepositions",
                "audioTranscript",
                "userAnswer",
            ],
            description: "Lỗi sử dụng giới từ chỉ vị trí.",
        });
    return h;
};

const examples = (s) => {
    if (exBySubtype[s.errorSubtype]) return clone(exBySubtype[s.errorSubtype]);
    if (s.questionType === "multiple_choice")
        return [
            {
                correct: "Đáp án C",
                student: "Đáp án A",
                whyWrong: "Chi tiết khớp với bài đọc nhưng không đáp ứng đúng trọng tâm câu hỏi.",
                whatToTeach: "Kiểm tra lại từng lựa chọn đối với các giới hạn của câu hỏi.",
            },
            {
                correct: "Đáp án B",
                student: "Đáp án D",
                whyWrong: "Từ khóa gây nhiễu khớp nhưng ý nghĩa toàn bộ câu thì không.",
                whatToTeach: "Sử dụng phương pháp loại trừ dựa trên sự phù hợp về ý nghĩa của toàn bộ mệnh đề.",
            },
        ];
    if (s.questionType === "tfng" || s.questionType === "ynng")
        return [
            {
                correct: "NOT GIVEN",
                student: "FALSE",
                whyWrong: "Việc thông tin không có trong bài bị coi nhầm là mâu thuẫn.",
                whatToTeach: "Áp dụng mô hình: Ủng hộ / Mâu thuẫn / Không có.",
            },
            {
                correct: "TRUE",
                student: "FALSE",
                whyWrong: "Bỏ lỡ từ phủ định hoặc phạm vi của từ định lượng.",
                whatToTeach: "Đánh dấu các từ chỉ tính phân cực (khẳng định/phủ định) và phạm vi trước.",
            },
        ];
    if (s.skill === "writing")
        return [
            {
                correct: "Đề bài được bao phủ đầy đủ với các ý hỗ trợ được phát triển tốt.",
                student: "Một phần của đề bài bị bỏ sót hoặc chưa được phát triển kỹ.",
                whyWrong: "Phần đáp ứng yêu cầu đề bài mới chỉ hoàn thành một phần.",
                whatToTeach: "Sử dụng danh sách kiểm tra các phần của đề bài khi lập kế hoạch.",
            },
            {
                correct: "Sự phát triển ý logic với ngôn ngữ chính xác.",
                student: "Sử dụng từ nối một cách máy móc và khả năng kiểm soát ngôn ngữ chưa chính xác.",
                whyWrong: "Sự mạch lạc và khả năng kiểm soát ngôn ngữ làm hạn chế mức điểm.",
                whatToTeach: "Tập trung vào một điểm chỉnh sửa quan trọng cho mỗi lần viết nháp.",
            },
        ];
    if (s.skill === "speaking")
        return [
            {
                correct: "Câu trả lời mở rộng với quan điểm, lý do và ví dụ.",
                student: "Câu trả lời ngắn, rời rạc và sử dụng nhiều từ thừa.",
                whyWrong: "Khả năng mở rộng ý và kiểm soát độ trôi chảy còn yếu.",
                whatToTeach: "Luyện tập theo cấu trúc: Quan điểm - Lý do - Ví dụ trong thời gian quy định.",
            },
            {
                correct: "Trọng âm rõ ràng và ngữ pháp ổn định.",
                student: "Sự không ổn định trong trọng âm/ngữ pháp làm mờ nhạt ý nghĩa.",
                whyWrong: "Độ dễ hiểu và khả năng kiểm soát ngôn ngữ bị giảm sút.",
                whatToTeach: "Luyện tập Shadowing kết hợp với các vòng lặp sửa lỗi mục tiêu.",
            },
        ];
    return [
        {
            correct: "Đáp án chính xác mục tiêu",
            student: "Đáp án gần đúng nhưng vẫn sai",
            whyWrong: `Phản hồi cho thấy sự không khớp về ${s.errorSubtype}.`,
            whatToTeach: "Sử dụng quy trình xác minh cụ thể cho từng loại lỗi.",
        },
        {
            correct: "Phản hồi nằm trong các giới hạn yêu cầu",
            student: "Phản hồi có sự sai lệch về phạm vi/hình thức",
            whyWrong: "Cách chấm điểm IELTS yêu cầu sự khớp chính xác về mặt cấu trúc.",
            whatToTeach: "Sử dụng phân tích câu trả lời gần đúng để đạt thêm 0.5 điểm.",
        },
    ];
};

const explain = (s) =>
    `Câu trả lời ${s.questionType} này mắc lỗi ${s.errorSubtype}. Bạn nên luyện tập thói quen kiểm tra kỹ trước khi điền đáp án cuối cùng.`;

const errorTaxonomy = Object.fromEntries(
    seeds.map((s) => [
        s.code,
        {
            code: s.code,
            skill: s.skill,
            questionType: s.questionType,
            assessment: D("assessment", s.a),
            cognitive: D("cognitive", s.c),
            errorCategory: s.errorCategory,
            errorSubtype: s.errorSubtype,
            teacherExplanation: explain(s),
            detectionHeuristics: heur(s),
            nearCorrectRule: nearRule(s),
            remediation: clone(rem[s.errorCategory] || rem.STRATEGY),
            impactWeight: Number(
                Math.min(1, Math.max(0.1, s.impactWeight)).toFixed(2),
            ),
            examples: examples(s),
        },
    ]),
);

const questionTypeMaps = {
    reading: {
        note_completion: [],
        summary_completion: [],
        table_completion: [],
        flowchart_completion: [],
        sentence_completion: [],
        short_answer: [],
        tfng: [],
        ynng: [],
        matching_headings: [],
        matching_information: [],
        multiple_choice: [],
        matching_features: [],
        diagram_labeling: [],
    },
    listening: {
        form_completion: [],
        note_completion: [],
        table_completion: [],
        sentence_completion: [],
        short_answer: [],
        multiple_choice: [],
        map_labeling: [],
        map_labelling: [],
        diagram_labeling: [],
    },
    writing: { task1_academic: [], task1_general_letter: [], task2_essay: [] },
    speaking: { speaking_part_1: [], speaking_part_2: [], speaking_part_3: [] },
};
for (const [k, v] of Object.entries(errorTaxonomy)) {
    if (!questionTypeMaps[v.skill][v.questionType])
        questionTypeMaps[v.skill][v.questionType] = [];
    questionTypeMaps[v.skill][v.questionType].push(k);
}
questionTypeMaps.listening.map_labelling = [
    ...questionTypeMaps.listening.map_labeling,
];

const NUM = {
    zero: 0,
    one: 1,
    two: 2,
    three: 3,
    four: 4,
    five: 5,
    six: 6,
    seven: 7,
    eight: 8,
    nine: 9,
    ten: 10,
    eleven: 11,
    twelve: 12,
    thirteen: 13,
    fourteen: 14,
    fifteen: 15,
    sixteen: 16,
    seventeen: 17,
    eighteen: 18,
    nineteen: 19,
    twenty: 20,
    thirty: 30,
    forty: 40,
    fifty: 50,
    sixty: 60,
    seventy: 70,
    eighty: 80,
    ninety: 90,
};
const ss = (v) => (v == null ? "" : String(v)),
    tok = (v) => ss(v).trim().split(/\s+/).filter(Boolean),
    stem = (t) =>
        ss(t)
            .toLowerCase()
            .replace(/(?:ing|ed|es|s)$/i, ""),
    stemText = (v) => tok(v).map(stem).join(" ");
const replNum = (text) =>
    tok(text.toLowerCase())
        .map((w) => {
            const c = w.replace(/[^a-z-]/g, "");
            if (!c) return w;
            if (c.includes("-")) {
                const [a, b] = c.split("-");
                if (NUM[a] != null && NUM[b] != null) return String(NUM[a] + NUM[b]);
            }
            if (NUM[c] != null) return String(NUM[c]);
            return w;
        })
        .join(" ");

function normalizeAnswer(value, options = {}) {
    const {
        lowercase = true,
        trim = true,
        collapseSpaces = true,
        removePunctuation = false,
        normalizeNumberWords = true,
    } = options;
    let out = ss(value).normalize("NFKC");
    if (trim) out = out.trim();
    if (lowercase) out = out.toLowerCase();
    if (normalizeNumberWords) out = replNum(out);
    if (removePunctuation) out = out.replace(/[^\w\s.-]/g, " ");
    if (collapseSpaces) out = out.replace(/\s+/g, " ").trim();
    return out;
}

const lev = (a, b) => {
    const s = ss(a),
        t = ss(b);
    if (s === t) return 0;
    if (!s.length) return t.length;
    if (!t.length) return s.length;
    const prev = Array.from({ length: t.length + 1 }, (_, i) => i),
        cur = new Array(t.length + 1);
    for (let i = 1; i <= s.length; i += 1) {
        cur[0] = i;
        for (let j = 1; j <= t.length; j += 1) {
            const cost = s[i - 1] === t[j - 1] ? 0 : 1;
            cur[j] = Math.min(cur[j - 1] + 1, prev[j] + 1, prev[j - 1] + cost);
        }
        for (let j = 0; j <= t.length; j += 1) prev[j] = cur[j];
    }
    return prev[t.length];
};
const jac = (a, b) => {
    const A = new Set(tok(a)),
        B = new Set(tok(b));
    if (!A.size && !B.size) return 1;
    let i = 0;
    for (const x of A) if (B.has(x)) i += 1;
    const u = A.size + B.size - i;
    return u ? i / u : 0;
};
const pNum = (v) => {
    const n = Number(normalizeAnswer(v, { removePunctuation: true }));
    if (!Number.isNaN(n)) return n;
    const m = normalizeAnswer(v).match(/-?\d+(?:\.\d+)?/);
    return m ? Number(m[0]) : null;
};
const numEq = (a, b) => {
    const x = pNum(a),
        y = pNum(b);
    return x != null && y != null && x === y;
};
const defaultSim = (a, b) => jac(normalizeAnswer(a), normalizeAnswer(b));

function classifyNearCorrect(
    attempt = {},
    errorDefinition = null,
    options = {},
) {
    const user = normalizeAnswer(attempt.userAnswer ?? ""),
        correct = normalizeAnswer(attempt.correctAnswer ?? ""),
        getSemanticSimilarity = options.getSemanticSimilarity || defaultSim,
        rule = errorDefinition?.nearCorrectRule || {
            enabled: true,
            mode: "any",
            thresholds: {
                editDistanceMax: 2,
                semanticSimilarityMin: 0.78,
                tokenOverlapMin: 0.5,
            },
        };
    const metrics = {
        editDistance: lev(user, correct),
        semanticSimilarity: Number(getSemanticSimilarity(user, correct).toFixed(4)),
        tokenOverlap: Number(jac(user, correct).toFixed(4)),
        lemmaMatch:
            stemText(user) === stemText(correct) && stemText(user).length > 0,
        numericValueMatch: numEq(user, correct),
    };
    if (!rule.enabled)
        return {
            isNearCorrect: false,
            metrics,
            matchedCriteria: [],
            reason: rule.rationale || "Chế độ kiểm tra câu trả lời gần đúng bị tắt.",
        };
    const checks = [],
        t = rule.thresholds || {};
    if (t.editDistanceMax != null)
        checks.push({
            metric: "editDistance",
            pass: metrics.editDistance <= t.editDistanceMax,
        });
    if (t.semanticSimilarityMin != null)
        checks.push({
            metric: "semanticSimilarity",
            pass: metrics.semanticSimilarity >= t.semanticSimilarityMin,
        });
    if (t.tokenOverlapMin != null)
        checks.push({
            metric: "tokenOverlap",
            pass: metrics.tokenOverlap >= t.tokenOverlapMin,
        });
    if (t.lemmaMatch === true)
        checks.push({ metric: "lemmaMatch", pass: metrics.lemmaMatch === true });
    if (t.numericValueMatch === true)
        checks.push({
            metric: "numericValueMatch",
            pass: metrics.numericValueMatch === true,
        });
    const isNearCorrect = checks.length
        ? rule.mode === "all"
            ? checks.every((c) => c.pass)
            : checks.some((c) => c.pass)
        : false;
    return {
        isNearCorrect,
        metrics,
        matchedCriteria: checks.filter((c) => c.pass),
        evaluatedCriteria: checks,
        reason: isNearCorrect
            ? "Đạt ngưỡng gần đúng."
            : "Chưa đạt ngưỡng câu trả lời gần đúng.",
    };
}

function computeImpactScore(input = {}) {
    const {
        errorCode,
        frequency = 1,
        recentFrequency = frequency,
        nearCorrectRate = 0,
        severityMultiplier = 1,
    } = input;
    const d = errorTaxonomy[errorCode],
        w = d?.impactWeight ?? 0.5,
        f = Math.max(0, Number(frequency) || 0),
        rf = Math.max(0, Number(recentFrequency) || 0),
        n = Math.min(1, Math.max(0, Number(nearCorrectRate) || 0)),
        s = Math.max(0.5, Number(severityMultiplier) || 1);
    const raw =
        w *
        Math.log2(f + 1) *
        (1 + Math.min(1.5, rf / 20)) *
        (1 - n * 0.45) *
        s *
        20;
    return Number(Math.max(0, Math.min(100, raw)).toFixed(2));
}

export {
    coreDimensions,
    errorTaxonomy,
    questionTypeMaps,
    normalizeAnswer,
    classifyNearCorrect,
    computeImpactScore,
};
