import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  Plus, CalendarClock, Wallet, Undo2, XCircle, Ban, RotateCcw, FileText, FilePlus2, Receipt, Send, Pencil,
} from 'lucide-react';
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
import ConfirmDialog from '../../components/ui/ConfirmDialog';
import { formatCurrency } from '../../utils/formatters';
import {
  CHARGE_TYPE_LABEL, ONE_OFF_TYPES, CHARGE_STATUS_COLOR, PAYMENT_METHODS,
  typeLabel, statusLabel, sourceLabel, typeOptions, paidViaLabel,
} from '../../utils/charges';

const today = () => dayjs().format('YYYY-MM-DD');
const toDay = (d) => (d ? dayjs(d).format('YYYY-MM-DD') : '');
const fmt = (d) => (d ? dayjs(d).format('MMM D, YYYY') : '—');
const apiError = (err, fallback) => err?.response?.data?.message || fallback;

// What the backend's settle hook made of the GST invoice for a payment just
// recorded (`invoice` on the response): the number when raised, a note while
// orgnest is still answering, and — kept on screen longer — why it failed.
const toastInvoice = (res, base) => {
  const inv = res?.data?.data?.invoice;
  if (inv?.status === 'raised' || inv?.status === 'already') toast.success(`${base} · invoice ${inv.number} raised in orgnest`);
  else if (inv?.status === 'pending') toast.success(`${base} · raising the GST invoice in orgnest…`);
  else if (inv?.status === 'failed') {
    toast.success(base);
    toast.error(`GST invoice not raised in orgnest: ${inv.error} — retry from the row.`, { duration: 10000 });
  } else toast.success(base);
};

const ICON_BTN = 'inline-flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200 text-slate-500 transition hover:border-slate-300 hover:bg-slate-50 hover:text-slate-700 disabled:opacity-40 disabled:cursor-not-allowed dark:border-slate-700 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-slate-200';

// The revenue ledger for one hospital (super-admin hospital page): every rupee
// billed to it — the recurring subscription for each term, and every one-off
// fee (setup, customisation, training…) — with what was actually collected.
// Subscription periods recorded on the Subscription card above are mirrored
// here automatically; this card adds the one-off fees, renewals raised ahead
// of a term, and the collect / waive / invoice actions. Ported from hisabe's
// OrgCharges. Backend: /platform/charges.
//
// Self-serve payments (Razorpay, from the hospital's own Plan & Billing page)
// land here too: `metadata.gateway` says how they were paid. With orgnest
// invoicing on (`orgnestInvoicing` in the list response) every payment —
// online or recorded here — gets its GST invoice raised in orgnest the moment
// the charge is paid (`metadata.orgnest`, see docs/SELF_SERVE_BILLING.md);
// the row's "Raise in orgnest" is only the retry. With it off, MedNote issues
// its own platform Invoice from the generate button. Both documents open from
// the invoice button.
export default function HospitalChargesCard({ hospital, hospitalId: givenId, isSuperAdmin, onChanged, refreshKey }) {
  const hospitalId = givenId || hospital?.id;
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [feeOpen, setFeeOpen] = useState(false);
  const [renewalOpen, setRenewalOpen] = useState(false);
  const [payTarget, setPayTarget] = useState(null);
  const [cancelTarget, setCancelTarget] = useState(null);
  const [editTarget, setEditTarget] = useState(null);
  const [busyId, setBusyId] = useState(null);

  const load = useCallback(async () => {
    if (!hospitalId) return;
    try {
      const res = await api.get(endpoints.charges.forHospital(hospitalId));
      setData(res.data?.data || null);
    } catch {
      setData(null);
    } finally {
      setLoading(false);
    }
  }, [hospitalId]);

  // On mount, and whenever the parent says the ledger moved (a period recorded
  // on the Subscription card is mirrored here). The orgnest invoice for a
  // payment is raised in the background, so look once more a few seconds
  // later to pick up its number.
  useEffect(() => {
    load();
    const t = setTimeout(load, 8000);
    return () => clearTimeout(t);
  }, [load, refreshKey]);

  // Any write changes the hospital's tiles and possibly its subscription
  // period, so refresh both this card and the parent page — and once more
  // later, for an invoice number orgnest is still producing.
  const refresh = () => { load(); onChanged?.(); setTimeout(load, 8000); };

  const act = async (id, url, ok, fail) => {
    setBusyId(id);
    try {
      const res = await api.post(url);
      toast.success(res.data?.message || ok);
      refresh();
    } catch (err) {
      toast.error(apiError(err, fail));
    } finally {
      setBusyId(null);
    }
  };

  const generateInvoice = async (c) => {
    setBusyId(c.id);
    try {
      const res = await api.post(endpoints.charges.invoice(c.id));
      toast.success(`Invoice ${res.data?.data?.invoice?.number || ''} generated`.trim());
      refresh();
    } catch (err) {
      toast.error(apiError(err, 'Could not generate the invoice'));
    } finally {
      setBusyId(null);
    }
  };

  // The invoice document — orgnest's PDF for an online payment, else the
  // platform invoice as printable HTML. Fetched with the auth header and
  // opened from a blob URL, since the endpoint is behind platformAuth.
  const openDocument = async (c) => {
    setBusyId(c.id);
    try {
      const res = await api.get(endpoints.charges.invoiceDocument(c.id), { responseType: 'blob' });
      const url = URL.createObjectURL(res.data);
      window.open(url, '_blank', 'noopener');
      setTimeout(() => URL.revokeObjectURL(url), 60_000);
    } catch (err) {
      toast.error(apiError(err, 'No invoice document yet'));
    } finally {
      setBusyId(null);
    }
  };

  // Raise (or retry) the GST invoice in orgnest for an online payment.
  const raiseOrgnest = async (c) => {
    setBusyId(c.id);
    try {
      const res = await api.post(endpoints.charges.raiseOrgnest(c.id));
      toast.success(res.data?.message || 'Invoice raised in orgnest');
      refresh();
    } catch (err) {
      toast.error(apiError(err, 'Could not raise the invoice in orgnest'), { duration: 8000 });
    } finally {
      setBusyId(null);
    }
  };

  const summary = data?.summary || {};
  const items = data?.items || [];
  const orgnestOn = !!data?.orgnestInvoicing;
  const hospitalName = hospital?.name;

  return (
    <Card className="p-6">
      <div className="flex flex-wrap items-start justify-between gap-3 mb-5">
        <div>
          <h2 className="text-base font-semibold text-gray-900 dark:text-slate-100">Billing ledger</h2>
          <p className="mt-1 text-sm text-gray-600 dark:text-slate-400">
            Every rupee billed to this hospital — subscription terms and one-off fees — and what has been collected.
            Online payments from the hospital&apos;s Plan &amp; Billing page land here too.
            {orgnestOn && ' Every payment, online or recorded here, has its GST invoice raised in orgnest as it is paid.'}
          </p>
        </div>
        {isSuperAdmin && (
          <div className="flex flex-wrap gap-2">
            <Button variant="secondary" icon={Plus} onClick={() => setFeeOpen(true)}>Record Fee</Button>
            <Button icon={CalendarClock} onClick={() => setRenewalOpen(true)}>Raise Renewal</Button>
          </div>
        )}
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-5">
        <Tile label="Billed" value={formatCurrency(summary.billed || 0)} />
        <Tile label="Collected" value={formatCurrency(summary.collected || 0)} tone="text-emerald-600 dark:text-emerald-400" />
        <Tile
          label={summary.overdueCount ? `Outstanding · ${summary.overdueCount} overdue` : 'Outstanding'}
          value={formatCurrency(summary.outstanding || 0)}
          tone={summary.outstanding > 0 ? 'text-amber-600 dark:text-amber-400' : undefined}
        />
        <Tile label="Last payment" value={summary.lastPaidAt ? fmt(summary.lastPaidAt) : '—'} />
      </div>
      {summary.waived > 0 && (
        <p className="-mt-2 mb-4 text-xs text-gray-500 dark:text-slate-400">
          {formatCurrency(summary.waived)} written off (waived) — excluded from billed and outstanding.
        </p>
      )}

      {loading ? (
        <p className="py-6 text-center text-sm text-gray-500 dark:text-slate-400">Loading…</p>
      ) : items.length === 0 ? (
        <div className="text-center py-8">
          <div className="w-12 h-12 rounded-full bg-gray-100 dark:bg-slate-800 flex items-center justify-center mx-auto mb-2">
            <Receipt className="w-5 h-5 text-gray-400" />
          </div>
          <p className="text-sm text-gray-500 dark:text-slate-400">
            Nothing billed yet. Record the setup fee, or raise the subscription for the first term.
          </p>
        </div>
      ) : (
        <div className="overflow-x-auto -mx-6 px-6">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs uppercase tracking-wide text-gray-400 dark:text-slate-500 border-b border-gray-100 dark:border-slate-800">
                <th className="py-2 pr-4 font-medium whitespace-nowrap">Charged</th>
                <th className="py-2 pr-4 font-medium">Type</th>
                <th className="py-2 pr-4 font-medium">Description</th>
                <th className="py-2 pr-4 font-medium text-right">Amount</th>
                <th className="py-2 pr-4 font-medium">Status</th>
                <th className="py-2 pr-4 font-medium whitespace-nowrap">Paid on</th>
                {isSuperAdmin && <th className="py-2 font-medium text-right">Actions</th>}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50 dark:divide-slate-800/70">
              {items.map((c) => {
                const meta = c.metadata || {};
                const src = sourceLabel(meta.source);
                const online = !!meta.gateway?.provider;
                const orgnest = meta.orgnest || null;
                const orgnestNumber = orgnest?.invoiceNumber || null;
                const hasDocument = !!(orgnestNumber || c.invoiceId);
                const partial = c.amountPaid > 0 && c.status === 'pending';
                const busy = busyId === c.id;
                const linked = !!c.subscriptionId;
                const live = c.status === 'pending' || c.status === 'paid';
                const kind = meta.kind ? String(meta.kind).toLowerCase().replace(/_/g, ' ') : null;
                return (
                  <tr key={c.id} className="align-top text-gray-700 dark:text-slate-300">
                    <td className="py-3 pr-4 whitespace-nowrap">{fmt(c.chargedAt)}</td>
                    <td className="py-3 pr-4 whitespace-nowrap">
                      {typeLabel(c.type)}
                      {kind && <p className="text-xs text-gray-500 dark:text-slate-400 capitalize">{kind}</p>}
                    </td>
                    <td className="py-3 pr-4 min-w-[220px]">
                      <div className="flex items-center gap-2 text-gray-900 dark:text-slate-100">
                        <span>{c.description}</span>
                        {src && <Badge color="info">{src}</Badge>}
                        {online && <Badge color="success">Online</Badge>}
                      </div>
                      {c.periodStart && c.periodEnd && (
                        <p className="text-xs text-gray-500 dark:text-slate-400">
                          {fmt(c.periodStart)} → {fmt(c.periodEnd)}
                          {c.type === 'subscription' && !linked && c.status !== 'cancelled' && ' · period opens when collected'}
                        </p>
                      )}
                      {(c.invoiceNumber || orgnestNumber || c.paymentRef) && (
                        <p className="text-xs text-gray-500 dark:text-slate-400">
                          {orgnestNumber
                            ? <>Inv {orgnestNumber} <span className="text-gray-400">(orgnest)</span></>
                            : c.invoiceNumber && (c.invoiceId
                              ? <Link to={`/invoices/${c.invoiceId}`} className="text-blue-600 hover:underline">Inv {c.invoiceNumber}</Link>
                              : <>Inv {c.invoiceNumber}</>)}
                          {(orgnestNumber || c.invoiceNumber) && c.paymentRef && ' · '}
                          {c.paymentRef}
                        </p>
                      )}
                      {orgnest?.lastError && !orgnestNumber && (
                        <p className="text-xs text-red-600 dark:text-red-300 max-w-md truncate" title={orgnest.lastError}>
                          orgnest: {orgnest.lastError}
                        </p>
                      )}
                      {c.note && <p className="text-xs text-gray-500 dark:text-slate-400">{c.note}</p>}
                    </td>
                    <td className="py-3 pr-4 text-right whitespace-nowrap tabular-nums font-medium text-gray-900 dark:text-slate-100">
                      {formatCurrency(c.total)}
                      {c.taxAmount > 0 && (
                        <p className="text-xs font-normal text-gray-500 dark:text-slate-400">
                          {formatCurrency(c.amount)} + {formatCurrency(c.taxAmount)} GST
                        </p>
                      )}
                      {partial && (
                        <p className="text-xs font-normal text-amber-600 dark:text-amber-400">
                          paid {formatCurrency(c.amountPaid)} · {formatCurrency(c.balance)} due
                        </p>
                      )}
                    </td>
                    <td className="py-3 pr-4">
                      <Badge color={c.overdue ? 'danger' : CHARGE_STATUS_COLOR[c.status]}>
                        {c.overdue ? 'Overdue' : statusLabel(c.status)}
                      </Badge>
                    </td>
                    <td className="py-3 pr-4 whitespace-nowrap">
                      {c.paidAt ? fmt(c.paidAt) : '—'}
                      {c.paidAt && paidViaLabel(c) && (
                        <p className="text-xs text-gray-500 dark:text-slate-400">{paidViaLabel(c)}</p>
                      )}
                      {!c.paidAt && c.dueAt && c.status === 'pending' && (
                        <p className="text-xs text-gray-500 dark:text-slate-400">due {fmt(c.dueAt)}</p>
                      )}
                    </td>
                    {isSuperAdmin && (
                      <td className="py-3 text-right whitespace-nowrap">
                        <div className="inline-flex items-center gap-1.5">
                          {(c.status === 'pending' || c.status === 'waived') && (
                            <Button size="sm" icon={Wallet} disabled={busy} onClick={() => setPayTarget(c)}>
                              {partial ? 'Collect balance' : 'Record payment'}
                            </Button>
                          )}
                          {/* An online payment was collected by the gateway; only a hand-recorded one can be reverted. */}
                          {c.status === 'paid' && !linked && !online && (
                            <button type="button" title={orgnestNumber ? `Revert payment (credits invoice ${orgnestNumber} in orgnest)` : 'Revert payment'} aria-label="Revert payment" className={ICON_BTN} disabled={busy}
                              onClick={() => act(c.id, endpoints.charges.unpay(c.id), 'Payment reverted', 'Could not revert the payment')}>
                              <Undo2 className="h-4 w-4" />
                            </button>
                          )}
                          {c.status === 'pending' && (
                            <>
                              <button type="button" title="Edit amount / GST" aria-label="Edit charge" className={ICON_BTN} disabled={busy}
                                onClick={() => setEditTarget(c)}>
                                <Pencil className="h-4 w-4" />
                              </button>
                              <button type="button" title="Waive (write off)" aria-label="Waive" className={ICON_BTN} disabled={busy}
                                onClick={() => act(c.id, endpoints.charges.waive(c.id), 'Charge waived', 'Could not waive the charge')}>
                                <Ban className="h-4 w-4" />
                              </button>
                              <button type="button" title="Cancel (raised in error)" aria-label="Cancel" className={ICON_BTN} disabled={busy}
                                onClick={() => setCancelTarget(c)}>
                                <XCircle className="h-4 w-4" />
                              </button>
                            </>
                          )}
                          {(c.status === 'waived' || c.status === 'cancelled') && (
                            <button type="button" title="Reopen as unpaid" aria-label="Reopen" className={ICON_BTN} disabled={busy}
                              onClick={() => act(c.id, endpoints.charges.reopen(c.id), 'Charge reopened', 'Could not reopen the charge')}>
                              <RotateCcw className="h-4 w-4" />
                            </button>
                          )}
                          {live && hasDocument && (
                            <button type="button" title={`Open invoice ${orgnestNumber || c.invoiceNumber || ''}`} aria-label="Open invoice" className={ICON_BTN} disabled={busy}
                              onClick={() => openDocument(c)}>
                              <FileText className="h-4 w-4" />
                            </button>
                          )}
                          {/* The backend raises the invoice in orgnest as a charge is paid; this is the retry. */}
                          {orgnestOn && live && !hasDocument && c.status === 'paid' && (
                            <Button size="sm" variant="secondary" icon={Send} loading={busy} onClick={() => raiseOrgnest(c)}>
                              {orgnest?.lastError ? 'Retry in orgnest' : 'Raise in orgnest'}
                            </Button>
                          )}
                          {/* With orgnest invoicing off, MedNote numbers its own platform invoice. */}
                          {!orgnestOn && live && !hasDocument && (
                            <button type="button" title="Generate GST invoice" aria-label="Generate invoice" className={ICON_BTN} disabled={busy}
                              onClick={() => generateInvoice(c)}>
                              <FilePlus2 className="h-4 w-4" />
                            </button>
                          )}
                        </div>
                      </td>
                    )}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {feeOpen && <RecordFeeModal isOpen hospital={hospital || { id: hospitalId, name: hospitalName }} orgnestOn={orgnestOn} onClose={() => setFeeOpen(false)} onSaved={refresh} />}
      {renewalOpen && <RaiseRenewalModal isOpen hospital={hospital || { id: hospitalId, name: hospitalName }} orgnestOn={orgnestOn} onClose={() => setRenewalOpen(false)} onSaved={refresh} />}
      {payTarget && <MarkPaidModal isOpen charge={payTarget} orgnestOn={orgnestOn} onClose={() => setPayTarget(null)} onSaved={refresh} />}
      {editTarget && <EditChargeModal isOpen charge={editTarget} onClose={() => setEditTarget(null)} onSaved={refresh} />}
      <ConfirmDialog
        isOpen={!!cancelTarget}
        onClose={() => setCancelTarget(null)}
        title="Cancel this charge?"
        message={cancelTarget ? `"${cancelTarget.description}" (${formatCurrency(cancelTarget.total)}) will be marked as raised in error. It stays on the ledger but no longer counts as billed.${cancelTarget.subscriptionId ? ' The subscription period itself is left as it is.' : ''}` : ''}
        confirmText="Cancel charge"
        loading={!!cancelTarget && busyId === cancelTarget.id}
        onConfirm={async () => {
          const c = cancelTarget;
          await act(c.id, endpoints.charges.cancel(c.id), 'Charge cancelled', 'Could not cancel the charge');
          setCancelTarget(null);
        }}
      />
    </Card>
  );
}

function Tile({ label, value, tone }) {
  return (
    <div className="rounded-xl border border-gray-100 dark:border-slate-800 p-3">
      <p className="text-[11px] uppercase tracking-wide text-gray-400">{label}</p>
      <p className={`mt-1 text-lg font-semibold tabular-nums ${tone || 'text-gray-900 dark:text-slate-100'}`}>{value}</p>
    </div>
  );
}

/** The payment fields shared by "record it already paid" and "record payment". */
function PaymentFields({ value, onChange, amountLabel, amountDisabled }) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 rounded-lg border border-gray-100 dark:border-slate-800 p-3">
      {amountLabel && (
        <Input
          label={amountLabel}
          type="number"
          min="0"
          step="0.01"
          value={value.amount}
          disabled={amountDisabled}
          onChange={(e) => onChange({ amount: e.target.value })}
        />
      )}
      <DatePicker label="Payment date" value={value.paidAt} onChange={(v) => onChange({ paidAt: v })} isClearable={false} />
      <Select label="Method" options={PAYMENT_METHODS} value={value.method} onChange={(v) => onChange({ method: v })} />
      <Input label="Reference" placeholder="UTR / cheque no." value={value.reference} onChange={(e) => onChange({ reference: e.target.value })} />
    </div>
  );
}

const emptyPayment = () => ({ amount: '', paidAt: today(), method: 'bank_transfer', reference: '' });

// ---- Record a one-off fee ---------------------------------------------------

// The GST invoice for a fee collected on the spot is raised in orgnest by the
// backend as part of the save (orgnestOn); a hand-typed invoice number means
// "invoiced elsewhere" and stops that.
function RecordFeeModal({ isOpen, onClose, hospital, onSaved, orgnestOn }) {
  const planSetup = Number(hospital?.plan?.setupFee || 0);
  const [type, setType] = useState('setup_fee');
  // Seeded from the type so the form opens valid; follows the type picker
  // until the admin types their own wording.
  const [description, setDescription] = useState(CHARGE_TYPE_LABEL.setup_fee);
  const [descriptionEdited, setDescriptionEdited] = useState(false);
  const [amount, setAmount] = useState(planSetup > 0 ? String(planSetup) : '');
  const [taxAmount, setTaxAmount] = useState('');
  const [chargedAt, setChargedAt] = useState(today());
  const [dueAt, setDueAt] = useState('');
  const [invoiceNumber, setInvoiceNumber] = useState('');
  const [note, setNote] = useState('');
  const [paidNow, setPaidNow] = useState(true);
  const [payment, setPayment] = useState(emptyPayment);
  const [saving, setSaving] = useState(false);

  const total = (Number(amount) || 0) + (Number(taxAmount) || 0);
  const blocker = description.trim().length < 2 ? 'Add a description'
    : amount === '' ? 'Enter an amount'
    : !(Number(amount) >= 0) ? 'Amount must be 0 or more'
    : taxAmount !== '' && !(Number(taxAmount) >= 0) ? 'GST must be 0 or more'
    : paidNow && !payment.paidAt ? 'Set the payment date'
    : null;

  const submit = async () => {
    if (blocker) { toast.error(blocker); return; }
    setSaving(true);
    try {
      const res = await api.post(endpoints.charges.forHospital(hospital.id), {
        type,
        description: description.trim(),
        amount: Number(amount),
        taxAmount: taxAmount === '' ? 0 : Number(taxAmount),
        chargedAt,
        dueAt: paidNow ? null : (dueAt || null),
        invoiceNumber: invoiceNumber.trim() || null,
        note: note.trim() || null,
        markPaid: paidNow,
        paidAt: paidNow ? payment.paidAt : null,
        paymentMethod: paidNow ? payment.method || null : null,
        paymentRef: paidNow ? payment.reference.trim() || null : null,
      });
      toastInvoice(res, paidNow ? 'Fee recorded as paid' : 'Fee recorded');
      onClose();
      onSaved?.();
    } catch (err) {
      toast.error(apiError(err, 'Could not record the fee'));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Record a fee" size="lg">
      <div className="space-y-4">
        <div className="rounded-lg bg-gray-50 dark:bg-slate-800/60 p-3 text-sm">
          <p className="font-medium text-gray-900 dark:text-slate-100">{hospital.name}</p>
          <p className="text-xs text-gray-500 dark:text-slate-400">
            A one-off charge outside the subscription — setup, customisation, training, migration, support, hardware.
            {planSetup > 0 && <> The {hospital.plan?.name} plan&apos;s setup fee is {formatCurrency(planSetup)}.</>}
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <Select
            label="Type"
            options={typeOptions(ONE_OFF_TYPES)}
            value={type}
            onChange={(v) => {
              setType(v);
              if (!descriptionEdited) setDescription(CHARGE_TYPE_LABEL[v]);
              if (v === 'setup_fee' && amount === '' && planSetup > 0) setAmount(String(planSetup));
            }}
          />
          <DatePicker label="Charged on" value={chargedAt} onChange={setChargedAt} isClearable={false} />
        </div>

        <Input
          label="Description"
          placeholder="e.g. One-time setup & onboarding"
          value={description}
          onChange={(e) => { setDescription(e.target.value); setDescriptionEdited(true); }}
        />

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <Input label="Amount (₹)" type="number" min="0" step="0.01" value={amount} onChange={(e) => setAmount(e.target.value)} />
          <Input label="GST (₹)" type="number" min="0" step="0.01" placeholder="blank if inclusive" value={taxAmount} onChange={(e) => setTaxAmount(e.target.value)} />
          <Input label="Invoice no. (optional)" value={invoiceNumber} onChange={(e) => setInvoiceNumber(e.target.value)} />
        </div>

        <label className="flex items-center gap-2 text-sm text-gray-700 dark:text-slate-300">
          <input type="checkbox" className="w-4 h-4" checked={paidNow} onChange={(e) => setPaidNow(e.target.checked)} />
          Already collected
        </label>

        {paidNow
          ? <PaymentFields value={payment} onChange={(p) => setPayment((v) => ({ ...v, ...p }))} />
          : <DatePicker label="Due on" value={dueAt} onChange={setDueAt} />}
        {orgnestOn && (
          <p className="-mt-2 text-xs text-gray-500 dark:text-slate-400">
            {paidNow
              ? 'The GST invoice is raised in orgnest and emailed to the hospital on save.'
              : 'The GST invoice is raised in orgnest when the payment is recorded.'}
            {' '}Fill in an invoice number only if this was invoiced elsewhere — none is raised then.
          </p>
        )}

        <Input label="Note (optional)" placeholder="Anything worth remembering about this charge" value={note} onChange={(e) => setNote(e.target.value)} />

        <div className="flex flex-wrap items-center justify-between gap-3 pt-2">
          <p className="text-sm text-gray-500 dark:text-slate-400">
            {blocker || (
              <>Total <span className="font-semibold text-gray-900 dark:text-slate-100">{formatCurrency(total)}</span>
                {!paidNow && ' · recorded as outstanding'}</>
            )}
          </p>
          <div className="flex gap-3">
            <Button variant="secondary" onClick={onClose}>Cancel</Button>
            <Button onClick={submit} loading={saving} disabled={!!blocker}>Save</Button>
          </div>
        </div>
      </div>
    </Modal>
  );
}

// ---- Raise the next subscription term --------------------------------------
//
// Unlike "Record Subscription" on the Subscription card (which opens the
// period immediately), this raises the next term's charge on the ledger —
// pending, like an invoice sent ahead of the renewal date — and opens the
// period only once it is collected. Prefilled from the server's draft: the
// term that follows whatever was last billed, at the hospital's own rate,
// with GST at the platform default rate (plan prices are ex-GST).
function RaiseRenewalModal({ isOpen, onClose, hospital, onSaved, orgnestOn }) {
  const [draft, setDraft] = useState(null);
  const [draftError, setDraftError] = useState(null);
  const [description, setDescription] = useState('');
  const [amount, setAmount] = useState('');
  const [taxAmount, setTaxAmount] = useState('');
  const [periodStart, setPeriodStart] = useState('');
  const [periodEnd, setPeriodEnd] = useState('');
  const [chargedAt, setChargedAt] = useState('');
  const [invoiceNumber, setInvoiceNumber] = useState('');
  const [paidNow, setPaidNow] = useState(false);
  const [advance, setAdvance] = useState(true);
  const [payment, setPayment] = useState(emptyPayment);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    api.get(endpoints.charges.nextSubscription(hospital.id))
      .then((res) => {
        const d = res.data?.data;
        setDraft(d);
        setDescription(d.description || '');
        setAmount(String(d.amount ?? ''));
        setTaxAmount(Number(d.taxAmount) > 0 ? String(d.taxAmount) : '');
        setPeriodStart(toDay(d.periodStart));
        setPeriodEnd(toDay(d.periodEnd));
        setChargedAt(toDay(d.chargedAt));
      })
      .catch((err) => setDraftError(apiError(err, 'Could not draft the next term')));
  }, [hospital.id]);

  const durationDays = draft?.breakdown?.durationInDays || 30;
  const total = (Number(amount) || 0) + (Number(taxAmount) || 0);
  const blocker = draftError ? draftError
    : !draft ? 'Loading…'
    : description.trim().length < 2 ? 'Add a description'
    : !periodStart || !periodEnd ? 'Set the period this covers'
    : periodEnd <= periodStart ? 'Period end must be after the start'
    : amount === '' || !(Number(amount) >= 0) ? 'Enter a valid amount'
    : paidNow && !payment.paidAt ? 'Set the payment date'
    : null;

  const submit = async () => {
    if (blocker) { toast.error(blocker); return; }
    setSaving(true);
    try {
      const res = await api.post(endpoints.charges.forHospital(hospital.id), {
        type: 'subscription',
        description: description.trim(),
        amount: Number(amount),
        taxAmount: taxAmount === '' ? 0 : Number(taxAmount),
        chargedAt: chargedAt || periodStart,
        dueAt: periodStart,
        periodStart,
        periodEnd,
        billingCycle: draft?.billingCycle || null,
        invoiceNumber: invoiceNumber.trim() || null,
        metadata: { ...(draft?.breakdown || {}), ...(draft?.gstRate != null ? { gstRate: draft.gstRate } : {}), source: 'manual' },
        markPaid: paidNow,
        paidAt: paidNow ? payment.paidAt : null,
        paymentMethod: paidNow ? payment.method || null : null,
        paymentRef: paidNow ? payment.reference.trim() || null : null,
        advanceSubscription: advance,
      });
      toastInvoice(res, paidNow && advance ? 'Renewal recorded and period opened' : paidNow ? 'Renewal recorded' : 'Renewal raised');
      onClose();
      onSaved?.();
    } catch (err) {
      toast.error(apiError(err, 'Could not raise the renewal'));
    } finally {
      setSaving(false);
    }
  };

  const b = draft?.breakdown || {};
  const cycleWord = draft?.billingCycle === 'yearly' ? 'year' : draft?.billingCycle === 'monthly' ? 'month' : 'period';

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Raise renewal" size="lg">
      <div className="space-y-4">
        {draftError && <p className="text-sm text-red-600">{draftError}</p>}
        {draft && (
          <div className="rounded-lg bg-gray-50 dark:bg-slate-800/60 p-3 text-sm space-y-1">
            <div className="flex justify-between">
              <span className="text-gray-600 dark:text-slate-400">
                {b.planName || 'Plan'}
                {b.planPriceIsCustom && <span className="ml-1 text-xs">(custom price · list {formatCurrency(b.listPrice)})</span>}
              </span>
              <span className="tabular-nums font-medium text-gray-900 dark:text-slate-100">
                {formatCurrency(b.planAmount)} / {cycleWord}
                {Number(draft.taxAmount) > 0 && <span className="ml-1 text-xs font-normal text-gray-500">+ GST</span>}
              </span>
            </div>
            <p className="text-xs text-gray-500 dark:text-slate-400">
              {draft.lastBilledPeriodEnd
                ? <>Billed up to {fmt(draft.lastBilledPeriodEnd)}. </>
                : draft.currentPeriodEnd ? <>Current period ends {fmt(draft.currentPeriodEnd)}. </> : null}
              The charge is raised as unpaid; the period opens when it is collected.
            </p>
          </div>
        )}

        <Input label="Description" value={description} onChange={(e) => setDescription(e.target.value)} />

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <DatePicker
            label="Period from"
            value={periodStart}
            isClearable={false}
            onChange={(v) => { setPeriodStart(v); if (v) setPeriodEnd(toDay(dayjs(v).add(durationDays, 'day'))); }}
          />
          <DatePicker label="Period to" value={periodEnd} onChange={setPeriodEnd} isClearable={false} />
          <DatePicker label="Charged on" value={chargedAt} onChange={setChargedAt} isClearable={false} />
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <Input label="Amount (₹)" type="number" min="0" step="0.01" value={amount} onChange={(e) => setAmount(e.target.value)} />
          <Input label="GST (₹)" type="number" min="0" step="0.01" placeholder="blank if inclusive" value={taxAmount} onChange={(e) => setTaxAmount(e.target.value)} />
          <Input label="Invoice no. (optional)" value={invoiceNumber} onChange={(e) => setInvoiceNumber(e.target.value)} />
        </div>

        <label className="flex items-center gap-2 text-sm text-gray-700 dark:text-slate-300">
          <input type="checkbox" className="w-4 h-4" checked={paidNow} onChange={(e) => setPaidNow(e.target.checked)} />
          Already collected
        </label>
        {paidNow && <PaymentFields value={payment} onChange={(p) => setPayment((v) => ({ ...v, ...p }))} />}
        {orgnestOn && (
          <p className="-mt-2 text-xs text-gray-500 dark:text-slate-400">
            {paidNow
              ? 'The GST invoice is raised in orgnest and emailed to the hospital on save.'
              : 'The GST invoice is raised in orgnest when the payment is recorded.'}
            {' '}Fill in an invoice number only if this was invoiced elsewhere — none is raised then.
          </p>
        )}

        <label className="flex items-start gap-2 text-sm text-gray-700 dark:text-slate-300">
          <input type="checkbox" className="w-4 h-4 mt-0.5" checked={advance} onChange={(e) => setAdvance(e.target.checked)} />
          <span>
            Open the subscription period {periodStart ? `${fmt(periodStart)} → ${fmt(periodEnd)}` : ''} once collected
            <span className="block text-xs text-gray-500 dark:text-slate-400">
              A term that already runs further out is never pulled back. Untick to keep this as a ledger entry only.
            </span>
          </span>
        </label>

        <div className="flex flex-wrap items-center justify-between gap-3 pt-2">
          <p className="text-sm text-gray-500 dark:text-slate-400">
            {blocker || <>Total <span className="font-semibold text-gray-900 dark:text-slate-100">{formatCurrency(total)}</span></>}
          </p>
          <div className="flex gap-3">
            <Button variant="secondary" onClick={onClose}>Cancel</Button>
            <Button onClick={submit} loading={saving} disabled={!!blocker}>{paidNow ? 'Record Renewal' : 'Raise Renewal'}</Button>
          </div>
        </div>
      </div>
    </Modal>
  );
}

// ---- Re-price an open charge -----------------------------------------------
//
// Description, amount, GST, invoice number and note of a charge nobody has
// paid yet. A charge that mirrors a subscription period keeps its amount (the
// period owns the price — change it there) but its GST is editable, since the
// period is ex-GST and the tax lives only on the ledger. That is how a term
// recorded before GST reached the subscription dialog gets its GST added.
function EditChargeModal({ isOpen, charge, onClose, onSaved }) {
  const linked = !!charge.subscriptionId;
  const [description, setDescription] = useState(charge.description || '');
  const [amount, setAmount] = useState(String(charge.amount ?? ''));
  const [taxAmount, setTaxAmount] = useState(Number(charge.taxAmount) > 0 ? String(charge.taxAmount) : '');
  const [invoiceNumber, setInvoiceNumber] = useState(charge.invoiceNumber || '');
  const [note, setNote] = useState(charge.note || '');
  const [saving, setSaving] = useState(false);

  const total = (Number(amount) || 0) + (Number(taxAmount) || 0);
  const blocker = description.trim().length < 2 ? 'Add a description'
    : amount === '' || !(Number(amount) >= 0) ? 'Amount must be 0 or more'
    : taxAmount !== '' && !(Number(taxAmount) >= 0) ? 'GST must be 0 or more'
    : null;

  const submit = async () => {
    if (blocker) { toast.error(blocker); return; }
    // Send only what changed — the backend refuses an amount change on a
    // mirrored charge, so an untouched amount must not travel.
    const patch = {};
    if (description.trim() !== (charge.description || '')) patch.description = description.trim();
    if (!linked && Number(amount) !== Number(charge.amount)) patch.amount = Number(amount);
    const tax = taxAmount === '' ? 0 : Number(taxAmount);
    if (tax !== Number(charge.taxAmount || 0)) patch.taxAmount = tax;
    if ((invoiceNumber.trim() || null) !== (charge.invoiceNumber || null)) patch.invoiceNumber = invoiceNumber.trim() || null;
    if ((note.trim() || null) !== (charge.note || null)) patch.note = note.trim() || null;
    if (Object.keys(patch).length === 0) { onClose(); return; }
    setSaving(true);
    try {
      await api.patch(endpoints.charges.update(charge.id), patch);
      toast.success('Charge updated');
      onClose();
      onSaved?.();
    } catch (err) {
      toast.error(apiError(err, 'Could not update the charge'));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Edit charge" size="lg">
      <div className="space-y-4">
        <div className="rounded-lg bg-gray-50 dark:bg-slate-800/60 p-3 text-sm">
          <p className="font-medium text-gray-900 dark:text-slate-100">{typeLabel(charge.type)} · {formatCurrency(charge.total)}</p>
          <p className="text-xs text-gray-500 dark:text-slate-400">
            Charged {fmt(charge.chargedAt)}
            {charge.periodStart && charge.periodEnd && <> · {fmt(charge.periodStart)} → {fmt(charge.periodEnd)}</>}
          </p>
        </div>

        <Input label="Description" value={description} onChange={(e) => setDescription(e.target.value)} />

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div>
            <Input label="Amount (₹)" type="number" min="0" step="0.01" value={amount} disabled={linked} onChange={(e) => setAmount(e.target.value)} />
            {linked && (
              <p className="mt-1 text-xs text-gray-500 dark:text-slate-400">Set by the subscription period.</p>
            )}
          </div>
          <Input label="GST (₹)" type="number" min="0" step="0.01" placeholder="blank if inclusive" value={taxAmount} onChange={(e) => setTaxAmount(e.target.value)} />
          <Input label="Invoice no. (optional)" value={invoiceNumber} onChange={(e) => setInvoiceNumber(e.target.value)} />
        </div>

        <Input label="Note (optional)" value={note} onChange={(e) => setNote(e.target.value)} />

        <div className="flex flex-wrap items-center justify-between gap-3 pt-2">
          <p className="text-sm text-gray-500 dark:text-slate-400">
            {blocker || <>Total <span className="font-semibold text-gray-900 dark:text-slate-100">{formatCurrency(total)}</span></>}
          </p>
          <div className="flex gap-3">
            <Button variant="secondary" onClick={onClose}>Cancel</Button>
            <Button onClick={submit} loading={saving} disabled={!!blocker}>Save</Button>
          </div>
        </div>
      </div>
    </Modal>
  );
}

// ---- Collect an existing charge ---------------------------------------------

function MarkPaidModal({ isOpen, charge, onClose, onSaved, orgnestOn }) {
  const [payment, setPayment] = useState(() => ({
    amount: String(charge.balance ?? charge.total ?? ''),
    paidAt: today(),
    method: PAYMENT_METHODS.some((m) => m.value === charge.paymentMethod) ? charge.paymentMethod : 'bank_transfer',
    reference: charge.paymentRef || '',
  }));
  const [invoiceNumber, setInvoiceNumber] = useState(charge.invoiceNumber || '');
  const [advance, setAdvance] = useState(true);
  const [saving, setSaving] = useState(false);

  const balance = Number(charge.balance || 0);
  const amt = Number(payment.amount);
  const settles = amt >= balance;
  const opensPeriod = charge.type === 'subscription' && !charge.subscriptionId && charge.periodStart && charge.periodEnd;
  const blocker = !(amt > 0) && balance > 0 ? 'Enter the amount received'
    : amt > balance ? `Amount exceeds the ${formatCurrency(balance)} balance`
    : !payment.paidAt ? 'Set the payment date'
    : null;

  const submit = async () => {
    if (blocker) { toast.error(blocker); return; }
    setSaving(true);
    try {
      const res = await api.post(endpoints.charges.pay(charge.id), {
        amount: amt,
        paidAt: payment.paidAt,
        paymentMethod: payment.method || null,
        paymentRef: payment.reference.trim() || null,
        invoiceNumber: invoiceNumber.trim() || null,
        advanceSubscription: advance,
      });
      toastInvoice(res, settles ? 'Charge marked paid' : 'Part payment recorded');
      onClose();
      onSaved?.();
    } catch (err) {
      toast.error(apiError(err, 'Could not record the payment'));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Record payment" size="lg">
      <div className="space-y-4">
        <div className="rounded-lg bg-gray-50 dark:bg-slate-800/60 p-3 text-sm">
          <p className="font-medium text-gray-900 dark:text-slate-100">{charge.description}</p>
          <p className="text-xs text-gray-500 dark:text-slate-400">
            {typeLabel(charge.type)} · {formatCurrency(charge.total)}
            {charge.periodStart && charge.periodEnd && <> · {fmt(charge.periodStart)} → {fmt(charge.periodEnd)}</>}
          </p>
          <div className="mt-3 grid grid-cols-3 gap-2 text-center">
            <div>
              <p className="text-[11px] uppercase tracking-wide text-gray-400">Total</p>
              <p className="font-semibold text-gray-900 dark:text-slate-100">{formatCurrency(charge.total)}</p>
            </div>
            <div>
              <p className="text-[11px] uppercase tracking-wide text-gray-400">Paid</p>
              <p className="font-semibold text-emerald-600 dark:text-emerald-400">{formatCurrency(charge.amountPaid)}</p>
            </div>
            <div>
              <p className="text-[11px] uppercase tracking-wide text-gray-400">Balance</p>
              <p className="font-semibold text-amber-600 dark:text-amber-400">{formatCurrency(balance)}</p>
            </div>
          </div>
        </div>

        <PaymentFields value={payment} onChange={(p) => setPayment((v) => ({ ...v, ...p }))} amountLabel="Amount received (₹)" />
        {amt > 0 && !settles && (
          <p className="-mt-2 text-xs text-gray-500 dark:text-slate-400">
            A part payment — {formatCurrency(balance - amt)} stays outstanding.
          </p>
        )}

        <Input label="Invoice no. (optional)" value={invoiceNumber} onChange={(e) => setInvoiceNumber(e.target.value)} />
        {orgnestOn && !charge.invoiceId && (
          <p className="-mt-2 text-xs text-gray-500 dark:text-slate-400">
            {settles
              ? 'Once settled, the GST invoice is raised in orgnest and emailed to the hospital.'
              : 'The GST invoice is raised in orgnest once the balance is settled.'}
            {' '}Fill in an invoice number only if this was invoiced elsewhere — none is raised then.
          </p>
        )}

        {opensPeriod && (
          <label className="flex items-start gap-2 text-sm text-gray-700 dark:text-slate-300">
            <input type="checkbox" className="w-4 h-4 mt-0.5" checked={advance} onChange={(e) => setAdvance(e.target.checked)} />
            <span>
              Open the subscription period {fmt(charge.periodStart)} → {fmt(charge.periodEnd)} once settled
              <span className="block text-xs text-gray-500 dark:text-slate-400">A term that already runs further out is never pulled back.</span>
            </span>
          </label>
        )}
        {charge.subscriptionId && (
          <p className="text-xs text-gray-500 dark:text-slate-400">
            Recorded against the subscription period, so the Subscription card and billing detail page update too.
          </p>
        )}

        <div className="flex flex-wrap items-center justify-between gap-3 pt-2">
          <p className="text-sm text-gray-500 dark:text-slate-400">{blocker || ''}</p>
          <div className="flex gap-3">
            <Button variant="secondary" onClick={onClose}>Cancel</Button>
            <Button onClick={submit} loading={saving} disabled={!!blocker}>{settles ? 'Mark Paid' : 'Record Part Payment'}</Button>
          </div>
        </div>
      </div>
    </Modal>
  );
}
