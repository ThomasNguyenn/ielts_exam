import React, { useState, useEffect } from 'react';
import { api } from '@/shared/api/client';
import { useNotification } from '@/shared/context/NotificationContext';
import ConfirmationModal from '@/shared/components/ConfirmationModal';
import PaginationControls from '@/shared/components/PaginationControls';
import './Manage.css';

export default function ManageUsers() {
  const PAGE_SIZE = 20;
  const [users, setUsers] = useState([]);
  const [pagination, setPagination] = useState(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [roleFilter, setRoleFilter] = useState(''); // '' = all, 'student', 'teacher'
  const [searchTerm, setSearchTerm] = useState('');
  const [confirmModal, setConfirmModal] = useState({
    isOpen: false,
    title: '',
    message: '',
    onConfirm: () => { },
    isDanger: false,
  });
  const { showNotification } = useNotification();

  useEffect(() => {
    setCurrentPage(1);
  }, [roleFilter]);

  useEffect(() => {
    fetchUsers(currentPage);
  }, [roleFilter, currentPage]);

  const fetchUsers = async (page = 1) => {
    try {
      setLoading(true);
      const res = await api.getUsers({ role: roleFilter, page, limit: PAGE_SIZE });
      if (res.success) {
        setUsers(res.data);
        setPagination(res.pagination || null);
      }
    } catch (error) {
      console.error("Failed to fetch users:", error);
      showNotification("Failed to fetch users", "error");
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = (userId, userName) => {
    setConfirmModal({
      isOpen: true,
      title: 'Delete User',
      message: `Are you sure you want to delete user "${userName}"? This action cannot be undone.`,
      isDanger: true,
      onConfirm: async () => {
        try {
          const res = await api.deleteUser(userId);
          if (res.success) {
            showNotification("User deleted successfully", "success");
            const nextPage = users.length === 1 && currentPage > 1 ? currentPage - 1 : currentPage;
            setCurrentPage(nextPage);
            fetchUsers(nextPage);
          }
        } catch (error) {
          console.error("Failed to delete user:", error);
          showNotification("Failed to delete user", "error");
        }
      }
    });
  };

  const filteredUsers = users.filter(user =>
    user.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    user.email.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="manage-container">
      <div className="manage-header">
        <h2>Manage Users</h2>
      </div>

      <div className="manage-content">
        <div style={{ display: 'flex', gap: '1rem', marginBottom: '1.5rem', flexWrap: 'wrap' }}>
          <div style={{ display: 'flex', gap: '0.5rem' }}>
            <button
              className={`btn btn-sm ${roleFilter === '' ? 'btn-primary' : 'btn-outline'}`}
              onClick={() => setRoleFilter('')}
              style={{ background: roleFilter === '' ? '#6366F1' : 'transparent', color: roleFilter === '' ? 'white' : '#64748b', border: '1px solid #e2e8f0', padding: '0.5rem 1rem', borderRadius: '0.5rem', fontWeight: 600, cursor: 'pointer' }}
            >
              All
            </button>
            <button
              className={`btn btn-sm ${roleFilter === 'student' ? 'btn-primary' : 'btn-outline'}`}
              onClick={() => setRoleFilter('student')}
              style={{ background: roleFilter === 'student' ? '#6366F1' : 'transparent', color: roleFilter === 'student' ? 'white' : '#64748b', border: '1px solid #e2e8f0', padding: '0.5rem 1rem', borderRadius: '0.5rem', fontWeight: 600, cursor: 'pointer' }}
            >
              Students
            </button>
            <button
              className={`btn btn-sm ${roleFilter === 'teacher' ? 'btn-primary' : 'btn-outline'}`}
              onClick={() => setRoleFilter('teacher')}
              style={{ background: roleFilter === 'teacher' ? '#6366F1' : 'transparent', color: roleFilter === 'teacher' ? 'white' : '#64748b', border: '1px solid #e2e8f0', padding: '0.5rem 1rem', borderRadius: '0.5rem', fontWeight: 600, cursor: 'pointer' }}
            >
              Teachers
            </button>
          </div>

          <input
            type="search"
            placeholder="Search by name or email..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            style={{ flex: 1, padding: '0.5rem 1rem', borderRadius: '0.5rem', border: '1px solid #e2e8f0' }}
          />
        </div>

        {loading ? (
          <div style={{ textAlign: 'center', padding: '2rem', color: '#64748b' }}>Loading users...</div>
        ) : (
          <div className="manage-list">
            {filteredUsers.length === 0 ? (
              <p className="muted" style={{ textAlign: 'center', padding: '2rem' }}>No users found.</p>
            ) : (
              filteredUsers.map(user => (
                <div key={user._id} className="list-item">
                  <div className="item-info">
                    <span className="item-title" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                      {user.name}
                      <span style={{ fontSize: '0.7rem', padding: '2px 6px', borderRadius: '4px', background: user.role === 'admin' ? '#fee2e2' : user.role === 'teacher' ? '#e0f2fe' : '#f1f5f9', color: user.role === 'admin' ? '#ef4444' : user.role === 'teacher' ? '#0ea5e9' : '#64748b' }}>
                        {user.role}
                      </span>
                    </span>
                    <span className="item-meta">{user.email}</span>
                  </div>
                  <div className="item-actions" style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                    {user.role !== 'admin' && (
                      <button
                        onClick={() => handleDelete(user._id, user.name)}
                        style={{ background: 'transparent', border: '1px solid #ef4444', color: '#ef4444', padding: '0.4rem 0.8rem', borderRadius: '6px', cursor: 'pointer', fontSize: '0.85rem', fontWeight: 600, transition: 'all 0.2s' }}
                        onMouseOver={(e) => { e.currentTarget.style.background = '#ef4444'; e.currentTarget.style.color = 'white'; }}
                        onMouseOut={(e) => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = '#ef4444'; }}
                      >
                        Delete
                      </button>
                    )}
                  </div>
                </div>
              ))
            )}
          </div>
        )}
        <PaginationControls
          pagination={pagination}
          onPageChange={setCurrentPage}
          loading={loading}
          itemLabel="users"
        />
      </div>
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
