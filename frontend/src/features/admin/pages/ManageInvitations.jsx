import { useState, useEffect } from 'react';
import { api } from '@/shared/api/client';
import { useNotification } from '@/shared/context/NotificationContext';
import PaginationControls from '@/shared/components/PaginationControls';
import { Mail, Send, Clock, CheckCircle, XCircle, UserPlus } from 'lucide-react';
import './Manage.css';

const STATUS_CONFIG = {
    pending: { label: 'Đang chờ', color: '#f59e0b', bg: '#fef3c7', Icon: Clock },
    accepted: { label: 'Đã chấp nhận', color: '#10b981', bg: '#d1fae5', Icon: CheckCircle },
    expired: { label: 'Hết hạn', color: '#ef4444', bg: '#fee2e2', Icon: XCircle },
};

const ROLE_LABEL = { teacher: 'Giáo viên', admin: 'Quản trị viên' };

export default function ManageInvitations() {
    const PAGE_SIZE = 20;
    const [invitations, setInvitations] = useState([]);
    const [pagination, setPagination] = useState(null);
    const [currentPage, setCurrentPage] = useState(1);
    const [loading, setLoading] = useState(true);
    const [statusFilter, setStatusFilter] = useState('');

    const [inviteForm, setInviteForm] = useState({ email: '', role: 'teacher' });
    const [sending, setSending] = useState(false);

    const { showNotification } = useNotification();

    useEffect(() => {
        setCurrentPage(1);
    }, [statusFilter]);

    useEffect(() => {
        fetchInvitations(currentPage);
    }, [statusFilter, currentPage]);

    const fetchInvitations = async (page = 1) => {
        try {
            setLoading(true);
            const params = { page, limit: PAGE_SIZE };
            if (statusFilter) params.status = statusFilter;
            const res = await api.getInvitations(params);
            if (res.success) {
                setInvitations(res.data);
                setPagination(res.pagination || null);
            }
        } catch (error) {
            console.error('Failed to fetch invitations:', error);
            showNotification('Không thể tải danh sách lời mời', 'error');
        } finally {
            setLoading(false);
        }
    };

    const handleSendInvite = async (e) => {
        e.preventDefault();

        const email = inviteForm.email.trim();
        if (!email) {
            showNotification('Vui lòng nhập email', 'error');
            return;
        }

        setSending(true);
        try {
            const res = await api.sendInvitation({ email, role: inviteForm.role });
            if (res.success) {
                showNotification('Đã gửi lời mời thành công!', 'success');
                setInviteForm({ email: '', role: 'teacher' });
                fetchInvitations(1);
                setCurrentPage(1);
            }
        } catch (error) {
            showNotification(error.message || 'Gửi lời mời thất bại', 'error');
        } finally {
            setSending(false);
        }
    };

    const formatDate = (dateStr) => {
        if (!dateStr) return '—';
        return new Date(dateStr).toLocaleDateString('vi-VN', {
            day: '2-digit', month: '2-digit', year: 'numeric',
            hour: '2-digit', minute: '2-digit',
        });
    };

    const filterButtons = [
        { value: '', label: 'Tất cả' },
        { value: 'pending', label: 'Đang chờ' },
        { value: 'accepted', label: 'Đã chấp nhận' },
        { value: 'expired', label: 'Hết hạn' },
    ];

    return (
        <div className="manage-container">
            <div className="manage-header">
                <h2>Quản lý lời mời</h2>
            </div>

            <div className="manage-content">
                {/* Invite Form */}
                <form onSubmit={handleSendInvite} style={{
                    display: 'flex', gap: '0.75rem', marginBottom: '1.5rem',
                    padding: '1.25rem', background: 'var(--surface-1, #f8fafc)',
                    borderRadius: '12px', border: '1px solid var(--border, #e2e8f0)',
                    flexWrap: 'wrap', alignItems: 'flex-end',
                }}>
                    <div style={{ flex: '1 1 250px' }}>
                        <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: '#64748b', marginBottom: '0.35rem' }}>
                            Email
                        </label>
                        <div style={{ position: 'relative' }}>
                            <Mail size={16} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: '#94a3b8' }} />
                            <input
                                type="email"
                                value={inviteForm.email}
                                onChange={(e) => setInviteForm({ ...inviteForm, email: e.target.value })}
                                placeholder="example@email.com"
                                required
                                style={{
                                    width: '100%', padding: '0.6rem 0.75rem 0.6rem 2.25rem',
                                    borderRadius: '8px', border: '1px solid #e2e8f0',
                                    fontSize: '0.9rem', outline: 'none', boxSizing: 'border-box',
                                }}
                            />
                        </div>
                    </div>

                    <div style={{ flex: '0 0 160px' }}>
                        <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: '#64748b', marginBottom: '0.35rem' }}>
                            Vai trò
                        </label>
                        <select
                            value={inviteForm.role}
                            onChange={(e) => setInviteForm({ ...inviteForm, role: e.target.value })}
                            style={{
                                width: '100%', padding: '0.6rem 0.75rem',
                                borderRadius: '8px', border: '1px solid #e2e8f0',
                                fontSize: '0.9rem', outline: 'none', cursor: 'pointer',
                            }}
                        >
                            <option value="teacher">Giáo viên</option>
                            <option value="admin">Quản trị viên</option>
                        </select>
                    </div>

                    <button
                        type="submit"
                        disabled={sending}
                        style={{
                            display: 'flex', alignItems: 'center', gap: '0.5rem',
                            padding: '0.6rem 1.25rem', borderRadius: '8px', border: 'none',
                            background: '#6366F1', color: 'white', fontWeight: 600,
                            fontSize: '0.9rem', cursor: sending ? 'not-allowed' : 'pointer',
                            opacity: sending ? 0.7 : 1, transition: 'opacity 0.2s',
                            whiteSpace: 'nowrap',
                        }}
                    >
                        <Send size={16} />
                        {sending ? 'Đang gửi...' : 'Gửi lời mời'}
                    </button>
                </form>

                {/* Status Filter */}
                <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1.25rem', flexWrap: 'wrap' }}>
                    {filterButtons.map(({ value, label }) => (
                        <button
                            key={value}
                            onClick={() => setStatusFilter(value)}
                            style={{
                                background: statusFilter === value ? '#6366F1' : 'transparent',
                                color: statusFilter === value ? 'white' : '#64748b',
                                border: '1px solid #e2e8f0', padding: '0.45rem 0.9rem',
                                borderRadius: '0.5rem', fontWeight: 600, cursor: 'pointer',
                                fontSize: '0.85rem', transition: 'all 0.2s',
                            }}
                        >
                            {label}
                        </button>
                    ))}
                </div>

                {/* Invitation List */}
                {loading ? (
                    <div style={{ textAlign: 'center', padding: '2rem', color: '#64748b' }}>Đang tải...</div>
                ) : (
                    <div className="manage-list">
                        {invitations.length === 0 ? (
                            <div style={{ textAlign: 'center', padding: '3rem 1rem', color: '#94a3b8' }}>
                                <UserPlus size={40} style={{ marginBottom: '0.75rem', opacity: 0.4 }} />
                                <p>Chưa có lời mời nào</p>
                            </div>
                        ) : (
                            invitations.map((inv) => {
                                const status = STATUS_CONFIG[inv.status] || STATUS_CONFIG.pending;
                                const StatusIcon = status.Icon;

                                return (
                                    <div key={inv._id} className="list-item" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.5rem' }}>
                                        <div className="item-info" style={{ flex: 1, minWidth: 200 }}>
                                            <span className="item-title" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                                {inv.email}
                                                <span style={{
                                                    fontSize: '0.7rem', padding: '2px 8px', borderRadius: '4px',
                                                    background: inv.role === 'admin' ? '#fee2e2' : '#e0f2fe',
                                                    color: inv.role === 'admin' ? '#ef4444' : '#0ea5e9',
                                                    fontWeight: 600,
                                                }}>
                                                    {ROLE_LABEL[inv.role] || inv.role}
                                                </span>
                                            </span>
                                            <span className="item-meta" style={{ fontSize: '0.8rem', color: '#94a3b8' }}>
                                                Gửi: {formatDate(inv.createdAt)}
                                                {inv.invitedBy && ` • bởi ${inv.invitedBy.name || inv.invitedBy.email || '—'}`}
                                            </span>
                                        </div>

                                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                            <span style={{
                                                display: 'inline-flex', alignItems: 'center', gap: '0.3rem',
                                                fontSize: '0.8rem', padding: '4px 10px', borderRadius: '6px',
                                                background: status.bg, color: status.color, fontWeight: 600,
                                            }}>
                                                <StatusIcon size={14} />
                                                {status.label}
                                            </span>
                                            {inv.status === 'pending' && (
                                                <span style={{ fontSize: '0.75rem', color: '#94a3b8' }}>
                                                    Hết hạn: {formatDate(inv.expiresAt)}
                                                </span>
                                            )}
                                        </div>
                                    </div>
                                );
                            })
                        )}
                    </div>
                )}

                <PaginationControls
                    pagination={pagination}
                    onPageChange={setCurrentPage}
                    loading={loading}
                    itemLabel="lời mời"
                />
            </div>
        </div>
    );
}
