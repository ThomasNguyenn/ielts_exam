import { useEffect, useMemo, useState } from 'react';
import { useLocation, useNavigate, useParams } from 'react-router-dom';
import {
  AlertCircle,
  ArrowLeft,
  BookOpen,
  CheckCircle2,
  Clock3,
  Filter,
  Headphones,
  Loader2,
  Mic,
  PenTool,
  RotateCcw,
  Sparkles,
} from 'lucide-react';
import { api } from '@/shared/api/client';
import { useNotification } from '@/shared/context/NotificationContext';
import { cn } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { DatePicker } from '@/components/ui/date-picker';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';

const PAGE_SIZE = 20;

const FILTERS = [
  { value: 'all', label: 'All', icon: Sparkles },
  { value: 'reading', label: 'Reading', icon: BookOpen },
  { value: 'listening', label: 'Listening', icon: Headphones },
  { value: 'writing', label: 'Writing', icon: PenTool },
  { value: 'speaking', label: 'Speaking', icon: Mic },
];

const typeBadgeClassMap = {
  reading: 'border-indigo-200 bg-indigo-50 text-indigo-700',
  listening: 'border-cyan-200 bg-cyan-50 text-cyan-700',
  writing: 'border-emerald-200 bg-emerald-50 text-emerald-700',
  speaking: 'border-amber-200 bg-amber-50 text-amber-700',
};

const typeCardToneMap = {
  reading: 'from-indigo-500/8 to-transparent',
  listening: 'from-cyan-500/8 to-transparent',
  writing: 'from-emerald-500/8 to-transparent',
  speaking: 'from-amber-500/8 to-transparent',
};

const errorLogBadgeClassMap = {
  pending: 'border-slate-200 bg-slate-100 text-slate-700',
  processing: 'border-blue-200 bg-blue-50 text-blue-700',
  failed: 'border-rose-200 bg-rose-50 text-rose-700',
  ready: 'border-emerald-200 bg-emerald-50 text-emerald-700',
};

const formatDateTime = (value) => {
  if (!value) return '-';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '-';
  return date.toLocaleString();
};

const formatDuration = (milliseconds) => {
  const duration = Number(milliseconds);
  if (!Number.isFinite(duration) || duration <= 0) return 'N/A';

  const minutes = Math.floor(duration / 60000);
  const seconds = Math.floor((duration % 60000) / 1000);
  return `${minutes}m ${seconds}s`;
};

const toErrorLogsStateLabel = (value) => {
  const normalized = String(value || '').trim().toLowerCase();
  if (!normalized) return null;
  if (normalized === 'pending') return 'Error Logs Pending';
  if (normalized === 'processing') return 'Error Logs Processing';
  if (normalized === 'failed') return 'Error Logs Failed';
  if (normalized === 'ready') return 'Error Logs Ready';
  return normalized;
};

const calculateBandScore = (score, type) => {
  if (score === null || score === undefined) return null;

  const listeningMap = [
    { min: 39, band: 9.0 }, { min: 37, band: 8.5 }, { min: 35, band: 8.0 },
    { min: 32, band: 7.5 }, { min: 30, band: 7.0 }, { min: 26, band: 6.5 },
    { min: 23, band: 6.0 }, { min: 18, band: 5.5 }, { min: 16, band: 5.0 },
    { min: 13, band: 4.5 }, { min: 10, band: 4.0 }, { min: 8, band: 3.5 },
    { min: 6, band: 3.0 }, { min: 4, band: 2.5 }, { min: 2, band: 2.0 },
    { min: 1, band: 1.0 }, { min: 0, band: 0 },
  ];

  const readingMap = [
    { min: 39, band: 9.0 }, { min: 37, band: 8.5 }, { min: 35, band: 8.0 },
    { min: 33, band: 7.5 }, { min: 30, band: 7.0 }, { min: 27, band: 6.5 },
    { min: 23, band: 6.0 }, { min: 19, band: 5.5 }, { min: 15, band: 5.0 },
    { min: 13, band: 4.5 }, { min: 10, band: 4.0 }, { min: 8, band: 3.5 },
    { min: 6, band: 3.0 }, { min: 4, band: 2.5 }, { min: 2, band: 2.0 },
    { min: 1, band: 1.0 }, { min: 0, band: 0 },
  ];

  if (type === 'writing') return null;
  if (type === 'speaking') {
    const speakingScore = Number(score);
    if (!Number.isFinite(speakingScore)) return null;
    return speakingScore.toFixed(1);
  }

  const mapping = type === 'listening' ? listeningMap : readingMap;
  const matched = mapping.find((item) => score >= item.min);
  return matched ? matched.band.toFixed(1) : '0.0';
};

const getTypeIcon = (type) => {
  if (type === 'listening') return Headphones;
  if (type === 'writing') return PenTool;
  if (type === 'speaking') return Mic;
  return BookOpen;
};

export default function UserScoreDetail() {
  const { userId } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const { showNotification } = useNotification();

  const [attempts, setAttempts] = useState([]);
  const [pagination, setPagination] = useState(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [activeFilter, setActiveFilter] = useState('all');
  const [attemptDate, setAttemptDate] = useState('');
  const [retryingSessionId, setRetryingSessionId] = useState('');

  const currentUser = api.getUser() || {};
  const isAdmin = String(currentUser?.role || '').toLowerCase() === 'admin';
  const userName = location.state?.userName || null;
  const displayName = userName || `User ${String(userId || '').slice(0, 8)}`;

  useEffect(() => {
    setCurrentPage(1);
  }, [activeFilter, attemptDate, userId]);

  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);
        const response = await api.getAdminUserAttempts(userId, {
          type: activeFilter,
          attempt_date: attemptDate,
          page: currentPage,
          limit: PAGE_SIZE,
        });

        if (response.success) {
          setAttempts(response.data || []);
          setPagination(response.pagination || null);
          return;
        }

        showNotification('Unable to load attempt history.', 'error');
      } catch (error) {
        console.error('Failed to fetch user details:', error);
        showNotification(error?.message || 'Unable to load attempt history.', 'error');
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [activeFilter, attemptDate, currentPage, showNotification, userId]);

  const retryErrorLogs = async (sessionId) => {
    const normalizedSessionId = String(sessionId || '').trim();
    if (!normalizedSessionId || retryingSessionId) return;

    try {
      setRetryingSessionId(normalizedSessionId);
      const response = await api.retrySpeakingErrorLogs(normalizedSessionId);
      const queued = Boolean(response?.data?.queued ?? response?.queued);
      if (!queued) {
        throw new Error(response?.data?.reason || response?.reason || 'Retry enqueue failed');
      }

      showNotification('Queued speaking error-log retry.', 'success');
      setAttempts((prev) => (Array.isArray(prev)
        ? prev.map((item) => {
          if (String(item?.source_id || '') !== normalizedSessionId) return item;
          return {
            ...item,
            error_logs_state: 'processing',
            error_logs_error: null,
          };
        })
        : prev
      ));
    } catch (error) {
      showNotification(error?.message || 'Failed to retry speaking error logs', 'error');
    } finally {
      setRetryingSessionId('');
    }
  };

  const page = Number(pagination?.page || currentPage || 1);
  const totalPages = Math.max(1, Number(pagination?.totalPages || 1));
  const totalItems = Number(pagination?.totalItems || attempts.length || 0);
  const hasPrevPage = Boolean(pagination?.hasPrevPage ?? page > 1);
  const hasNextPage = Boolean(pagination?.hasNextPage ?? page < totalPages);

  const summary = useMemo(() => {
    const total = attempts.length;
    const graded = attempts.filter((attempt) => attempt?.score !== null && attempt?.score !== undefined).length;
    const currentFilter = FILTERS.find((item) => item.value === activeFilter)?.label || 'All';
    const currentDate = attemptDate || 'Any date';
    return { total, graded, currentFilter, currentDate };
  }, [activeFilter, attemptDate, attempts]);

  return (
    <div className="mx-auto flex w-full max-w-7xl flex-col gap-6 p-4 md:p-6">
      <Card className="relative overflow-hidden border-border/70 shadow-sm">
        <div className="pointer-events-none absolute -right-20 -top-24 h-56 w-56 rounded-full bg-indigo-500/10 blur-3xl" />
        <CardHeader className="relative gap-5 md:flex-row md:items-start md:justify-between">
          <div className="space-y-3">
            <Button type="button" variant="ghost" size="sm" onClick={() => navigate('/scores')}>
              <ArrowLeft className="h-4 w-4" />
              Back to Scores
            </Button>
            <div>
              <CardTitle className="text-2xl tracking-tight md:text-3xl">{displayName}</CardTitle>
              <CardDescription className="mt-1">
                {userName
                  ? 'Detailed history across skills with grading and speaking log status.'
                  : `User ID: ${userId}`}
              </CardDescription>
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            <Badge variant="outline" className="rounded-full px-3 py-1 text-xs">{summary.total} attempts</Badge>
            <Badge variant="outline" className="rounded-full px-3 py-1 text-xs">{summary.graded} graded</Badge>
            <Badge variant="outline" className="rounded-full px-3 py-1 text-xs">Filter: {summary.currentFilter}</Badge>
            <Badge variant="outline" className="rounded-full px-3 py-1 text-xs">Date: {summary.currentDate}</Badge>
          </div>
        </CardHeader>
      </Card>

      <div className="grid gap-4 md:grid-cols-3">
        <Card className="border-border/70 shadow-sm">
          <CardContent className="pt-6">
            <p className="text-xs uppercase tracking-wide text-muted-foreground">Attempts In View</p>
            <p className="mt-2 text-2xl font-semibold">{summary.total}</p>
          </CardContent>
        </Card>
        <Card className="border-border/70 shadow-sm">
          <CardContent className="pt-6">
            <p className="text-xs uppercase tracking-wide text-muted-foreground">Graded Attempts</p>
            <p className="mt-2 text-2xl font-semibold">{summary.graded}</p>
          </CardContent>
        </Card>
        <Card className="border-border/70 shadow-sm">
          <CardContent className="pt-6">
            <p className="text-xs uppercase tracking-wide text-muted-foreground">Ungraded</p>
            <p className="mt-2 text-2xl font-semibold">{Math.max(0, summary.total - summary.graded)}</p>
          </CardContent>
        </Card>
      </div>

      <Card className="border-border/70 shadow-sm">
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <Filter className="h-4 w-4" />
            Filter Attempts
          </CardTitle>
          <CardDescription>Switch skill tabs or pick an attempt date.</CardDescription>
        </CardHeader>
        <CardContent>
          <Tabs value={activeFilter} onValueChange={(value) => value && setActiveFilter(value)}>
            <TabsList className="h-auto w-full flex-wrap justify-start gap-1 bg-transparent p-0">
              {FILTERS.map((filter) => {
                const Icon = filter.icon;
                return (
                  <TabsTrigger
                    key={filter.value}
                    value={filter.value}
                    className="gap-1.5 rounded-full border px-3 py-1.5 text-xs data-[state=active]:border-border data-[state=active]:bg-secondary"
                  >
                    <Icon className="h-3.5 w-3.5" />
                    {filter.label}
                  </TabsTrigger>
                );
              })}
            </TabsList>
          </Tabs>
          <div className="mt-4 max-w-sm space-y-2">
            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
              Attempt Date
            </p>
            <DatePicker
              value={attemptDate}
              onChange={(value) => setAttemptDate(value)}
              placeholder="Filter by date"
              allowClear
              buttonClassName="h-9"
            />
          </div>
        </CardContent>
      </Card>

      <Card className="border-border/70 shadow-sm">
        <CardHeader className="pb-4">
          <CardTitle className="text-base">Attempt Cards</CardTitle>
          <CardDescription>Each card shows score details, timing, and speaking log controls.</CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex min-h-[280px] items-center justify-center text-sm text-muted-foreground">
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Loading attempts...
            </div>
          ) : attempts.length === 0 ? (
            <div className="rounded-lg border border-dashed py-14 text-center text-sm text-muted-foreground">
              No attempts found for this filter.
            </div>
          ) : (
            <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
              {attempts.map((attempt) => {
                const normalizedType = String(attempt?.type || 'reading').toLowerCase();
                const typeBadgeClass = typeBadgeClassMap[normalizedType] || typeBadgeClassMap.reading;
                const cardTone = typeCardToneMap[normalizedType] || typeCardToneMap.reading;
                const band = calculateBandScore(attempt?.score, normalizedType);
                const errorLogsState = String(attempt?.error_logs_state || '').toLowerCase();
                const errorLogsBadgeClass = errorLogBadgeClassMap[errorLogsState] || errorLogBadgeClassMap.pending;
                const canRetry = isAdmin && normalizedType === 'speaking' && errorLogsState === 'failed';
                const TypeIcon = getTypeIcon(normalizedType);

                const scoreText = normalizedType === 'speaking'
                  ? (attempt?.score !== null ? `Band ${calculateBandScore(attempt.score, 'speaking')}` : 'Pending grading')
                  : (attempt?.score !== null ? `${attempt.score}/${attempt.total}` : 'Pending grading');

                return (
                  <Card
                    key={attempt._id}
                    className="group relative overflow-hidden border-border/70 shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md"
                  >
                    <div className={cn('pointer-events-none absolute inset-x-0 top-0 h-24 bg-gradient-to-b', cardTone)} />
                    <CardHeader className="relative space-y-3 pb-4">
                      <div className="flex flex-wrap items-start justify-between gap-2">
                        <Badge variant="outline" className={cn('rounded-full px-2.5 py-1 capitalize', typeBadgeClass)}>
                          <TypeIcon className="mr-1 h-3.5 w-3.5" />
                          {normalizedType}
                        </Badge>
                        {(normalizedType === 'reading' || normalizedType === 'listening' || normalizedType === 'speaking') && band ? (
                          <Badge variant="secondary" className="rounded-full">Band {band}</Badge>
                        ) : null}
                      </div>
                      <CardTitle className="line-clamp-2 text-[15px] leading-snug">
                        {attempt?.test_id?.title || 'Unknown test'}
                      </CardTitle>
                      <CardDescription className="flex items-center gap-1.5 text-xs">
                        <Clock3 className="h-3.5 w-3.5" />
                        Submitted: {formatDateTime(attempt?.submitted_at)}
                      </CardDescription>
                    </CardHeader>

                    <CardContent className="space-y-4">
                      <div className="grid grid-cols-2 gap-2.5">
                        <div className="rounded-lg border bg-muted/20 p-2.5">
                          <p className="text-[11px] uppercase tracking-wide text-muted-foreground">Score</p>
                          <p className="mt-1 text-sm font-semibold text-foreground">{scoreText}</p>
                        </div>
                        <div className="rounded-lg border bg-muted/20 p-2.5">
                          <p className="text-[11px] uppercase tracking-wide text-muted-foreground">Time</p>
                          <p className="mt-1 text-sm font-semibold text-foreground">{formatDuration(attempt?.time_taken_ms)}</p>
                        </div>
                        <div className="rounded-lg border bg-muted/20 p-2.5">
                          <p className="text-[11px] uppercase tracking-wide text-muted-foreground">Percent</p>
                          <p className="mt-1 text-sm font-semibold text-foreground">
                            {attempt?.percentage !== null && attempt?.percentage !== undefined ? `${attempt.percentage}%` : 'N/A'}
                          </p>
                        </div>
                        <div className="rounded-lg border bg-muted/20 p-2.5">
                          <p className="text-[11px] uppercase tracking-wide text-muted-foreground">Wrong / Skipped</p>
                          <p className="mt-1 text-sm font-semibold text-foreground">{attempt?.wrong ?? 0} / {attempt?.skipped ?? 0}</p>
                        </div>
                      </div>

                      {normalizedType === 'speaking' ? (
                        <div className="space-y-2 rounded-lg border border-dashed p-3">
                          <div className="flex flex-wrap items-center gap-2">
                            {toErrorLogsStateLabel(errorLogsState) ? (
                              <Badge variant="outline" className={cn('rounded-full px-2.5 py-1', errorLogsBadgeClass)}>
                                {toErrorLogsStateLabel(errorLogsState)}
                              </Badge>
                            ) : (
                              <Badge variant="outline" className="rounded-full px-2.5 py-1">No error-log state</Badge>
                            )}

                            {canRetry ? (
                              <Button
                                type="button"
                                size="sm"
                                variant="outline"
                                disabled={retryingSessionId === String(attempt?.source_id || '')}
                                onClick={() => retryErrorLogs(attempt?.source_id)}
                              >
                                {retryingSessionId === String(attempt?.source_id || '') ? (
                                  <>
                                    <Loader2 className="h-4 w-4 animate-spin" />
                                    Retrying...
                                  </>
                                ) : (
                                  <>
                                    <RotateCcw className="h-4 w-4" />
                                    Retry Error Logs
                                  </>
                                )}
                              </Button>
                            ) : null}
                          </div>

                          {attempt?.error_logs_error ? (
                            <div className="flex items-start gap-2 rounded-md border border-rose-200 bg-rose-50 p-2 text-xs text-rose-700">
                              <AlertCircle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                              <span>{attempt.error_logs_error}</span>
                            </div>
                          ) : (
                            <div className="flex items-start gap-2 rounded-md border border-emerald-200 bg-emerald-50 p-2 text-xs text-emerald-700">
                              <CheckCircle2 className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                              <span>No speaking log errors for this attempt.</span>
                            </div>
                          )}
                        </div>
                      ) : null}
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {pagination ? (
        <Card className="border-border/70 shadow-sm">
          <CardContent className="flex flex-col gap-2 pt-6 text-sm sm:flex-row sm:items-center sm:justify-between">
            <span className="text-muted-foreground">Page {page} / {totalPages} - {totalItems} attempts</span>
            <div className="flex items-center gap-2">
              <Button
                type="button"
                size="sm"
                variant="outline"
                disabled={loading || !hasPrevPage}
                onClick={() => setCurrentPage((prev) => Math.max(1, prev - 1))}
              >
                Prev
              </Button>
              <Button
                type="button"
                size="sm"
                variant="outline"
                disabled={loading || !hasNextPage}
                onClick={() => setCurrentPage((prev) => Math.min(totalPages, prev + 1))}
              >
                Next
              </Button>
            </div>
          </CardContent>
        </Card>
      ) : null}
    </div>
  );
}
