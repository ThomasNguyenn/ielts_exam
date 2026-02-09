import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../api/client';
import './TestList.css';

function getTestDescription(test) {
  const readingCount = test.reading_passages?.length || 0;
  const listeningCount = test.listening_sections?.length || 0;
  const writingCount = test.writing_tasks?.length || 0;

  const type = test.type || 'reading';

  if (type === 'reading' && readingCount > 0) {
    return `Reading · ${readingCount} passage${readingCount !== 1 ? 's' : ''}`;
  }
  if (type === 'listening' && listeningCount > 0) {
    return `Listening · ${listeningCount} section${listeningCount !== 1 ? 's' : ''}`;
  }
  if (type === 'writing' && writingCount > 0) {
    return `Writing · ${writingCount} task${writingCount !== 1 ? 's' : ''}`;
  }

  // Fallback based on available data
  if (readingCount > 0) {
    return `Reading · ${readingCount} passage${readingCount !== 1 ? 's' : ''}`;
  }
  if (listeningCount > 0) {
    return `Listening · ${listeningCount} section${listeningCount !== 1 ? 's' : ''}`;
  }
  if (writingCount > 0) {
    return `Writing · ${writingCount} task${writingCount !== 1 ? 's' : ''}`;
  }

  return 'Empty test';
}

function getTestTypeLabel(type) {
  switch (type) {
    case 'reading':
      return 'Reading Test';
    case 'listening':
      return 'Listening Test';
    case 'writing':
      return 'Writing Test';
    default:
      return 'Test';
  }
}

function calculateIELTSBand(correctCount, testType) {
  const bands = {
    listening: [
      { min: 39, band: 9.0 },
      { min: 37, band: 8.5 },
      { min: 35, band: 8.0 },
      { min: 32, band: 7.5 },
      { min: 30, band: 7.0 },
      { min: 26, band: 6.5 },
      { min: 23, band: 6.0 },
      { min: 18, band: 5.5 },
      { min: 16, band: 5.0 },
      { min: 13, band: 4.5 },
      { min: 10, band: 4.0 },
      { min: 8, band: 3.5 },
      { min: 6, band: 3.0 },
      { min: 4, band: 2.5 },
      { min: 2, band: 2.0 },
      { min: 1, band: 1.0 },
      { min: 0, band: 0 },
    ],
    reading: [
      { min: 39, band: 9.0 },
      { min: 37, band: 8.5 },
      { min: 35, band: 8.0 },
      { min: 33, band: 7.5 },
      { min: 30, band: 7.0 },
      { min: 27, band: 6.5 },
      { min: 23, band: 6.0 },
      { min: 19, band: 5.5 },
      { min: 15, band: 5.0 },
      { min: 13, band: 4.5 },
      { min: 10, band: 4.0 },
      { min: 8, band: 3.5 },
      { min: 6, band: 3.0 },
      { min: 4, band: 2.5 },
      { min: 2, band: 2.0 },
      { min: 1, band: 1.0 },
      { min: 0, band: 0 },
    ],
  };

  const typeBands = bands[testType] || bands.reading;
  for (const b of typeBands) {
    if (correctCount >= b.min) return b.band;
  }
  return 0;
}

export default function TestList() {
  const [tests, setTests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [selectedPartFilter, setSelectedPartFilter] = useState('all');
  const [selectedType, setSelectedType] = useState('all');
  const [viewMode, setViewMode] = useState('full'); // 'full' | 'parts'
  const [searchQuery, setSearchQuery] = useState('');
  const [attemptSummary, setAttemptSummary] = useState({});
  const isLoggedIn = api.isAuthenticated();

  useEffect(() => {
    setSelectedCategory('all');
    setSelectedPartFilter('all');
  }, [selectedType]);

  useEffect(() => {
    setLoading(true);
    setError(null);
    api
      .getTests()
      .then((res) => setTests(res.data || []))
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));

    if (isLoggedIn) {
      api
        .getMyAttemptSummary()
        .then((attemptsRes) => {
          const map = {};
          (attemptsRes.data || []).forEach((row) => {
            map[row.test_id] = row;
          });
          setAttemptSummary(map);
        })
        .catch(() => { });
    }
  }, [isLoggedIn]);

  if (loading) return <div className="page"><p className="muted">Loading tests…</p></div>;
  if (error) return <div className="page"><p className="error">Error: {error}</p></div>;

  const getCategory = (test) => (test.category || '').trim() || 'Uncategorized';
  const getType = (test) => (test.type || 'reading');
  const matchesType = (test) => selectedType === 'all' || getType(test) === selectedType;

  // Primary filtering of tests
  const typeFilteredTests = tests.filter(matchesType);
  const filteredTests = typeFilteredTests
    .filter((test) => selectedCategory === 'all' || getCategory(test) === selectedCategory)
    .filter((test) => {
      if (!searchQuery.trim()) return true;
      const query = searchQuery.toLowerCase();
      return (
        test.title.toLowerCase().includes(query) ||
        test._id.toLowerCase().includes(query) ||
        getCategory(test).toLowerCase().includes(query) ||
        getType(test).toLowerCase().includes(query)
      );
    });

  // [Skipping to filteredParts logic]
  // We need to inject the logic into the calculation block

  // Calculate stats for categories based on View Mode
  let categories = [];
  let categoryCounts = {};
  let groupedTests = {};
  let flattenedParts = [];

  if (viewMode === 'full') {
    // ... [Same as before] ...
    categories = Array.from(new Set(typeFilteredTests.map(getCategory))).sort((a, b) => a.localeCompare(b));
    categoryCounts = categories.reduce((acc, cat) => {
      acc[cat] = typeFilteredTests.filter((t) => getCategory(t) === cat).length;
      return acc;
    }, {});

    groupedTests = filteredTests.reduce((acc, test) => {
      const cat = getCategory(test);
      if (!acc[cat]) acc[cat] = [];
      acc[cat].push(test);
      return acc;
    }, {});
  } else {
    // Flatten parts
    filteredTests.forEach(test => {
      const cat = getCategory(test);

      // Reading Passages
      if (test.type === 'reading' && test.reading_passages) {
        test.reading_passages.forEach((p, index) => {
          flattenedParts.push({
            uniqueId: `${test._id}_p${index}`,
            testId: test._id,
            title: p.title || `Passage ${index + 1}`,
            testTitle: test.title,
            category: cat,
            type: 'reading',
            partIndex: index,
            label: `Passage ${index + 1}`
          });
        });
      }

      // Listening Sections
      if (test.type === 'listening' && test.listening_sections) {
        test.listening_sections.forEach((s, index) => {
          flattenedParts.push({
            uniqueId: `${test._id}_s${index}`,
            testId: test._id,
            title: s.title || `Section ${index + 1}`,
            testTitle: test.title,
            category: cat,
            type: 'listening',
            partIndex: index,
            label: `Section ${index + 1}`
          });
        });
      }
      // Writing Tasks
      if (test.type === 'writing' && test.writing_tasks) {
        test.writing_tasks.forEach((w, index) => {
          flattenedParts.push({
            uniqueId: `${test._id}_w${index}`,
            testId: test._id,
            title: w.title,
            testTitle: test.title,
            category: cat,
            type: 'writing',
            partIndex: index,
            label: `Task ${index + 1}`
          });
        });
      }
    });

    // APPLY PART FILTER
    if (selectedPartFilter !== 'all') {
      const targetIndex = parseInt(selectedPartFilter.replace('part', '')) - 1;
      flattenedParts = flattenedParts.filter(p => p.partIndex === targetIndex);
    }

    // Re-calculate categories based on parts
    categories = Array.from(new Set(flattenedParts.map(p => p.category))).sort();
    categoryCounts = categories.reduce((acc, cat) => {
      acc[cat] = flattenedParts.filter(p => p.category === cat).length;
      return acc;
    }, {});

    // Group parts
    groupedTests = flattenedParts.reduce((acc, part) => {
      if (!acc[part.category]) acc[part.category] = [];
      acc[part.category].push(part);
      return acc;
    }, {});
  }

  const formatDate = (val) => {
    if (!val) return '--';
    const d = new Date(val);
    if (Number.isNaN(d.getTime())) return '--';
    return d.toLocaleDateString();
  };

  return (
    <div className="page test-list">
      <h1>Danh sách bài thi</h1>
      <div className="test-list-layout">
        <aside className="test-sidebar">
          <h2>Chế độ xem</h2>
          <div className="view-mode-toggle">
            <button
              className={`btn-mode ${viewMode === 'full' ? 'active' : ''}`}
              onClick={() => setViewMode('full')}
            >
              Trọn bộ (Full)
            </button>
            <button
              className={`btn-mode ${viewMode === 'parts' ? 'active' : ''}`}
              onClick={() => setViewMode('parts')}
            >
              Theo phần (Parts)
            </button>
          </div>

          <h2>Lọc theo kỹ năng</h2>
          <div className="filter-group">
            {['all', 'reading', 'listening', 'writing'].map((type) => (
              <label key={type} className="filter-option">
                <input
                  type="radio"
                  name="test-type-filter"
                  value={type}
                  checked={selectedType === type}
                  onChange={() => setSelectedType(type)}
                />
                <span>{type === 'all' ? 'All skills' : type[0].toUpperCase() + type.slice(1)}</span>
              </label>
            ))}
          </div>

          {viewMode === 'parts' && selectedType !== 'all' && (
            <>
              <h2>Filter by Part</h2>
              <div className="filter-group">
                {(() => {
                  let options = [
                    { value: 'all', label: 'All Parts' },
                    { value: 'part1', label: 'Part 1' },
                    { value: 'part2', label: 'Part 2' },
                    { value: 'part3', label: 'Part 3' },
                    { value: 'part4', label: 'Part 4' },
                  ];

                  if (selectedType === 'reading') {
                    options = [
                      { value: 'all', label: 'All Passages' },
                      { value: 'part1', label: 'Passage 1' },
                      { value: 'part2', label: 'Passage 2' },
                      { value: 'part3', label: 'Passage 3' },
                    ];
                  } else if (selectedType === 'listening') {
                    options = [
                      { value: 'all', label: 'All Sections' },
                      { value: 'part1', label: 'Section 1' },
                      { value: 'part2', label: 'Section 2' },
                      { value: 'part3', label: 'Section 3' },
                      { value: 'part4', label: 'Section 4' },
                    ];
                  } else if (selectedType === 'writing') {
                    options = [
                      { value: 'all', label: 'All Tasks' },
                      { value: 'part1', label: 'Task 1' },
                      { value: 'part2', label: 'Task 2' },
                    ];
                  }

                  return options.map((opt) => (
                    <label key={opt.value} className="filter-option">
                      <input
                        type="radio"
                        name="part-filter"
                        value={opt.value}
                        checked={selectedPartFilter === opt.value}
                        onChange={() => setSelectedPartFilter(opt.value)}
                      />
                      <span>{opt.label}</span>
                    </label>
                  ));
                })()}
              </div>
            </>
          )}
        </aside>

        <section className="test-main">
          {/* Search box */}
          <div className="test-search-box">
            <input
              type="search"
              className="test-search-input"
              placeholder={viewMode === 'full' ? "Search tests..." : "Search passages/sections..."}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
            {searchQuery && (
              <button
                className="search-clear-btn"
                onClick={() => setSearchQuery('')}
                aria-label="Clear search"
              >
                x
              </button>
            )}
          </div>

          {/* Category filter buttons */}
          <div className="test-category-filter">
            <button
              className={`category-btn ${selectedCategory === 'all' ? 'active' : ''}`}
              onClick={() => setSelectedCategory('all')}
            >
              All {viewMode === 'full' ? 'Tests' : 'Parts'} ({viewMode === 'full' ? typeFilteredTests.length : flattenedParts.length})
            </button>
            {categories.map((cat) => (
              <button
                key={cat}
                className={`category-btn ${selectedCategory === cat ? 'active' : ''}`}
                onClick={() => setSelectedCategory(cat)}
              >
                {cat} ({categoryCounts[cat] || 0})
              </button>
            ))}
          </div>

          {Object.keys(groupedTests).length === 0 ? (
            <p className="muted">
              {selectedCategory === 'all'
                ? `No ${viewMode === 'full' ? 'tests' : 'parts'} found.`
                : `No content available in "${selectedCategory}".`}
            </p>
          ) : (
            Object.keys(groupedTests)
              .sort((a, b) => a.localeCompare(b))
              .map((cat) => (
                <div key={cat} className="test-category-group">
                  <h2>{cat}</h2>
                  <ul className="test-cards">
                    {groupedTests[cat].map((item) => {
                      // FULL TEST RENDER
                      if (viewMode === 'full') {
                        const test = item;
                        const bestAttempt = attemptSummary[test._id]?.best;
                        const canShowBand = bestAttempt?.total && (test.type === 'reading' || test.type === 'listening');
                        const band = canShowBand ? calculateIELTSBand(bestAttempt.score, test.type) : null;

                        return (
                          <li key={test._id} className="test-card" data-type={test.type}>
                            <div className="test-card-header">
                              <h3>{test.title}</h3>
                              <span className="test-type-badge">{getTestTypeLabel(test.type)}</span>
                              {canShowBand && (
                                <span className="test-best-badge">
                                  {band.toFixed(1)}
                                </span>
                              )}
                            </div>
                            <p className="muted">
                              {getTestDescription(test)}
                            </p>
                            {isLoggedIn && (
                              <div className="test-attempts">
                                <p className="muted test-latest-score">
                                  {attemptSummary[test._id]?.latest?.total
                                    ? `Latest: ${attemptSummary[test._id].latest.score}/${attemptSummary[test._id].latest.total} (${attemptSummary[test._id].latest.percentage ?? Math.round((attemptSummary[test._id].latest.score / attemptSummary[test._id].latest.total) * 100)}%)`
                                    : attemptSummary[test._id]?.latest
                                      ? 'Latest: submitted'
                                      : 'Latest: --'}
                                  <span className="test-attempt-date">
                                    {attemptSummary[test._id]?.latest?.submitted_at ? ` • ${formatDate(attemptSummary[test._id].latest.submitted_at)}` : ''}
                                  </span>
                                </p>
                                <p className="muted test-best-score">
                                  {attemptSummary[test._id]?.best?.total
                                    ? `Best: ${attemptSummary[test._id].best.score}/${attemptSummary[test._id].best.total} (${attemptSummary[test._id].best.percentage ?? Math.round((attemptSummary[test._id].best.score / attemptSummary[test._id].best.total) * 100)}%)`
                                    : 'Best: --'}
                                </p>
                              </div>
                            )}
                            <div className="test-card-actions">
                              <Link to={`/tests/${test._id}`} className="btn-sidebar-start">
                                Làm bài ngay
                              </Link>
                              {isLoggedIn && (
                                <Link to={`/tests/${test._id}/history`} className="btn btn-ghost">
                                  Lịch sử
                                </Link>
                              )}
                            </div>
                          </li>
                        );
                      }

                      // SINGLE PART RENDER
                      else {
                        const part = item;
                        return (
                          <li key={part.uniqueId} className="test-card" data-type={part.type}>
                            <div className="test-card-header">
                              <h3>{part.title}</h3>
                              <span className="test-type-badge">{part.label}</span>
                            </div>
                            <p className="muted">
                              Thuộc bài thi: <strong>{part.testTitle}</strong>
                            </p>
                            <div className="test-card-actions">
                              <Link
                                to={`/tests/${part.testId}/exam?part=${part.partIndex}&mode=single`}
                                className="btn-sidebar-start"
                              >
                                Làm bài ngay
                              </Link>
                            </div>
                          </li>
                        );
                      }
                    })}
                  </ul>
                </div>
              ))
          )}
        </section>
      </div >
    </div >
  );
}