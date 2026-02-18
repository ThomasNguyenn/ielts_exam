import { Link } from 'react-router-dom';
import { Clock, HelpCircle, ArrowRight, Layers } from 'lucide-react';
import './TestCard.css';

function getTestTypeLabel(type) {
    switch (type) {
        case 'reading': return 'Reading';
        case 'listening': return 'Listening';
        case 'writing': return 'Writing';
        case 'speaking': return 'Speaking';
        default: return 'Test';
    }
}

function getTestDescription(test) {
    const readingCount = test.reading_passages?.length || 0;
    const listeningCount = test.listening_sections?.length || 0;
    const writingCount = test.writing_tasks?.length || 0;
    const type = test.type || 'reading';

    if (type === 'reading' && readingCount > 0) return `${readingCount} passage${readingCount !== 1 ? 's' : ''}`;
    if (type === 'listening' && listeningCount > 0) return `${listeningCount} section${listeningCount !== 1 ? 's' : ''}`;
    if (type === 'writing' && writingCount > 0) return `${writingCount} task${writingCount !== 1 ? 's' : ''}`;

    if (readingCount > 0) return `${readingCount} passage${readingCount !== 1 ? 's' : ''}`;
    if (listeningCount > 0) return `${listeningCount} section${listeningCount !== 1 ? 's' : ''}`;
    if (writingCount > 0) return `${writingCount} task${writingCount !== 1 ? 's' : ''}`;
    return 'Empty test';
}

function getTotalQuestions(test) {
    let total = 0;
    test.reading_passages?.forEach(p => { total += p.questions?.length || 0; });
    test.listening_sections?.forEach(s => { total += s.questions?.length || 0; });
    if (test.writing_tasks) total += test.writing_tasks.length;
    return total;
}

function getDuration(type) {
    if (type === 'reading') return '60 min';
    if (type === 'listening') return '30 min';
    if (type === 'writing') return '60 min';
    return '—';
}

function calculateIELTSBand(correctCount, testType) {
    const bands = {
        listening: [
            { min: 39, band: 9.0 }, { min: 37, band: 8.5 }, { min: 35, band: 8.0 },
            { min: 32, band: 7.5 }, { min: 30, band: 7.0 }, { min: 26, band: 6.5 },
            { min: 23, band: 6.0 }, { min: 18, band: 5.5 }, { min: 16, band: 5.0 },
            { min: 13, band: 4.5 }, { min: 10, band: 4.0 }, { min: 8, band: 3.5 },
            { min: 6, band: 3.0 }, { min: 4, band: 2.5 }, { min: 2, band: 2.0 },
            { min: 1, band: 1.0 }, { min: 0, band: 0 },
        ],
        reading: [
            { min: 39, band: 9.0 }, { min: 37, band: 8.5 }, { min: 35, band: 8.0 },
            { min: 33, band: 7.5 }, { min: 30, band: 7.0 }, { min: 27, band: 6.5 },
            { min: 23, band: 6.0 }, { min: 19, band: 5.5 }, { min: 15, band: 5.0 },
            { min: 13, band: 4.5 }, { min: 10, band: 4.0 }, { min: 8, band: 3.5 },
            { min: 6, band: 3.0 }, { min: 4, band: 2.5 }, { min: 2, band: 2.0 },
            { min: 1, band: 1.0 }, { min: 0, band: 0 },
        ],
    };
    const typeBands = bands[testType] || bands.reading;
    for (const b of typeBands) {
        if (correctCount >= b.min) return b.band;
    }
    return 0;
}

function formatDate(val) {
    if (!val) return '--';
    const d = new Date(val);
    if (Number.isNaN(d.getTime())) return '--';
    return d.toLocaleDateString();
}

/**
 * Full test card — used in "Full Test" view mode
 */
export function TestCard({ test, attemptData, isLoggedIn }) {
    const type = test.type || 'reading';
    const category = (test.category || '').trim() || 'Uncategorized';
    const totalQ = getTotalQuestions(test);
    const duration = getDuration(type);
    const bestAttempt = attemptData?.best;
    const canShowBand = bestAttempt?.total && (type === 'reading' || type === 'listening');
    const band = canShowBand ? calculateIELTSBand(bestAttempt.score, type) : null;

    return (
        <div className="tc">
            {/* Title */}
            <h3 className="tc-title">{test.title}</h3>

            {/* Skill Tags */}
            <div className="tc-skills">
                <span className="tc-type-badge" data-skill={type}>{getTestTypeLabel(type)}</span>
                <span className="tc-category-badge">📁 {category}</span>
                {canShowBand && (
                    <span className="tc-best-badge">🏆 {band.toFixed(1)}</span>
                )}
            </div>

            {/* Meta Row */}
            <div className="tc-meta">

            </div>

            {/* Description */}
            {/* <p className="tc-description">{getTestDescription(test)}</p> */}

            {/* Attempts */}
            {isLoggedIn && (
                <div className="tc-attempts">
                    <p>
                        {attemptData?.latest?.total
                            ? `Latest: ${attemptData.latest.score}/${attemptData.latest.total} (${attemptData.latest.percentage ?? Math.round((attemptData.latest.score / attemptData.latest.total) * 100)}%)`
                            : `Latest: 0/${totalQ} (0%)`}
                    </p>
                    <p>
                        {attemptData?.best?.total
                            ? `Best: ${attemptData.best.score}/${attemptData.best.total} (${attemptData.best.percentage ?? Math.round((attemptData.best.score / attemptData.best.total) * 100)}%)`
                            : `Best: 0/${totalQ} (0%)`}
                    </p>
                </div>
            )}

            {/* Action Buttons */}
            <div className="tc-actions">
                <Link to={`/tests/${test._id}`} className="tc-btn-primary">
                    Start Test
                    <ArrowRight />
                </Link>
                {isLoggedIn && (
                    <Link to={`/tests/${test._id}/history`} className="tc-btn-secondary">
                        <Layers />
                        History
                    </Link>
                )}
            </div>
        </div>
    );
}

/**
 * Part card — used in "By Parts" view mode
 */
export function PartCard({ part }) {
    const type = part.type || 'reading';

    return (
        <div className="tc">
            {/* Title */}
            <h3 className="tc-title">{part.title}</h3>

            {/* Skill Tags */}
            <div className="tc-skills">
                <span className="tc-skill-tag" data-skill={type}>
                    {part.label}
                </span>
            </div>

            {/* Badges */}
            <div className="tc-meta">
                <span className="tc-type-badge" data-skill={type}>{part.label}</span>
                <span className="tc-category-badge">📁 {part.category}</span>
            </div>

            {/* Subtitle */}
            <p className="tc-subtitle">
                From: <strong>{part.testTitle}</strong>
            </p>

            {/* Action */}
            <div className="tc-actions">
                <Link
                    to={`/tests/${part.testId}/exam?part=${part.partIndex}&mode=single`}
                    className="tc-btn-primary"
                >
                    Start Part
                    <ArrowRight />
                </Link>
            </div>
        </div>
    );
}
