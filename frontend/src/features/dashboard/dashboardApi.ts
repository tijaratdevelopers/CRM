import { useQuery } from '@tanstack/react-query';
import { apiClient } from '@/lib/apiClient';
import { useProject } from '@/features/projects/ProjectContext';

export interface MonthlyLeadsPoint {
  month: string;
  count: number;
}

export interface LeadSourcePoint {
  source: string;
  count: number;
}

export interface StaffPerformancePoint {
  staff: string;
  leadsWon: number;
}

export interface DashboardChartsData {
  monthlyLeads: MonthlyLeadsPoint[];
  leadSources: LeadSourcePoint[];
  staffPerformance: StaffPerformancePoint[];
  conversionRate: number;
}

async function fetchDashboardCharts(projectId: string | null): Promise<DashboardChartsData> {
  const { data } = await apiClient.get<DashboardChartsData>('/dashboard/charts', {
    params: projectId ? { projectId } : undefined,
  });
  return data;
}

export function useDashboardCharts() {
  const { selectedProjectId } = useProject();
  return useQuery({
    queryKey: ['dashboard-charts', selectedProjectId],
    queryFn: () => fetchDashboardCharts(selectedProjectId),
  });
}

/** Month-over-month % change from the monthly-leads series (last full point vs the one before). */
export function monthOverMonthTrend(points: MonthlyLeadsPoint[] | undefined): { value: number } | null {
  if (!points || points.length < 2) return null;
  const prev = points[points.length - 2].count;
  const curr = points[points.length - 1].count;
  if (prev === 0) return curr === 0 ? { value: 0 } : { value: 100 };
  return { value: ((curr - prev) / prev) * 100 };
}
