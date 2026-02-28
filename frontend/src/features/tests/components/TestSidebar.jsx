import { BookOpen, Filter, Headphones, LayoutGrid, Layers, PenTool, TrendingUp } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import "./TestSidebar.css";

const SKILL_FILTERS = [
  { id: "reading", label: "Reading", icon: BookOpen },
  { id: "writing", label: "Writing", icon: PenTool },
  { id: "listening", label: "Listening", icon: Headphones },
];

function getPartOptions(selectedType) {
  if (selectedType === "reading") {
    return [
      { value: "all", label: "All passages" },
      { value: "part1", label: "Passage 1" },
      { value: "part2", label: "Passage 2" },
      { value: "part3", label: "Passage 3" },
    ];
  }
  if (selectedType === "listening") {
    return [
      { value: "all", label: "All sections" },
      { value: "part1", label: "Section 1" },
      { value: "part2", label: "Section 2" },
      { value: "part3", label: "Section 3" },
      { value: "part4", label: "Section 4" },
    ];
  }
  if (selectedType === "writing") {
    return [
      { value: "all", label: "All tasks" },
      { value: "part1", label: "Task 1" },
      { value: "part2", label: "Task 2" },
    ];
  }
  return [{ value: "all", label: "All parts" }];
}

function SidebarButton({ active, icon: Icon, label, onClick, skill = "all" }) {
  return (
    <button
      type="button"
      className={`ts-btn ${active ? "active" : ""}`}
      data-skill={skill}
      onClick={onClick}
    >
      {Icon ? <Icon size={16} /> : null}
      <span>{label}</span>
    </button>
  );
}

export default function TestSidebar({
  selectedType,
  onTypeChange,
  viewMode,
  onViewModeChange,
  selectedPartFilter,
  onPartFilterChange,
  selectedQuestionGroupFilter = "all",
  onQuestionGroupFilterChange,
  questionGroupOptions = [],
  totalTests = 0,
  completedTests = 0,
  className = "",
}) {
  const safeTotal = Math.max(0, Number(totalTests) || 0);
  const safeCompleted = Math.min(Math.max(0, Number(completedTests) || 0), safeTotal);
  const progress = safeTotal > 0 ? Math.round((safeCompleted / safeTotal) * 100) : 0;
  const canShowQuestionGroupFilter =
    viewMode === "parts" && (selectedType === "reading" || selectedType === "listening");
  const safeQuestionGroupOptions = questionGroupOptions.length
    ? questionGroupOptions
    : [{ value: "all", label: "All question groups" }];

  return (
    <aside className={`ts ${className}`.trim()}>
      <div className="ts-sticky">
        <div className="ts-filter-header">
          <Filter size={14} />
          <span>Filters</span>
        </div>

        <section className="ts-card">
          <div className="ts-card-head">
            <h3>Skills</h3>
            <Badge variant="outline" className="ts-count-badge">
              3
            </Badge>
          </div>
          <div className="ts-btn-list">
            <SidebarButton
              active={selectedType === "all"}
              icon={LayoutGrid}
              label="All skills"
              skill="all"
              onClick={() => onTypeChange("all")}
            />
            {SKILL_FILTERS.map((skill) => (
              <SidebarButton
                key={skill.id}
                active={selectedType === skill.id}
                icon={skill.icon}
                label={skill.label}
                skill={skill.id}
                onClick={() => onTypeChange(skill.id)}
              />
            ))}
          </div>
        </section>

        <section className="ts-card">
          <div className="ts-card-head">
            <h3>Test mode</h3>
            <Layers size={14} className="ts-muted-icon" />
          </div>
          <Tabs value={viewMode} onValueChange={onViewModeChange}>
            <TabsList className="ts-tabs-list">
              <TabsTrigger value="full" className="ts-tabs-trigger">
                Full test
              </TabsTrigger>
              <TabsTrigger value="parts" className="ts-tabs-trigger">
                By parts
              </TabsTrigger>
            </TabsList>
          </Tabs>
        </section>

        {viewMode === "parts" && selectedType !== "all" ? (
          <section className="ts-card">
            <h3>Filter by part</h3>
            <div className="ts-btn-list">
              {getPartOptions(selectedType).map((option) => (
                <button
                  key={option.value}
                  type="button"
                  className={`ts-part-option ${selectedPartFilter === option.value ? "active" : ""}`}
                  onClick={() => onPartFilterChange(option.value)}
                >
                  {option.label}
                </button>
              ))}
            </div>
          </section>
        ) : null}

        {canShowQuestionGroupFilter ? (
          <section className="ts-card">
            <h3>Question groups</h3>
            <div className="ts-btn-list">
              {safeQuestionGroupOptions.map((option) => (
                <button
                  key={option.value}
                  type="button"
                  className={`ts-part-option ${selectedQuestionGroupFilter === option.value ? "active" : ""}`}
                  onClick={() => onQuestionGroupFilterChange?.(option.value)}
                >
                  {option.label}
                </button>
              ))}
            </div>
          </section>
        ) : null}

        <section className="ts-progress-card">
          <div className="ts-progress-header">
            <span>Your progress</span>
            <TrendingUp size={14} />
          </div>
          <p className="ts-progress-value">
            {safeCompleted}
            <span>/{safeTotal}</span>
          </p>
          <p className="ts-progress-label">Tests completed</p>
          <div className="ts-progress-track">
            <div className="ts-progress-fill" style={{ width: `${progress}%` }} />
          </div>
        </section>
      </div>
    </aside>
  );
}
