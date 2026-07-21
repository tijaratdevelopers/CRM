import * as React from 'react';
import { useSearchParams } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Check, Pencil, Plus, Trash2 } from 'lucide-react';
import { apiClient } from '@/lib/apiClient';
import { useAuth } from '@/features/auth/AuthContext';
import type { Campaign, LeadSource } from '@/types';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { MetaIntegrationTab } from './MetaIntegrationTab';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
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
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';

const leadSourceSchema = z.object({
  name: z.string().min(1, 'Name is required'),
  description: z.string().optional(),
});
type LeadSourceFormValues = z.infer<typeof leadSourceSchema>;

const campaignSchema = z.object({
  name: z.string().min(1, 'Name is required'),
  source_id: z.string().optional(),
  is_active: z.boolean(),
});
type CampaignFormValues = z.infer<typeof campaignSchema>;

const ACCESS_MATRIX: { feature: string; admin: boolean; team_lead: boolean; staff: boolean }[] = [
  { feature: 'Dashboard', admin: true, team_lead: true, staff: true },
  { feature: 'Leads', admin: true, team_lead: true, staff: true },
  { feature: 'Meetings', admin: true, team_lead: true, staff: true },
  { feature: 'Follow-ups', admin: true, team_lead: true, staff: true },
  { feature: 'Call Logs', admin: true, team_lead: true, staff: true },
  { feature: 'Tasks', admin: true, team_lead: true, staff: true },
  { feature: 'WhatsApp', admin: true, team_lead: true, staff: true },
  { feature: 'Reports', admin: true, team_lead: true, staff: false },
  { feature: 'Users', admin: true, team_lead: false, staff: false },
  { feature: 'Team Leads', admin: true, team_lead: false, staff: false },
  { feature: 'Staff', admin: true, team_lead: true, staff: false },
  { feature: 'Activity Logs', admin: true, team_lead: true, staff: false },
  { feature: 'Settings', admin: true, team_lead: false, staff: false },
];

function AccessCell({ granted }: { granted: boolean }) {
  return (
    <TableCell className="text-center">
      {granted ? <Check className="mx-auto h-4 w-4 text-emerald-600" /> : null}
    </TableCell>
  );
}

function LeadSourceFormDialog({
  open,
  onOpenChange,
  initial,
  onSubmit,
  isPending,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  initial?: LeadSource;
  onSubmit: (values: LeadSourceFormValues) => void;
  isPending: boolean;
}) {
  const form = useForm<LeadSourceFormValues>({
    resolver: zodResolver(leadSourceSchema),
    values: { name: initial?.name ?? '', description: initial?.description ?? '' },
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{initial ? 'Edit lead source' : 'Add lead source'}</DialogTitle>
        </DialogHeader>
        <form className="flex flex-col gap-4" onSubmit={form.handleSubmit(onSubmit)}>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="ls-name">Name</Label>
            <Input id="ls-name" {...form.register('name')} />
            {form.formState.errors.name && (
              <p className="text-xs text-destructive">{form.formState.errors.name.message}</p>
            )}
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="ls-description">Description</Label>
            <Input id="ls-description" {...form.register('description')} />
          </div>
          <DialogFooter>
            <Button type="submit" disabled={isPending}>
              {isPending ? 'Saving…' : 'Save'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function LeadSourcesTab() {
  const { profile } = useAuth();
  const isAdmin = profile?.role === 'admin';
  const queryClient = useQueryClient();
  const [dialogOpen, setDialogOpen] = React.useState(false);
  const [editing, setEditing] = React.useState<LeadSource | undefined>(undefined);

  const { data: sources, isLoading } = useQuery({
    queryKey: ['lead-sources'],
    queryFn: async () => {
      const { data } = await apiClient.get<LeadSource[]>('/lead-sources');
      return data;
    },
  });

  const invalidate = () => queryClient.invalidateQueries({ queryKey: ['lead-sources'] });

  const createSource = useMutation({
    mutationFn: async (values: LeadSourceFormValues) => {
      const { data } = await apiClient.post<LeadSource>('/lead-sources', values);
      return data;
    },
    onSuccess: () => {
      toast.success('Lead source created');
      setDialogOpen(false);
      invalidate();
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const updateSource = useMutation({
    mutationFn: async ({ id, values }: { id: string; values: LeadSourceFormValues }) => {
      const { data } = await apiClient.patch<LeadSource>(`/lead-sources/${id}`, values);
      return data;
    },
    onSuccess: () => {
      toast.success('Lead source updated');
      setDialogOpen(false);
      setEditing(undefined);
      invalidate();
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const deleteSource = useMutation({
    mutationFn: async (id: string) => {
      await apiClient.delete(`/lead-sources/${id}`);
    },
    onSuccess: () => {
      toast.success('Lead source deleted');
      invalidate();
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const handleSubmit = (values: LeadSourceFormValues) => {
    if (editing) {
      updateSource.mutate({ id: editing.id, values });
    } else {
      createSource.mutate(values);
    }
  };

  return (
    <div className="flex flex-col gap-4">
      {isAdmin && (
        <div className="flex justify-end">
          <Button
            size="sm"
            onClick={() => {
              setEditing(undefined);
              setDialogOpen(true);
            }}
          >
            <Plus className="mr-2 h-4 w-4" />
            Add lead source
          </Button>
        </div>
      )}

      <div className="rounded-lg border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead>
              <TableHead>Description</TableHead>
              {isAdmin && <TableHead className="text-right">Actions</TableHead>}
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading && (
              <TableRow>
                <TableCell colSpan={isAdmin ? 3 : 2} className="py-6 text-center text-sm text-muted-foreground">
                  Loading…
                </TableCell>
              </TableRow>
            )}
            {sources?.map((source) => (
              <TableRow key={source.id}>
                <TableCell className="font-medium">{source.name}</TableCell>
                <TableCell className="text-muted-foreground">{source.description ?? '—'}</TableCell>
                {isAdmin && (
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-2">
                      <Button
                        variant="outline"
                        size="icon"
                        onClick={() => {
                          setEditing(source);
                          setDialogOpen(true);
                        }}
                      >
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="outline"
                        size="icon"
                        onClick={() => {
                          if (window.confirm(`Delete lead source "${source.name}"?`)) {
                            deleteSource.mutate(source.id);
                          }
                        }}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </TableCell>
                )}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      <LeadSourceFormDialog
        open={dialogOpen}
        onOpenChange={(open) => {
          setDialogOpen(open);
          if (!open) setEditing(undefined);
        }}
        initial={editing}
        onSubmit={handleSubmit}
        isPending={createSource.isPending || updateSource.isPending}
      />
    </div>
  );
}

function CampaignFormDialog({
  open,
  onOpenChange,
  initial,
  sources,
  onSubmit,
  isPending,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  initial?: Campaign;
  sources: LeadSource[];
  onSubmit: (values: CampaignFormValues) => void;
  isPending: boolean;
}) {
  const form = useForm<CampaignFormValues>({
    resolver: zodResolver(campaignSchema),
    values: {
      name: initial?.name ?? '',
      source_id: initial?.source_id ?? undefined,
      is_active: initial?.is_active ?? true,
    },
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{initial ? 'Edit campaign' : 'Add campaign'}</DialogTitle>
        </DialogHeader>
        <form className="flex flex-col gap-4" onSubmit={form.handleSubmit(onSubmit)}>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="camp-name">Name</Label>
            <Input id="camp-name" {...form.register('name')} />
            {form.formState.errors.name && (
              <p className="text-xs text-destructive">{form.formState.errors.name.message}</p>
            )}
          </div>
          <div className="flex flex-col gap-1.5">
            <Label>Source</Label>
            <Select
              value={form.watch('source_id') ?? undefined}
              onValueChange={(value) => form.setValue('source_id', value)}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select a source" />
              </SelectTrigger>
              <SelectContent>
                {sources.map((source) => (
                  <SelectItem key={source.id} value={source.id}>
                    {source.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="flex items-center justify-between">
            <Label htmlFor="camp-active">Active</Label>
            <Switch
              id="camp-active"
              checked={form.watch('is_active')}
              onCheckedChange={(checked) => form.setValue('is_active', checked)}
            />
          </div>
          <DialogFooter>
            <Button type="submit" disabled={isPending}>
              {isPending ? 'Saving…' : 'Save'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function CampaignsTab() {
  const { profile } = useAuth();
  const isAdmin = profile?.role === 'admin';
  const queryClient = useQueryClient();
  const [dialogOpen, setDialogOpen] = React.useState(false);
  const [editing, setEditing] = React.useState<Campaign | undefined>(undefined);

  const { data: campaigns, isLoading } = useQuery({
    queryKey: ['campaigns'],
    queryFn: async () => {
      const { data } = await apiClient.get<Campaign[]>('/campaigns');
      return data;
    },
  });

  const { data: sources } = useQuery({
    queryKey: ['lead-sources'],
    queryFn: async () => {
      const { data } = await apiClient.get<LeadSource[]>('/lead-sources');
      return data;
    },
  });

  const invalidate = () => queryClient.invalidateQueries({ queryKey: ['campaigns'] });

  const createCampaign = useMutation({
    mutationFn: async (values: CampaignFormValues) => {
      const { data } = await apiClient.post<Campaign>('/campaigns', values);
      return data;
    },
    onSuccess: () => {
      toast.success('Campaign created');
      setDialogOpen(false);
      invalidate();
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const updateCampaign = useMutation({
    mutationFn: async ({ id, values }: { id: string; values: Partial<CampaignFormValues> }) => {
      const { data } = await apiClient.patch<Campaign>(`/campaigns/${id}`, values);
      return data;
    },
    onSuccess: () => {
      invalidate();
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const deleteCampaign = useMutation({
    mutationFn: async (id: string) => {
      await apiClient.delete(`/campaigns/${id}`);
    },
    onSuccess: () => {
      toast.success('Campaign deleted');
      invalidate();
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const handleSubmit = (values: CampaignFormValues) => {
    if (editing) {
      updateCampaign.mutate(
        { id: editing.id, values },
        {
          onSuccess: () => {
            toast.success('Campaign updated');
            setDialogOpen(false);
            setEditing(undefined);
          },
        },
      );
    } else {
      createCampaign.mutate(values);
    }
  };

  const sourceName = (sourceId: string | null) =>
    sources?.find((s) => s.id === sourceId)?.name ?? '—';

  return (
    <div className="flex flex-col gap-4">
      {isAdmin && (
        <div className="flex justify-end">
          <Button
            size="sm"
            onClick={() => {
              setEditing(undefined);
              setDialogOpen(true);
            }}
          >
            <Plus className="mr-2 h-4 w-4" />
            Add campaign
          </Button>
        </div>
      )}

      <div className="rounded-lg border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead>
              <TableHead>Source</TableHead>
              <TableHead>Active</TableHead>
              {isAdmin && <TableHead className="text-right">Actions</TableHead>}
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading && (
              <TableRow>
                <TableCell colSpan={isAdmin ? 4 : 3} className="py-6 text-center text-sm text-muted-foreground">
                  Loading…
                </TableCell>
              </TableRow>
            )}
            {campaigns?.map((campaign) => (
              <TableRow key={campaign.id}>
                <TableCell className="font-medium">{campaign.name}</TableCell>
                <TableCell className="text-muted-foreground">{sourceName(campaign.source_id)}</TableCell>
                <TableCell>
                  <Switch
                    checked={campaign.is_active}
                    disabled={!isAdmin || updateCampaign.isPending}
                    onCheckedChange={(checked) =>
                      updateCampaign.mutate({ id: campaign.id, values: { is_active: checked } })
                    }
                  />
                </TableCell>
                {isAdmin && (
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-2">
                      <Button
                        variant="outline"
                        size="icon"
                        onClick={() => {
                          setEditing(campaign);
                          setDialogOpen(true);
                        }}
                      >
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="outline"
                        size="icon"
                        onClick={() => {
                          if (window.confirm(`Delete campaign "${campaign.name}"?`)) {
                            deleteCampaign.mutate(campaign.id);
                          }
                        }}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </TableCell>
                )}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      <CampaignFormDialog
        open={dialogOpen}
        onOpenChange={(open) => {
          setDialogOpen(open);
          if (!open) setEditing(undefined);
        }}
        initial={editing}
        sources={sources ?? []}
        onSubmit={handleSubmit}
        isPending={createCampaign.isPending || updateCampaign.isPending}
      />
    </div>
  );
}

function IntegrationsTab() {
  return (
    <div className="flex flex-col gap-4">
      <MetaIntegrationTab />
    </div>
  );
}

function RolesTab() {
  return (
    <div className="rounded-lg border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Feature</TableHead>
            <TableHead className="text-center">Admin</TableHead>
            <TableHead className="text-center">Team Lead</TableHead>
            <TableHead className="text-center">Staff</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {ACCESS_MATRIX.map((row) => (
            <TableRow key={row.feature}>
              <TableCell className="font-medium">{row.feature}</TableCell>
              <AccessCell granted={row.admin} />
              <AccessCell granted={row.team_lead} />
              <AccessCell granted={row.staff} />
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}

const SETTINGS_TABS = ['lead-sources', 'campaigns', 'integrations', 'roles'];

export function SettingsPage() {
  const [searchParams] = useSearchParams();
  const tabParam = searchParams.get('tab');
  const defaultTab = tabParam && SETTINGS_TABS.includes(tabParam) ? tabParam : 'lead-sources';

  return (
    <div className="flex flex-col gap-4">
      <div>
        <h1 className="text-xl font-semibold">Settings</h1>
        <p className="text-sm text-muted-foreground">
          Manage lead sources, campaigns, integrations, and view role permissions.
        </p>
      </div>

      <Tabs defaultValue={defaultTab}>
        <TabsList>
          <TabsTrigger value="lead-sources">Lead Sources</TabsTrigger>
          <TabsTrigger value="campaigns">Campaigns</TabsTrigger>
          <TabsTrigger value="integrations">Integrations</TabsTrigger>
          <TabsTrigger value="roles">Roles &amp; Permissions</TabsTrigger>
        </TabsList>
        <TabsContent value="lead-sources">
          <LeadSourcesTab />
        </TabsContent>
        <TabsContent value="campaigns">
          <CampaignsTab />
        </TabsContent>
        <TabsContent value="integrations">
          <IntegrationsTab />
        </TabsContent>
        <TabsContent value="roles">
          <RolesTab />
        </TabsContent>
      </Tabs>
    </div>
  );
}
