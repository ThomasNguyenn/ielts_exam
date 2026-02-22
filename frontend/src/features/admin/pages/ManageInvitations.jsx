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

            <div className="manage-content" style={{ padding: '2rem' }}>
                {/* Invite Form Card */}
                <div style={{
                    background: 'var(--manage-bg-white)',
                    borderRadius: '1.25rem',
                    border: '2px solid var(--manage-border)',
                    padding: '1.5rem 2rem',
                    marginBottom: '2rem',
                    boxShadow: 'var(--shadow-sm)'
                }}>
                    <h3 style={{
                        fontSize: '1.1rem',
                        fontWeight: 700,
                        color: 'var(--manage-text-dark)',
                        marginBottom: '1rem',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '0.5rem'
                    }}>
                        <UserPlus size={18} style={{ color: 'var(--manage-primary)' }} />
                        Gửi lời mời mới
                    </h3>
                    <p style={{ fontSize: '0.9rem', color: 'var(--manage-text-medium)', marginBottom: '1.5rem' }}>
                        Mời giáo viên hoặc quản trị viên tham gia hệ thống. Lời mời sẽ có hiệu lực trong 48 giờ.
                    </p>

                    <form onSubmit={handleSendInvite} style={{
                        display: 'grid', gridTemplateColumns: 'minmax(250px, 2fr) minmax(150px, 1fr) auto', gap: '1rem', alignItems: 'end'
                    }}>
                        <div className="form-row">
                            <label>Email người nhận</label>
                            <div style={{ position: 'relative' }}>
                                <Mail size={16} style={{ position: 'absolute', left: '1rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--manage-text-light)' }} />
                                <input
                                    type="email"
                                    value={inviteForm.email}
                                    onChange={(e) => setInviteForm({ ...inviteForm, email: e.target.value })}
                                    placeholder="name@example.com"
                                    required
                                    style={{ width: '100%', paddingLeft: '2.5rem' }}
                                    className="search-input"
                                />
                            </div>
                        </div>

                        <div className="form-row">
                            <label>Vai trò hệ thống</label>
                            <select
                                value={inviteForm.role}
                                onChange={(e) => setInviteForm({ ...inviteForm, role: e.target.value })}
                                className="search-input"
                                style={{ cursor: 'pointer' }}
                            >
                                <option value="teacher">Giáo viên</option>
                                <option value="admin">Quản trị viên</option>
                            </select>
                        </div>

                        <button
                            type="submit"
                            disabled={sending}
                            className="btn-manage-add"
                            style={{
                                height: 'calc(1.7rem + 2px + 1.7rem)', // Match input height
                                borderRadius: '0.85rem',
                                padding: '0 2rem',
                                opacity: sending ? 0.7 : 1,
                                cursor: sending ? 'not-allowed' : 'pointer',
                            }}
                        >
                            <Send size={16} />
                            {sending ? 'Đang gửi...' : 'Gửi lời mời'}
                        </button>
                    </form>
                </div>

                {/* Status Filter */}
                <div style={{
                    display: 'flex', gap: '0.5rem', marginBottom: '1.5rem', flexWrap: 'wrap',
                    borderBottom: '2px solid var(--manage-bg-gray)', paddingBottom: '1.5rem'
                }}>
                    {filterButtons.map(({ value, label }) => (
                        <button
                            key={value}
                            onClick={() => setStatusFilter(value)}
                            style={{
                                background: statusFilter === value ? 'var(--manage-primary)' : 'var(--manage-bg-white)',
                                color: statusFilter === value ? '#ffffff' : 'var(--manage-text-medium)',
                                border: `2px solid ${statusFilter === value ? 'var(--manage-primary)' : 'var(--manage-border)'}`,
                                padding: '0.5rem 1.25rem',
                                borderRadius: '50px',
                                fontWeight: 600,
                                cursor: 'pointer',
                                fontSize: '0.85rem',
                                transition: 'all var(--transition-base)',
                                boxShadow: statusFilter === value ? 'var(--shadow-primary)' : 'none',
                            }}
                        >
                            {label}
                        </button>
                    ))}
                </div>

                {/* Invitation List */}
                {loading ? (
                    <div style={{ textAlign: 'center', padding: '3rem', color: 'var(--manage-text-light)' }}>
                        <div className="loading-spinner" style={{ margin: '0 auto 1rem', width: 30, height: 30, border: '3px solid var(--manage-cream)', borderTopColor: 'var(--manage-primary)', borderRadius: '50%', animation: 'spin 1s linear infinite' }}></div>
                        <p style={{ fontWeight: 600 }}>Đang tải danh sách lời mời...</p>
                        <style>{`@keyframes spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }`}</style>
                    </div>
                ) : (
                    <div className="manage-list">
                        {invitations.length === 0 ? (
                            <div style={{
                                textAlign: 'center', padding: '4rem 2rem',
                                background: 'var(--manage-bg-gray)', borderRadius: '1.25rem',
                                border: '2px dashed var(--manage-border)'
                            }}>
                                <div style={{
                                    width: 64, height: 64, background: 'var(--manage-bg-white)',
                                    borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center',
                                    margin: '0 auto 1rem', boxShadow: 'var(--shadow-sm)', color: 'var(--manage-text-light)'
                                }}>
                                    <Mail size={28} />
                                </div>
                                <h4 style={{ color: 'var(--manage-text-dark)', marginBottom: '0.5rem', fontWeight: 700 }}>Chưa có lời mời nào</h4>
                                <p style={{ color: 'var(--manage-text-medium)', fontSize: '0.9rem', maxWidth: 400, margin: '0 auto' }}>
                                    {statusFilter
                                        ? `Không tìm thấy lời mời nào với trạng thái "${filterButtons.find(b => b.value === statusFilter)?.label.toLowerCase()}".`
                                        : "Sử dụng biểu mẫu phía trên để gửi lời mời cho giáo viên hoặc quản trị viên mới."}
                                </p>
                            </div>
                        ) : (
                            invitations.map((inv) => {
                                const status = STATUS_CONFIG[inv.status] || STATUS_CONFIG.pending;
                                const StatusIcon = status.Icon;

                                return (
                                    <div key={inv._id} className="list-item" style={{
                                        display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem',
                                        padding: '1.25rem 1.5rem'
                                    }}>
                                        <div className="item-info" style={{ flex: 1, minWidth: 250 }}>
                                            <span className="item-title" style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', fontSize: '1.1rem' }}>
                                                {inv.email}
                                                <span style={{
                                                    fontSize: '0.75rem', padding: '3px 10px', borderRadius: '50px',
                                                    background: inv.role === 'admin' ? '#fee2e2' : '#e0f2fe',
                                                    color: inv.role === 'admin' ? '#ef4444' : '#0ea5e9',
                                                    fontWeight: 700,
                                                    letterSpacing: '0.5px',
                                                    textTransform: 'uppercase'
                                                }}>
                                                    {ROLE_LABEL[inv.role] || inv.role}
                                                </span>
                                            </span>
                                            <span className="item-meta" style={{ fontSize: '0.85rem', color: 'var(--manage-text-medium)', display: 'flex', alignItems: 'center', gap: '0.5rem', marginTop: '0.25rem' }}>
                                                <Clock size={12} />
                                                Đã gửi lúc {formatDate(inv.createdAt)}
                                                {inv.invitedBy && (
                                                    <span style={{ color: 'var(--manage-text-light)' }}>
                                                        bởi {inv.invitedBy.name || inv.invitedBy.email || '—'}
                                                    </span>
                                                )}
                                            </span>
                                        </div>

                                        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '0.5rem' }}>
                                            <span style={{
                                                display: 'inline-flex', alignItems: 'center', gap: '0.4rem',
                                                fontSize: '0.85rem', padding: '0.4rem 0.8rem', borderRadius: '50px',
                                                background: status.bg, color: status.color, fontWeight: 700,
                                            }}>
                                                <StatusIcon size={16} />
                                                {status.label}
                                            </span>
                                            {inv.status === 'pending' && (
                                                <span style={{ fontSize: '0.75rem', color: 'var(--manage-text-light)', fontStyle: 'italic' }}>
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

                <div style={{ marginTop: '2rem' }}>
                    <PaginationControls
                        pagination={pagination}
                        onPageChange={setCurrentPage}
                        loading={loading}
                        itemLabel="lời mời"
                    />
                </div>
            </div>
        </div>
    );
}
