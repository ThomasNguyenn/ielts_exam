import { Link } from 'react-router-dom';

export default function Home() {
  return (
    <div className="page home">
      <section className="hero">
        <h1>IELTS Practice</h1>
        <p>Take full-length Reading and Listening tests. Track your progress and improve your band score.</p>
        <Link to="/tests" className="btn btn-primary">
          Browse tests
        </Link>
      </section>
    </div>
  );
}
