import * as React from 'react';
import { useQuery } from '@tanstack/react-query';
import { Download, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { apiClient } from '@/lib/apiClient';
import { useAuth } from '@/features/auth/AuthContext';
import { useProject } from '@/features/projects/ProjectContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';

type ReportType =
  | 'leads'
  | 'calls'
  | 'meetings'
  | 'follow-ups'
  | 'staff-performance'
  | 'team-performance'
  | 'conversion'
  | 'project-performance'
  | 'campaign-performance'
  | 'daily-sales-report';

type ExportFormat = 'csv' | 'xlsx' | 'pdf';

const REPORT_OPTIONS: { value: ReportType; label: string; adminOnly?: boolean }[] = [
  { value: 'leads', label: 'Leads' },
  { value: 'calls', label: 'Calls' },
  { value: 'meetings', label: 'Meetings' },
  { value: 'follow-ups', label: 'Follow-ups' },
  { value: 'staff-performance', label: 'Staff Performance', adminOnly: true },
  { value: 'team-performance', label: 'Team Performance', adminOnly: true },
  { value: 'project-performance', label: 'Project Performance', adminOnly: true },
  { value: 'campaign-performance', label: 'Campaign Performance' },
  { value: 'conversion', label: 'Conversion' },
  { value: 'daily-sales-report', label: 'Daily Sales Report', adminOnly: true },
];

// Daily Sales Report is admin-only even for team_lead, unlike the other adminOnly reports above
// (which team_lead can also see) — matches the backend's stricter ADMIN_ONLY_TYPES check.
const ADMIN_STRICT_TYPES: ReportType[] = ['daily-sales-report'];

function todayIsoDate(): string {
  return new Date().toISOString().slice(0, 10);
}

const EXPORT_FORMATS: { value: ExportFormat; label: string }[] = [
  { value: 'csv', label: 'CSV' },
  { value: 'xlsx', label: 'Excel' },
  { value: 'pdf', label: 'PDF' },
];

function humanizeKey(key: string): string {
  return key
    .split('_')
    .filter(Boolean)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
}

function formatCellValue(value: unknown): string {
  if (value === null || value === undefined) return '—';
  if (typeof value === 'boolean') return value ? 'Yes' : 'No';
  if (typeof value === 'object') return JSON.stringify(value);
  return String(value);
}

async function fetchReportPreview(
  type: ReportType,
  projectId: string | null,
  date: string | null,
): Promise<Record<string, unknown>[]> {
  const { data } = await apiClient.get<Record<string, unknown>[]>(`/reports/${type}`, {
    params: { projectId: projectId ?? undefined, date: date ?? undefined },
  });
  return data;
}

export function ReportsPage() {
  const { profile } = useAuth();
  const { selectedProjectId } = useProject();
  const [reportType, setReportType] = React.useState<ReportType | ''>('');
  const [exportingFormat, setExportingFormat] = React.useState<ExportFormat | null>(null);
  const [reportDate, setReportDate] = React.useState(todayIsoDate);

  const isDateFiltered = reportType === 'daily-sales-report';

  const visibleOptions = React.useMemo(
    () =>
      REPORT_OPTIONS.filter((option) => {
        if (ADMIN_STRICT_TYPES.includes(option.value)) return profile?.role === 'admin';
        return !option.adminOnly || profile?.role !== 'staff';
      }),
    [profile?.role],
  );

  const previewQuery = useQuery({
    queryKey: ['report-preview', reportType, selectedProjectId, isDateFiltered ? reportDate : null],
    queryFn: () => fetchReportPreview(reportType as ReportType, selectedProjectId, isDateFiltered ? reportDate : null),
    enabled: !!reportType,
  });

  const rows = previewQuery.data ?? [];
  const columns = React.useMemo(() => Object.keys(rows[0] ?? {}), [rows]);

  async function handleExport(format: ExportFormat) {
    if (!reportType) return;
    setExportingFormat(format);
    try {
      const response = await apiClient.get(`/reports/${reportType}/export`, {
        params: {
          format,
          projectId: selectedProjectId ?? undefined,
          date: isDateFiltered ? reportDate : undefined,
        },
        responseType: 'blob',
      });
      const blob = new Blob([response.data]);
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `${reportType}.${format}`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(url);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to export report.';
      toast.error(message);
    } finally {
      setExportingFormat(null);
    }
  }

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-semibold text-foreground">Reports</h1>
        <p className="text-sm text-muted-foreground">
          Preview and export report data across leads, activity, and performance.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Report options</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="w-full max-w-xs">
              <Select
                value={reportType}
                onValueChange={(value) => setReportType(value as ReportType)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select a report type" />
                </SelectTrigger>
                <SelectContent>
                  {visibleOptions.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {isDateFiltered && (
              <div className="w-full max-w-[180px] space-y-1.5">
                <Label htmlFor="report-date" className="text-xs text-muted-foreground">
                  Date
                </Label>
                <Input
                  id="report-date"
                  type="date"
                  value={reportDate}
                  onChange={(e) => setReportDate(e.target.value)}
                />
              </div>
            )}

            <div className="flex gap-2">
              {EXPORT_FORMATS.map((format) => {
                const isExporting = exportingFormat === format.value;
                return (
                  <Button
                    key={format.value}
                    type="button"
                    variant="outline"
                    size="sm"
                    disabled={!reportType || exportingFormat !== null}
                    onClick={() => handleExport(format.value)}
                  >
                    {isExporting ? (
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    ) : (
                      <Download className="mr-2 h-4 w-4" />
                    )}
                    {format.label}
                  </Button>
                );
              })}
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Preview</CardTitle>
        </CardHeader>
        <CardContent>
          {!reportType && (
            <p className="text-sm text-muted-foreground">Select a report type to preview its data.</p>
          )}

          {reportType && previewQuery.isLoading && (
            <p className="text-sm text-muted-foreground">Loading report…</p>
          )}

          {reportType && !previewQuery.isLoading && rows.length === 0 && (
            <p className="text-sm text-muted-foreground">No data for this report.</p>
          )}

          {reportType && !previewQuery.isLoading && rows.length > 0 && (
            <Table>
              <TableHeader>
                <TableRow>
                  {columns.map((column) => (
                    <TableHead key={column}>{humanizeKey(column)}</TableHead>
                  ))}
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((row, index) => (
                  <TableRow key={index}>
                    {columns.map((column) => (
                      <TableCell key={column}>{formatCellValue(row[column])}</TableCell>
                    ))}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
