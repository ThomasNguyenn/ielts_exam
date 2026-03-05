import { lazy, Suspense, useEffect, useState } from 'react';
import { Navigate, Route, Routes, useLocation, useParams } from 'react-router-dom';
import { api } from '@/shared/api/client';
import { NotificationProvider } from '@/shared/context/NotificationContext';
import AchievementToast from '@/features/achievements/components/AchievementToast';
import { PublicRoute, RequireAuth, RequireRole } from './routeGuards';
import {
  UI_ROLE_ADMIN,
  UI_ROLE_STUDENT_ACA,
  UI_ROLE_STUDENT_IELTS,
  UI_ROLE_TEACHER,
  getDefaultRouteForUser,
  isUnconfirmedStudentFamilyUser,
} from './roleRouting';

const Layout = lazy(() => import('@/shared/components/Layout'));
const Home = lazy(() => import('@/features/home/pages/Home'));
const Login = lazy(() => import('@/features/auth/pages/Login'));
const Register = lazy(() => import('@/features/auth/pages/Register'));
const VerifyEmail = lazy(() => import('@/features/auth/pages/VerifyEmail'));
const VerifyEmailChange = lazy(() => import('@/features/auth/pages/VerifyEmailChange'));
const ForgotPassword = lazy(() => import('@/features/auth/pages/ForgotPassword'));
const ResetPassword = lazy(() => import('@/features/auth/pages/ResetPassword'));
const WaitForConfirmation = lazy(() => import('@/features/system/pages/WaitForConfirmation'));
const NotFound = lazy(() => import('@/features/system/pages/NotFound'));

const StudentIELTSLayout = lazy(() => import('@/features/layouts/StudentIELTSLayout'));
const StudentACALayout = lazy(() => import('@/features/layouts/StudentACALayout'));
const AdminLayout = lazy(() => import('@/features/layouts/AdminLayout'));

const Profile = lazy(() => import('@/features/profile/pages/Profile'));
const TestList = lazy(() => import('@/features/tests/pages/TestList'));
const TestDetail = lazy(() => import('@/features/tests/pages/TestDetail'));
const TestHistory = lazy(() => import('@/features/tests/pages/TestHistory'));
const Exam = lazy(() => import('@/features/tests/pages/Exam'));
const TestAttemptResult = lazy(() => import('@/features/tests/pages/TestAttemptResult'));
const WritingSubmissionView = lazy(() => import('@/features/tests/pages/WritingSubmissionView'));
const PracticeList = lazy(() => import('@/features/practice/pages/PracticeList'));
const PracticeFlowContainer = lazy(() => import('@/features/practice/pages/EnhancedPracticeFlow'));
const SpeakingList = lazy(() => import('@/features/practice/pages/SpeakingList'));
const SpeakingFlow = lazy(() => import('@/features/practice/pages/SpeakingFlow'));
const WritingAIResult = lazy(() => import('@/features/practice/pages/WritingAIResult'));
const LearnPage = lazy(() => import('@/features/learn/pages/LearnPage'));
const LearnModuleDetail = lazy(() => import('@/features/learn/pages/LearnModuleDetail'));
const StudyPlanSetup = lazy(() => import('@/features/study-plan/pages/StudyPlanSetup'));
const StudyPlanFullView = lazy(() => import('@/features/study-plan/pages/StudyPlanFullView'));
const AnalyticsContainer = lazy(() => import('@/features/analytics/pages/AnalyticsContainer'));
const Vocabulary = lazy(() => import('@/features/vocabulary/pages/Vocabulary'));
const AchievementsPage = lazy(() => import('@/features/achievements/pages/AchievementsPage'));
const WritingLiveJoin = lazy(() => import('@/features/tests/pages/WritingLiveJoin'));
const WritingLiveRoom = lazy(() => import('@/features/tests/pages/WritingLiveRoom'));

const GradingDashboard = lazy(() => import('@/features/admin/pages/GradingDashboard'));
const GradingInterface = lazy(() => import('@/features/admin/pages/GradingInterface'));
const ScoreDashboard = lazy(() => import('@/features/admin/pages/ScoreDashboard'));
const UserScoreDetail = lazy(() => import('@/features/admin/pages/UserScoreDetail'));
const EvaluationPage = lazy(() => import('@/features/evaluation/pages/EvaluationPage'));
const HomeworkAssignmentsPage = lazy(() => import('@/features/homework/pages/HomeworkAssignmentsPage'));
const HomeworkAssignmentEditorPage = lazy(() => import('@/features/homework/pages/HomeworkAssignmentEditorPage'));
const HomeworkDashboardPage = lazy(() => import('@/features/homework/pages/HomeworkDashboardPage'));
const HomeworkGroupsPage = lazy(() => import('@/features/homework/pages/HomeworkGroupsPage'));
const HomeworkLessonEditorPage = lazy(() => import('@/features/homework/pages/HomeworkLessonEditorPage'));
const HomeworkSubmissionGradePage = lazy(() => import('@/features/homework/pages/HomeworkSubmissionGradePage'));
const SettingsPage = lazy(() => import('@/features/settings/pages/SettingsPage'));

const MyHomeworkMonthPage = lazy(() => import('@/features/homework/pages/MyHomeworkMonthPage'));
const MyHomeworkDetailPage = lazy(() => import('@/features/homework/pages/MyHomeworkDetailPage'));
const MyHomeworkLessonPage = lazy(() => import('@/features/homework/pages/MyHomeworkLessonPage'));

const ManageLayout = lazy(() => import('@/features/admin/components/ManageLayout'));
const ManagePassagesSinglePage = lazy(() => import('@/features/admin/pages/ManagePassagesSinglePage'));
const ManageSectionsSinglePage = lazy(() => import('@/features/admin/pages/ManageSectionsSinglePage'));
const ManageTestsSinglePage = lazy(() => import('@/features/admin/pages/ManageTestsSinglePage'));
const ManageWritingsSinglePage = lazy(() => import('@/features/admin/pages/ManageWritingsSinglePage'));
const ManageSpeakingSinglePage = lazy(() => import('@/features/admin/pages/ManageSpeakingSinglePage'));
const AddSkillModules = lazy(() => import('@/features/admin/pages/AddSkillModules'));
const StudentRequests = lazy(() => import('@/features/admin/pages/StudentRequests'));
const ManageUsers = lazy(() => import('@/features/admin/pages/ManageUsers'));
const ManageInvitations = lazy(() => import('@/features/admin/pages/ManageInvitations'));

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

function StudentAnalyticsLegacyRedirect() {
  const location = useLocation();
  return <Navigate to={`/student-ielts/analytics${location.search || ''}`} replace />;
}

function TeacherAnalyticsLegacyRedirect() {
  const location = useLocation();
  const { studentId } = useParams();
  return <Navigate to={`/analytics/student/${studentId}${location.search || ''}`} replace />;
}

function HomeIndexRoute() {
  if (api.isAuthenticated()) {
    const user = api.getUser();

    if (isUnconfirmedStudentFamilyUser(user)) {
      return <Navigate to="/wait-for-confirmation" replace />;
    }

    return <Navigate to={getDefaultRouteForUser(user)} replace />;
  }

  return withSuspense(<Home />);
}

function StudentIELTSRoutes() {
  return (
    <RequireAuth>
      <RequireRole allow={[UI_ROLE_STUDENT_IELTS, UI_ROLE_TEACHER, UI_ROLE_ADMIN]}>
        {withSuspense(<StudentIELTSLayout />)}
      </RequireRole>
    </RequireAuth>
  );
}

function StudentACARoutes() {
  return (
    <RequireAuth>
      <RequireRole allow={[UI_ROLE_STUDENT_ACA, UI_ROLE_TEACHER, UI_ROLE_ADMIN]}>
        {withSuspense(<StudentACALayout />)}
      </RequireRole>
    </RequireAuth>
  );
}

function TeacherRoutes() {
  return (
    <RequireAuth>
      <RequireRole allow={[UI_ROLE_TEACHER, UI_ROLE_ADMIN]}>
        {withSuspense(<AdminLayout />)}
      </RequireRole>
    </RequireAuth>
  );
}

function AdminRoutes() {
  return (
    <RequireAuth>
      <RequireRole allow={[UI_ROLE_ADMIN]}>
        {withSuspense(<AdminLayout />)}
      </RequireRole>
    </RequireAuth>
  );
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
          <Route index element={<HomeIndexRoute />} />

          <Route
            path="login"
            element={<PublicRoute>{withSuspense(<Login />)}</PublicRoute>}
          />
          <Route
            path="register"
            element={<PublicRoute>{withSuspense(<Register />)}</PublicRoute>}
          />
          <Route
            path="verify-email"
            element={<PublicRoute>{withSuspense(<VerifyEmail />)}</PublicRoute>}
          />
          <Route path="verify-email-change" element={withSuspense(<VerifyEmailChange />)} />
          <Route
            path="forgot-password"
            element={<PublicRoute>{withSuspense(<ForgotPassword />)}</PublicRoute>}
          />
          <Route
            path="reset-password"
            element={<PublicRoute>{withSuspense(<ResetPassword />)}</PublicRoute>}
          />
          <Route path="wait-for-confirmation" element={withSuspense(<WaitForConfirmation />)} />
        </Route>

        <Route path="/student-ielts" element={<StudentIELTSRoutes />}>
          <Route index element={<Navigate to="/student-ielts/learn" replace />} />
          <Route path="profile" element={withSuspense(<Profile />)} />
          <Route path="tests" element={withSuspense(<TestList />)} />
          <Route path="tests/:id" element={withSuspense(<TestDetail />)} />
          <Route path="tests/:id/history" element={withSuspense(<TestHistory />)} />
          <Route path="tests/:id/exam" element={withSuspense(<Exam />)} />
          <Route path="tests/:testId/attempts/:attemptId/result" element={withSuspense(<TestAttemptResult />)} />
          <Route path="tests/writing/:id" element={withSuspense(<PracticeFlowContainer />)} />
          <Route path="tests/writing/result-ai/:id" element={withSuspense(<WritingAIResult />)} />
          <Route path="tests/writing/submissions/:id" element={withSuspense(<WritingSubmissionView />)} />

          <Route path="practice" element={withSuspense(<PracticeList />)} />
          <Route path="practice/:id" element={withSuspense(<PracticeFlowContainer />)} />
          <Route path="speaking" element={withSuspense(<SpeakingList />)} />
          <Route path="speaking/:id" element={withSuspense(<SpeakingFlow />)} />

          <Route path="learn" element={withSuspense(<LearnPage />)} />
          <Route path="learn/:moduleId" element={withSuspense(<LearnModuleDetail />)} />
          <Route path="study-plan/setup" element={withSuspense(<StudyPlanSetup />)} />
          <Route path="study-plan/full" element={withSuspense(<StudyPlanFullView />)} />

          <Route path="analytics" element={withSuspense(<AnalyticsContainer />)} />
          <Route path="analytics/errors" element={<StudentAnalyticsLegacyRedirect />} />
          <Route path="vocabulary" element={withSuspense(<Vocabulary />)} />
          <Route path="achievements" element={withSuspense(<AchievementsPage />)} />

          <Route path="homework" element={withSuspense(<MyHomeworkMonthPage />)} />
          <Route path="homework/:assignmentId" element={withSuspense(<MyHomeworkDetailPage />)} />
          <Route path="homework/:assignmentId/lessons/:lessonId" element={withSuspense(<MyHomeworkLessonPage />)} />

          <Route path="*" element={<Navigate to="/student-ielts/learn" replace />} />
        </Route>

        <Route path="/student-aca" element={<StudentACARoutes />}>
          <Route index element={<Navigate to="/student-aca/homework" replace />} />
          <Route path="homework" element={withSuspense(<MyHomeworkMonthPage />)} />
          <Route path="homework/:assignmentId" element={withSuspense(<MyHomeworkDetailPage />)} />
          <Route path="homework/:assignmentId/lessons/:lessonId" element={withSuspense(<MyHomeworkLessonPage />)} />
          <Route path="*" element={<Navigate to="/student-aca/homework" replace />} />
        </Route>

        <Route path="/grading" element={<TeacherRoutes />}>
          <Route index element={withSuspense(<GradingDashboard />)} />
          <Route path=":id" element={withSuspense(<GradingInterface />)} />
        </Route>
        <Route path="/scores" element={<TeacherRoutes />}>
          <Route index element={withSuspense(<ScoreDashboard />)} />
          <Route path=":userId" element={withSuspense(<UserScoreDetail />)} />
        </Route>
        <Route path="/evaluate" element={<TeacherRoutes />}>
          <Route index element={withSuspense(<EvaluationPage />)} />
        </Route>
        <Route path="/settings" element={<TeacherRoutes />}>
          <Route index element={withSuspense(<SettingsPage />)} />
        </Route>
        <Route path="/homework" element={<TeacherRoutes />}>
          <Route index element={withSuspense(<HomeworkAssignmentsPage />)} />
          <Route path="groups" element={withSuspense(<HomeworkGroupsPage />)} />
          <Route path="assignments/new" element={withSuspense(<HomeworkAssignmentEditorPage />)} />
          <Route path="assignments/:id" element={withSuspense(<HomeworkAssignmentEditorPage />)} />
          <Route path="assignments/:id/lessons/:lessonId" element={withSuspense(<HomeworkLessonEditorPage />)} />
          <Route path="assignments/:id/dashboard" element={withSuspense(<HomeworkDashboardPage />)} />
          <Route path="submissions/:submissionId" element={withSuspense(<HomeworkSubmissionGradePage />)} />
          <Route path="*" element={<Navigate to="/homework" replace />} />
        </Route>
        <Route path="/analytics/student/:studentId" element={<TeacherRoutes />}>
          <Route index element={withSuspense(<AnalyticsContainer />)} />
          <Route path="errors" element={<TeacherAnalyticsLegacyRedirect />} />
        </Route>

        <Route path="/admin" element={<AdminRoutes />}>
          <Route index element={<Navigate to="/admin/manage" replace />} />
          <Route path="manage" element={withSuspense(<ManageLayout />)}>
            <Route index element={<Navigate to="/admin/manage/passages" replace />} />
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
            <Route path="requests" element={<Navigate to="/admin/people/request" replace />} />
            <Route path="request" element={<Navigate to="/admin/people/request" replace />} />
            <Route path="users" element={<Navigate to="/admin/people/users" replace />} />
            <Route path="invitations" element={<Navigate to="/admin/people/invitation" replace />} />
            <Route path="invitation" element={<Navigate to="/admin/people/invitation" replace />} />
            <Route path="*" element={<Navigate to="/admin/manage/passages" replace />} />
          </Route>
          <Route path="people">
            <Route index element={<Navigate to="/admin/people/request" replace />} />
            <Route path="request" element={withSuspense(<StudentRequests />)} />
            <Route path="requests" element={<Navigate to="/admin/people/request" replace />} />
            <Route path="users" element={withSuspense(<ManageUsers />)} />
            <Route path="invitation" element={withSuspense(<ManageInvitations />)} />
            <Route path="invitations" element={<Navigate to="/admin/people/invitation" replace />} />
            <Route path="*" element={<Navigate to="/admin/people/request" replace />} />
          </Route>
          <Route path="*" element={<Navigate to="/admin/manage" replace />} />
        </Route>
        <Route path="/admin/settings" element={<Navigate to="/settings" replace />} />

        <Route
          path="/writing-live/join"
          element={<RequireAuth>{withSuspense(<WritingLiveJoin />)}</RequireAuth>}
        />
        <Route
          path="/writing-live/:roomCode"
          element={<RequireAuth>{withSuspense(<WritingLiveRoom />)}</RequireAuth>}
        />

        <Route path="*" element={withSuspense(<NotFound />)} />
      </Routes>
    </NotificationProvider>
  );
}

