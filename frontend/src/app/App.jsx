import { lazy, Suspense, useEffect, useState } from 'react';
import { Routes, Route, Navigate, useLocation, useParams } from 'react-router-dom';
import { api } from '@/shared/api/client';
import { NotificationProvider } from '@/shared/context/NotificationContext';
import AchievementToast from '@/features/achievements/components/AchievementToast';
import {
  resolveManageRouteRedirect,
  resolveProtectedRouteRedirect,
  resolvePublicRouteRedirect,
} from './routeGuards';

const Layout = lazy(() => import('@/shared/components/Layout'));
const Home = lazy(() => import('@/features/home/pages/Home'));
const TestList = lazy(() => import('@/features/tests/pages/TestList'));
const TestDetail = lazy(() => import('@/features/tests/pages/TestDetail'));
const Exam = lazy(() => import('@/features/tests/pages/Exam'));
const TestHistory = lazy(() => import('@/features/tests/pages/TestHistory'));
const TestAttemptResult = lazy(() => import('@/features/tests/pages/TestAttemptResult'));
const WritingSubmissionView = lazy(() => import('@/features/tests/pages/WritingSubmissionView'));
const ManageLayout = lazy(() => import('@/features/admin/components/ManageLayout'));
const ManagePassagesSinglePage = lazy(() => import('@/features/admin/pages/ManagePassagesSinglePage'));
const ManageSectionsSinglePage = lazy(() => import('@/features/admin/pages/ManageSectionsSinglePage'));
const ManageTestsSinglePage = lazy(() => import('@/features/admin/pages/ManageTestsSinglePage'));
const ManageWritingsSinglePage = lazy(() => import('@/features/admin/pages/ManageWritingsSinglePage'));
const ManageSpeakingSinglePage = lazy(() => import('@/features/admin/pages/ManageSpeakingSinglePage'));
const AddSkillModules = lazy(() => import('@/features/admin/pages/AddSkillModules'));
const Login = lazy(() => import('@/features/auth/pages/Login'));
const Register = lazy(() => import('@/features/auth/pages/Register'));
const VerifyEmail = lazy(() => import('@/features/auth/pages/VerifyEmail'));
const ForgotPassword = lazy(() => import('@/features/auth/pages/ForgotPassword'));
const ResetPassword = lazy(() => import('@/features/auth/pages/ResetPassword'));
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
const SkillWorkshopPage = lazy(() => import('@/features/practice/pages/SkillWorkshopPage'));
const StudyPlanSetup = lazy(() => import('@/features/study-plan/pages/StudyPlanSetup'));
const StudyPlanFullView = lazy(() => import('@/features/study-plan/pages/StudyPlanFullView'));
const AnalyticsContainer = lazy(() => import('@/features/analytics/pages/AnalyticsContainer'));
const AchievementsPage = lazy(() => import('@/features/achievements/pages/AchievementsPage'));
const WaitForConfirmation = lazy(() => import('@/features/system/pages/WaitForConfirmation'));
const StudentRequests = lazy(() => import('@/features/admin/pages/StudentRequests'));
const ManageUsers = lazy(() => import('@/features/admin/pages/ManageUsers'));
const ManageInvitations = lazy(() => import('@/features/admin/pages/ManageInvitations'));
const NotFound = lazy(() => import('@/features/system/pages/NotFound'));

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
  const user = api.getUser();
  const redirectTo = resolveProtectedRouteRedirect({
    isAuthenticated: api.isAuthenticated(),
    user,
  });

  if (redirectTo) {
    return <Navigate to={redirectTo} replace />;
  }

  return children;
}

// Manage Route wrapper (teacher or admin)
function ManageRoute({ children }) {
  const user = api.getUser();
  const redirectTo = resolveManageRouteRedirect({
    isAuthenticated: api.isAuthenticated(),
    user,
  });

  if (redirectTo) {
    return <Navigate to={redirectTo} replace />;
  }

  return children;
}

// Public Route wrapper (redirect if logged in)
function PublicRoute({ children }) {
  const user = api.getUser();
  const redirectTo = resolvePublicRouteRedirect({
    isAuthenticated: api.isAuthenticated(),
    user,
  });

  if (redirectTo) {
    return <Navigate to={redirectTo} replace />;
  }

  return children;
}

function AnalyticsLegacyRedirect() {
  const location = useLocation();
  const { studentId } = useParams();
  const basePath = studentId ? `/analytics/student/${studentId}` : '/analytics';
  return <Navigate to={`${basePath}${location.search || ''}`} replace />;
}

export default function App() {
  const [authBootstrapReady, setAuthBootstrapReady] = useState(false);

  useEffect(() => {
    let mounted = true;

    api.bootstrapSession()
      .catch(() => false)
      .finally(() => {
        if (mounted) setAuthBootstrapReady(true);
      });

    return () => {
      mounted = false;
    };
  }, []);

  if (!authBootstrapReady) {
    return (
      <NotificationProvider>
        <AchievementToast />
        <RouteFallback />
      </NotificationProvider>
    );
  }

  return (
    <NotificationProvider>
      <AchievementToast />
      <Routes>
        <Route path="/" element={withSuspense(<Layout />)}>
          <Route index element={withSuspense(<Home />)} />
          <Route path="tests" element={withSuspense(<TestList />)} />
          <Route path="tests/:id" element={withSuspense(<TestDetail />)} />
          <Route path="tests/:id/history" element={<ProtectedRoute>{withSuspense(<TestHistory />)}</ProtectedRoute>} />
          <Route path="tests/:testId/attempts/:attemptId/result" element={<ProtectedRoute>{withSuspense(<TestAttemptResult />)}</ProtectedRoute>} />
          <Route path="tests/:id/exam" element={<ProtectedRoute>{withSuspense(<Exam />)}</ProtectedRoute>} />

          {/* Writing Practice/Test Route */}
          <Route path="tests/writing/:id" element={<ProtectedRoute>{withSuspense(<PracticeFlowContainer />)}</ProtectedRoute>} />

          {/* <Route path="practice" element={<Navigate to="/tests" replace />} /> Redirect old practice to tests */}
          <Route path="practice" element={<ProtectedRoute>{withSuspense(<PracticeList />)}</ProtectedRoute>} />
          <Route path="practice/:id" element={<ProtectedRoute>{withSuspense(<PracticeFlowContainer />)}</ProtectedRoute>} />
          <Route path="learn/skills" element={<ProtectedRoute>{withSuspense(<SkillWorkshopPage />)}</ProtectedRoute>} />

          <Route path="speaking" element={<ProtectedRoute>{withSuspense(<SpeakingList />)}</ProtectedRoute>} />
          <Route path="practice/speaking/:id" element={<ProtectedRoute>{withSuspense(<SpeakingFlow />)}</ProtectedRoute>} />

          <Route path="vocabulary" element={<ProtectedRoute>{withSuspense(<Vocabulary />)}</ProtectedRoute>} />

          {/* Study Plan Routes */}
          <Route path="study-plan/setup" element={<ProtectedRoute>{withSuspense(<StudyPlanSetup />)}</ProtectedRoute>} />
          <Route path="study-plan/full" element={<ProtectedRoute>{withSuspense(<StudyPlanFullView />)}</ProtectedRoute>} />

          {/* AI Scoring Result Page */}
          <Route path="tests/writing/result-ai/:id" element={<ProtectedRoute>{withSuspense(<WritingAIResult />)}</ProtectedRoute>} />
          <Route path="tests/writing/submissions/:id" element={<ProtectedRoute>{withSuspense(<WritingSubmissionView />)}</ProtectedRoute>} />

          <Route path="profile" element={<ProtectedRoute>{withSuspense(<Profile />)}</ProtectedRoute>} />
          <Route path="analytics" element={<ProtectedRoute>{withSuspense(<AnalyticsContainer />)}</ProtectedRoute>} />
          <Route path="analytics/errors" element={<ProtectedRoute><AnalyticsLegacyRedirect /></ProtectedRoute>} />
          <Route path="achievements" element={<ProtectedRoute>{withSuspense(<AchievementsPage />)}</ProtectedRoute>} />

          {/* Auth Routes */}
          <Route path="login" element={
            <PublicRoute>{withSuspense(<Login />)}</PublicRoute>
          } />
          <Route path="register" element={
            <PublicRoute>{withSuspense(<Register />)}</PublicRoute>
          } />
          <Route path="verify-email" element={<PublicRoute>{withSuspense(<VerifyEmail />)}</PublicRoute>} />
          <Route path="forgot-password" element={<PublicRoute>{withSuspense(<ForgotPassword />)}</PublicRoute>} />
          <Route path="reset-password" element={<PublicRoute>{withSuspense(<ResetPassword />)}</PublicRoute>} />
          <Route path="wait-for-confirmation" element={withSuspense(<WaitForConfirmation />)} />

          {/* Protected Manage Routes (Teacher/Admin) */}
          <Route path="manage" element={
            <ManageRoute>{withSuspense(<ManageLayout />)}</ManageRoute>
          }>
            <Route index element={<Navigate to="/manage/passages" replace />} />
            <Route path="requests" element={withSuspense(<StudentRequests />)} />
            <Route path="users" element={withSuspense(<ManageUsers />)} />
            <Route path="passages" element={withSuspense(<ManagePassagesSinglePage />)} />
            <Route path="passages/:id" element={withSuspense(<ManagePassagesSinglePage />)} />
            <Route path="sections" element={withSuspense(<ManageSectionsSinglePage />)} />
            <Route path="sections/:id" element={withSuspense(<ManageSectionsSinglePage />)} />
            <Route path="tests" element={withSuspense(<ManageTestsSinglePage />)} />
            <Route path="tests/:id" element={withSuspense(<ManageTestsSinglePage />)} />
            <Route path="writings" element={withSuspense(<ManageWritingsSinglePage />)} />
            <Route path="writings/:id" element={withSuspense(<ManageWritingsSinglePage />)} />
            <Route path="speaking" element={withSuspense(<ManageSpeakingSinglePage />)} />
            <Route path="speaking/:id" element={withSuspense(<ManageSpeakingSinglePage />)} />
            <Route path="skill-modules" element={withSuspense(<AddSkillModules />)} />
            <Route path="skill-modules/:id" element={withSuspense(<AddSkillModules />)} />
            <Route path="invitations" element={withSuspense(<ManageInvitations />)} />
          </Route>

          {/* Grading Routes (Top Level for Teachers) */}
          <Route path="grading" element={
            <ManageRoute>{withSuspense(<GradingDashboard />)}</ManageRoute>
          } />
          <Route path="grading/:id" element={
            <ManageRoute>{withSuspense(<GradingInterface />)}</ManageRoute>
          } />
          <Route path="scores" element={
            <ManageRoute>{withSuspense(<ScoreDashboard />)}</ManageRoute>
          } />
          <Route path="scores/:userId" element={
            <ManageRoute>{withSuspense(<UserScoreDetail />)}</ManageRoute>
          } />
        </Route>
        <Route path="analytics/student/:studentId" element={
          <ManageRoute>{withSuspense(<AnalyticsContainer />)}</ManageRoute>
        } />
        <Route path="analytics/student/:studentId/errors" element={
          <ManageRoute><AnalyticsLegacyRedirect /></ManageRoute>
        } />
        <Route path="*" element={withSuspense(<NotFound />)} />
      </Routes>
    </NotificationProvider>
  );
}
