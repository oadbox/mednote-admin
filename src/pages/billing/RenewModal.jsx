import { useEffect, useMemo, useState } from 'react';
import toast from 'react-hot-toast';
import api from '../../api/axios';
import endpoints from '../../api/endpoints';
import Modal from '../../components/ui/Modal';
import Input from '../../components/ui/Input';
import Select from '../../components/ui/Select';
import DatePicker from '../../components/ui/DatePicker';
import Button from '../../components/ui/Button';
import { formatCurrency } from '../../utils/formatters';

const PAY_TYPES = [
  { value: 'full', label: 'Full payment' },
  { value: 'partial', label: 'Partial / Half' },
  { value: 'advance', label: 'Advance (prepayment)' },
];

const METHODS = [
  { value: 'cash', label: 'Cash' },
  { value: 'card', label: 'Card' },
  { value: 'upi', label: 'UPI' },
  { value: 'bank_transfer', label: 'Bank Transfer' },
  { value: 'cheque', label: 'Cheque' },
  { value: 'other', label: 'Other' },
];

const toDay = (d) => (d ? new Date(d).toISOString().slice(0, 10) : '');
const round2 = (n) => Math.round(Number(n) * 100) / 100;

// Renew a subscription for a fresh period, or move the hospital onto a
// different plan — opens a NEW period row and (optionally) records the payment
// in one go. Backend: POST /platform/billing/:id/renew.
export default function RenewModal({ isOpen, onClose, subscription, onSuccess }) {
  const [plans, setPlans] = useState([]);
  const [planId, setPlanId] = useState('');
  const [startDate, setStartDate] = useState('');
  // Overrides are null until the operator edits the field; the displayed value
  // is otherwise derived from the plan so we never setState inside an effect.
  const [endOverride, setEndOverride] = useState(null);
  const [amountOverride, setAmountOverride] = useState(null);
  // GST on the ex-GST period price: auto at the platform default rate until
  // the operator types a figure (0 = inclusive / nil-rated).
  const [gstRate, setGstRate] = useState(18);
  const [taxOverride, setTaxOverride] = useState(null);
  const [recordNow, setRecordNow] = useState(true);
  const [payType, setPayType] = useState('full');
  const [payAmount, setPayAmount] = useState('');
  const [method, setMethod] = useState('cash');
  const [reference, setReference] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!isOpen) return;
    api.get(endpoints.plans.list, { params: { limit: 100 } })
      .then((res) => {
        const d = res.data.data || res.data;
        const list = d.plans || d.rows || d.items || (Array.isArray(d) ? d : []);
        setPlans(list.map((p) => ({ value: p.id || p._id, label: p.name, durationInDays: p.durationInDays, price: p.price })));
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

  // Seed defaults each time the modal opens: same plan (a plain renewal), a new
  // period continuing from the current end date (or today if it already lapsed).
  useEffect(() => {
    if (!isOpen || !subscription) return;
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const curEnd = subscription.endDate ? new Date(subscription.endDate) : null;
    const start = curEnd && curEnd > today ? curEnd : today;
    setPlanId(subscription.plan?.id || subscription.planId || '');
    setStartDate(toDay(start));
    setEndOverride(null);
    setAmountOverride(null);
    setTaxOverride(null);
    setRecordNow(true);
    setPayType('full');
    setPayAmount('');
    setMethod('cash');
    setReference('');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, subscription?.id]);

  const selectedPlan = useMemo(() => plans.find((p) => p.value === planId), [plans, planId]);

  // End date & amount are derived from the plan (start + durationInDays, and the
  // plan price) unless the operator has typed an explicit override.
  const autoEnd = useMemo(() => {
    if (!startDate || !selectedPlan) return '';
    const e = new Date(startDate);
    e.setDate(e.getDate() + (Number(selectedPlan.durationInDays) || 30));
    return toDay(e);
  }, [startDate, selectedPlan]);
  const endDate = endOverride ?? autoEnd;
  const amount = amountOverride ?? (selectedPlan ? String(selectedPlan.price ?? '') : '');

  const periodAmount = Number(amount || 0);
  const autoTax = periodAmount > 0 ? round2((periodAmount * gstRate) / 100) : 0;
  const taxAmount = taxOverride ?? (autoTax > 0 ? String(autoTax) : '');
  const periodTax = Number(taxAmount || 0);
  const periodTotal = round2(periodAmount + periodTax);
  const currentPlanId = subscription?.plan?.id || subscription?.planId || '';
  const isChangingPlan = !!planId && planId !== currentPlanId;

  const submit = async () => {
    if (!planId) { toast.error('Select a plan'); return; }
    if (!startDate || !endDate) { toast.error('Set start and end dates'); return; }
    if (endDate <= startDate) { toast.error('End date must be after the start date'); return; }
    if (!Number.isFinite(periodAmount) || periodAmount < 0) { toast.error('Enter a valid amount'); return; }
    if (!Number.isFinite(periodTax) || periodTax < 0) { toast.error('GST must be 0 or more'); return; }

    const payload = {
      planId, startDate, endDate, amount: periodAmount,
      taxAmount: periodTax,
      ...(taxOverride === null && periodTax > 0 ? { gstRate } : {}),
    };
    if (recordNow) {
      const amt = payType === 'full' ? periodTotal : Number(payAmount);
      if (!Number.isFinite(amt) || amt <= 0) { toast.error('Enter a valid payment amount'); return; }
      payload.payment = { type: payType, amount: round2(amt), method, reference: reference || undefined };
    }

    setLoading(true);
    try {
      const res = await api.post(endpoints.billing.renew(subscription.id), payload);
      toast.success(isChangingPlan ? 'Plan changed & renewed' : 'Subscription renewed');
      onSuccess?.(res.data?.data || res.data);
      onClose();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to renew subscription');
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen || !subscription) return null;

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Renew / Change Plan" size="md">
      <div className="space-y-4">
        <div className="rounded-lg bg-gray-50 dark:bg-slate-800/60 p-3">
          <p className="font-medium text-gray-900 dark:text-slate-100">
            {subscription.hospital?.name || subscription.hospitalName || '-'}
          </p>
          <p className="text-xs text-gray-500 dark:text-slate-400">
            Current: {subscription.plan?.name || '-'}
            {subscription.endDate ? ` · ends ${new Date(subscription.endDate).toLocaleDateString()}` : ''}
          </p>
        </div>

        <Select label="Plan" options={plans} value={planId} onChange={setPlanId} placeholder="Select a plan" />
        {isChangingPlan && (
          <p className="-mt-2 text-xs text-blue-600 dark:text-blue-400">
            This moves the hospital onto a different plan starting the new period.
          </p>
        )}

        <div className="grid grid-cols-2 gap-4">
          <DatePicker
            label="Start Date"
            value={startDate}
            onChange={(v) => setStartDate(v)}
          />
          <DatePicker
            label="End Date"
            value={endDate}
            onChange={(v) => setEndOverride(v)}
          />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <Input
            label="Period Amount (ex-GST)"
            type="number"
            min="0"
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
            ? <>GST at {gstRate}% on the ex-GST price. Edit it if this hospital is billed differently, or enter 0 if the price is inclusive.</>
            : <>GST entered by hand. Retype the amount to go back to {gstRate}%.</>}
        </p>

        <label className="flex items-center gap-2 text-sm text-gray-700 dark:text-slate-300">
          <input
            type="checkbox"
            className="w-4 h-4"
            checked={recordNow}
            onChange={(e) => setRecordNow(e.target.checked)}
          />
          Record payment now
        </label>

        {recordNow && (
          <div className="space-y-4 rounded-lg border border-gray-100 dark:border-slate-800 p-3">
            <Select label="Payment type" options={PAY_TYPES} value={payType} onChange={setPayType} />
            <Input
              label="Payment amount"
              type="number"
              min="0"
              value={payType === 'full' ? String(periodTotal) : payAmount}
              onChange={(e) => setPayAmount(e.target.value)}
              disabled={payType === 'full'}
            />
            <Select label="Method" options={METHODS} value={method} onChange={setMethod} />
            <Input
              label="Reference (txn id / cheque no.)"
              value={reference}
              onChange={(e) => setReference(e.target.value)}
              placeholder="optional"
            />
          </div>
        )}

        <div className="flex items-center justify-between pt-2">
          <p className="text-sm text-gray-500 dark:text-slate-400">
            New period total: <span className="font-semibold text-gray-900 dark:text-slate-100">{formatCurrency(periodTotal)}</span>
            {periodTax > 0 && <span className="ml-1 text-xs">({formatCurrency(periodAmount)} + {formatCurrency(periodTax)} GST)</span>}
          </p>
          <div className="flex gap-3">
            <Button variant="secondary" onClick={onClose}>Cancel</Button>
            <Button onClick={submit} loading={loading}>{isChangingPlan ? 'Change Plan' : 'Renew'}</Button>
          </div>
        </div>
      </div>
    </Modal>
  );
}
