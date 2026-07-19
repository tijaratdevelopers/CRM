import * as React from 'react';
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import { QueryClientProvider } from '@tanstack/react-query';
import { Toaster } from 'sonner';
import { queryClient } from '@/lib/queryClient';
import { AuthProvider } from '@/features/auth/AuthContext';
import { LoginPage } from '@/features/auth/LoginPage';
import { ProtectedRoute } from '@/components/layout/ProtectedRoute';
import { RoleGuard } from '@/components/layout/RoleGuard';

const DashboardPage = React.lazy(() =>
  import('@/features/dashboard/DashboardPage').then((m) => ({ default: m.DashboardPage })),
);
const InProgressLeadsPage = React.lazy(() =>
  import('@/features/dashboard/InProgressLeadsPage').then((m) => ({ default: m.InProgressLeadsPage })),
);
const LeadsListPage = React.lazy(() =>
  import('@/features/leads/LeadsListPage').then((m) => ({ default: m.LeadsListPage })),
);
const LeadDetailPage = React.lazy(() =>
  import('@/features/leads/LeadDetailPage').then((m) => ({ default: m.LeadDetailPage })),
);
const MeetingsPage = React.lazy(() =>
  import('@/features/meetings/MeetingsPage').then((m) => ({ default: m.MeetingsPage })),
);
const FollowUpsPage = React.lazy(() =>
  import('@/features/followups/FollowUpsPage').then((m) => ({ default: m.FollowUpsPage })),
);
const CallLogsPage = React.lazy(() =>
  import('@/features/calllogs/CallLogsPage').then((m) => ({ default: m.CallLogsPage })),
);
const TasksPage = React.lazy(() =>
  import('@/features/tasks/TasksPage').then((m) => ({ default: m.TasksPage })),
);
const WhatsAppPage = React.lazy(() =>
  import('@/features/whatsapp/WhatsAppPage').then((m) => ({ default: m.WhatsAppPage })),
);
const ReportsPage = React.lazy(() =>
  import('@/features/reports/ReportsPage').then((m) => ({ default: m.ReportsPage })),
);
const UsersPage = React.lazy(() =>
  import('@/features/users/UsersPage').then((m) => ({ default: m.UsersPage })),
);
const TeamLeadsPage = React.lazy(() =>
  import('@/features/teamleads/TeamLeadsPage').then((m) => ({ default: m.TeamLeadsPage })),
);
const TeamsPage = React.lazy(() =>
  import('@/features/teams/TeamsPage').then((m) => ({ default: m.TeamsPage })),
);
const StaffPage = React.lazy(() =>
  import('@/features/staff/StaffPage').then((m) => ({ default: m.StaffPage })),
);
const ActivityLogsPage = React.lazy(() =>
  import('@/features/activitylogs/ActivityLogsPage').then((m) => ({ default: m.ActivityLogsPage })),
);
const SettingsPage = React.lazy(() =>
  import('@/features/settings/SettingsPage').then((m) => ({ default: m.SettingsPage })),
);

function RouteFallback() {
  return <p className="p-6 text-sm text-muted-foreground">Loading…</p>;
}

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <BrowserRouter>
          <React.Suspense fallback={<RouteFallback />}>
            <Routes>
              <Route path="/login" element={<LoginPage />} />

              <Route element={<ProtectedRoute />}>
                <Route index element={<DashboardPage />} />
                <Route path="in-progress-leads" element={<InProgressLeadsPage />} />
                <Route path="leads" element={<LeadsListPage />} />
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
          </React.Suspense>
        </BrowserRouter>
        <Toaster richColors position="top-right" />
      </AuthProvider>
    </QueryClientProvider>
  );
}
