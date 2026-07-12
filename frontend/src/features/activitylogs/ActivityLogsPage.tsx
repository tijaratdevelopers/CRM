import * as React from 'react';
import { useQuery } from '@tanstack/react-query';
import { format } from 'date-fns';
import { apiClient } from '@/lib/apiClient';
import type { ActivityLog, PaginatedResponse } from '@/types';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';

const PAGE_SIZE = 20;

const ENTITY_TYPE_OPTIONS = [
  { value: 'all', label: 'All entities' },
  { value: 'lead', label: 'Lead' },
  { value: 'user', label: 'User' },
];

function formatAction(action: string) {
  return action
    .split('_')
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
}

function shortId(id: string | null) {
  if (!id) return '—';
  return `${id.slice(0, 8)}…`;
}

export function ActivityLogsPage() {
  const [entityType, setEntityType] = React.useState('all');
  const [page, setPage] = React.useState(1);

  const filters = { entityType, page, pageSize: PAGE_SIZE };

  const { data, isLoading } = useQuery({
    queryKey: ['activity-logs', filters],
    queryFn: async () => {
      const { data } = await apiClient.get<PaginatedResponse<ActivityLog>>('/activity-logs', {
        params: {
          entityType: entityType === 'all' ? undefined : entityType,
          page,
          pageSize: PAGE_SIZE,
        },
      });
      return data;
    },
  });

  const totalPages = data ? Math.max(1, Math.ceil(data.total / data.pageSize)) : 1;

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold">Activity Logs</h1>
          <p className="text-sm text-muted-foreground">Audit trail of actions across the system.</p>
        </div>

        <Select
          value={entityType}
          onValueChange={(value) => {
            setEntityType(value);
            setPage(1);
          }}
        >
          <SelectTrigger className="w-[180px]">
            <SelectValue placeholder="Entity type" />
          </SelectTrigger>
          <SelectContent>
            {ENTITY_TYPE_OPTIONS.map((option) => (
              <SelectItem key={option.value} value={option.value}>
                {option.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="rounded-lg border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Action</TableHead>
              <TableHead>Entity</TableHead>
              <TableHead>Actor</TableHead>
              <TableHead>Timestamp</TableHead>
              <TableHead className="text-right">Details</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading && (
              <TableRow>
                <TableCell colSpan={5} className="py-6 text-center text-sm text-muted-foreground">
                  Loading…
                </TableCell>
              </TableRow>
            )}
            {!isLoading && data?.data.length === 0 && (
              <TableRow>
                <TableCell colSpan={5} className="py-6 text-center text-sm text-muted-foreground">
                  No activity found.
                </TableCell>
              </TableRow>
            )}
            {data?.data.map((log) => (
              <TableRow key={log.id}>
                <TableCell className="font-medium">{formatAction(log.action)}</TableCell>
                <TableCell>
                  <span className="text-muted-foreground">{log.entity_type}</span>{' '}
                  <span className="font-mono text-xs">{shortId(log.entity_id)}</span>
                </TableCell>
                <TableCell className="font-mono text-xs">{shortId(log.actor_id)}</TableCell>
                <TableCell>{format(new Date(log.created_at), 'MMM d, yyyy HH:mm')}</TableCell>
                <TableCell className="text-right">
                  <Dialog>
                    <DialogTrigger asChild>
                      <Button variant="outline" size="sm">
                        View
                      </Button>
                    </DialogTrigger>
                    <DialogContent className="max-w-lg">
                      <DialogHeader>
                        <DialogTitle>{formatAction(log.action)}</DialogTitle>
                      </DialogHeader>
                      <pre className="max-h-96 overflow-auto rounded-md bg-muted p-3 font-mono text-xs">
                        {JSON.stringify(log.metadata, null, 2)}
                      </pre>
                    </DialogContent>
                  </Dialog>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          Page {data?.page ?? page} of {totalPages} ({data?.total ?? 0} total)
        </p>
        <div className="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            disabled={page <= 1}
            onClick={() => setPage((p) => Math.max(1, p - 1))}
          >
            Previous
          </Button>
          <Button
            variant="outline"
            size="sm"
            disabled={page >= totalPages}
            onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
          >
            Next
          </Button>
        </div>
      </div>
    </div>
  );
}
