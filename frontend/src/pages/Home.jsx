import { Link } from 'react-router-dom';
import Banner from '../components/Banner';
import './Home.css';
import BannerTwo from '../components/BannerTwo';

export default function Home() {
  return (
    <>
      <div className="home">
        <section className="hero bg-[#FFF9F1] font-inter">
          <h1 className="text-[48px] font-bold">Luyện thi IELTS Online Test miễn phí </h1>
          <p className="text-[20px] leading-[28px] w-[700px]">Luyện thi IELTS Online Test miễn phí. Trải nghiệm thi thử IELTS sát đề thi thật, với giao diện trực tuyến kèm giải thích chi tiết. Bắt đầu luyện thi ngay hôm nay để sẵn sàng chinh phục kỳ thi IELTS!</p>
          <Link to="/tests" className="btn-hero-start">
            Luyện thi ngay
          </Link>
        </section>
      </div>
      <section className="banner-section">
        <Banner />
      </section>
      <section className="banner-section">
        <BannerTwo />
      </section>
    </>

  );
}
