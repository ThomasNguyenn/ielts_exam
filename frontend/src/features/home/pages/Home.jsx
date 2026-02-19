import { Link } from 'react-router-dom';
import { ArrowRight, BookOpenCheck, Headphones, PenSquare, Mic, Check, Play, Clock3, Target } from 'lucide-react';
import './Home.css';

const SKILL_CARDS = [
  {
    title: 'Bài tập đọc toàn diện', // dịch: 'Comprehensive Reading Practice',
    description: 'Nắm vững tất cả 14 dạng câu hỏi với các đoạn văn IELTS thực tế và lời giải thích chi tiết.',
    icon: BookOpenCheck,
    tone: 'indigo',
  },
  {
    title: 'Bài tập nghe thực tế', // dịch: 'Realistic Listening Tests',
    description: 'Thực hành với âm thanh chất lượng cao, phản ánh các điều kiện và định dạng kỳ thi thực tế.',
    icon: Headphones,
    tone: 'amber',
  },
  {
    title: 'Bài tập viết toàn diện', // dịch: ' Writing Task Mastery',
    description: 'Nhận phản hồi AI về Task 1 và Task 2 với dự đoán điểm số.',
    icon: PenSquare,
    tone: 'green',
  },
  {
    title: 'Bài tập nói thực tế', // dịch: 'Speaking Simulation', 
    description: 'Thực hành với ba phần với các gợi ý và tiêu chí đánh giá thực tế.',
    icon: Mic,
    tone: 'violet',
  },
];

const BENEFITS = [
  'Bài tập nghe thực tế', // dịch: 'Full-length practice tests with exact IELTS timing',
  'Đánh giá ngay và phân tích chi tiết', // dịch: 'Instant scoring and detailed performance analytics',
  'Ôn tập và sửa lỗi từng câu hỏi một.', // dịch
  'Theo dõi tiến trình theo kỹ năng', // dịch: 'Skill-specific progress tracking across all modules',
  'Giao diện di động cho việc luyện tập mọi lúc', // dịch: 'Mobile-responsive interface for practice anywhere',
];

const METRICS = [
  { value: '50K+', label: 'Sinh viên đã được huấn luyện' },
  { value: '10K+', label: 'Câu hỏi luyện tập' },
  { value: '7.5', label: 'Tăng điểm trung bình' },
  { value: '95%', label: 'Tỷ lệ thành công' },
];

export default function Home() {
  return (
    <div className="home-page">
      <section className="home-hero">
        <div className="home-hero-glow home-hero-glow--left" />
        <div className="home-hero-glow home-hero-glow--right" />

        <div className="home-container home-hero-grid">
          <div className="home-hero-copy">
            <div className="home-chip">AI-Powered IELTS Preparation Platform</div>
            <h1>
              Chinh phục mục tiêu
              <span>Đạt Band mong muốn</span>
            </h1>
            <p>
              Nắm vững tất cả 14 dạng câu hỏi với các đoạn văn IELTS thực tế và lời giải thích chi tiết.
            </p>

            <div className="home-hero-actions">
              <Link to="/tests" className="home-btn home-btn--primary">
                Bắt đầu luyện tập ngay
                <ArrowRight size={18} />
              </Link>
            </div>

            <div className="home-hero-stats">
              <div>
                <strong>50K+</strong>
                <span>Sinh viên đã được huấn luyện</span>
              </div>
              <div>
                <strong>10K+</strong>
                <span>Câu hỏi luyện tập</span>
              </div>
              <div>
                <strong>7.5</strong>
                <span>Tăng điểm trung bình</span>
              </div>
            </div>
          </div>

          <div className="home-preview-card">
            <div className="home-preview-head">
              <div>
                <h3>Reading Test</h3>
                <p>Section 1 of 3</p>
              </div>
              <span>
                <Clock3 size={14} />
                45:23
              </span>
            </div>

            <div className="home-preview-progress">
              <div>
                <p>Progress</p>
                <p>18/25 Questions</p>
              </div>
              <div className="home-progress-track">
                <div className="home-progress-fill" />
              </div>
            </div>

            <div className="home-preview-question">
              <h4>Question 19: Multiple Choice</h4>
              <p>According to the passage, what is the main advantage of renewable energy?</p>
              <ul>
                <li>A. Answer option text here</li>
                <li className="active">B. Answer option text here</li>
                <li>C. Answer option text here</li>
                <li>D. Answer option text here</li>
              </ul>
              <div className="home-preview-nav">
                <button type="button">Previous</button>
                <button type="button" className="active">Next</button>
              </div>
            </div>

            <div className="home-target-pill">
              <div className="icon">
                <Target size={18} />
              </div>
              <div>
                <strong>8.5</strong>
                <span>Target Band Score</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section id="features" className="home-section home-skills">
        <div className="home-container">
          <div className="home-section-head">
            <div className="home-chip home-chip--light">Tất cả kỹ năng được bao gồm</div>
            <h2>Nền tảng luyện thi IELTS toàn diện</h2>
            <p>Đảm bảo bạn có mọi thứ cần thiết để chuẩn bị cho kỳ thi IELTS, tất cả trong một nơi</p>
          </div>

          <div className="home-skill-grid">
            {SKILL_CARDS.map((item) => {
              const Icon = item.icon;
              return (
                <article key={item.title} className="home-skill-card">
                  <div className={`home-skill-icon ${item.tone}`}>
                    <Icon size={20} />
                  </div>
                  <h3>{item.title}</h3>
                  <p>{item.description}</p>
                </article>
              );
            })}
          </div>
        </div>
      </section>

      <section id="benefits" className="home-section home-benefits">
        <div className="home-container home-benefits-grid">
          <div>
            <div className="home-chip home-chip--light">Tại sao chọn IELTS Pro</div>
            <h2>
              Tất cả những gì bạn cần để
              <span>Thành công</span>
            </h2>
            <p>
              Nền tảng của chúng tôi kết hợp công nghệ tiên tiến nhất với các phương pháp chuẩn bị IELTS được chứng minh để
              cung cấp cho bạn cơ hội tốt nhất để đạt được điểm số mục tiêu của bạn.
            </p>

            <ul className="home-benefit-list">
              {BENEFITS.map((benefit) => (
                <li key={benefit}>
                  <span><Check size={14} /></span>
                  {benefit}
                </li>
              ))}
            </ul>

            <Link to="/tests" className="home-btn home-btn--primary">
              Khám phá tất cả các bài kiểm tra
              <ArrowRight size={18} />
            </Link>
          </div>

          <div className="home-metric-grid">
            {METRICS.map((metric) => (
              <article key={metric.label}>
                <strong>{metric.value}</strong>
                <span>{metric.label}</span>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section id="results" className="home-cta">
        <div className="home-container">
          <h2>Bạn đã sẵn sàng bắt đầu hành trình IELTS của mình chưa?</h2>
          <p>
            Tham gia hàng nghìn sinh viên thành công đã đạt được điểm số mục tiêu của họ với nền tảng chuẩn bị IELTS toàn diện của chúng tôi.
          </p>
          <div className="home-cta-actions">
            <Link to="/tests" className="home-btn home-btn--white">
              Bắt đầu luyện tập miễn phí
              <ArrowRight size={18} />
            </Link>
            <Link to="/analytics" className="home-btn home-btn--outline">
              Xem biểu đồ
            </Link>
          </div>
        </div>
      </section>

      <footer className="home-footer">
        <div className="home-container home-footer-grid">
          <div>
            <h3>IELTS<span>Pro</span></h3>
            <p>Đa nhất nền tảng luyện thi IELTS toàn diện cho sinh viên trên toàn cầu.</p>
          </div>
          <div>
            <h4>Platform</h4>
            <Link to="/tests">Tests</Link>
            <Link to="/analytics">Analytics</Link>
            <Link to="/profile">Profile</Link>
            <Link to="/manage">Manage</Link>
          </div>
          <div>
            <h4>Resources</h4>
            <a href="#features">Study Guide</a>
            <a href="#benefits">Practice Tips</a>
            <a href="#results">Band Scores</a>
            <a href="#features">FAQs</a>
          </div>
          <div>
            <h4>Company</h4>
            <a href="#features">About Us</a>
            <a href="#features">Contact</a>
            <a href="#features">Privacy</a>
            <a href="#features">Terms</a>
          </div>
        </div>
        <div className="home-container home-footer-bottom">
          <span>� 2026 IELTS Pro. All rights reserved.</span>
        </div>
      </footer>
    </div>
  );
}
