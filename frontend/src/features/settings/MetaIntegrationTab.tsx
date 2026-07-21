import * as React from 'react';
import { useSearchParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { formatDistanceToNow } from 'date-fns';
import {
  AlertTriangle,
  Building2,
  CheckCircle2,
  ClipboardList,
  Copy,
  Facebook,
  Loader2,
  PlugZap,
  RefreshCcw,
  Unplug,
} from 'lucide-react';
import { apiClient } from '@/lib/apiClient';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

interface MetaForm {
  id: string;
  name: string;
}

interface MetaStatus {
  status: 'disconnected' | 'pending_setup' | 'connected' | 'expired';
  appConfigured: boolean;
  businessName: string | null;
  pageName: string | null;
  forms: MetaForm[];
  lastSyncedAt: string | null;
  tokenExpiresAt: string | null;
  webhookSubscribed: boolean;
  developer: {
    webhookUrl: string;
    redirectUri: string;
    verifyToken: string;
    appSecretConfigured: boolean;
  };
}

const OAUTH_ERROR_MESSAGES: Record<string, string> = {
  cancelled: 'Meta login was cancelled. Connect again whenever you are ready.',
  oauth_failed: 'Meta login failed. Please try again.',
  invalid_state: 'The login link expired. Please click Connect again.',
  exchange_failed: 'Could not complete the Meta connection. Please try again.',
};

function useMetaStatus() {
  return useQuery({
    queryKey: ['meta-integration-status'],
    queryFn: async () => {
      const { data } = await apiClient.get<MetaStatus>('/meta/status');
      return data;
    },
  });
}

function useConnectMetaAccount() {
  return useMutation({
    mutationFn: async () => {
      const { data } = await apiClient.get<{ url: string }>('/meta/login');
      return data;
    },
    onSuccess: ({ url }) => {
      window.location.href = url;
    },
    onError: (error: Error) => toast.error(error.message),
  });
}

function ConnectButton({ label = 'Connect Meta Account' }: { label?: string }) {
  const connect = useConnectMetaAccount();
  return (
    <Button
      size="lg"
      className="bg-[#1877F2] text-white hover:bg-[#1666d0]"
      disabled={connect.isPending}
      onClick={() => connect.mutate()}
    >
      {connect.isPending ? (
        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
      ) : (
        <Facebook className="mr-2 h-4 w-4" />
      )}
      {label}
    </Button>
  );
}

/** Step 1 — nothing connected yet. */
function DisconnectedView({ appConfigured }: { appConfigured: boolean }) {
  return (
    <div className="flex flex-col items-center gap-4 rounded-xl border border-dashed bg-muted/30 px-6 py-10 text-center">
      <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-[#1877F2]/10">
        <Facebook className="h-7 w-7 text-[#1877F2]" />
      </div>
      <div className="max-w-md space-y-1">
        <p className="text-base font-semibold text-foreground">Connect your Meta account</p>
        <p className="text-sm text-muted-foreground">
          Sign in with Facebook, pick your Page and lead forms, and every ad lead will appear here
          automatically — no technical setup needed.
        </p>
      </div>
      {appConfigured ? (
        <ConnectButton />
      ) : (
        <p className="rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-700">
          Meta integration is not available yet — please contact your solution provider.
        </p>
      )}
    </div>
  );
}

/** Token expired — reconnect banner. */
function ExpiredView() {
  return (
    <div className="flex flex-col items-center gap-4 rounded-xl border border-amber-300 bg-amber-50 px-6 py-8 text-center">
      <AlertTriangle className="h-8 w-8 text-amber-500" />
      <div className="space-y-1">
        <p className="text-base font-semibold text-amber-800">⚠ Connection Expired</p>
        <p className="text-sm text-amber-700">
          Your Meta session has expired, so new leads are paused. Reconnect to resume syncing.
        </p>
      </div>
      <ConnectButton label="Reconnect Meta" />
    </div>
  );
}

/** Steps 3–5 — logged in, pick Business / Page / Forms, then save. */
function SetupWizard() {
  const queryClient = useQueryClient();
  const [businessId, setBusinessId] = React.useState<string>('none');
  const [pageId, setPageId] = React.useState<string>('');
  const [selectedForms, setSelectedForms] = React.useState<MetaForm[]>([]);

  const businessesQuery = useQuery({
    queryKey: ['meta-businesses'],
    queryFn: async () => {
      const { data } = await apiClient.get<{ id: string; name: string }[]>('/meta/businesses');
      return data;
    },
  });

  const pagesQuery = useQuery({
    queryKey: ['meta-pages'],
    queryFn: async () => {
      const { data } = await apiClient.get<{ id: string; name: string }[]>('/meta/pages');
      return data;
    },
  });

  const formsQuery = useQuery({
    queryKey: ['meta-forms', pageId],
    queryFn: async () => {
      const { data } = await apiClient.get<{ id: string; name: string; status?: string }[]>('/meta/forms', {
        params: { pageId },
      });
      return data;
    },
    enabled: Boolean(pageId),
  });

  React.useEffect(() => {
    setSelectedForms([]);
  }, [pageId]);

  const saveMutation = useMutation({
    mutationFn: async () => {
      const business = businessesQuery.data?.find((b) => b.id === businessId);
      const page = pagesQuery.data?.find((p) => p.id === pageId);
      const { data } = await apiClient.post<{ webhookSubscribed: boolean; warning?: string }>('/meta/connect', {
        businessId: business?.id,
        businessName: business?.name,
        pageId,
        pageName: page?.name ?? '',
        forms: selectedForms,
      });
      return data;
    },
    onSuccess: (data) => {
      if (data.warning) {
        toast.warning(data.warning);
      } else {
        toast.success('Meta Lead Ads connected — new leads will now arrive automatically');
      }
      queryClient.invalidateQueries({ queryKey: ['meta-integration-status'] });
    },
    onError: (error: Error) => toast.error(error.message),
  });

  function toggleForm(form: MetaForm, checked: boolean) {
    setSelectedForms((prev) =>
      checked ? [...prev, { id: form.id, name: form.name }] : prev.filter((f) => f.id !== form.id),
    );
  }

  const loadingAssets = businessesQuery.isLoading || pagesQuery.isLoading;

  return (
    <div className="flex flex-col gap-5">
      <div className="flex items-center gap-2 rounded-lg bg-emerald-50 px-3 py-2 text-sm text-emerald-700">
        <CheckCircle2 className="h-4 w-4 shrink-0" />
        Meta account connected — now choose where your leads come from.
      </div>

      {loadingAssets ? (
        <div className="flex items-center gap-2 py-8 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" /> Loading your Meta accounts…
        </div>
      ) : (
        <>
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-1.5">
              <Label className="flex items-center gap-1.5">
                <Building2 className="h-3.5 w-3.5" /> Business
              </Label>
              <Select value={businessId} onValueChange={setBusinessId}>
                <SelectTrigger>
                  <SelectValue placeholder="Select a business" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Personal account (no business)</SelectItem>
                  {businessesQuery.data?.map((b) => (
                    <SelectItem key={b.id} value={b.id}>
                      {b.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label className="flex items-center gap-1.5">
                <Facebook className="h-3.5 w-3.5" /> Facebook Page
              </Label>
              <Select value={pageId || undefined} onValueChange={setPageId}>
                <SelectTrigger>
                  <SelectValue placeholder="Select a page" />
                </SelectTrigger>
                <SelectContent>
                  {(pagesQuery.data ?? []).length === 0 ? (
                    <SelectItem value="__none" disabled>
                      No pages found on this account
                    </SelectItem>
                  ) : (
                    pagesQuery.data?.map((p) => (
                      <SelectItem key={p.id} value={p.id}>
                        {p.name}
                      </SelectItem>
                    ))
                  )}
                </SelectContent>
              </Select>
            </div>
          </div>

          {pageId && (
            <div className="space-y-2">
              <Label className="flex items-center gap-1.5">
                <ClipboardList className="h-3.5 w-3.5" /> Lead Forms
              </Label>
              {formsQuery.isLoading ? (
                <div className="flex items-center gap-2 py-3 text-sm text-muted-foreground">
                  <Loader2 className="h-4 w-4 animate-spin" /> Loading lead forms…
                </div>
              ) : (formsQuery.data ?? []).length === 0 ? (
                <p className="rounded-lg border border-dashed px-3 py-4 text-sm text-muted-foreground">
                  This page has no lead forms yet. Create a Lead Ad on Facebook/Instagram first, then
                  come back here.
                </p>
              ) : (
                <div className="grid gap-2 rounded-lg border p-3 md:grid-cols-2">
                  {formsQuery.data?.map((form) => {
                    const checked = selectedForms.some((f) => f.id === form.id);
                    return (
                      <label
                        key={form.id}
                        className="flex cursor-pointer items-center gap-2.5 rounded-md px-2 py-1.5 text-sm hover:bg-muted/60"
                      >
                        <Checkbox
                          checked={checked}
                          onCheckedChange={(value) => toggleForm(form, value === true)}
                        />
                        <span className="truncate">{form.name}</span>
                        {form.status && form.status !== 'ACTIVE' && (
                          <Badge variant="outline" className="ml-auto text-[10px]">
                            {form.status.toLowerCase()}
                          </Badge>
                        )}
                      </label>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          <div className="flex justify-end">
            <Button
              disabled={!pageId || selectedForms.length === 0 || saveMutation.isPending}
              onClick={() => saveMutation.mutate()}
            >
              {saveMutation.isPending ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Activating…
                </>
              ) : (
                <>
                  <PlugZap className="mr-2 h-4 w-4" /> Save &amp; Activate
                </>
              )}
            </Button>
          </div>
        </>
      )}
    </div>
  );
}

/** Connected — clean status card with Reconnect / Disconnect. */
function ConnectedView({ status }: { status: MetaStatus }) {
  const queryClient = useQueryClient();
  const connect = useConnectMetaAccount();

  const disconnectMutation = useMutation({
    mutationFn: async () => {
      await apiClient.post('/meta/disconnect');
    },
    onSuccess: () => {
      toast.success('Meta account disconnected');
      queryClient.invalidateQueries({ queryKey: ['meta-integration-status'] });
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const lastSync = status.lastSyncedAt
    ? formatDistanceToNow(new Date(status.lastSyncedAt), { addSuffix: true })
    : '—';

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-wrap items-center gap-2">
        <Badge className="gap-1.5 bg-emerald-100 text-emerald-800 hover:bg-emerald-100">
          <span className="h-2 w-2 rounded-full bg-emerald-500" /> Connected
        </Badge>
        {!status.webhookSubscribed && (
          <Badge variant="outline" className="gap-1 border-amber-300 text-amber-700">
            <AlertTriangle className="h-3 w-3" /> Webhook pending — try Reconnect
          </Badge>
        )}
      </div>

      <dl className="grid gap-4 sm:grid-cols-2">
        <div className="rounded-lg border bg-muted/30 p-3">
          <dt className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Business</dt>
          <dd className="mt-1 text-sm font-semibold text-foreground">
            {status.businessName ?? 'Personal account'}
          </dd>
        </div>
        <div className="rounded-lg border bg-muted/30 p-3">
          <dt className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Facebook Page</dt>
          <dd className="mt-1 text-sm font-semibold text-foreground">{status.pageName ?? '—'}</dd>
        </div>
        <div className="rounded-lg border bg-muted/30 p-3">
          <dt className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Lead Forms</dt>
          <dd className="mt-1 flex flex-wrap gap-1.5">
            {status.forms.length === 0 ? (
              <span className="text-sm text-muted-foreground">All forms</span>
            ) : (
              status.forms.map((form) => (
                <Badge key={form.id} variant="secondary">
                  {form.name}
                </Badge>
              ))
            )}
          </dd>
        </div>
        <div className="rounded-lg border bg-muted/30 p-3">
          <dt className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Last Sync</dt>
          <dd className="mt-1 text-sm font-semibold text-foreground">{lastSync}</dd>
        </div>
      </dl>

      <div className="flex flex-wrap gap-2">
        <Button variant="outline" disabled={connect.isPending} onClick={() => connect.mutate()}>
          <RefreshCcw className="mr-2 h-4 w-4" /> Reconnect
        </Button>
        <Button
          variant="outline"
          className="border-destructive/40 text-destructive hover:bg-destructive/10 hover:text-destructive"
          disabled={disconnectMutation.isPending}
          onClick={() => {
            if (window.confirm('Disconnect Meta? New ad leads will stop arriving in the CRM.')) {
              disconnectMutation.mutate();
            }
          }}
        >
          <Unplug className="mr-2 h-4 w-4" /> Disconnect
        </Button>
      </div>
    </div>
  );
}

function CopyField({ label, value }: { label: string; value: string }) {
  const handleCopy = async () => {
    await navigator.clipboard.writeText(value);
    toast.success(`${label} copied`);
  };

  return (
    <div className="space-y-1.5">
      <Label>{label}</Label>
      <div className="flex gap-2">
        <Input readOnly value={value} className="font-mono text-xs" onFocus={(e) => e.target.select()} />
        <Button type="button" variant="outline" size="icon" onClick={handleCopy}>
          <Copy className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}

/** Hidden unless developer mode (?dev=1, or a local dev build). */
function DeveloperSection({ status }: { status: MetaStatus }) {
  return (
    <details className="rounded-lg border bg-muted/20 p-4">
      <summary className="cursor-pointer text-sm font-medium text-muted-foreground">
        Developer settings
      </summary>
      <div className="mt-4 flex flex-col gap-4">
        <CopyField label="Webhook callback URL" value={status.developer.webhookUrl} />
        <CopyField label="OAuth redirect URI" value={status.developer.redirectUri} />
        <CopyField label="Verify token" value={status.developer.verifyToken} />
        <p className="text-xs text-muted-foreground">
          App secret configured: {status.developer.appSecretConfigured ? 'yes' : 'no'} · Webhook
          subscribed: {status.webhookSubscribed ? 'yes' : 'no'}
        </p>
      </div>
    </details>
  );
}

export function MetaIntegrationTab() {
  const queryClient = useQueryClient();
  const [searchParams, setSearchParams] = useSearchParams();
  const { data, isLoading } = useMetaStatus();

  const devMode = searchParams.get('dev') === '1' || import.meta.env.DEV;

  // Handle the OAuth redirect landing (?meta=connected / ?meta_error=...).
  React.useEffect(() => {
    const connected = searchParams.get('meta');
    const oauthError = searchParams.get('meta_error');
    if (!connected && !oauthError) return;

    if (connected === 'connected') {
      toast.success('Meta login successful — choose your Page and lead forms below');
      queryClient.invalidateQueries({ queryKey: ['meta-integration-status'] });
    } else if (oauthError) {
      toast.error(OAUTH_ERROR_MESSAGES[oauthError] ?? 'Meta connection failed. Please try again.');
    }

    const next = new URLSearchParams(searchParams);
    next.delete('meta');
    next.delete('meta_error');
    setSearchParams(next, { replace: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams]);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base text-foreground">Meta Lead Ads</CardTitle>
        <p className="text-sm text-muted-foreground">
          Bring every Facebook &amp; Instagram ad lead into the CRM automatically.
        </p>
      </CardHeader>
      <CardContent className="flex flex-col gap-5">
        {isLoading || !data ? (
          <div className="flex items-center gap-2 py-6 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" /> Loading…
          </div>
        ) : (
          <>
            {data.status === 'disconnected' && <DisconnectedView appConfigured={data.appConfigured} />}
            {data.status === 'expired' && <ExpiredView />}
            {data.status === 'pending_setup' && <SetupWizard />}
            {data.status === 'connected' && <ConnectedView status={data} />}
            {devMode && <DeveloperSection status={data} />}
          </>
        )}
      </CardContent>
    </Card>
  );
}
