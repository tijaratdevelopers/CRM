import * as React from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { MessageCircle, Loader2, Unplug, PlugZap } from 'lucide-react';
import { apiClient } from '@/lib/apiClient';
import { useProject } from '@/features/projects/ProjectContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

interface WhatsAppIntegration {
  id: string;
  project_id: string;
  phone_number_id: string;
  display_name: string | null;
  is_active: boolean;
}

function useWhatsAppIntegration(projectId: string) {
  return useQuery({
    queryKey: ['whatsapp-integration', projectId],
    queryFn: async () => {
      const { data } = await apiClient.get<WhatsAppIntegration | null>('/whatsapp/integration', {
        params: { projectId },
      });
      return data;
    },
    enabled: Boolean(projectId),
  });
}

export function WhatsAppIntegrationTab() {
  const queryClient = useQueryClient();
  const { projects, selectedProjectId } = useProject();

  const [projectId, setProjectId] = React.useState<string | null>(
    (selectedProjectId && projects.some((p) => p.id === selectedProjectId) ? selectedProjectId : null) ??
      projects[0]?.id ??
      null,
  );
  const [phoneNumberId, setPhoneNumberId] = React.useState('');
  const [displayName, setDisplayName] = React.useState('');

  React.useEffect(() => {
    if (!projectId && projects.length > 0) setProjectId(projects[0].id);
  }, [projects, projectId]);

  const { data, isLoading } = useWhatsAppIntegration(projectId ?? '');

  React.useEffect(() => {
    setPhoneNumberId(data?.phone_number_id ?? '');
    setDisplayName(data?.display_name ?? '');
  }, [data]);

  const connectMutation = useMutation({
    mutationFn: async () => {
      const { data } = await apiClient.post<WhatsAppIntegration>('/whatsapp/integration', {
        projectId,
        phoneNumberId: phoneNumberId.trim(),
        displayName: displayName.trim() || undefined,
      });
      return data;
    },
    onSuccess: () => {
      toast.success('WhatsApp number connected for this project');
      queryClient.invalidateQueries({ queryKey: ['whatsapp-integration', projectId] });
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const disconnectMutation = useMutation({
    mutationFn: async () => {
      await apiClient.delete('/whatsapp/integration', { params: { projectId } });
    },
    onSuccess: () => {
      toast.success('WhatsApp number disconnected');
      setPhoneNumberId('');
      setDisplayName('');
      queryClient.invalidateQueries({ queryKey: ['whatsapp-integration', projectId] });
    },
    onError: (error: Error) => toast.error(error.message),
  });

  if (projects.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-base text-foreground">WhatsApp</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            Create a project first — WhatsApp connects per project so messages never mix between them.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <CardTitle className="flex items-center gap-2 text-base text-foreground">
              <MessageCircle className="h-4 w-4 text-emerald-600" /> WhatsApp
            </CardTitle>
            <p className="text-sm text-muted-foreground">
              Connect this project's own WhatsApp Business phone number so its leads and messages stay separate
              from other projects.
            </p>
          </div>
          <div className="w-[200px]">
            <Select value={projectId ?? undefined} onValueChange={setProjectId}>
              <SelectTrigger>
                <SelectValue placeholder="Select a project" />
              </SelectTrigger>
              <SelectContent>
                {projects.map((project) => (
                  <SelectItem key={project.id} value={project.id}>
                    {project.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        {isLoading || !projectId ? (
          <div className="flex items-center gap-2 py-6 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" /> Loading…
          </div>
        ) : (
          <>
            {data && (
              <div className="flex items-center gap-2">
                <Badge className="gap-1.5 bg-emerald-100 text-emerald-800 hover:bg-emerald-100">
                  <span className="h-2 w-2 rounded-full bg-emerald-500" /> Connected
                </Badge>
              </div>
            )}

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label>WhatsApp Phone Number ID</Label>
                <Input
                  value={phoneNumberId}
                  onChange={(e) => setPhoneNumberId(e.target.value)}
                  placeholder="e.g. 109876543210123"
                  className="font-mono text-xs"
                />
                <p className="text-xs text-muted-foreground">
                  From Meta Business Suite → WhatsApp Manager → Phone numbers.
                </p>
              </div>
              <div className="space-y-1.5">
                <Label>Label (optional)</Label>
                <Input
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                  placeholder="e.g. Burj Quaid Sales"
                />
              </div>
            </div>

            <div className="flex justify-end gap-2">
              {data && (
                <Button
                  type="button"
                  variant="outline"
                  className="border-destructive/40 text-destructive hover:bg-destructive/10 hover:text-destructive"
                  disabled={disconnectMutation.isPending}
                  onClick={() => {
                    if (window.confirm('Disconnect this project\'s WhatsApp number? New messages will fall back to Default Project.')) {
                      disconnectMutation.mutate();
                    }
                  }}
                >
                  <Unplug className="mr-2 h-4 w-4" /> Disconnect
                </Button>
              )}
              <Button
                type="button"
                disabled={!phoneNumberId.trim() || connectMutation.isPending}
                onClick={() => connectMutation.mutate()}
              >
                {connectMutation.isPending ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Saving…
                  </>
                ) : (
                  <>
                    <PlugZap className="mr-2 h-4 w-4" /> {data ? 'Update' : 'Connect'}
                  </>
                )}
              </Button>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}
