import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import {
  Home, UserPlus, LayoutList, Users, Lock, Globe,
  LayoutGrid, BarChart3, Folder, CheckCircle, Clock, TrendingUp,
} from 'lucide-react';
import PageWrapper from '../components/layout/PageWrapper';
import StatCard from '../components/ui/StatCard';
import RecentBoards from '../components/dashboard/RecentBoards';
import WorkspaceDashboard from '../components/analytics/WorkspaceDashboard';
import useOrgStore from '../store/orgStore';
import useAuthStore from '../store/authStore';
import useBoardStore from '../store/boardStore';
import { getDashboardStats } from '../services/boardService';
import { timeAgo } from '../utils/dateUtils';

/**
 * WorkspaceHomePage (Phase 3.0 / Stage A) — the Monday-style workspace home:
 * a cover banner + workspace icon + name, an Invite action, and tabs
 * (Content / Collaborators / Permissions). One company = one Organisation = a
 * Workspace; boards live inside it (folders land in Stage B).
 */

const COVER_GRADIENT =
  'linear-gradient(120deg, #1E3A8A 0%, #2563EB 45%, #0891B2 100%)';

const AVATAR_COLORS = ['#2563EB', '#16A34A', '#EA580C', '#7C3AED', '#D97706', '#DC2626'];
const colorFor = (seed = '') => {
  let h = 0;
  for (let i = 0; i < seed.length; i += 1) h = (h * 31 + seed.charCodeAt(i)) & 0xffffffff;
  return AVATAR_COLORS[Math.abs(h) % AVATAR_COLORS.length];
};

const Th = ({ children, align = 'left' }) => (
  <th
    className="font-body"
    style={{
      textAlign: align,
      fontSize: 11,
      fontWeight: 600,
      textTransform: 'uppercase',
      letterSpacing: '0.06em',
      color: 'var(--color-text-muted)',
      padding: '10px 14px',
      borderBottom: '1px solid var(--color-border)',
    }}
  >
    {children}
  </th>
);
const Td = ({ children, align = 'left' }) => (
  <td
    className="font-body"
    style={{ textAlign: align, fontSize: 13, color: 'var(--color-text-primary)', padding: '10px 14px', borderBottom: '1px solid var(--color-border)' }}
  >
    {children}
  </td>
);

const ContentTab = ({ boards, onOpen }) => {
  const { t, i18n } = useTranslation();
  if (boards.length === 0) {
    return (
      <p className="font-body" style={{ fontSize: 13, color: 'var(--color-text-muted)', padding: '24px 4px' }}>
        {t('workspace.noBoards')}
      </p>
    );
  }
  return (
    <div className="bg-surface" style={{ borderRadius: 'var(--radius-lg)', border: '1px solid var(--color-border)', overflow: 'hidden' }}>
      <table style={{ width: '100%', borderCollapse: 'collapse' }}>
        <thead>
          <tr>
            <Th>{t('workspace.colName')}</Th>
            <Th>{t('workspace.colVisibility')}</Th>
            <Th>{t('workspace.colUpdated')}</Th>
          </tr>
        </thead>
        <tbody>
          {boards.map((b) => (
            <tr
              key={b._id}
              onClick={() => onOpen(b)}
              className="transition-colors hover:bg-[color:var(--color-bg-subtle)]"
              style={{ cursor: 'pointer' }}
            >
              <Td>
                <span className="inline-flex items-center gap-2">
                  <LayoutList size={15} color="var(--color-text-muted)" />
                  <span style={{ fontWeight: 600 }}>{b.name}</span>
                </span>
              </Td>
              <Td>
                <span className="inline-flex items-center gap-1.5" style={{ fontSize: 12, color: 'var(--color-text-muted)' }}>
                  {b.visibility === 'public' ? <Globe size={13} /> : <Lock size={13} />}
                  {b.visibility}
                </span>
              </Td>
              <Td>{b.updatedAt ? timeAgo(b.updatedAt) : '—'}</Td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};

const CollaboratorsTab = ({ members, adminId }) => {
  const { t } = useTranslation();
  if (!members || members.length === 0) {
    return <p className="font-body" style={{ fontSize: 13, color: 'var(--color-text-muted)', padding: '24px 4px' }}>{t('workspace.noMembers')}</p>;
  }
  return (
    <div className="flex flex-col gap-2">
      {members.map((m) => (
        <div key={m._id} className="bg-surface flex items-center gap-3" style={{ borderRadius: 'var(--radius-md)', border: '1px solid var(--color-border)', padding: '10px 14px' }}>
          <div className="flex items-center justify-center font-display font-bold text-white shrink-0" style={{ width: 32, height: 32, borderRadius: 9999, background: colorFor(m.email || m.name || ''), fontSize: 13 }}>
            {(m.name || m.email || '?').trim().charAt(0).toUpperCase()}
          </div>
          <div className="min-w-0 flex-1">
            <p className="font-body" style={{ fontSize: 13, fontWeight: 600, color: 'var(--color-text-primary)' }}>{m.name || m.email}</p>
            <p className="font-body" style={{ fontSize: 12, color: 'var(--color-text-muted)' }}>{m.email}</p>
          </div>
          <span className="font-body" style={{ fontSize: 11, fontWeight: 600, padding: '2px 8px', borderRadius: 9999, background: 'var(--color-bg-subtle)', color: 'var(--color-text-secondary)' }}>
            {String(m._id) === String(adminId) ? t('workspace.roleAdmin') : t('workspace.roleMember')}
          </span>
        </div>
      ))}
    </div>
  );
};

const OverviewTab = ({ stats, boards }) => {
  const { t } = useTranslation();
  const cards = [
    { icon: Folder, label: t('dashboard.statTotalBoards'), value: stats.totalBoards, color: 'blue' },
    { icon: CheckCircle, label: t('dashboard.statCompletedLeads'), value: stats.completedTasks, color: 'green' },
    { icon: Clock, label: t('dashboard.statPendingLeads'), value: stats.pendingTasks, color: 'orange' },
    { icon: TrendingUp, label: t('dashboard.statCompletionRate'), value: stats.completionRate, suffix: '%', color: 'purple' },
  ];
  return (
    <div className="flex flex-col gap-6">
      <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-4">
        {cards.map((c) => (
          <StatCard key={c.label} icon={c.icon} label={c.label} value={c.value} suffix={c.suffix} color={c.color} />
        ))}
      </div>
      <RecentBoards boards={boards} />
    </div>
  );
};

const INITIAL_STATS = { totalBoards: 0, completedTasks: 0, pendingTasks: 0, completionRate: 0 };

const WorkspaceHomePage = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const currentOrg = useOrgStore((s) => s.currentOrg);
  const members = useOrgStore((s) => s.members);
  const fetchMembers = useOrgStore((s) => s.fetchMembers);
  const adminId = useOrgStore((s) => s.adminId);
  const boards = useBoardStore((s) => s.boards);
  const fetchBoards = useBoardStore((s) => s.fetchBoards);
  const user = useAuthStore((s) => s.user);
  const [tab, setTab] = useState('overview');
  const [stats, setStats] = useState(INITIAL_STATS);

  const orgId = currentOrg?._id || null;
  const isAdmin =
    (!!user && String(adminId || '') === String(user._id)) ||
    (!!user && Array.isArray(currentOrg?.admins) && currentOrg.admins.some((a) => String(typeof a === 'object' && a ? a._id || a : a) === String(user._id)));

  useEffect(() => {
    if (!orgId) return;
    fetchBoards(orgId).catch(() => {});
    fetchMembers(orgId).catch(() => {});
    getDashboardStats(orgId).then((d) => setStats(d || INITIAL_STATS)).catch(() => {});
  }, [orgId, fetchBoards, fetchMembers]);

  const name = currentOrg?.displayName || currentOrg?.name || t('workspace.untitled');
  const initial = name.trim().charAt(0).toUpperCase();

  const tabs = useMemo(
    () => [
      { key: 'overview', label: t('workspace.overview'), icon: LayoutGrid },
      { key: 'content', label: t('workspace.content'), icon: LayoutList },
      { key: 'collaborators', label: t('workspace.collaborators'), icon: Users },
      ...(isAdmin ? [{ key: 'reports', label: t('workspace.reports'), icon: BarChart3 }] : []),
      { key: 'permissions', label: t('workspace.permissions'), icon: Lock },
    ],
    [t, isAdmin]
  );

  return (
    <PageWrapper>
      {/* Cover banner */}
      <div style={{ height: 140, borderRadius: 'var(--radius-lg)', background: COVER_GRADIENT }} />

      {/* Workspace identity */}
      <div className="flex items-end gap-4" style={{ marginTop: -28, paddingLeft: 8 }}>
        <div
          className="flex items-center justify-center font-display font-bold text-white shrink-0"
          style={{ width: 72, height: 72, borderRadius: 'var(--radius-lg)', background: colorFor(name), fontSize: 30, border: '3px solid var(--color-bg-surface)', boxShadow: 'var(--shadow-card)' }}
          aria-hidden="true"
        >
          {initial}
        </div>
        <div className="flex-1 min-w-0 pb-1 flex items-end justify-between gap-3 flex-wrap">
          <div className="flex items-center gap-2">
            <Home size={18} color="var(--color-text-muted)" />
            <h1 className="font-display font-bold" style={{ fontSize: 26, color: 'var(--color-text-primary)' }}>{name}</h1>
          </div>
          <button
            type="button"
            onClick={() => navigate('/members')}
            className="inline-flex items-center gap-1.5 font-body"
            style={{ height: 36, padding: '0 14px', fontSize: 14, fontWeight: 600, borderRadius: 'var(--radius-md)', background: 'var(--color-accent)', color: '#fff', border: 'none', cursor: 'pointer' }}
          >
            <UserPlus size={15} /> {t('workspace.invite')}
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="mt-6 flex items-center gap-1" role="tablist" style={{ borderBottom: '1px solid var(--color-border)' }}>
        {tabs.map((x) => {
          const active = tab === x.key;
          const Icon = x.icon;
          return (
            <button
              key={x.key}
              type="button"
              role="tab"
              aria-selected={active}
              onClick={() => setTab(x.key)}
              className="inline-flex items-center gap-1.5 font-body whitespace-nowrap transition-colors duration-150"
              style={{
                fontSize: 13,
                fontWeight: active ? 600 : 500,
                padding: '8px 14px',
                color: active ? 'var(--color-accent)' : 'var(--color-text-secondary)',
                borderBottom: active ? '2px solid var(--color-accent)' : '2px solid transparent',
                background: 'transparent',
                cursor: 'pointer',
              }}
            >
              <Icon size={15} /> {x.label}
            </button>
          );
        })}
      </div>

      <div className="mt-5">
        {tab === 'overview' && <OverviewTab stats={stats} boards={boards} />}
        {tab === 'content' && <ContentTab boards={boards} onOpen={(b) => navigate(`/boards/${b._id}`)} />}
        {tab === 'collaborators' && <CollaboratorsTab members={members} adminId={adminId} />}
        {tab === 'reports' && <WorkspaceDashboard orgId={orgId} isAdmin={isAdmin} />}
        {tab === 'permissions' && (
          <div className="bg-surface" style={{ borderRadius: 'var(--radius-lg)', border: '1px solid var(--color-border)', padding: 20 }}>
            <p className="font-body" style={{ fontSize: 13, color: 'var(--color-text-secondary)' }}>
              {t('workspace.permissionsNote')}
            </p>
          </div>
        )}
      </div>
    </PageWrapper>
  );
};

export default WorkspaceHomePage;
