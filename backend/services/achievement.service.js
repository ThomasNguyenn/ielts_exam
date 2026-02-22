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
    const [user, progress, attempts, writingSubs, vocabCount, vocabReviewCount] = await Promise.all([
        User.findById(userId).lean(),
        StudentProgress.findOne({ userId }).lean(),
        TestAttempt.find({ user_id: userId }).lean(),
        WritingSubmission.countDocuments({ user_id: userId }),
        // Vocab added count
        (async () => {
            try {
                const Vocabulary = (await import('../models/Vocabulary.model.js')).default;
                return Vocabulary.countDocuments({ userId });
            } catch { return 0; }
        })(),
        // Vocab review count (approximate from reviewHistory length or total reviews)
        (async () => {
            try {
                const Vocabulary = (await import('../models/Vocabulary.model.js')).default;
                const vocabs = await Vocabulary.find({ userId }).select('reviewHistory').lean();
                return vocabs.reduce((sum, v) => sum + (v.reviewHistory?.length || 0), 0);
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
    const modulesCompleted = progress?.completedModules?.length || 0;
    const perfectQuizzes = (progress?.completedModules || []).filter(m => m.quizScore === 100).length;

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
        const taskProg = await StudyTaskProgress.findOne({ userId }).lean();
        studyTasksCompleted = taskProg?.completedTasks?.length || 0;
    } catch { /* models may not exist */ }

    // Vocab mastered
    let vocabMastered = 0;
    try {
        const Vocabulary = (await import('../models/Vocabulary.model.js')).default;
        vocabMastered = await Vocabulary.countDocuments({ userId, masteryLevel: { $gte: 4 } });
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
            const writings = await Writing.find({ _id: { $in: [...taskIds] } }).select('taskNumber').lean();
            const taskMap = {};
            writings.forEach(w => { taskMap[String(w._id)] = w.taskNumber; });
            subs.forEach(s => (s.writing_answers || []).forEach(wa => {
                const num = taskMap[wa.task_id];
                if (num === 1) writingTask1++;
                else if (num === 2) writingTask2++;
            }));
        }
    } catch { /* ignore */ }

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
        all_modules_completed: modulesCompleted >= 7 ? 1 : 0, // assuming 7 total modules
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
    };
}

// ─── CHECK AND UNLOCK ACHIEVEMENTS ───
export const checkAchievements = async (userId) => {
    try {
        const user = await User.findById(userId);
        if (!user) return [];

        const metrics = await gatherMetrics(userId);
        if (!metrics) return [];

        const allAchievements = await Achievement.find({}).lean();
        const unlockedKeys = new Set(user.achievements.map(a => a.achievementKey));
        const newlyUnlocked = [];

        for (const ach of allAchievements) {
            if (unlockedKeys.has(ach.key)) continue;

            const metricValue = metrics[ach.condition.metric];
            if (metricValue === undefined || metricValue === null) continue;

            if (metricValue >= ach.condition.threshold) {
                user.achievements.push({ achievementKey: ach.key, unlockedAt: new Date() });
                newlyUnlocked.push(ach);

                // Grant XP reward
                if (ach.xpReward > 0) {
                    await addXP(userId, ach.xpReward);
                }
            }
        }

        if (newlyUnlocked.length > 0) {
            user.totalAchievements = user.achievements.length;
            await user.save();
        }

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
    return user?.achievements || [];
};
