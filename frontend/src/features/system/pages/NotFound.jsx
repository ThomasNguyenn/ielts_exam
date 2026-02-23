import { Link } from 'react-router-dom';
import { Home, ArrowLeft, Activity } from 'lucide-react';
import './NotFound.css';

export default function NotFound() {
    return (
        <div className="not-found-container">
            <div className="not-found-content">
                <div className="not-found-animation">
                    <div className="floating-element bounce-1">
                        <Activity size={32} />
                    </div>
                    <div className="error-404-text">
                        <span>4</span>
                        <span className="zero">0</span>
                        <span>4</span>
                    </div>
                    <div className="floating-element bounce-2">
                        <span className="cute-face">૮ ˶ᵔ ᵕ ᵔ˶ ა</span>
                    </div>
                </div>

                <h1 className="not-found-title">Oops! Zero Impressions Here.</h1>
                <p className="not-found-desc">
                    We can't seem to find the page you're looking for. It might have been paused, deleted, or the URL has a typo. Let's get your progress back on track!
                </p>

                <div className="not-found-actions">
                    <button className="not-found-btn-secondary" onClick={() => window.history.back()}>
                        <ArrowLeft size={18} /> Go Back
                    </button>
                    <Link to="/" className="not-found-btn-primary">
                        <Home size={18} /> Back to Dashboard
                    </Link>
                </div>
            </div>
        </div>
    );
}
