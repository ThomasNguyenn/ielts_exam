export const CATEGORY_LABELS_STUDENT = {
  FORM: {
    label: "Lỗi hình thức",
    explanation: "Bạn làm sai yêu cầu về định dạng, số từ hoặc cách trình bày câu trả lời."
  },
  LEXICAL: {
    label: "Lỗi từ vựng",
    explanation: "Bạn dùng từ chưa chính xác, sai ngữ cảnh hoặc vốn từ còn hạn chế."
  },
  INFERENCE: {
    label: "Lỗi suy luận",
    explanation: "Bạn hiểu sai ý gián tiếp hoặc rút ra kết luận chưa đúng từ bài đọc/nghe."
  },
  DISCOURSE: {
    label: "Lỗi theo dõi mạch ý",
    explanation: "Bạn gặp khó khăn khi theo dõi mạch nội dung hoặc lập luận trong đoạn văn."
  },
  STRATEGY: {
    label: "Lỗi chiến lược làm bài",
    explanation: "Bạn chọn cách làm chưa phù hợp hoặc phân bổ thời gian chưa tốt."
  },
  ATTENTION: {
    label: "Lỗi thiếu tập trung",
    explanation: "Bạn bỏ sót thông tin quan trọng hoặc không chú ý đủ khi làm bài."
  },
  MEMORY: {
    label: "Lỗi ghi nhớ thông tin",
    explanation: "Bạn quên thông tin vừa nghe hoặc đọc khi trả lời câu hỏi."
  },
  TASK: {
    label: "Chưa đáp ứng đúng yêu cầu đề",
    explanation: "Bài làm chưa trả lời đúng trọng tâm hoặc chưa hoàn thành đầy đủ yêu cầu."
  },
  COHESION: {
    label: "Lỗi liên kết",
    explanation: "Các câu hoặc ý trong bài chưa được nối với nhau một cách tự nhiên."
  },
  GRAMMAR: {
    label: "Lỗi ngữ pháp",
    explanation: "Bạn mắc lỗi về thì, cấu trúc câu hoặc hòa hợp chủ vị."
  },
  FLUENCY: {
    label: "Lỗi độ trôi chảy",
    explanation: "Bạn nói còn ngập ngừng, ngắt quãng hoặc thiếu mạch lạc."
  },
  COHERENCE: {
    label: "Lỗi mạch lạc",
    explanation: "Bài viết hoặc bài nói chưa sắp xếp ý tưởng rõ ràng và logic."
  },
  PRONUNCIATION: {
    label: "Lỗi phát âm",
    explanation: "Phát âm chưa rõ hoặc sai âm khiến người nghe khó hiểu."
  }
}

export const COGNITIVE_LABELS_STUDENT = {
  Retrieval: {
    label: "Tìm thông tin",
    explanation: "Bạn gặp khó khăn khi tìm đúng thông tin trong bài."
  },
  "Semantic Mapping": {
    label: "Hiểu cách diễn đạt khác nhau",
    explanation: "Bạn chưa nhận ra các cách paraphrase hoặc diễn đạt tương đương."
  },
  Inference: {
    label: "Hiểu ý gián tiếp",
    explanation: "Bạn chưa hiểu đúng thông tin không được nói trực tiếp."
  },
  "Discourse Tracking": {
    label: "Theo dõi mạch nội dung",
    explanation: "Bạn chưa theo dõi được ý chính và sự phát triển của đoạn văn."
  },
  "Scope Monitoring": {
    label: "Hiểu đúng phạm vi thông tin",
    explanation: "Bạn hiểu thông tin nhưng sai phạm vi hoặc mức độ."
  },
  "Lexical Retrieval": {
    label: "Nhớ từ để sử dụng",
    explanation: "Bạn không tìm được từ phù hợp khi nói hoặc viết."
  },
  "Syntax Construction": {
    label: "Xây dựng câu",
    explanation: "Bạn gặp khó khăn khi tạo câu đúng cấu trúc."
  },
  "Grammatical Encoding": {
    label: "Dùng ngữ pháp chính xác",
    explanation: "Bạn hiểu ý nhưng dùng sai thì hoặc cấu trúc."
  },
  Acoustic: {
    label: "Phân biệt âm",
    explanation: "Bạn nghe chưa rõ hoặc nhầm lẫn giữa các âm."
  },
  Segmentation: {
    label: "Nhận diện ranh giới từ",
    explanation: "Bạn không tách được các từ khi người nói nối âm."
  },
  Prediction: {
    label: "Dự đoán nội dung",
    explanation: "Bạn chưa dự đoán trước thông tin sắp nghe hoặc đọc."
  }
}

export const DIMENSION_LABELS_STUDENT = {
  "R.A.EXPLICIT": {
    label: "Thông tin trực tiếp",
    explanation: "Câu hỏi yêu cầu tìm thông tin được nói rõ trong bài."
  },
  "R.A.INFERENCE": {
    label: "Thông tin suy luận",
    explanation: "Bạn cần suy ra ý nghĩa từ nội dung bài."
  },
  "R.A.LOGIC": {
    label: "Theo dõi lập luận",
    explanation: "Câu hỏi yêu cầu hiểu cách tác giả phát triển ý."
  },
  "W.A.TASK_RESPONSE": {
    label: "Trả lời đúng đề",
    explanation: "Bài viết cần trả lời đúng và đủ yêu cầu đề bài."
  },
  "W.A.COHERENCE": {
    label: "Mạch lạc bài viết",
    explanation: "Các ý trong bài viết cần được sắp xếp logic."
  },
  "W.A.LEXICAL": {
    label: "Từ vựng bài viết",
    explanation: "Bạn cần dùng từ chính xác và đa dạng hơn."
  },
  "W.A.GRAMMAR": {
    label: "Ngữ pháp bài viết",
    explanation: "Bạn cần cải thiện độ chính xác và sự đa dạng cấu trúc câu."
  },
  "S.A.FLUENCY_COHERENCE": {
    label: "Độ trôi chảy khi nói",
    explanation: "Bạn cần nói mượt hơn và kết nối ý tốt hơn."
  },
  "S.A.LEXICAL": {
    label: "Từ vựng khi nói",
    explanation: "Bạn cần dùng từ phong phú và đúng ngữ cảnh hơn."
  },
  "S.A.GRAMMAR": {
    label: "Ngữ pháp khi nói",
    explanation: "Bạn cần giảm lỗi cấu trúc câu khi nói."
  },
  "S.A.PRONUNCIATION": {
    label: "Phát âm",
    explanation: "Bạn cần phát âm rõ hơn để người nghe hiểu dễ dàng."
  }
}

export const SUBTYPE_OVERRIDES_STUDENT = {
  SPELLING: {
    label: "Sai chính tả",
    explanation: "Bạn viết sai chính tả của từ."
  },
  PLURAL_S: {
    label: "Sai số ít/số nhiều",
    explanation: "Bạn quên thêm hoặc thêm sai 's/es'."
  },
  WORD_FORM: {
    label: "Sai dạng từ",
    explanation: "Bạn dùng sai loại từ (danh từ, động từ, tính từ...)."
  },
  WRITING_MISSING_OVERVIEW: {
    label: "Thiếu overview",
    explanation: "Task 1 cần có đoạn tổng quan nhưng bài của bạn chưa có."
  },
  WRITING_GR_SVA: {
    label: "Sai hòa hợp chủ vị",
    explanation: "Chủ ngữ và động từ không phù hợp với nhau."
  },
  SPEAKING_FLUENCY_BREAKDOWN: {
    label: "Ngập ngừng khi nói",
    explanation: "Bạn dừng lại quá lâu hoặc lặp từ khi nói."
  },
  SPEAKING_PRON_INTELLIGIBILITY: {
    label: "Phát âm khó hiểu",
    explanation: "Người nghe có thể khó hiểu vì phát âm chưa rõ."
  }
}