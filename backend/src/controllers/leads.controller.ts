import { Request, Response } from 'express';
import * as leadsService from '../services/leads.service';
import { HttpError } from '../middleware/auth';
import { LeadPriority, LeadStatus } from '../types';

function toPositiveInt(value: unknown, fallback: number, max?: number): number {
  const parsed = parseInt(String(value ?? ''), 10);
  const n = Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
  return max ? Math.min(n, max) : n;
}

export async function list(req: Request, res: Response) {
  const page = toPositiveInt(req.query.page, 1);
  const pageSize = toPositiveInt(req.query.pageSize, 20, 100);

  const statusesParam = typeof req.query.statuses === 'string' ? req.query.statuses : undefined;

  const filters = {
    status: req.query.status as LeadStatus | undefined,
    statuses: statusesParam
      ? (statusesParam.split(',').map((s) => s.trim()).filter(Boolean) as LeadStatus[])
      : undefined,
    priority: req.query.priority as LeadPriority | undefined,
    sourceId: req.query.sourceId as string | undefined,
    assignedStaffId: req.query.assignedStaffId as string | undefined,
    assignedTeamLeadId: req.query.assignedTeamLeadId as string | undefined,
    projectId: req.query.projectId as string | undefined,
    search: req.query.search as string | undefined,
    dateFrom: req.query.dateFrom as string | undefined,
    dateTo: req.query.dateTo as string | undefined,
  };

  const result = await leadsService.listLeads(req.user!, filters, page, pageSize);
  res.json(result);
}

export async function getById(req: Request, res: Response) {
  const data = await leadsService.getLeadById(req.user!, req.params.id);
  res.json(data);
}

export async function create(req: Request, res: Response) {
  const body = req.body ?? {};
  if (!body.name) {
    throw new HttpError(400, 'name is required');
  }
  const data = await leadsService.createLead(req.user!, body);
  res.status(201).json(data);
}

export async function update(req: Request, res: Response) {
  const data = await leadsService.updateLead(req.user!, req.params.id, req.body ?? {});
  res.json(data);
}

export async function assign(req: Request, res: Response) {
  const data = await leadsService.assignLead(req.user!, req.params.id, req.body ?? {});
  res.json(data);
}

export async function remove(req: Request, res: Response) {
  await leadsService.deleteLead(req.user!, req.params.id);
  res.status(204).send();
}

export async function bulkUpload(req: Request, res: Response) {
  const file = req.file;
  if (!file) {
    throw new HttpError(400, 'CSV file is required (multipart field "file")');
  }
  const projectId = typeof req.body?.projectId === 'string' ? req.body.projectId : undefined;
  const result = await leadsService.bulkUploadLeads(req.user!, file.buffer, projectId);
  res.status(201).json(result);
}
