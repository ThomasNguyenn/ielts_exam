import React, { useState, useEffect } from 'react';
import { api } from '@/shared/api/client';
import { useNotification } from '@/shared/context/NotificationContext';
import PaginationControls from '@/shared/components/PaginationControls';
import './Manage.css';
import './StudentRequests.css';

export default function StudentRequests() {
  const PAGE_SIZE = 20;
  const [students, setStudents] = useState([]);
  const [pagination, setPagination] = useState(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const { showNotification } = useNotification();

  useEffect(() => {
    fetchPendingStudents(currentPage);
  }, [currentPage]);

  const fetchPendingStudents = async (page = 1) => {
    try {
      setLoading(true);
      const res = await api.getPendingStudents({ page, limit: PAGE_SIZE });
      if (res.success) {
        setStudents(res.data);
        setPagination(res.pagination || null);
      }
    } catch (error) {
      console.error("Failed to fetch pending students:", error);
      showNotification("Failed to fetch pending students", "error");
    } finally {
      setLoading(false);
    }
  };

  const handleApprove = async (studentId) => {
    try {
      const res = await api.approveStudent(studentId);
      if (res.success) {
        showNotification("Student approved successfully", "success");
        const nextPage = students.length === 1 && currentPage > 1 ? currentPage - 1 : currentPage;
        setCurrentPage(nextPage);
        fetchPendingStudents(nextPage);
      }
    } catch (error) {
      console.error("Failed to approve student:", error);
      showNotification("Failed to approve student", "error");
    }
  };

  // Helper to get initials
  const getInitials = (name) => {
      return name
          .split(' ')
          .map(n => n[0])
          .slice(0, 2)
          .join('')
          .toUpperCase();
  };

  // Helper for relative time (simple version)
  const timeAgo = (date) => {
      const seconds = Math.floor((new Date() - new Date(date)) / 1000);
      let interval = seconds / 31536000;
      if (interval > 1) return Math.floor(interval) + " years ago";
      interval = seconds / 2592000;
      if (interval > 1) return Math.floor(interval) + " months ago";
      interval = seconds / 86400;
      if (interval > 1) return Math.floor(interval) + " days ago";
      interval = seconds / 3600;
      if (interval > 1) return Math.floor(interval) + " hours ago";
      interval = seconds / 60;
      if (interval > 1) return Math.floor(interval) + " minutes ago";
      return Math.floor(seconds) + " seconds ago";
  };

  if (loading) return (
      <div className="manage-container">
          <div className="manage-header"><h2>Student Registration Requests</h2></div>
          <div className="manage-content">
             <div style={{textAlign: 'center', padding: '2rem', color: '#64748b'}}>Loading requests...</div>
          </div>
      </div>
  );

  return (
    <div className="manage-container">
      <div className="manage-header">
        <h2>Student Registration Requests <span style={{fontSize: '0.9rem', background:'#e2e8f0', padding:'2px 8px', borderRadius:'12px', color:'#475569', marginLeft:'0.5rem'}}>{pagination?.totalItems ?? students.length}</span></h2>
      </div>

      <div className="manage-content" style={{background: 'transparent', border: 'none', boxShadow: 'none', padding: 0}}>
        {students.length === 0 ? (
          <div className="empty-state">
              <span className="empty-icon">✓</span>
              <h3>All caught up!</h3>
              <p>There are no pending student registration requests at the moment.</p>
          </div>
        ) : (
          <>
            <div className="requests-container">
              {students.map(student => (
                <div className="request-card" key={student._id}>
                    <div className="request-header">
                        <div className="student-avatar">
                            {getInitials(student.name)}
                        </div>
                    </div>
                    
                    <div className="request-info">
                        <h3>{student.name}</h3>
                        <div className="email">{student.email}</div>
                    </div>

                    <div className="request-meta">
                        <div className="request-time">
                            {timeAgo(student.createdAt)}
                        </div>
                        <div className="request-footer">
                            <button 
                                className="approve-btn"
                                onClick={() => handleApprove(student._id)}
                            >
                                <svg style={{width:'18px', height:'18px'}} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                                </svg>
                                Approve
                            </button>
                        </div>
                    </div>
                </div>
              ))}
            </div>
            <PaginationControls
              pagination={pagination}
              onPageChange={setCurrentPage}
              loading={loading}
              itemLabel="pending students"
            />
          </>
        )}
      </div>
    </div>
  );
}
