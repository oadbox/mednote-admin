import { useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import api from '../../api/axios';
import endpoints from '../../api/endpoints';
import Modal from '../../components/ui/Modal';
import Input from '../../components/ui/Input';
import Select from '../../components/ui/Select';
import Button from '../../components/ui/Button';
import DatePicker from '../../components/ui/DatePicker';
import { formatCurrency } from '../../utils/formatters';

const TYPES = [
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

const round2 = (n) => Math.round(Number(n) * 100) / 100;

// Records a full / partial / advance payment against a subscription row.
export default function PaymentModal({ isOpen, onClose, subscription, onSuccess }) {
  const [type, setType] = useState('full');
  const [amount, setAmount] = useState('');
  const [method, setMethod] = useState('cash');
  const [reference, setReference] = useState('');
  const [paidAt, setPaidAt] = useState('');
  const [loading, setLoading] = useState(false);

  const total = Number(subscription?.amount || 0);
  const paid = Number(subscription?.amountPaid || 0);
  const remaining = Math.max(0, round2(total - paid));

  // Reset the form whenever the modal opens for a (different) subscription.
  useEffect(() => {
    if (!isOpen) return;
    setType('full');
    setAmount(String(remaining || total));
    setMethod('cash');
    setReference(subscription?.paymentRef || '');
    setPaidAt(new Date().toISOString().slice(0, 10));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, subscription?.id]);

  // Selecting a type pre-fills a sensible default amount.
  const applyType = (t) => {
    setType(t);
    if (t === 'full') setAmount(String(remaining || total));
    else if (t === 'partial') setAmount(String(round2(total / 2)));
    // advance: keep whatever the operator typed
  };

  const submit = async () => {
    const amt = type === 'full' ? remaining : Number(amount);
    if (type === 'full' && remaining <= 0) {
      toast.error('This subscription is already fully paid');
      return;
    }
    if (type !== 'full' && (!Number.isFinite(amt) || amt <= 0)) {
      toast.error('Enter a valid amount');
      return;
    }
    setLoading(true);
    try {
      await api.post(endpoints.billing.recordPayment(subscription.id), {
        amount: amt,
        type,
        method,
        reference: reference || undefined,
        paidAt: paidAt || undefined,
      });
      toast.success('Payment recorded');
      onSuccess?.();
      onClose();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to record payment');
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen || !subscription) return null;

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Record Payment" size="md">
      <div className="space-y-4">
        <div className="rounded-lg bg-gray-50 dark:bg-slate-800/60 p-3">
          <p className="font-medium text-gray-900 dark:text-slate-100">
            {subscription.hospitalName || subscription.hospital?.name || '-'}
          </p>
          <p className="text-xs text-gray-500 dark:text-slate-400">
            {(subscription.planName || subscription.plan?.name || '-')}
            {subscription.planBillingCycle ? ` · ${subscription.planBillingCycle}` : ''}
          </p>
          <div className="mt-3 grid grid-cols-3 gap-2 text-center">
            <div>
              <p className="text-[11px] uppercase tracking-wide text-gray-400">Total</p>
              <p className="font-semibold text-gray-900 dark:text-slate-100">{formatCurrency(total)}</p>
            </div>
            <div>
              <p className="text-[11px] uppercase tracking-wide text-gray-400">Paid</p>
              <p className="font-semibold text-emerald-600 dark:text-emerald-400">{formatCurrency(paid)}</p>
            </div>
            <div>
              <p className="text-[11px] uppercase tracking-wide text-gray-400">Remaining</p>
              <p className="font-semibold text-amber-600 dark:text-amber-400">{formatCurrency(remaining)}</p>
            </div>
          </div>
        </div>

        <Select label="Payment type" options={TYPES} value={type} onChange={applyType} />

        <Input
          label="Amount"
          type="number"
          min="0"
          value={type === 'full' ? String(remaining) : amount}
          onChange={(e) => setAmount(e.target.value)}
          disabled={type === 'full'}
        />

        <div className="grid grid-cols-2 gap-4">
          <Select label="Method" options={METHODS} value={method} onChange={setMethod} />
          <DatePicker label="Payment date" value={paidAt} onChange={setPaidAt} isClearable={false} />
        </div>

        <Input
          label="Reference (txn id / cheque no.)"
          value={reference}
          onChange={(e) => setReference(e.target.value)}
          placeholder="optional"
        />

        <div className="flex justify-end gap-3 pt-2">
          <Button variant="secondary" onClick={onClose}>Cancel</Button>
          <Button onClick={submit} loading={loading}>Record Payment</Button>
        </div>
      </div>
    </Modal>
  );
}
