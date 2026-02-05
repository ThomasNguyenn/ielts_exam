import { Routes, Route, Navigate } from 'react-router-dom';
import Layout from './components/Layout';
import Home from './pages/Home';
import TestList from './pages/TestList';
import TestDetail from './pages/TestDetail';
import Exam from './pages/Exam';
import TestHistory from './pages/TestHistory';
import ManageLayout from './components/ManageLayout';
import AddPassage from './pages/manage/AddPassage';
import AddSection from './pages/manage/AddSection';
import AddTest from './pages/manage/AddTest';
import AddWriting from './pages/manage/AddWriting';
import Login from './pages/Login';
import Register from './pages/Register';
import Profile from './pages/Profile';
import GradingDashboard from './pages/manage/GradingDashboard';
import GradingInterface from './pages/manage/GradingInterface';
import PracticeFlow from './pages/Practice/PracticeFlow';
import PracticeList from './pages/Practice/PracticeList';
import Vocabulary from './pages/Vocabulary';
import { api } from './api/client';

// Protected Route wrapper
function ProtectedRoute({ children }) {
  if (!api.isAuthenticated()) {
    return <Navigate to="/login" replace />;
  }
  return children;
}

// Manage Route wrapper (teacher or admin)
function ManageRoute({ children }) {
  const user = api.getUser();
  if (!api.isAuthenticated() || !['teacher', 'admin'].includes(user?.role)) {
    return <Navigate to="/" replace />;
  }
  return children;
}

// Public Route wrapper (redirect if logged in)
function PublicRoute({ children }) {
  if (api.isAuthenticated()) {
    return <Navigate to="/" replace />;
  }
  return children;
}

// ... (imports)
import { NotificationProvider } from './components/NotificationContext';

export default function App() {
  return (
    <NotificationProvider>
      <Routes>
        <Route path="/" element={<Layout />}>
          <Route index element={<Home />} />
          <Route path="tests" element={<TestList />} />
          <Route path="tests/:id" element={<TestDetail />} />
          <Route path="tests/:id/history" element={<ProtectedRoute><TestHistory /></ProtectedRoute>} />
          <Route path="tests/:id/exam" element={<Exam />} />

          <Route path="practice" element={<ProtectedRoute><PracticeList /></ProtectedRoute>} />
          <Route path="practice/:id" element={<ProtectedRoute><PracticeFlow /></ProtectedRoute>} />

          <Route path="vocabulary" element={<ProtectedRoute><Vocabulary /></ProtectedRoute>} />

          <Route path="profile" element={<Profile />} />

          {/* Auth Routes */}
          <Route path="login" element={
            <PublicRoute><Login /></PublicRoute>
          } />
          <Route path="register" element={
            <PublicRoute><Register /></PublicRoute>
          } />

          {/* Protected Manage Routes (Teacher/Admin) */}
          <Route path="manage" element={
            <ManageRoute><ManageLayout /></ManageRoute>
          }>
            <Route index element={<Navigate to="/manage/passages" replace />} />
            <Route path="passages" element={<AddPassage />} />
            <Route path="passages/:id" element={<AddPassage />} />
            <Route path="sections" element={<AddSection />} />
            <Route path="sections/:id" element={<AddSection />} />
            <Route path="tests" element={<AddTest />} />
            <Route path="tests/:id" element={<AddTest />} />
            <Route path="writings" element={<AddWriting />} />
            <Route path="writings/:id" element={<AddWriting />} />
          </Route>

          {/* Grading Routes (Top Level for Teachers) */}
          <Route path="grading" element={
            <ManageRoute><GradingDashboard /></ManageRoute>
          } />
          <Route path="grading/:id" element={
            <ManageRoute><GradingInterface /></ManageRoute>
          } />
        </Route>
      </Routes>
    </NotificationProvider>
  );
}
