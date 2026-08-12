import { Request, Response } from 'express';
import { HttpError } from '../middleware/auth';
import { toCsv } from '../reports/csv';
import { toExcelBuffer } from '../reports/excel';
import { toPdfBuffer } from '../reports/pdf';
import * as reportsService from '../services/reports.service';

const REPORT_TYPES = [
  'leads',
  'calls',
  'meetings',
  'follow-ups',
  'staff-performance',
  'team-performance',
  'conversion',
  'project-performance',
  'campaign-performance',
  'daily-sales-report',
] as const;

type ReportType = (typeof REPORT_TYPES)[number];

const RESTRICTED_TYPES: ReportType[] = ['staff-performance', 'team-performance', 'project-performance'];

// Stricter than RESTRICTED_TYPES: those allow team_lead, this is admin-only per the user's requirement
// that the Daily Sales Report is a management-only rollup of every staff member's day.
const ADMIN_ONLY_TYPES: ReportType[] = ['daily-sales-report'];

function todayIsoDate(): string {
  return new Date().toISOString().slice(0, 10);
}

function isReportType(value: string): value is ReportType {
  return (REPORT_TYPES as readonly string[]).includes(value);
}

async function resolveReportRows(type: ReportType, req: Request): Promise<Record<string, unknown>[]> {
  const user = req.user!;
  const projectId = typeof req.query.projectId === 'string' ? req.query.projectId : undefined;

  if (RESTRICTED_TYPES.includes(type) && user.role !== 'admin' && user.role !== 'team_lead') {
    throw new HttpError(403, 'Insufficient permissions for this action');
  }
  if (ADMIN_ONLY_TYPES.includes(type) && user.role !== 'admin') {
    throw new HttpError(403, 'Insufficient permissions for this action');
  }

  switch (type) {
    case 'leads':
      return reportsService.getLeadsReport(user, projectId);
    case 'calls':
      return reportsService.getCallsReport(user, projectId);
    case 'meetings':
      return reportsService.getMeetingsReport(user, projectId);
    case 'follow-ups':
      return reportsService.getFollowUpsReport(user, projectId);
    case 'staff-performance':
      return reportsService.getStaffPerformanceReport(user, projectId);
    case 'team-performance':
      return reportsService.getTeamPerformanceReport(user, projectId);
    case 'conversion':
      return reportsService.getConversionReport(user, projectId);
    case 'project-performance':
      return reportsService.getProjectPerformanceReport(user);
    case 'campaign-performance':
      return reportsService.getCampaignPerformanceReport(user, projectId);
    case 'daily-sales-report': {
      const date = typeof req.query.date === 'string' && req.query.date ? req.query.date : todayIsoDate();
      return reportsService.getDailySalesReport(user, date, projectId);
    }
  }
}

export async function preview(req: Request, res: Response) {
  const type = req.params.type;
  if (!isReportType(type)) {
    throw new HttpError(400, `Unknown report type: ${type}`);
  }

  const rows = await resolveReportRows(type, req);
  res.json(rows);
}

export async function exportReport(req: Request, res: Response) {
  const type = req.params.type;
  if (!isReportType(type)) {
    throw new HttpError(400, `Unknown report type: ${type}`);
  }

  const format = String(req.query.format ?? '');
  const rows = await resolveReportRows(type, req);

  if (format === 'csv') {
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename="${type}.csv"`);
    res.send(toCsv(rows));
    return;
  }

  if (format === 'xlsx') {
    const buffer = await toExcelBuffer(type, rows);
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="${type}.xlsx"`);
    res.send(buffer);
    return;
  }

  if (format === 'pdf') {
    const buffer = await toPdfBuffer(type, rows);
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${type}.pdf"`);
    res.send(buffer);
    return;
  }

  throw new HttpError(400, 'Unsupported export format');
}
