import { useEffect, useState } from 'react';
import { api } from '@/shared/api/client';
import { Sparkles, Search, SlidersHorizontal } from 'lucide-react';
import TestCardSkeleton from '@/shared/components/TestCardSkeleton';
import PaginationControls from '@/shared/components/PaginationControls';
import { TestCard, PartCard } from '@/features/tests/components/TestCard';
import TestSidebar from '@/features/tests/components/TestSidebar';
import { canonicalizeQuestionGroupType, getQuestionGroupLabel } from '@/features/tests/utils/questionGroupLabels';
import { getWritingTaskTypeLabel, getWritingTaskTypeOptions } from '@/shared/constants/writingTaskTypes';
import './TestList.css';

const PAGE_SIZE = 12;



export default function TestList() {
  const [tests, setTests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isFetching, setIsFetching] = useState(false);
  const [error, setError] = useState(null);
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [selectedPartFilter, setSelectedPartFilter] = useState('all');
  const [selectedQuestionGroupFilter, setSelectedQuestionGroupFilter] = useState('all');
  const [selectedTaskVariantFilter, setSelectedTaskVariantFilter] = useState('all');
  const [selectedType, setSelectedType] = useState('all');
  const [viewMode, setViewMode] = useState('full'); // 'full' | 'parts'
  const [searchInput, setSearchInput] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [attemptSummary, setAttemptSummary] = useState({});
  const [currentPage, setCurrentPage] = useState(1);
  const [pagination, setPagination] = useState(null);
  const [allCategoryCounts, setAllCategoryCounts] = useState({});
  const [overallTotalTests, setOverallTotalTests] = useState(null);
  const isLoggedIn = api.isAuthenticated();

  useEffect(() => {
    if (searchInput === searchQuery) return;

    const timer = setTimeout(() => {
      setSearchQuery(searchInput);
      setCurrentPage(1);
    }, 350);

    return () => clearTimeout(timer);
  }, [searchInput, searchQuery]);

  useEffect(() => {
    setSelectedCategory('all');
    setSelectedPartFilter('all');
    setSelectedQuestionGroupFilter('all');
    setSelectedTaskVariantFilter('all');
    setCurrentPage(1);
  }, [selectedType]);

  useEffect(() => {
    if (viewMode === 'parts') return;
    setSelectedQuestionGroupFilter('all');
    setSelectedTaskVariantFilter('all');
  }, [viewMode]);

  useEffect(() => {
    setError(null);
    if (!loading) setIsFetching(true);

    api
      .getTests({
        page: currentPage,
        limit: PAGE_SIZE,
        type: selectedType !== 'all' ? selectedType : undefined,
        category: selectedCategory !== 'all' ? selectedCategory : undefined,
        q: searchQuery.trim() || undefined,
        includeQuestionGroupTypes: true,
      })
      .then((res) => {
        setTests(res.data || []);
        setPagination(res.pagination || null);
      })
      .catch((err) => setError(err.message))
      .finally(() => {
        setLoading(false);
        setIsFetching(false);
      });
  }, [currentPage, selectedType, selectedCategory, searchQuery]);

  useEffect(() => {
    let isMounted = true;

    api
      .getTestCategories({
        type: selectedType !== 'all' ? selectedType : undefined,
        q: searchQuery.trim() || undefined,
      })
      .then((res) => {
        if (!isMounted) return;

        const counts = (res.data || []).reduce((acc, row) => {
          const category = (row?.category || '').trim() || 'Uncategorized';
          acc[category] = Number(row?.count || 0);
          return acc;
        }, {});

        setAllCategoryCounts(counts);
      })
      .catch(() => {
        if (!isMounted) return;
        setAllCategoryCounts({});
      });

    return () => {
      isMounted = false;
    };
  }, [selectedType, searchQuery]);

  useEffect(() => {
    if (!isLoggedIn) return;

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
  }, [isLoggedIn]);

  useEffect(() => {
    let isMounted = true;

    api
      .getTests({ page: 1, limit: 1 })
      .then((res) => {
        if (!isMounted) return;
        setOverallTotalTests(Number(res?.pagination?.totalItems || 0));
      })
      .catch(() => {
        if (!isMounted) return;
        setOverallTotalTests(null);
      });

    return () => {
      isMounted = false;
    };
  }, []);

  useEffect(() => {
    const canUseQuestionGroupFilter = viewMode === 'parts' && (selectedType === 'reading' || selectedType === 'listening');
    if (!canUseQuestionGroupFilter) {
      if (selectedQuestionGroupFilter !== 'all') {
        setSelectedQuestionGroupFilter('all');
      }
      return;
    }

    const query = searchQuery.trim().toLowerCase();
    const targetPartIndex = selectedPartFilter === 'all'
      ? null
      : Number.parseInt(selectedPartFilter.replace('part', ''), 10) - 1;
    const availableTypes = new Set();

    tests.forEach((test) => {
      const type = test.type || 'reading';
      const category = (test.category || '').trim() || 'Uncategorized';

      if (selectedType !== 'all' && type !== selectedType) return;
      if (selectedCategory !== 'all' && category !== selectedCategory) return;

      if (query) {
        const matchesQuery =
          test.title.toLowerCase().includes(query) ||
          test._id.toLowerCase().includes(query) ||
          category.toLowerCase().includes(query) ||
          type.toLowerCase().includes(query);
        if (!matchesQuery) return;
      }

      const parts = type === 'reading'
        ? (test.reading_passages || [])
        : (type === 'listening' ? (test.listening_sections || []) : []);

      parts.forEach((part, index) => {
        if (targetPartIndex !== null && index !== targetPartIndex) return;
        (part?.question_groups || []).forEach((group) => {
          const canonicalType = canonicalizeQuestionGroupType(group?.type);
          if (canonicalType) availableTypes.add(canonicalType);
        });
      });
    });

    if (selectedQuestionGroupFilter !== 'all' && !availableTypes.has(selectedQuestionGroupFilter)) {
      setSelectedQuestionGroupFilter('all');
    }
  }, [
    selectedCategory,
    selectedPartFilter,
    selectedQuestionGroupFilter,
    selectedType,
    searchQuery,
    tests,
    viewMode,
  ]);

  if (loading) {
    return (
      <div className="page test-list">
        <div className="test-list-layout">
          {/* Skeleton Sidebar */}
          <aside className="test-sidebar">
            <div className="h-6 bg-gray-200 rounded w-1/3 mb-4 animate-pulse"></div>
            <div className="h-10 bg-gray-200 rounded-lg mb-8 animate-pulse"></div>

            <div className="h-6 bg-gray-200 rounded w-1/2 mb-4 animate-pulse"></div>
            <div className="space-y-3 mb-8">
              {[1, 2, 3, 4].map(i => (
                <div key={i} className="h-8 bg-gray-200 rounded-lg w-full animate-pulse"></div>
              ))}
            </div>
          </aside>

          {/* Skeleton Main Content */}
          <section className="test-main">
            {/* Skeleton Search */}
            <div className="test-search-box mb-8">
              <div className="h-14 bg-gray-200 rounded-2xl w-full animate-pulse"></div>
            </div>

            {/* Skeleton Filters */}
            <div className="flex gap-3 mb-10 overflow-hidden">
              {[1, 2, 3, 4].map(i => (
                <div key={i} className="h-9 w-32 bg-gray-200 rounded-full animate-pulse"></div>
              ))}
            </div>

            {/* Skeleton Grid */}
            <div className="test-cards">
              {[1, 2, 3, 4, 5, 6].map((n) => (
                <TestCardSkeleton key={n} />
              ))}
            </div>
          </section>
        </div>
      </div>
    );
  }
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
  let questionGroupOptions = [{ value: 'all', label: 'All Question Groups' }];
  let taskVariantOptions = [{ value: 'all', label: 'All Task Variants' }];
  const canUseQuestionGroupFilter = viewMode === 'parts' && (selectedType === 'reading' || selectedType === 'listening');

  if (viewMode === 'full') {
    const fallbackCategoryCounts = typeFilteredTests.reduce((acc, test) => {
      const cat = getCategory(test);
      acc[cat] = (acc[cat] || 0) + 1;
      return acc;
    }, {});
    const hasAllCategoriesData = Object.keys(allCategoryCounts).length > 0;
    categoryCounts = hasAllCategoriesData ? { ...allCategoryCounts } : fallbackCategoryCounts;

    if (selectedCategory !== 'all' && categoryCounts[selectedCategory] === undefined) {
      categoryCounts[selectedCategory] = 0;
    }

    categories = Object.keys(categoryCounts).sort((a, b) => a.localeCompare(b));

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
          const questionGroupTypes = Array.from(
            new Set(
              (p?.question_groups || [])
                .map((group) => canonicalizeQuestionGroupType(group?.type))
                .filter(Boolean)
            )
          );
          flattenedParts.push({
            uniqueId: `${test._id}_p${index}`,
            testId: test._id,
            title: p.title || `Passage ${index + 1}`,
            testTitle: test.title,
            category: cat,
            type: 'reading',
            partIndex: index,
            label: `Passage ${index + 1}`,
            questionGroupTypes,
          });
        });
      }

      // Listening Sections
      if (test.type === 'listening' && test.listening_sections) {
        test.listening_sections.forEach((s, index) => {
          const questionGroupTypes = Array.from(
            new Set(
              (s?.question_groups || [])
                .map((group) => canonicalizeQuestionGroupType(group?.type))
                .filter(Boolean)
            )
          );
          flattenedParts.push({
            uniqueId: `${test._id}_s${index}`,
            testId: test._id,
            title: s.title || `Section ${index + 1}`,
            testTitle: test.title,
            category: cat,
            type: 'listening',
            partIndex: index,
            label: `Section ${index + 1}`,
            questionGroupTypes,
          });
        });
      }
      // Writing Tasks
      if (test.type === 'writing' && test.writing_tasks) {
        test.writing_tasks.forEach((w, index) => {
          const taskType = String(w?.task_type || '').toLowerCase();
          const taskVariant = String(w?.writing_task_type || '').trim();
          flattenedParts.push({
            uniqueId: `${test._id}_w${index}`,
            testId: test._id,
            title: w.title,
            testTitle: test.title,
            category: cat,
            type: 'writing',
            partIndex: index,
            label: `Task ${index + 1}`,
            taskType,
            taskVariant,
            questionGroupTypes: [],
          });
        });
      }
    });

    // APPLY PART FILTER
    if (selectedPartFilter !== 'all') {
      const targetIndex = parseInt(selectedPartFilter.replace('part', '')) - 1;
      flattenedParts = flattenedParts.filter(p => p.partIndex === targetIndex);
    }

    if (canUseQuestionGroupFilter) {
      const availableTypes = Array.from(
        new Set(flattenedParts.flatMap((part) => part.questionGroupTypes || []))
      ).sort((a, b) => getQuestionGroupLabel(a).localeCompare(getQuestionGroupLabel(b)));

      questionGroupOptions = [
        { value: 'all', label: 'All Question Groups' },
        ...availableTypes.map((value) => ({ value, label: getQuestionGroupLabel(value) })),
      ];

      if (selectedQuestionGroupFilter !== 'all') {
        flattenedParts = flattenedParts.filter((part) =>
          (part.questionGroupTypes || []).includes(selectedQuestionGroupFilter)
        );
      }
    }

    if (selectedType === 'writing') {
      const selectedTaskType = selectedPartFilter === 'part2' ? 'task2' : 'task1';
      const availableWritingVariants = Array.from(
        new Set(
          flattenedParts
            .filter((part) => String(part.taskType || '') === selectedTaskType)
            .map((part) => String(part.taskVariant || '').trim())
            .filter(Boolean)
        )
      );

      const orderedOptions = getWritingTaskTypeOptions(selectedTaskType)
        .filter((opt) => availableWritingVariants.includes(opt.value))
        .map((opt) => ({ value: opt.value, label: opt.label }));

      const additionalUnknownOptions = availableWritingVariants
        .filter((value) => !orderedOptions.some((opt) => opt.value === value))
        .map((value) => ({ value, label: getWritingTaskTypeLabel(value) || value }));

      taskVariantOptions = [
        { value: 'all', label: 'All Task Variants' },
        ...orderedOptions,
        ...additionalUnknownOptions,
      ];

      if (selectedTaskVariantFilter !== 'all') {
        flattenedParts = flattenedParts.filter(
          (part) => String(part.taskVariant || '').trim() === selectedTaskVariantFilter
        );
      }
    }

    const pagePartCategoryCounts = flattenedParts.reduce((acc, part) => {
      acc[part.category] = (acc[part.category] || 0) + 1;
      return acc;
    }, {});

    categoryCounts = { ...pagePartCategoryCounts };

    if (selectedCategory !== 'all' && categoryCounts[selectedCategory] === undefined) {
      categoryCounts[selectedCategory] = 0;
    }

    categories = Object.keys(categoryCounts).sort((a, b) => a.localeCompare(b));
    if (Object.keys(categoryCounts).length === 0) {
      categories = Array.from(new Set(flattenedParts.map(p => p.category))).sort();
      categoryCounts = categories.reduce((acc, cat) => {
        acc[cat] = flattenedParts.filter(p => p.category === cat).length;
        return acc;
      }, {});
    }

    // Group parts
    groupedTests = flattenedParts.reduce((acc, part) => {
      if (!acc[part.category]) acc[part.category] = [];
      acc[part.category].push(part);
      return acc;
    }, {});
  }

  const completedCount = Object.keys(attemptSummary).length;
  const statsTotalTests = overallTotalTests ?? (pagination?.totalItems ?? tests.length);

  return (
    <div className="page test-list">
      {/* Header + Search — full width above layout */}
      <div className="mb-8" style={{ maxWidth: 1200, margin: '0 auto', padding: '2rem 1.5rem 0' }}>
        <div className="test-list-hero flex items-end justify-between">
          <div className="test-list-hero-copy">
            <div className="flex items-center gap-2 mb-2">
              <Sparkles className="w-4 h-4 text-[#F59E0B]" />
              <span
                className="text-[#6366F1]"
                style={{
                  fontSize: "0.8125rem",
                  fontWeight: 600,
                  letterSpacing: "0.04em",
                  textTransform: "uppercase",
                }}
              >
                Practice Tests
              </span>
            </div>
            <h1
              className="text-[#0F172A]"
              style={{ fontSize: "2rem", fontWeight: 700, lineHeight: 1.25 }}
            >
              CHINH PHỤC MỤC TIÊU IELTS
            </h1>
            <p className="text-[#64748B] mt-1.5" style={{ fontSize: "0.9375rem" }}>
              Ngân hàng đề thi được thiết kế để đạt band 7+.
            </p>
          </div>
          <div className="test-list-hero-controls flex items-center gap-3">
            <div className="test-list-search-group relative group">
              <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-[#94A3B8] group-focus-within:text-[#6366F1] transition-colors" />
              <input
                type="text"
                placeholder="Filter tests..."
                value={searchInput}
                onChange={(e) => setSearchInput(e.target.value)}
                className="test-list-search-input-mobile h-10 pl-10 pr-4 w-[220px] bg-white border border-[#E2E8F0] rounded-xl text-[#0F172A] placeholder:text-[#94A3B8] focus:outline-none focus:border-[#6366F1]/40 focus:shadow-[0_0_0_3px_rgba(99,102,241,0.08)] transition-all"
                style={{ fontSize: "0.8125rem" }}
              />
            </div>
            <button className="test-list-sort-btn flex items-center gap-2 h-10 px-4 bg-white border border-[#E2E8F0] rounded-xl text-[#64748B] hover:text-[#334155] hover:border-[#CBD5E1] transition-all cursor-pointer shadow-sm">
              <SlidersHorizontal className="w-4 h-4" />
              <span style={{ fontSize: "0.8125rem" }}>Sort</span>
            </button>
          </div>
        </div>
      </div>

      <div className="test-list-layout">
        <TestSidebar
          selectedType={selectedType}
          onTypeChange={(val) => { setSelectedType(val); setCurrentPage(1); }}
          viewMode={viewMode}
          onViewModeChange={setViewMode}
          selectedPartFilter={selectedPartFilter}
          onPartFilterChange={setSelectedPartFilter}
          selectedQuestionGroupFilter={selectedQuestionGroupFilter}
          onQuestionGroupFilterChange={setSelectedQuestionGroupFilter}
          questionGroupOptions={questionGroupOptions}
          selectedTaskVariantFilter={selectedTaskVariantFilter}
          onTaskVariantFilterChange={setSelectedTaskVariantFilter}
          taskVariantOptions={taskVariantOptions}
          totalTests={statsTotalTests}
          completedTests={completedCount}
        />

        <section className="test-main">
          {/* Category filter chips */}
          <div className="test-category-filter">
            <button
              className={`category-btn ${selectedCategory === 'all' ? 'active' : ''}`}
              onClick={() => {
                setSelectedCategory('all');
                setCurrentPage(1);
              }}
            >
              All {viewMode === 'full' ? 'Tests' : 'Parts'} ({viewMode === 'full' ? (pagination?.totalItems ?? typeFilteredTests.length) : flattenedParts.length})
            </button>
            {categories.map((cat) => (
              <button
                key={cat}
                className={`category-btn ${selectedCategory === cat ? 'active' : ''}`}
                onClick={() => {
                  setSelectedCategory(cat);
                  setCurrentPage(1);
                }}
              >
                {cat} ({categoryCounts[cat] || 0})
              </button>
            ))}
          </div>

          {isFetching ? (
            <ul className="test-cards" aria-busy="true" aria-live="polite">
              {[1, 2, 3, 4, 5, 6].map((n) => (
                <li key={`fetch-skeleton-${n}`}>
                  <TestCardSkeleton />
                </li>
              ))}
            </ul>
          ) : Object.keys(groupedTests).length === 0 ? (
            <p className="muted" style={{ textAlign: 'center', padding: '3rem', color: '#94A3B8' }}>
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
                      if (viewMode === 'full') {
                        const test = item;
                        return (
                          <li key={test._id}>
                            <TestCard
                              test={test}
                              attemptData={attemptSummary[test._id]}
                              isLoggedIn={isLoggedIn}
                            />
                          </li>
                        );
                      } else {
                        const part = item;
                        return (
                          <li key={part.uniqueId}>
                            <PartCard part={part} />
                          </li>
                        );
                      }
                    })}
                  </ul>
                </div>
              ))
          )}

          <PaginationControls
            pagination={pagination}
            loading={loading || isFetching}
            itemLabel={viewMode === 'full' ? 'tests' : 'tests'}
            onPageChange={setCurrentPage}
          />
        </section>
      </div>
    </div>
  );
}
