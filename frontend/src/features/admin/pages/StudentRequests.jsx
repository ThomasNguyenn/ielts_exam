import { useEffect, useMemo, useState } from 'react';
import { Check, Clock3, MailSearch, ShieldCheck, UserRound } from 'lucide-react';
import { api } from '@/shared/api/client';
import { useNotification } from '@/shared/context/NotificationContext';
import PaginationControls from '@/shared/components/PaginationControls';
import './AdminPeopleWorkspace.css';

export default function StudentRequests() {
  const PAGE_SIZE = 20;
  const [students, setStudents] = useState([]);
  const [pagination, setPagination] = useState(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [approvingId, setApprovingId] = useState('');
  const [errorMessage, setErrorMessage] = useState('');
  const { showNotification } = useNotification();

  useEffect(() => {
    void fetchPendingStudents(currentPage);
  }, [currentPage]);

  const fetchPendingStudents = async (page = 1) => {
    try {
      setLoading(true);
      setErrorMessage('');
      const res = await api.getPendingStudents({ page, limit: PAGE_SIZE });
      if (res.success) {
        setStudents(Array.isArray(res.data) ? res.data : []);
        setPagination(res.pagination || null);
      }
    } catch (error) {
      setErrorMessage(error?.message || 'Failed to load pending requests.');
      showNotification('Failed to load pending requests.', 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleApprove = async (studentId) => {
    if (approvingId) return;
    setApprovingId(String(studentId || ''));

    try {
      const res = await api.approveStudent(studentId);
      if (res.success) {
        showNotification('Student approved successfully.', 'success');
        const nextPage = students.length === 1 && currentPage > 1 ? currentPage - 1 : currentPage;
        setCurrentPage(nextPage);
        void fetchPendingStudents(nextPage);
      }
    } catch (error) {
      showNotification(error?.message || 'Failed to approve student.', 'error');
    } finally {
      setApprovingId('');
    }
  };

  const getInitials = (name) => {
    return String(name || '')
      .split(' ')
      .map((part) => part[0])
      .slice(0, 2)
      .join('')
      .toUpperCase();
  };

  const formatRelativeTime = (value) => {
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return 'Unknown time';

    const diffMs = Date.now() - date.getTime();
    const diffSec = Math.max(1, Math.floor(diffMs / 1000));
    if (diffSec < 60) return `${diffSec}s ago`;

    const diffMin = Math.floor(diffSec / 60);
    if (diffMin < 60) return `${diffMin}m ago`;

    const diffHour = Math.floor(diffMin / 60);
    if (diffHour < 24) return `${diffHour}h ago`;

    const diffDay = Math.floor(diffHour / 24);
    if (diffDay < 30) return `${diffDay}d ago`;

    const diffMonth = Math.floor(diffDay / 30);
    if (diffMonth < 12) return `${diffMonth}mo ago`;

    return `${Math.floor(diffMonth / 12)}y ago`;
  };

  const totalCount = useMemo(() => Number(pagination?.totalItems || students.length || 0), [pagination?.totalItems, students.length]);

  return (
    <div className="admin-people-shell">
      <section className="admin-people-hero">
        <div className="admin-people-title-row">
          <div>
            <h1>Student Registration Requests</h1>
            <p>Approve pending student accounts before they can access the platform.</p>
          </div>
          <span className="admin-people-count-chip">{totalCount}</span>
        </div>
        {errorMessage ? (
          <div className="admin-people-alert" role="status">
            {errorMessage}
          </div>
        ) : null}
      </section>

      <section className="admin-people-panel">
        {loading ? (
          <div className="admin-people-skeleton-list" aria-hidden="true">
            {Array.from({ length: 5 }).map((_, index) => (
              <div key={`pending-skeleton-${index}`} className="admin-people-skeleton-card" />
            ))}
          </div>
        ) : students.length === 0 ? (
          <div className="admin-people-empty">
            <MailSearch className="admin-people-empty-icon" />
            <h3>No Pending Requests</h3>
            <p>All student registrations are currently approved.</p>
          </div>
        ) : (
          <div className="admin-people-list">
            {students.map((student) => {
              const studentId = String(student?._id || '');
              const isApproving = approvingId === studentId;

              return (
                <article className="admin-people-card" key={studentId}>
                  <div className="admin-people-card-main">
                    <span className="admin-people-avatar">{getInitials(student?.name)}</span>
                    <div className="admin-people-identity">
                      <p className="admin-people-name">
                        {student?.name || 'Unknown Student'}
                        <span className="admin-people-chip admin-people-chip--student">
                          <UserRound size={11} />
                          Student
                        </span>
                      </p>
                      <p className="admin-people-email">{student?.email || 'No email'}</p>
                      <span className="admin-people-meta">
                        <Clock3 size={12} />
                        Requested {formatRelativeTime(student?.createdAt)}
                      </span>
                    </div>
                  </div>
                  <div className="admin-people-card-actions">
                    <button
                      type="button"
                      className="admin-people-btn admin-people-btn-primary"
                      disabled={isApproving}
                      onClick={() => handleApprove(studentId)}
                    >
                      {isApproving ? (
                        <>
                          <ShieldCheck size={14} />
                          Approving...
                        </>
                      ) : (
                        <>
                          <Check size={14} />
                          Approve
                        </>
                      )}
                    </button>
                  </div>
                </article>
              );
            })}
          </div>
        )}

        <div className="admin-people-pagination-wrap">
          <PaginationControls
            pagination={pagination}
            onPageChange={setCurrentPage}
            loading={loading}
            itemLabel="requests"
            variant="compact-admin"
            className="admin-people-pagination"
          />
        </div>
      </section>
    </div>
  );
}

