import { Sidebar as ProSidebar } from 'react-pro-sidebar';
import { NavLink, useLocation } from 'react-router-dom';
import { useState, useEffect, useRef } from 'react';
import {
  LayoutDashboard, Building2, CreditCard, Receipt, HelpCircle, ScrollText,
  BarChart3, Settings, ChevronsLeft, ChevronsRight, Ticket, FileText,
  Megaphone, LifeBuoy, KeyRound, ShieldCheck,
} from 'lucide-react';
import clsx from 'clsx';
import { useTheme } from '../hooks/useTheme';
import api from '../api/axios';
import endpoints from '../api/endpoints';

// Nav items grouped by purpose. Empty `header` means no group label.
// Section labels render in small caps above the first item of the group.
const navSections = [
  {
    header: 'Overview',
    items: [
      { label: 'Dashboard', path: '/', icon: LayoutDashboard },
    ],
  },
  {
    header: 'Tenants',
    items: [
      { label: 'Hospitals', path: '/hospitals', icon: Building2 },
      { label: 'Plans', path: '/plans', icon: CreditCard },
      { label: 'Coupons', path: '/coupons', icon: Ticket },
    ],
  },
  {
    header: 'Revenue',
    items: [
      { label: 'Billing', path: '/billing', icon: Receipt },
      { label: 'Invoices', path: '/invoices', icon: FileText },
    ],
  },
  {
    header: 'Platform',
    items: [
      { label: 'Announcements', path: '/announcements', icon: Megaphone },
      { label: 'Support', path: '/support', icon: LifeBuoy },
      { label: 'FAQs', path: '/faqs', icon: HelpCircle },
      { label: 'Activity Logs', path: '/activity-logs', icon: ScrollText },
      { label: 'Reports', path: '/reports', icon: BarChart3 },
    ],
  },
  {
    header: 'System',
    items: [
      { label: 'Access Management', path: '/access-management', icon: KeyRound },
      { label: 'Security', path: '/security', icon: ShieldCheck },
      { label: 'Settings', path: '/settings', icon: Settings },
    ],
  },
];

// Single nav row. Owns its own hover state and renders an animated left-edge
// indicator bar when active.
function NavRow({ item, active, collapsed, palette }) {
  const [hover, setHover] = useState(false);
  const Icon = item.icon;
  // Optional unread-style badge. Numeric value → red pill ("9+" if ≥10).
  // When the sidebar is collapsed, becomes a tiny red dot on the icon.
  const badgeValue = typeof item.badge === 'number' ? item.badge : null;
  const showBadge = badgeValue !== null && badgeValue > 0;
  const badgeText = badgeValue > 99 ? '99+' : String(badgeValue);
  return (
    <NavLink
      to={item.path}
      end={item.path === '/'}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      title={collapsed ? `${item.label}${showBadge ? ` (${badgeText} unresolved)` : ''}` : undefined}
      className={clsx(
        'group relative flex items-center rounded-lg transition-all duration-150',
        collapsed ? 'mx-2.5 h-11 justify-center' : 'mx-3 h-10 px-3 gap-3'
      )}
      style={{
        color: active ? palette.activeText : (hover ? palette.hoverText : palette.item),
        backgroundColor: active ? palette.activeBg : (hover ? palette.hoverBg : 'transparent'),
        fontWeight: active ? 600 : 500,
        fontSize: 14,
      }}
    >
      {/* Animated left-edge indicator for the active item */}
      <span
        className={clsx(
          'absolute left-0 top-1/2 -translate-y-1/2 w-1 rounded-r-full transition-all duration-200',
          active ? 'h-6 opacity-100' : 'h-0 opacity-0'
        )}
        style={{
          background: 'linear-gradient(180deg, #2563eb 0%, #4f46e5 100%)',
          boxShadow: active ? '0 0 12px rgba(59,130,246,0.6)' : 'none',
        }}
      />
      <span className="relative shrink-0">
        <Icon
          className={clsx(
            'w-[18px] h-[18px] transition-transform duration-200',
            hover && !active && 'translate-x-0.5'
          )}
          strokeWidth={active ? 2.25 : 2}
          style={{ color: active ? palette.activeText : palette.itemIcon }}
        />
        {showBadge && collapsed && (
          <span
            className="absolute -top-1 -right-1.5 min-w-[14px] h-[14px] px-1 rounded-full bg-rose-500 text-white text-[9px] font-bold leading-none flex items-center justify-center ring-2"
            style={{ '--tw-ring-color': palette.bg, ringColor: palette.bg }}
          >
            {badgeText}
          </span>
        )}
      </span>
      {!collapsed && (
        <>
          <span className="truncate flex-1">{item.label}</span>
          {showBadge && (
            <span className="shrink-0 inline-flex items-center justify-center min-w-[20px] h-[18px] px-1.5 rounded-full bg-rose-500 text-white text-[10px] font-bold tabular-nums leading-none">
              {badgeText}
            </span>
          )}
        </>
      )}
    </NavLink>
  );
}

export default function Sidebar({ collapsed, onToggle, gutter = 12 }) {
  const location = useLocation();
  const { isDark } = useTheme();

  const isActive = (path) =>
    path === '/' ? location.pathname === '/' : location.pathname.startsWith(path);

  // Keep the active nav item visible — scroll the highlighted item into view on
  // route change so items low in the list (e.g. Access Management) aren't left
  // below the fold.
  const navScrollRef = useRef(null);
  useEffect(() => {
    const el = navScrollRef.current?.querySelector('[aria-current="page"]');
    if (el) el.scrollIntoView({ block: 'nearest' });
  }, [location.pathname]);

  const palette = isDark
    ? {
        bg: '#0b1220',
        border: '#1f2937',
        item: '#94a3b8',
        itemIcon: '#64748b',
        activeBg: 'rgba(59, 130, 246, 0.12)',
        activeText: '#60a5fa',
        hoverBg: 'rgba(255, 255, 255, 0.04)',
        hoverText: '#f1f5f9',
        sectionLabel: '#475569',
      }
    : {
        bg: '#ffffff',
        border: '#eef2f6',
        item: '#475569',
        itemIcon: '#94a3b8',
        activeBg: '#eff6ff',
        activeText: '#2563eb',
        hoverBg: '#f8fafc',
        hoverText: '#0f172a',
        sectionLabel: '#94a3b8',
      };

  // Live counter for the Support row's badge. Polled every 60 s so admins
  // always see a current "X unresolved tickets" pill on the nav. Failures
  // are silent — worst case the badge stays at the last known number.
  const [supportUnresolved, setSupportUnresolved] = useState(0);
  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      try {
        const res = await api.get(endpoints.dashboard.supportOverview);
        const c = res.data?.data?.counts || res.data?.counts || {};
        if (!cancelled) setSupportUnresolved(c.unresolved || 0);
      } catch (_) { /* leave previous value in place */ }
    };
    load();
    const id = setInterval(load, 60_000);
    return () => { cancelled = true; clearInterval(id); };
  }, []);

  // Inject live badges into the nav structure. Keep the source `navSections`
  // immutable — return a shallow-cloned copy with badge values merged in.
  const filteredSections = navSections.map((section) => ({
    ...section,
    items: section.items.map((item) =>
      item.path === '/support' ? { ...item, badge: supportUnresolved } : item,
    ),
  }));

  return (
    <ProSidebar
      collapsed={collapsed}
      width="248px"
      collapsedWidth="80px"
      backgroundColor={palette.bg}
      rootStyles={{
        border: `1px solid ${palette.border}`,
        borderRadius: 16,
        height: `calc(100vh - ${gutter * 2}px)`,
        position: 'fixed',
        left: gutter,
        top: gutter,
        color: palette.item,
        overflow: 'hidden',
      }}
    >
      <div className="flex flex-col h-full relative">
        {/* Brand */}
        <div className={clsx('pt-6 pb-4 flex items-center', collapsed ? 'justify-center' : 'px-5')}>
          <div className="flex items-center gap-1.5">
            <img src="/trasnparent_bg_hms_logo.png" alt="MedNote" className="w-9 h-9 object-contain" />
            {!collapsed && (
              <span className="text-[19px] font-bold tracking-tight leading-none">
                <span className="text-blue-600 dark:text-blue-400">Med</span>
                <span className="text-slate-800 dark:text-slate-100">Note</span>
              </span>
            )}
          </div>
        </div>

        <div className="mx-5 mt-2 border-t border-slate-100 dark:border-slate-800" />

        {/* Menu */}
        <div ref={navScrollRef} className="flex-1 min-h-0 overflow-y-auto py-3 sidenav-icons">
          {filteredSections.map((section) => (
              <div key={section.header} className="mb-2">
                {!collapsed && section.header && (
                  <p
                    className="px-5 pt-2 pb-1 text-[10px] font-semibold uppercase tracking-[0.12em]"
                    style={{ color: palette.sectionLabel }}
                  >
                    {section.header}
                  </p>
                )}
                {collapsed && section.header && (
                  <div className="mx-3 my-2 h-px" style={{ backgroundColor: palette.border }} />
                )}
                {section.items.map((item) => (
                  <NavRow
                    key={item.path}
                    item={item}
                    active={isActive(item.path)}
                    collapsed={collapsed}
                    palette={palette}
                  />
                ))}
              </div>
            ))}
        </div>

        {/* Collapse toggle */}
        <div className="shrink-0 flex justify-center py-4 border-t" style={{ borderColor: palette.border, backgroundColor: palette.bg }}>
          <button
            onClick={onToggle}
            className="w-9 h-9 rounded-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 shadow-sm flex items-center justify-center text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-slate-800 transition"
            title={collapsed ? 'Expand' : 'Collapse'}
          >
            {collapsed ? <ChevronsRight className="w-4 h-4" /> : <ChevronsLeft className="w-4 h-4" />}
          </button>
        </div>
      </div>
    </ProSidebar>
  );
}
