import { LayoutGrid, Loader, Loader2 } from 'lucide-react';
import { useAuth } from '@/features/auth/AuthContext';
import { AdminDashboard } from '@/features/dashboard/AdminDashboard';
import { TeamLeadDashboard } from '@/features/dashboard/TeamLeadDashboard';
import { StaffDashboard } from '@/features/dashboard/StaffDashboard';
import { InProgressLeads } from '@/features/dashboard/InProgressLeads';
import { ThemeToggle } from '@/features/dashboard/ThemeToggle';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

export function DashboardPage() {
  const { profile, loading } = useAuth();

  if (loading || !profile) {
    return (
      <div className="flex h-[60vh] flex-col items-center justify-center gap-3 text-sm text-muted-foreground">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
        Loading your dashboard…
      </div>
    );
  }

  let dashboard = null;
  switch (profile.role) {
    case 'admin':
      dashboard = <AdminDashboard />;
      break;
    case 'team_lead':
      dashboard = <TeamLeadDashboard />;
      break;
    case 'staff':
      dashboard = <StaffDashboard />;
      break;
    default:
      return null;
  }

  return (
    <Tabs defaultValue="overview">
      <div className="flex items-center justify-between gap-3">
        <TabsList>
          <TabsTrigger value="overview" className="gap-1.5">
            <LayoutGrid className="h-3.5 w-3.5" /> Overview
          </TabsTrigger>
          <TabsTrigger value="in-progress" className="gap-1.5">
            <Loader className="h-3.5 w-3.5" /> In Progress Leads
          </TabsTrigger>
        </TabsList>
        <ThemeToggle />
      </div>
      <TabsContent value="overview" className="mt-4">
        {dashboard}
      </TabsContent>
      <TabsContent value="in-progress" className="mt-4">
        <InProgressLeads />
      </TabsContent>
    </Tabs>
  );
}
