import { useEffect, useState } from 'react';
import { useForm, Controller } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import toast from 'react-hot-toast';
import api from '../../api/axios';
import endpoints from '../../api/endpoints';
import Modal from '../../components/ui/Modal';
import Input from '../../components/ui/Input';
import DatePicker from '../../components/ui/DatePicker';
import Select from '../../components/ui/Select';
import LocationSelect from '../../components/LocationSelect';
import Button from '../../components/ui/Button';
import { nameField, optionalNameField, optionalPhoneField, pincodeField, blockDigits, allowDigitsOnly, allowPhoneChars } from '../../utils/validators';

const SLUG_REGEX = /^[a-z0-9]+(-[a-z0-9]+)*$/;

const schema = z.object({
  name: nameField('Hospital name'),
  slug: z
    .string()
    .min(2, 'Min 2 characters')
    .max(50, 'Max 50 characters')
    .regex(SLUG_REGEX, 'Lowercase letters, digits and hyphens only (e.g. huda-hospitals)')
    .optional()
    .or(z.literal('')),
  // Email is optional — a hospital can be onboarded with just a phone, and the
  // admin then signs in with that mobile. At least one of email/phone is
  // required (enforced by the .refine below).
  email: z.string().email('Invalid email').optional().or(z.literal('')),
  phone: optionalPhoneField(),
  address: z.string().min(5, 'Address is required'),
  country: z.string().optional().or(z.literal('')),
  city: nameField('City'),
  state: nameField('State'),
  pincode: pincodeField(),
  planId: z.string().min(1, 'Please select a plan'),
  planStartDate: z.string().optional().or(z.literal('')),
  planEndDate: z.string().optional().or(z.literal('')),
  gstin: z.string().optional().or(z.literal('')),
  isActive: z.boolean().optional(),
  isTrial: z.boolean().optional(),
  trialEndsAt: z.string().optional().or(z.literal('')),
  // One-time setup cost raised on the revenue ledger at onboarding. Free text
  // from a number input; validated below so blank means "no setup fee".
  setupFee: z.string().optional().or(z.literal('')),
  adminName: optionalNameField('Admin name'),
  adminEmail: z.string().email('Invalid admin email').optional().or(z.literal('')),
  adminPassword: z.string().min(6, 'Min 6 characters').optional().or(z.literal('')),
}).refine(
  (d) => !d.planStartDate || !d.planEndDate || d.planEndDate > d.planStartDate,
  { message: 'End date must be after the start date', path: ['planEndDate'] },
).refine(
  // The admin login needs an identity: require an email or a phone (either one
  // becomes the admin's sign-in credential).
  (d) => (d.email && d.email.trim()) || (d.phone && d.phone.trim()),
  { message: 'Provide an email or a phone number', path: ['email'] },
).refine(
  (d) => !d.setupFee || (Number.isFinite(Number(d.setupFee)) && Number(d.setupFee) >= 0),
  { message: 'Setup fee must be 0 or more', path: ['setupFee'] },
);

function deriveSlug(name) {
  return String(name || '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '');
}

const STATUS_OPTIONS = [
  { value: 'active', label: 'Active' },
  { value: 'suspended', label: 'Suspended' },
];

export default function HospitalForm({ isOpen, onClose, hospital, onSuccess }) {
  const [loading, setLoading] = useState(false);
  const [plans, setPlans] = useState([]);
  const [locations, setLocations] = useState([]);
  const [fullHospital, setFullHospital] = useState(null);
  const isEditing = !!hospital;

  const {
    register,
    control,
    handleSubmit,
    reset,
    watch,
    setValue,
    formState: { errors },
  } = useForm({
    resolver: zodResolver(schema),
    defaultValues: {
      name: '', slug: '', email: '', phone: '', address: '', country: 'India', city: '', state: '', pincode: '',
      planId: '', planStartDate: '', planEndDate: '', gstin: '', isActive: true, isTrial: false, trialEndsAt: '', setupFee: '',
      adminName: '', adminEmail: '', adminPassword: '',
    },
  });

  const statusValue = watch('isActive') ? 'active' : 'suspended';
  const nameValue = watch('name');
  const planIdValue = watch('planId');
  const [slugTouched, setSlugTouched] = useState(false);
  const [datesTouched, setDatesTouched] = useState(false);
  const [setupFeeTouched, setSetupFeeTouched] = useState(false);

  // Pre-fill the one-time setup fee from the selected plan on create until the
  // operator edits it. Blank = no setup fee is raised.
  useEffect(() => {
    if (isEditing || setupFeeTouched) return;
    const plan = plans.find((p) => p.value === planIdValue);
    if (!plan) return;
    const fee = Number(plan.setupFee || 0);
    setValue('setupFee', fee > 0 ? String(fee) : '', { shouldValidate: false });
  }, [planIdValue, plans, isEditing, setupFeeTouched, setValue]);

  // Auto-fill slug from name on create until the user types in the slug field.
  useEffect(() => {
    if (isEditing || slugTouched) return;
    setValue('slug', deriveSlug(nameValue), { shouldValidate: false });
  }, [nameValue, isEditing, slugTouched, setValue]);

  // Default the subscription period from the selected plan's duration
  // (start = today, end = today + durationInDays) until the operator edits a
  // date. On edit the existing period is loaded and marked touched below.
  useEffect(() => {
    if (datesTouched) return;
    const plan = plans.find((p) => p.value === planIdValue);
    if (!plan) return;
    const start = new Date();
    const end = new Date(start);
    end.setDate(end.getDate() + (Number(plan.durationInDays) || 30));
    setValue('planStartDate', start.toISOString().slice(0, 10), { shouldValidate: false });
    setValue('planEndDate', end.toISOString().slice(0, 10), { shouldValidate: false });
  }, [planIdValue, plans, datesTouched, setValue]);

  useEffect(() => {
    if (isOpen) {
      api.get(endpoints.plans.list, { params: { limit: 100 } })
        .then((res) => {
          const d = res.data.data || res.data;
          const list = d.plans || d.rows || d.items || (Array.isArray(d) ? d : []);
          setPlans(list.map((p) => ({ value: p.id || p._id, label: p.name, durationInDays: p.durationInDays, setupFee: p.setupFee })));
        })
        .catch(() => { toast.error('Could not load plans'); setPlans([]); });
      api.get(endpoints.settings.locations)
        .then((res) => {
          const list = res.data.data || res.data;
          setLocations(Array.isArray(list) ? list : []);
        })
        .catch(() => setLocations([]));
    }
  }, [isOpen]);

  useEffect(() => {
    if (isOpen && hospital) {
      api.get(endpoints.hospitals.get(hospital.id || hospital._id))
        .then((res) => setFullHospital(res.data.data || res.data))
        .catch(() => { toast.error('Could not load full hospital details'); setFullHospital(hospital); });
    } else {
      setFullHospital(null);
    }
  }, [isOpen, hospital]);

  useEffect(() => {
    const source = fullHospital || hospital;
    if (source && isEditing) {
      // Prefill the plan period from the current active subscription so editing
      // shows the real dates rather than re-defaulting from the plan duration.
      const activeSub = (source.subscriptions || []).find((s) => s.status === 'active')
        || (source.subscriptions || [])[0] || null;
      const toDate = (d) => (d ? new Date(d).toISOString().slice(0, 10) : '');
      setDatesTouched(true);
      reset({
        name: source.name || '',
        slug: source.slug || '',
        email: source.email || '',
        phone: source.phone || '',
        address: source.address || '',
        country: source.country || 'India',
        city: source.city || '',
        state: source.state || '',
        pincode: source.pincode || '',
        planId: source.planId || source.plan?.id || source.plan?._id || '',
        planStartDate: toDate(activeSub?.startDate),
        planEndDate: toDate(activeSub?.endDate),
        gstin: source.gstin || '',
        isActive: source.isActive !== undefined ? !!source.isActive : (source.status !== 'suspended'),
        isTrial: !!source.isTrial,
        trialEndsAt: source.trialEndsAt ? new Date(source.trialEndsAt).toISOString().slice(0, 10) : '',
        setupFee: '',
        // Older tenants may not have an explicit `admin` row returned by the
        // backend — fall back to the hospital's own contact name/email so the
        // form is never blank on edit.
        adminName: source.admin?.name || source.adminName || source.name || '',
        adminEmail: source.admin?.email || source.adminEmail || source.email || '',
        adminPassword: '',
      });
    } else if (!isEditing) {
      reset({
        name: '', slug: '', email: '', phone: '', address: '', city: '', state: '', pincode: '',
        planId: '', planStartDate: '', planEndDate: '', gstin: '', isActive: true, isTrial: false, trialEndsAt: '', setupFee: '',
        adminName: '', adminEmail: '', adminPassword: '',
      });
      setSlugTouched(false);
      setDatesTouched(false);
      setSetupFeeTouched(false);
    }
  }, [fullHospital, hospital, isEditing, reset]);

  const onSubmit = async (data) => {
    setLoading(true);
    try {
      if (isEditing) {
        const payload = { ...data };
        // Only send admin password if provided
        if (!payload.adminPassword) delete payload.adminPassword;
        if (!payload.adminName) delete payload.adminName;
        if (!payload.adminEmail) delete payload.adminEmail;
        // Slug is the tenant identifier and cannot change after creation
        delete payload.slug;
        // The setup fee is a ledger charge raised at onboarding, not a hospital attribute
        delete payload.setupFee;
        await api.put(endpoints.hospitals.update(hospital.id || hospital._id), payload);
        toast.success('Hospital updated');
      } else {
        const payload = { ...data };
        if (!payload.slug) delete payload.slug;
        if (payload.setupFee === '' || payload.setupFee === undefined) delete payload.setupFee;
        else payload.setupFee = Number(payload.setupFee);
        await api.post(endpoints.hospitals.create, payload);
        toast.success('Hospital created');
      }
      onSuccess();
      onClose();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to save hospital');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={isEditing ? 'Edit Hospital' : 'Add Hospital'} size="lg">
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <Input
            label="Hospital Name"
            error={errors.name?.message}
            {...register('name')}
            onKeyDown={blockDigits}
          />
          {isEditing ? (
            <Input
              label="Hospital ID (tenant)"
              value={watch('slug') || ''}
              readOnly
              disabled
            />
          ) : (
            <Input
              label="Hospital ID (tenant)"
              placeholder="auto-generated from name (e.g. huda-hospitals)"
              error={errors.slug?.message}
              {...register('slug', {
                onChange: () => setSlugTouched(true),
              })}
            />
          )}
          <Input label="Email (optional)" type="email" error={errors.email?.message} {...register('email')} />
          <Input
            label="Phone"
            inputMode="numeric"
            maxLength={15}
            error={errors.phone?.message}
            {...register('phone')}
            onKeyDown={allowPhoneChars}
          />
          <Controller
            name="planId"
            control={control}
            render={({ field }) => (
              <Select label="Plan" options={plans} placeholder="Select a plan" error={errors.planId?.message} {...field} />
            )}
          />
          {isEditing ? <div /> : (
            <Input
              label="Setup fee (one-time, optional)"
              type="number"
              min="0"
              step="0.01"
              placeholder="raised as an unpaid charge"
              error={errors.setupFee?.message}
              {...register('setupFee', { onChange: () => setSetupFeeTouched(true) })}
            />
          )}
          <Controller
            control={control}
            name="planStartDate"
            render={({ field }) => (
              <DatePicker
                label="Plan Start Date"
                value={field.value}
                onChange={(v) => { setDatesTouched(true); field.onChange(v); }}
                onBlur={field.onBlur}
                error={errors.planStartDate?.message}
              />
            )}
          />
          <Controller
            control={control}
            name="planEndDate"
            render={({ field }) => (
              <DatePicker
                label="Plan End Date"
                value={field.value}
                onChange={(v) => { setDatesTouched(true); field.onChange(v); }}
                onBlur={field.onBlur}
                error={errors.planEndDate?.message}
              />
            )}
          />
          <div className="col-span-2">
            <Input label="Address" error={errors.address?.message} {...register('address')} />
          </div>
          <LocationSelect
            locations={locations}
            country={watch('country')}
            state={watch('state')}
            city={watch('city')}
            errors={{ state: errors.state?.message, city: errors.city?.message }}
            onChange={({ country, state, city }) => {
              setValue('country', country, { shouldDirty: true });
              setValue('state', state, { shouldDirty: true, shouldValidate: true });
              setValue('city', city, { shouldDirty: true, shouldValidate: true });
            }}
          />
          <Input
            label="Pincode"
            inputMode="numeric"
            maxLength={6}
            error={errors.pincode?.message}
            {...register('pincode')}
            onKeyDown={allowDigitsOnly}
          />
          {isEditing && (
            <Select
              label="Status"
              options={STATUS_OPTIONS}
              value={statusValue}
              onChange={(v) => setValue('isActive', v === 'active', { shouldDirty: true })}
            />
          )}
          <Input
            label="GSTIN (for tax invoices)"
            placeholder="22AAAAA0000A1Z5"
            error={errors.gstin?.message}
            {...register('gstin')}
          />
          <div className="flex items-center gap-2 mt-6">
            <input
              id="isTrial"
              type="checkbox"
              {...register('isTrial')}
              className="w-4 h-4"
            />
            <label htmlFor="isTrial" className="text-sm text-gray-700 dark:text-slate-300">On Trial</label>
          </div>
          {watch('isTrial') && (
            <Controller
              control={control}
              name="trialEndsAt"
              render={({ field }) => (
                <DatePicker
                  label="Trial Ends On"
                  value={field.value}
                  onChange={field.onChange}
                  onBlur={field.onBlur}
                  error={errors.trialEndsAt?.message}
                />
              )}
            />
          )}
        </div>

        <hr className="border-gray-200 dark:border-slate-700" />
        <p className="text-sm font-medium text-gray-700 dark:text-slate-200">
          {isEditing ? 'Admin Account' : 'Admin Account'}
          {isEditing && <span className="ml-2 text-xs font-normal text-gray-500 dark:text-slate-400">(leave password empty to keep unchanged)</span>}
        </p>
        <div className="grid grid-cols-2 gap-4">
          <Input
            label="Admin Name"
            error={errors.adminName?.message}
            {...register('adminName')}
            onKeyDown={blockDigits}
          />
          <Input label="Admin Email" type="email" error={errors.adminEmail?.message} {...register('adminEmail')} />
          <Input
            label={isEditing ? 'New Admin Password' : 'Admin Password'}
            type="password"
            placeholder={isEditing ? 'Leave blank to keep current' : ''}
            error={errors.adminPassword?.message}
            {...register('adminPassword')}
          />
        </div>

        <div className="flex justify-end gap-3 pt-4 border-t border-gray-200 dark:border-slate-700">
          <Button variant="secondary" onClick={onClose}>Cancel</Button>
          <Button type="submit" loading={loading}>{isEditing ? 'Update' : 'Create'} Hospital</Button>
        </div>
      </form>
    </Modal>
  );
}
