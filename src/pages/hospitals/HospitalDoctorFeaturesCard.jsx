import { useEffect, useState } from 'react';
import { Lock, UserCog } from 'lucide-react';
import toast from 'react-hot-toast';
import api from '../../api/axios';
import endpoints from '../../api/endpoints';
import Card from '../../components/ui/Card';

// Which optional doctor features this hospital may use. Turning one on here
// lets the hospital admin give it to particular doctors in the hospital app
// (Settings → Doctor Features); turning it off removes it from every doctor.
// GET/PUT /platform/hospitals/:id/doctor-features (PUT: super admin only).
const FEATURES = [
  { key: 'viewAllPatients', label: 'View all patients', desc: 'Doctors can search and open every patient, not only their own.' },
  { key: 'personalHistory', label: 'Personal history (confidential)', desc: 'Private case-sheet box seen only by the doctor who writes it; never printed.' },
  { key: 'informant', label: 'Informant details', desc: 'Informant name, relationship, phone and reliability on the case sheet.' },
];

export default function HospitalDoctorFeaturesCard({ hospitalId, isSuperAdmin }) {
  const [flags, setFlags] = useState(null);
  const [saving, setSaving] = useState(null);

  useEffect(() => {
    let alive = true;
    api.get(endpoints.hospitals.doctorFeatures(hospitalId))
      .then((res) => { if (alive) setFlags(res.data.data || {}); })
      .catch(() => { if (alive) setFlags({}); });
    return () => { alive = false; };
  }, [hospitalId]);

  const toggle = async (key) => {
    if (!isSuperAdmin || saving || !flags) return;
    const next = { ...flags, [key]: !flags[key] };
    setSaving(key);
    try {
      const res = await api.put(endpoints.hospitals.doctorFeatures(hospitalId), next);
      setFlags(res.data.data || next);
      toast.success(`${FEATURES.find((f) => f.key === key).label} ${next[key] ? 'enabled' : 'disabled'}`);
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to update doctor features');
    } finally {
      setSaving(null);
    }
  };

  return (
    <Card className="p-6">
      <h2 className="text-base font-semibold text-gray-900 dark:text-slate-100 flex items-center gap-2">
        <UserCog className="w-4 h-4 text-indigo-500" /> Doctor Features
      </h2>
      <p className="text-xs text-gray-500 dark:text-slate-400 mt-1 max-w-xl">
        Enable a feature for this hospital; the hospital admin then gives it to particular doctors in Settings → Doctor Features.
      </p>
      <div className="mt-4 divide-y divide-gray-100 dark:divide-slate-800">
        {FEATURES.map((f) => {
          const on = !!flags?.[f.key];
          return (
            <div key={f.key} className="flex items-start justify-between gap-4 py-3">
              <div>
                <p className="text-sm font-medium text-gray-900 dark:text-slate-100">{f.label}</p>
                <p className="text-xs text-gray-500 dark:text-slate-400">{f.desc}</p>
              </div>
              <label className={`flex items-center gap-2 shrink-0 ${isSuperAdmin && flags ? 'cursor-pointer' : 'cursor-not-allowed opacity-60'}`}>
                <span className={`text-xs font-medium ${on ? 'text-emerald-600 dark:text-emerald-400' : 'text-gray-500 dark:text-slate-400'}`}>
                  {on ? 'Enabled' : 'Disabled'}
                </span>
                <div
                  role="switch"
                  aria-checked={on}
                  aria-label={f.label}
                  onClick={() => toggle(f.key)}
                  className={`w-9 h-5 rounded-full relative transition-colors flex-shrink-0 ${on ? 'bg-emerald-500' : 'bg-gray-300 dark:bg-slate-600'} ${saving === f.key ? 'opacity-60' : ''}`}
                >
                  <div className={`absolute top-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform ${on ? 'translate-x-4' : 'translate-x-0.5'}`} />
                </div>
              </label>
            </div>
          );
        })}
      </div>
      {!isSuperAdmin && (
        <p className="text-xs text-gray-400 dark:text-slate-500 flex items-center gap-1.5 pt-4 mt-1 border-t border-gray-200 dark:border-slate-700">
          <Lock className="w-3.5 h-3.5" /> Only a super admin can change doctor features.
        </p>
      )}
    </Card>
  );
}
