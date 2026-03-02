import { useEffect, useState } from "react";
import { Search, SlidersHorizontal, Sparkles } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import TestCardSkeleton from "@/shared/components/TestCardSkeleton";
import { api } from "@/shared/api/client";
import { PartCard, TestCard } from "@/features/tests/components/TestCard";
import TestSidebar from "@/features/tests/components/TestSidebar";
import {
  canonicalizeQuestionGroupType,
  getQuestionGroupLabel,
} from "@/features/tests/utils/questionGroupLabels";
import "./TestList.css";

const PAGE_SIZE = 12;

export default function TestList() {
  const [tests, setTests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isFetching, setIsFetching] = useState(false);
  const [error, setError] = useState(null);
  const [selectedCategory, setSelectedCategory] = useState("all");
  const [selectedPartFilter, setSelectedPartFilter] = useState("all");
  const [selectedQuestionGroupFilter, setSelectedQuestionGroupFilter] = useState("all");
  const [selectedType, setSelectedType] = useState("all");
  const [viewMode, setViewMode] = useState("full");
  const [searchInput, setSearchInput] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [attemptSummary, setAttemptSummary] = useState({});
  const [currentPage, setCurrentPage] = useState(1);
  const [pagination, setPagination] = useState(null);
  const [allCategoryCounts, setAllCategoryCounts] = useState({});
  const [overallTotalTests, setOverallTotalTests] = useState(null);
  const [reloadKey, setReloadKey] = useState(0);
  const [mobileFiltersOpen, setMobileFiltersOpen] = useState(false);
  const [standalonePassages, setStandalonePassages] = useState([]);
  const [standaloneSections, setStandaloneSections] = useState([]);
  const [standaloneWritings, setStandaloneWritings] = useState([]);

  const isLoggedIn = api.isAuthenticated();
  const requestedCategory = viewMode === "full" ? selectedCategory : "all";

  useEffect(() => {
    if (searchInput === searchQuery) return;

    const timer = setTimeout(() => {
      setSearchQuery(searchInput);
      setCurrentPage(1);
    }, 350);

    return () => clearTimeout(timer);
  }, [searchInput, searchQuery]);

  useEffect(() => {
    setSelectedCategory("all");
    setSelectedPartFilter("all");
    setSelectedQuestionGroupFilter("all");
    setCurrentPage(1);
  }, [selectedType]);

  useEffect(() => {
    if (viewMode === "parts") return;
    setSelectedQuestionGroupFilter("all");
  }, [viewMode]);

  useEffect(() => {
    setCurrentPage(1);
  }, [viewMode]);

  // Load standalone passages/sections/writings that are marked as single-part content
  useEffect(() => {
    if (viewMode !== "parts") return;

    let isMounted = true;

    Promise.all([
      api.getPassages().catch(() => ({ data: [] })),
      api.getSections().catch(() => ({ data: [] })),
      api.getWritings().catch(() => ({ data: [] })),
    ])
      .then(([passagesRes, sectionsRes, writingsRes]) => {
        if (!isMounted) return;

        const safePassages = (passagesRes?.data || []).filter(
          (item) => item?.isSinglePart && item?.is_active !== false,
        );
        const safeSections = (sectionsRes?.data || []).filter(
          (item) => item?.isSinglePart && item?.is_active !== false,
        );
        const safeWritings = (writingsRes?.data || []).filter(
          (item) => item?.isSinglePart && item?.is_active !== false,
        );

        setStandalonePassages(safePassages);
        setStandaloneSections(safeSections);
        setStandaloneWritings(safeWritings);
      })
      .catch(() => {
        if (!isMounted) return;
        setStandalonePassages([]);
        setStandaloneSections([]);
        setStandaloneWritings([]);
      });

    return () => {
      isMounted = false;
    };
  }, [viewMode, reloadKey]);

  useEffect(() => {
    setError(null);
    if (!loading) setIsFetching(true);

    const requestParams = {
      type: selectedType !== "all" ? selectedType : undefined,
      q: searchQuery.trim() || undefined,
      includeQuestionGroupTypes: true,
    };

    if (viewMode === "full") {
      requestParams.page = currentPage;
      requestParams.limit = PAGE_SIZE;
      requestParams.category = requestedCategory !== "all" ? requestedCategory : undefined;
    }

    api
      .getTests(requestParams)
      .then((response) => {
        setTests(response.data || []);
        setPagination(viewMode === "full" ? response.pagination || null : null);
      })
      .catch((loadError) => {
        setError(loadError.message || "Failed to load tests.");
      })
      .finally(() => {
        setLoading(false);
        setIsFetching(false);
      });
  }, [currentPage, requestedCategory, selectedType, searchQuery, viewMode, reloadKey]);

  useEffect(() => {
    let isMounted = true;

    api
      .getTestCategories({
        type: selectedType !== "all" ? selectedType : undefined,
        q: searchQuery.trim() || undefined,
      })
      .then((res) => {
        if (!isMounted) return;
        const counts = (res.data || []).reduce((acc, row) => {
          const category = (row?.category || "").trim() || "Uncategorized";
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
  }, [selectedType, searchQuery, reloadKey]);

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
      .catch(() => {});
  }, [isLoggedIn, reloadKey]);

  useEffect(() => {
    let isMounted = true;

    api
      .getTests({ page: 1, limit: 1 })
      .then((response) => {
        if (!isMounted) return;
        setOverallTotalTests(Number(response?.pagination?.totalItems || 0));
      })
      .catch(() => {
        if (!isMounted) return;
        setOverallTotalTests(null);
      });

    return () => {
      isMounted = false;
    };
  }, [reloadKey]);

  useEffect(() => {
    const canUseQuestionGroupFilter =
      viewMode === "parts" && (selectedType === "reading" || selectedType === "listening");
    if (!canUseQuestionGroupFilter) {
      if (selectedQuestionGroupFilter !== "all") {
        setSelectedQuestionGroupFilter("all");
      }
      return;
    }

    const query = searchQuery.trim().toLowerCase();
    const targetPartIndex =
      selectedPartFilter === "all"
        ? null
        : Number.parseInt(selectedPartFilter.replace("part", ""), 10) - 1;
    const availableTypes = new Set();

    tests.forEach((test) => {
      const type = test.type || "reading";
      const category = (test.category || "").trim() || "Uncategorized";

      if (selectedType !== "all" && type !== selectedType) return;
      if (selectedCategory !== "all" && category !== selectedCategory) return;

      if (query) {
        const matchesQuery =
          test.title.toLowerCase().includes(query) ||
          test._id.toLowerCase().includes(query) ||
          category.toLowerCase().includes(query) ||
          type.toLowerCase().includes(query);
        if (!matchesQuery) return;
      }

      const parts =
        type === "reading"
          ? test.reading_passages || []
          : type === "listening"
            ? test.listening_sections || []
            : [];

      parts.forEach((part, index) => {
        if (targetPartIndex !== null && index !== targetPartIndex) return;
        (part?.question_groups || []).forEach((group) => {
          const canonicalType = canonicalizeQuestionGroupType(group?.type);
          if (canonicalType) availableTypes.add(canonicalType);
        });
      });
    });

    if (selectedQuestionGroupFilter !== "all" && !availableTypes.has(selectedQuestionGroupFilter)) {
      setSelectedQuestionGroupFilter("all");
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

  const getCategory = (test) => (test.category || "").trim() || "Uncategorized";
  const getType = (test) => test.type || "reading";
  const matchesType = (test) => selectedType === "all" || getType(test) === selectedType;
  const normalizedQuery = searchQuery.trim().toLowerCase();

  // Hide archived tests (where is_active === false)
  const visibleTests = tests.filter((test) => test.is_active !== false);
  const typeFilteredTests = visibleTests.filter(matchesType);
  const searchFilteredTests = typeFilteredTests.filter((test) => {
    if (!normalizedQuery) return true;
    return (
      test.title.toLowerCase().includes(normalizedQuery) ||
      test._id.toLowerCase().includes(normalizedQuery) ||
      getCategory(test).toLowerCase().includes(normalizedQuery) ||
      getType(test).toLowerCase().includes(normalizedQuery)
    );
  });
  const categoryFilteredTests = searchFilteredTests.filter(
    (test) => selectedCategory === "all" || getCategory(test) === selectedCategory,
  );

  let categories = [];
  let categoryCounts = {};
  let groupedTests = {};
  let flattenedParts = [];
  let allPartsCount = 0;
  let questionGroupOptions = [{ value: "all", label: "All question groups" }];
  const canUseQuestionGroupFilter =
    viewMode === "parts" && (selectedType === "reading" || selectedType === "listening");

  if (viewMode === "full") {
    const fallbackCategoryCounts = searchFilteredTests.reduce((acc, test) => {
      const cat = getCategory(test);
      acc[cat] = (acc[cat] || 0) + 1;
      return acc;
    }, {});
    const hasAllCategoriesData = Object.keys(allCategoryCounts).length > 0;
    categoryCounts = hasAllCategoriesData ? { ...allCategoryCounts } : fallbackCategoryCounts;

    if (selectedCategory !== "all" && categoryCounts[selectedCategory] === undefined) {
      categoryCounts[selectedCategory] = 0;
    }

    categories = Object.keys(categoryCounts).sort((a, b) => a.localeCompare(b));

    groupedTests = categoryFilteredTests.reduce((acc, test) => {
      const cat = getCategory(test);
      if (!acc[cat]) acc[cat] = [];
      acc[cat].push(test);
      return acc;
    }, {});
  } else {
    searchFilteredTests.forEach((test) => {
      const cat = getCategory(test);

      if (test.type === "reading" && test.reading_passages) {
        test.reading_passages.forEach((passage, index) => {
          const questionGroupTypes = Array.from(
            new Set(
              (passage?.question_groups || [])
                .map((group) => canonicalizeQuestionGroupType(group?.type))
                .filter(Boolean),
            ),
          );
          flattenedParts.push({
            uniqueId: `${test._id}_p${index}`,
            testId: test._id,
            title: passage.title || `Passage ${index + 1}`,
            testTitle: test.title,
            category: cat,
            type: "reading",
            partIndex: index,
            label: `Passage ${index + 1}`,
            questionGroupTypes,
          });
        });
      }

      if (test.type === "listening" && test.listening_sections) {
        test.listening_sections.forEach((section, index) => {
          const questionGroupTypes = Array.from(
            new Set(
              (section?.question_groups || [])
                .map((group) => canonicalizeQuestionGroupType(group?.type))
                .filter(Boolean),
            ),
          );
          flattenedParts.push({
            uniqueId: `${test._id}_s${index}`,
            testId: test._id,
            title: section.title || `Section ${index + 1}`,
            testTitle: test.title,
            category: cat,
            type: "listening",
            partIndex: index,
            label: `Section ${index + 1}`,
            questionGroupTypes,
          });
        });
      }

      if (test.type === "writing" && test.writing_tasks) {
        test.writing_tasks.forEach((task, index) => {
          flattenedParts.push({
            uniqueId: `${test._id}_w${index}`,
            testId: test._id,
            title: task.title,
            testTitle: test.title,
            category: cat,
            type: "writing",
            partIndex: index,
            label: `Task ${index + 1}`,
            questionGroupTypes: [],
          });
        });
      }
    });

    // Standalone reading passages
    const standaloneReadingCategory = "Standalone Reading";
    const standaloneListeningCategory = "Standalone Listening";
    const standaloneWritingCategory = "Standalone Writing";

    standalonePassages.forEach((passage) => {
      const cat = standaloneReadingCategory;

      if (selectedType !== "all" && selectedType !== "reading") return;

      const query = normalizedQuery;
      if (query) {
        const matchesQuery =
          passage.title?.toLowerCase().includes(query) ||
          String(passage._id || "").toLowerCase().includes(query) ||
          cat.toLowerCase().includes(query);
        if (!matchesQuery) return;
      }

      const questionGroupTypes = Array.from(
        new Set(
          (passage?.question_groups || [])
            .map((group) => canonicalizeQuestionGroupType(group?.type))
            .filter(Boolean),
        ),
      );

      flattenedParts.push({
        uniqueId: `passage_${passage._id}`,
        testId: null,
        testTitle: null,
        title: passage.title,
        testTitleFallback: passage.title,
        category: cat,
        type: "reading",
        partIndex: 0,
        label: "Standalone passage",
        questionGroupTypes,
        isStandalone: true,
        linkTo: `/tests/standalone/reading/${encodeURIComponent(passage._id)}`,
        originLabel: "Standalone reading passage",
      });
    });

    // Standalone listening sections
    standaloneSections.forEach((section) => {
      const cat = standaloneListeningCategory;

      if (selectedType !== "all" && selectedType !== "listening") return;

      const query = normalizedQuery;
      if (query) {
        const matchesQuery =
          section.title?.toLowerCase().includes(query) ||
          String(section._id || "").toLowerCase().includes(query) ||
          cat.toLowerCase().includes(query);
        if (!matchesQuery) return;
      }

      const questionGroupTypes = Array.from(
        new Set(
          (section?.question_groups || [])
            .map((group) => canonicalizeQuestionGroupType(group?.type))
            .filter(Boolean),
        ),
      );

      flattenedParts.push({
        uniqueId: `section_${section._id}`,
        testId: null,
        testTitle: null,
        title: section.title,
        testTitleFallback: section.title,
        category: cat,
        type: "listening",
        partIndex: 0,
        label: "Standalone section",
        questionGroupTypes,
        isStandalone: true,
        linkTo: `/tests/standalone/listening/${encodeURIComponent(section._id)}`,
        originLabel: "Standalone listening section",
      });
    });

    // Standalone writing tasks
    standaloneWritings.forEach((writing) => {
      const cat = standaloneWritingCategory;

      if (selectedType !== "all" && selectedType !== "writing") return;

      const query = normalizedQuery;
      if (query) {
        const matchesQuery =
          writing.title?.toLowerCase().includes(query) ||
          String(writing._id || "").toLowerCase().includes(query) ||
          cat.toLowerCase().includes(query);
        if (!matchesQuery) return;
      }

      flattenedParts.push({
        uniqueId: `writing_${writing._id}`,
        testId: null,
        testTitle: null,
        title: writing.title,
        testTitleFallback: writing.title,
        category: cat,
        type: "writing",
        partIndex: 0,
        label: "Standalone writing task",
        questionGroupTypes: [],
        isStandalone: true,
        linkTo: `/tests/writing/${writing._id}`,
        originLabel: "Standalone writing task",
      });
    });

    if (selectedPartFilter !== "all") {
      const targetIndex = Number.parseInt(selectedPartFilter.replace("part", ""), 10) - 1;
      flattenedParts = flattenedParts.filter(
        (part) => part.isStandalone || part.partIndex === targetIndex,
      );
    }

    if (canUseQuestionGroupFilter) {
      const availableTypes = Array.from(
        new Set(flattenedParts.flatMap((part) => part.questionGroupTypes || [])),
      ).sort((a, b) => getQuestionGroupLabel(a).localeCompare(getQuestionGroupLabel(b)));

      questionGroupOptions = [
        { value: "all", label: "All question groups" },
        ...availableTypes.map((value) => ({ value, label: getQuestionGroupLabel(value) })),
      ];

      if (selectedQuestionGroupFilter !== "all") {
        flattenedParts = flattenedParts.filter((part) =>
          (part.questionGroupTypes || []).includes(selectedQuestionGroupFilter),
        );
      }
    }

    const pagePartCategoryCounts = flattenedParts.reduce((acc, part) => {
      acc[part.category] = (acc[part.category] || 0) + 1;
      return acc;
    }, {});

    categoryCounts = { ...pagePartCategoryCounts };

    if (selectedCategory !== "all" && categoryCounts[selectedCategory] === undefined) {
      categoryCounts[selectedCategory] = 0;
    }

    categories = Object.keys(categoryCounts).sort((a, b) => a.localeCompare(b));
    allPartsCount = flattenedParts.length;
    flattenedParts =
      selectedCategory === "all"
        ? flattenedParts
        : flattenedParts.filter((part) => part.category === selectedCategory);

    groupedTests = flattenedParts.reduce((acc, part) => {
      if (!acc[part.category]) acc[part.category] = [];
      acc[part.category].push(part);
      return acc;
    }, {});
  }

  const completedCount = Object.keys(attemptSummary).length;
  const statsTotalTests = overallTotalTests ?? pagination?.totalItems ?? tests.length;
  const allTestsCount = Object.values(categoryCounts).reduce((sum, count) => sum + Number(count || 0), 0);

  const paginationPage = Number(pagination?.page || 1);
  const paginationTotalPages = Math.max(1, Number(pagination?.totalPages || 1));
  const hasPrevPage = Boolean(pagination?.hasPrevPage ?? paginationPage > 1);
  const hasNextPage = Boolean(pagination?.hasNextPage ?? paginationPage < paginationTotalPages);

  const handleRetry = () => {
    setLoading(true);
    setError(null);
    setReloadKey((prev) => prev + 1);
  };

  const renderSidebar = () => (
    <TestSidebar
      selectedType={selectedType}
      onTypeChange={(value) => {
        setSelectedType(value);
        setCurrentPage(1);
      }}
      viewMode={viewMode}
      onViewModeChange={setViewMode}
      selectedPartFilter={selectedPartFilter}
      onPartFilterChange={setSelectedPartFilter}
      selectedQuestionGroupFilter={selectedQuestionGroupFilter}
      onQuestionGroupFilterChange={setSelectedQuestionGroupFilter}
      questionGroupOptions={questionGroupOptions}
      totalTests={statsTotalTests}
      completedTests={completedCount}
    />
  );

  if (loading) {
    return (
      <div className="page test-list">
        <div className="test-list-shell">
          <section className="tl-hero-card">
            <div className="tl-skeleton-header">
              <div className="tl-skeleton tl-skeleton-line wide" />
              <div className="tl-skeleton tl-skeleton-line short" />
            </div>
          </section>
          <div className="test-list-layout">
            <aside className="tl-sidebar-desktop">
              <div className="tl-side-skeleton">
                <div className="tl-skeleton tl-skeleton-line" />
                <div className="tl-skeleton tl-skeleton-block" />
                <div className="tl-skeleton tl-skeleton-block" />
              </div>
            </aside>
            <section className="test-main">
              <ul className="test-cards" aria-busy="true" aria-live="polite">
                {[1, 2, 3, 4, 5, 6].map((index) => (
                  <li key={`loading-skeleton-${index}`}>
                    <TestCardSkeleton />
                  </li>
                ))}
              </ul>
            </section>
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="page test-list">
        <div className="test-list-shell">
          <section className="tl-hero-card">
            <h1>IELTS Test Studio</h1>
            <p>Practice smarter with structured full tests and targeted part drills.</p>
          </section>

          <section className="tl-error-card">
            <h2>Unable to load tests</h2>
            <p>{error}</p>
            <Button type="button" onClick={handleRetry} className="tl-retry-btn">
              Try again
            </Button>
          </section>
        </div>
      </div>
    );
  }

  return (
    <div className="page test-list">
      <div className="test-list-shell">
        <section className="tl-hero-card">
          <div className="tl-hero-main">
            <div className="tl-hero-copy">
              <div className="tl-hero-kicker">
                <Sparkles size={14} />
                <span>Practice tests</span>
              </div>
              <h1>IELTS Test Studio</h1>
              <p>Practice smarter with structured full tests and targeted part drills.</p>
              <div className="tl-hero-stats">
                <Badge variant="outline" className="tl-stat-badge">
                  {statsTotalTests} total tests
                </Badge>
                <Badge variant="outline" className="tl-stat-badge">
                  {completedCount} completed
                </Badge>
                <Badge variant="outline" className="tl-stat-badge">
                  {viewMode === "full" ? "Full mode" : "Parts mode"}
                </Badge>
              </div>
            </div>

            <div className="tl-hero-controls">
              <Sheet open={mobileFiltersOpen} onOpenChange={setMobileFiltersOpen}>
                <SheetTrigger asChild>
                  <Button type="button" variant="outline" className="tl-mobile-filter-btn">
                    <SlidersHorizontal size={15} />
                    Filters
                  </Button>
                </SheetTrigger>
                <SheetContent side="left" className="tl-filter-sheet">
                  <SheetHeader>
                    <SheetTitle>Filters</SheetTitle>
                    <SheetDescription>Refine by skills, test mode, and parts.</SheetDescription>
                  </SheetHeader>
                  <div className="tl-filter-sheet-body">{renderSidebar()}</div>
                </SheetContent>
              </Sheet>

              <div className="tl-search-box">
                <Search size={14} className="tl-search-icon" />
                <Input
                  type="text"
                  placeholder="Search tests, categories, or ids..."
                  value={searchInput}
                  onChange={(event) => setSearchInput(event.target.value)}
                  className="tl-search-input"
                />
              </div>
            </div>
          </div>
        </section>

        <div className="test-list-layout">
          <aside className="tl-sidebar-desktop">{renderSidebar()}</aside>

          <section className="test-main">
            <div className="tl-category-wrap">
              <ScrollArea className="tl-category-scroll">
                <div className="test-category-filter tl-category-row">
                  <button
                    type="button"
                    className={`category-btn ${selectedCategory === "all" ? "active" : ""}`}
                    onClick={() => {
                      setSelectedCategory("all");
                      setCurrentPage(1);
                    }}
                  >
                    All {viewMode === "full" ? "tests" : "parts"} (
                    {viewMode === "full"
                      ? allTestsCount || pagination?.totalItems || searchFilteredTests.length
                      : allPartsCount}
                    )
                  </button>
                  {categories.map((category) => (
                    <button
                      type="button"
                      key={category}
                      className={`category-btn ${selectedCategory === category ? "active" : ""}`}
                      onClick={() => {
                        setSelectedCategory(category);
                        setCurrentPage(1);
                      }}
                    >
                      {category} ({categoryCounts[category] || 0})
                    </button>
                  ))}
                </div>
              </ScrollArea>
            </div>

            {isFetching ? (
              <ul className="test-cards" aria-busy="true" aria-live="polite">
                {[1, 2, 3, 4, 5, 6].map((index) => (
                  <li key={`fetching-skeleton-${index}`}>
                    <TestCardSkeleton />
                  </li>
                ))}
              </ul>
            ) : Object.keys(groupedTests).length === 0 ? (
              <div className="tl-empty-card">
                {selectedCategory === "all"
                  ? `No ${viewMode === "full" ? "tests" : "parts"} found.`
                  : `No content available in "${selectedCategory}".`}
              </div>
            ) : (
              Object.keys(groupedTests)
                .sort((a, b) => a.localeCompare(b))
                .map((category) => (
                  <div key={category} className="test-category-group">
                    <h2>{category}</h2>
                    <ul className="test-cards">
                      {groupedTests[category].map((item) => {
                        if (viewMode === "full") {
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
                        }

                        const part = item;
                        return (
                          <li key={part.uniqueId}>
                            <PartCard part={part} />
                          </li>
                        );
                      })}
                    </ul>
                  </div>
                ))
            )}

            {viewMode === "full" && pagination ? (
              <div className="tl-pagination-wrap">
                <span className="tl-pagination-text">
                  Page {paginationPage} / {paginationTotalPages} - {Number(pagination.totalItems || 0)} tests
                </span>
                <div className="tl-pagination-actions">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    disabled={loading || isFetching || !hasPrevPage}
                    onClick={() => setCurrentPage(Math.max(1, paginationPage - 1))}
                  >
                    Prev
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    disabled={loading || isFetching || !hasNextPage}
                    onClick={() => setCurrentPage(Math.min(paginationTotalPages, paginationPage + 1))}
                  >
                    Next
                  </Button>
                </div>
              </div>
            ) : null}
          </section>
        </div>
      </div>
    </div>
  );
}
