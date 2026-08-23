'use client';

import { useCallback, useEffect, useState } from 'react';
import {
  Shield,
  Plus,
  X,
  RefreshCw,
  Database,
  CheckCircle2,
  XCircle,
  Globe,
  Lock,
} from 'lucide-react';
import QRCode from 'qrcode';
import {
  totpStatus,
  totpSetup,
  totpConfirm,
  totpDisable,
  listOrganizations,
  provisionOrganization,
  retryProvisioning,
  suspendOrganization,
  listTenantDbs,
  migrateTenant,
  migrateFleet,
  listPendingListings,
  approveListing,
  rejectListing,
  listPlans,
  seedPlans,
  listFeatureFlags,
  getHealth,
  type Organization,
  type TenantDbRow,
  type PendingListing,
  type Plan,
  type FeatureFlag,
  type PlatformHealth,
} from '@/lib/api';

type Tab = 'ORGANIZATIONS' | 'MODERATION' | 'INFRASTRUCTURE' | 'PLANS_FLAGS' | 'SECURITY';

const TABS: Array<[Tab, string]> = [
  ['ORGANIZATIONS', 'Organizations'],
  ['MODERATION', 'Marketplace Moderation'],
  ['INFRASTRUCTURE', 'Tenant Databases'],
  ['PLANS_FLAGS', 'Plans & Flags'],
  ['SECURITY', 'Security'],
];

function StatusPill({ status }: { status: string }) {
  const s = status.toLowerCase();
  if (['active', 'ready', 'completed', 'healthy'].includes(s))
    return <span className="status-pill status-pill-success">{status.replaceAll('_', ' ')}</span>;
  if (['failed', 'suspended', 'cancelled', 'unhealthy', 'provisioning_failed'].includes(s))
    return <span className="status-pill status-pill-error">{status.replaceAll('_', ' ')}</span>;
  if (['past_due', 'migrating', 'pending', 'provisioning', 'creating', 'seeding'].includes(s))
    return <span className="status-pill status-pill-warning">{status.replaceAll('_', ' ')}</span>;
  return <span className="status-pill status-pill-neutral">{status.replaceAll('_', ' ')}</span>;
}

export default function AdminConsolePage() {
  const [tab, setTab] = useState<Tab>('ORGANIZATIONS');
  const [error, setError] = useState<string | null>(null);
  const [health, setHealth] = useState<PlatformHealth | null>(null);

  // Organizations
  const [orgs, setOrgs] = useState<Organization[]>([]);
  const [plans, setPlans] = useState<Plan[]>([]);
  const [provisionOpen, setProvisionOpen] = useState(false);

  // Moderation
  const [pending, setPending] = useState<PendingListing[]>([]);
  const [rejectingId, setRejectingId] = useState<string | null>(null);

  // Infrastructure
  const [dbs, setDbs] = useState<TenantDbRow[]>([]);
  const [fleetBusy, setFleetBusy] = useState(false);
  const [fleetReport, setFleetReport] = useState<string | null>(null);
  const [rowBusy, setRowBusy] = useState<string | null>(null);

  // Plans & flags
  const [flags, setFlags] = useState<FeatureFlag[]>([]);

  // Security (TOTP self-service)
  const [totpEnabled, setTotpEnabled] = useState<boolean | null>(null);
  const [qrDataUrl, setQrDataUrl] = useState<string | null>(null);
  const [totpSecret, setTotpSecret] = useState<string | null>(null);
  const [totpCodeInput, setTotpCodeInput] = useState('');
  const [totpBusy, setTotpBusy] = useState(false);
  const [totpMsg, setTotpMsg] = useState<string | null>(null);

  const loadHealth = useCallback(async () => {
    try {
      setHealth(await getHealth());
    } catch {
      /* health strip is best-effort */
    }
  }, []);

  useEffect(() => {
    void loadHealth();
    void listPlans().then(setPlans).catch(() => {});
    void listFeatureFlags().then(setFlags).catch(() => {});
  }, [loadHealth]);

  const refreshTab = useCallback(async () => {
    setError(null);
    try {
      if (tab === 'ORGANIZATIONS') setOrgs(await listOrganizations());
      if (tab === 'MODERATION') setPending(await listPendingListings());
      if (tab === 'INFRASTRUCTURE') setDbs(await listTenantDbs());
      if (tab === 'SECURITY') setTotpEnabled((await totpStatus()).enabled);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Request failed');
    }
  }, [tab]);

  useEffect(() => {
    void refreshTab();
  }, [refreshTab]);

  async function run(action: () => Promise<unknown>, rowKey?: string) {
    setError(null);
    if (rowKey) setRowBusy(rowKey);
    try {
      await action();
      await refreshTab();
      void loadHealth();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Action failed');
    } finally {
      if (rowKey) setRowBusy(null);
    }
  }

  return (
    <div className="min-h-screen bg-white text-[#111114]">
      {/* ── Header ── */}
      <header className="border-b border-[#e8e8ea]">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-6 lg:px-8">
          <div className="flex items-center gap-2.5">
            <div className="flex h-7 w-7 items-center justify-center rounded-full bg-[#111114] text-sm font-bold text-white">
              F
            </div>
            <span className="text-base font-semibold tracking-tight">Ferio Platform Admin</span>
            <Shield className="h-4 w-4 text-[#6e6e73]" />
          </div>
          {health && (
            <div className="hidden items-center gap-6 text-xs text-[#6e6e73] md:flex">
              <span>
                Orgs{' '}
                <strong className="text-[#111114]">{health.controlPlane.totalOrganizations}</strong>{' '}
                ({health.controlPlane.activeOrganizations} active)
              </span>
              <span>
                Tenant DBs{' '}
                <strong className="text-[#111114]">{health.tenantDatabases.ready}</strong>/
                {health.tenantDatabases.total} ready
              </span>
              <span>
                Pool {health.connectionPool.activeConnections}/{health.connectionPool.maxPoolSize}
              </span>
            </div>
          )}
        </div>
      </header>

      <main className="mx-auto max-w-7xl space-y-8 px-6 py-10 lg:px-8">
        {/* Tabs */}
        <div className="flex w-fit items-center gap-0.5 rounded-full border border-[#e8e8ea] bg-[#fafafa] p-1">
          {TABS.map(([value, label]) => (
            <button
              key={value}
              onClick={() => setTab(value)}
              className={`rounded-full px-4 py-1.5 text-xs transition-colors ${
                tab === value ? 'bg-[#111114] text-white' : 'text-[#6e6e73] hover:text-[#111114]'
              }`}
            >
              {label}
            </button>
          ))}
        </div>

        {error && (
          <div className="rounded-[10px] border border-[#e8e8ea] bg-[#fafafa] p-4 text-xs">
            <span className="font-medium text-rose-700">Action failed.</span>{' '}
            <span className="text-[#6e6e73]">{error}</span>
          </div>
        )}

        {/* ── ORGANIZATIONS ── */}
        {tab === 'ORGANIZATIONS' && (
          <section className="space-y-5">
            <div className="flex items-center justify-between">
              <p className="text-sm text-[#6e6e73]">
                Every organization gets an isolated PostgreSQL database.
              </p>
              <button
                onClick={() => setProvisionOpen(true)}
                disabled={plans.length === 0}
                title={plans.length === 0 ? 'Seed plans first (Plans & Flags tab)' : ''}
                className="btn-pill-primary gap-1.5 py-2 text-xs disabled:opacity-40"
              >
                <Plus className="h-3.5 w-3.5" /> Provision Organization
              </button>
            </div>

            {orgs.length === 0 ? (
              <div className="rounded-[10px] border border-[#e8e8ea] p-10 text-center">
                <p className="text-sm">No organizations provisioned yet.</p>
              </div>
            ) : (
              <div className="overflow-x-auto rounded-[10px] border border-[#e8e8ea]">
                <table className="w-full text-left text-xs">
                  <thead>
                    <tr className="border-b border-[#e8e8ea]">
                      {['ORGANIZATION', 'SLUG / DOMAIN', 'STATUS', 'PLAN', 'DATABASE', 'ACTIONS'].map(
                        (h) => (
                          <th
                            key={h}
                            className="px-4 py-3 text-[11px] font-medium uppercase tracking-[0.12em] text-[#6e6e73]"
                          >
                            {h}
                          </th>
                        ),
                      )}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#e8e8ea]">
                    {orgs.map((o) => (
                      <tr key={o.id}>
                        <td className="px-4 py-3 font-medium">{o.name}</td>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-1 font-mono text-[11px] text-[#6e6e73]">
                            <Globe className="h-3 w-3" />
                            {(o.domains?.find((d) => d.isPrimary)?.domain ?? `${o.slug}.ferio.com`)}
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          <StatusPill status={o.status} />
                        </td>
                        <td className="px-4 py-3">
                          {o.subscription ? (
                            <span className="rounded-full bg-[#111114] px-2 py-0.5 text-[10px] font-semibold text-white">
                              {o.subscription.plan.tier}
                            </span>
                          ) : (
                            <span className="text-[#6e6e73]">—</span>
                          )}
                        </td>
                        <td className="px-4 py-3">
                          {o.database ? (
                            <span className="font-mono text-[11px] text-[#6e6e73]">
                              {o.database.databaseName} · <StatusPill status={o.database.status} />
                            </span>
                          ) : (
                            <span className="text-[#6e6e73]">not registered</span>
                          )}
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex gap-3">
                            {o.status === 'PROVISIONING_FAILED' && (
                              <button
                                onClick={() =>
                                  run(() => retryProvisioning(o.id), `retry-${o.id}`)
                                }
                                className="inline-flex items-center gap-1 text-[11px] font-medium underline hover:text-[#111114]"
                              >
                                <RefreshCw
                                  className={`h-3 w-3 ${rowBusy === `retry-${o.id}` ? 'animate-spin' : ''}`}
                                />{' '}
                                Retry
                              </button>
                            )}
                            {o.status === 'ACTIVE' && (
                              <button
                                onClick={() => run(() => suspendOrganization(o.id), `sus-${o.id}`)}
                                className="text-[11px] text-[#6e6e73] underline hover:text-[#111114]"
                              >
                                Suspend
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        )}

        {/* ── MODERATION ── */}
        {tab === 'MODERATION' && (
          <section className="space-y-5">
            <p className="text-sm text-[#6e6e73]">
              Listings enter this queue when posted or edited. Approve to publish.
            </p>
            {pending.length === 0 ? (
              <div className="rounded-[10px] border border-[#e8e8ea] p-10 text-center">
                <p className="text-sm">Queue is clear.</p>
                <p className="mt-1 text-xs text-[#6e6e73]">No listings awaiting review.</p>
              </div>
            ) : (
              <ul className="divide-y divide-[#e8e8ea] overflow-hidden rounded-[10px] border border-[#e8e8ea]">
                {pending.map((l) => (
                  <li key={l.id} className="flex flex-wrap items-center gap-4 px-4 py-4">
                    <div className="h-14 w-20 shrink-0 overflow-hidden rounded-[10px] bg-[#fafafa]">
                      {l.media?.[0]?.url ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={l.media[0].url} alt="" className="h-full w-full object-cover" />
                      ) : null}
                    </div>
                    <div className="min-w-0 flex-1 space-y-0.5">
                      <p className="truncate text-sm font-medium">{l.title}</p>
                      <p className="text-xs text-[#6e6e73]">
                        {l.purpose} · {l.assetType.replaceAll('_', ' ').toLowerCase()} ·{' '}
                        {l.area ?? l.district ?? '—'} · ৳{l.price.toLocaleString()} · by{' '}
                        {l.seller.displayName ?? 'unknown'}
                        {l.seller.isIdentityVerified ? ' (verified)' : ' (unverified)'}
                      </p>
                    </div>

                    {rejectingId === l.id ? (
                      <RejectInline
                        onCancel={() => setRejectingId(null)}
                        onConfirm={(reason) =>
                          run(() => rejectListing(l.id, reason)).then(() => setRejectingId(null))
                        }
                      />
                    ) : (
                      <div className="flex gap-2">
                        <button
                          onClick={() => run(() => approveListing(l.id), l.id)}
                          className="btn-pill-primary gap-1 py-1.5 text-xs"
                          disabled={rowBusy === l.id}
                        >
                          <CheckCircle2 className="h-3.5 w-3.5" /> Approve
                        </button>
                        <button
                          onClick={() => setRejectingId(l.id)}
                          className="btn-pill-secondary gap-1 py-1.5 text-xs"
                        >
                          <XCircle className="h-3.5 w-3.5" /> Reject
                        </button>
                      </div>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </section>
        )}

        {/* ── INFRASTRUCTURE ── */}
        {tab === 'INFRASTRUCTURE' && (
          <section className="space-y-5">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <p className="text-sm text-[#6e6e73]">
                Schema registry across all tenant databases. Migration runs with bounded
                concurrency and per-tenant maintenance mode.
              </p>
              <button
                onClick={async () => {
                  setFleetBusy(true);
                  setFleetReport(null);
                  try {
                    const r = await migrateFleet();
                    setFleetReport(
                      `${r.migrated} migrated · ${r.skippedUpToDate} current · ${r.failed} failed`,
                    );
                    await refreshTab();
                  } catch (e) {
                    setError(e instanceof Error ? e.message : 'Fleet migration failed');
                  } finally {
                    setFleetBusy(false);
                  }
                }}
                disabled={fleetBusy || dbs.length === 0}
                className="btn-pill-secondary gap-1.5 py-2 text-xs disabled:opacity-40"
              >
                <Database className={`h-3.5 w-3.5 ${fleetBusy ? 'animate-pulse' : ''}`} />
                Migrate all tenants
              </button>
            </div>

            {fleetReport && (
              <p className="text-xs text-emerald-700">Last fleet run — {fleetReport}</p>
            )}

            {dbs.length === 0 ? (
              <div className="rounded-[10px] border border-[#e8e8ea] p-10 text-center">
                <p className="text-sm">No tenant databases registered.</p>
              </div>
            ) : (
              <div className="overflow-x-auto rounded-[10px] border border-[#e8e8ea]">
                <table className="w-full text-left text-xs">
                  <thead>
                    <tr className="border-b border-[#e8e8ea]">
                      {['DATABASE', 'STATUS', 'SCHEMA VERSION', 'LAST MIGRATED', 'HEALTH', ''].map(
                        (h) => (
                          <th
                            key={h}
                            className="px-4 py-3 text-[11px] font-medium uppercase tracking-[0.12em] text-[#6e6e73]"
                          >
                            {h}
                          </th>
                        ),
                      )}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#e8e8ea]">
                    {dbs.map((d) => (
                      <tr key={d.organizationId}>
                        <td className="px-4 py-3 font-mono text-[11px]">{d.databaseName}</td>
                        <td className="px-4 py-3">
                          <StatusPill status={d.status} />
                        </td>
                        <td className="px-4 py-3 font-mono text-[11px] text-[#6e6e73]">
                          {d.schemaVersion ?? '—'}
                        </td>
                        <td className="px-4 py-3 text-[#6e6e73]">
                          {d.lastMigratedAt
                            ? new Date(d.lastMigratedAt).toLocaleString('en-GB')
                            : 'never'}
                        </td>
                        <td className="px-4 py-3">
                          <StatusPill status={d.isHealthy ? 'healthy' : 'unhealthy'} />
                        </td>
                        <td className="px-4 py-3 text-right">
                          <button
                            onClick={() => run(() => migrateTenant(d.organizationId), d.organizationId)}
                            disabled={rowBusy === d.organizationId}
                            className="text-[11px] font-medium underline hover:text-[#111114] disabled:opacity-40"
                          >
                            {rowBusy === d.organizationId ? 'Migrating…' : 'Migrate now'}
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        )}

        {/* ── PLANS & FLAGS ── */}
        {tab === 'PLANS_FLAGS' && (
          <section className="grid grid-cols-1 gap-8 lg:grid-cols-2">
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <h2 className="eyebrow-label">Subscription Plans</h2>
                <button
                  onClick={() => run(() => seedPlans())}
                  className="text-[11px] underline hover:text-[#111114] text-[#6e6e73]"
                >
                  Seed default plans
                </button>
              </div>
              <div className="divide-y divide-[#e8e8ea] overflow-hidden rounded-[10px] border border-[#e8e8ea]">
                {plans.length === 0 ? (
                  <p className="p-6 text-center text-xs text-[#6e6e73]">No plans loaded.</p>
                ) : (
                  plans.map((p) => (
                    <div key={p.id} className="flex items-center justify-between px-4 py-3">
                      <div>
                        <p className="text-sm font-medium">{p.name}</p>
                        <p className="text-[11px] text-[#6e6e73]">
                          {p.maxUnits.toLocaleString()} units · ৳{p.monthlyPriceBdt.toLocaleString()}/mo
                        </p>
                      </div>
                      <span className="rounded-full bg-[#111114] px-2 py-0.5 text-[10px] font-semibold text-white">
                        {p.tier}
                      </span>
                    </div>
                  ))
                )}
              </div>
            </div>

            <div className="space-y-3">
              <h2 className="eyebrow-label">Feature Flags</h2>
              <div className="divide-y divide-[#e8e8ea] overflow-hidden rounded-[10px] border border-[#e8e8ea]">
                {flags.length === 0 ? (
                  <p className="p-6 text-center text-xs text-[#6e6e73]">No flags defined.</p>
                ) : (
                  flags.map((f) => (
                    <div key={f.id} className="flex items-center justify-between px-4 py-3">
                      <div>
                        <p className="font-mono text-xs font-semibold">{f.key}</p>
                        {f.description && (
                          <p className="text-[11px] text-[#6e6e73]">{f.description}</p>
                        )}
                      </div>
                      <StatusPill status={f.isEnabled ? 'active' : 'inactive'} />
                    </div>
                  ))
                )}
              </div>
            </div>
          </section>
        )}

        {/* ── SECURITY ── */}
        {tab === 'SECURITY' && (
          <section className="max-w-xl space-y-5">
            <div className="space-y-1">
              <h2 className="flex items-center gap-2 text-sm font-semibold">
                <Lock className="h-4 w-4" /> Two-factor authentication
              </h2>
              <p className="text-xs leading-relaxed text-[#6e6e73]">
                Time-based one-time codes (RFC-6238) via any authenticator app.
                Required at every staff sign-in once enabled.
              </p>
            </div>

            {totpEnabled === null ? (
              <p className="text-xs text-[#6e6e73]">Loading…</p>
            ) : totpEnabled ? (
              <DisableTotp
                busy={totpBusy}
                code={totpCodeInput}
                onCodeChange={setTotpCodeInput}
                msg={totpMsg}
                onDisable={async () => {
                  setTotpBusy(true);
                  setTotpMsg(null);
                  try {
                    await totpDisable(totpCodeInput);
                    setTotpCodeInput('');
                    setTotpEnabled(false);
                    setTotpMsg('Two-factor disabled.');
                  } catch (e) {
                    setTotpMsg(e instanceof Error ? e.message : 'Failed');
                  } finally {
                    setTotpBusy(false);
                  }
                }}
              />
            ) : qrDataUrl ? (
              <div className="space-y-4 rounded-[10px] border border-[#e8e8ea] p-5">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={qrDataUrl} alt="TOTP QR code" className="h-44 w-44 rounded-[10px] border border-[#e8e8ea]" />
                <p className="text-xs leading-relaxed text-[#6e6e73]">
                  Scan with Google Authenticator / Aegis / 1Password, or enter this key manually:{' '}
                  <span className="font-mono font-semibold text-[#111114]">{totpSecret}</span>
                </p>
                <CodeStep
                  busy={totpBusy}
                  code={totpCodeInput}
                  onCodeChange={setTotpCodeInput}
                  msg={totpMsg}
                  label="Confirm enrollment"
                  onConfirm={async () => {
                    setTotpBusy(true);
                    setTotpMsg(null);
                    try {
                      await totpConfirm(totpCodeInput);
                      setQrDataUrl(null);
                      setTotpSecret(null);
                      setTotpCodeInput('');
                      setTotpEnabled(true);
                      setTotpMsg('Two-factor enabled — required at next sign-in.');
                    } catch (e) {
                      setTotpMsg(e instanceof Error ? e.message : 'Failed');
                    } finally {
                      setTotpBusy(false);
                    }
                  }}
                />
              </div>
            ) : (
              <div className="space-y-4">
                <button
                  onClick={async () => {
                    setTotpBusy(true);
                    setTotpMsg(null);
                    try {
                      const { secret, otpauthUri } = await totpSetup();
                      setTotpSecret(secret);
                      setQrDataUrl(await QRCode.toDataURL(otpauthUri, { width: 220, margin: 1 }));
                    } catch (e) {
                      setTotpMsg(e instanceof Error ? e.message : 'Setup failed');
                    } finally {
                      setTotpBusy(false);
                    }
                  }}
                  disabled={totpBusy}
                  className="btn-pill-primary py-2 text-xs disabled:opacity-50"
                >
                  {totpBusy ? 'Preparing…' : 'Enable two-factor'}
                </button>
                {totpMsg && <p className="text-xs text-rose-700">{totpMsg}</p>}
              </div>
            )}
          </section>
        )}
      </main>

      {provisionOpen && (
        <ProvisionModal
          plans={plans}
          onClose={() => setProvisionOpen(false)}
          onDone={() => {
            setProvisionOpen(false);
            void refreshTab();
            void loadHealth();
          }}
        />
      )}
    </div>
  );
}

// ────────────────────────────────────────────────────────────

function RejectInline({
  onConfirm,
  onCancel,
}: {
  onConfirm: (reason: string) => Promise<void>;
  onCancel: () => void;
}) {
  const [reason, setReason] = useState('');
  return (
    <div className="flex items-center gap-2">
      <input
        value={reason}
        onChange={(e) => setReason(e.target.value)}
        placeholder="Reason (required)"
        className="w-48 rounded-[10px] border border-[#e8e8ea] bg-[#fafafa] px-3 py-1.5 text-xs outline-none focus:border-[#111114]"
      />
      <button
        onClick={() => reason.trim() && void onConfirm(reason.trim())}
        disabled={!reason.trim()}
        className="btn-pill-primary py-1.5 text-xs disabled:opacity-40"
      >
        Confirm
      </button>
      <button onClick={onCancel} className="text-[#6e6e73] hover:text-[#111114]">
        <X className="h-4 w-4" />
      </button>
    </div>
  );
}

function ProvisionModal({
  plans,
  onClose,
  onDone,
}: {
  plans: Plan[];
  onClose: () => void;
  onDone: () => void;
}) {
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [result, setResult] = useState<{ domain: string; schemaVersion?: string } | null>(null);

  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    setSaving(true);
    setFormError(null);
    try {
      const r = await provisionOrganization({
        name: String(f.get('name')),
        slug: String(f.get('slug')).toLowerCase(),
        ownerUserId: String(f.get('ownerUserId')),
        ownerName: String(f.get('ownerName')),
        ownerEmail: String(f.get('ownerEmail')),
        planTier: String(f.get('planTier')),
      });
      if (r.status === 'FAILED') throw new Error('Provisioning failed — see server logs');
      setResult({ domain: r.domain, schemaVersion: r.schemaVersion });
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'Provisioning failed');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="max-h-[90vh] w-full max-w-md space-y-5 overflow-y-auto rounded-[10px] border border-[#e8e8ea] bg-white p-6">
        <div className="flex items-center justify-between">
          <h3 className="text-base font-semibold">Provision Organization</h3>
          <button onClick={onClose} className="text-[#6e6e73] hover:text-[#111114]">
            <X className="h-5 w-5" />
          </button>
        </div>

        {result ? (
          <div className="space-y-4 py-4 text-center">
            <CheckCircle2 className="mx-auto h-10 w-10 text-emerald-700" />
            <p className="text-sm font-medium">Workspace provisioned</p>
            <p className="text-xs text-[#6e6e73]">
              {result.domain}
              {result.schemaVersion ? ` · schema ${result.schemaVersion}` : ''}
            </p>
            <button onClick={onDone} className="btn-pill-primary mx-auto text-xs">
              Done
            </button>
          </div>
        ) : (
          <form className="space-y-4 text-xs" onSubmit={submit}>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="eyebrow-label mb-1 block">Organization name</label>
                <input name="name" required placeholder="Rahman Properties" className="w-full rounded-[10px] border border-[#e8e8ea] bg-[#fafafa] p-2.5" />
              </div>
              <div>
                <label className="eyebrow-label mb-1 block">Slug</label>
                <input name="slug" required pattern="[a-z0-9][a-z0-9-]{2,30}[a-z0-9]" placeholder="rahman" className="w-full rounded-[10px] border border-[#e8e8ea] bg-[#fafafa] p-2.5 font-mono" />
              </div>
            </div>

            <div>
              <label className="eyebrow-label mb-1 block">Plan</label>
              <select name="planTier" defaultValue={plans.find((p) => p.tier === 'STARTER')?.tier ?? plans[0]?.tier} className="w-full rounded-[10px] border border-[#e8e8ea] bg-[#fafafa] p-2.5 capitalize">
                {plans.map((p) => (
                  <option key={p.id} value={p.tier}>
                    {p.name} — ৳{p.monthlyPriceBdt.toLocaleString()}/mo
                  </option>
                ))}
              </select>
            </div>

            <div className="space-y-3 rounded-[10px] border border-[#e8e8ea] p-3">
              <p className="eyebrow-label">Owner account</p>
              <div className="grid grid-cols-2 gap-3">
                <input name="ownerUserId" required placeholder="Central user ID" className="w-full rounded-[10px] border border-[#e8e8ea] bg-[#fafafa] p-2.5 font-mono" />
                <input name="ownerName" required placeholder="Full name" className="w-full rounded-[10px] border border-[#e8e8ea] bg-[#fafafa] p-2.5" />
              </div>
              <input name="ownerEmail" type="email" required placeholder="owner@example.com" className="w-full rounded-[10px] border border-[#e8e8ea] bg-[#fafafa] p-2.5" />
            </div>

            {formError && <p className="text-[11px] text-rose-700">{formError}</p>}

            <div className="flex justify-end gap-2 pt-2">
              <button type="button" onClick={onClose} className="btn-pill-secondary py-2 px-4 text-xs">
                Cancel
              </button>
              <button type="submit" disabled={saving} className="btn-pill-primary py-2 px-4 text-xs disabled:opacity-50">
                {saving ? 'Provisioning…' : 'Create workspace'}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}

// ────────────────────────────────────────────────────────────
// Security sub-components (design language: hairlines, no shadows)
// ────────────────────────────────────────────────────────────

function CodeStep({
  busy, code, onCodeChange, msg, label, onConfirm,
}: {
  busy: boolean; code: string; onCodeChange: (v: string) => void;
  msg: string | null; label: string; onConfirm: () => Promise<void>;
}) {
  return (
    <div className="flex items-end gap-3">
      <div className="flex-1">
        <label className="eyebrow-label mb-1 block">Authenticator code</label>
        <input
          value={code}
          onChange={(e) => onCodeChange(e.target.value.replace(/\D/g, '').slice(0, 6))}
          inputMode="numeric"
          maxLength={6}
          placeholder="000000"
          className="w-36 rounded-[10px] border border-[#e8e8ea] bg-[#fafafa] p-2.5 text-center font-mono text-base tracking-[0.35em] outline-none focus:border-[#111114]"
        />
      </div>
      <button onClick={onConfirm} disabled={busy || code.length !== 6} className="btn-pill-primary py-2.5 text-xs disabled:opacity-40">
        {busy ? 'Verifying…' : label}
      </button>
    </div>
  );
}

function DisableTotp({
  busy, code, onCodeChange, msg, onDisable,
}: {
  busy: boolean; code: string; onCodeChange: (v: string) => void;
  msg: string | null; onDisable: () => Promise<void>;
}) {
  return (
    <div className="space-y-4 rounded-[10px] border border-[#e8e8ea] p-5">
      <p className="flex items-center gap-2 text-xs font-medium text-emerald-700">
        <CheckCircle2 className="h-4 w-4" /> Two-factor is enabled on this account.
      </p>
      <CodeStep busy={busy} code={code} onCodeChange={onCodeChange} msg={msg} label="Disable two-factor" onConfirm={onDisable} />
      {msg && !/required|Invalid/i.test(msg) && <p className="text-xs text-emerald-700">{msg}</p>}
    </div>
  );
}
