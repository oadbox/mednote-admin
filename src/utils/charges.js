// Labels and lookups for the platform revenue ledger (Hospital_Charge).
// Values mirror hms-backend/src/services/platform/charges.service.js.

export const CHARGE_TYPE_LABEL = {
  subscription: 'Subscription',
  setup_fee: 'Setup fee',
  addon: 'Add-on',
  customization: 'Customisation',
  training: 'Training',
  data_migration: 'Data migration',
  support: 'Support',
  hardware: 'Hardware',
  other: 'Other',
};

/** One-off fee types, in the order the "Record fee" picker offers them. */
export const ONE_OFF_TYPES = [
  'setup_fee', 'customization', 'training', 'data_migration', 'support', 'hardware', 'addon', 'other',
];

export const CHARGE_TYPES = ['subscription', ...ONE_OFF_TYPES];

export const CHARGE_STATUSES = ['pending', 'paid', 'waived', 'cancelled'];

export const CHARGE_STATUS_COLOR = {
  pending: 'warning',
  paid: 'success',
  waived: 'gray',
  cancelled: 'danger',
};

export const PAYMENT_METHODS = [
  { value: 'upi', label: 'UPI' },
  { value: 'bank_transfer', label: 'Bank Transfer' },
  { value: 'cash', label: 'Cash' },
  { value: 'card', label: 'Card' },
  { value: 'cheque', label: 'Cheque' },
  { value: 'other', label: 'Other' },
];

export const PAYMENT_METHOD_LABEL = {
  ...Object.fromEntries(PAYMENT_METHODS.map((m) => [m.value, m.label])),
  // Set by the Razorpay webhook for self-serve payments (metadata.gateway
  // carries the provider, instrument and payment id). Not offered in pickers.
  online: 'Online',
};

/** "Online · UPI" for a gateway-collected charge, else the recorded method. */
export const paidViaLabel = (charge) => {
  const g = charge?.metadata?.gateway;
  if (g?.provider) {
    const method = g.method ? String(g.method).toUpperCase() : null;
    return method ? `Online · ${method}` : 'Online';
  }
  return charge?.paymentMethod ? (PAYMENT_METHOD_LABEL[charge.paymentMethod] || charge.paymentMethod) : null;
};

export const typeLabel = (t) => CHARGE_TYPE_LABEL[t] || t || '—';

export const statusLabel = (s) => ({
  pending: 'Unpaid', paid: 'Paid', waived: 'Waived', cancelled: 'Cancelled',
}[s] || s || '—');

/** Badge text for how a charge came to be, when it wasn't typed in by hand. */
export const sourceLabel = (source) => ({
  'auto-renewal': 'Auto',
  backfill: 'Imported',
  onboarding: 'Onboarding',
  'plan-change': 'Plan change',
}[source] || null);

export const typeOptions = (types = CHARGE_TYPES) => types.map((t) => ({ value: t, label: CHARGE_TYPE_LABEL[t] }));
