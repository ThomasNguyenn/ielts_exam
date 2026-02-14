import { lazy, Suspense } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { api } from '@/shared/api/client';
import { NotificationProvider } from '@/shared/context/NotificationContext';

const Layout = lazy(() => import('@/shared/components/Layout'));
const Home = lazy(() => import('@/features/home/pages/Home'));
const TestList = lazy(() => import('@/features/tests/pages/TestList'));
const TestDetail = lazy(() => import('@/features/tests/pages/TestDetail'));
const Exam = lazy(() => import('@/features/tests/pages/Exam'));
const TestHistory = lazy(() => import('@/features/tests/pages/TestHistory'));
const ManageLayout = lazy(() => import('@/shared/components/ManageLayout'));
const AddPassage = lazy(() => import('@/features/admin/pages/AddPassage'));
const AddSection = lazy(() => import('@/features/admin/pages/AddSection'));
const AddTest = lazy(() => import('@/features/admin/pages/AddTest'));
const AddWriting = lazy(() => import('@/features/admin/pages/AddWriting'));
const AddSpeaking = lazy(() => import('@/features/admin/pages/AddSpeaking'));
const AddSkillModules = lazy(() => import('@/features/admin/pages/AddSkillModules'));
const Login = lazy(() => import('@/features/auth/pages/Login'));
const Register = lazy(() => import('@/features/auth/pages/Register'));
const Profile = lazy(() => import('@/features/profile/pages/Profile'));
const GradingDashboard = lazy(() => import('@/features/admin/pages/GradingDashboard'));
const GradingInterface = lazy(() => import('@/features/admin/pages/GradingInterface'));
const PracticeFlowContainer = lazy(() => import('@/features/practice/pages/EnhancedPracticeFlow'));
const SpeakingFlow = lazy(() => import('@/features/practice/pages/SpeakingFlow'));
const PracticeList = lazy(() => import('@/features/practice/pages/PracticeList'));
const SpeakingList = lazy(() => import('@/features/practice/pages/SpeakingList'));
const Vocabulary = lazy(() => import('@/features/vocabulary/pages/Vocabulary'));
const ScoreDashboard = lazy(() => import('@/features/admin/pages/ScoreDashboard'));
const UserScoreDetail = lazy(() => import('@/features/admin/pages/UserScoreDetail'));
const WritingAIResult = lazy(() => import('@/features/practice/pages/WritingAIResult'));
const StudyPlanSetup = lazy(() => import('@/features/study-plan/pages/StudyPlanSetup'));
const StudyPlanFullView = lazy(() => import('@/features/study-plan/pages/StudyPlanFullView'));
const AnalyticsDashboard = lazy(() => import('@/features/analytics/pages/AnalyticsDashboard'));
const WaitForConfirmation = lazy(() => import('@/features/system/pages/WaitForConfirmation'));
const StudentRequests = lazy(() => import('@/features/admin/pages/StudentRequests'));
const ManageUsers = lazy(() => import('@/features/admin/pages/ManageUsers'));

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
            <Route path="skill-modules" element={withSuspense(<AddSkillModules />)} />
            <Route path="skill-modules/:id" element={withSuspense(<AddSkillModules />)} />
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
