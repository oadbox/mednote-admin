import { useEffect, useState } from 'react';
import { Plus, Trash2, PuzzleIcon } from 'lucide-react';
import toast from 'react-hot-toast';
import api from '../../api/axios';
import endpoints from '../../api/endpoints';
import Card from '../../components/ui/Card';
import Button from '../../components/ui/Button';
import Input from '../../components/ui/Input';
import Select from '../../components/ui/Select';

const CYCLE_OPTIONS = [
  { value: 'yearly', label: 'per year' },
  { value: 'monthly', label: 'per month' },
  { value: 'one_time', label: 'one-time' },
];

// Paid add-ons sold on top of a plan. Shown on mednote.in/pricing (read live
// from GET /public/pricing). Billing one is a Record Fee of type "Add-on" on the
// hospital page; switching it on is the hospital's module list or toggle named
// in "Unlocks". Backend: GET/PUT /platform/plans/addons.
export default function AddonsCard({ isSuperAdmin }) {
  const [rows, setRows] = useState(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    api.get(endpoints.plans.addons)
      .then((res) => setRows((res.data?.data?.addons || []).map((a) => ({ ...a, price: String(a.price ?? '') }))))
      .catch(() => setRows([]));
  }, []);

  const set = (i, patch) => setRows((r) => r.map((row, j) => (j === i ? { ...row, ...patch } : row)));

  const save = async () => {
    const bad = rows.find((r) => r.name.trim().length < 2 || !(Number(r.price) >= 0) || r.price === '');
    if (bad) { toast.error('Every add-on needs a name and a price'); return; }
    setSaving(true);
    try {
      const res = await api.put(endpoints.plans.addons, { addons: rows.map((r) => ({ ...r, price: Number(r.price) })) });
      setRows((res.data?.data?.addons || []).map((a) => ({ ...a, price: String(a.price) })));
      toast.success('Add-ons saved — the website picks them up within 5 minutes');
    } catch (err) {
      toast.error(err.response?.data?.message || 'Could not save the add-ons');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Card className="p-6">
      <div className="flex flex-wrap items-start justify-between gap-3 mb-4">
        <div>
          <h2 className="text-base font-semibold text-gray-900 dark:text-slate-100 flex items-center gap-2">
            <PuzzleIcon className="w-4 h-4 text-blue-600" /> Add-ons
          </h2>
          <p className="mt-1 text-sm text-gray-600 dark:text-slate-400">
            Sold on top of any plan and listed on mednote.in/pricing (prices ex-GST). Bill one with Record Fee → Add-on on the hospital page, then switch on what it unlocks.
          </p>
        </div>
        {isSuperAdmin && rows && (
          <div className="flex gap-2">
            <Button variant="secondary" icon={Plus} onClick={() => setRows((r) => [...r, { key: '', name: '', price: '', billingCycle: 'yearly', description: '', unlocks: '' }])}>
              Add
            </Button>
            <Button onClick={save} loading={saving}>Save add-ons</Button>
          </div>
        )}
      </div>

      {!rows ? (
        <p className="py-4 text-sm text-gray-500">Loading…</p>
      ) : rows.length === 0 ? (
        <p className="py-4 text-sm text-gray-500 dark:text-slate-400">No add-ons. The pricing page shows plans only.</p>
      ) : (
        <div className="space-y-3">
          {rows.map((r, i) => (
            <div key={i} className="rounded-lg border border-gray-200 dark:border-slate-700 p-3 space-y-3">
              <div className="grid grid-cols-1 sm:grid-cols-[1fr_140px_140px_36px] gap-3 items-end">
                <Input label="Name" value={r.name} disabled={!isSuperAdmin} onChange={(e) => set(i, { name: e.target.value })} />
                <Input label="Price (₹)" type="number" min="0" step="0.01" value={r.price} disabled={!isSuperAdmin} onChange={(e) => set(i, { price: e.target.value })} />
                <Select label="Billed" options={CYCLE_OPTIONS} value={r.billingCycle} onChange={(v) => isSuperAdmin && set(i, { billingCycle: v })} />
                {isSuperAdmin && (
                  <button type="button" aria-label="Remove add-on" title="Remove" onClick={() => setRows((rs) => rs.filter((_, j) => j !== i))}
                    className="mb-1 inline-flex h-9 w-9 items-center justify-center rounded-lg text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20">
                    <Trash2 className="h-4 w-4" />
                  </button>
                )}
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <Input label="Description (shown on the website)" value={r.description || ''} disabled={!isSuperAdmin} onChange={(e) => set(i, { description: e.target.value })} />
                <Input label="Unlocks (internal note)" placeholder="e.g. Modules: AI Assistant" value={r.unlocks || ''} disabled={!isSuperAdmin} onChange={(e) => set(i, { unlocks: e.target.value })} />
              </div>
            </div>
          ))}
        </div>
      )}
    </Card>
  );
}
