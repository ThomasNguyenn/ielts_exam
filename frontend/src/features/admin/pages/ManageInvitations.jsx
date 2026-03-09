import { useEffect, useMemo, useRef, useState } from 'react';
import { Clock3, Mail, MailPlus, SearchX, Send, Trash2 } from 'lucide-react';
import { api } from '@/shared/api/client';
import { useNotification } from '@/shared/context/NotificationContext';
import ConfirmationModal from '@/shared/components/ConfirmationModal';
import PaginationControls from '@/shared/components/PaginationControls';
import '../styles/AdminPeopleWorkspace.css';

const STATUS_CONFIG = {
  pending: { label: 'Pending', className: 'admin-people-chip admin-people-chip--pending' },
  accepted: { label: 'Accepted', className: 'admin-people-chip admin-people-chip--accepted' },
  expired: { label: 'Expired', className: 'admin-people-chip admin-people-chip--expired' },
};

const STATUS_FILTERS = [
  { value: '', label: 'All' },
  { value: 'pending', label: 'Pending' },
  { value: 'accepted', label: 'Accepted' },
  { value: 'expired', label: 'Expired' },
];

const ROLE_LABEL = {
  teacher: 'Teacher',
  admin: 'Admin',
};

const ROLE_CHIP_CLASS = {
  admin: 'admin-people-chip admin-people-chip--admin',
  teacher: 'admin-people-chip admin-people-chip--teacher',
};

export default function ManageInvitations() {
  const PAGE_SIZE = 20;

  const [invitations, setInvitations] = useState([]);
  const [pagination, setPagination] = useState(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState('');
  const [errorMessage, setErrorMessage] = useState('');

  const [inviteForm, setInviteForm] = useState({ email: '', role: 'teacher' });
  const [sending, setSending] = useState(false);
  const [deletingId, setDeletingId] = useState('');
  const [confirmModal, setConfirmModal] = useState({
    isOpen: false,
    title: '',
    message: '',
    onConfirm: () => { },
    isDanger: true,
  });

  const requestSeqRef = useRef(0);
  const { showNotification } = useNotification();

  useEffect(() => {
    setCurrentPage(1);
  }, [statusFilter]);

  useEffect(() => {
    void fetchInvitations(currentPage);
  }, [statusFilter, currentPage]);

  const fetchInvitations = async (page = 1) => {
    const requestId = requestSeqRef.current + 1;
    requestSeqRef.current = requestId;

    try {
      setLoading(true);
      setErrorMessage('');
      const params = { page, limit: PAGE_SIZE };
      if (statusFilter) params.status = statusFilter;

      const res = await api.getInvitations(params);
      if (requestId !== requestSeqRef.current) return;

      if (res.success) {
        setInvitations(Array.isArray(res.data) ? res.data : []);
        setPagination(res.pagination || null);
      } else {
        setInvitations([]);
        setPagination(null);
      }
    } catch (error) {
      if (requestId !== requestSeqRef.current) return;
      setErrorMessage(error?.message || 'Failed to load invitations.');
      setInvitations([]);
      setPagination(null);
      showNotification(error?.message || 'Failed to load invitations.', 'error');
    } finally {
      if (requestId === requestSeqRef.current) {
        setLoading(false);
      }
    }
  };

  const handleSendInvite = async (event) => {
    event.preventDefault();

    const email = String(inviteForm.email || '').trim();
    if (!email) {
      showNotification('Please enter an email address.', 'error');
      return;
    }

    setSending(true);
    try {
      const res = await api.sendInvitation({ email, role: inviteForm.role });
      if (res.success) {
        showNotification('Invitation sent successfully.', 'success');
        setInviteForm({ email: '', role: 'teacher' });
        setCurrentPage(1);
        void fetchInvitations(1);
      }
    } catch (error) {
      showNotification(error?.message || 'Failed to send invitation.', 'error');
    } finally {
      setSending(false);
    }
  };

  const requestDeleteInvitation = (invitation) => {
    const invitationId = String(invitation?._id || '').trim();
    if (!invitationId) return;

    setConfirmModal({
      isOpen: true,
      title: 'Delete Invitation',
      message: `Delete invitation sent to ${invitation?.email || 'this user'}?`,
      isDanger: true,
      onConfirm: async () => {
        setDeletingId(invitationId);
        try {
          const res = await api.deleteInvitation(invitationId);
          if (res.success) {
            showNotification('Invitation deleted.', 'success');
            const shouldGoPrevPage = invitations.length === 1 && currentPage > 1;
            if (shouldGoPrevPage) {
              setCurrentPage((prev) => Math.max(1, prev - 1));
            } else {
              void fetchInvitations(currentPage);
            }
          }
        } catch (error) {
          showNotification(error?.message || 'Failed to delete invitation.', 'error');
        } finally {
          setDeletingId('');
        }
      },
    });
  };

  const formatDateTime = (value) => {
    if (!value) return 'N/A';
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return 'N/A';
    return date.toLocaleString('en-US', {
      year: 'numeric',
      month: 'short',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const totalCount = useMemo(() => Number(pagination?.totalItems || invitations.length || 0), [pagination?.totalItems, invitations.length]);

  return (
    <div className="admin-people-shell">
      <section className="admin-people-hero">
        <div className="admin-people-title-row">
          <div>
            <h1>Manage Invitations</h1>
            <p>Send and track invitation links for teacher and admin accounts.</p>
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
        <article className="admin-people-form-card">
          <h2 className="admin-people-form-title">
            <MailPlus size={16} />
            Send New Invitation
          </h2>
          <p className="admin-people-form-help">
            Invitations are valid for 48 hours after being sent.
          </p>

          <form onSubmit={handleSendInvite} className="admin-people-invite-grid">
            <div className="admin-people-field">
              <label htmlFor="invite-email">Recipient Email</label>
              <div className="admin-people-field-icon-wrap">
                <Mail className="admin-people-field-icon" />
                <input
                  id="invite-email"
                  type="email"
                  value={inviteForm.email}
                  onChange={(event) => setInviteForm((prev) => ({ ...prev, email: event.target.value }))}
                  placeholder="name@example.com"
                  autoComplete="email"
                  required
                />
              </div>
            </div>

            <div className="admin-people-field">
              <label htmlFor="invite-role">Role</label>
              <select
                id="invite-role"
                value={inviteForm.role}
                onChange={(event) => setInviteForm((prev) => ({ ...prev, role: event.target.value }))}
              >
                <option value="teacher">Teacher</option>
                <option value="admin">Admin</option>
              </select>
            </div>

            <button
              type="submit"
              className="admin-people-btn admin-people-btn-primary"
              disabled={sending}
            >
              <Send size={14} />
              {sending ? 'Sending...' : 'Send Invite'}
            </button>
          </form>
        </article>

        <div className="admin-people-toolbar">
          <div className="admin-people-filter-group" role="tablist" aria-label="Invitation status filters">
            {STATUS_FILTERS.map((filter) => (
              <button
                key={filter.value || 'all'}
                type="button"
                className={`admin-people-pill ${statusFilter === filter.value ? 'active' : ''}`}
                onClick={() => setStatusFilter(filter.value)}
              >
                {filter.label}
              </button>
            ))}
          </div>
        </div>

        {loading ? (
          <div className="admin-people-skeleton-list" aria-hidden="true">
            {Array.from({ length: 5 }).map((_, index) => (
              <div key={`invitation-skeleton-${index}`} className="admin-people-skeleton-card" />
            ))}
          </div>
        ) : invitations.length === 0 ? (
          <div className="admin-people-empty">
            <SearchX className="admin-people-empty-icon" />
            <h3>No Invitations Found</h3>
            <p>
              {statusFilter
                ? `No invitations are currently marked as ${statusFilter}.`
                : 'Create a new invitation to get started.'}
            </p>
          </div>
        ) : (
          <div className="admin-people-list">
            {invitations.map((invitation) => {
              const invitationId = String(invitation?._id || '');
              const role = String(invitation?.role || 'teacher');
              const roleLabel = ROLE_LABEL[role] || role;
              const roleClass = ROLE_CHIP_CLASS[role] || ROLE_CHIP_CLASS.teacher;
              const statusKey = String(invitation?.status || 'pending');
              const statusMeta = STATUS_CONFIG[statusKey] || STATUS_CONFIG.pending;
              const isDeleting = deletingId === invitationId;

              return (
                <article key={invitationId} className="admin-people-card">
                  <div className="admin-people-card-main">
                    <span className="admin-people-avatar">{String(invitation?.email || '?').charAt(0).toUpperCase()}</span>
                    <div className="admin-people-identity">
                      <p className="admin-people-name">
                        {invitation?.email || 'Unknown email'}
                        <span className={roleClass}>{roleLabel}</span>
                        <span className={statusMeta.className}>{statusMeta.label}</span>
                      </p>
                      <p className="admin-people-email">
                        Sent {formatDateTime(invitation?.createdAt)}
                        {invitation?.invitedBy ? ` | by ${invitation?.invitedBy?.name || invitation?.invitedBy?.email || 'Unknown'}` : ''}
                      </p>
                      {statusKey === 'pending' ? (
                        <span className="admin-people-meta">
                          <Clock3 size={12} />
                          Expires {formatDateTime(invitation?.expiresAt)}
                        </span>
                      ) : null}
                    </div>
                  </div>

                  <div className="admin-people-card-actions">
                    <button
                      type="button"
                      className="admin-people-btn admin-people-btn-danger"
                      onClick={() => requestDeleteInvitation(invitation)}
                      disabled={isDeleting || !invitationId}
                    >
                      <Trash2 size={14} />
                      {isDeleting ? 'Deleting...' : 'Delete'}
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
            itemLabel="invitations"
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

