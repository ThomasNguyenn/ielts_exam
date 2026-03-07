import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { BarChart3, Loader2, RefreshCw, Search } from 'lucide-react';
import { api } from '@/shared/api/client';
import { useNotification } from '@/shared/context/NotificationContext';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';

const PAGE_SIZE = 20;

const roleBadgeClassMap = {
  admin: 'border-rose-200 bg-rose-50 text-rose-700',
  teacher: 'border-blue-200 bg-blue-50 text-blue-700',
  student: 'border-emerald-200 bg-emerald-50 text-emerald-700',
};

const formatScoreDate = (value) => {
  if (!value) return '-';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '-';
  return date.toLocaleDateString();
};

function ScoreCell({ scoreData }) {
  if (!scoreData) {
    return <span className="text-sm text-muted-foreground">N/A</span>;
  }

  return (
    <div className="flex flex-col gap-0.5">
      <span className="text-sm font-semibold text-foreground">
        {scoreData.score ?? 0} / {scoreData.total ?? 0}
      </span>
      <span className="text-xs text-muted-foreground">{formatScoreDate(scoreData.submitted_at)}</span>
    </div>
  );
}

export default function ScoreDashboard() {
  const navigate = useNavigate();
  const { showNotification } = useNotification();

  const [users, setUsers] = useState([]);
  const [pagination, setPagination] = useState(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [retryingAllFailedLogs, setRetryingAllFailedLogs] = useState(false);

  const currentUser = api.getUser() || {};
  const isAdmin = String(currentUser?.role || '').toLowerCase() === 'admin';

  useEffect(() => {
    const fetchUsers = async () => {
      try {
        setLoading(true);
        const response = await api.getAdminUsersScores({ page: currentPage, limit: PAGE_SIZE, search: searchQuery });
        if (response.success) {
          setUsers(response.data || []);
          setPagination(response.pagination || null);
          return;
        }
        showNotification('Không thể tải danh sách người dùng.', 'error');
      } catch (error) {
        console.error('Failed to fetch users:', error);
        showNotification(error?.message || 'Không thể tải danh sách người dùng.', 'error');
      } finally {
        setLoading(false);
      }
    };

    fetchUsers();
  }, [currentPage, showNotification, searchQuery]);

  const filteredUsers = useMemo(() => {
    const query = String(searchTerm || '').trim().toLowerCase();
    if (!query) return users;

    return users.filter((user) => (
      String(user?.name || '').toLowerCase().includes(query)
      || String(user?.email || '').toLowerCase().includes(query)
      || String(user?.role || '').toLowerCase().includes(query)
    ));
  }, [searchTerm, users]);

  const handleRetryAllFailedSpeakingLogs = async () => {
    if (!isAdmin || retryingAllFailedLogs) return;

    try {
      setRetryingAllFailedLogs(true);
      const response = await api.retryFailedSpeakingErrorLogsBulk({
        window_hours: 24,
        limit: 200,
      });
      const data = response?.data || {};
      const requeued = Number(data?.requeued || 0);
      const scanned = Number(data?.scanned || 0);
      showNotification(`Queued retry for ${requeued}/${scanned} failed speaking sessions.`, 'success');
    } catch (error) {
      showNotification(error?.message || 'Failed to queue bulk retry for speaking logs.', 'error');
    } finally {
      setRetryingAllFailedLogs(false);
    }
  };

  const page = Number(pagination?.page || currentPage || 1);
  const totalPages = Math.max(1, Number(pagination?.totalPages || 1));
  const totalItems = Number(pagination?.totalItems || filteredUsers.length || 0);
  const hasPrevPage = Boolean(pagination?.hasPrevPage ?? page > 1);
  const hasNextPage = Boolean(pagination?.hasNextPage ?? page < totalPages);

  return (
    <div className="mx-auto flex w-full max-w-7xl flex-col gap-6 p-4 md:p-6">
      <Card className="border-border/70 shadow-sm">
        <CardHeader className="gap-4 md:flex-row md:items-start md:justify-between">
          <div>
            <CardTitle className="text-2xl tracking-tight">User Score Dashboard</CardTitle>
            <CardDescription>
              Theo dõi điểm gần nhất của học viên và truy cập lịch sử bài làm chi tiết.
            </CardDescription>
          </div>
          <Badge variant="outline" className="w-fit rounded-full px-3 py-1 text-xs">
            {loading ? 'Loading...' : `${filteredUsers.length} users on this page`}
          </Badge>
        </CardHeader>
      </Card>

      <Card className="border-border/70 shadow-sm">
        <CardHeader className="gap-4 md:flex-row md:items-center md:justify-between">
          <div className="space-y-1">
            <CardTitle className="text-base">Search & Actions</CardTitle>
            <CardDescription>Lọc theo tên, email hoặc role.</CardDescription>
          </div>
          <div className="flex w-full flex-col gap-2 md:w-auto md:flex-row">
            <div className="relative min-w-[260px]">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={searchTerm}
                onChange={(event) => setSearchTerm(event.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    setCurrentPage(1);
                    setSearchQuery(searchTerm);
                  }
                }}
                className="pl-9"
                placeholder="Search by name, email, or role (Press Enter to search all)..."
              />
            </div>
            {isAdmin ? (
              <Button
                type="button"
                variant="outline"
                disabled={retryingAllFailedLogs}
                onClick={handleRetryAllFailedSpeakingLogs}
              >
                {retryingAllFailedLogs ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Retrying...
                  </>
                ) : (
                  <>
                    <RefreshCw className="h-4 w-4" />
                    Retry Failed Speaking Logs
                  </>
                )}
              </Button>
            ) : null}
          </div>
        </CardHeader>
      </Card>

      <Card className="border-border/70 shadow-sm">
        <CardHeader>
          <CardTitle className="text-base">Latest Scores</CardTitle>
          <CardDescription>Reading, Listening, Writing, Speaking gần nhất theo từng user.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {loading ? (
            <div className="flex min-h-[220px] items-center justify-center text-sm text-muted-foreground">
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Loading users...
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>User</TableHead>
                    <TableHead>Role</TableHead>
                    <TableHead>Reading</TableHead>
                    <TableHead>Listening</TableHead>
                    <TableHead>Writing</TableHead>
                    <TableHead>Speaking</TableHead>
                    <TableHead className="w-[220px]">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody className="[&_td]:py-4">
                  {filteredUsers.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={7} className="py-12 text-center text-sm text-muted-foreground">
                        No users found.
                      </TableCell>
                    </TableRow>
                  ) : null}

                  {filteredUsers.map((user) => {
                    const normalizedRole = String(user?.role || 'student').toLowerCase();
                    const roleBadgeClass = roleBadgeClassMap[normalizedRole] || roleBadgeClassMap.student;
                    return (
                      <TableRow key={user._id}>
                        <TableCell>
                          <div className="flex flex-col gap-0.5">
                            <span className="font-medium text-foreground">{user?.name || 'Unknown user'}</span>
                            <span className="text-xs text-muted-foreground">{user?.email || '-'}</span>
                          </div>
                        </TableCell>
                        <TableCell>
                          <Badge
                            variant="outline"
                            className={`rounded-full px-2.5 py-1 capitalize ${roleBadgeClass}`}
                          >
                            {normalizedRole}
                          </Badge>
                        </TableCell>
                        <TableCell><ScoreCell scoreData={user?.latestScores?.reading} /></TableCell>
                        <TableCell><ScoreCell scoreData={user?.latestScores?.listening} /></TableCell>
                        <TableCell><ScoreCell scoreData={user?.latestScores?.writing} /></TableCell>
                        <TableCell><ScoreCell scoreData={user?.latestScores?.speaking} /></TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <Button
                              type="button"
                              size="sm"
                              variant="outline"
                              onClick={() => navigate(`/scores/${user._id}`, { state: { userName: user?.name } })}
                            >
                              See more
                            </Button>
                            <Button
                              type="button"
                              size="sm"
                              variant="default"
                              className="bg-indigo-600 text-white hover:bg-indigo-500"
                              asChild
                            >
                              <Link to={`/analytics/student/${user._id}`}>
                                <BarChart3 className="h-4 w-4" />
                                Analytics
                              </Link>
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          )}

          {pagination ? (
            <div className="flex flex-col gap-2 border-t pt-3 text-sm sm:flex-row sm:items-center sm:justify-between">
              <span className="text-muted-foreground">
                Page {page} / {totalPages} - {totalItems} users
              </span>
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
            </div>
          ) : null}
        </CardContent>
      </Card>
    </div>
  );
}
