// Global Command Palette for the operator console.
// ⌘K / Ctrl+K opens it; type to fuzzy-search across:
//   - Pages              (sidebar destinations)
//   - Hospitals          (debounced API search)
//   - Plans              (in-memory after first load)
//   - Support tickets    (debounced API search)
//   - Quick actions      (Add hospital, New plan, etc.)
//   - Recent             (last 5 things you opened)

import { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { Command } from 'cmdk';
import toast from 'react-hot-toast';
import {
  Search, LayoutDashboard, Building2, CreditCard, Receipt, FileText,
  Ticket, Megaphone, LifeBuoy, HelpCircle, ScrollText, BarChart3,
  Settings, KeyRound, Plus, ArrowRight, Clock, ShieldCheck,
} from 'lucide-react';
import api from '../api/axios';
import endpoints from '../api/endpoints';

const PAGES = [
  { id: 'p:dashboard',    label: 'Dashboard',          path: '/',                  icon: LayoutDashboard, section: 'Overview',  keywords: ['home'] },
  { id: 'p:hospitals',    label: 'Hospitals',          path: '/hospitals',         icon: Building2,       section: 'Tenants',   keywords: ['tenant', 'clinic'] },
  { id: 'p:plans',        label: 'Plans',              path: '/plans',             icon: CreditCard,      section: 'Tenants',   keywords: ['subscription', 'tier'] },
  { id: 'p:coupons',      label: 'Coupons',            path: '/coupons',           icon: Ticket,          section: 'Tenants',   keywords: ['discount', 'promo'] },
  { id: 'p:billing',      label: 'Billing',            path: '/billing',           icon: Receipt,         section: 'Revenue' },
  { id: 'p:invoices',     label: 'Invoices',           path: '/invoices',          icon: FileText,        section: 'Revenue',   keywords: ['invoice', 'tax'] },
  { id: 'p:announce',     label: 'Announcements',      path: '/announcements',     icon: Megaphone,       section: 'Platform',  keywords: ['broadcast', 'banner'] },
  { id: 'p:support',      label: 'Support',            path: '/support',           icon: LifeBuoy,        section: 'Platform',  keywords: ['ticket', 'help'] },
  { id: 'p:faqs',         label: 'FAQs',               path: '/faqs',              icon: HelpCircle,      section: 'Platform',  keywords: ['help', 'kb'] },
  { id: 'p:logs',         label: 'Activity Logs',      path: '/activity-logs',     icon: ScrollText,      section: 'Platform',  keywords: ['audit'] },
  { id: 'p:reports',      label: 'Reports',            path: '/reports',           icon: BarChart3,       section: 'Platform',  keywords: ['analytics'] },
  { id: 'p:access',       label: 'Access Management',  path: '/access-management', icon: KeyRound,        section: 'System',    keywords: ['rbac', 'roles'] },
  { id: 'p:security',     label: 'Security',           path: '/security',          icon: ShieldCheck,     section: 'System',    keywords: ['ip', 'allowlist', 'whitelist', 'network'] },
  { id: 'p:settings',     label: 'Settings',           path: '/settings',          icon: Settings,        section: 'System' },
];

const ACTIONS = [
  // Create flows are modals on the list pages (no /new or /:id/edit routes
  // exist), so these navigate to the list page where the "Add" button lives.
  { id: 'a:newHospital', label: 'Add new hospital',   path: '/hospitals',     icon: Plus, breadcrumb: 'Hospitals' },
  { id: 'a:newPlan',     label: 'Create new plan',    path: '/plans',         icon: Plus, breadcrumb: 'Plans' },
  { id: 'a:newCoupon',   label: 'Create coupon',      path: '/coupons',       icon: Plus, breadcrumb: 'Coupons' },
  { id: 'a:newAnnounce', label: 'New announcement',   path: '/announcements', icon: Plus, breadcrumb: 'Announcements' },
];

const RECENT_KEY = 'hms_admin_palette_recent_v1';
const RECENT_LIMIT = 5;

function loadRecent() {
  try { return JSON.parse(localStorage.getItem(RECENT_KEY) || '[]'); } catch { return []; }
}

export default function CommandPalette({ open, onClose }) {
  const navigate = useNavigate();
  const [query, setQuery] = useState('');
  const [recent, setRecent] = useState(loadRecent);
  const [hospitals, setHospitals] = useState([]);
  const [tickets, setTickets] = useState([]);
  const [plans, setPlans] = useState([]);
  const [searchLoading, setSearchLoading] = useState(false);
  const debounceRef = useRef(null);

  useEffect(() => {
    if (open) {
      setQuery('');
      setRecent(loadRecent());
    }
  }, [open]);

  // Esc closes the palette. cmdk handles Esc inside its own input but
  // doesn't surface an `onClose` event in controlled mode — bind a
  // doc-level listener while open.
  useEffect(() => {
    if (!open) return;
    const onKey = (e) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        e.stopPropagation();
        onClose();
      }
    };
    document.addEventListener('keydown', onKey, true);
    return () => document.removeEventListener('keydown', onKey, true);
  }, [open, onClose]);

  // Plans are short — load once on first open and cache. Filtered locally.
  useEffect(() => {
    if (!open || plans.length > 0) return;
    api.get(endpoints.plans.list, { params: { limit: 100 } })
      .then((res) => {
        const list = res?.data?.data?.plans || res?.data?.data || [];
        setPlans(Array.isArray(list) ? list : []);
      })
      .catch(() => { toast.error('Could not load plans'); });
  }, [open, plans.length]);

  // Debounced search for hospitals + tickets — these can be many.
  useEffect(() => {
    if (!open) return;
    const q = query.trim();
    clearTimeout(debounceRef.current);
    if (q.length < 2) {
      setHospitals([]); setTickets([]); return;
    }
    debounceRef.current = setTimeout(async () => {
      setSearchLoading(true);
      try {
        const [hRes, tRes] = await Promise.all([
          api.get(endpoints.hospitals.list, { params: { search: q, limit: 5 } }).catch(() => null),
          api.get(endpoints.support.list,  { params: { search: q, limit: 5 } }).catch(() => null),
        ]);
        const hList = hRes?.data?.data?.hospitals || hRes?.data?.data || [];
        const tList = tRes?.data?.data?.tickets   || tRes?.data?.data || [];
        setHospitals(Array.isArray(hList) ? hList.slice(0, 5) : []);
        setTickets(Array.isArray(tList) ? tList.slice(0, 5) : []);
      } finally {
        setSearchLoading(false);
      }
    }, 220);
    return () => clearTimeout(debounceRef.current);
  }, [query, open]);

  const remember = useCallback((item) => {
    const next = [
      { id: item.id, label: item.label, path: item.path, breadcrumb: item.breadcrumb, kind: item.kind || 'page' },
      ...recent.filter((r) => r.id !== item.id),
    ].slice(0, RECENT_LIMIT);
    setRecent(next);
    localStorage.setItem(RECENT_KEY, JSON.stringify(next));
  }, [recent]);

  const select = useCallback((item) => {
    remember(item);
    onClose();
    if (item.path) navigate(item.path);
  }, [navigate, onClose, remember]);

  if (!open) return null;

  const hasQuery = query.trim().length > 0;
  const showRecent = !hasQuery && recent.length > 0;

  return (
    <>
      <div
        className="fixed inset-0 z-[100] bg-slate-900/40 backdrop-blur-[3px]"
        onClick={onClose}
      />
      <div className="fixed inset-x-0 top-[10vh] z-[101] flex justify-center px-4 pointer-events-none">
        <Command
          label="Command palette"
          shouldFilter={true}
          className="pointer-events-auto w-full max-w-2xl rounded-2xl border border-slate-200/70 dark:border-slate-700/60 bg-white dark:bg-slate-900 shadow-2xl shadow-slate-900/20 overflow-hidden flex flex-col max-h-[70vh] cmdk-pop"
        >
          <div className="flex items-center gap-3 px-4 py-3 border-b border-slate-100 dark:border-slate-800">
            <Search className="w-4 h-4 text-slate-400 shrink-0" />
            <Command.Input
              autoFocus
              value={query}
              onValueChange={setQuery}
              placeholder="Search hospitals, plans, pages, actions…"
              className="flex-1 bg-transparent border-0 text-[14px] text-slate-900 dark:text-slate-100 placeholder:text-slate-400 focus:outline-none focus:ring-0"
            />
            <kbd className="hidden sm:inline-flex items-center px-1.5 py-0.5 text-[10px] font-medium rounded border border-slate-200 dark:border-slate-700 text-slate-500 dark:text-slate-400 bg-slate-50 dark:bg-slate-800/40">
              ESC
            </kbd>
          </div>

          <Command.List className="flex-1 overflow-y-auto py-2">
            <Command.Empty className="py-10 text-center text-sm text-slate-500 dark:text-slate-400">
              {searchLoading ? 'Searching…' : `No results for "${query}"`}
            </Command.Empty>

            {showRecent && (
              <Command.Group heading="Recent" className="cmdk-group">
                {recent.map((item) => (
                  <PaletteItem
                    key={`r-${item.id}`}
                    value={`recent-${item.id}-${item.label}`}
                    icon={Clock}
                    label={item.label}
                    breadcrumb={item.breadcrumb}
                    onSelect={() => select(item)}
                  />
                ))}
              </Command.Group>
            )}

            {hasQuery && hospitals.length > 0 && (
              <Command.Group heading="Hospitals" className="cmdk-group">
                {hospitals.map((h) => (
                  <PaletteItem
                    key={`h-${h.id}`}
                    value={`hospital-${h.id}-${h.name}-${h.email || ''}`}
                    icon={Building2}
                    label={h.name}
                    detail={[h.email, h.city].filter(Boolean).join(' · ')}
                    breadcrumb="Hospitals"
                    onSelect={() => select({ id: `h:${h.id}`, label: h.name, path: `/hospitals/${h.id}`, breadcrumb: 'Hospitals', kind: 'hospital' })}
                  />
                ))}
              </Command.Group>
            )}

            {hasQuery && plans.filter((p) => p.name.toLowerCase().includes(query.trim().toLowerCase())).length > 0 && (
              <Command.Group heading="Plans" className="cmdk-group">
                {plans
                  .filter((p) => p.name.toLowerCase().includes(query.trim().toLowerCase()))
                  .slice(0, 5)
                  .map((p) => (
                    <PaletteItem
                      key={`pl-${p.id}`}
                      value={`plan-${p.id}-${p.name}`}
                      icon={CreditCard}
                      label={p.name}
                      detail={p.price ? `₹${p.price} · ${p.billingCycle || 'monthly'}` : ''}
                      breadcrumb="Plans"
                      onSelect={() => select({ id: `pl:${p.id}`, label: p.name, path: '/plans', breadcrumb: 'Plans', kind: 'plan' })}
                    />
                  ))}
              </Command.Group>
            )}

            {hasQuery && tickets.length > 0 && (
              <Command.Group heading="Support tickets" className="cmdk-group">
                {tickets.map((t) => (
                  <PaletteItem
                    key={`t-${t.id}`}
                    value={`ticket-${t.id}-${t.number || ''}-${t.subject || ''}`}
                    icon={LifeBuoy}
                    label={t.subject || `Ticket ${t.number}`}
                    detail={t.number ? `#${t.number}${t.status ? ` · ${t.status}` : ''}` : (t.status || '')}
                    breadcrumb="Support"
                    onSelect={() => select({ id: `t:${t.id}`, label: t.subject || `Ticket ${t.number}`, path: `/support/${t.id}`, breadcrumb: 'Support', kind: 'ticket' })}
                  />
                ))}
              </Command.Group>
            )}

            <Command.Group heading="Quick actions" className="cmdk-group">
              {ACTIONS.map((a) => (
                <PaletteItem
                  key={a.id}
                  value={`action ${a.label}`}
                  icon={a.icon}
                  label={a.label}
                  breadcrumb={a.breadcrumb}
                  onSelect={() => select(a)}
                  accent="emerald"
                />
              ))}
            </Command.Group>

            <Command.Group heading="Pages" className="cmdk-group">
              {PAGES.map((p) => (
                <PaletteItem
                  key={p.id}
                  value={`page ${p.label} ${(p.keywords || []).join(' ')}`}
                  icon={p.icon}
                  label={p.label}
                  breadcrumb={p.section}
                  onSelect={() => select(p)}
                />
              ))}
            </Command.Group>
          </Command.List>

          <div className="border-t border-slate-100 dark:border-slate-800 px-4 py-2 flex items-center justify-between text-[11px] text-slate-400">
            <div className="flex items-center gap-3">
              <span className="inline-flex items-center gap-1"><Kbd>↑</Kbd><Kbd>↓</Kbd> navigate</span>
              <span className="inline-flex items-center gap-1"><Kbd>↵</Kbd> select</span>
              <span className="inline-flex items-center gap-1"><Kbd>esc</Kbd> close</span>
            </div>
            <span className="hidden md:inline">{PAGES.length + ACTIONS.length} actions</span>
          </div>
        </Command>
      </div>
      <style>{`
        .cmdk-pop { animation: cmdk-pop-kf 180ms cubic-bezier(.2,.9,.3,1.2) both; }
        @keyframes cmdk-pop-kf {
          from { opacity: 0; transform: translateY(-8px) scale(0.99); }
          to   { opacity: 1; transform: translateY(0)    scale(1); }
        }
        [cmdk-group-heading] {
          padding: 6px 16px 4px;
          font-size: 10px;
          font-weight: 600;
          text-transform: uppercase;
          letter-spacing: 0.08em;
          color: rgb(148 163 184);
        }
        :where(.dark) [cmdk-group-heading] { color: rgb(100 116 139); }
        [cmdk-item][data-selected="true"] {
          background: rgba(37, 99, 235, 0.08);
        }
        :where(.dark) [cmdk-item][data-selected="true"] {
          background: rgba(59, 130, 246, 0.15);
        }
      `}</style>
    </>
  );
}

function PaletteItem({ value, icon: Icon, label, detail, breadcrumb, onSelect, accent = 'blue' }) {
  const accentBg = accent === 'emerald'
    ? 'bg-emerald-50 dark:bg-emerald-500/15 text-emerald-600 dark:text-emerald-300'
    : 'bg-blue-50 dark:bg-blue-500/15 text-blue-600 dark:text-blue-300';
  return (
    <Command.Item
      value={value}
      onSelect={onSelect}
      className="mx-2 px-2 py-2 rounded-lg flex items-center gap-3 cursor-pointer"
    >
      <div className={`shrink-0 w-7 h-7 rounded-md flex items-center justify-center ${accentBg}`}>
        <Icon className="w-3.5 h-3.5" strokeWidth={2.25} />
      </div>
      <div className="flex-1 min-w-0">
        <div className="text-sm font-medium text-slate-900 dark:text-slate-100 truncate">{label}</div>
        {detail && <div className="text-[11px] text-slate-500 dark:text-slate-400 truncate">{detail}</div>}
      </div>
      {breadcrumb && (
        <span className="text-[10px] text-slate-400 dark:text-slate-500 uppercase tracking-wider hidden sm:inline">
          {breadcrumb}
        </span>
      )}
      <ArrowRight className="w-3.5 h-3.5 text-slate-300 dark:text-slate-600 hidden sm:inline" />
    </Command.Item>
  );
}

function Kbd({ children }) {
  return (
    <kbd className="inline-flex items-center justify-center min-w-[18px] h-[18px] px-1 text-[10px] font-medium rounded border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/60 text-slate-500 dark:text-slate-400">
      {children}
    </kbd>
  );
}
