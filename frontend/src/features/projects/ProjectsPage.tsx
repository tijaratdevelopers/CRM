import * as React from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { UserCheck } from 'lucide-react';
import { apiClient } from '@/lib/apiClient';
import type { Project, UserProfile } from '@/types';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

const NONE = '__none__';

interface TeamSummary {
  id: string;
  team_lead_id: string | null;
}

async function fetchProjects(): Promise<Project[]> {
  const { data } = await apiClient.get<Project[]>('/projects');
  return data;
}

async function fetchStaff(): Promise<UserProfile[]> {
  const { data } = await apiClient.get<UserProfile[]>('/users', { params: { role: 'staff' } });
  return data;
}

async function fetchTeamLeads(): Promise<UserProfile[]> {
  const { data } = await apiClient.get<UserProfile[]>('/team-leads');
  return data;
}

async function fetchProjectTeams(projectId: string): Promise<TeamSummary[]> {
  const { data } = await apiClient.get<TeamSummary[]>('/teams', { params: { projectId } });
  return data;
}

function ProjectFormDialog({
  open,
  project,
  staff,
  teamLeads,
  onOpenChange,
}: {
  open: boolean;
  project: Project | null;
  staff: UserProfile[];
  teamLeads: UserProfile[];
  onOpenChange: (open: boolean) => void;
}) {
  const queryClient = useQueryClient();
  const [name, setName] = React.useState('');
  const [description, setDescription] = React.useState('');
  const [directStaffId, setDirectStaffId] = React.useState<string>(NONE);
  const [selectedTeamLeadIds, setSelectedTeamLeadIds] = React.useState<string[]>([]);

  const projectTeamsQuery = useQuery({
    queryKey: ['project-teams', project?.id],
    queryFn: () => fetchProjectTeams(project!.id),
    enabled: open && !!project,
  });

  React.useEffect(() => {
    if (open) {
      setName(project?.name ?? '');
      setDescription(project?.description ?? '');
      setDirectStaffId(project?.direct_staff_id ?? NONE);
      setSelectedTeamLeadIds([]);
    }
  }, [open, project]);

  // Pre-check whichever team leads already have a team on this project, once that loads.
  React.useEffect(() => {
    if (projectTeamsQuery.data) {
      const ids = projectTeamsQuery.data.map((t) => t.team_lead_id).filter((id): id is string => Boolean(id));
      setSelectedTeamLeadIds(Array.from(new Set(ids)));
    }
  }, [projectTeamsQuery.data]);

  const toggleTeamLead = (id: string, checked: boolean) => {
    setSelectedTeamLeadIds((prev) => (checked ? [...prev, id] : prev.filter((tlId) => tlId !== id)));
  };

  const mutation = useMutation({
    mutationFn: async () => {
      const payload = {
        name,
        description: description || null,
        directStaffId: directStaffId === NONE ? null : directStaffId,
        teamLeadIds: selectedTeamLeadIds,
      };
      if (project) {
        await apiClient.patch(`/projects/${project.id}`, payload);
      } else {
        await apiClient.post('/projects', payload);
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['projects'] });
      toast.success(project ? 'Project updated' : 'Project created');
      onOpenChange(false);
    },
    onError: (err: Error) => toast.error(err.message),
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{project ? 'Edit project' : 'Create project'}</DialogTitle>
          <DialogDescription>
            Each project has its own teams, leads, Meta connection, and reporting — fully
            isolated from every other project.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="project-name">Project name</Label>
            <Input
              id="project-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Project Alpha"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="project-description">Description</Label>
            <Textarea
              id="project-description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Optional notes about this project"
            />
          </div>
          <div className="space-y-2">
            <Label>Team leads</Label>
            <div className="max-h-40 space-y-2 overflow-y-auto rounded-md border p-3">
              {teamLeads.length === 0 && (
                <p className="text-xs text-muted-foreground">No team leads available.</p>
              )}
              {teamLeads.map((tl) => (
                <label key={tl.id} className="flex items-center gap-2 text-sm">
                  <Checkbox
                    checked={selectedTeamLeadIds.includes(tl.id)}
                    onCheckedChange={(checked) => toggleTeamLead(tl.id, !!checked)}
                  />
                  {tl.full_name}
                </label>
              ))}
            </div>
            <p className="text-xs text-muted-foreground">
              Each selected team lead's staff join this project's round-robin pool.
            </p>
          </div>
          <div className="space-y-2">
            <Label>Direct-to-staff routing</Label>
            <Select value={directStaffId} onValueChange={setDirectStaffId}>
              <SelectTrigger>
                <SelectValue placeholder="Use team round-robin instead" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={NONE}>Use team round-robin (default)</SelectItem>
                {staff.map((s) => (
                  <SelectItem key={s.id} value={s.id}>
                    {s.full_name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">
              When set, every lead in this project goes straight to that staff member — team
              round-robin is skipped entirely.
            </p>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button disabled={!name.trim() || mutation.isPending} onClick={() => mutation.mutate()}>
            {mutation.isPending ? 'Saving…' : project ? 'Save changes' : 'Create project'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export function ProjectsPage() {
  const queryClient = useQueryClient();
  const [formOpen, setFormOpen] = React.useState(false);
  const [editingProject, setEditingProject] = React.useState<Project | null>(null);

  const projectsQuery = useQuery({ queryKey: ['projects'], queryFn: fetchProjects });
  const staffQuery = useQuery({ queryKey: ['users', 'staff'], queryFn: fetchStaff });
  const teamLeadsQuery = useQuery({ queryKey: ['team-leads'], queryFn: fetchTeamLeads });

  const projects = projectsQuery.data ?? [];
  const staff = staffQuery.data ?? [];
  const teamLeads = teamLeadsQuery.data ?? [];
  const staffById = React.useMemo(() => new Map(staff.map((s) => [s.id, s.full_name])), [staff]);

  const toggleActiveMutation = useMutation({
    mutationFn: async (project: Project) => {
      await apiClient.patch(`/projects/${project.id}`, { isActive: !project.is_active });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['projects'] });
      toast.success('Project updated');
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      await apiClient.delete(`/projects/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['projects'] });
      toast.success('Project deleted');
    },
    onError: (err: Error) => toast.error(err.message),
  });

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold text-foreground">Projects</h1>
          <p className="text-sm text-muted-foreground">
            Each project runs its own teams, Meta connection, leads, and reports — completely
            isolated from every other project.
          </p>
        </div>
        <Button onClick={() => { setEditingProject(null); setFormOpen(true); }}>Create project</Button>
      </div>

      {projectsQuery.isLoading && <p className="text-sm text-muted-foreground">Loading projects…</p>}
      {!projectsQuery.isLoading && projects.length === 0 && (
        <p className="text-sm text-muted-foreground">No projects yet. Create one to get started.</p>
      )}

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {projects.map((project) => (
          <Card key={project.id} className={project.is_active ? '' : 'opacity-60'}>
            <CardHeader>
              <div className="flex items-center justify-between gap-2">
                <CardTitle className="text-base font-semibold text-foreground">{project.name}</CardTitle>
                <Badge variant={project.is_active ? 'success' : 'secondary'}>
                  {project.is_active ? 'Active' : 'Inactive'}
                </Badge>
              </div>
              {project.description && (
                <p className="text-sm text-muted-foreground">{project.description}</p>
              )}
            </CardHeader>
            <CardContent className="space-y-3">
              {project.direct_staff_id && (
                <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
                  <UserCheck className="h-3.5 w-3.5" />
                  Direct routing to {staffById.get(project.direct_staff_id) ?? 'a staff member'}
                </div>
              )}
              <div className="flex flex-wrap gap-2">
                <Button size="sm" variant="outline" onClick={() => { setEditingProject(project); setFormOpen(true); }}>
                  Edit
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  disabled={toggleActiveMutation.isPending}
                  onClick={() => toggleActiveMutation.mutate(project)}
                >
                  {project.is_active ? 'Deactivate' : 'Activate'}
                </Button>
                <Button
                  size="sm"
                  variant="destructive"
                  disabled={deleteMutation.isPending}
                  onClick={() => {
                    if (window.confirm(`Delete ${project.name}? This fails if it still has teams or leads.`)) {
                      deleteMutation.mutate(project.id);
                    }
                  }}
                >
                  Delete
                </Button>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <ProjectFormDialog
        open={formOpen}
        project={editingProject}
        staff={staff}
        teamLeads={teamLeads}
        onOpenChange={setFormOpen}
      />
    </div>
  );
}
