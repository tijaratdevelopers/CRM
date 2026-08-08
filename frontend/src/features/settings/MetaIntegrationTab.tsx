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
  Layers,
  Loader2,
  PlugZap,
  RefreshCcw,
  Unplug,
} from 'lucide-react';
import { apiClient } from '@/lib/apiClient';
import { useProject } from '@/features/projects/ProjectContext';
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

interface AdAccount {
  id: string;
  name: string;
  currency?: string;
  account_status?: number;
}

interface AdHierarchyNode {
  id: string;
  externalId: string;
  name: string | null;
  status: string | null;
  children?: AdHierarchyNode[];
}

interface AdHierarchyAccount extends AdHierarchyNode {
  currency: string | null;
  pixels: AdHierarchyNode[];
}

const OAUTH_ERROR_MESSAGES: Record<string, string> = {
  cancelled: 'Meta login was cancelled. Connect again whenever you are ready.',
  oauth_failed: 'Meta login failed. Please try again.',
  invalid_state: 'The login link expired. Please click Connect again.',
  exchange_failed: 'Could not complete the Meta connection. Please try again.',
};

function useMetaStatus(projectId: string) {
  return useQuery({
    queryKey: ['meta-integration-status', projectId],
    queryFn: async () => {
      const { data } = await apiClient.get<MetaStatus>('/meta/status', { params: { projectId } });
      return data;
    },
  });
}

function useConnectMetaAccount(projectId: string) {
  return useMutation({
    mutationFn: async () => {
      const { data } = await apiClient.get<{ url: string }>('/meta/login', { params: { projectId } });
      return data;
    },
    onSuccess: ({ url }) => {
      window.location.href = url;
    },
    onError: (error: Error) => toast.error(error.message),
  });
}

function ConnectButton({ projectId, label = 'Connect Meta Account' }: { projectId: string; label?: string }) {
  const connect = useConnectMetaAccount(projectId);
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
function DisconnectedView({ projectId, appConfigured }: { projectId: string; appConfigured: boolean }) {
  return (
    <div className="flex flex-col items-center gap-4 rounded-xl border border-dashed bg-muted/30 px-6 py-10 text-center">
      <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-[#1877F2]/10">
        <Facebook className="h-7 w-7 text-[#1877F2]" />
      </div>
      <div className="max-w-md space-y-1">
        <p className="text-base font-semibold text-foreground">Connect your Meta account</p>
        <p className="text-sm text-muted-foreground">
          Sign in with Facebook, pick your Page and lead forms, and every ad lead for this
          project will appear here automatically — no technical setup needed.
        </p>
      </div>
      {appConfigured ? (
        <ConnectButton projectId={projectId} />
      ) : (
        <p className="rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-700">
          Meta integration is not available yet — please contact your solution provider.
        </p>
      )}
    </div>
  );
}

/** Token expired — reconnect banner. */
function ExpiredView({ projectId }: { projectId: string }) {
  return (
    <div className="flex flex-col items-center gap-4 rounded-xl border border-amber-300 bg-amber-50 px-6 py-8 text-center">
      <AlertTriangle className="h-8 w-8 text-amber-500" />
      <div className="space-y-1">
        <p className="text-base font-semibold text-amber-800">⚠ Connection Expired</p>
        <p className="text-sm text-amber-700">
          Your Meta session has expired, so new leads are paused. Reconnect to resume syncing.
        </p>
      </div>
      <ConnectButton projectId={projectId} label="Reconnect Meta" />
    </div>
  );
}

/** Steps 3–5 — logged in, pick Business / Page / Forms, then save. */
function SetupWizard({ projectId }: { projectId: string }) {
  const queryClient = useQueryClient();
  const [businessId, setBusinessId] = React.useState<string>('none');
  const [pageId, setPageId] = React.useState<string>('');
  const [selectedForms, setSelectedForms] = React.useState<MetaForm[]>([]);

  const businessesQuery = useQuery({
    queryKey: ['meta-businesses', projectId],
    queryFn: async () => {
      const { data } = await apiClient.get<{ id: string; name: string }[]>('/meta/businesses', {
        params: { projectId },
      });
      return data;
    },
  });

  const pagesQuery = useQuery({
    queryKey: ['meta-pages', projectId],
    queryFn: async () => {
      const { data } = await apiClient.get<{ id: string; name: string }[]>('/meta/pages', {
        params: { projectId },
      });
      return data;
    },
  });

  const formsQuery = useQuery({
    queryKey: ['meta-forms', projectId, pageId],
    queryFn: async () => {
      const { data } = await apiClient.get<{ id: string; name: string; status?: string }[]>('/meta/forms', {
        params: { pageId, projectId },
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
        projectId,
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
      queryClient.invalidateQueries({ queryKey: ['meta-integration-status', projectId] });
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
        Meta account connected — now choose where this project's leads come from.
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

/** Feature 2/3 — pick which ad accounts to track, then sync campaigns/ad sets/ads/pixels. */
function AdAccountsSection({ projectId }: { projectId: string }) {
  const queryClient = useQueryClient();
  const [pickerOpen, setPickerOpen] = React.useState(false);
  const [checkedIds, setCheckedIds] = React.useState<Set<string>>(new Set());

  const liveAccountsQuery = useQuery({
    queryKey: ['meta-ad-accounts-live', projectId],
    queryFn: async () => {
      const { data } = await apiClient.get<AdAccount[]>('/meta/ad-accounts', { params: { projectId } });
      return data;
    },
    enabled: pickerOpen,
  });

  const hierarchyQuery = useQuery({
    queryKey: ['meta-ad-hierarchy', projectId],
    queryFn: async () => {
      const { data } = await apiClient.get<{ adAccounts: AdHierarchyAccount[] }>('/meta/ad-hierarchy', {
        params: { projectId },
      });
      return data.adAccounts;
    },
  });

  const saveMutation = useMutation({
    mutationFn: async () => {
      const accounts = (liveAccountsQuery.data ?? []).filter((a) => checkedIds.has(a.id));
      await apiClient.post('/meta/ad-accounts/save', { projectId, accounts });
    },
    onSuccess: () => {
      toast.success('Ad accounts saved');
      setPickerOpen(false);
      setCheckedIds(new Set());
      queryClient.invalidateQueries({ queryKey: ['meta-ad-hierarchy', projectId] });
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const syncMutation = useMutation({
    mutationFn: async (vars: { kind: 'campaigns' | 'ad-sets' | 'ads' | 'pixels'; id: string }) => {
      const path =
        vars.kind === 'campaigns'
          ? `/meta/ad-accounts/${vars.id}/sync-campaigns`
          : vars.kind === 'ad-sets'
            ? `/meta/campaigns/${vars.id}/sync-ad-sets`
            : vars.kind === 'ads'
              ? `/meta/ad-sets/${vars.id}/sync-ads`
              : `/meta/ad-accounts/${vars.id}/sync-pixels`;
      const { data } = await apiClient.post<{ synced: number }>(path);
      return data;
    },
    onSuccess: (data) => {
      toast.success(`Synced ${data.synced} item(s)`);
      queryClient.invalidateQueries({ queryKey: ['meta-ad-hierarchy', projectId] });
    },
    onError: (error: Error) => toast.error(error.message),
  });

  function toggleAccount(id: string, checked: boolean) {
    setCheckedIds((prev) => {
      const next = new Set(prev);
      if (checked) next.add(id);
      else next.delete(id);
      return next;
    });
  }

  const accounts = hierarchyQuery.data ?? [];

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between gap-2">
          <CardTitle className="flex items-center gap-2 text-base text-foreground">
            <Layers className="h-4 w-4" /> Ad Accounts
          </CardTitle>
          <Button size="sm" variant="outline" onClick={() => setPickerOpen((v) => !v)}>
            {pickerOpen ? 'Cancel' : 'Import ad accounts'}
          </Button>
        </div>
        <p className="text-sm text-muted-foreground">
          Import & track this project's ad accounts, campaigns, ad sets, ads, and pixels.
        </p>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        {pickerOpen && (
          <div className="rounded-lg border p-3">
            {liveAccountsQuery.isLoading ? (
              <div className="flex items-center gap-2 py-3 text-sm text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" /> Loading ad accounts from Meta…
              </div>
            ) : (liveAccountsQuery.data ?? []).length === 0 ? (
              <p className="text-sm text-muted-foreground">No ad accounts found on this Meta account.</p>
            ) : (
              <div className="space-y-1.5">
                {liveAccountsQuery.data?.map((account) => (
                  <label
                    key={account.id}
                    className="flex cursor-pointer items-center gap-2.5 rounded-md px-2 py-1.5 text-sm hover:bg-muted/60"
                  >
                    <Checkbox
                      checked={checkedIds.has(account.id)}
                      onCheckedChange={(value) => toggleAccount(account.id, value === true)}
                    />
                    <span className="truncate">{account.name}</span>
                    {account.currency && (
                      <Badge variant="outline" className="ml-auto text-[10px]">
                        {account.currency}
                      </Badge>
                    )}
                  </label>
                ))}
                <div className="flex justify-end pt-2">
                  <Button
                    size="sm"
                    disabled={checkedIds.size === 0 || saveMutation.isPending}
                    onClick={() => saveMutation.mutate()}
                  >
                    {saveMutation.isPending ? 'Saving…' : `Save ${checkedIds.size || ''} account(s)`}
                  </Button>
                </div>
              </div>
            )}
          </div>
        )}

        {hierarchyQuery.isLoading ? (
          <div className="flex items-center gap-2 py-3 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" /> Loading tracked accounts…
          </div>
        ) : accounts.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            No ad accounts tracked yet — click "Import ad accounts" to pick some.
          </p>
        ) : (
          <div className="space-y-3">
            {accounts.map((account) => (
              <details key={account.id} className="rounded-lg border p-3" open>
                <summary className="flex cursor-pointer items-center justify-between gap-2">
                  <span className="text-sm font-medium text-foreground">
                    {account.name ?? account.externalId} {account.currency ? `(${account.currency})` : ''}
                  </span>
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={syncMutation.isPending}
                    onClick={(e) => {
                      e.preventDefault();
                      syncMutation.mutate({ kind: 'campaigns', id: account.id });
                    }}
                  >
                    Sync campaigns
                  </Button>
                </summary>
                <div className="mt-2 space-y-2 pl-3">
                  {(account.children ?? []).length === 0 && (
                    <p className="text-xs text-muted-foreground">No campaigns synced yet.</p>
                  )}
                  {(account.children ?? []).map((campaign) => (
                    <details key={campaign.id} className="rounded-md border p-2">
                      <summary className="flex cursor-pointer items-center justify-between gap-2">
                        <span className="text-sm text-foreground">{campaign.name ?? campaign.externalId}</span>
                        <Button
                          size="sm"
                          variant="ghost"
                          disabled={syncMutation.isPending}
                          onClick={(e) => {
                            e.preventDefault();
                            syncMutation.mutate({ kind: 'ad-sets', id: campaign.id });
                          }}
                        >
                          Sync ad sets
                        </Button>
                      </summary>
                      <div className="mt-1 space-y-1 pl-3">
                        {(campaign.children ?? []).length === 0 && (
                          <p className="text-xs text-muted-foreground">No ad sets synced yet.</p>
                        )}
                        {(campaign.children ?? []).map((adSet) => (
                          <details key={adSet.id} className="rounded border p-2">
                            <summary className="flex cursor-pointer items-center justify-between gap-2">
                              <span className="text-xs text-foreground">{adSet.name ?? adSet.externalId}</span>
                              <Button
                                size="sm"
                                variant="ghost"
                                disabled={syncMutation.isPending}
                                onClick={(e) => {
                                  e.preventDefault();
                                  syncMutation.mutate({ kind: 'ads', id: adSet.id });
                                }}
                              >
                                Sync ads
                              </Button>
                            </summary>
                            <div className="mt-1 flex flex-wrap gap-1 pl-3">
                              {(adSet.children ?? []).length === 0 ? (
                                <p className="text-xs text-muted-foreground">No ads synced yet.</p>
                              ) : (
                                adSet.children?.map((ad) => (
                                  <Badge key={ad.id} variant="secondary" className="text-[10px]">
                                    {ad.name ?? ad.externalId}
                                  </Badge>
                                ))
                              )}
                            </div>
                          </details>
                        ))}
                      </div>
                    </details>
                  ))}
                </div>
              </details>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

/** Connected — clean status card with Reconnect / Disconnect. */
function ConnectedView({ projectId, status }: { projectId: string; status: MetaStatus }) {
  const queryClient = useQueryClient();
  const connect = useConnectMetaAccount(projectId);

  const disconnectMutation = useMutation({
    mutationFn: async () => {
      await apiClient.post('/meta/disconnect', { projectId });
    },
    onSuccess: () => {
      toast.success('Meta account disconnected');
      queryClient.invalidateQueries({ queryKey: ['meta-integration-status', projectId] });
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
            if (window.confirm('Disconnect Meta? New ad leads will stop arriving for this project.')) {
              disconnectMutation.mutate();
            }
          }}
        >
          <Unplug className="mr-2 h-4 w-4" /> Disconnect
        </Button>
      </div>

      <AdAccountsSection projectId={projectId} />
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
  const { projects, selectedProjectId } = useProject();

  const initialProjectId =
    (searchParams.get('projectId') && projects.some((p) => p.id === searchParams.get('projectId'))
      ? searchParams.get('projectId')
      : null) ??
    (selectedProjectId && projects.some((p) => p.id === selectedProjectId) ? selectedProjectId : null) ??
    projects[0]?.id ??
    null;

  const [projectId, setProjectId] = React.useState<string | null>(initialProjectId);

  React.useEffect(() => {
    if (!projectId && projects.length > 0) setProjectId(projects[0].id);
  }, [projects, projectId]);

  const { data, isLoading } = useMetaStatus(projectId ?? '');

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

  if (projects.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-base text-foreground">Meta Lead Ads</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            Create a project first — Meta connects per project so leads never mix between them.
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
            <CardTitle className="text-base text-foreground">Meta Lead Ads</CardTitle>
            <p className="text-sm text-muted-foreground">
              Bring every Facebook &amp; Instagram ad lead into this project automatically.
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
      <CardContent className="flex flex-col gap-5">
        {isLoading || !data || !projectId ? (
          <div className="flex items-center gap-2 py-6 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" /> Loading…
          </div>
        ) : (
          <>
            {data.status === 'disconnected' && (
              <DisconnectedView projectId={projectId} appConfigured={data.appConfigured} />
            )}
            {data.status === 'expired' && <ExpiredView projectId={projectId} />}
            {data.status === 'pending_setup' && <SetupWizard projectId={projectId} />}
            {data.status === 'connected' && <ConnectedView projectId={projectId} status={data} />}
            {devMode && <DeveloperSection status={data} />}
          </>
        )}
      </CardContent>
    </Card>
  );
}
