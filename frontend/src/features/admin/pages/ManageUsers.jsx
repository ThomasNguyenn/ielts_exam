import { useEffect, useMemo, useRef, useState } from 'react';
import { RefreshCcw, Search, UserRound } from 'lucide-react';
import { api } from '@/shared/api/client';
import { useNotification } from '@/shared/context/NotificationContext';
import ConfirmationModal from '@/shared/components/ConfirmationModal';
import PaginationControls from '@/shared/components/PaginationControls';
import { isStudentFamilyRole } from '@/app/roleRouting';
import './AdminPeopleWorkspace.css';

const ROLE_FILTERS = [
  { value: '', label: 'All' },
  { value: 'student', label: 'Students' },
  { value: 'teacher', label: 'Teachers' },
  { value: 'online', label: 'Online Students' },
];

const ROLE_CHIP_CLASS = {
  admin: 'admin-people-chip admin-people-chip--admin',
  teacher: 'admin-people-chip admin-people-chip--teacher',
  student: 'admin-people-chip admin-people-chip--student',
  studentIELTS: 'admin-people-chip admin-people-chip--student',
  studentACA: 'admin-people-chip admin-people-chip--student',
};

export default function ManageUsers() {
  const PAGE_SIZE = 20;
  const currentUser = api.getUser();
  const isAdminUser = currentUser?.role === 'admin';

  const [users, setUsers] = useState([]);
  const [pagination, setPagination] = useState(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [roleFilter, setRoleFilter] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [bulkNames, setBulkNames] = useState('');
  const [bulkCreating, setBulkCreating] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [confirmModal, setConfirmModal] = useState({
    isOpen: false,
    title: '',
    message: '',
    onConfirm: () => {},
    isDanger: false,
  });
  const requestSeqRef = useRef(0);
  const { showNotification } = useNotification();

  useEffect(() => {
    setCurrentPage(1);
  }, [roleFilter]);

  useEffect(() => {
    void fetchUsers(currentPage);
  }, [roleFilter, currentPage]);

  const fetchUsers = async (page = 1) => {
    const requestId = requestSeqRef.current + 1;
    requestSeqRef.current = requestId;

    try {
      setLoading(true);
      setErrorMessage('');
      const res = roleFilter === 'online'
        ? await api.getOnlineStudents({ page, limit: PAGE_SIZE })
        : await api.getUsers({ role: roleFilter, page, limit: PAGE_SIZE });

      if (requestId !== requestSeqRef.current) return;

      if (res.success) {
        setUsers(Array.isArray(res.data) ? res.data : []);
        setPagination(res.pagination || null);
      } else {
        setUsers([]);
        setPagination(null);
      }
    } catch (error) {
      if (requestId !== requestSeqRef.current) return;
      setErrorMessage(error?.message || 'Failed to fetch users.');
      setUsers([]);
      setPagination(null);
      showNotification(error?.message || 'Failed to fetch users.', 'error');
    } finally {
      if (requestId === requestSeqRef.current) {
        setLoading(false);
      }
    }
  };

  const handleBulkCreate = async () => {
    const names = String(bulkNames || '').trim();
    if (!names) {
      showNotification('Please enter student names (one per line).', 'error');
      return;
    }

    try {
      setBulkCreating(true);
      const res = await api.createBulkStudents({ rawNames: names });
      const createdCount = Array.isArray(res?.data?.students) ? res.data.students.length : 0;
      showNotification(`Created ${createdCount} student account(s). Default password: Scots2026`, 'success');
      setBulkNames('');
      setRoleFilter('student');
      setCurrentPage(1);
      void fetchUsers(1);
    } catch (error) {
      showNotification(error?.message || 'Failed to create bulk student accounts.', 'error');
    } finally {
      setBulkCreating(false);
    }
  };

  const handleDelete = (userId, userName) => {
    if (!isAdminUser) {
      showNotification('Only admin can delete users.', 'error');
      return;
    }

    setConfirmModal({
      isOpen: true,
      title: 'Delete User',
      message: `Are you sure you want to delete "${userName}"? This action cannot be undone.`,
      isDanger: true,
      onConfirm: async () => {
        try {
          const res = await api.deleteUser(userId);
          if (res.success) {
            showNotification('User deleted successfully.', 'success');
            const nextPage = users.length === 1 && currentPage > 1 ? currentPage - 1 : currentPage;
            setCurrentPage(nextPage);
            void fetchUsers(nextPage);
          }
        } catch (error) {
          showNotification(error?.message || 'Failed to delete user.', 'error');
        }
      },
    });
  };

  const filteredUsers = useMemo(() => {
    const keyword = String(searchTerm || '').trim().toLowerCase();
    if (!keyword) return users;
    return users.filter((user) => (
      String(user?.name || '').toLowerCase().includes(keyword)
      || String(user?.email || '').toLowerCase().includes(keyword)
    ));
  }, [users, searchTerm]);

  const totalCount = Number(pagination?.totalItems || users.length || 0);
  const hasSearch = String(searchTerm || '').trim().length > 0;

  return (
    <div className="admin-people-shell">
      <section className="admin-people-hero">
        <div className="admin-people-title-row">
          <div>
            <h1>Manage Users</h1>
            <p>Review account roles, monitor online students, and manage access.</p>
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
        <div className="admin-people-form-card" style={{ marginBottom: '0.85rem' }}>
          <h3 className="admin-people-form-title">Create Bulk Student</h3>
          <p className="admin-people-form-help">
            Enter one student name per line. Email will be auto-generated from name + order index.
            Default password is <strong>Scots2026</strong>.
          </p>
          <div className="admin-people-field">
            <label htmlFor="bulk-student-list">Student names</label>
            <textarea
              id="bulk-student-list"
              value={bulkNames}
              onChange={(event) => setBulkNames(event.target.value)}
              placeholder={'Nguyen Van A\nTran Thi B\nLe Minh C'}
              rows={6}
              style={{
                width: '100%',
                border: '1px solid #e2e8f0',
                borderRadius: '10px',
                background: '#ffffff',
                color: '#0f172a',
                fontSize: '0.88rem',
                fontWeight: 500,
                padding: '0.55rem 0.75rem',
              }}
            />
          </div>
          <div style={{ marginTop: '0.65rem' }}>
            <button
              type="button"
              className="admin-people-btn admin-people-btn-primary"
              onClick={handleBulkCreate}
              disabled={bulkCreating}
            >
              {bulkCreating ? 'Creating...' : 'Create Bulk Student'}
            </button>
          </div>
        </div>

        <div className="admin-people-toolbar">
          <div className="admin-people-filter-group" role="tablist" aria-label="User role filters">
            {ROLE_FILTERS.map((filter) => (
              <button
                key={filter.value || 'all'}
                type="button"
                className={`admin-people-pill ${roleFilter === filter.value ? 'active' : ''}`}
                onClick={() => setRoleFilter(filter.value)}
              >
                {filter.label}
              </button>
            ))}
          </div>

          <div className="admin-people-card-actions">
            <div className="admin-people-search">
              <Search className="admin-people-search-icon" />
              <input
                type="search"
                value={searchTerm}
                onChange={(event) => setSearchTerm(event.target.value)}
                placeholder="Search by name or email"
                aria-label="Search users"
              />
            </div>
            {roleFilter === 'online' ? (
              <button
                type="button"
                className="admin-people-btn admin-people-btn-outline"
                onClick={() => void fetchUsers(currentPage)}
                disabled={loading}
              >
                <RefreshCcw size={14} />
                Refresh
              </button>
            ) : null}
          </div>
        </div>

        {loading ? (
          <div className="admin-people-skeleton-list" aria-hidden="true">
            {Array.from({ length: 6 }).map((_, index) => (
              <div key={`users-skeleton-${index}`} className="admin-people-skeleton-card" />
            ))}
          </div>
        ) : users.length === 0 ? (
          <div className="admin-people-empty">
            <UserRound className="admin-people-empty-icon" />
            <h3>No Users Found</h3>
            <p>
              {roleFilter === 'online'
                ? 'No students are currently online.'
                : 'No users are available for this filter.'}
            </p>
          </div>
        ) : filteredUsers.length === 0 ? (
          <div className="admin-people-empty">
            <Search className="admin-people-empty-icon" />
            <h3>No Matching Results</h3>
            <p>
              {hasSearch
                ? `No users match "${searchTerm.trim()}".`
                : 'Try another keyword or clear the search input.'}
            </p>
          </div>
        ) : (
          <div className="admin-people-list">
            {filteredUsers.map((user) => {
              const userId = String(user?._id || '');
              const role = String(user?.role || 'student');
              const roleClass = ROLE_CHIP_CLASS[role] || ROLE_CHIP_CLASS.student;

              return (
                <article key={userId} className="admin-people-card">
                  <div className="admin-people-card-main">
                    <span className="admin-people-avatar">
                      {String(user?.name || '?').trim().charAt(0).toUpperCase() || '?'}
                    </span>
                    <div className="admin-people-identity">
                      <p className="admin-people-name">
                        {user?.name || 'Unknown User'}
                        <span className={roleClass}>{role}</span>
                        {isStudentFamilyRole(role) && user?.is_online ? (
                          <span className="admin-people-chip admin-people-chip--online">Online</span>
                        ) : null}
                      </p>
                      <p className="admin-people-email">{user?.email || 'No email'}</p>
                    </div>
                  </div>
                  <div className="admin-people-card-actions">
                    {isAdminUser && role !== 'admin' ? (
                      <button
                        type="button"
                        className="admin-people-btn admin-people-btn-danger"
                        onClick={() => handleDelete(userId, user?.name || user?.email || 'this user')}
                      >
                        Delete
                      </button>
                    ) : null}
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
            itemLabel="users"
            variant="compact-admin"
            className="admin-people-pagination"
          />
        </div>
      </section>

      <ConfirmationModal
        isOpen={confirmModal.isOpen}
        onClose={() => setConfirmModal((prev) => ({ ...prev, isOpen: false }))}
        onConfirm={confirmModal.onConfirm}
        title={confirmModal.title}
        message={confirmModal.message}
        isDanger={confirmModal.isDanger}
      />
    </div>
  );
}
