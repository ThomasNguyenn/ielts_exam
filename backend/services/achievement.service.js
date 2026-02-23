import Achievement from '../models/Achievement.model.js';
import User from '../models/User.model.js';
import TestAttempt from '../models/TestAttempt.model.js';
import StudentProgress from '../models/StudentProgress.model.js';
import WritingSubmission from '../models/WritingSubmission.model.js';
import { addXP } from './gamification.service.js';

// ─── 100 ACHIEVEMENT DEFINITIONS ───
const ACHIEVEMENTS = [
    // ── STREAK (1-12) ──
    { key: 'streak_1', title: 'Khởi đầu mới', description: 'Luyện tập ngày đầu tiên', icon: '🌱', category: 'streak', tier: 'bronze', xpReward: 50, condition: { metric: 'streak', threshold: 1 }, order: 1 },
    { key: 'streak_3', title: 'Ba ngày kiên trì', description: 'Luyện tập 3 ngày liên tiếp', icon: '🔥', category: 'streak', tier: 'bronze', xpReward: 100, condition: { metric: 'streak', threshold: 3 }, order: 2 },
    { key: 'streak_5', title: 'Năm ngày nhiệt huyết', description: 'Luyện tập 5 ngày liên tiếp', icon: '🔥', category: 'streak', tier: 'bronze', xpReward: 150, condition: { metric: 'streak', threshold: 5 }, order: 3 },
    { key: 'streak_7', title: 'Chiến binh tuần lễ', description: 'Luyện tập 7 ngày liên tiếp', icon: '⚡', category: 'streak', tier: 'silver', xpReward: 250, condition: { metric: 'streak', threshold: 7 }, order: 4 },
    { key: 'streak_10', title: 'Mười ngày bền bỉ', description: 'Luyện tập 10 ngày liên tiếp', icon: '💪', category: 'streak', tier: 'silver', xpReward: 300, condition: { metric: 'streak', threshold: 10 }, order: 5 },
    { key: 'streak_14', title: 'Hai tuần không nghỉ', description: 'Luyện tập 14 ngày liên tiếp', icon: '🏃', category: 'streak', tier: 'silver', xpReward: 400, condition: { metric: 'streak', threshold: 14 }, order: 6 },
    { key: 'streak_21', title: 'Ba tuần thần tốc', description: 'Luyện tập 21 ngày liên tiếp', icon: '🌟', category: 'streak', tier: 'gold', xpReward: 500, condition: { metric: 'streak', threshold: 21 }, order: 7 },
    { key: 'streak_30', title: 'Chiến binh tháng', description: 'Luyện tập 30 ngày liên tiếp', icon: '👑', category: 'streak', tier: 'gold', xpReward: 750, condition: { metric: 'streak', threshold: 30 }, order: 8 },
    { key: 'streak_45', title: '45 ngày bất bại', description: 'Luyện tập 45 ngày liên tiếp', icon: '🏆', category: 'streak', tier: 'gold', xpReward: 1000, condition: { metric: 'streak', threshold: 45 }, order: 9 },
    { key: 'streak_60', title: 'Hai tháng kiên cường', description: 'Luyện tập 60 ngày liên tiếp', icon: '💎', category: 'streak', tier: 'diamond', xpReward: 1500, condition: { metric: 'streak', threshold: 60 }, order: 10 },
    { key: 'streak_90', title: 'Huyền thoại 90 ngày', description: 'Luyện tập 90 ngày liên tiếp', icon: '🌈', category: 'streak', tier: 'diamond', xpReward: 2000, condition: { metric: 'streak', threshold: 90 }, order: 11 },
    { key: 'streak_180', title: 'Nửa năm bất khuất', description: 'Luyện tập 180 ngày liên tiếp', icon: '🏛️', category: 'streak', tier: 'diamond', xpReward: 5000, condition: { metric: 'streak', threshold: 180 }, order: 12 },

    // ── TESTS COMPLETED (13-26) ──
    { key: 'test_1', title: 'Bước đầu tiên', description: 'Hoàn thành bài test đầu tiên', icon: '📝', category: 'test', tier: 'bronze', xpReward: 100, condition: { metric: 'tests_completed', threshold: 1 }, order: 1 },
    { key: 'test_3', title: 'Người học chăm chỉ', description: 'Hoàn thành 3 bài test', icon: '📋', category: 'test', tier: 'bronze', xpReward: 150, condition: { metric: 'tests_completed', threshold: 3 }, order: 2 },
    { key: 'test_5', title: 'Năm bài hoàn hảo', description: 'Hoàn thành 5 bài test', icon: '📊', category: 'test', tier: 'bronze', xpReward: 200, condition: { metric: 'tests_completed', threshold: 5 }, order: 3 },
    { key: 'test_10', title: 'Mười lần thử sức', description: 'Hoàn thành 10 bài test', icon: '🎯', category: 'test', tier: 'silver', xpReward: 300, condition: { metric: 'tests_completed', threshold: 10 }, order: 4 },
    { key: 'test_15', title: 'Nỗ lực không ngừng', description: 'Hoàn thành 15 bài test', icon: '📈', category: 'test', tier: 'silver', xpReward: 400, condition: { metric: 'tests_completed', threshold: 15 }, order: 5 },
    { key: 'test_25', title: 'Chiến binh luyện tập', description: 'Hoàn thành 25 bài test', icon: '🏅', category: 'test', tier: 'silver', xpReward: 500, condition: { metric: 'tests_completed', threshold: 25 }, order: 6 },
    { key: 'test_40', title: 'Bốn mươi thử thách', description: 'Hoàn thành 40 bài test', icon: '🎖️', category: 'test', tier: 'gold', xpReward: 700, condition: { metric: 'tests_completed', threshold: 40 }, order: 7 },
    { key: 'test_50', title: 'Năm mươi chiến thắng', description: 'Hoàn thành 50 bài test', icon: '🏆', category: 'test', tier: 'gold', xpReward: 1000, condition: { metric: 'tests_completed', threshold: 50 }, order: 8 },
    { key: 'test_75', title: 'Bậc thầy luyện tập', description: 'Hoàn thành 75 bài test', icon: '👑', category: 'test', tier: 'gold', xpReward: 1500, condition: { metric: 'tests_completed', threshold: 75 }, order: 9 },
    { key: 'test_100', title: 'Huyền thoại trăm bài', description: 'Hoàn thành 100 bài test', icon: '💎', category: 'test', tier: 'diamond', xpReward: 2000, condition: { metric: 'tests_completed', threshold: 100 }, order: 10 },
    { key: 'test_150', title: '150 lần rèn luyện', description: 'Hoàn thành 150 bài test', icon: '🌟', category: 'test', tier: 'diamond', xpReward: 3000, condition: { metric: 'tests_completed', threshold: 150 }, order: 11 },
    { key: 'test_200', title: 'Siêu nhân luyện thi', description: 'Hoàn thành 200 bài test', icon: '🏛️', category: 'test', tier: 'diamond', xpReward: 5000, condition: { metric: 'tests_completed', threshold: 200 }, order: 12 },
    { key: 'test_reading_10', title: 'Đọc giả chuyên cần', description: 'Hoàn thành 10 bài Reading', icon: '📖', category: 'test', tier: 'silver', xpReward: 300, condition: { metric: 'reading_completed', threshold: 10 }, order: 13 },
    { key: 'test_listening_10', title: 'Thính giả tinh tường', description: 'Hoàn thành 10 bài Listening', icon: '🎧', category: 'test', tier: 'silver', xpReward: 300, condition: { metric: 'listening_completed', threshold: 10 }, order: 14 },

    // ── WRITING (27-40) ──
    { key: 'writing_1', title: 'Cây bút đầu tiên', description: 'Nộp bài viết đầu tiên', icon: '✍️', category: 'writing', tier: 'bronze', xpReward: 100, condition: { metric: 'writings_submitted', threshold: 1 }, order: 1 },
    { key: 'writing_3', title: 'Ba bài viết', description: 'Nộp 3 bài viết', icon: '📝', category: 'writing', tier: 'bronze', xpReward: 150, condition: { metric: 'writings_submitted', threshold: 3 }, order: 2 },
    { key: 'writing_5', title: 'Tập viết đều đặn', description: 'Nộp 5 bài viết', icon: '🖊️', category: 'writing', tier: 'bronze', xpReward: 200, condition: { metric: 'writings_submitted', threshold: 5 }, order: 3 },
    { key: 'writing_10', title: 'Cây bút bạc', description: 'Nộp 10 bài viết', icon: '📄', category: 'writing', tier: 'silver', xpReward: 350, condition: { metric: 'writings_submitted', threshold: 10 }, order: 4 },
    { key: 'writing_15', title: 'Nhà văn trẻ', description: 'Nộp 15 bài viết', icon: '📃', category: 'writing', tier: 'silver', xpReward: 500, condition: { metric: 'writings_submitted', threshold: 15 }, order: 5 },
    { key: 'writing_25', title: 'Cây bút vàng', description: 'Nộp 25 bài viết', icon: '🖋️', category: 'writing', tier: 'gold', xpReward: 750, condition: { metric: 'writings_submitted', threshold: 25 }, order: 6 },
    { key: 'writing_40', title: 'Bốn mươi trang viết', description: 'Nộp 40 bài viết', icon: '📚', category: 'writing', tier: 'gold', xpReward: 1000, condition: { metric: 'writings_submitted', threshold: 40 }, order: 7 },
    { key: 'writing_50', title: 'Tác giả huyền thoại', description: 'Nộp 50 bài viết', icon: '💎', category: 'writing', tier: 'diamond', xpReward: 1500, condition: { metric: 'writings_submitted', threshold: 50 }, order: 8 },
    { key: 'writing_75', title: 'Bậc thầy viết lách', description: 'Nộp 75 bài viết', icon: '🏛️', category: 'writing', tier: 'diamond', xpReward: 2000, condition: { metric: 'writings_submitted', threshold: 75 }, order: 9 },
    { key: 'writing_100', title: 'Trăm bài không mệt', description: 'Nộp 100 bài viết', icon: '🌟', category: 'writing', tier: 'diamond', xpReward: 3000, condition: { metric: 'writings_submitted', threshold: 100 }, order: 10 },
    { key: 'writing_task1_5', title: 'Task 1 chuyên gia', description: 'Hoàn thành 5 bài Task 1', icon: '📊', category: 'writing', tier: 'silver', xpReward: 300, condition: { metric: 'writing_task1', threshold: 5 }, order: 11 },
    { key: 'writing_task2_5', title: 'Task 2 chuyên gia', description: 'Hoàn thành 5 bài Task 2', icon: '📝', category: 'writing', tier: 'silver', xpReward: 300, condition: { metric: 'writing_task2', threshold: 5 }, order: 12 },
    { key: 'writing_task1_15', title: 'Task 1 bậc thầy', description: 'Hoàn thành 15 bài Task 1', icon: '📈', category: 'writing', tier: 'gold', xpReward: 750, condition: { metric: 'writing_task1', threshold: 15 }, order: 13 },
    { key: 'writing_task2_15', title: 'Task 2 bậc thầy', description: 'Hoàn thành 15 bài Task 2', icon: '🎯', category: 'writing', tier: 'gold', xpReward: 750, condition: { metric: 'writing_task2', threshold: 15 }, order: 14 },

    // ── SPEAKING (41-52) ──
    { key: 'speaking_1', title: 'Lần nói đầu tiên', description: 'Hoàn thành phiên nói đầu tiên', icon: '🎙️', category: 'speaking', tier: 'bronze', xpReward: 100, condition: { metric: 'speaking_sessions', threshold: 1 }, order: 1 },
    { key: 'speaking_3', title: 'Ba lần tự tin', description: 'Hoàn thành 3 phiên nói', icon: '🗣️', category: 'speaking', tier: 'bronze', xpReward: 150, condition: { metric: 'speaking_sessions', threshold: 3 }, order: 2 },
    { key: 'speaking_5', title: 'Năm lần thuyết trình', description: 'Hoàn thành 5 phiên nói', icon: '💬', category: 'speaking', tier: 'bronze', xpReward: 200, condition: { metric: 'speaking_sessions', threshold: 5 }, order: 3 },
    { key: 'speaking_10', title: 'Diễn giả bạc', description: 'Hoàn thành 10 phiên nói', icon: '🎤', category: 'speaking', tier: 'silver', xpReward: 350, condition: { metric: 'speaking_sessions', threshold: 10 }, order: 4 },
    { key: 'speaking_20', title: 'Diễn giả vàng', description: 'Hoàn thành 20 phiên nói', icon: '🏅', category: 'speaking', tier: 'silver', xpReward: 500, condition: { metric: 'speaking_sessions', threshold: 20 }, order: 5 },
    { key: 'speaking_30', title: 'MC chuyên nghiệp', description: 'Hoàn thành 30 phiên nói', icon: '🎭', category: 'speaking', tier: 'gold', xpReward: 750, condition: { metric: 'speaking_sessions', threshold: 30 }, order: 6 },
    { key: 'speaking_50', title: 'Bậc thầy hùng biện', description: 'Hoàn thành 50 phiên nói', icon: '👑', category: 'speaking', tier: 'gold', xpReward: 1000, condition: { metric: 'speaking_sessions', threshold: 50 }, order: 7 },
    { key: 'speaking_75', title: 'Siêu sao sân khấu', description: 'Hoàn thành 75 phiên nói', icon: '💎', category: 'speaking', tier: 'diamond', xpReward: 1500, condition: { metric: 'speaking_sessions', threshold: 75 }, order: 8 },
    { key: 'speaking_100', title: 'Trăm lần tỏa sáng', description: 'Hoàn thành 100 phiên nói', icon: '🌟', category: 'speaking', tier: 'diamond', xpReward: 2000, condition: { metric: 'speaking_sessions', threshold: 100 }, order: 9 },
    { key: 'speaking_part1_10', title: 'Part 1 thành thạo', description: 'Hoàn thành 10 bài Part 1', icon: '1️⃣', category: 'speaking', tier: 'silver', xpReward: 300, condition: { metric: 'speaking_part1', threshold: 10 }, order: 10 },
    { key: 'speaking_part2_10', title: 'Part 2 thành thạo', description: 'Hoàn thành 10 bài Part 2', icon: '2️⃣', category: 'speaking', tier: 'silver', xpReward: 300, condition: { metric: 'speaking_part2', threshold: 10 }, order: 11 },
    { key: 'speaking_part3_10', title: 'Part 3 thành thạo', description: 'Hoàn thành 10 bài Part 3', icon: '3️⃣', category: 'speaking', tier: 'silver', xpReward: 300, condition: { metric: 'speaking_part3', threshold: 10 }, order: 12 },

    // ── MODULE / LEARNING (53-62) ──
    { key: 'module_1', title: 'Học viên mới', description: 'Hoàn thành module đầu tiên', icon: '📕', category: 'module', tier: 'bronze', xpReward: 150, condition: { metric: 'modules_completed', threshold: 1 }, order: 1 },
    { key: 'module_3', title: 'Học hành chăm chỉ', description: 'Hoàn thành 3 modules', icon: '📗', category: 'module', tier: 'bronze', xpReward: 250, condition: { metric: 'modules_completed', threshold: 3 }, order: 2 },
    { key: 'module_5', title: 'Năm module chinh phục', description: 'Hoàn thành 5 modules', icon: '📘', category: 'module', tier: 'silver', xpReward: 400, condition: { metric: 'modules_completed', threshold: 5 }, order: 3 },
    { key: 'module_all', title: 'Hoàn thành chương trình', description: 'Hoàn thành tất cả modules', icon: '🎓', category: 'module', tier: 'gold', xpReward: 1000, condition: { metric: 'all_modules_completed', threshold: 1 }, order: 4 },
    { key: 'quiz_perfect', title: 'Điểm hoàn hảo', description: 'Đạt 100% trong quiz module', icon: '💯', category: 'module', tier: 'gold', xpReward: 500, condition: { metric: 'perfect_quiz', threshold: 1 }, order: 5 },
    { key: 'quiz_perfect_3', title: 'Ba lần hoàn hảo', description: 'Đạt 100% trong 3 quiz modules', icon: '⭐', category: 'module', tier: 'gold', xpReward: 750, condition: { metric: 'perfect_quiz', threshold: 3 }, order: 6 },
    { key: 'study_plan_create', title: 'Lập kế hoạch', description: 'Tạo kế hoạch học tập đầu tiên', icon: '📅', category: 'module', tier: 'bronze', xpReward: 100, condition: { metric: 'study_plan_created', threshold: 1 }, order: 7 },
    { key: 'study_task_10', title: 'Mười nhiệm vụ', description: 'Hoàn thành 10 nhiệm vụ học tập', icon: '✅', category: 'module', tier: 'silver', xpReward: 300, condition: { metric: 'study_tasks_completed', threshold: 10 }, order: 8 },
    { key: 'study_task_25', title: '25 nhiệm vụ', description: 'Hoàn thành 25 nhiệm vụ học tập', icon: '🎯', category: 'module', tier: 'gold', xpReward: 500, condition: { metric: 'study_tasks_completed', threshold: 25 }, order: 9 },
    { key: 'study_task_50', title: 'Vua nhiệm vụ', description: 'Hoàn thành 50 nhiệm vụ học tập', icon: '👑', category: 'module', tier: 'diamond', xpReward: 1000, condition: { metric: 'study_tasks_completed', threshold: 50 }, order: 10 },

    // ── SCORE / BAND (63-78) ──
    { key: 'reading_band_5', title: 'Reading Band 5', description: 'Đạt Band 5.0 Reading', icon: '📖', category: 'score', tier: 'bronze', xpReward: 200, condition: { metric: 'reading_band', threshold: 5 }, order: 1 },
    { key: 'reading_band_6', title: 'Reading Band 6', description: 'Đạt Band 6.0 Reading', icon: '📖', category: 'score', tier: 'silver', xpReward: 400, condition: { metric: 'reading_band', threshold: 6 }, order: 2 },
    { key: 'reading_band_7', title: 'Reading Band 7', description: 'Đạt Band 7.0 Reading', icon: '📖', category: 'score', tier: 'gold', xpReward: 750, condition: { metric: 'reading_band', threshold: 7 }, order: 3 },
    { key: 'reading_band_8', title: 'Reading Band 8', description: 'Đạt Band 8.0 Reading', icon: '📖', category: 'score', tier: 'diamond', xpReward: 1500, condition: { metric: 'reading_band', threshold: 8 }, order: 4 },
    { key: 'listening_band_5', title: 'Listening Band 5', description: 'Đạt Band 5.0 Listening', icon: '🎧', category: 'score', tier: 'bronze', xpReward: 200, condition: { metric: 'listening_band', threshold: 5 }, order: 5 },
    { key: 'listening_band_6', title: 'Listening Band 6', description: 'Đạt Band 6.0 Listening', icon: '🎧', category: 'score', tier: 'silver', xpReward: 400, condition: { metric: 'listening_band', threshold: 6 }, order: 6 },
    { key: 'listening_band_7', title: 'Listening Band 7', description: 'Đạt Band 7.0 Listening', icon: '🎧', category: 'score', tier: 'gold', xpReward: 750, condition: { metric: 'listening_band', threshold: 7 }, order: 7 },
    { key: 'listening_band_8', title: 'Listening Band 8', description: 'Đạt Band 8.0 Listening', icon: '🎧', category: 'score', tier: 'diamond', xpReward: 1500, condition: { metric: 'listening_band', threshold: 8 }, order: 8 },
    { key: 'score_perfect', title: 'Bài thi hoàn hảo', description: 'Đạt 100% trong bất kỳ bài test', icon: '💯', category: 'score', tier: 'gold', xpReward: 1000, condition: { metric: 'perfect_score', threshold: 1 }, order: 9 },
    { key: 'score_perfect_3', title: 'Ba lần toàn điểm', description: 'Đạt 100% trong 3 bài test', icon: '🌟', category: 'score', tier: 'diamond', xpReward: 2000, condition: { metric: 'perfect_score', threshold: 3 }, order: 10 },
    { key: 'score_improve', title: 'Tiến bộ rõ rệt', description: 'Cải thiện điểm 20%+ so với lần trước', icon: '📈', category: 'score', tier: 'silver', xpReward: 300, condition: { metric: 'score_improvement', threshold: 20 }, order: 11 },
    { key: 'score_improve_50', title: 'Nhảy vọt ngoạn mục', description: 'Cải thiện điểm 50%+ so với lần trước', icon: '🚀', category: 'score', tier: 'gold', xpReward: 500, condition: { metric: 'score_improvement', threshold: 50 }, order: 12 },
    { key: 'all_skills_5', title: 'Toàn diện Band 5', description: 'Đạt Band 5+ ở cả Reading và Listening', icon: '⭐', category: 'score', tier: 'silver', xpReward: 500, condition: { metric: 'all_skills_band', threshold: 5 }, order: 13 },
    { key: 'all_skills_6', title: 'Toàn diện Band 6', description: 'Đạt Band 6+ ở cả Reading và Listening', icon: '🌟', category: 'score', tier: 'gold', xpReward: 1000, condition: { metric: 'all_skills_band', threshold: 6 }, order: 14 },
    { key: 'all_skills_7', title: 'Toàn diện Band 7', description: 'Đạt Band 7+ ở cả Reading và Listening', icon: '💎', category: 'score', tier: 'diamond', xpReward: 2000, condition: { metric: 'all_skills_band', threshold: 7 }, order: 15 },
    { key: 'all_skills_8', title: 'Toàn diện Band 8', description: 'Đạt Band 8+ ở cả Reading và Listening', icon: '🏛️', category: 'score', tier: 'diamond', xpReward: 3000, condition: { metric: 'all_skills_band', threshold: 8 }, order: 16 },

    // ── VOCABULARY (79-88) ──
    { key: 'vocab_10', title: 'Mười từ đầu tiên', description: 'Thêm 10 từ vựng', icon: '📝', category: 'vocabulary', tier: 'bronze', xpReward: 50, condition: { metric: 'vocab_added', threshold: 10 }, order: 1 },
    { key: 'vocab_25', title: '25 từ mới', description: 'Thêm 25 từ vựng', icon: '📖', category: 'vocabulary', tier: 'bronze', xpReward: 100, condition: { metric: 'vocab_added', threshold: 25 }, order: 2 },
    { key: 'vocab_50', title: 'Kho từ vựng', description: 'Thêm 50 từ vựng', icon: '📚', category: 'vocabulary', tier: 'silver', xpReward: 200, condition: { metric: 'vocab_added', threshold: 50 }, order: 3 },
    { key: 'vocab_100', title: 'Trăm từ thông thạo', description: 'Thêm 100 từ vựng', icon: '🎯', category: 'vocabulary', tier: 'silver', xpReward: 400, condition: { metric: 'vocab_added', threshold: 100 }, order: 4 },
    { key: 'vocab_200', title: '200 từ phong phú', description: 'Thêm 200 từ vựng', icon: '🏆', category: 'vocabulary', tier: 'gold', xpReward: 750, condition: { metric: 'vocab_added', threshold: 200 }, order: 5 },
    { key: 'vocab_500', title: 'Từ điển sống', description: 'Thêm 500 từ vựng', icon: '💎', category: 'vocabulary', tier: 'diamond', xpReward: 1500, condition: { metric: 'vocab_added', threshold: 500 }, order: 6 },
    { key: 'vocab_review_50', title: 'Ôn tập siêng năng', description: 'Ôn tập 50 lần', icon: '🔄', category: 'vocabulary', tier: 'silver', xpReward: 200, condition: { metric: 'vocab_reviews', threshold: 50 }, order: 7 },
    { key: 'vocab_review_100', title: 'Ôn tập bền bỉ', description: 'Ôn tập 100 lần', icon: '🔁', category: 'vocabulary', tier: 'gold', xpReward: 400, condition: { metric: 'vocab_reviews', threshold: 100 }, order: 8 },
    { key: 'vocab_review_250', title: 'Ôn tập không ngừng', description: 'Ôn tập 250 lần', icon: '🌟', category: 'vocabulary', tier: 'gold', xpReward: 750, condition: { metric: 'vocab_reviews', threshold: 250 }, order: 9 },
    { key: 'vocab_mastered_25', title: 'Thuộc lòng 25 từ', description: 'Nắm vững 25 từ vựng', icon: '🧠', category: 'vocabulary', tier: 'gold', xpReward: 500, condition: { metric: 'vocab_mastered', threshold: 25 }, order: 10 },

    // ── XP / LEVEL (89-100) ──
    { key: 'xp_1000', title: '1000 XP đầu tiên', description: 'Tích lũy 1,000 XP', icon: '⭐', category: 'xp', tier: 'bronze', xpReward: 100, condition: { metric: 'total_xp', threshold: 1000 }, order: 1 },
    { key: 'xp_2500', title: '2500 XP', description: 'Tích lũy 2,500 XP', icon: '🌟', category: 'xp', tier: 'bronze', xpReward: 150, condition: { metric: 'total_xp', threshold: 2500 }, order: 2 },
    { key: 'xp_5000', title: '5000 XP', description: 'Tích lũy 5,000 XP', icon: '✨', category: 'xp', tier: 'silver', xpReward: 250, condition: { metric: 'total_xp', threshold: 5000 }, order: 3 },
    { key: 'xp_10000', title: 'Vạn XP', description: 'Tích lũy 10,000 XP', icon: '💫', category: 'xp', tier: 'silver', xpReward: 500, condition: { metric: 'total_xp', threshold: 10000 }, order: 4 },
    { key: 'xp_25000', title: '25K XP', description: 'Tích lũy 25,000 XP', icon: '🏅', category: 'xp', tier: 'gold', xpReward: 1000, condition: { metric: 'total_xp', threshold: 25000 }, order: 5 },
    { key: 'xp_50000', title: '50K XP - Huyền thoại', description: 'Tích lũy 50,000 XP', icon: '💎', category: 'xp', tier: 'diamond', xpReward: 2000, condition: { metric: 'total_xp', threshold: 50000 }, order: 6 },
    { key: 'level_2', title: 'Thăng cấp!', description: 'Đạt Level 2', icon: '🆙', category: 'xp', tier: 'bronze', xpReward: 50, condition: { metric: 'level', threshold: 2 }, order: 7 },
    { key: 'level_5', title: 'Level 5', description: 'Đạt Level 5', icon: '⬆️', category: 'xp', tier: 'silver', xpReward: 200, condition: { metric: 'level', threshold: 5 }, order: 8 },
    { key: 'level_8', title: 'Level 8 - Elite', description: 'Đạt Level 8', icon: '🏆', category: 'xp', tier: 'gold', xpReward: 500, condition: { metric: 'level', threshold: 8 }, order: 9 },
    { key: 'level_10', title: 'Level 10 - Master', description: 'Đạt Level 10', icon: '👑', category: 'xp', tier: 'diamond', xpReward: 1000, condition: { metric: 'level', threshold: 10 }, order: 10 },
    { key: 'first_levelup', title: 'Lên cấp đầu tiên', description: 'Lên cấp lần đầu tiên', icon: '🎉', category: 'xp', tier: 'bronze', xpReward: 100, condition: { metric: 'level', threshold: 2 }, order: 11 },
    { key: 'achievement_10', title: 'Sưu tập 10', description: 'Mở khóa 10 thành tựu', icon: '🏅', category: 'xp', tier: 'silver', xpReward: 300, condition: { metric: 'total_achievements', threshold: 10 }, order: 12 },

    // ═══════════════════════════════════════════
    // ═══  ACHIEVEMENTS 101-200 (NEW BATCH)  ═══
    // ═══════════════════════════════════════════

    // ── STREAK EXTENDED (101-108) ──
    { key: 'streak_365', title: '365 ngày huyền thoại', description: 'Luyện tập 365 ngày liên tiếp', icon: '🗓️', category: 'streak', tier: 'diamond', xpReward: 10000, condition: { metric: 'streak', threshold: 365 }, order: 13 },
    { key: 'streak_120', title: '120 ngày bất khuất', description: 'Luyện tập 120 ngày liên tiếp', icon: '🔱', category: 'streak', tier: 'diamond', xpReward: 3000, condition: { metric: 'streak', threshold: 120 }, order: 14 },
    { key: 'streak_2', title: 'Ngày thứ hai', description: 'Luyện tập 2 ngày liên tiếp', icon: '🌿', category: 'streak', tier: 'bronze', xpReward: 25, condition: { metric: 'streak', threshold: 2 }, order: 15 },
    { key: 'streak_240', title: 'Tám tháng bền gan', description: 'Luyện tập 240 ngày liên tiếp', icon: '🏔️', category: 'streak', tier: 'diamond', xpReward: 7500, condition: { metric: 'streak', threshold: 240 }, order: 16 },
    { key: 'streak_40', title: 'Bốn mươi ngày rèn luyện', description: 'Luyện tập 40 ngày liên tiếp', icon: '🎯', category: 'streak', tier: 'gold', xpReward: 900, condition: { metric: 'streak', threshold: 40 }, order: 17 },
    { key: 'streak_50', title: '50 ngày thần kỳ', description: 'Luyện tập 50 ngày liên tiếp', icon: '🔥', category: 'streak', tier: 'gold', xpReward: 1200, condition: { metric: 'streak', threshold: 50 }, order: 18 },
    { key: 'streak_75', title: '75 ngày siêu sao', description: 'Luyện tập 75 ngày liên tiếp', icon: '⚡', category: 'streak', tier: 'diamond', xpReward: 1800, condition: { metric: 'streak', threshold: 75 }, order: 19 },
    { key: 'streak_100', title: 'Trăm ngày vàng', description: 'Luyện tập 100 ngày liên tiếp', icon: '💯', category: 'streak', tier: 'diamond', xpReward: 2500, condition: { metric: 'streak', threshold: 100 }, order: 20 },

    // ── TESTS EXTENDED (109-120) ──
    { key: 'test_2', title: 'Bài thứ hai', description: 'Hoàn thành 2 bài test', icon: '✌️', category: 'test', tier: 'bronze', xpReward: 50, condition: { metric: 'tests_completed', threshold: 2 }, order: 15 },
    { key: 'test_7', title: 'Tuần lễ luyện tập', description: 'Hoàn thành 7 bài test', icon: '📅', category: 'test', tier: 'bronze', xpReward: 250, condition: { metric: 'tests_completed', threshold: 7 }, order: 16 },
    { key: 'test_20', title: 'Hai mươi thử thách', description: 'Hoàn thành 20 bài test', icon: '🔢', category: 'test', tier: 'silver', xpReward: 450, condition: { metric: 'tests_completed', threshold: 20 }, order: 17 },
    { key: 'test_30', title: 'Ba mươi vượt đèo', description: 'Hoàn thành 30 bài test', icon: '🏋️', category: 'test', tier: 'silver', xpReward: 550, condition: { metric: 'tests_completed', threshold: 30 }, order: 18 },
    { key: 'test_60', title: 'Sáu mươi bài', description: 'Hoàn thành 60 bài test', icon: '📚', category: 'test', tier: 'gold', xpReward: 1200, condition: { metric: 'tests_completed', threshold: 60 }, order: 19 },
    { key: 'test_250', title: '250 bài rèn thép', description: 'Hoàn thành 250 bài test', icon: '🏗️', category: 'test', tier: 'diamond', xpReward: 6000, condition: { metric: 'tests_completed', threshold: 250 }, order: 20 },
    { key: 'test_300', title: 'Ba trăm bất bại', description: 'Hoàn thành 300 bài test', icon: '🛡️', category: 'test', tier: 'diamond', xpReward: 8000, condition: { metric: 'tests_completed', threshold: 300 }, order: 21 },
    { key: 'test_reading_25', title: 'Đọc giả bậc vàng', description: 'Hoàn thành 25 bài Reading', icon: '📕', category: 'test', tier: 'gold', xpReward: 600, condition: { metric: 'reading_completed', threshold: 25 }, order: 22 },
    { key: 'test_reading_50', title: 'Đọc giả kim cương', description: 'Hoàn thành 50 bài Reading', icon: '📗', category: 'test', tier: 'diamond', xpReward: 1500, condition: { metric: 'reading_completed', threshold: 50 }, order: 23 },
    { key: 'test_listening_25', title: 'Thính giả bậc vàng', description: 'Hoàn thành 25 bài Listening', icon: '🎵', category: 'test', tier: 'gold', xpReward: 600, condition: { metric: 'listening_completed', threshold: 25 }, order: 24 },
    { key: 'test_listening_50', title: 'Thính giả kim cương', description: 'Hoàn thành 50 bài Listening', icon: '🎶', category: 'test', tier: 'diamond', xpReward: 1500, condition: { metric: 'listening_completed', threshold: 50 }, order: 25 },
    { key: 'test_500', title: 'Năm trăm bài huyền thoại', description: 'Hoàn thành 500 bài test', icon: '🏛️', category: 'test', tier: 'diamond', xpReward: 10000, condition: { metric: 'tests_completed', threshold: 500 }, order: 26 },

    // ── WRITING EXTENDED (121-130) ──
    { key: 'writing_2', title: 'Hai bài đầu tay', description: 'Nộp 2 bài viết', icon: '✏️', category: 'writing', tier: 'bronze', xpReward: 75, condition: { metric: 'writings_submitted', threshold: 2 }, order: 15 },
    { key: 'writing_7', title: 'Tuần viết năng động', description: 'Nộp 7 bài viết', icon: '🗒️', category: 'writing', tier: 'bronze', xpReward: 250, condition: { metric: 'writings_submitted', threshold: 7 }, order: 16 },
    { key: 'writing_20', title: 'Hai mươi trang viết', description: 'Nộp 20 bài viết', icon: '📋', category: 'writing', tier: 'silver', xpReward: 600, condition: { metric: 'writings_submitted', threshold: 20 }, order: 17 },
    { key: 'writing_30', title: 'Ba mươi áng văn', description: 'Nộp 30 bài viết', icon: '📑', category: 'writing', tier: 'gold', xpReward: 800, condition: { metric: 'writings_submitted', threshold: 30 }, order: 18 },
    { key: 'writing_60', title: 'Sáu mươi thiên tự', description: 'Nộp 60 bài viết', icon: '🖊️', category: 'writing', tier: 'gold', xpReward: 1200, condition: { metric: 'writings_submitted', threshold: 60 }, order: 19 },
    { key: 'writing_150', title: '150 bài viết huyền thoại', description: 'Nộp 150 bài viết', icon: '🏛️', category: 'writing', tier: 'diamond', xpReward: 5000, condition: { metric: 'writings_submitted', threshold: 150 }, order: 20 },
    { key: 'writing_task1_10', title: 'Task 1 thuần thục', description: 'Hoàn thành 10 bài Task 1', icon: '📉', category: 'writing', tier: 'gold', xpReward: 500, condition: { metric: 'writing_task1', threshold: 10 }, order: 21 },
    { key: 'writing_task2_10', title: 'Task 2 thuần thục', description: 'Hoàn thành 10 bài Task 2', icon: '📰', category: 'writing', tier: 'gold', xpReward: 500, condition: { metric: 'writing_task2', threshold: 10 }, order: 22 },
    { key: 'writing_task1_25', title: 'Task 1 huyền thoại', description: 'Hoàn thành 25 bài Task 1', icon: '📊', category: 'writing', tier: 'diamond', xpReward: 1200, condition: { metric: 'writing_task1', threshold: 25 }, order: 23 },
    { key: 'writing_task2_25', title: 'Task 2 huyền thoại', description: 'Hoàn thành 25 bài Task 2', icon: '📝', category: 'writing', tier: 'diamond', xpReward: 1200, condition: { metric: 'writing_task2', threshold: 25 }, order: 24 },

    // ── SPEAKING EXTENDED (131-140) ──
    { key: 'speaking_2', title: 'Hai lần lên tiếng', description: 'Hoàn thành 2 phiên nói', icon: '💬', category: 'speaking', tier: 'bronze', xpReward: 75, condition: { metric: 'speaking_sessions', threshold: 2 }, order: 13 },
    { key: 'speaking_7', title: 'Tuần giao tiếp', description: 'Hoàn thành 7 phiên nói', icon: '🗣️', category: 'speaking', tier: 'bronze', xpReward: 250, condition: { metric: 'speaking_sessions', threshold: 7 }, order: 14 },
    { key: 'speaking_15', title: 'Mười lăm lần tự tin', description: 'Hoàn thành 15 phiên nói', icon: '🎯', category: 'speaking', tier: 'silver', xpReward: 450, condition: { metric: 'speaking_sessions', threshold: 15 }, order: 15 },
    { key: 'speaking_40', title: 'Bốn mươi lần hùng biện', description: 'Hoàn thành 40 phiên nói', icon: '🏅', category: 'speaking', tier: 'gold', xpReward: 900, condition: { metric: 'speaking_sessions', threshold: 40 }, order: 16 },
    { key: 'speaking_150', title: '150 lần tỏa sáng', description: 'Hoàn thành 150 phiên nói', icon: '🏛️', category: 'speaking', tier: 'diamond', xpReward: 3000, condition: { metric: 'speaking_sessions', threshold: 150 }, order: 17 },
    { key: 'speaking_part1_25', title: 'Part 1 bậc thầy', description: 'Hoàn thành 25 bài Part 1', icon: '1️⃣', category: 'speaking', tier: 'gold', xpReward: 600, condition: { metric: 'speaking_part1', threshold: 25 }, order: 18 },
    { key: 'speaking_part2_25', title: 'Part 2 bậc thầy', description: 'Hoàn thành 25 bài Part 2', icon: '2️⃣', category: 'speaking', tier: 'gold', xpReward: 600, condition: { metric: 'speaking_part2', threshold: 25 }, order: 19 },
    { key: 'speaking_part3_25', title: 'Part 3 bậc thầy', description: 'Hoàn thành 25 bài Part 3', icon: '3️⃣', category: 'speaking', tier: 'gold', xpReward: 600, condition: { metric: 'speaking_part3', threshold: 25 }, order: 20 },
    { key: 'speaking_part1_50', title: 'Part 1 huyền thoại', description: 'Hoàn thành 50 bài Part 1', icon: '1️⃣', category: 'speaking', tier: 'diamond', xpReward: 1500, condition: { metric: 'speaking_part1', threshold: 50 }, order: 21 },
    { key: 'speaking_200', title: '200 phiên nói siêu phàm', description: 'Hoàn thành 200 phiên nói', icon: '🌟', category: 'speaking', tier: 'diamond', xpReward: 5000, condition: { metric: 'speaking_sessions', threshold: 200 }, order: 22 },

    // ── MODULE / LEARNING EXTENDED (141-148) ──
    { key: 'module_2', title: 'Hai module chinh phục', description: 'Hoàn thành 2 modules', icon: '📙', category: 'module', tier: 'bronze', xpReward: 200, condition: { metric: 'modules_completed', threshold: 2 }, order: 11 },
    { key: 'module_7', title: 'Bảy module thành thạo', description: 'Hoàn thành 7 modules', icon: '📓', category: 'module', tier: 'gold', xpReward: 800, condition: { metric: 'modules_completed', threshold: 7 }, order: 12 },
    { key: 'quiz_perfect_5', title: 'Năm lần hoàn hảo', description: 'Đạt 100% trong 5 quiz modules', icon: '🌟', category: 'module', tier: 'diamond', xpReward: 1000, condition: { metric: 'perfect_quiz', threshold: 5 }, order: 13 },
    { key: 'study_task_5', title: 'Năm nhiệm vụ đầu', description: 'Hoàn thành 5 nhiệm vụ học tập', icon: '✅', category: 'module', tier: 'bronze', xpReward: 150, condition: { metric: 'study_tasks_completed', threshold: 5 }, order: 14 },
    { key: 'study_task_100', title: 'Trăm nhiệm vụ', description: 'Hoàn thành 100 nhiệm vụ học tập', icon: '🏆', category: 'module', tier: 'diamond', xpReward: 2000, condition: { metric: 'study_tasks_completed', threshold: 100 }, order: 15 },
    { key: 'study_plan_3', title: 'Ba kế hoạch', description: 'Tạo 3 kế hoạch học tập', icon: '📋', category: 'module', tier: 'silver', xpReward: 250, condition: { metric: 'study_plan_created', threshold: 3 }, order: 16 },
    { key: 'study_plan_5', title: 'Nhà chiến lược', description: 'Tạo 5 kế hoạch học tập', icon: '🗺️', category: 'module', tier: 'gold', xpReward: 400, condition: { metric: 'study_plan_created', threshold: 5 }, order: 17 },
    { key: 'study_task_200', title: '200 nhiệm vụ siêu nhân', description: 'Hoàn thành 200 nhiệm vụ học tập', icon: '💎', category: 'module', tier: 'diamond', xpReward: 5000, condition: { metric: 'study_tasks_completed', threshold: 200 }, order: 18 },

    // ── SCORE EXTENDED (149-158) ──
    { key: 'reading_band_9', title: 'Reading Band 9 — Hoàn hảo', description: 'Đạt Band 9.0 Reading', icon: '👑', category: 'score', tier: 'diamond', xpReward: 5000, condition: { metric: 'reading_band', threshold: 9 }, order: 17 },
    { key: 'listening_band_9', title: 'Listening Band 9 — Hoàn hảo', description: 'Đạt Band 9.0 Listening', icon: '👑', category: 'score', tier: 'diamond', xpReward: 5000, condition: { metric: 'listening_band', threshold: 9 }, order: 18 },
    { key: 'score_perfect_5', title: 'Năm lần toàn điểm', description: 'Đạt 100% trong 5 bài test', icon: '⭐', category: 'score', tier: 'diamond', xpReward: 3000, condition: { metric: 'perfect_score', threshold: 5 }, order: 19 },
    { key: 'score_perfect_10', title: 'Mười lần toàn điểm', description: 'Đạt 100% trong 10 bài test', icon: '💫', category: 'score', tier: 'diamond', xpReward: 5000, condition: { metric: 'perfect_score', threshold: 10 }, order: 20 },
    { key: 'reading_band_4', title: 'Reading khởi đầu', description: 'Đạt Band 4.0 Reading', icon: '📖', category: 'score', tier: 'bronze', xpReward: 100, condition: { metric: 'reading_band', threshold: 4 }, order: 21 },
    { key: 'listening_band_4', title: 'Listening khởi đầu', description: 'Đạt Band 4.0 Listening', icon: '🎧', category: 'score', tier: 'bronze', xpReward: 100, condition: { metric: 'listening_band', threshold: 4 }, order: 22 },
    { key: 'reading_band_5_5', title: 'Reading Band 5.5', description: 'Đạt Band 5.5 Reading', icon: '📖', category: 'score', tier: 'silver', xpReward: 300, condition: { metric: 'reading_band', threshold: 5.5 }, order: 23 },
    { key: 'listening_band_5_5', title: 'Listening Band 5.5', description: 'Đạt Band 5.5 Listening', icon: '🎧', category: 'score', tier: 'silver', xpReward: 300, condition: { metric: 'listening_band', threshold: 5.5 }, order: 24 },
    { key: 'reading_band_6_5', title: 'Reading Band 6.5', description: 'Đạt Band 6.5 Reading', icon: '📖', category: 'score', tier: 'gold', xpReward: 600, condition: { metric: 'reading_band', threshold: 6.5 }, order: 25 },
    { key: 'listening_band_6_5', title: 'Listening Band 6.5', description: 'Đạt Band 6.5 Listening', icon: '🎧', category: 'score', tier: 'gold', xpReward: 600, condition: { metric: 'listening_band', threshold: 6.5 }, order: 26 },

    // ── VOCABULARY EXTENDED (159-168) ──
    { key: 'vocab_5', title: 'Năm từ đầu tiên', description: 'Thêm 5 từ vựng', icon: '📝', category: 'vocabulary', tier: 'bronze', xpReward: 25, condition: { metric: 'vocab_added', threshold: 5 }, order: 11 },
    { key: 'vocab_300', title: '300 từ chiến binh', description: 'Thêm 300 từ vựng', icon: '📖', category: 'vocabulary', tier: 'gold', xpReward: 1000, condition: { metric: 'vocab_added', threshold: 300 }, order: 12 },
    { key: 'vocab_750', title: '750 từ bách khoa', description: 'Thêm 750 từ vựng', icon: '📚', category: 'vocabulary', tier: 'diamond', xpReward: 2000, condition: { metric: 'vocab_added', threshold: 750 }, order: 13 },
    { key: 'vocab_1000', title: 'Ngàn từ huyền thoại', description: 'Thêm 1000 từ vựng', icon: '🏛️', category: 'vocabulary', tier: 'diamond', xpReward: 5000, condition: { metric: 'vocab_added', threshold: 1000 }, order: 14 },
    { key: 'vocab_review_25', title: 'Ôn tập chăm chỉ', description: 'Ôn tập 25 lần', icon: '🔄', category: 'vocabulary', tier: 'bronze', xpReward: 100, condition: { metric: 'vocab_reviews', threshold: 25 }, order: 15 },
    { key: 'vocab_review_500', title: '500 lần ôn tập', description: 'Ôn tập 500 lần', icon: '🔁', category: 'vocabulary', tier: 'diamond', xpReward: 1500, condition: { metric: 'vocab_reviews', threshold: 500 }, order: 16 },
    { key: 'vocab_mastered_5', title: 'Thuộc lòng 5 từ', description: 'Nắm vững 5 từ vựng', icon: '🧠', category: 'vocabulary', tier: 'bronze', xpReward: 100, condition: { metric: 'vocab_mastered', threshold: 5 }, order: 17 },
    { key: 'vocab_mastered_10', title: 'Thuộc lòng 10 từ', description: 'Nắm vững 10 từ vựng', icon: '🧠', category: 'vocabulary', tier: 'silver', xpReward: 250, condition: { metric: 'vocab_mastered', threshold: 10 }, order: 18 },
    { key: 'vocab_mastered_50', title: 'Thuộc lòng 50 từ', description: 'Nắm vững 50 từ vựng', icon: '🧠', category: 'vocabulary', tier: 'gold', xpReward: 750, condition: { metric: 'vocab_mastered', threshold: 50 }, order: 19 },
    { key: 'vocab_mastered_100', title: 'Thuộc lòng 100 từ', description: 'Nắm vững 100 từ vựng', icon: '💎', category: 'vocabulary', tier: 'diamond', xpReward: 2000, condition: { metric: 'vocab_mastered', threshold: 100 }, order: 20 },

    // ── XP / LEVEL EXTENDED (169-180) ──
    { key: 'xp_500', title: '500 XP đầu tiên', description: 'Tích lũy 500 XP', icon: '⭐', category: 'xp', tier: 'bronze', xpReward: 50, condition: { metric: 'total_xp', threshold: 500 }, order: 13 },
    { key: 'xp_7500', title: '7500 XP', description: 'Tích lũy 7,500 XP', icon: '🌟', category: 'xp', tier: 'silver', xpReward: 350, condition: { metric: 'total_xp', threshold: 7500 }, order: 14 },
    { key: 'xp_15000', title: '15K XP', description: 'Tích lũy 15,000 XP', icon: '✨', category: 'xp', tier: 'gold', xpReward: 750, condition: { metric: 'total_xp', threshold: 15000 }, order: 15 },
    { key: 'xp_75000', title: '75K XP — Bất tử', description: 'Tích lũy 75,000 XP', icon: '🏛️', category: 'xp', tier: 'diamond', xpReward: 3000, condition: { metric: 'total_xp', threshold: 75000 }, order: 16 },
    { key: 'xp_100000', title: '100K XP — Thần thoại', description: 'Tích lũy 100,000 XP', icon: '🌌', category: 'xp', tier: 'diamond', xpReward: 5000, condition: { metric: 'total_xp', threshold: 100000 }, order: 17 },
    { key: 'level_3', title: 'Level 3', description: 'Đạt Level 3', icon: '🆙', category: 'xp', tier: 'bronze', xpReward: 100, condition: { metric: 'level', threshold: 3 }, order: 18 },
    { key: 'level_7', title: 'Level 7', description: 'Đạt Level 7', icon: '⬆️', category: 'xp', tier: 'gold', xpReward: 400, condition: { metric: 'level', threshold: 7 }, order: 19 },
    { key: 'level_12', title: 'Level 12 — Legend', description: 'Đạt Level 12', icon: '🌟', category: 'xp', tier: 'diamond', xpReward: 1500, condition: { metric: 'level', threshold: 12 }, order: 20 },
    { key: 'level_15', title: 'Level 15 — Godlike', description: 'Đạt Level 15', icon: '🌌', category: 'xp', tier: 'diamond', xpReward: 3000, condition: { metric: 'level', threshold: 15 }, order: 21 },
    { key: 'achievement_25', title: 'Sưu tập 25', description: 'Mở khóa 25 thành tựu', icon: '🏅', category: 'xp', tier: 'gold', xpReward: 500, condition: { metric: 'total_achievements', threshold: 25 }, order: 22 },
    { key: 'achievement_50', title: 'Sưu tập 50', description: 'Mở khóa 50 thành tựu', icon: '🏆', category: 'xp', tier: 'gold', xpReward: 1000, condition: { metric: 'total_achievements', threshold: 50 }, order: 23 },
    { key: 'achievement_100', title: 'Sưu tập 100', description: 'Mở khóa 100 thành tựu', icon: '💎', category: 'xp', tier: 'diamond', xpReward: 3000, condition: { metric: 'total_achievements', threshold: 100 }, order: 24 },

    // ═══════════════════════════════════════
    // ═══  HIDDEN ACHIEVEMENTS (181-200)  ═══
    // ═══════════════════════════════════════

    { key: 'hidden_night_owl', title: 'Cú đêm', description: 'Luyện tập lúc sau 11 giờ đêm', icon: '🦉', category: 'mastery', tier: 'silver', xpReward: 200, condition: { metric: 'night_practice', threshold: 1 }, order: 1, hidden: true },
    { key: 'hidden_early_bird', title: 'Chim sớm', description: 'Luyện tập trước 6 giờ sáng', icon: '🐦', category: 'mastery', tier: 'silver', xpReward: 200, condition: { metric: 'early_practice', threshold: 1 }, order: 2, hidden: true },
    { key: 'hidden_marathon', title: 'Vận động viên marathon', description: 'Hoàn thành 5 bài test trong một ngày', icon: '🏃', category: 'mastery', tier: 'gold', xpReward: 500, condition: { metric: 'tests_in_one_day', threshold: 5 }, order: 3, hidden: true },
    { key: 'hidden_perfectionist', title: 'Người cầu toàn', description: 'Đạt 100% trong 3 bài test liên tiếp', icon: '💎', category: 'mastery', tier: 'diamond', xpReward: 1500, condition: { metric: 'consecutive_perfect', threshold: 3 }, order: 4, hidden: true },
    { key: 'hidden_comeback', title: 'Trở lại ngoạn mục', description: 'Quay lại luyện tập sau 7 ngày nghỉ', icon: '🔄', category: 'mastery', tier: 'silver', xpReward: 300, condition: { metric: 'comeback_after_break', threshold: 7 }, order: 5, hidden: true },
    { key: 'hidden_all_parts', title: 'Toàn năng Speaking', description: 'Hoàn thành cả Part 1, 2 và 3 trong cùng ngày', icon: '🎭', category: 'mastery', tier: 'gold', xpReward: 500, condition: { metric: 'all_speaking_parts_one_day', threshold: 1 }, order: 6, hidden: true },
    { key: 'hidden_first_try', title: 'Lần đầu thắng lợi', description: 'Đạt Band 7+ trong bài test đầu tiên', icon: '🎯', category: 'mastery', tier: 'gold', xpReward: 750, condition: { metric: 'first_test_band7', threshold: 1 }, order: 7, hidden: true },
    { key: 'hidden_vocab_binge', title: 'Cơn khát từ vựng', description: 'Thêm 20 từ vựng trong cùng ngày', icon: '📖', category: 'mastery', tier: 'silver', xpReward: 250, condition: { metric: 'vocab_in_one_day', threshold: 20 }, order: 8, hidden: true },
    { key: 'hidden_speed_reader', title: 'Tốc đọc', description: 'Hoàn thành bài Reading trên 30 phút', icon: '⚡', category: 'mastery', tier: 'gold', xpReward: 500, condition: { metric: 'fast_reading', threshold: 1 }, order: 9, hidden: true },
    { key: 'hidden_weekend_warrior', title: 'Chiến binh cuối tuần', description: 'Luyện tập cả Thứ 7 và Chủ nhật', icon: '🛡️', category: 'mastery', tier: 'silver', xpReward: 200, condition: { metric: 'weekend_practice', threshold: 1 }, order: 10, hidden: true },
    { key: 'hidden_double_up', title: 'Nhân đôi sức mạnh', description: 'Hoàn thành cả Reading và Listening trong cùng ngày', icon: '⚔️', category: 'mastery', tier: 'silver', xpReward: 300, condition: { metric: 'reading_and_listening_same_day', threshold: 1 }, order: 11, hidden: true },
    { key: 'hidden_triple_threat', title: 'Tam đại cao thủ', description: 'Luyện cả Reading, Listening và Speaking trong cùng ngày', icon: '🔱', category: 'mastery', tier: 'gold', xpReward: 750, condition: { metric: 'three_skills_same_day', threshold: 1 }, order: 12, hidden: true },
    { key: 'hidden_quad_master', title: 'Tứ đại thần công', description: 'Luyện cả 4 kỹ năng trong cùng ngày', icon: '👑', category: 'mastery', tier: 'diamond', xpReward: 1000, condition: { metric: 'four_skills_same_day', threshold: 1 }, order: 13, hidden: true },
    { key: 'hidden_xp_surge', title: 'Bùng nổ XP', description: 'Nhận 500 XP trong cùng ngày', icon: '💥', category: 'mastery', tier: 'gold', xpReward: 500, condition: { metric: 'xp_in_one_day', threshold: 500 }, order: 14, hidden: true },
    { key: 'hidden_collector', title: 'Nhà sưu tầm bí ẩn', description: 'Mở khóa 5 thành tựu ẩn', icon: '🔮', category: 'mastery', tier: 'gold', xpReward: 750, condition: { metric: 'hidden_achievements_unlocked', threshold: 5 }, order: 15, hidden: true },
    { key: 'hidden_writing_burst', title: 'Bão viết', description: 'Nộp 3 bài viết trong cùng ngày', icon: '🌪️', category: 'mastery', tier: 'gold', xpReward: 500, condition: { metric: 'writings_in_one_day', threshold: 3 }, order: 16, hidden: true },
    { key: 'hidden_speaking_sprint', title: 'Nói không ngừng nghỉ', description: 'Hoàn thành 5 phiên nói trong cùng ngày', icon: '🎙️', category: 'mastery', tier: 'gold', xpReward: 500, condition: { metric: 'speaking_in_one_day', threshold: 5 }, order: 17, hidden: true },
    { key: 'hidden_no_mistakes', title: 'Không sai một lỗi', description: 'Đạt 40/40 câu Reading hoặc Listening', icon: '✨', category: 'mastery', tier: 'diamond', xpReward: 2000, condition: { metric: 'perfect_40', threshold: 1 }, order: 18, hidden: true },
    { key: 'hidden_full_collection', title: 'Nhà sưu tầm toàn bích', description: 'Mở khóa tất cả 20 thành tựu ẩn', icon: '🌌', category: 'mastery', tier: 'diamond', xpReward: 5000, condition: { metric: 'hidden_achievements_unlocked', threshold: 20 }, order: 19, hidden: true },
    { key: 'hidden_legend', title: 'Huyền thoại IELTS', description: 'Mở khóa 150 thành tựu', icon: '🏛️', category: 'mastery', tier: 'diamond', xpReward: 10000, condition: { metric: 'total_achievements', threshold: 150 }, order: 20, hidden: true },
];

// ─── SEED ACHIEVEMENTS ───
export const seedAchievements = async () => {
    try {
        for (const ach of ACHIEVEMENTS) {
            await Achievement.findOneAndUpdate(
                { key: ach.key },
                ach,
                { upsert: true, new: true }
            );
        }
        console.log(`✅ Seeded ${ACHIEVEMENTS.length} achievements`);
    } catch (error) {
        console.error('Error seeding achievements:', error);
    }
};

// ─── BAND SCORE CALCULATORS ───
const readingBandMap = [
    { min: 39, band: 9.0 }, { min: 37, band: 8.5 }, { min: 35, band: 8.0 },
    { min: 33, band: 7.5 }, { min: 30, band: 7.0 }, { min: 27, band: 6.5 },
    { min: 23, band: 6.0 }, { min: 19, band: 5.5 }, { min: 15, band: 5.0 },
    { min: 13, band: 4.5 }, { min: 10, band: 4.0 }, { min: 8, band: 3.5 },
    { min: 6, band: 3.0 }, { min: 4, band: 2.5 }, { min: 2, band: 2.0 },
    { min: 1, band: 1.0 }, { min: 0, band: 0 },
];

const listeningBandMap = [
    { min: 39, band: 9.0 }, { min: 37, band: 8.5 }, { min: 35, band: 8.0 },
    { min: 32, band: 7.5 }, { min: 30, band: 7.0 }, { min: 26, band: 6.5 },
    { min: 23, band: 6.0 }, { min: 18, band: 5.5 }, { min: 16, band: 5.0 },
    { min: 13, band: 4.5 }, { min: 10, band: 4.0 }, { min: 8, band: 3.5 },
    { min: 6, band: 3.0 }, { min: 4, band: 2.5 }, { min: 2, band: 2.0 },
    { min: 1, band: 1.0 }, { min: 0, band: 0 },
];

function calcBand(score, type) {
    const map = type === 'listening' ? listeningBandMap : readingBandMap;
    const entry = map.find(m => score >= m.min);
    return entry ? entry.band : 0;
}

// ─── GATHER USER METRICS ───
async function gatherMetrics(userId) {
    const userIdString = String(userId);
    const [user, progress, attempts, writingSubs, vocabCount, vocabReviewCount] = await Promise.all([
        User.findById(userId).lean(),
        StudentProgress.findOne({ userId }).lean(),
        TestAttempt.find({ user_id: userId }).lean(),
        WritingSubmission.countDocuments({ user_id: userId }),
        // Vocab added count
        (async () => {
            try {
                const Vocabulary = (await import('../models/Vocabulary.model.js')).default;
                return Vocabulary.countDocuments({ user_id: userIdString });
            } catch { return 0; }
        })(),
        // Vocab review count
        (async () => {
            try {
                const Vocabulary = (await import('../models/Vocabulary.model.js')).default;
                const vocabs = await Vocabulary.find({ user_id: userIdString }).select('review_count').lean();
                return vocabs.reduce((sum, v) => sum + (Number(v.review_count) || 0), 0);
            } catch { return 0; }
        })(),
    ]);

    if (!user) return null;

    const streak = progress?.streak || 0;
    const longestStreak = progress?.longestStreak || 0;
    const streakValue = Math.max(streak, longestStreak);

    // Test counts
    const testsCompleted = attempts.length;
    const readingCompleted = attempts.filter(a => a.type === 'reading').length;
    const listeningCompleted = attempts.filter(a => a.type === 'listening').length;

    // Best band scores
    let bestReadingBand = 0;
    let bestListeningBand = 0;
    let perfectScores = 0;
    let scoreImprovement = 0;

    const readingAttempts = attempts.filter(a => a.type === 'reading' && a.score != null).sort((a, b) => a.submitted_at - b.submitted_at);
    const listeningAttempts = attempts.filter(a => a.type === 'listening' && a.score != null).sort((a, b) => a.submitted_at - b.submitted_at);

    readingAttempts.forEach(a => {
        const band = calcBand(a.score, 'reading');
        if (band > bestReadingBand) bestReadingBand = band;
        if (a.percentage === 100) perfectScores++;
    });

    listeningAttempts.forEach(a => {
        const band = calcBand(a.score, 'listening');
        if (band > bestListeningBand) bestListeningBand = band;
        if (a.percentage === 100) perfectScores++;
    });

    // Score improvement
    const allSorted = attempts.filter(a => a.percentage != null).sort((a, b) => new Date(a.submitted_at) - new Date(b.submitted_at));
    if (allSorted.length >= 2) {
        const last = allSorted[allSorted.length - 1].percentage;
        const prev = allSorted[allSorted.length - 2].percentage;
        if (prev > 0) scoreImprovement = ((last - prev) / prev) * 100;
    }

    // Modules
    const completedModuleIds = new Set(
        (progress?.completedModules || [])
            .map((item) => item?.moduleId ? String(item.moduleId) : null)
            .filter(Boolean)
    );
    const modulesCompleted = completedModuleIds.size;
    const perfectQuizzes = (progress?.completedModules || []).filter(m => m.quizScore === 100).length;
    let allModulesCompleted = 0;
    try {
        const SkillModule = (await import('../models/SkillModule.model.js')).default;
        const activeModuleIds = (await SkillModule.find({ isActive: true }).select('_id').lean())
            .map((module) => String(module._id));
        if (activeModuleIds.length > 0 && activeModuleIds.every((moduleId) => completedModuleIds.has(moduleId))) {
            allModulesCompleted = 1;
        }
    } catch { /* ignore */ }

    // Speaking sessions (from SpeakingSession model)
    let speakingSessions = 0, speakingPart1 = 0, speakingPart2 = 0, speakingPart3 = 0;
    try {
        const SpeakingSession = (await import('../models/SpeakingSession.js')).default;
        const Speaking = (await import('../models/Speaking.model.js')).default;
        const sessions = await SpeakingSession.find({ userId, status: 'completed' }).select('questionId').lean();
        speakingSessions = sessions.length;
        // Look up part numbers from Speaking topics
        const qIds = [...new Set(sessions.map(s => s.questionId).filter(Boolean))];
        if (qIds.length > 0) {
            const topics = await Speaking.find({ _id: { $in: qIds } }).select('part').lean();
            const partMap = {};
            topics.forEach(t => { partMap[String(t._id)] = t.part; });
            sessions.forEach(s => {
                const part = partMap[String(s.questionId)];
                if (part === 1) speakingPart1++;
                else if (part === 2) speakingPart2++;
                else if (part === 3) speakingPart3++;
            });
        }
    } catch { /* SpeakingSession model may not exist */ }

    // Study plan / tasks
    let studyPlanCreated = 0, studyTasksCompleted = 0;
    try {
        const StudyPlan = (await import('../models/StudyPlan.model.js')).default;
        const StudyTaskProgress = (await import('../models/StudyTaskProgress.model.js')).default;
        studyPlanCreated = await StudyPlan.countDocuments({ userId });
        studyTasksCompleted = await StudyTaskProgress.countDocuments({ userId, status: 'completed' });
    } catch { /* models may not exist */ }

    // Vocab mastered
    let vocabMastered = 0;
    try {
        const Vocabulary = (await import('../models/Vocabulary.model.js')).default;
        vocabMastered = await Vocabulary.countDocuments({ user_id: userIdString, mastery_level: { $gte: 4 } });
    } catch { /* ignore */ }

    // Writing task breakdown
    let writingTask1 = 0, writingTask2 = 0;
    try {
        const Writing = (await import('../models/Writing.model.js')).default;
        // WritingSubmission stores task_id inside writing_answers[] sub-array
        const subs = await WritingSubmission.find({ user_id: userId }).select('writing_answers').lean();
        const taskIds = new Set();
        subs.forEach(s => (s.writing_answers || []).forEach(wa => { if (wa.task_id) taskIds.add(wa.task_id); }));
        if (taskIds.size > 0) {
            const writings = await Writing.find({ _id: { $in: [...taskIds] } }).select('task_type').lean();
            const taskMap = {};
            writings.forEach(w => { taskMap[String(w._id)] = w.task_type; });
            subs.forEach(s => (s.writing_answers || []).forEach(wa => {
                const taskType = taskMap[String(wa.task_id)];
                if (taskType === 'task1') writingTask1++;
                else if (taskType === 'task2') writingTask2++;
            }));
        }
    } catch { /* ignore */ }

    // ─── HIDDEN ACHIEVEMENT METRICS ───
    // Helper: get date string from a Date or timestamp
    const toDateStr = (d) => d ? new Date(d).toISOString().slice(0, 10) : null;

    // Time-of-day practice checks (based on latest test attempt timestamp)
    let nightPractice = 0, earlyPractice = 0;
    attempts.forEach(a => {
        const d = new Date(a.submitted_at || a.createdAt);
        const hour = d.getHours();
        if (hour >= 23 || hour < 1) nightPractice = 1;
        if (hour >= 4 && hour < 6) earlyPractice = 1;
    });

    // Tests in one day (max tests on any single day)
    const testsByDay = {};
    attempts.forEach(a => {
        const day = toDateStr(a.submitted_at || a.createdAt);
        if (day) testsByDay[day] = (testsByDay[day] || 0) + 1;
    });
    const testsInOneDay = Math.max(0, ...Object.values(testsByDay));

    // Consecutive perfect scores
    let consecutivePerfect = 0, maxConsecutivePerfect = 0;
    allSorted.forEach(a => {
        if (a.percentage === 100) {
            consecutivePerfect++;
            if (consecutivePerfect > maxConsecutivePerfect) maxConsecutivePerfect = consecutivePerfect;
        } else {
            consecutivePerfect = 0;
        }
    });

    // Comeback after break (check if there's a gap of 7+ days between activity dates)
    let comebackAfterBreak = 0;
    if (progress?.lastActivityDate && progress?.previousActivityDate) {
        // Use activity logs from progress
    }
    // Alternative: check gaps between test attempt dates
    const attemptDates = [...new Set(attempts.map(a => toDateStr(a.submitted_at || a.createdAt)).filter(Boolean))].sort();
    for (let i = 1; i < attemptDates.length; i++) {
        const diff = (new Date(attemptDates[i]) - new Date(attemptDates[i - 1])) / (1000 * 60 * 60 * 24);
        if (diff >= 7) comebackAfterBreak = Math.max(comebackAfterBreak, diff);
    }

    // All speaking parts in one day
    let allSpeakingPartsOneDay = 0;
    try {
        const SpeakingSession = (await import('../models/SpeakingSession.js')).default;
        const Speaking = (await import('../models/Speaking.model.js')).default;
        const recentSessions = await SpeakingSession.find({ userId, status: 'completed' }).select('questionId timestamp').lean();
        // Group by day, check if all 3 parts exist
        const sessionsByDay = {};
        const allQIds = [...new Set(recentSessions.map(s => s.questionId).filter(Boolean))];
        const topicMap = {};
        if (allQIds.length > 0) {
            const topics = await Speaking.find({ _id: { $in: allQIds } }).select('part').lean();
            topics.forEach(t => { topicMap[String(t._id)] = t.part; });
        }
        recentSessions.forEach(s => {
            const day = toDateStr(s.timestamp);
            const part = topicMap[String(s.questionId)];
            if (day && part) {
                if (!sessionsByDay[day]) sessionsByDay[day] = new Set();
                sessionsByDay[day].add(part);
            }
        });
        for (const parts of Object.values(sessionsByDay)) {
            if (parts.has(1) && parts.has(2) && parts.has(3)) { allSpeakingPartsOneDay = 1; break; }
        }
    } catch { /* ignore */ }

    // First test band 7+
    let firstTestBand7 = 0;
    if (allSorted.length > 0) {
        const first = allSorted[0];
        const band = calcBand(first.score || 0, first.type || 'reading');
        if (band >= 7) firstTestBand7 = 1;
    }

    // Vocab added in one day
    let vocabInOneDay = 0;
    try {
        const Vocabulary = (await import('../models/Vocabulary.model.js')).default;
        const vocabs = await Vocabulary.find({ user_id: userIdString }).select('createdAt').lean();
        const vocabByDay = {};
        vocabs.forEach(v => {
            const day = toDateStr(v.createdAt);
            if (day) vocabByDay[day] = (vocabByDay[day] || 0) + 1;
        });
        vocabInOneDay = Math.max(0, ...Object.values(vocabByDay));
    } catch { /* ignore */ }

    // Fast reading (completed in over 30 minutes)
    let fastReading = 0;
    attempts.filter(a => a.type === 'reading').forEach(a => {
        if (typeof a.time_taken_ms === 'number' && a.time_taken_ms > 30 * 60 * 1000) fastReading = 1;
    });

    // Weekend warrior (practiced both Saturday and Sunday)
    let weekendPractice = 0;
    const weekDays = new Set();
    attempts.forEach(a => {
        const d = new Date(a.submitted_at || a.createdAt);
        weekDays.add(d.getDay()); // 0=Sun, 6=Sat
    });
    if (weekDays.has(0) && weekDays.has(6)) weekendPractice = 1;

    // Reading and Listening same day
    let readingAndListeningSameDay = 0;
    const readingDays = new Set(attempts.filter(a => a.type === 'reading').map(a => toDateStr(a.submitted_at || a.createdAt)));
    const listeningDays = new Set(attempts.filter(a => a.type === 'listening').map(a => toDateStr(a.submitted_at || a.createdAt)));
    for (const day of readingDays) {
        if (listeningDays.has(day)) { readingAndListeningSameDay = 1; break; }
    }

    // Three skills same day (R + L + Speaking)
    let threeSkillsSameDay = 0;
    let speakingDaysSet = new Set();
    try {
        const SpeakingSession = (await import('../models/SpeakingSession.js')).default;
        const sDays = await SpeakingSession.find({ userId, status: 'completed' }).select('timestamp').lean();
        sDays.forEach(s => speakingDaysSet.add(toDateStr(s.timestamp)));
    } catch { /* ignore */ }
    for (const day of readingDays) {
        if (listeningDays.has(day) && speakingDaysSet.has(day)) { threeSkillsSameDay = 1; break; }
    }

    // Four skills same day (R + L + S + W)
    let fourSkillsSameDay = 0;
    const writingDays = new Set();
    try {
        const wSubs = await WritingSubmission.find({ user_id: userId }).select('submitted_at').lean();
        wSubs.forEach(w => writingDays.add(toDateStr(w.submitted_at)));
    } catch { /* ignore */ }
    for (const day of readingDays) {
        if (listeningDays.has(day) && speakingDaysSet.has(day) && writingDays.has(day)) { fourSkillsSameDay = 1; break; }
    }

    // Writings in one day
    let writingsInOneDay = 0;
    const writingsByDay = {};
    try {
        const wSubs = await WritingSubmission.find({ user_id: userId }).select('submitted_at').lean();
        wSubs.forEach(w => {
            const day = toDateStr(w.submitted_at);
            if (day) writingsByDay[day] = (writingsByDay[day] || 0) + 1;
        });
        writingsInOneDay = Math.max(0, ...Object.values(writingsByDay));
    } catch { /* ignore */ }

    // Speaking in one day
    let speakingInOneDay = 0;
    try {
        const SpeakingSession = (await import('../models/SpeakingSession.js')).default;
        const sSessions = await SpeakingSession.find({ userId, status: 'completed' }).select('timestamp').lean();
        const speakByDay = {};
        sSessions.forEach(s => {
            const day = toDateStr(s.timestamp);
            if (day) speakByDay[day] = (speakByDay[day] || 0) + 1;
        });
        speakingInOneDay = Math.max(0, ...Object.values(speakByDay));
    } catch { /* ignore */ }

    // Perfect 40/40 (score of 40 out of 40)
    let perfect40 = 0;
    attempts.forEach(a => {
        if (a.score === 40 && a.total === 40) perfect40 = 1;
    });

    // XP in one day — aggregate from XpTransaction collection
    let xpInOneDay = 0;
    try {
        const XpTransaction = (await import('../models/XpTransaction.model.js')).default;
        const xpByDay = await XpTransaction.aggregate([
            { $match: { userId: user._id } },
            { $group: { _id: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt' } }, total: { $sum: '$amount' } } },
            { $sort: { total: -1 } },
            { $limit: 1 },
        ]);
        if (xpByDay.length > 0) xpInOneDay = xpByDay[0].total;
    } catch { /* ignore */ }

    // Hidden achievements unlocked count
    const hiddenKeys = ACHIEVEMENTS.filter(a => a.hidden).map(a => a.key);
    const hiddenAchievementsUnlocked = new Set(
        (user.achievements || [])
            .map((item) => item.achievementKey)
            .filter((key) => hiddenKeys.includes(key))
    ).size;

    return {
        streak: streakValue,
        tests_completed: testsCompleted,
        reading_completed: readingCompleted,
        listening_completed: listeningCompleted,
        writings_submitted: writingSubs,
        writing_task1: writingTask1,
        writing_task2: writingTask2,
        speaking_sessions: speakingSessions,
        speaking_part1: speakingPart1,
        speaking_part2: speakingPart2,
        speaking_part3: speakingPart3,
        modules_completed: modulesCompleted,
        all_modules_completed: allModulesCompleted,
        perfect_quiz: perfectQuizzes,
        study_plan_created: studyPlanCreated,
        study_tasks_completed: studyTasksCompleted,
        reading_band: bestReadingBand,
        listening_band: bestListeningBand,
        perfect_score: perfectScores,
        score_improvement: scoreImprovement,
        all_skills_band: Math.min(bestReadingBand, bestListeningBand),
        vocab_added: vocabCount,
        vocab_reviews: vocabReviewCount,
        vocab_mastered: vocabMastered,
        total_xp: user.xp || 0,
        level: user.level || 1,
        total_achievements: user.totalAchievements || 0,
        // Hidden metrics
        night_practice: nightPractice,
        early_practice: earlyPractice,
        tests_in_one_day: testsInOneDay,
        consecutive_perfect: maxConsecutivePerfect,
        comeback_after_break: comebackAfterBreak,
        all_speaking_parts_one_day: allSpeakingPartsOneDay,
        first_test_band7: firstTestBand7,
        vocab_in_one_day: vocabInOneDay,
        fast_reading: fastReading,
        weekend_practice: weekendPractice,
        reading_and_listening_same_day: readingAndListeningSameDay,
        three_skills_same_day: threeSkillsSameDay,
        four_skills_same_day: fourSkillsSameDay,
        xp_in_one_day: xpInOneDay,
        hidden_achievements_unlocked: hiddenAchievementsUnlocked,
        writings_in_one_day: writingsInOneDay,
        speaking_in_one_day: speakingInOneDay,
        perfect_40: perfect40,
    };
}

// ─── CHECK AND UNLOCK ACHIEVEMENTS ───
export const checkAchievements = async (userId) => {
    try {
        const metrics = await gatherMetrics(userId);
        if (!metrics) return [];

        const user = await User.findById(userId).select('achievements').lean();
        if (!user) return [];

        const allAchievements = await Achievement.find({}).lean();
        const unlockedKeys = new Set((user.achievements || []).map((item) => item.achievementKey));
        const newlyUnlocked = [];

        for (const ach of allAchievements) {
            if (unlockedKeys.has(ach.key)) continue;

            const metricValue = metrics[ach.condition.metric];
            if (metricValue === undefined || metricValue === null) continue;

            if (metricValue >= ach.condition.threshold) {
                const unlockResult = await User.updateOne(
                    { _id: userId, 'achievements.achievementKey': { $ne: ach.key } },
                    { $push: { achievements: { achievementKey: ach.key, unlockedAt: new Date() } } }
                );
                if (unlockResult.modifiedCount === 0) continue;

                // Grant XP reward
                if (ach.xpReward > 0) {
                    await addXP(userId, ach.xpReward);
                }
                unlockedKeys.add(ach.key);
                newlyUnlocked.push(ach);
            }
        }

        const refreshed = await User.findById(userId).select('achievements').lean();
        const uniqueAchievementCount = new Set((refreshed?.achievements || []).map((item) => item.achievementKey)).size;
        await User.updateOne({ _id: userId }, { $set: { totalAchievements: uniqueAchievementCount } });

        return newlyUnlocked;
    } catch (error) {
        console.error('Error checking achievements:', error);
        return [];
    }
};

// ─── GET ALL DEFINITIONS ───
export const getAllAchievements = () => Achievement.find({}).sort({ category: 1, order: 1 }).lean();

// ─── GET USER ACHIEVEMENTS ───
export const getUserAchievements = async (userId) => {
    const user = await User.findById(userId).select('achievements totalAchievements').lean();
    const seen = new Set();
    return (user?.achievements || []).filter((item) => {
        if (!item?.achievementKey || seen.has(item.achievementKey)) return false;
        seen.add(item.achievementKey);
        return true;
    });
};
