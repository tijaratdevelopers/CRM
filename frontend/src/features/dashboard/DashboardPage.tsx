import { useAuth } from '@/features/auth/AuthContext';
import { AdminDashboard } from '@/features/dashboard/AdminDashboard';
import { TeamLeadDashboard } from '@/features/dashboard/TeamLeadDashboard';
import { StaffDashboard } from '@/features/dashboard/StaffDashboard';

export function DashboardPage() {
  const { profile, loading } = useAuth();

  if (loading || !profile) {
    return <p className="text-sm text-muted-foreground">Loading…</p>;
  }

  switch (profile.role) {
    case 'admin':
      return <AdminDashboard />;
    case 'team_lead':
      return <TeamLeadDashboard />;
    case 'staff':
      return <StaffDashboard />;
    default:
      return null;
  }
}
