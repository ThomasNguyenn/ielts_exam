import { Link } from 'react-router-dom';
import './Home.css';

export default function Home() {
  return (
    <div className="page home">
      <section className="hero">
        <h1>IELTS Practice</h1>
        <p>Thử thách bản thân với các bài thi IELTS thực tế. Theo dõi tiến trình và cải thiện điểm số của bạn.</p>
        <Link to="/tests" className="btn btn-primary">
          Xem danh sách bài thi
        </Link>
      </section>
    </div>
  );
}
