import { Link } from 'react-router-dom';

export default function MaintenanceOverlay({
  title = "Hệ thống đang bảo trì",
  message = "Tính năng này hiện đang được nâng cấp để mang lại cho bạn trải nghiệm tuyệt vời hơn. Vui lòng quay lại sau nhé!",
  returnLink = "/student-ielts/learn",
  returnText = "Về trang chủ"
}) {
  return (
    <div 
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        backgroundColor: 'rgba(255, 255, 255, 0.4)',
        zIndex: 9999,
      }}
    >
      <div style={{
        backgroundColor: '#fff',
        padding: '40px 48px',
        borderRadius: '20px',
        textAlign: 'center',
        maxWidth: '480px',
        boxShadow: '0 24px 48px rgba(0,0,0,0.12)',
        border: '1px solid rgba(0,0,0,0.06)',
      }}>
        <h2 style={{ marginTop: 0, marginBottom: '20px', fontSize: '28px', color: '#111827', fontWeight: 'bold' }}>
          {title}
        </h2>
        <p style={{ margin: '0 0 32px', color: '#4b5563', lineHeight: 1.6, fontSize: '17px' }}>
          {message}
        </p>
        <Link to={returnLink} style={{
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '14px 32px',
          backgroundColor: '#2563eb',
          color: '#fff',
          textDecoration: 'none',
          borderRadius: '10px',
          fontWeight: 600,
          fontSize: '16px',
          transition: 'background-color 0.2s',
        }}>
          {returnText}
        </Link>
      </div>
    </div>
  );
}
