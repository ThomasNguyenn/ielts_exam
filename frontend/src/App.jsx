import { lazy, Suspense } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { api } from './api/client';
import { NotificationProvider } from './components/NotificationContext';

const Layout = lazy(() => import('./components/Layout'));
const Home = lazy(() => import('./pages/Home'));
const TestList = lazy(() => import('./pages/TestList'));
const TestDetail = lazy(() => import('./pages/TestDetail'));
const Exam = lazy(() => import('./pages/Exam'));
const TestHistory = lazy(() => import('./pages/TestHistory'));
const ManageLayout = lazy(() => import('./components/ManageLayout'));
const AddPassage = lazy(() => import('./pages/manage/AddPassage'));
const AddSection = lazy(() => import('./pages/manage/AddSection'));
const AddTest = lazy(() => import('./pages/manage/AddTest'));
const AddWriting = lazy(() => import('./pages/manage/AddWriting'));
const AddSpeaking = lazy(() => import('./pages/manage/AddSpeaking'));
const Login = lazy(() => import('./pages/Login'));
const Register = lazy(() => import('./pages/Register'));
const Profile = lazy(() => import('./pages/Profile'));
const GradingDashboard = lazy(() => import('./pages/manage/GradingDashboard'));
const GradingInterface = lazy(() => import('./pages/manage/GradingInterface'));
const PracticeFlowContainer = lazy(() => import('./pages/Practice/EnhancedPracticeFlow')); // Renovated 5-phase flow
const SpeakingFlow = lazy(() => import('./pages/Practice/SpeakingFlow'));
const PracticeList = lazy(() => import('./pages/Practice/PracticeList'));
const SpeakingList = lazy(() => import('./pages/Practice/SpeakingList'));
const Vocabulary = lazy(() => import('./pages/Vocabulary'));
const ScoreDashboard = lazy(() => import('./pages/manage/ScoreDashboard'));
const UserScoreDetail = lazy(() => import('./pages/manage/UserScoreDetail'));
const WritingAIResult = lazy(() => import('./pages/Practice/WritingAIResult'));
const StudyPlanSetup = lazy(() => import('./legacy/StudyPlanSetup'));
const StudyPlanFullView = lazy(() => import('./pages/StudyPlanFullView'));
const AnalyticsDashboard = lazy(() => import('./pages/AnalyticsDashboard'));
const WaitForConfirmation = lazy(() => import('./pages/WaitForConfirmation'));
const StudentRequests = lazy(() => import('./pages/manage/StudentRequests'));
const ManageUsers = lazy(() => import('./pages/manage/ManageUsers'));

const RouteFallback = () => (
  <div className="page">
    <p className="muted">Loading...</p>
  </div>
);

const withSuspense = (element) => (
  <Suspense fallback={<RouteFallback />}>
    {element}
  </Suspense>
);

// Protected Route wrapper
function ProtectedRoute({ children }) {
  if (!api.isAuthenticated()) {
    return <Navigate to="/login" replace />;
  }
  const user = api.getUser();
  if (user?.role === 'student' && !user?.isConfirmed) {
    return <Navigate to="/wait-for-confirmation" replace />;
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
    const user = api.getUser();
    if (user?.role === 'student' && !user?.isConfirmed) {
      return <Navigate to="/wait-for-confirmation" replace />;
    }
    return <Navigate to="/" replace />;
  }
  return children;
}

export default function App() {
  return (
    <NotificationProvider>
      <Routes>
        <Route path="/" element={withSuspense(<Layout />)}>
          <Route index element={withSuspense(<Home />)} />
          <Route path="tests" element={withSuspense(<TestList />)} />
          <Route path="tests/:id" element={withSuspense(<TestDetail />)} />
          <Route path="tests/:id/history" element={<ProtectedRoute>{withSuspense(<TestHistory />)}</ProtectedRoute>} />
          <Route path="tests/:id/exam" element={<ProtectedRoute>{withSuspense(<Exam />)}</ProtectedRoute>} />

          {/* Writing Practice/Test Route */}
          <Route path="tests/writing/:id" element={<ProtectedRoute>{withSuspense(<PracticeFlowContainer />)}</ProtectedRoute>} />

          {/* <Route path="practice" element={<Navigate to="/tests" replace />} /> Redirect old practice to tests */}
          <Route path="practice" element={<ProtectedRoute>{withSuspense(<PracticeList />)}</ProtectedRoute>} />
          <Route path="practice/:id" element={<ProtectedRoute>{withSuspense(<PracticeFlowContainer />)}</ProtectedRoute>} />

          <Route path="speaking" element={<ProtectedRoute>{withSuspense(<SpeakingList />)}</ProtectedRoute>} />
          <Route path="practice/speaking/:id" element={<ProtectedRoute>{withSuspense(<SpeakingFlow />)}</ProtectedRoute>} />

          <Route path="vocabulary" element={<ProtectedRoute>{withSuspense(<Vocabulary />)}</ProtectedRoute>} />

          {/* Study Plan Routes */}
          <Route path="study-plan/setup" element={<ProtectedRoute>{withSuspense(<StudyPlanSetup />)}</ProtectedRoute>} />
          <Route path="study-plan/full" element={<ProtectedRoute>{withSuspense(<StudyPlanFullView />)}</ProtectedRoute>} />

          {/* AI Scoring Result Page */}
          <Route path="tests/writing/result-ai/:id" element={<ProtectedRoute>{withSuspense(<WritingAIResult />)}</ProtectedRoute>} />

          <Route path="profile" element={<ProtectedRoute>{withSuspense(<Profile />)}</ProtectedRoute>} />
          <Route path="analytics" element={<ProtectedRoute>{withSuspense(<AnalyticsDashboard />)}</ProtectedRoute>} />

          {/* Auth Routes */}
          <Route path="login" element={
            <PublicRoute>{withSuspense(<Login />)}</PublicRoute>
          } />
          <Route path="register" element={
            <PublicRoute>{withSuspense(<Register />)}</PublicRoute>
          } />
          <Route path="wait-for-confirmation" element={withSuspense(<WaitForConfirmation />)} />

          {/* Protected Manage Routes (Teacher/Admin) */}
          <Route path="manage" element={
            <ManageRoute>{withSuspense(<ManageLayout />)}</ManageRoute>
          }>
            <Route index element={<Navigate to="/manage/passages" replace />} />
            <Route path="requests" element={withSuspense(<StudentRequests />)} />
            <Route path="users" element={withSuspense(<ManageUsers />)} />
            <Route path="passages" element={withSuspense(<AddPassage />)} />
            <Route path="passages/:id" element={withSuspense(<AddPassage />)} />
            <Route path="sections" element={withSuspense(<AddSection />)} />
            <Route path="sections/:id" element={withSuspense(<AddSection />)} />
            <Route path="tests" element={withSuspense(<AddTest />)} />
            <Route path="tests/:id" element={withSuspense(<AddTest />)} />
            <Route path="writings" element={withSuspense(<AddWriting />)} />
            <Route path="writings/:id" element={withSuspense(<AddWriting />)} />
            <Route path="speaking" element={withSuspense(<AddSpeaking />)} />
            <Route path="speaking/:id" element={withSuspense(<AddSpeaking />)} />
          </Route>

          {/* Grading Routes (Top Level for Teachers) */}
          <Route path="grading" element={
            <ManageRoute>{withSuspense(<GradingDashboard />)}</ManageRoute>
          } />
          <Route path="grading/:id" element={
            <ManageRoute>{withSuspense(<GradingInterface />)}</ManageRoute>
          } />
        </Route>
        <Route path="scores" element={
          <ManageRoute>{withSuspense(<ScoreDashboard />)}</ManageRoute>
        } />
        <Route path="scores/:userId" element={
          <ManageRoute>{withSuspense(<UserScoreDetail />)}</ManageRoute>
        } />
        <Route path="analytics/student/:studentId" element={
          <ManageRoute>{withSuspense(<AnalyticsDashboard />)}</ManageRoute>
        } />
      </Routes>
    </NotificationProvider>
  );
}
