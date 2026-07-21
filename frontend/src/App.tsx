import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import { QueryClientProvider } from '@tanstack/react-query';
import { Toaster } from 'sonner';
import { queryClient } from '@/lib/queryClient';
import { AuthProvider } from '@/features/auth/AuthContext';
import { LoginPage } from '@/features/auth/LoginPage';
import { ProtectedRoute } from '@/components/layout/ProtectedRoute';
import { RoleGuard } from '@/components/layout/RoleGuard';

import { DashboardPage } from '@/features/dashboard/DashboardPage';
import { LeadsListPage } from '@/features/leads/LeadsListPage';
import { LeadDetailPage } from '@/features/leads/LeadDetailPage';
import { MeetingsPage } from '@/features/meetings/MeetingsPage';
import { FollowUpsPage } from '@/features/followups/FollowUpsPage';
import { CallLogsPage } from '@/features/calllogs/CallLogsPage';
import { TasksPage } from '@/features/tasks/TasksPage';
import { WhatsAppPage } from '@/features/whatsapp/WhatsAppPage';
import { ReportsPage } from '@/features/reports/ReportsPage';
import { UsersPage } from '@/features/users/UsersPage';
import { TeamLeadsPage } from '@/features/teamleads/TeamLeadsPage';
import { TeamsPage } from '@/features/teams/TeamsPage';
import { StaffPage } from '@/features/staff/StaffPage';
import { ActivityLogsPage } from '@/features/activitylogs/ActivityLogsPage';
import { SettingsPage } from '@/features/settings/SettingsPage';

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <BrowserRouter>
          <Routes>
            <Route path="/login" element={<LoginPage />} />

            <Route element={<ProtectedRoute />}>
              <Route index element={<DashboardPage />} />
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
        </BrowserRouter>
        <Toaster richColors position="top-right" />
      </AuthProvider>
    </QueryClientProvider>
  );
}
