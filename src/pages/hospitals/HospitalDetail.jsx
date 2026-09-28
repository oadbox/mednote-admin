import { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, Building2, Mail, Phone, MapPin, Calendar, CreditCard, Activity, Hourglass, LogIn, Hash, Receipt, Globe, BadgeCheck, User, Power, KeyRound, Copy, Check, Boxes, Save, Info, Lock, Smartphone, RotateCcw, Trash2, AlertTriangle, ShieldAlert, Wrench } from 'lucide-react';
import dayjs from 'dayjs';
import toast from 'react-hot-toast';
import api from '../../api/axios';
import endpoints from '../../api/endpoints';
import Card from '../../components/ui/Card';
import Badge from '../../components/ui/Badge';
import Button from '../../components/ui/Button';
import Spinner from '../../components/ui/Spinner';
import ConfirmDialog from '../../components/ui/ConfirmDialog';
import Modal from '../../components/ui/Modal';
import Input from '../../components/ui/Input';
import StatCard from '../../components/StatCard';
import { formatCurrency } from '../../utils/formatters';
import { useAuth } from '../../hooks/useAuth';

const HMS_TENANT_URL = import.meta.env.VITE_HMS_URL || 'http://localhost:7006';

export default function HospitalDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { isSuperAdmin } = useAuth();
  const [hospital, setHospital] = useState(null);
  const [stats, setStats] = useState(null);
  const [subscriptions, setSubscriptions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [impersonateOpen, setImpersonateOpen] = useState(false);
  const [impersonating, setImpersonating] = useState(false);
  const [resetOpen, setResetOpen] = useState(false);
  const [resetting, setResetting] = useState(false);
  const [newPassword, setNewPassword] = useState('');
  const [resetResult, setResetResult] = useState(null); // { tempPassword, email } after a successful reset
  const [copied, setCopied] = useState(false);

  const closeResetDialog = () => {
    if (resetting) return;
    setResetOpen(false);
    setNewPassword('');
    setResetResult(null);
    setCopied(false);
  };

  const resetAdminPassword = async () => {
    if (newPassword && newPassword.length < 6) {
      toast.error('Password must be at least 6 characters');
      return;
    }
    setResetting(true);
    try {
      const res = await api.post(
        endpoints.hospitals.resetAdminPassword(id),
        newPassword ? { newPassword } : {}
      );
      const data = res.data?.data || res.data;
      setResetResult(data);
      toast.success('Admin password reset');
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to reset password');
    } finally {
      setResetting(false);
    }
  };

  const copyTempPassword = async () => {
    try {
      await navigator.clipboard.writeText(resetResult?.tempPassword || '');
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error('Could not copy — select and copy manually');
    }
  };

  const startImpersonation = async () => {
    setImpersonating(true);
    try {
      const res = await api.post(endpoints.impersonate(id));
      const data = res.data?.data || res.data;
      if (!data?.token || !data?.hospital?.slug) {
        throw new Error('Invalid impersonation response');
      }
      const url = `${HMS_TENANT_URL}/impersonate?token=${encodeURIComponent(data.token)}&slug=${encodeURIComponent(data.hospital.slug)}`;
      const win = window.open(url, '_blank', 'noopener');
      if (!win) {
        toast.error('Popup blocked — allow popups to impersonate');
      } else {
        toast.success(`Impersonating ${data.targetUser?.email || 'hospital admin'}`);
      }
      setImpersonateOpen(false);
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to start impersonation');
    } finally {
      setImpersonating(false);
    }
  };

  const load = useCallback(async () => {
    try {
      const [hRes, sRes] = await Promise.allSettled([
        api.get(endpoints.hospitals.get(id)),
        api.get(endpoints.hospitals.stats(id)),
      ]);
      if (hRes.status === 'fulfilled') {
        const h = hRes.value.data.data || hRes.value.data;
        setHospital(h);
        setSubscriptions(Array.isArray(h?.subscriptions) ? h.subscriptions : []);
      }
      if (sRes.status === 'fulfilled') setStats(sRes.value.data.data || sRes.value.data);
    } catch {
      // handled below with null checks
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => { load(); }, [load]);

  if (loading) return <Spinner fullPage size="lg" />;
  if (!hospital) {
    return (
      <div className="text-center mt-20">
        <p className="text-gray-500">Hospital not found</p>
        <Button variant="secondary" onClick={() => navigate('/hospitals')} className="mt-4">
          Back to Hospitals
        </Button>
      </div>
    );
  }

  const statusColor = (s) => {
    const map = { active: 'success', trial: 'warning', trial_expired: 'danger', suspended: 'danger', inactive: 'gray' };
    return map[s] || 'gray';
  };

  const healthBandClass = {
    green: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300',
    yellow: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300',
    red: 'bg-rose-100 text-rose-700 dark:bg-rose-900/30 dark:text-rose-300',
  };

  const initials = String(hospital.name || '?')
    .trim()
    .split(/\s+/)
    .map((p) => p[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <button onClick={() => navigate('/hospitals')} className="p-2 hover:bg-gray-100 dark:hover:bg-slate-800 rounded-lg">
          <ArrowLeft className="w-5 h-5 text-gray-600 dark:text-slate-300" />
        </button>
        <p className="text-base text-gray-600 dark:text-slate-400">Hospital details and subscription history</p>
      </div>

      {/* Hero card */}
      <div className="rounded-lg overflow-hidden shadow-sm border border-transparent dark:border-slate-700">
        <div className="relative bg-gradient-to-br from-blue-600 via-indigo-600 to-indigo-700 px-6 py-6 sm:px-8 sm:py-8">
          <div className="absolute inset-0 opacity-15" style={{ backgroundImage: 'radial-gradient(circle at 20% 0%, white 0, transparent 50%), radial-gradient(circle at 80% 100%, white 0, transparent 50%)' }} />
          <div className="relative flex items-start gap-4 sm:gap-6">
            <div className="w-20 h-20 sm:w-24 sm:h-24 rounded-2xl bg-white/15 backdrop-blur-sm border border-white/20 flex items-center justify-center text-white text-2xl sm:text-3xl font-bold shadow-lg shrink-0">
              {initials}
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex flex-wrap items-center gap-2 mb-2">
                <Badge color={statusColor(hospital.status)} className="text-xs">
                  {String(hospital.status).replace('_', ' ').toUpperCase()}
                </Badge>
                {hospital.isTrial && (
                  <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md bg-amber-100 text-amber-800 text-xs font-medium">
                    <Hourglass className="w-3 h-3" />On Trial
                  </span>
                )}
              </div>
              <h1 className="text-xl sm:text-2xl font-bold text-white truncate">{hospital.name}</h1>
              <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5 mt-3 text-xs sm:text-sm text-white/90">
                {hospital.slug && (
                  <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md bg-white/15 backdrop-blur-sm font-mono">
                    <Hash className="w-3 h-3" />{hospital.slug}
                  </span>
                )}
                {(hospital.plan?.name || hospital.planName) && (
                  <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md bg-white/15 backdrop-blur-sm font-medium">
                    <CreditCard className="w-3 h-3" />{hospital.plan?.name || hospital.planName}
                  </span>
                )}
                {hospital.email && (
                  <span className="inline-flex items-center gap-1.5">
                    <Mail className="w-3 h-3" />{hospital.email}
                  </span>
                )}
                {hospital.phone && (
                  <span className="inline-flex items-center gap-1.5">
                    <Phone className="w-3 h-3" />{hospital.phone}
                  </span>
                )}
              </div>
            </div>
            {isSuperAdmin && (
              <div className="shrink-0">
                <Button
                  variant="secondary"
                  icon={LogIn}
                  onClick={() => setImpersonateOpen(true)}
                  disabled={!hospital.isActive}
                  title={hospital.isActive ? 'Sign in as this hospital' : 'Hospital is suspended'}
                >
                  Login as Hospital
                </Button>
              </div>
            )}
          </div>
        </div>
      </div>

      {(hospital.health || hospital.trial) && (
        <div className={`grid grid-cols-1 ${hospital.health && hospital.trial ? 'sm:grid-cols-2' : ''} gap-4`}>
          {hospital.health && (
            <Card className="p-5">
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-xs uppercase tracking-wide text-gray-500 dark:text-slate-400 flex items-center gap-1.5">
                    <Activity className="w-3.5 h-3.5" /> Account Health
                  </div>
                  <div className="mt-2 flex items-center gap-3">
                    <span className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-sm font-semibold ${healthBandClass[hospital.health.band] || healthBandClass.yellow}`}>
                      <span className="w-2 h-2 rounded-full bg-current" />
                      {hospital.health.score} / 100
                    </span>
                    <span className="text-sm text-gray-500 dark:text-slate-400 uppercase">{hospital.health.band}</span>
                  </div>
                </div>
              </div>
              {hospital.health.reasons?.length > 0 && (
                <ul className="mt-3 text-xs text-gray-600 dark:text-slate-400 list-disc list-inside space-y-0.5">
                  {hospital.health.reasons.map((r, i) => <li key={i}>{r}</li>)}
                </ul>
              )}
            </Card>
          )}

          {hospital.trial && (
            <Card className="p-5">
              <div className="text-xs uppercase tracking-wide text-gray-500 dark:text-slate-400 flex items-center gap-1.5">
                <Hourglass className="w-3.5 h-3.5" /> Trial Status
              </div>
              {hospital.trial.expired ? (
                <div className="mt-2 text-sm">
                  <div className="font-semibold text-rose-600 dark:text-rose-400">Trial expired</div>
                  <div className="text-xs text-gray-500 dark:text-slate-400 mt-1">
                    Ended {dayjs(hospital.trial.trialEndsAt).format('MMM D, YYYY')}
                  </div>
                </div>
              ) : (
                <div className="mt-2 text-sm">
                  <div className="font-semibold text-gray-900 dark:text-slate-100">
                    {hospital.trial.daysLeft} day(s) remaining
                  </div>
                  <div className="text-xs text-gray-500 dark:text-slate-400 mt-1">
                    Ends {dayjs(hospital.trial.trialEndsAt).format('MMM D, YYYY')}
                  </div>
                </div>
              )}
            </Card>
          )}
        </div>
      )}

      {stats && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <StatCard icon={Building2} label="Doctors" value={stats.totalDoctors ?? 0} iconBg="bg-blue-100" iconColor="text-blue-600" />
          <StatCard icon={Building2} label="Patients" value={stats.totalPatients ?? 0} iconBg="bg-green-100" iconColor="text-green-600" />
          <StatCard icon={Building2} label="Appointments" value={stats.totalAppointments ?? 0} iconBg="bg-purple-100" iconColor="text-purple-600" />
          <StatCard icon={CreditCard} label="Revenue" value={stats.totalRevenue ?? formatCurrency(0)} iconBg="bg-yellow-100" iconColor="text-yellow-600" />
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card className="p-6">
          <div className="flex items-center justify-between mb-5">
            <h2 className="text-base font-semibold text-gray-900 dark:text-slate-100">Hospital Information</h2>
            <Building2 className="w-4 h-4 text-gray-400" />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-5">
            <InfoRow icon={Building2} iconBg="bg-blue-50" iconColor="text-blue-600" label="Name" value={hospital.name} />
            <InfoRow icon={Hash} iconBg="bg-slate-50" iconColor="text-slate-600" label="Hospital ID (tenant)" value={hospital.slug} mono />
            <InfoRow icon={Mail} iconBg="bg-purple-50" iconColor="text-purple-600" label="Email" value={hospital.email} />
            <InfoRow icon={Phone} iconBg="bg-emerald-50" iconColor="text-emerald-600" label="Phone" value={hospital.phone} />
            <InfoRow icon={CreditCard} iconBg="bg-indigo-50" iconColor="text-indigo-600" label="Plan" value={hospital.plan?.name || hospital.planName} />
            <InfoRow icon={Calendar} iconBg="bg-amber-50" iconColor="text-amber-600" label="Joined" value={dayjs(hospital.createdAt).format('MMM D, YYYY')} />
            <div className="sm:col-span-2">
              <InfoRow icon={MapPin} iconBg="bg-rose-50" iconColor="text-rose-600" label="Address" value={[hospital.address, hospital.city, hospital.state, hospital.pincode, hospital.country].filter(Boolean).join(', ')} />
            </div>
            {hospital.gstin && (
              <InfoRow icon={Receipt} iconBg="bg-yellow-50" iconColor="text-yellow-600" label="GSTIN" value={hospital.gstin} mono />
            )}
            {hospital.registrationNo && (
              <InfoRow icon={BadgeCheck} iconBg="bg-cyan-50" iconColor="text-cyan-600" label="Registration No." value={hospital.registrationNo} mono />
            )}
            {hospital.website && (
              <InfoRow icon={Globe} iconBg="bg-teal-50" iconColor="text-teal-600" label="Website" value={hospital.website} />
            )}
            <InfoRow icon={Power} iconBg={hospital.isActive ? 'bg-emerald-50' : 'bg-rose-50'} iconColor={hospital.isActive ? 'text-emerald-600' : 'text-rose-600'} label="Status" value={
              <span className={`inline-flex items-center gap-1.5 font-medium ${hospital.isActive ? 'text-emerald-600' : 'text-rose-600'}`}>
                <span className={`w-1.5 h-1.5 rounded-full ${hospital.isActive ? 'bg-emerald-500' : 'bg-rose-500'}`} />
                {hospital.isActive ? 'Active' : 'Inactive'}
              </span>
            } />
          </div>
        </Card>

        <Card className="p-6">
          <div className="flex items-center justify-between mb-5">
            <h2 className="text-base font-semibold text-gray-900 dark:text-slate-100">Admin Account</h2>
            <div className="flex items-center gap-3">
              {isSuperAdmin && hospital.admin && (
                <Button
                  variant="secondary"
                  size="sm"
                  icon={KeyRound}
                  onClick={() => setResetOpen(true)}
                >
                  Reset Password
                </Button>
              )}
              <User className="w-4 h-4 text-gray-400" />
            </div>
          </div>
          {hospital.admin ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-5">
              <InfoRow icon={User} iconBg="bg-blue-50" iconColor="text-blue-600" label="Name" value={hospital.admin.name} />
              <InfoRow icon={Mail} iconBg="bg-purple-50" iconColor="text-purple-600" label="Email" value={hospital.admin.email} />
              {hospital.admin.phone && (
                <InfoRow icon={Phone} iconBg="bg-emerald-50" iconColor="text-emerald-600" label="Phone" value={hospital.admin.phone} />
              )}
              <InfoRow icon={Calendar} iconBg="bg-amber-50" iconColor="text-amber-600" label="Created" value={dayjs(hospital.admin.createdAt).format('MMM D, YYYY')} />
              <InfoRow icon={Power} iconBg={hospital.admin.isActive ? 'bg-emerald-50' : 'bg-rose-50'} iconColor={hospital.admin.isActive ? 'text-emerald-600' : 'text-rose-600'} label="Status" value={
                <span className={`inline-flex items-center gap-1.5 font-medium ${hospital.admin.isActive ? 'text-emerald-600' : 'text-rose-600'}`}>
                  <span className={`w-1.5 h-1.5 rounded-full ${hospital.admin.isActive ? 'bg-emerald-500' : 'bg-rose-500'}`} />
                  {hospital.admin.isActive ? 'Active' : 'Inactive'}
                </span>
              } />
            </div>
          ) : (
            <div className="text-center py-8">
              <div className="w-12 h-12 rounded-full bg-gray-100 dark:bg-slate-800 flex items-center justify-center mx-auto mb-2">
                <User className="w-5 h-5 text-gray-400" />
              </div>
              <p className="text-sm text-gray-500 dark:text-slate-400">No admin account on file.</p>
            </div>
          )}
        </Card>
      </div>

      <PatientLoginCard hospitalId={id} initialEnabled={hospital.patientLoginEnabled} isSuperAdmin={isSuperAdmin} />

      <ModulesCard hospitalId={id} isSuperAdmin={isSuperAdmin} />

      <Card className="p-6">
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-base font-semibold text-gray-900 dark:text-slate-100">Subscription History</h2>
          <CreditCard className="w-4 h-4 text-gray-400" />
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
              const isActive = sub.status === 'active';
              const isLast = idx === subscriptions.length - 1;
              return (
                <div key={sub.id || sub._id || idx} className="flex gap-4">
                  <div className="flex flex-col items-center pt-4 shrink-0">
                    <span className={`w-3 h-3 rounded-full ring-4 ring-white dark:ring-slate-900 ${isActive ? 'bg-indigo-600' : 'bg-gray-300 dark:bg-slate-600'}`} />
                    {!isLast && <span className="flex-1 w-px mt-1 bg-gray-200 dark:bg-slate-700" />}
                  </div>
                  <div className="flex-1 flex items-center justify-between p-4 rounded-xl border border-gray-100 dark:border-slate-800 bg-gradient-to-r from-gray-50/60 to-white dark:from-slate-800/40 dark:to-slate-900 hover:shadow-sm transition-shadow">
                    <div className="flex items-center gap-3 min-w-0">
                      <div className={`w-10 h-10 rounded-lg flex items-center justify-center shrink-0 ${isActive ? 'bg-indigo-50 dark:bg-indigo-900/30' : 'bg-gray-100 dark:bg-slate-800'}`}>
                        <CreditCard className={`w-5 h-5 ${isActive ? 'text-indigo-600 dark:text-indigo-400' : 'text-gray-400'}`} />
                      </div>
                      <div className="min-w-0">
                        <p className="text-sm font-semibold text-gray-900 dark:text-slate-100 truncate">{sub.plan?.name || sub.planName || 'Plan'}</p>
                        <p className="text-xs text-gray-500 dark:text-slate-400 mt-0.5">
                          {dayjs(sub.startDate).format('MMM D, YYYY')} → {dayjs(sub.endDate).format('MMM D, YYYY')}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-3 shrink-0">
                      {sub.amount != null && (
                        <span className="text-sm font-semibold text-gray-700 dark:text-slate-300">{formatCurrency(sub.amount)}</span>
                      )}
                      <Badge color={isActive ? 'success' : 'gray'}>{sub.status}</Badge>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </Card>

      {isSuperAdmin && <DangerZone hospitalId={id} hospital={hospital} onChanged={load} />}

      <Modal isOpen={resetOpen} onClose={closeResetDialog} title="Reset admin password" size="sm">
        {resetResult ? (
          <div className="space-y-4">
            <p className="text-sm text-gray-600 dark:text-slate-400">
              The password for <span className="font-medium text-gray-900 dark:text-slate-100">{hospital.admin?.email || resetResult.email}</span> has
              been reset. Share the new password with the hospital through a secure channel — it is shown here only once.
            </p>
            <div className="flex items-center gap-2 p-3 rounded-lg bg-gray-50 dark:bg-slate-800 border border-gray-200 dark:border-slate-700">
              <code className="flex-1 text-sm font-mono text-gray-900 dark:text-slate-100 break-all">{resetResult.tempPassword}</code>
              <Button variant="secondary" size="sm" icon={copied ? Check : Copy} onClick={copyTempPassword}>
                {copied ? 'Copied' : 'Copy'}
              </Button>
            </div>
            <div className="flex justify-end">
              <Button onClick={closeResetDialog}>Done</Button>
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            <p className="text-sm text-gray-600 dark:text-slate-400">
              Set a new login password for <span className="font-medium text-gray-900 dark:text-slate-100">{hospital.admin?.email || hospital.email}</span>.
              Leave the field blank to auto-generate a temporary password. This also re-activates the admin account if it was deactivated.
            </p>
            <Input
              label="New password (optional)"
              type="text"
              placeholder="Leave blank to auto-generate"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              error={newPassword && newPassword.length < 6 ? 'Min 6 characters' : ''}
              autoFocus
            />
            <div className="flex justify-end gap-2">
              <Button variant="secondary" onClick={closeResetDialog} disabled={resetting}>Cancel</Button>
              <Button onClick={resetAdminPassword} loading={resetting} icon={KeyRound}>Reset Password</Button>
            </div>
          </div>
        )}
      </Modal>

      <ConfirmDialog
        isOpen={impersonateOpen}
        onClose={() => !impersonating && setImpersonateOpen(false)}
        onConfirm={startImpersonation}
        title="Login as hospital"
        message={`A short-lived (10-minute) token will be issued to sign in as ${hospital.name}'s primary admin. The session will be logged in Activity Logs. Continue?`}
        confirmText="Open hospital app"
        variant="primary"
        loading={impersonating}
      />
    </div>
  );
}

// Per-hospital patient-login toggle. Controls whether this hospital's patients
// can sign into the patient portal / MedNote app. Opt-in (off by default); the
// flag persists via the standard hospital update endpoint and gates the
// patient-auth login scan on the backend. Super-admin only.
function PatientLoginCard({ hospitalId, initialEnabled, isSuperAdmin }) {
  const [enabled, setEnabled] = useState(!!initialEnabled);
  const [saving, setSaving] = useState(false);

  const toggle = async () => {
    if (!isSuperAdmin || saving) return;
    const next = !enabled;
    setSaving(true);
    try {
      await api.put(endpoints.hospitals.update(hospitalId), { patientLoginEnabled: next });
      setEnabled(next);
      toast.success(next ? 'Patient login enabled' : 'Patient login disabled');
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to update patient login');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Card className="p-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="text-base font-semibold text-gray-900 dark:text-slate-100 flex items-center gap-2">
            <Smartphone className="w-4 h-4 text-indigo-500" /> Patient Login
          </h2>
          <p className="text-xs text-gray-500 dark:text-slate-400 mt-1 max-w-md">
            {enabled
              ? 'Patients of this hospital can sign into the patient portal and MedNote app with their phone number.'
              : 'Patient login is off — this hospital’s patients cannot sign into the patient portal or MedNote app.'}
          </p>
        </div>
        <label className={`flex items-center gap-2 shrink-0 ${isSuperAdmin ? 'cursor-pointer' : 'cursor-not-allowed opacity-60'}`}>
          <span className={`text-xs font-medium ${enabled ? 'text-emerald-600 dark:text-emerald-400' : 'text-gray-500 dark:text-slate-400'}`}>
            {enabled ? 'Enabled' : 'Disabled'}
          </span>
          <div
            onClick={toggle}
            className={`w-9 h-5 rounded-full relative transition-colors flex-shrink-0 ${enabled ? 'bg-emerald-500' : 'bg-gray-300 dark:bg-slate-600'} ${saving ? 'opacity-60' : ''}`}
          >
            <div className={`absolute top-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform ${enabled ? 'translate-x-4' : 'translate-x-0.5'}`} />
          </div>
        </label>
      </div>
      {!isSuperAdmin && (
        <p className="text-xs text-gray-400 dark:text-slate-500 flex items-center gap-1.5 pt-4 mt-4 border-t border-gray-200 dark:border-slate-700">
          <Lock className="w-3.5 h-3.5" /> Only a super admin can change patient login.
        </p>
      )}
    </Card>
  );
}

// Per-hospital module enable/disable. When "Override plan defaults" is off the
// hospital inherits its plan's modules (read-only preview); when on, the super
// admin picks the exact module set for this hospital. Saving PUTs the array, or
// null to clear the override. The change flows to the tenant app via the shared
// permission ceiling — no tenant-side toggle needed.
function ModulesCard({ hospitalId, isSuperAdmin }) {
  const [ctx, setCtx] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [overrideOn, setOverrideOn] = useState(false);
  const [selected, setSelected] = useState(() => new Set());

  const applyCtx = (data) => {
    setCtx(data);
    setOverrideOn(!!data.isOverridden);
    setSelected(new Set(data.effectiveModules || []));
  };

  useEffect(() => {
    // `loading` starts true; the detail page remounts per hospital id so no
    // synchronous reset is needed here.
    let active = true;
    api.get(endpoints.hospitals.modules(hospitalId))
      .then((res) => { if (active) applyCtx(res.data?.data || res.data); })
      .catch(() => { /* card stays hidden on failure */ })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [hospitalId]);

  if (loading) {
    return (
      <Card className="p-6">
        <div className="flex items-center justify-center py-6"><Spinner size="sm" /></div>
      </Card>
    );
  }
  if (!ctx) return null;

  const hasPlan = !!ctx.plan;
  // What the hospital gets by inheriting: the plan's modules, or everything if
  // there's no plan cap.
  const planHas = (label) => (hasPlan ? (ctx.planFeatures || []).includes(label) : true);

  const setsEqual = (set, list) => set.size === list.length && list.every((x) => set.has(x));
  const dirty = overrideOn !== ctx.isOverridden
    || (overrideOn && !setsEqual(selected, ctx.effectiveModules || []));
  const editable = isSuperAdmin && overrideOn;

  const toggleModule = (label) => {
    if (!editable) return;
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(label)) next.delete(label); else next.add(label);
      return next;
    });
  };

  const toggleOverride = (on) => {
    if (!isSuperAdmin) return;
    setOverrideOn(on);
    // Seed the editable set from what's currently in force so the admin edits
    // from the plan's baseline rather than a blank slate.
    if (on) setSelected(new Set(ctx.effectiveModules || []));
  };

  const save = async () => {
    setSaving(true);
    try {
      const payload = { enabledModules: overrideOn ? [...selected] : null };
      const res = await api.put(endpoints.hospitals.modules(hospitalId), payload);
      applyCtx(res.data?.data || res.data);
      toast.success(overrideOn ? 'Module override saved' : 'Reverted to plan defaults');
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to save modules');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Card className="p-6">
      <div className="flex items-start justify-between gap-4 mb-5">
        <div>
          <h2 className="text-base font-semibold text-gray-900 dark:text-slate-100 flex items-center gap-2">
            <Boxes className="w-4 h-4 text-indigo-500" /> Modules
          </h2>
          <p className="text-xs text-gray-500 dark:text-slate-400 mt-1">
            {overrideOn
              ? 'This hospital uses a custom module set that overrides its plan.'
              : hasPlan
                ? <>Inheriting modules from the <span className="font-medium text-gray-700 dark:text-slate-300">{ctx.plan.name}</span> plan.</>
                : 'No plan cap — all modules are available to this hospital.'}
          </p>
        </div>
        {/* Override switch */}
        <label className={`flex items-center gap-2 shrink-0 ${isSuperAdmin ? 'cursor-pointer' : 'cursor-not-allowed opacity-60'}`}>
          <span className="text-xs font-medium text-gray-600 dark:text-slate-300">Override plan defaults</span>
          <div
            onClick={() => toggleOverride(!overrideOn)}
            className={`w-9 h-5 rounded-full relative transition-colors flex-shrink-0 ${overrideOn ? 'bg-indigo-600' : 'bg-gray-300 dark:bg-slate-600'}`}
          >
            <div className={`absolute top-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform ${overrideOn ? 'translate-x-4' : 'translate-x-0.5'}`} />
          </div>
        </label>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
        {(ctx.allModules || []).map(({ key, label }) => {
          const on = overrideOn ? selected.has(label) : planHas(label);
          // When overriding, flag modules the plan doesn't include but you've
          // switched on — a heads-up that you're granting beyond the plan.
          const beyondPlan = overrideOn && on && hasPlan && !planHas(label);
          return (
            <div
              key={key}
              onClick={() => toggleModule(label)}
              className={`flex items-center gap-2.5 p-2 rounded-lg ${editable ? 'hover:bg-gray-50 dark:hover:bg-slate-800/60 cursor-pointer' : 'cursor-default'}`}
            >
              <div
                className={`w-9 h-5 rounded-full relative transition-colors flex-shrink-0 ${on ? (overrideOn ? 'bg-indigo-600' : 'bg-emerald-500') : 'bg-gray-300 dark:bg-slate-600'} ${editable ? '' : 'opacity-70'}`}
              >
                <div className={`absolute top-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform ${on ? 'translate-x-4' : 'translate-x-0.5'}`} />
              </div>
              <span className="text-sm text-gray-700 dark:text-slate-300 flex items-center gap-1.5">
                {label}
                {beyondPlan && (
                  <span className="text-[10px] font-medium text-amber-600 dark:text-amber-400 uppercase tracking-wide">beyond plan</span>
                )}
              </span>
            </div>
          );
        })}
      </div>

      <div className="flex items-center justify-between gap-3 pt-4 mt-4 border-t border-gray-200 dark:border-slate-700">
        <p className="text-xs text-gray-400 dark:text-slate-500 flex items-center gap-1.5">
          {isSuperAdmin ? <Info className="w-3.5 h-3.5" /> : <Lock className="w-3.5 h-3.5" />}
          {isSuperAdmin
            ? 'Applies on the hospital user’s next reload.'
            : 'Only a super admin can change modules.'}
        </p>
        {isSuperAdmin && (
          <Button icon={Save} onClick={save} loading={saving} disabled={!dirty}>Save Modules</Button>
        )}
      </div>
    </Card>
  );
}

// Destructive tenant-lifecycle actions — super-admin only (the parent gates the
// render). Both actions require typing the hospital's exact slug (Hospital ID)
// to arm the confirm button:
//   • Hard reset  — POST /hard-reset: wipes every bit of tenant data and
//                   re-provisions a fresh, empty schema. The account, plan and
//                   subscription survive; the admin login is restored and its
//                   new temp password is shown once.
//   • Delete      — DELETE /:id: removes the hospital, its subscription history
//                   and its entire database schema, then returns to the list.
function DangerZone({ hospitalId, hospital, onChanged }) {
  const navigate = useNavigate();
  const [mode, setMode] = useState(null); // 'reset' | 'delete' | null
  const [confirmText, setConfirmText] = useState('');
  const [busy, setBusy] = useState(false);
  const [resetResult, setResetResult] = useState(null); // { tempPassword, adminEmail } after a hard reset
  const [copied, setCopied] = useState(false);
  const [repairing, setRepairing] = useState(false);

  const doRepair = async () => {
    setRepairing(true);
    try {
      const res = await api.post(endpoints.hospitals.repair(hospitalId));
      const result = res.data?.data || res.data;
      toast.success(
        result?.repaired
          ? `Tenant repaired (schema: ${result.schemaCreated}, admin: ${result.adminCreated})`
          : 'No repair needed'
      );
      onChanged?.();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Repair failed');
    } finally {
      setRepairing(false);
    }
  };

  const slug = hospital.slug || '';
  const armed = confirmText.trim() === slug && !!slug;
  const isDelete = mode === 'delete';

  const close = () => {
    if (busy) return;
    setMode(null);
    setConfirmText('');
    setResetResult(null);
    setCopied(false);
  };

  const doHardReset = async () => {
    if (!armed) return;
    setBusy(true);
    try {
      const res = await api.post(endpoints.hospitals.hardReset(hospitalId));
      setResetResult(res.data?.data || res.data);
      toast.success('Tenant hard reset — all data wiped');
    } catch (err) {
      toast.error(err.response?.data?.message || 'Hard reset failed');
    } finally {
      setBusy(false);
    }
  };

  const doDelete = async () => {
    if (!armed) return;
    setBusy(true);
    try {
      await api.delete(endpoints.hospitals.delete(hospitalId));
      toast.success('Tenant deleted permanently');
      navigate('/hospitals');
    } catch (err) {
      toast.error(err.response?.data?.message || 'Delete failed');
      setBusy(false);
    }
  };

  // After a hard reset the modal closes and the page reloads so the stats,
  // health and admin panels reflect the now-empty tenant.
  const finishReset = () => {
    close();
    onChanged?.();
  };

  const copyTempPassword = async () => {
    try {
      await navigator.clipboard.writeText(resetResult?.tempPassword || '');
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error('Could not copy — select and copy manually');
    }
  };

  return (
    <Card className="p-6 border border-rose-200 dark:border-rose-900/50">
      <div className="flex items-center gap-2 mb-1">
        <ShieldAlert className="w-4 h-4 text-rose-500" />
        <h2 className="text-base font-semibold text-rose-700 dark:text-rose-400">Danger Zone</h2>
      </div>
      <p className="text-xs text-gray-500 dark:text-slate-400 mb-5">
        Irreversible actions for this tenant. Handle with care.
      </p>

      <div className="space-y-3">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-4 rounded-lg border border-blue-200 dark:border-blue-500/30 bg-blue-50/40 dark:bg-blue-900/10">
          <div className="min-w-0">
            <p className="text-sm font-medium text-gray-900 dark:text-slate-100">Repair tenant schema</p>
            <p className="text-xs text-gray-500 dark:text-slate-400 mt-0.5">
              Safe, non-destructive — fills in any tables/columns this hospital's schema is missing (e.g. from a hospital
              created before a later feature shipped). Existing data is never touched or dropped.
            </p>
          </div>
          <Button
            variant="secondary"
            icon={Wrench}
            loading={repairing}
            className="shrink-0"
            onClick={doRepair}
          >
            Repair
          </Button>
        </div>

        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-4 rounded-lg border border-amber-200 dark:border-amber-500/30 bg-amber-50/40 dark:bg-amber-900/10">
          <div className="min-w-0">
            <p className="text-sm font-medium text-gray-900 dark:text-slate-100">Hard reset tenant</p>
            <p className="text-xs text-gray-500 dark:text-slate-400 mt-0.5">
              Permanently wipe all data (patients, appointments, billing, staff…) and re-provision a fresh, empty workspace. The account, plan and subscription are kept, and the admin login is restored.
            </p>
          </div>
          <Button
            variant="secondary"
            icon={RotateCcw}
            className="shrink-0 !text-amber-700 !border-amber-300 hover:!bg-amber-50 dark:!text-amber-400 dark:!border-amber-500/40 dark:hover:!bg-amber-500/10"
            onClick={() => { setConfirmText(''); setMode('reset'); }}
          >
            Hard Reset
          </Button>
        </div>

        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-4 rounded-lg border border-rose-200 dark:border-rose-900/50 bg-rose-50/40 dark:bg-rose-900/10">
          <div className="min-w-0">
            <p className="text-sm font-medium text-gray-900 dark:text-slate-100">Delete tenant permanently</p>
            <p className="text-xs text-gray-500 dark:text-slate-400 mt-0.5">
              Remove the hospital, its subscription history and its entire database schema. This cannot be undone.
            </p>
          </div>
          <Button variant="danger" icon={Trash2} className="shrink-0" onClick={() => { setConfirmText(''); setMode('delete'); }}>
            Delete
          </Button>
        </div>
      </div>

      <Modal isOpen={!!mode} onClose={close} title={isDelete ? 'Delete tenant permanently' : 'Hard reset tenant'} size="sm">
        {resetResult ? (
          <div className="space-y-4">
            <p className="text-sm text-gray-600 dark:text-slate-400">
              <span className="font-medium text-gray-900 dark:text-slate-100">{hospital.name}</span> has been reset to a clean workspace.
              The admin can sign in with the temporary password below — share it securely, it is shown only once.
            </p>
            <div className="text-xs text-gray-500 dark:text-slate-400">
              Login: <span className="font-mono text-gray-800 dark:text-slate-200">{resetResult.adminEmail || hospital.phone || hospital.email || '—'}</span>
            </div>
            <div className="flex items-center gap-2 p-3 rounded-lg bg-gray-50 dark:bg-slate-800 border border-gray-200 dark:border-slate-700">
              <code className="flex-1 text-sm font-mono text-gray-900 dark:text-slate-100 break-all">{resetResult.tempPassword}</code>
              <Button variant="secondary" size="sm" icon={copied ? Check : Copy} onClick={copyTempPassword}>
                {copied ? 'Copied' : 'Copy'}
              </Button>
            </div>
            <div className="flex justify-end">
              <Button onClick={finishReset}>Done</Button>
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            <div className={`flex items-start gap-3 p-3 rounded-lg ${isDelete ? 'bg-rose-50 dark:bg-rose-900/20' : 'bg-amber-50 dark:bg-amber-900/20'}`}>
              <AlertTriangle className={`w-5 h-5 shrink-0 ${isDelete ? 'text-rose-600' : 'text-amber-600'}`} />
              <p className="text-sm text-gray-700 dark:text-slate-300">
                {isDelete ? (
                  <>This permanently deletes <span className="font-semibold">{hospital.name}</span>, its subscription history and its entire database. <span className="font-semibold">This cannot be undone.</span></>
                ) : (
                  <>This permanently wipes all data for <span className="font-semibold">{hospital.name}</span> and provisions a fresh, empty workspace. The account and subscription are kept. <span className="font-semibold">This cannot be undone.</span></>
                )}
              </p>
            </div>
            <div>
              <p className="text-sm text-gray-600 dark:text-slate-400 mb-1.5">
                Type the Hospital ID <code className="font-mono font-semibold text-gray-900 dark:text-slate-100">{slug}</code> to confirm.
              </p>
              <Input
                value={confirmText}
                onChange={(e) => setConfirmText(e.target.value)}
                placeholder={slug}
                autoFocus
              />
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="secondary" onClick={close} disabled={busy}>Cancel</Button>
              <Button
                variant={isDelete ? 'danger' : 'primary'}
                onClick={isDelete ? doDelete : doHardReset}
                loading={busy}
                disabled={!armed}
                icon={isDelete ? Trash2 : RotateCcw}
              >
                {isDelete ? 'Delete permanently' : 'Hard reset'}
              </Button>
            </div>
          </div>
        )}
      </Modal>
    </Card>
  );
}

function InfoRow({ icon: Icon, label, value, iconBg = 'bg-gray-50', iconColor = 'text-gray-500', mono = false }) {
  return (
    <div className="flex items-start gap-3">
      <div className={`w-9 h-9 rounded-lg ${iconBg} dark:bg-slate-800 flex items-center justify-center flex-shrink-0`}>
        <Icon className={`w-4 h-4 ${iconColor} dark:text-slate-300`} />
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-xs text-gray-500 dark:text-slate-400 uppercase tracking-wide">{label}</p>
        <div className={`text-sm text-gray-900 dark:text-slate-100 mt-0.5 break-words ${mono ? 'font-mono' : 'font-medium'}`}>
          {value || <span className="text-gray-400 dark:text-slate-500">—</span>}
        </div>
      </div>
    </div>
  );
}
