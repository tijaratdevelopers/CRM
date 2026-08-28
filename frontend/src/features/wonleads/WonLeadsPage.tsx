import * as React from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { format } from 'date-fns';
import { Trophy, BadgeDollarSign, CircleCheck, Loader2 } from 'lucide-react';

import { apiClient } from '@/lib/apiClient';
import { useAuth } from '@/features/auth/AuthContext';
import { useProject } from '@/features/projects/ProjectContext';
import type { Booking, LeadSource, UserProfile } from '@/types';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';

function formatPkr(amount: number): string {
  return `Rs ${Math.round(amount).toLocaleString('en-PK')}`;
}

export function WonLeadsPage() {
  const navigate = useNavigate();
  const { profile } = useAuth();
  const { selectedProjectId } = useProject();
  const canManage = profile?.role === 'admin' || profile?.role === 'team_lead';

  const bookingsQuery = useQuery({
    queryKey: ['bookings', selectedProjectId],
    queryFn: async () => {
      const { data } = await apiClient.get<Booking[]>('/bookings', {
        params: selectedProjectId ? { projectId: selectedProjectId } : undefined,
      });
      return data;
    },
  });

  const sourcesQuery = useQuery({
    queryKey: ['lead-sources'],
    queryFn: async () => {
      const { data } = await apiClient.get<LeadSource[]>('/lead-sources');
      return data;
    },
  });

  const staffQuery = useQuery({
    queryKey: ['users', 'staff'],
    queryFn: async () => {
      const { data } = await apiClient.get<UserProfile[]>('/users', { params: { role: 'staff' } });
      return data;
    },
    enabled: canManage,
  });

  const sourceMap = React.useMemo(() => {
    const map = new Map<string, string>();
    sourcesQuery.data?.forEach((s) => map.set(s.id, s.name));
    return map;
  }, [sourcesQuery.data]);

  const staffMap = React.useMemo(() => {
    const map = new Map<string, string>();
    staffQuery.data?.forEach((s) => map.set(s.id, s.full_name));
    if (profile) map.set(profile.id, profile.full_name);
    return map;
  }, [staffQuery.data, profile]);

  const bookings = bookingsQuery.data ?? [];
  const totalValue = bookings.reduce((sum, b) => sum + Number(b.amount || 0), 0);
  const downPaymentsDone = bookings.filter((b) => b.down_payment_done).length;

  return (
    <div className="flex flex-col gap-5">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-foreground">Won Leads</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Every closed sale — property, amount, down-payment status and who closed it.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <SummaryCard icon={<Trophy className="h-5 w-5" />} label="Won Leads" value={bookings.length.toLocaleString()} />
        <SummaryCard icon={<BadgeDollarSign className="h-5 w-5" />} label="Total Sale Value" value={formatPkr(totalValue)} />
        <SummaryCard
          icon={<CircleCheck className="h-5 w-5" />}
          label="Down Payments Done"
          value={`${downPaymentsDone} / ${bookings.length}`}
        />
      </div>

      <Card className="neon-panel rounded-2xl p-4">
        {bookingsQuery.isLoading ? (
          <div className="flex h-[220px] items-center justify-center text-sm text-muted-foreground">
            <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Loading…
          </div>
        ) : bookings.length === 0 ? (
          <div className="flex h-[220px] items-center justify-center text-sm text-muted-foreground">
            No won leads yet.
          </div>
        ) : (
          <div className="overflow-x-auto rounded-lg border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Lead</TableHead>
                  <TableHead>Phone</TableHead>
                  <TableHead>Source</TableHead>
                  <TableHead>Property / Plot</TableHead>
                  <TableHead>Amount</TableHead>
                  <TableHead>Down Payment</TableHead>
                  <TableHead>Booking Date</TableHead>
                  {canManage && <TableHead>Closed By</TableHead>}
                </TableRow>
              </TableHeader>
              <TableBody>
                {bookings.map((b) => (
                  <TableRow
                    key={b.id}
                    className="cursor-pointer"
                    onClick={() => b.lead && navigate(`/leads/${b.lead.id}`)}
                  >
                    <TableCell className="font-medium">{b.lead?.name ?? '—'}</TableCell>
                    <TableCell>{b.lead?.phone ?? '—'}</TableCell>
                    <TableCell>
                      {(b.lead?.source_id && sourceMap.get(b.lead.source_id)) || '—'}
                    </TableCell>
                    <TableCell>{b.property_plot}</TableCell>
                    <TableCell className="tabular-nums">{formatPkr(Number(b.amount))}</TableCell>
                    <TableCell>
                      <Badge variant={b.down_payment_done ? 'success' : 'warning'}>
                        {b.down_payment_done ? 'Done' : 'Pending'}
                      </Badge>
                    </TableCell>
                    <TableCell>{format(new Date(b.booking_date), 'MMM d, yyyy')}</TableCell>
                    {canManage && <TableCell>{staffMap.get(b.staff_id) ?? '—'}</TableCell>}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </Card>
    </div>
  );
}

function SummaryCard({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <Card className="neon-panel rounded-2xl p-5">
      <div className="flex items-start justify-between gap-3">
        <p className="text-sm text-muted-foreground">{label}</p>
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-amber-500/15 text-amber-400 ring-1 ring-inset ring-amber-500/30">
          {icon}
        </span>
      </div>
      <p className="mt-3 text-2xl font-bold tracking-tight tabular-nums text-foreground">{value}</p>
    </Card>
  );
}
