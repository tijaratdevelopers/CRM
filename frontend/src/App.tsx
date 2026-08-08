import { lazy, Suspense } from 'react';
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import { QueryClientProvider } from '@tanstack/react-query';
import { Toaster } from 'sonner';
import { Loader2 } from 'lucide-react';
import { queryClient } from '@/lib/queryClient';
import { AuthProvider } from '@/features/auth/AuthContext';
import { ProjectProvider } from '@/features/projects/ProjectContext';
import { LoginPage } from '@/features/auth/LoginPage';
import { ProtectedRoute } from '@/components/layout/ProtectedRoute';
import { RoleGuard } from '@/components/layout/RoleGuard';

const ProjectsPage = lazy(() => import('@/features/projects/ProjectsPage').then((m) => ({ default: m.ProjectsPage })));
const DashboardPage = lazy(() => import('@/features/dashboard/DashboardPage').then((m) => ({ default: m.DashboardPage })));
const LeadsListPage = lazy(() => import('@/features/leads/LeadsListPage').then((m) => ({ default: m.LeadsListPage })));
const InProgressLeadsPage = lazy(() => import('@/features/leads/InProgressLeadsPage').then((m) => ({ default: m.InProgressLeadsPage })));
const LeadDetailPage = lazy(() => import('@/features/leads/LeadDetailPage').then((m) => ({ default: m.LeadDetailPage })));
const MeetingsPage = lazy(() => import('@/features/meetings/MeetingsPage').then((m) => ({ default: m.MeetingsPage })));
const FollowUpsPage = lazy(() => import('@/features/followups/FollowUpsPage').then((m) => ({ default: m.FollowUpsPage })));
const CallLogsPage = lazy(() => import('@/features/calllogs/CallLogsPage').then((m) => ({ default: m.CallLogsPage })));
const TasksPage = lazy(() => import('@/features/tasks/TasksPage').then((m) => ({ default: m.TasksPage })));
const WhatsAppPage = lazy(() => import('@/features/whatsapp/WhatsAppPage').then((m) => ({ default: m.WhatsAppPage })));
const ReportsPage = lazy(() => import('@/features/reports/ReportsPage').then((m) => ({ default: m.ReportsPage })));
const UsersPage = lazy(() => import('@/features/users/UsersPage').then((m) => ({ default: m.UsersPage })));
const TeamLeadsPage = lazy(() => import('@/features/teamleads/TeamLeadsPage').then((m) => ({ default: m.TeamLeadsPage })));
const TeamsPage = lazy(() => import('@/features/teams/TeamsPage').then((m) => ({ default: m.TeamsPage })));
const StaffPage = lazy(() => import('@/features/staff/StaffPage').then((m) => ({ default: m.StaffPage })));
const ActivityLogsPage = lazy(() => import('@/features/activitylogs/ActivityLogsPage').then((m) => ({ default: m.ActivityLogsPage })));
const SettingsPage = lazy(() => import('@/features/settings/SettingsPage').then((m) => ({ default: m.SettingsPage })));

function RouteFallback() {
  return (
    <div className="flex h-[60vh] items-center justify-center">
      <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
    </div>
  );
}

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <ProjectProvider>
        <BrowserRouter>
          <Suspense fallback={<RouteFallback />}>
          <Routes>
            <Route path="/login" element={<LoginPage />} />

            <Route element={<ProtectedRoute />}>
              <Route index element={<DashboardPage />} />
              <Route
                path="projects"
                element={
                  <RoleGuard roles={['admin']}>
                    <ProjectsPage />
                  </RoleGuard>
                }
              />
              <Route path="leads" element={<LeadsListPage />} />
              <Route path="leads/in-progress" element={<InProgressLeadsPage />} />
              <Route path="leads/:id" element={<LeadDetailPage />} />
              <Route path="meetings" element={<MeetingsPage />} />
              <Route path="follow-ups" element={<FollowUpsPage />} />
              <Route path="call-logs" element={<CallLogsPage />} />
              <Route path="tasks" element={<TasksPage />} />
              <Route path="whatsapp" element={<WhatsAppPage />} />

              <Route
                path="reports"
                element={
                  <RoleGuard roles={['admin', 'team_lead']}>
                    <ReportsPage />
                  </RoleGuard>
                }
              />
              <Route
                path="users"
                element={
                  <RoleGuard roles={['admin']}>
                    <UsersPage />
                  </RoleGuard>
                }
              />
              <Route
                path="team-leads"
                element={
                  <RoleGuard roles={['admin']}>
                    <TeamLeadsPage />
                  </RoleGuard>
                }
              />
              <Route
                path="teams"
                element={
                  <RoleGuard roles={['admin', 'team_lead']}>
                    <TeamsPage />
                  </RoleGuard>
                }
              />
              <Route
                path="staff"
                element={
                  <RoleGuard roles={['admin', 'team_lead']}>
                    <StaffPage />
                  </RoleGuard>
                }
              />
              <Route
                path="activity-logs"
                element={
                  <RoleGuard roles={['admin', 'team_lead']}>
                    <ActivityLogsPage />
                  </RoleGuard>
                }
              />
              <Route
                path="settings"
                element={
                  <RoleGuard roles={['admin']}>
                    <SettingsPage />
                  </RoleGuard>
                }
              />
            </Route>

            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
          </Suspense>
        </BrowserRouter>
        <Toaster richColors position="top-right" />
        </ProjectProvider>
      </AuthProvider>
    </QueryClientProvider>
  );
}
