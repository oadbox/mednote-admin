import { useEffect, useMemo, useState } from 'react';
import { CreditCard, Hourglass, CalendarPlus, Wallet } from 'lucide-react';
import dayjs from 'dayjs';
import toast from 'react-hot-toast';
import api from '../../api/axios';
import endpoints from '../../api/endpoints';
import Card from '../../components/ui/Card';
import Badge from '../../components/ui/Badge';
import Button from '../../components/ui/Button';
import Modal from '../../components/ui/Modal';
import Input from '../../components/ui/Input';
import Select from '../../components/ui/Select';
import DatePicker from '../../components/ui/DatePicker';
import PaymentModal from '../billing/PaymentModal';
import { formatCurrency } from '../../utils/formatters';

const METHODS = [
  { value: 'cash', label: 'Cash' },
  { value: 'card', label: 'Card' },
  { value: 'upi', label: 'UPI' },
  { value: 'bank_transfer', label: 'Bank Transfer' },
  { value: 'cheque', label: 'Cheque' },
  { value: 'other', label: 'Other' },
];

const PAY_TONE = { paid: 'success', partial: 'warning', advance: 'info', pending: 'gray' };

const toDay = (d) => (d ? dayjs(d).format('YYYY-MM-DD') : '');
const hasValue = (v) => v !== null && v !== undefined && v !== '';
const round2 = (n) => Math.round(Number(n) * 100) / 100;

// Subscription for one hospital (super-admin hospital page): the plan, the
// period timeline, and the commercial actions — record a subscription period
// (renew or move plan, with the hospital's negotiated price and an optional
// payment), extend the trial, and collect against an outstanding period. The
// Billed / Collected / Outstanding roll-up and one-off fees live on the
// Billing ledger card below (HospitalChargesCard); every period recorded here
// is mirrored there automatically.
export default function HospitalSubscriptionCard({ hospital, isSuperAdmin, onChanged }) {
  const [recordOpen, setRecordOpen] = useState(false);
  const [trialOpen, setTrialOpen] = useState(false);
  const [payTarget, setPayTarget] = useState(null);

  const subscriptions = Array.isArray(hospital.subscriptions) ? hospital.subscriptions : [];
  const now = dayjs();
  const current = subscriptions.find((s) => s.status === 'active' && dayjs(s.endDate).isAfter(now)) || null;
  const isCustom = hasValue(hospital.customPrice);
  const listPrice = hospital.plan?.price;

  return (
    <Card className="p-6">
      <div className="flex flex-wrap items-start justify-between gap-3 mb-5">
        <div>
          <h2 className="text-base font-semibold text-gray-900 dark:text-slate-100">Subscription</h2>
          <div className="mt-1 flex flex-wrap items-center gap-2 text-sm text-gray-600 dark:text-slate-400">
            <span>
              Plan: <span className="font-medium text-gray-900 dark:text-slate-100">{hospital.plan?.name || '—'}</span>
              {(isCustom || listPrice != null) && (
                <> · {formatCurrency(isCustom ? hospital.customPrice : listPrice)}
                  {hospital.plan?.billingCycle ? ` / ${hospital.plan.billingCycle}` : ''}</>
              )}
            </span>
            {isCustom && <Badge color="warning">Custom price</Badge>}
          </div>
          {isCustom && (
            <p className="text-xs text-gray-500 dark:text-slate-400 mt-0.5">
              List price {formatCurrency(listPrice ?? 0)}{hospital.customPriceNote ? ` · ${hospital.customPriceNote}` : ''}
            </p>
          )}
          <p className="text-xs text-gray-500 dark:text-slate-400 mt-1">
            {current
              ? `Current period ends ${dayjs(current.endDate).format('MMM D, YYYY')}`
              : 'No active subscription period'}
            {hospital.isTrial && hospital.trialEndsAt && ` · Trial ends ${dayjs(hospital.trialEndsAt).format('MMM D, YYYY')}`}
          </p>
        </div>
        {isSuperAdmin && (
          <div className="flex flex-wrap gap-2">
            <Button variant="secondary" icon={Hourglass} onClick={() => setTrialOpen(true)}>
              Extend Trial
            </Button>
            <Button icon={CalendarPlus} onClick={() => setRecordOpen(true)}>
              Record Subscription
            </Button>
          </div>
        )}
      </div>

      {subscriptions.length === 0 ? (
        <div className="text-center py-8">
          <div className="w-12 h-12 rounded-full bg-gray-100 dark:bg-slate-800 flex items-center justify-center mx-auto mb-2">
            <CreditCard className="w-5 h-5 text-gray-400" />
          </div>
          <p className="text-sm text-gray-500 dark:text-slate-400">No subscription history available.</p>
        </div>
      ) : (
        <div className="space-y-4">
          {subscriptions.map((sub, idx) => {
            const isLapsed = sub.status === 'active' && dayjs(sub.endDate).isBefore(now);
            const status = isLapsed ? 'expired' : sub.status;
            const isActive = status === 'active';
            const isLast = idx === subscriptions.length - 1;
            const due = Math.max(0, Number(sub.amount || 0) - Number(sub.amountPaid || 0));
            return (
              <div key={sub.id || idx} className="flex gap-4">
                <div className="flex flex-col items-center pt-4 shrink-0">
                  <span className={`w-3 h-3 rounded-full ring-4 ring-white dark:ring-slate-900 ${isActive ? 'bg-indigo-600' : 'bg-gray-300 dark:bg-slate-600'}`} />
                  {!isLast && <span className="flex-1 w-px mt-1 bg-gray-200 dark:bg-slate-700" />}
                </div>
                <div className="flex-1 flex flex-wrap items-center justify-between gap-3 p-4 rounded-xl border border-gray-100 dark:border-slate-800 bg-gradient-to-r from-gray-50/60 to-white dark:from-slate-800/40 dark:to-slate-900 hover:shadow-sm transition-shadow">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className={`w-10 h-10 rounded-lg flex items-center justify-center shrink-0 ${isActive ? 'bg-indigo-50 dark:bg-indigo-900/30' : 'bg-gray-100 dark:bg-slate-800'}`}>
                      <CreditCard className={`w-5 h-5 ${isActive ? 'text-indigo-600 dark:text-indigo-400' : 'text-gray-400'}`} />
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-gray-900 dark:text-slate-100 truncate">{sub.plan?.name || 'Plan'}</p>
                      <p className="text-xs text-gray-500 dark:text-slate-400 mt-0.5">
                        {dayjs(sub.startDate).format('MMM D, YYYY')} → {dayjs(sub.endDate).format('MMM D, YYYY')}
                        {Number(sub.amountPaid) > 0 && ` · paid ${formatCurrency(sub.amountPaid)}`}
                        {sub.paymentRef && ` · ${sub.paymentRef}`}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3 shrink-0">
                    {sub.amount != null && (
                      <span className="text-sm font-semibold text-gray-700 dark:text-slate-300">{formatCurrency(sub.amount)}</span>
                    )}
                    {Number(sub.amount) > 0 && (
                      <Badge color={PAY_TONE[sub.paymentStatus] || 'gray'}>{sub.paymentStatus || 'pending'}</Badge>
                    )}
                    <Badge color={isActive ? 'success' : 'gray'}>{status}</Badge>
                    {isSuperAdmin && due > 0 && status !== 'cancelled' && (
                      <Button size="sm" variant="secondary" icon={Wallet} onClick={() => setPayTarget(sub)}>
                        Record payment
                      </Button>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {recordOpen && <RecordSubscriptionModal
        isOpen
        onClose={() => setRecordOpen(false)}
        hospital={hospital}
        current={current}
        onSaved={onChanged}
      />}
      {trialOpen && <ExtendTrialModal
        isOpen
        onClose={() => setTrialOpen(false)}
        hospital={hospital}
        onSaved={onChanged}
      />}
      <PaymentModal
        isOpen={!!payTarget}
        onClose={() => setPayTarget(null)}
        subscription={payTarget ? { ...payTarget, hospitalName: hospital.name } : null}
        onSuccess={onChanged}
      />
    </Card>
  );
}

// Open a new subscription period for the hospital — a renewal on the same plan
// or a move to another — billed at the hospital's own (possibly negotiated)
// price, optionally recording the payment that came in for it. Backend:
// POST /platform/hospitals/:id/subscriptions. The period goes live immediately
// and ends any trial; one starting after the current term is a prepaid renewal.
// Mounted only while open, so the form seeds fresh each time: same plan, a
// period continuing from the current term's end (or today if nothing is
// running), priced at the hospital's custom rate.
function RecordSubscriptionModal({ isOpen, onClose, hospital, current, onSaved }) {
  const today = dayjs().startOf('day');
  const [plans, setPlans] = useState([]);
  const [planId, setPlanId] = useState(hospital.planId || hospital.plan?.id || '');
  const [startDate, setStartDate] = useState(() => {
    const curEnd = current ? dayjs(current.endDate) : null;
    return toDay(curEnd && curEnd.isAfter(today) ? curEnd : today);
  });
  const [endOverride, setEndOverride] = useState(null);
  const [customPrice, setCustomPrice] = useState(hasValue(hospital.customPrice) ? String(Number(hospital.customPrice)) : '');
  const [priceNote, setPriceNote] = useState(hospital.customPriceNote || '');
  const [amountOverride, setAmountOverride] = useState(null);
  // GST on the (ex-GST) period price — plan prices are quoted without tax, the
  // same as Raise Renewal and the self-serve checkout. Worked out at the
  // platform default rate until the admin types a figure; 0 when the price is
  // inclusive or the hospital is nil-rated.
  const [gstRate, setGstRate] = useState(18);
  const [taxOverride, setTaxOverride] = useState(null);
  const [collected, setCollected] = useState(true);
  const [paidAt, setPaidAt] = useState(toDay(today));
  const [method, setMethod] = useState('bank_transfer');
  const [reference, setReference] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!isOpen) return;
    api.get(endpoints.plans.list, { params: { limit: 100 } })
      .then((res) => {
        const d = res.data.data || res.data;
        const list = d.plans || d.rows || d.items || (Array.isArray(d) ? d : []);
        setPlans(list.map((p) => ({
          value: p.id, label: p.name, durationInDays: p.durationInDays, price: p.price, billingCycle: p.billingCycle,
        })));
      })
      .catch(() => setPlans([]));
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) return;
    api.get(endpoints.settings.platform)
      .then((res) => {
        const r = Number(res.data?.data?.defaultGstRate);
        if (Number.isFinite(r)) setGstRate(r);
      })
      .catch(() => {});
  }, [isOpen]);

  const plan = useMemo(() => plans.find((p) => p.value === planId), [plans, planId]);
  const autoEnd = startDate && plan
    ? toDay(dayjs(startDate).add(Number(plan.durationInDays) || 30, 'day'))
    : '';
  const endDate = endOverride ?? autoEnd;
  const listPrice = plan ? Number(plan.price || 0) : 0;
  const rate = customPrice.trim() === '' ? listPrice : Number(customPrice);
  const amount = amountOverride ?? String(Number.isFinite(rate) ? rate : '');
  const autoTax = Number(amount) > 0 ? round2((Number(amount) * gstRate) / 100) : 0;
  const taxAmount = taxOverride ?? (autoTax > 0 ? String(autoTax) : '');
  const total = round2((Number(amount) || 0) + (Number(taxAmount) || 0));
  const movingPlan = !!planId && planId !== (hospital.planId || hospital.plan?.id);
  const startsLater = startDate && dayjs(startDate).isAfter(dayjs(), 'day');

  const blocker = !planId ? 'Select a plan'
    : !startDate || !endDate ? 'Set the period this covers'
    : endDate <= startDate ? 'Period end must be after the start'
    : customPrice.trim() !== '' && !(Number(customPrice) >= 0) ? 'Custom price must be 0 or more'
    : amount === '' || !(Number(amount) >= 0) ? 'Enter a valid amount'
    : taxAmount !== '' && !(Number(taxAmount) >= 0) ? 'GST must be 0 or more'
    : collected && total > 0 && !paidAt ? 'Set the payment date'
    : null;

  const submit = async () => {
    if (blocker) { toast.error(blocker); return; }
    const payload = {
      planId,
      startDate,
      endDate,
      amount: Number(amount),
      taxAmount: taxAmount === '' ? 0 : Number(taxAmount),
      // The rate only when GST is the auto figure — a hand-typed amount is its
      // own statement of the rate.
      ...(taxOverride === null && Number(taxAmount) > 0 ? { gstRate } : {}),
      customPrice: customPrice.trim() === '' ? null : Number(customPrice),
      customPriceNote: priceNote.trim() || null,
    };
    if (collected && total > 0) {
      payload.payment = { type: 'full', method, reference: reference.trim() || undefined, paidAt };
    }
    setSaving(true);
    try {
      await api.post(endpoints.hospitals.subscriptions(hospital.id), payload);
      toast.success(movingPlan ? 'Plan assigned' : 'Subscription recorded');
      onClose();
      onSaved?.();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Could not record the subscription');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Record subscription" size="lg">
      <div className="space-y-4">
        <div className="rounded-lg bg-gray-50 dark:bg-slate-800/60 p-3 text-sm">
          <p className="font-medium text-gray-900 dark:text-slate-100">{hospital.name}</p>
          <p className="text-xs text-gray-500 dark:text-slate-400">
            {current
              ? `Current: ${current.plan?.name || hospital.plan?.name || 'Plan'} · ends ${dayjs(current.endDate).format('MMM D, YYYY')}`
              : hospital.isTrial ? 'On trial — recording a subscription ends the trial' : 'No active subscription'}
          </p>
        </div>

        <Select label="Plan" options={plans} value={planId} onChange={(v) => { setPlanId(v); setEndOverride(null); setAmountOverride(null); setTaxOverride(null); }} placeholder="Select a plan" />
        {movingPlan && (
          <p className="-mt-2 text-xs text-blue-600 dark:text-blue-400">
            Moves the hospital onto this plan (modules follow the new plan unless overridden).
          </p>
        )}

        <div className="rounded-lg border border-gray-200 dark:border-slate-700 p-3 space-y-3">
          <div className="flex items-start justify-between gap-2">
            <div>
              <p className="text-sm font-medium text-gray-900 dark:text-slate-100">Custom price for this hospital</p>
              <p className="text-xs text-gray-500 dark:text-slate-400">
                Saved on the hospital and used for every future period. Leave blank to charge the
                plan&apos;s list price ({formatCurrency(listPrice)}); 0 comps it.
              </p>
            </div>
            {customPrice.trim() !== '' && <Badge color="warning">Overridden</Badge>}
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Input
              label="Price per period (₹)"
              type="number"
              min="0"
              step="0.01"
              placeholder={`list ${listPrice}`}
              value={customPrice}
              onChange={(e) => { setCustomPrice(e.target.value); setAmountOverride(null); setTaxOverride(null); }}
            />
            <Input
              label="Reason / note"
              placeholder="e.g. negotiated for FY27, 3-year commitment"
              value={priceNote}
              onChange={(e) => setPriceNote(e.target.value)}
            />
          </div>
          {movingPlan && hasValue(hospital.customPrice) && (
            <p className="text-xs text-amber-600 dark:text-amber-400">
              This price was negotiated on the old plan — clear it or enter the new rate.
            </p>
          )}
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <DatePicker label="Period from" value={startDate} onChange={(v) => { setStartDate(v); setEndOverride(null); }} isClearable={false} />
          <DatePicker label="Period to" value={endDate} onChange={(v) => setEndOverride(v)} isClearable={false} />
        </div>
        {startsLater && (
          <p className="-mt-2 text-xs text-gray-500 dark:text-slate-400">
            Starts after today — a prepaid renewal. The current term keeps running until then.
          </p>
        )}

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <Input
            label="Amount for this period (₹)"
            type="number"
            min="0"
            step="0.01"
            value={amount}
            onChange={(e) => { setAmountOverride(e.target.value); setTaxOverride(null); }}
          />
          <Input
            label="GST (₹)"
            type="number"
            min="0"
            step="0.01"
            placeholder="0 if inclusive"
            value={taxAmount}
            onChange={(e) => setTaxOverride(e.target.value)}
          />
        </div>
        <p className="-mt-2 text-xs text-gray-500 dark:text-slate-400">
          {taxOverride === null
            ? <>GST at {gstRate}% on the ex-GST price, the same as renewals and online payments. Edit it if this hospital is billed differently, or enter 0 if the price is inclusive.</>
            : <>GST entered by hand{Number(amount) > 0 && Number(taxAmount) >= 0 ? ` (${round2((Number(taxAmount) / Number(amount)) * 100)}%)` : ''}. Clear the amount field and retype it to go back to {gstRate}%.</>}
        </p>

        <label className="flex items-center gap-2 text-sm text-gray-700 dark:text-slate-300">
          <input type="checkbox" className="w-4 h-4" checked={collected} onChange={(e) => setCollected(e.target.checked)} />
          Already collected
        </label>
        {collected && (
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 rounded-lg border border-gray-100 dark:border-slate-800 p-3">
            <DatePicker label="Payment date" value={paidAt} onChange={setPaidAt} isClearable={false} />
            <Select label="Method" options={METHODS} value={method} onChange={setMethod} />
            <Input label="Reference" placeholder="UTR / cheque / invoice no." value={reference} onChange={(e) => setReference(e.target.value)} />
          </div>
        )}

        <div className="flex flex-wrap items-center justify-between gap-3 pt-2">
          <p className="text-sm text-gray-500 dark:text-slate-400">
            {blocker || (
              <>Period total <span className="font-semibold text-gray-900 dark:text-slate-100">{formatCurrency(total)}</span>
                {Number(taxAmount) > 0 && ` (${formatCurrency(Number(amount) || 0)} + ${formatCurrency(Number(taxAmount))} GST)`}
                {!collected && total > 0 && ' · recorded as outstanding'}</>
            )}
          </p>
          <div className="flex gap-3">
            <Button variant="secondary" onClick={onClose}>Cancel</Button>
            <Button onClick={submit} loading={saving} disabled={!!blocker}>
              {movingPlan ? 'Assign Plan' : 'Record Subscription'}
            </Button>
          </div>
        </div>
      </div>
    </Modal>
  );
}

// Push the trial end out by N days (stacked on a live trial, from today on a
// lapsed one) or to an exact date. Re-activates a hospital the trial sweep
// suspended. Backend: POST /platform/hospitals/:id/extend-trial.
function ExtendTrialModal({ isOpen, onClose, hospital, onSaved }) {
  const [mode, setMode] = useState('days');
  const [days, setDays] = useState('14');
  const [date, setDate] = useState('');
  const [saving, setSaving] = useState(false);

  const liveEnd = hospital.isTrial && hospital.trialEndsAt && dayjs(hospital.trialEndsAt).isAfter(dayjs())
    ? dayjs(hospital.trialEndsAt) : null;
  const preview = mode === 'days'
    ? (Number(days) > 0 ? (liveEnd || dayjs()).add(Number(days), 'day') : null)
    : (date ? dayjs(date) : null);

  const submit = async () => {
    const body = mode === 'days' ? { days: Number(days) } : { trialEndsAt: date };
    if (mode === 'days' && !(Number(days) >= 1 && Number(days) <= 365)) { toast.error('Days must be between 1 and 365'); return; }
    if (mode === 'date' && !date) { toast.error('Pick the new trial end date'); return; }
    setSaving(true);
    try {
      await api.post(endpoints.hospitals.extendTrial(hospital.id), body);
      toast.success('Trial extended');
      onClose();
      onSaved?.();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Could not extend the trial');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Extend trial" size="sm">
      <div className="space-y-4">
        <p className="text-sm text-gray-600 dark:text-slate-400">
          {liveEnd
            ? <>Trial currently ends <span className="font-medium text-gray-900 dark:text-slate-100">{liveEnd.format('MMM D, YYYY')}</span>.</>
            : hospital.trialEndsAt
              ? <>Trial ended {dayjs(hospital.trialEndsAt).format('MMM D, YYYY')} — extending restarts it from today.</>
              : <>Not on trial — this starts a trial from today.</>}
          {!hospital.isActive && ' The hospital will be re-activated.'}
        </p>

        <div className="flex gap-2">
          {[7, 14, 30].map((d) => (
            <button
              key={d}
              type="button"
              onClick={() => { setMode('days'); setDays(String(d)); }}
              className={`px-3 py-1.5 rounded-lg text-sm border ${mode === 'days' && days === String(d)
                ? 'border-blue-500 bg-blue-50 text-blue-700 dark:bg-blue-500/15 dark:text-blue-300'
                : 'border-gray-300 dark:border-slate-700 text-gray-700 dark:text-slate-300'}`}
            >
              +{d} days
            </button>
          ))}
          <button
            type="button"
            onClick={() => setMode('date')}
            className={`px-3 py-1.5 rounded-lg text-sm border ${mode === 'date'
              ? 'border-blue-500 bg-blue-50 text-blue-700 dark:bg-blue-500/15 dark:text-blue-300'
              : 'border-gray-300 dark:border-slate-700 text-gray-700 dark:text-slate-300'}`}
          >
            Pick date
          </button>
        </div>

        {mode === 'days'
          ? <Input label="Extend by (days)" type="number" min="1" max="365" value={days} onChange={(e) => setDays(e.target.value)} />
          : <DatePicker label="New trial end" value={date} onChange={setDate} minDate={new Date()} />}

        {preview && (
          <p className="text-xs text-gray-500 dark:text-slate-400">
            New trial end: <span className="font-medium text-gray-900 dark:text-slate-100">{preview.format('MMM D, YYYY')}</span>
          </p>
        )}

        <div className="flex justify-end gap-3 pt-2">
          <Button variant="secondary" onClick={onClose}>Cancel</Button>
          <Button onClick={submit} loading={saving}>Extend Trial</Button>
        </div>
      </div>
    </Modal>
  );
}
