import { useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';
import {
  ArrowRight, BookOpenCheck, Headphones, PenSquare, Mic,
  Check, Clock3, Target, Users, HelpCircle, TrendingUp, Award
} from 'lucide-react';
import './Home.css';

const SKILL_CARDS = [
  {
    title: 'Bài tập đọc toàn diện',
    description: 'Nắm vững tất cả 14 dạng câu hỏi với các đoạn văn IELTS thực tế và lời giải thích chi tiết.',
    icon: BookOpenCheck,
    tone: 'indigo',
    link: '/tests',
  },
  {
    title: 'Bài tập nghe thực tế',
    description: 'Thực hành với âm thanh chất lượng cao, phản ánh các điều kiện và định dạng kỳ thi thực tế.',
    icon: Headphones,
    tone: 'amber',
    link: '/tests',
  },
  {
    title: 'Bài tập viết toàn diện',
    description: 'Nhận phản hồi AI về Task 1 và Task 2 với điểm số dự đoán.',
    icon: PenSquare,
    tone: 'green',
    link: '/tests',
  },
  {
    title: 'Luyện nói với AI',
    description: 'Thực hành cả ba phần Speaking với gợi ý và tiêu chí đánh giá thực tế.',
    icon: Mic,
    tone: 'violet',
    link: '/speaking',
  },
];

const BENEFITS = [
  'Bài tập nghe thực tế với thời gian thi chuẩn IELTS',
  'Đánh giá ngay và phân tích chi tiết hiệu suất',
  'Ôn tập và sửa lỗi từng câu hỏi một',
  'Theo dõi tiến trình theo từng kỹ năng',
  'Giao diện di động cho việc luyện tập mọi lúc',
];

const METRICS = [
  { value: '4', label: 'Kỹ năng IELTS', icon: BookOpenCheck, iconTone: 'indigo' },
  { value: '1000+', label: 'Câu hỏi luyện tập', icon: HelpCircle, iconTone: 'amber' },
  { value: '7.5', label: 'Tăng điểm trung bình', icon: TrendingUp, iconTone: 'green' },
  { value: 'AI', label: 'Chấm điểm thông minh', icon: Award, iconTone: 'violet' },
];

/* Scroll-reveal hook */
function useReveal() {
  const ref = useRef(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            // Reveal self and all children with .home-reveal
            entry.target.classList.add('visible');
            entry.target.querySelectorAll('.home-reveal').forEach((child) => {
              child.classList.add('visible');
            });
            observer.unobserve(entry.target);
          }
        });
      },
      { threshold: 0.12 }
    );

    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  return ref;
}

export default function Home() {
  const skillsRef = useReveal();
  const benefitsRef = useReveal();
  const ctaRef = useReveal();

  return (
    <div className="home-page">
      {/* ─── Hero ─── */}
      <section className="home-hero">
        <div className="home-hero-glow home-hero-glow--left" aria-hidden="true" />
        <div className="home-hero-glow home-hero-glow--right" aria-hidden="true" />

        <div className="home-container home-hero-grid">
          <div className="home-hero-copy">
            <div className="home-chip">AI-Powered IELTS Platform</div>
            <h1>
              Chinh phục mục tiêu
              <span>Đạt Band mong muốn</span>
            </h1>
            <p>
              Nắm vững tất cả kỹ năng IELTS với bài tập thực tế, AI chấm điểm thông minh và lộ trình cá nhân hoá.
            </p>

            <div className="home-hero-actions">
              <Link to="/tests" className="home-btn home-btn--primary">
                Bắt đầu luyện tập ngay
                <ArrowRight size={18} />
              </Link>
              <Link to="/analytics" className="home-btn home-btn--ghost">
                Xem tiến trình
              </Link>
            </div>

            <div className="home-hero-stats">
              <div>
                <strong>4</strong>
                <span>Kỹ năng IELTS</span>
              </div>
              <div>
                <strong>1000+</strong>
                <span>Câu hỏi luyện tập</span>
              </div>
              <div>
                <strong>AI</strong>
                <span>Chấm điểm thông minh</span>
              </div>
            </div>
          </div>

          {/* Preview Card */}
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
                <li>A. Save the environment</li>
                <li className="active">B. Reduce pollution</li>
                <li>C. Save money</li>
                <li>D. Create jobs</li>
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
                <span>Target Band</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ─── Skills ─── */}
      <section id="features" className="home-section home-skills" ref={skillsRef}>
        <div className="home-container home-reveal">
          <div className="home-section-head">
            <div className="home-chip home-chip--light">Tất cả kỹ năng được bao gồm</div>
            <h2>Nền tảng luyện thi IELTS toàn diện</h2>
            <p>Đảm bảo bạn có mọi thứ cần thiết để chuẩn bị cho kỳ thi IELTS, tất cả trong một nơi</p>
          </div>

          <div className="home-skill-grid">
            {SKILL_CARDS.map((item, i) => {
              const Icon = item.icon;
              return (
                <Link
                  key={item.title}
                  to={item.link}
                  className={`home-skill-card home-reveal home-reveal-delay-${i + 1}`}
                  data-tone={item.tone}
                >
                  <div className={`home-skill-icon ${item.tone}`}>
                    <Icon size={22} />
                  </div>
                  <h3>{item.title}</h3>
                  <p>{item.description}</p>
                  <span className="home-skill-arrow">
                    Bắt đầu <ArrowRight size={14} />
                  </span>
                </Link>
              );
            })}
          </div>
        </div>
      </section>

      {/* ─── Benefits ─── */}
      <section id="benefits" className="home-section home-benefits" ref={benefitsRef}>
        <div className="home-container home-benefits-grid home-reveal">
          <div>
            <div className="home-chip home-chip--light">Tại sao chọn IELTS Pro</div>
            <h2>
              Tất cả những gì bạn cần để
              <span>Thành công</span>
            </h2>
            <p>
              Nền tảng kết hợp công nghệ AI với các phương pháp chuẩn bị IELTS được chứng minh để
              giúp bạn đạt điểm số mục tiêu.
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
              Khám phá bài kiểm tra
              <ArrowRight size={18} />
            </Link>
          </div>

          <div className="home-metric-grid">
            {METRICS.map((metric, i) => {
              const Icon = metric.icon;
              return (
                <article key={metric.label} className={`home-reveal home-reveal-delay-${i + 1}`}>
                  <div className={`home-metric-icon ${metric.iconTone}`}>
                    <Icon size={22} />
                  </div>
                  <strong>{metric.value}</strong>
                  <span>{metric.label}</span>
                </article>
              );
            })}
          </div>
        </div>
      </section>

      {/* ─── CTA ─── */}
      <section id="results" className="home-cta" ref={ctaRef}>
        <div className="home-container home-reveal">
          <h2>Bạn đã sẵn sàng chinh phục IELTS?</h2>
          <p>
            Tham gia cùng hàng nghìn học viên đã đạt band mục tiêu với nền tảng luyện thi IELTS toàn diện.
          </p>
          <div className="home-cta-actions">
            <Link to="/tests" className="home-btn home-btn--white">
              Bắt đầu luyện tập miễn phí
              <ArrowRight size={18} />
            </Link>
            <Link to="/analytics" className="home-btn home-btn--outline">
              Xem biểu đồ phân tích
            </Link>
          </div>
        </div>
      </section>

      {/* ─── Footer ─── */}
      <footer className="home-footer">
        <div className="home-container home-footer-grid">
          <div>
            <h3>IELTS<span>Pro</span></h3>
            <p>Nền tảng luyện thi IELTS toàn diện với AI cho học viên trên toàn cầu.</p>
          </div>
          <div>
            <h4>Platform</h4>
            <Link to="/tests">Tests</Link>
            <Link to="/analytics">Analytics</Link>
            <Link to="/profile">Profile</Link>
            <Link to="/speaking">Speaking</Link>
          </div>
          <div>
            <h4>Resources</h4>
            <Link to="/learn">Study Guide</Link>
            <a href="#features">Practice Tips</a>
            <a href="#benefits">Band Scores</a>
            <a href="#results">FAQs</a>
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
          <span>© 2026 IELTS Pro. All rights reserved.</span>
        </div>
      </footer>
    </div>
  );
}
