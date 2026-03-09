import { useEffect, useRef, useState } from 'react';
import { RefreshCcw, Search, UserRound } from 'lucide-react';
import { api } from '@/shared/api/client';
import { useNotification } from '@/shared/context/NotificationContext';
import ConfirmationModal from '@/shared/components/ConfirmationModal';
import PaginationControls from '@/shared/components/PaginationControls';
import { isStudentFamilyRole } from '@/app/roleRouting';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import '../styles/AdminPeopleWorkspace.css';

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

const PROMOTABLE_ROLES = [
  { value: 'student', label: 'Student' },
  { value: 'studentIELTS', label: 'Student IELTS' },
  { value: 'studentACA', label: 'Student ACA' },
  { value: 'teacher', label: 'Teacher' },
  { value: 'admin', label: 'Admin' },
];

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
  const [searchQuery, setSearchQuery] = useState('');
  const [bulkNames, setBulkNames] = useState('');
  const [bulkCreating, setBulkCreating] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [confirmModal, setConfirmModal] = useState({
    isOpen: false,
    title: '',
    message: '',
    onConfirm: () => { },
    isDanger: false,
  });
  const [roleChangeModal, setRoleChangeModal] = useState({
    isOpen: false,
    user: null, // { id, name, role }
    newRole: '',
  });
  const [isChangingRole, setIsChangingRole] = useState(false);

  const requestSeqRef = useRef(0);
  const { showNotification } = useNotification();

  useEffect(() => {
    setCurrentPage(1);
  }, [roleFilter, searchQuery]);

  useEffect(() => {
    const nextQuery = String(searchTerm || '').trim();
    const timer = setTimeout(() => {
      setSearchQuery((prev) => (prev === nextQuery ? prev : nextQuery));
    }, 300);
    return () => clearTimeout(timer);
  }, [searchTerm]);

  useEffect(() => {
    void fetchUsers(currentPage);
  }, [roleFilter, currentPage, searchQuery]);

  // Debounce search term to trigger backend query Automatically
  useEffect(() => {
    const handler = setTimeout(() => {
      setSearchQuery(searchTerm);
      // Reset page to 1 when search changes unless it's exactly what we already had
      // (The other useEffect already handles page 1 reset for searchQuery, but we can do it here too)
    }, 500);
    return () => clearTimeout(handler);
  }, [searchTerm]);

  const fetchUsers = async (page = 1) => {
    const requestId = requestSeqRef.current + 1;
    requestSeqRef.current = requestId;

    try {
      setLoading(true);
      setErrorMessage('');
      const res = roleFilter === 'online'
        ? await api.getOnlineStudents({ page, limit: PAGE_SIZE, search: searchQuery, q: searchQuery })
        : await api.getUsers({ role: roleFilter, page, limit: PAGE_SIZE, search: searchQuery });

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

  const submitRoleChange = async () => {
    console.log('submitRoleChange triggered');
    console.log('roleChangeModal:', roleChangeModal);
    if (!roleChangeModal.user || !roleChangeModal.newRole) {
      console.log('Abort: missing user or newRole');
      return;
    }
    try {
      console.log('Setting isChangingRole = true');
      setIsChangingRole(true);
      console.log('Calling api.changeUserRole with:', roleChangeModal.user.id, roleChangeModal.newRole);
      const res = await api.changeUserRole(roleChangeModal.user.id, roleChangeModal.newRole);
      console.log('API response:', res);
      if (res.success) {
        showNotification('User role updated successfully.', 'success');
        setRoleChangeModal({ isOpen: false, user: null, newRole: '' });
        void fetchUsers(currentPage);
      } else {
        console.log('API returned non-success:', res);
      }
    } catch (error) {
      console.error('Error during role change:', error);
      showNotification(error?.message || 'Failed to update user role.', 'error');
    } finally {
      setIsChangingRole(false);
    }
  };

  // We rely fully on server-side search now, no more local filtering.

  const totalCount = Number(pagination?.totalItems || users.length || 0);
  const hasSearch = String(searchQuery || searchTerm || '').trim().length > 0;

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
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    setSearchQuery(String(searchTerm || '').trim());
                  }
                }}
                placeholder="Search by name or email..."
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
            {hasSearch ? <Search className="admin-people-empty-icon" /> : <UserRound className="admin-people-empty-icon" />}
            <h3>{hasSearch ? 'No Matching Results' : 'No Users Found'}</h3>
            <p>
              {hasSearch
                ? `No users match "${searchQuery.trim()}".`
                : roleFilter === 'online'
                  ? 'No students are currently online.'
                  : 'No users are available for this filter.'}
            </p>
          </div>

        ) : (
          <div className="admin-people-list">
            {users.map((user) => {
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
                    {isAdminUser && role !== 'admin' && userId !== currentUser?._id ? (
                      <button
                        type="button"
                        className="admin-people-btn admin-people-btn-outline"
                        onClick={() => setRoleChangeModal({
                          isOpen: true,
                          user: { id: userId, name: user?.name || user?.email || 'Unknown', role },
                          newRole: role,
                        })}
                      >
                        Change Role
                      </button>
                    ) : null}
                    {isAdminUser && role !== 'admin' && userId !== currentUser?._id ? (
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

      {/* Role Change Modal */}
      <Dialog
        open={roleChangeModal.isOpen}
        onOpenChange={(open) => {
          if (!open && !isChangingRole) {
            setRoleChangeModal({ isOpen: false, user: null, newRole: '' })
          }
        }}
      >
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>Change Role</DialogTitle>
            <DialogDescription>
              Select a new role for <strong>{roleChangeModal.user?.name}</strong>.
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-4 py-4" style={{ zIndex: 60, position: 'relative' }}>
            <div className="flex flex-col gap-2">
              <label htmlFor="role-select" className="text-sm font-medium leading-none">
                Role
              </label>
              <select
                id="role-select"
                value={roleChangeModal.newRole}
                onChange={(e) => setRoleChangeModal(prev => ({ ...prev, newRole: e.target.value }))}
                style={{
                  width: '100%',
                  border: '1px solid #cbd5e1',
                  borderRadius: '6px',
                  background: '#ffffff',
                  color: '#0f172a',
                  fontSize: '0.95rem',
                  fontWeight: 500,
                  padding: '0.65rem 0.75rem',
                  outline: 'none',
                }}
                disabled={isChangingRole}
              >
                {PROMOTABLE_ROLES.map(r => (
                  <option key={r.value} value={r.value}>{r.label}</option>
                ))}
              </select>
            </div>
          </div>

          <DialogFooter className="mt-4">
            <button
              type="button"
              className="px-4 py-2 border border-slate-300 rounded-md text-slate-700 bg-white hover:bg-slate-50 disabled:opacity-50"
              onClick={() => setRoleChangeModal({ isOpen: false, user: null, newRole: '' })}
              disabled={isChangingRole}
            >
              Cancel
            </button>
            <button
              type="button"
              className="px-4 py-2 rounded-md font-semibold text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-50"
              onClick={submitRoleChange}
              disabled={isChangingRole || roleChangeModal.newRole === roleChangeModal.user?.role}
            >
              {isChangingRole ? 'Saving...' : 'Save Changes'}
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
