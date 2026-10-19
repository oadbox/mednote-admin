import { useSearchParams } from 'react-router-dom';
import { Receipt, CreditCard } from 'lucide-react';
import RevenueLedger from './RevenueLedger';
import BillingList from './BillingList';

const TABS = [
  { key: 'ledger', label: 'Revenue ledger', Icon: Receipt },
  { key: 'subscriptions', label: 'Subscriptions', Icon: CreditCard },
];

// Billing = two views of the same money. The revenue ledger is every charge
// (subscription terms + one-off fees) with what was collected; Subscriptions
// is the period-by-period entitlement view that existed before the ledger.
export default function BillingPage() {
  const [params, setParams] = useSearchParams();
  const tab = params.get('tab') === 'subscriptions' ? 'subscriptions' : 'ledger';
  const select = (key) => setParams(key === 'ledger' ? {} : { tab: key }, { replace: true });

  return (
    <div className="space-y-5">
      <div
        role="tablist"
        aria-label="Billing views"
        className="inline-flex rounded-lg border border-gray-300 dark:border-slate-700 bg-gray-50 dark:bg-slate-800/40 p-1"
      >
        {TABS.map((t) => {
          const active = tab === t.key;
          return (
            <button
              key={t.key}
              type="button"
              role="tab"
              aria-selected={active}
              onClick={() => select(t.key)}
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium rounded-md transition ${
                active
                  ? 'bg-white dark:bg-slate-900 text-blue-700 dark:text-blue-300 shadow-sm ring-1 ring-blue-200 dark:ring-blue-500/30'
                  : 'text-gray-600 dark:text-slate-400 hover:text-gray-900 dark:hover:text-slate-100'
              }`}
            >
              <t.Icon className="w-3.5 h-3.5" />
              {t.label}
            </button>
          );
        })}
      </div>

      {tab === 'ledger' ? <RevenueLedger /> : <BillingList />}
    </div>
  );
}
