import { useEffect, useState } from 'react';
import { useForm, useWatch } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import toast from 'react-hot-toast';
import { Calendar, CalendarRange } from 'lucide-react';
import api from '../../api/axios';
import endpoints from '../../api/endpoints';
import Modal from '../../components/ui/Modal';
import Input from '../../components/ui/Input';
import Button from '../../components/ui/Button';
import { nameField, blockDigits } from '../../utils/validators';
import { getCurrencySymbol } from '../../utils/formatters';
import { usePlatformSettings } from '../../hooks/usePlatformSettings';

const CYCLE_DAYS = { monthly: 30, yearly: 365 };

const legacyFeatureLabels = {
  abdm_integration: 'ABDM Integration',
};

function normalizeFeatures(value) {
  if (Array.isArray(value)) return value;
  if (!value || typeof value !== 'object') return [];
  return Object.entries(value)
    .filter(([, enabled]) => Boolean(enabled))
    .map(([key]) => legacyFeatureLabels[key] || key
      .replace(/_/g, ' ')
      .replace(/\b\w/g, (char) => char.toUpperCase()));
}

const schema = z.object({
  name: nameField('Plan name'),
  description: z.string().optional(),
  billingCycle: z.enum(['monthly', 'yearly']),
  price: z.coerce.number().min(0, 'Price must be 0 or more'),
  setupFee: z.coerce.number().min(0, 'Setup fee must be 0 or more').optional(),
  durationInDays: z.coerce.number().min(1, 'Duration must be at least 1'),
  maxUsers: z.coerce.number().min(1, 'Must allow at least 1 user'),
  maxAdmins: z.coerce.number().min(1, 'Must allow at least 1 admin'),
  maxDoctors: z.coerce.number().min(0).optional(),
  maxPatients: z.coerce.number().min(0).optional(),
  trialDays: z.coerce.number().min(0).optional(),
  // Website / self-serve presentation
  isPublic: z.boolean().optional(),
  highlight: z.boolean().optional(),
  sortOrder: z.coerce.number().int().optional(),
  tagline: z.string().max(200, 'Keep the tagline under 200 characters').optional(),
  highlights: z.string().optional(),
});

export default function PlanForm({ isOpen, onClose, plan, onSuccess }) {
  const [loading, setLoading] = useState(false);
  const [features, setFeatures] = useState(() => normalizeFeatures(plan?.features));
  // The toggleable module catalog is owned by the backend (single source of
  // truth shared with the hospital editor) — fetch it instead of hardcoding a
  // copy that drifts. Labels are what we store in the plan's `features` array.
  const [moduleCatalog, setModuleCatalog] = useState([]);
  const isEditing = !!plan;
  const { currency } = usePlatformSettings();
  const currencySymbol = getCurrencySymbol(currency);

  const {
    register,
    handleSubmit,
    reset,
    control,
    setValue,
    formState: { errors },
  } = useForm({
    resolver: zodResolver(schema),
    defaultValues: {
      name: '', description: '', billingCycle: 'monthly', price: 0, setupFee: 0, durationInDays: 30,
      maxUsers: 10, maxAdmins: 1, maxDoctors: 5, maxPatients: 500, trialDays: 14,
      isPublic: true, highlight: false, sortOrder: 0, tagline: '', highlights: '',
    },
  });

  const billingCycle = useWatch({ control, name: 'billingCycle' });
  const isPublic = useWatch({ control, name: 'isPublic' }) !== false;
  const highlightOn = Boolean(useWatch({ control, name: 'highlight' }));

  // Load the module catalog once when the form opens.
  useEffect(() => {
    if (!isOpen) return;
    let active = true;
    api.get(endpoints.plans.modules)
      .then((res) => {
        const data = res.data?.data || res.data;
        if (active) setModuleCatalog(data?.modules || []);
      })
      .catch(() => { /* leave empty — the Features section just won't render */ });
    return () => { active = false; };
  }, [isOpen]);

  useEffect(() => {
    if (plan) {
      reset({
        name: plan.name || '',
        description: plan.description || '',
        billingCycle: plan.billingCycle === 'yearly' ? 'yearly' : 'monthly',
        price: plan.price || 0,
        setupFee: plan.setupFee || 0,
        durationInDays: plan.durationInDays || 30,
        maxUsers: plan.maxUsers || 10,
        maxAdmins: plan.maxAdmins || 1,
        maxDoctors: plan.maxDoctors || 5,
        maxPatients: plan.maxPatients || 500,
        trialDays: plan.trialDays || 0,
        isPublic: plan.isPublic !== false,
        highlight: Boolean(plan.highlight),
        sortOrder: plan.sortOrder ?? 0,
        tagline: plan.tagline || '',
        highlights: Array.isArray(plan.highlights) ? plan.highlights.join('\n') : '',
      });
    } else {
      reset({
        name: '', description: '', billingCycle: 'monthly', price: 0, setupFee: 0, durationInDays: 30,
        maxUsers: 10, maxAdmins: 1, maxDoctors: 5, maxPatients: 500, trialDays: 14,
      isPublic: true, highlight: false, sortOrder: 0, tagline: '', highlights: '',
      });
    }
  }, [plan, reset]);

  // Toggle the billing cycle and auto-fill the matching default duration. The
  // user can still hand-edit Duration afterwards — we only set it on the
  // cycle change itself, not on every render.
  const handleCycleChange = (next) => {
    setValue('billingCycle', next, { shouldDirty: true });
    setValue('durationInDays', CYCLE_DAYS[next], { shouldDirty: true });
  };

  const toggleFeature = (f) => {
    setFeatures((prev) => prev.includes(f) ? prev.filter((x) => x !== f) : [...prev, f]);
  };

  const onSubmit = async (data) => {
    setLoading(true);
    try {
      const payload = { ...data, features };
      if (isEditing) {
        await api.put(endpoints.plans.update(plan.id || plan._id), payload);
        toast.success('Plan updated');
      } else {
        await api.post(endpoints.plans.create, payload);
        toast.success('Plan created');
      }
      onSuccess();
      onClose();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to save plan');
    } finally {
      setLoading(false);
    }
  };

  const cycleSuffix = billingCycle === 'yearly' ? 'year' : 'month';

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={isEditing ? 'Edit Plan' : 'Create Plan'} size="lg">
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
        {/* Billing-cycle toggle. Drives the Price label ("/month" vs "/year")
            and seeds Duration with a sensible default (30 / 365) that the
            user can still hand-edit. */}
        <div>
          <p className="text-sm font-medium text-gray-700 dark:text-slate-300 mb-1.5">Billing Cycle</p>
          <div
            role="radiogroup"
            aria-label="Billing cycle"
            className="inline-flex rounded-lg border border-gray-300 dark:border-slate-700 bg-gray-50 dark:bg-slate-800/40 p-1"
          >
            {[
              { value: 'monthly', label: 'Monthly', Icon: Calendar },
              { value: 'yearly',  label: 'Yearly',  Icon: CalendarRange },
            ].map(({ value, label, Icon }) => {
              const active = billingCycle === value;
              return (
                <button
                  key={value}
                  type="button"
                  role="radio"
                  aria-checked={active}
                  onClick={() => handleCycleChange(value)}
                  className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium rounded-md transition ${
                    active
                      ? 'bg-white dark:bg-slate-900 text-blue-700 dark:text-blue-300 shadow-sm ring-1 ring-blue-200 dark:ring-blue-500/30'
                      : 'text-gray-600 dark:text-slate-400 hover:text-gray-900 dark:hover:text-slate-100'
                  }`}
                >
                  <Icon className="w-3.5 h-3.5" />
                  {label}
                </button>
              );
            })}
          </div>
          <input type="hidden" {...register('billingCycle')} />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <Input label="Plan Name" error={errors.name?.message} {...register('name')} onKeyDown={blockDigits} />
          <Input label={`Price (${currencySymbol}/${cycleSuffix})`} type="number" error={errors.price?.message} {...register('price')} />
          {/* One-time onboarding cost. A default only — it pre-fills the setup
              fee charge raised when a hospital joins on this plan. */}
          <Input label={`Setup fee (${currencySymbol}, one-time)`} type="number" error={errors.setupFee?.message} {...register('setupFee')} />
          <Input label="Duration (days)" type="number" error={errors.durationInDays?.message} {...register('durationInDays')} />
          <Input label="Trial Days" type="number" error={errors.trialDays?.message} {...register('trialDays')} />
          <Input label="Max Users" type="number" error={errors.maxUsers?.message} {...register('maxUsers')} />
          <Input label="Max Admins" type="number" error={errors.maxAdmins?.message} {...register('maxAdmins')} />
          <Input label="Max Doctors" type="number" error={errors.maxDoctors?.message} {...register('maxDoctors')} />
          <Input label="Max Patients" type="number" error={errors.maxPatients?.message} {...register('maxPatients')} />
          <div className="col-span-2">
            <Input label="Description" error={errors.description?.message} {...register('description')} />
          </div>
        </div>

        {/* Website / self-serve presentation. Public plans appear on mednote.in
            /pricing and in each hospital's Plan & Billing page (via the public
            pricing API); highlights are the marketing bullets shown there instead
            of the raw module list. */}
        <div className="rounded-lg border border-gray-200 dark:border-slate-700 p-3 space-y-3">
          <p className="text-sm font-medium text-gray-700 dark:text-slate-300">Website &amp; self-serve</p>
          <div className="grid grid-cols-2 gap-3">
            <Toggle label="Show on website & in-app plan picker" checked={isPublic} onChange={() => setValue('isPublic', !isPublic, { shouldDirty: true })} />
            <Toggle label='"Most popular" ribbon' checked={highlightOn} onChange={() => setValue('highlight', !highlightOn, { shouldDirty: true })} />
            <Input label="Sort order (low first)" type="number" error={errors.sortOrder?.message} {...register('sortOrder')} />
            <Input label="Tagline (one line under the name)" error={errors.tagline?.message} {...register('tagline')} />
            <div className="col-span-2">
              <Input label="Highlights (one per line — marketing bullets for the website)" type="textarea" rows={4} error={errors.highlights?.message} {...register('highlights')} />
            </div>
          </div>
          <input type="hidden" {...register('isPublic')} />
          <input type="hidden" {...register('highlight')} />
        </div>

        <div>
          <p className="text-sm font-medium text-gray-700 mb-2">Features</p>
          <div className="grid grid-cols-2 gap-2">
            {moduleCatalog.map(({ key, label: f }) => (
              <label key={key} className="flex items-center gap-2 p-2 rounded-lg hover:bg-gray-50 cursor-pointer">
                <div
                  onClick={() => toggleFeature(f)}
                  className={`w-9 h-5 rounded-full relative transition-colors cursor-pointer flex-shrink-0 ${
                    features.includes(f) ? 'bg-blue-600' : 'bg-gray-300'
                  }`}
                >
                  <div
                    className={`absolute top-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform ${
                      features.includes(f) ? 'translate-x-4' : 'translate-x-0.5'
                    }`}
                  />
                </div>
                <span className="text-sm text-gray-700">{f}</span>
              </label>
            ))}
          </div>
        </div>

        <div className="flex justify-end gap-3 pt-4 border-t border-gray-200">
          <Button variant="secondary" onClick={onClose}>Cancel</Button>
          <Button type="submit" loading={loading}>{isEditing ? 'Update' : 'Create'} Plan</Button>
        </div>
      </form>
    </Modal>
  );
}

function Toggle({ label, checked, onChange }) {
  return (
    <label className="flex items-center gap-2 p-2 rounded-lg hover:bg-gray-50 dark:hover:bg-slate-800/60 cursor-pointer">
      <div
        onClick={onChange}
        role="switch"
        aria-checked={checked}
        className={`w-9 h-5 rounded-full relative transition-colors cursor-pointer flex-shrink-0 ${checked ? 'bg-blue-600' : 'bg-gray-300 dark:bg-slate-600'}`}
      >
        <div className={`absolute top-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform ${checked ? 'translate-x-4' : 'translate-x-0.5'}`} />
      </div>
      <span className="text-sm text-gray-700 dark:text-slate-300">{label}</span>
    </label>
  );
}
