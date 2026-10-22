import { useEffect, useState } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import toast from 'react-hot-toast';
import clsx from 'clsx';
import { User, Lock, Settings, Receipt, ShieldCheck, MapPin, Plus, X, ChevronRight } from 'lucide-react';
import api from '../../api/axios';
import endpoints from '../../api/endpoints';
import { useAuth } from '../../hooks/useAuth';
import { useFetch } from '../../hooks/useFetch';
import { usePlatformSettings } from '../../hooks/usePlatformSettings';
import Card from '../../components/ui/Card';
import Input from '../../components/ui/Input';
import Select from '../../components/ui/Select';
import LocationSelect from '../../components/LocationSelect';
import Button from '../../components/ui/Button';
import Spinner from '../../components/ui/Spinner';
import ThemeSettings from '../../components/ThemeSettings';
import { PaymentsCard, OrgnestInvoicingCard, FirebasePushCard } from './IntegrationsCards';

const phoneRegex = /^[+\d][\d\s().-]{6,19}$/;

const profileSchema = z.object({
  name: z.string().trim().min(2, 'Name must be at least 2 characters').max(100, 'Name too long'),
  email: z.string().trim().email('Invalid email').max(120, 'Email too long'),
  phone: z
    .string()
    .trim()
    .max(20, 'Phone too long')
    .refine((v) => v === '' || phoneRegex.test(v), 'Invalid phone number')
    .optional()
    .or(z.literal('')),
});

const passwordSchema = z
  .object({
    currentPassword: z.string().min(1, 'Current password is required'),
    newPassword: z
      .string()
      .min(8, 'Password must be at least 8 characters')
      .max(72, 'Password too long'),
    confirmPassword: z.string().min(1, 'Please confirm password'),
  })
  .refine((d) => d.newPassword === d.confirmPassword, {
    message: 'Passwords do not match',
    path: ['confirmPassword'],
  })
  .refine((d) => d.currentPassword !== d.newPassword, {
    message: 'New password must be different from current',
    path: ['newPassword'],
  });

const platformSchema = z.object({
  platformName: z.string().trim().min(2, 'Platform name is required').max(80),
  supportEmail: z.string().trim().email('Invalid support email'),
  timezone: z.string().trim().min(1, 'Timezone is required').max(64),
  currency: z.string().trim().min(3, 'Currency code required').max(8),
  defaultTrialDays: z.coerce.number().int('Must be whole number').min(0).max(365),
  emailNotifications: z.coerce.boolean(),
  maintenanceMode: z.coerce.boolean(),
  allowNewSignups: z.coerce.boolean(),
});

const billingSchema = z.object({
  companyName: z.string().trim().max(120).optional().or(z.literal('')),
  companyGstin: z.string().trim().max(32).optional().or(z.literal('')),
  companyPan: z.string().trim().max(20).optional().or(z.literal('')),
  companyAddress: z.string().trim().max(300).optional().or(z.literal('')),
  companyState: z.string().trim().max(64).optional().or(z.literal('')),
  companyPincode: z.string().trim().max(10).optional().or(z.literal('')),
  companyCountry: z.string().trim().max(64).optional().or(z.literal('')),
  defaultGstRate: z.coerce.number().min(0).max(100),
  defaultHsnCode: z.string().trim().min(1).max(16),
  invoicePrefix: z.string().trim().min(1).max(12),
});

const optionalUrl = z.string().trim().url('Invalid URL').optional().or(z.literal(''));

const abdmSchema = z.object({
  abdmEnabled: z.coerce.boolean(),
  abdmClientId: z.string().trim().max(200).optional().or(z.literal('')),
  abdmClientSecret: z.string().trim().max(500).optional().or(z.literal('')),
  abdmGatewayBaseUrl: optionalUrl,
  abdmAbhaBaseUrl: optionalUrl,
  abdmHfrBaseUrl: optionalUrl,
  abdmHprBaseUrl: optionalUrl,
}).refine((data) => !data.abdmEnabled || (data.abdmClientId && data.abdmClientSecret), {
  message: 'Client ID and secret are required when ABDM is enabled',
  path: ['abdmClientId'],
});

const CURRENCY_OPTIONS = [
  { value: 'INR', label: 'INR — Indian Rupee' },
  { value: 'USD', label: 'USD — US Dollar' },
  { value: 'EUR', label: 'EUR — Euro' },
  { value: 'GBP', label: 'GBP — British Pound' },
  { value: 'AED', label: 'AED — UAE Dirham' },
];

const MAINTENANCE_OPTIONS = [
  { value: false, label: 'Off' },
  { value: true, label: 'On' },
];

const NOTIFICATION_OPTIONS = [
  { value: true, label: 'Enabled' },
  { value: false, label: 'Disabled' },
];

const SIGNUP_OPTIONS = [
  { value: true, label: 'Allowed' },
  { value: false, label: 'Blocked' },
];

function extractServerError(err, fallback) {
  const data = err?.response?.data;
  if (Array.isArray(data?.errors) && data.errors.length) {
    return data.errors.map((e) => e.message || e.msg).join(', ');
  }
  return data?.message || fallback;
}

// One selectable list panel (countries / states) for the locations manager.
function LocationListPanel({
  title, items, selected, onSelect, onRemove, canEdit,
  draftValue, onDraftChange, onAdd, onKey, placeholder, disabled = false,
}) {
  return (
    <div className="rounded-lg border border-gray-200 dark:border-slate-700 flex flex-col min-h-[16rem]">
      <div className="px-3 py-2 border-b border-gray-100 dark:border-slate-800 text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-slate-400">
        {title}
      </div>
      <div className="flex-1 overflow-y-auto max-h-72 p-1.5 space-y-0.5">
        {disabled ? (
          <p className="text-xs text-gray-400 dark:text-slate-500 italic px-2 py-3">{placeholder.empty}</p>
        ) : items.length === 0 ? (
          <p className="text-xs text-gray-400 dark:text-slate-500 italic px-2 py-3">Nothing yet.</p>
        ) : (
          items.map((name) => (
            <div
              key={name}
              className={clsx(
                'group flex items-center justify-between gap-2 rounded-md px-2.5 py-1.5 text-sm cursor-pointer',
                selected === name
                  ? 'bg-blue-50 dark:bg-blue-500/15 text-blue-700 dark:text-blue-300'
                  : 'hover:bg-gray-50 dark:hover:bg-slate-800/60 text-gray-800 dark:text-slate-200'
              )}
              onClick={() => onSelect(name)}
            >
              <span className="flex items-center gap-1.5 truncate">
                {name}
                {selected === name && <ChevronRight className="w-3.5 h-3.5 shrink-0" />}
              </span>
              {canEdit && (
                <button
                  type="button"
                  onClick={(e) => { e.stopPropagation(); onRemove(name); }}
                  className="opacity-0 group-hover:opacity-100 rounded p-0.5 text-gray-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20"
                  aria-label={`Remove ${name}`}
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
          ))
        )}
      </div>
      {canEdit && !disabled && (
        <div className="flex items-center gap-1.5 p-1.5 border-t border-gray-100 dark:border-slate-800">
          <input
            className="flex-1 rounded-md border border-gray-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-2 py-1 text-sm text-slate-900 dark:text-slate-100 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
            placeholder={placeholder.add}
            value={draftValue}
            onChange={onDraftChange}
            onKeyDown={onKey(onAdd)}
          />
          <Button type="button" size="sm" onClick={onAdd}><Plus className="w-4 h-4" /> Add</Button>
        </div>
      )}
    </div>
  );
}

// Global Country → State → City master editor. Feeds the location dropdowns on
// the hospital and company-identity forms. Same drill-down UX as the tenant app.
function LocationsCard({ canEdit }) {
  const [tree, setTree] = useState([]);
  const [selCountry, setSelCountry] = useState('');
  const [selState, setSelState] = useState('');
  const [drafts, setDrafts] = useState({ country: '', state: '', city: '' });
  const [loading, setLoading] = useState(false);
  const [fetching, setFetching] = useState(true);

  useEffect(() => {
    let cancelled = false;
    api.get(endpoints.settings.locations)
      .then((res) => {
        if (cancelled) return;
        const list = Array.isArray(res.data?.data) ? res.data.data : (Array.isArray(res.data) ? res.data : []);
        setTree(list);
        setSelCountry(list[0]?.name || '');
      })
      .catch((err) => { if (!cancelled) toast.error(extractServerError(err, 'Failed to load locations')); })
      .finally(() => { if (!cancelled) setFetching(false); });
    return () => { cancelled = true; };
  }, []);

  const states = tree.find((c) => c.name === selCountry)?.states || [];
  const cities = states.find((s) => s.name === selState)?.cities || [];
  const setDraft = (k) => (e) => setDrafts((d) => ({ ...d, [k]: e.target.value }));
  const exists = (list, name) => list.some((n) => n.toLowerCase() === name.toLowerCase());
  const onKey = (fn) => (e) => { if (e.key === 'Enter') { e.preventDefault(); fn(); } };

  const addCountry = () => {
    const name = drafts.country.trim();
    if (!name) return;
    if (exists(tree.map((c) => c.name), name)) return toast.error(`"${name}" already exists`);
    setTree((t) => [...t, { name, states: [] }]);
    setSelCountry(name); setSelState('');
    setDrafts((d) => ({ ...d, country: '' }));
  };
  const removeCountry = (name) => {
    setTree((t) => t.filter((c) => c.name !== name));
    if (selCountry === name) { setSelCountry(''); setSelState(''); }
  };
  const addState = () => {
    const name = drafts.state.trim();
    if (!name || !selCountry) return;
    if (exists(states.map((s) => s.name), name)) return toast.error(`"${name}" already exists`);
    setTree((t) => t.map((c) => c.name === selCountry ? { ...c, states: [...c.states, { name, cities: [] }] } : c));
    setSelState(name);
    setDrafts((d) => ({ ...d, state: '' }));
  };
  const removeState = (name) => {
    setTree((t) => t.map((c) => c.name === selCountry ? { ...c, states: c.states.filter((s) => s.name !== name) } : c));
    if (selState === name) setSelState('');
  };
  const addCity = () => {
    const name = drafts.city.trim();
    if (!name || !selState) return;
    if (exists(cities, name)) return toast.error(`"${name}" already exists`);
    setTree((t) => t.map((c) => c.name === selCountry
      ? { ...c, states: c.states.map((s) => s.name === selState ? { ...s, cities: [...s.cities, name] } : s) }
      : c));
    setDrafts((d) => ({ ...d, city: '' }));
  };
  const removeCity = (name) => {
    setTree((t) => t.map((c) => c.name === selCountry
      ? { ...c, states: c.states.map((s) => s.name === selState ? { ...s, cities: s.cities.filter((ct) => ct !== name) } : s) }
      : c));
  };

  const handleSave = async () => {
    setLoading(true);
    try {
      const res = await api.put(endpoints.settings.updateLocations, { locations: tree });
      const saved = Array.isArray(res.data?.data) ? res.data.data : (Array.isArray(res.data) ? res.data : []);
      setTree(saved);
      if (!saved.some((c) => c.name === selCountry)) { setSelCountry(saved[0]?.name || ''); setSelState(''); }
      toast.success('Locations saved');
    } catch (err) {
      toast.error(extractServerError(err, 'Failed to save locations'));
    } finally {
      setLoading(false);
    }
  };

  const totalStates = tree.reduce((n, c) => n + (c.states?.length || 0), 0);
  const totalCities = tree.reduce((n, c) => n + (c.states || []).reduce((m, s) => m + (s.cities?.length || 0), 0), 0);

  return (
    <Card className="p-5 lg:col-span-2">
      <div className="flex items-center gap-3 mb-1">
        <div className="w-8 h-8 bg-blue-100 dark:bg-blue-500/20 rounded-lg flex items-center justify-center">
          <MapPin className="w-4 h-4 text-blue-600 dark:text-blue-300" />
        </div>
        <h2 className="text-base font-semibold text-gray-900 dark:text-slate-100">Locations</h2>
      </div>
      <p className="text-xs text-gray-500 dark:text-slate-400 mb-4">
        Global Country / State / City list feeding the dropdowns on hospital and
        billing forms. Pick a country to edit its states, then a state to edit its cities.
      </p>
      {fetching ? (
        <div className="py-10 flex justify-center"><Spinner size="md" /></div>
      ) : (
        <>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <LocationListPanel
              title="Countries"
              items={tree.map((c) => c.name)}
              selected={selCountry}
              onSelect={(n) => { setSelCountry(n); setSelState(''); }}
              onRemove={removeCountry}
              canEdit={canEdit}
              draftValue={drafts.country}
              onDraftChange={setDraft('country')}
              onAdd={addCountry}
              onKey={onKey}
              placeholder={{ add: 'Add country', empty: '' }}
            />
            <LocationListPanel
              title={selCountry ? `States · ${selCountry}` : 'States'}
              items={states.map((s) => s.name)}
              selected={selState}
              onSelect={setSelState}
              onRemove={removeState}
              canEdit={canEdit}
              draftValue={drafts.state}
              onDraftChange={setDraft('state')}
              onAdd={addState}
              onKey={onKey}
              placeholder={{ add: 'Add state', empty: 'Select a country first' }}
              disabled={!selCountry}
            />
            <div className="rounded-lg border border-gray-200 dark:border-slate-700 flex flex-col min-h-[16rem]">
              <div className="px-3 py-2 border-b border-gray-100 dark:border-slate-800 text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-slate-400">
                {selState ? `Cities · ${selState}` : 'Cities'}
              </div>
              <div className="flex-1 overflow-y-auto max-h-72 p-2">
                {!selState ? (
                  <p className="text-xs text-gray-400 dark:text-slate-500 italic px-1 py-2">Select a state first</p>
                ) : cities.length === 0 ? (
                  <p className="text-xs text-gray-400 dark:text-slate-500 italic px-1 py-2">No cities yet.</p>
                ) : (
                  <div className="flex flex-wrap gap-1.5">
                    {cities.map((name) => (
                      <span key={name} className="inline-flex items-center gap-1.5 rounded-full border border-gray-200 dark:border-slate-700 bg-gray-50 dark:bg-slate-800/60 px-2.5 py-1 text-sm text-gray-800 dark:text-slate-200">
                        {name}
                        {canEdit && (
                          <button type="button" onClick={() => removeCity(name)} className="rounded-full p-0.5 text-gray-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20" aria-label={`Remove ${name}`}>
                            <X className="w-3 h-3" />
                          </button>
                        )}
                      </span>
                    ))}
                  </div>
                )}
              </div>
              {canEdit && selState && (
                <div className="flex items-center gap-1.5 p-1.5 border-t border-gray-100 dark:border-slate-800">
                  <input
                    className="flex-1 rounded-md border border-gray-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-2 py-1 text-sm text-slate-900 dark:text-slate-100 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="Add city"
                    value={drafts.city}
                    onChange={setDraft('city')}
                    onKeyDown={onKey(addCity)}
                  />
                  <Button type="button" size="sm" onClick={addCity}><Plus className="w-4 h-4" /> Add</Button>
                </div>
              )}
            </div>
          </div>
          {canEdit && (
            <div className="mt-6 flex items-center gap-3">
              <Button onClick={handleSave} loading={loading}>Save Locations</Button>
              <span className="text-xs text-gray-400 dark:text-slate-500">
                {tree.length} countries · {totalStates} states · {totalCities} cities
              </span>
            </div>
          )}
        </>
      )}
    </Card>
  );
}

export default function SettingsPage() {
  const { user, updateUser, isSuperAdmin } = useAuth();

  return (
    <div className="space-y-6">
      <p className="text-base text-gray-600 dark:text-slate-400">
        Manage your profile and platform configuration
      </p>

      <ThemeSettings />

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <ProfileCard user={user} updateUser={updateUser} />
        <PasswordCard />
        <PlatformCard canEdit={isSuperAdmin} />
        <AbdmCard canEdit={isSuperAdmin} />
        <BillingCard canEdit={isSuperAdmin} />
        <PaymentsCard canEdit={isSuperAdmin} />
        <OrgnestInvoicingCard canEdit={isSuperAdmin} />
        <FirebasePushCard canEdit={isSuperAdmin} />
        <LocationsCard canEdit={isSuperAdmin} />
      </div>
    </div>
  );
}

function AbdmCard({ canEdit }) {
  const [loading, setLoading] = useState(false);
  const [fetching, setFetching] = useState(true);
  const {
    register,
    handleSubmit,
    reset,
    control,
    setError,
    formState: { errors, isDirty },
  } = useForm({
    resolver: zodResolver(abdmSchema),
    defaultValues: {
      abdmEnabled: false,
      abdmClientId: '',
      abdmClientSecret: '',
      abdmGatewayBaseUrl: 'https://dev.abdm.gov.in/gateway',
      abdmAbhaBaseUrl: 'https://abhasbx.abdm.gov.in/abha/api/v3',
      abdmHfrBaseUrl: 'https://facilitysbx.abdm.gov.in',
      abdmHprBaseUrl: 'https://hprsbx.abdm.gov.in',
    },
  });

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await api.get(endpoints.settings.platform);
        const data = res.data?.data || res.data || {};
        if (cancelled) return;
        reset({
          abdmEnabled: Boolean(data.abdmEnabled),
          abdmClientId: data.abdmClientId ?? '',
          abdmClientSecret: data.abdmClientSecret ?? '',
          abdmGatewayBaseUrl: data.abdmGatewayBaseUrl ?? 'https://dev.abdm.gov.in/gateway',
          abdmAbhaBaseUrl: data.abdmAbhaBaseUrl ?? 'https://abhasbx.abdm.gov.in/abha/api/v3',
          abdmHfrBaseUrl: data.abdmHfrBaseUrl ?? 'https://facilitysbx.abdm.gov.in',
          abdmHprBaseUrl: data.abdmHprBaseUrl ?? 'https://hprsbx.abdm.gov.in',
        });
      } catch (err) {
        if (!cancelled) toast.error(extractServerError(err, 'Failed to load ABDM settings'));
      } finally {
        if (!cancelled) setFetching(false);
      }
    })();
    return () => { cancelled = true; };
  }, [reset]);

  const onSubmit = async (data) => {
    setLoading(true);
    try {
      const res = await api.put(endpoints.settings.updatePlatform, data);
      const updated = res.data?.data || res.data || data;
      const next = {
        abdmEnabled: Boolean(updated.abdmEnabled),
        abdmClientId: updated.abdmClientId ?? '',
        abdmClientSecret: updated.abdmClientSecret ?? '',
        abdmGatewayBaseUrl: updated.abdmGatewayBaseUrl ?? 'https://dev.abdm.gov.in/gateway',
        abdmAbhaBaseUrl: updated.abdmAbhaBaseUrl ?? 'https://abhasbx.abdm.gov.in/abha/api/v3',
        abdmHfrBaseUrl: updated.abdmHfrBaseUrl ?? 'https://facilitysbx.abdm.gov.in',
        abdmHprBaseUrl: updated.abdmHprBaseUrl ?? 'https://hprsbx.abdm.gov.in',
      };
      reset(next);
      toast.success('ABDM platform settings updated');
    } catch (err) {
      const msg = extractServerError(err, 'Failed to update ABDM settings');
      const fieldErrors = err?.response?.data?.errors;
      if (Array.isArray(fieldErrors)) {
        fieldErrors.forEach((e) => e.field && setError(e.field, { type: 'server', message: e.message }));
      }
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card className="p-5 lg:col-span-2">
      <div className="flex items-center gap-3 mb-1">
        <div className="w-8 h-8 bg-teal-100 dark:bg-teal-500/20 rounded-lg flex items-center justify-center">
          <ShieldCheck className="w-4 h-4 text-teal-600 dark:text-teal-300" />
        </div>
        <h2 className="text-base font-semibold text-gray-900 dark:text-slate-100">ABDM Gateway</h2>
      </div>
      <p className="text-xs text-gray-500 dark:text-slate-400 mb-4">
        Enables NHA gateway calls for HFR verification, ABHA, HPR, consent, and Health Locker pushes across hospitals.
      </p>
      {fetching ? (
        <div className="py-10 flex justify-center"><Spinner size="md" /></div>
      ) : (
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4" noValidate>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Controller
              control={control}
              name="abdmEnabled"
              render={({ field }) => (
                <Select
                  label="ABDM Status"
                  options={NOTIFICATION_OPTIONS}
                  value={field.value}
                  onChange={field.onChange}
                  onBlur={field.onBlur}
                  error={errors.abdmEnabled?.message}
                />
              )}
            />
            <Input label="Client ID" error={errors.abdmClientId?.message} {...register('abdmClientId')} />
            <Input label="Client Secret" type="password" error={errors.abdmClientSecret?.message} {...register('abdmClientSecret')} />
            <Input label="Gateway Base URL" error={errors.abdmGatewayBaseUrl?.message} {...register('abdmGatewayBaseUrl')} />
            <Input label="ABHA Base URL" error={errors.abdmAbhaBaseUrl?.message} {...register('abdmAbhaBaseUrl')} />
            <Input label="HFR Base URL" error={errors.abdmHfrBaseUrl?.message} {...register('abdmHfrBaseUrl')} />
            <Input label="HPR Base URL" error={errors.abdmHprBaseUrl?.message} {...register('abdmHprBaseUrl')} />
          </div>
          {canEdit && (
            <div className="flex justify-end">
              <Button type="submit" loading={loading} disabled={!isDirty || loading}>Save ABDM Settings</Button>
            </div>
          )}
        </form>
      )}
    </Card>
  );
}

function BillingCard({ canEdit }) {
  const [loading, setLoading] = useState(false);
  const [fetching, setFetching] = useState(true);
  const { data: locations } = useFetch(endpoints.settings.locations);
  const {
    register,
    handleSubmit,
    reset,
    watch,
    setValue,
    formState: { errors, isDirty },
  } = useForm({
    resolver: zodResolver(billingSchema),
    defaultValues: {
      companyName: '', companyGstin: '', companyPan: '', companyAddress: '',
      companyState: '', companyPincode: '', companyCountry: 'India',
      defaultGstRate: 18, defaultHsnCode: '998314', invoicePrefix: 'INV-',
    },
  });

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await api.get(endpoints.settings.platform);
        const data = res.data?.data || res.data || {};
        if (cancelled) return;
        reset({
          companyName: data.companyName ?? '',
          companyGstin: data.companyGstin ?? '',
          companyPan: data.companyPan ?? '',
          companyAddress: data.companyAddress ?? '',
          companyState: data.companyState ?? '',
          companyPincode: data.companyPincode ?? '',
          companyCountry: data.companyCountry ?? 'India',
          defaultGstRate: Number(data.defaultGstRate ?? 18),
          defaultHsnCode: data.defaultHsnCode ?? '998314',
          invoicePrefix: data.invoicePrefix ?? 'INV-',
        });
      } catch (err) {
        if (!cancelled) toast.error(extractServerError(err, 'Failed to load billing settings'));
      } finally {
        if (!cancelled) setFetching(false);
      }
    })();
    return () => { cancelled = true; };
  }, [reset]);

  const onSubmit = async (data) => {
    setLoading(true);
    try {
      await api.put(endpoints.settings.updatePlatform, data);
      toast.success('Billing identity updated');
      reset(data);
    } catch (err) {
      toast.error(extractServerError(err, 'Failed to update billing settings'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card className="p-5 lg:col-span-2">
      <div className="flex items-center gap-3 mb-1">
        <div className="w-8 h-8 bg-emerald-100 dark:bg-emerald-500/20 rounded-lg flex items-center justify-center">
          <Receipt className="w-4 h-4 text-emerald-600 dark:text-emerald-300" />
        </div>
        <h2 className="text-base font-semibold text-gray-900 dark:text-slate-100">Invoice / GST Identity</h2>
      </div>
      <p className="text-xs text-gray-500 dark:text-slate-400 mb-4">
        Printed on every tax invoice. CGST/SGST vs IGST is decided by comparing your company state to the customer's state.
      </p>
      {fetching ? (
        <div className="py-10 flex justify-center"><Spinner size="md" /></div>
      ) : (
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4" noValidate>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Input label="Company Name" error={errors.companyName?.message} {...register('companyName')} />
            <Input label="GSTIN" placeholder="22AAAAA0000A1Z5" error={errors.companyGstin?.message} {...register('companyGstin')} />
            <Input label="PAN" placeholder="ABCDE1234F" error={errors.companyPan?.message} {...register('companyPan')} />
            <div className="sm:col-span-2">
              <Input label="Registered Address" error={errors.companyAddress?.message} {...register('companyAddress')} />
            </div>
            <LocationSelect
              locations={locations}
              showCity={false}
              country={watch('companyCountry')}
              state={watch('companyState')}
              errors={{ country: errors.companyCountry?.message, state: errors.companyState?.message }}
              onChange={({ country, state }) => {
                setValue('companyCountry', country, { shouldDirty: true });
                setValue('companyState', state, { shouldDirty: true });
              }}
            />
            <Input label="Pincode" error={errors.companyPincode?.message} {...register('companyPincode')} />
            <Input label="Default GST Rate (%)" type="number" step="0.01" error={errors.defaultGstRate?.message} {...register('defaultGstRate')} />
            <Input label="Default HSN/SAC Code" error={errors.defaultHsnCode?.message} {...register('defaultHsnCode')} />
            <Input label="Invoice Prefix" error={errors.invoicePrefix?.message} {...register('invoicePrefix')} />
          </div>
          {canEdit && (
            <div className="flex justify-end">
              <Button type="submit" loading={loading} disabled={!isDirty || loading}>Save Billing Settings</Button>
            </div>
          )}
        </form>
      )}
    </Card>
  );
}

function ProfileCard({ user, updateUser }) {
  const [loading, setLoading] = useState(false);
  const [fetching, setFetching] = useState(true);
  const {
    register,
    handleSubmit,
    reset,
    setError,
    formState: { errors, isDirty },
  } = useForm({
    resolver: zodResolver(profileSchema),
    defaultValues: { name: '', email: '', phone: '' },
  });

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await api.get(endpoints.settings.profile);
        const data = res.data?.data || res.data || {};
        if (cancelled) return;
        reset({ name: data.name || '', email: data.email || '', phone: data.phone || '' });
      } catch (err) {
        if (!cancelled) {
          reset({ name: user?.name || '', email: user?.email || '', phone: user?.phone || '' });
          toast.error(extractServerError(err, 'Failed to load profile'));
        }
      } finally {
        if (!cancelled) setFetching(false);
      }
    })();
    return () => { cancelled = true; };
  }, [reset, user?.name, user?.email, user?.phone]);

  const onSubmit = async (data) => {
    setLoading(true);
    try {
      const payload = { name: data.name.trim(), email: data.email.trim(), phone: data.phone?.trim() || null };
      const res = await api.put(endpoints.settings.updateProfile, payload);
      const updated = res.data?.data || res.data;
      updateUser({ ...user, ...updated });
      reset({ name: updated.name || '', email: updated.email || '', phone: updated.phone || '' });
      toast.success('Profile updated');
    } catch (err) {
      const msg = extractServerError(err, 'Failed to update profile');
      const fieldErrors = err?.response?.data?.errors;
      if (Array.isArray(fieldErrors)) {
        fieldErrors.forEach((e) => e.field && setError(e.field, { type: 'server', message: e.message }));
      }
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card className="p-5">
      <div className="flex items-center gap-3 mb-4">
        <div className="w-8 h-8 bg-blue-100 dark:bg-blue-500/20 rounded-lg flex items-center justify-center">
          <User className="w-4 h-4 text-blue-600 dark:text-blue-300" />
        </div>
        <h2 className="text-base font-semibold text-gray-900 dark:text-slate-100">Profile</h2>
      </div>
      {fetching ? (
        <div className="py-10 flex justify-center"><Spinner size="md" /></div>
      ) : (
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4" noValidate>
          <Input label="Full Name" error={errors.name?.message} {...register('name')} />
          <Input label="Email" type="email" error={errors.email?.message} {...register('email')} />
          <Input label="Phone" placeholder="+91 98765 43210" error={errors.phone?.message} {...register('phone')} />
          <div className="flex justify-end">
            <Button type="submit" loading={loading} disabled={!isDirty || loading}>Save Changes</Button>
          </div>
        </form>
      )}
    </Card>
  );
}

function PasswordCard() {
  const [loading, setLoading] = useState(false);
  const {
    register,
    handleSubmit,
    reset,
    setError,
    formState: { errors },
  } = useForm({
    resolver: zodResolver(passwordSchema),
    defaultValues: { currentPassword: '', newPassword: '', confirmPassword: '' },
  });

  const onSubmit = async (data) => {
    setLoading(true);
    try {
      await api.put(endpoints.settings.changePassword, {
        currentPassword: data.currentPassword,
        newPassword: data.newPassword,
      });
      toast.success('Password updated');
      reset();
    } catch (err) {
      const msg = extractServerError(err, 'Failed to update password');
      const fieldErrors = err?.response?.data?.errors;
      if (Array.isArray(fieldErrors)) {
        fieldErrors.forEach((e) => e.field && setError(e.field, { type: 'server', message: e.message }));
      } else if (/current password/i.test(msg)) {
        setError('currentPassword', { type: 'server', message: msg });
      }
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card className="p-5">
      <div className="flex items-center gap-3 mb-4">
        <div className="w-8 h-8 bg-yellow-100 dark:bg-yellow-500/20 rounded-lg flex items-center justify-center">
          <Lock className="w-4 h-4 text-yellow-600 dark:text-yellow-300" />
        </div>
        <h2 className="text-base font-semibold text-gray-900 dark:text-slate-100">Change Password</h2>
      </div>
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4" noValidate>
        <Input label="Current Password" type="password" autoComplete="current-password" error={errors.currentPassword?.message} {...register('currentPassword')} />
        <Input label="New Password" type="password" autoComplete="new-password" error={errors.newPassword?.message} {...register('newPassword')} />
        <Input label="Confirm Password" type="password" autoComplete="new-password" error={errors.confirmPassword?.message} {...register('confirmPassword')} />
        <div className="flex justify-end">
          <Button type="submit" loading={loading} disabled={loading}>Update Password</Button>
        </div>
      </form>
    </Card>
  );
}

function PlatformCard({ canEdit }) {
  const [loading, setLoading] = useState(false);
  const [fetching, setFetching] = useState(true);
  const { refresh: refreshPlatform } = usePlatformSettings();
  const {
    register,
    handleSubmit,
    reset,
    control,
    setError,
    formState: { errors, isDirty },
  } = useForm({
    resolver: zodResolver(platformSchema),
    defaultValues: {
      platformName: '',
      supportEmail: '',
      timezone: 'Asia/Kolkata',
      currency: 'INR',
      defaultTrialDays: 14,
      emailNotifications: true,
      maintenanceMode: false,
      allowNewSignups: true,
    },
  });

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await api.get(endpoints.settings.platform);
        const data = res.data?.data || res.data || {};
        if (cancelled) return;
        reset({
          platformName: data.platformName ?? '',
          supportEmail: data.supportEmail ?? '',
          timezone: data.timezone ?? 'Asia/Kolkata',
          currency: data.currency ?? 'INR',
          defaultTrialDays: Number(data.defaultTrialDays ?? 14),
          emailNotifications: Boolean(data.emailNotifications),
          maintenanceMode: Boolean(data.maintenanceMode),
          allowNewSignups: Boolean(data.allowNewSignups),
        });
      } catch (err) {
        if (!cancelled) toast.error(extractServerError(err, 'Failed to load platform settings'));
      } finally {
        if (!cancelled) setFetching(false);
      }
    })();
    return () => { cancelled = true; };
  }, [reset]);

  const onSubmit = async (data) => {
    setLoading(true);
    try {
      const res = await api.put(endpoints.settings.updatePlatform, data);
      const updated = res.data?.data || res.data || data;
      reset({
        platformName: updated.platformName ?? '',
        supportEmail: updated.supportEmail ?? '',
        timezone: updated.timezone ?? 'Asia/Kolkata',
        currency: updated.currency ?? 'INR',
        defaultTrialDays: Number(updated.defaultTrialDays ?? 14),
        emailNotifications: Boolean(updated.emailNotifications),
        maintenanceMode: Boolean(updated.maintenanceMode),
        allowNewSignups: Boolean(updated.allowNewSignups),
      });
      toast.success('Platform settings updated');
      await refreshPlatform();
      // Reload so all already-rendered components re-fetch and reformat with the new currency
      setTimeout(() => window.location.reload(), 600);
    } catch (err) {
      const msg = extractServerError(err, 'Failed to update settings');
      const fieldErrors = err?.response?.data?.errors;
      if (Array.isArray(fieldErrors)) {
        fieldErrors.forEach((e) => e.field && setError(e.field, { type: 'server', message: e.message }));
      }
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card className="p-5 lg:col-span-2">
      <div className="flex items-center gap-3 mb-4">
        <div className="w-8 h-8 bg-purple-100 dark:bg-purple-500/20 rounded-lg flex items-center justify-center">
          <Settings className="w-4 h-4 text-purple-600 dark:text-purple-300" />
        </div>
        <h2 className="text-base font-semibold text-gray-900 dark:text-slate-100">Platform Settings</h2>
      </div>
      {fetching ? (
        <div className="py-10 flex justify-center"><Spinner size="md" /></div>
      ) : (
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4" noValidate>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Input label="Platform Name" error={errors.platformName?.message} {...register('platformName')} />
            <Input label="Support Email" type="email" error={errors.supportEmail?.message} {...register('supportEmail')} />
            <Input label="Timezone" error={errors.timezone?.message} {...register('timezone')} />
            <Controller
              control={control}
              name="currency"
              render={({ field }) => (
                <Select
                  label="Currency"
                  options={CURRENCY_OPTIONS}
                  value={field.value}
                  onChange={field.onChange}
                  onBlur={field.onBlur}
                  error={errors.currency?.message}
                />
              )}
            />
            <Input
              label="Default Trial Days"
              type="number"
              min={0}
              max={365}
              error={errors.defaultTrialDays?.message}
              {...register('defaultTrialDays')}
            />
            <Controller
              control={control}
              name="maintenanceMode"
              render={({ field }) => (
                <Select
                  label="Maintenance Mode"
                  options={MAINTENANCE_OPTIONS}
                  value={field.value}
                  onChange={field.onChange}
                  onBlur={field.onBlur}
                  error={errors.maintenanceMode?.message}
                />
              )}
            />
            <Controller
              control={control}
              name="emailNotifications"
              render={({ field }) => (
                <Select
                  label="Email Notifications"
                  options={NOTIFICATION_OPTIONS}
                  value={field.value}
                  onChange={field.onChange}
                  onBlur={field.onBlur}
                  error={errors.emailNotifications?.message}
                />
              )}
            />
            <Controller
              control={control}
              name="allowNewSignups"
              render={({ field }) => (
                <Select
                  label="Allow New Signups"
                  options={SIGNUP_OPTIONS}
                  value={field.value}
                  onChange={field.onChange}
                  onBlur={field.onBlur}
                  error={errors.allowNewSignups?.message}
                />
              )}
            />
          </div>
          {canEdit && (
            <div className="flex justify-end">
              <Button type="submit" loading={loading} disabled={!isDirty || loading}>Save Platform Settings</Button>
            </div>
          )}
        </form>
      )}
    </Card>
  );
}
