import React, { useEffect, useState } from 'react';
import { Clock, Mail, Bell, Users, Calendar, AlertTriangle, CheckCircle2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';

interface CronRow {
  job_name: string;
  display_name: string;
  schedule: string;
  edge_function_name: string;
  is_critical: boolean;
  is_active: boolean;
}

interface AutomationRule {
  message_type: string;
  description: string | null;
  sends_email: boolean;
  sends_dashboard_message: boolean;
  sends_push: boolean | null;
  is_active: boolean;
  trigger_type: string;
}

// Human-friendly cron → text (best-effort, common patterns)
function describeSchedule(cron: string): string {
  const map: Record<string, string> = {
    '* * * * *': 'Every minute',
    '*/5 * * * *': 'Every 5 minutes',
    '*/10 * * * *': 'Every 10 minutes',
    '*/15 * * * *': 'Every 15 minutes',
    '*/30 * * * *': 'Every 30 minutes',
    '0 * * * *': 'Every hour',
    '0 */4 * * *': 'Every 4 hours',
    '0 */6 * * *': 'Every 6 hours',
  };
  if (map[cron]) return map[cron];
  const parts = cron.split(' ');
  if (parts.length === 5) {
    const [m, h, dom, mon, dow] = parts;
    const cyprusHour = (utc: number) => ((utc + 3) % 24).toString().padStart(2, '0');
    if (!m.includes('*') && !h.includes('*') && dom === '*' && mon === '*' && dow === '*') {
      return `Daily at ${cyprusHour(parseInt(h))}:${m.padStart(2, '0')} Cyprus`;
    }
    if (!m.includes('*') && !h.includes('*') && dow !== '*') {
      const days = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];
      return `${days[parseInt(dow) % 7]}s at ${cyprusHour(parseInt(h))}:${m.padStart(2, '0')} Cyprus`;
    }
  }
  return cron;
}

export const CronJobsDocumentation = () => {
  const [jobs, setJobs] = useState<CronRow[]>([]);
  const [rules, setRules] = useState<AutomationRule[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const [j, r] = await Promise.all([
        supabase.from('cron_job_metadata').select('job_name,display_name,schedule,edge_function_name,is_critical,is_active').order('display_name'),
        supabase.from('automation_rules').select('message_type,description,sends_email,sends_dashboard_message,sends_push,is_active,trigger_type').order('message_type'),
      ]);
      setJobs((j.data as any) || []);
      setRules((r.data as any) || []);
      setLoading(false);
    })();
  }, []);

  const channelBadges = (r: AutomationRule) => (
    <div className="flex gap-1 flex-wrap">
      {r.sends_email && <span className="px-1.5 py-0.5 text-[10px] bg-blue-100 text-blue-800 rounded">Email</span>}
      {r.sends_dashboard_message && <span className="px-1.5 py-0.5 text-[10px] bg-purple-100 text-purple-800 rounded">Dashboard</span>}
      {r.sends_push && <span className="px-1.5 py-0.5 text-[10px] bg-green-100 text-green-800 rounded">Push</span>}
    </div>
  );

  return (
    <div className="min-h-screen bg-white text-gray-900 print:text-black" style={{ fontFamily: 'Arial, sans-serif' }}>
      <div className="p-8 md:p-12 max-w-[21cm] mx-auto" style={{ minHeight: '29.7cm', pageBreakAfter: 'always' }}>
        <div className="flex items-center justify-between mb-8 border-b-4 border-[#29B6D2] pb-6">
          <div className="flex items-center gap-4">
            <img src="/smarty-gym-logo.png" alt="SmartyGym Logo" className="h-16 w-16 object-contain" onError={(e) => { e.currentTarget.style.display = 'none'; }} />
            <div>
              <h1 className="text-3xl font-bold text-[#29B6D2]">SmartyGym</h1>
              <p className="text-sm text-gray-600">Live Cron Jobs & Automations (auto-synced from DB)</p>
            </div>
          </div>
          <div className="text-right">
            <div className="bg-[#1a1a1a] text-white px-4 py-2 rounded-lg flex items-center gap-2">
              <Clock className="h-4 w-4 text-[#29B6D2]" />
              <span className="text-[#29B6D2] font-bold">{loading ? 'Loading…' : `${jobs.length} jobs · ${rules.length} rules`}</span>
            </div>
          </div>
        </div>

        <div className="bg-gradient-to-r from-[#1a1a1a] to-[#2a2a2a] text-white rounded-xl p-6 mb-8">
          <h2 className="text-xl font-bold mb-2 flex items-center gap-2">
            <Bell className="h-5 w-5 text-[#29B6D2]" />
            Live System Overview
          </h2>
          <p className="text-gray-300 text-sm">
            This page reads directly from <code className="text-[#29B6D2]">cron_job_metadata</code> and <code className="text-[#29B6D2]">automation_rules</code>.
            Every user-controllable automation has three independent channels (Email · Dashboard · Push) and respects per-user preferences.
          </p>
        </div>

        <h3 className="text-xl font-bold mb-4 text-[#29B6D2] border-b-2 border-[#29B6D2] pb-2 flex items-center gap-2">
          <Calendar className="h-5 w-5" />
          Scheduled Cron Jobs ({jobs.length})
        </h3>
        <div className="overflow-x-auto mb-8">
          <table className="w-full border-collapse text-sm">
            <thead>
              <tr className="bg-[#29B6D2] text-white">
                <th className="border border-gray-300 p-2 text-left font-bold">Job</th>
                <th className="border border-gray-300 p-2 text-left font-bold">Schedule</th>
                <th className="border border-gray-300 p-2 text-left font-bold">Edge Function</th>
                <th className="border border-gray-300 p-2 text-left font-bold">Status</th>
              </tr>
            </thead>
            <tbody>
              {jobs.map((j, i) => (
                <tr key={j.job_name} className={i % 2 ? 'bg-gray-50' : ''}>
                  <td className="border border-gray-300 p-2">
                    <strong>{j.display_name}</strong>
                    {j.is_critical && <span className="ml-2 text-[10px] text-red-700 font-bold">CRITICAL</span>}
                    <br/><span className="text-gray-500 text-[11px] font-mono">{j.job_name}</span>
                  </td>
                  <td className="border border-gray-300 p-2">
                    {describeSchedule(j.schedule)}<br/>
                    <span className="text-gray-500 text-[11px] font-mono">{j.schedule}</span>
                  </td>
                  <td className="border border-gray-300 p-2 font-mono text-xs">{j.edge_function_name}</td>
                  <td className="border border-gray-300 p-2">
                    {j.is_active ? (
                      <span className="inline-flex items-center gap-1 text-green-700"><CheckCircle2 className="h-3 w-3"/>Active</span>
                    ) : (
                      <span className="inline-flex items-center gap-1 text-gray-500"><AlertTriangle className="h-3 w-3"/>Paused</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="bg-[#E8F7FA] border-l-4 border-[#29B6D2] p-4 rounded-r-lg">
          <p className="text-sm text-gray-700">
            <strong>Note:</strong> Schedules are stored in UTC; the human-readable column shows Cyprus time (UTC+3 / EEST).
            All email sends use 600ms rate limiting to respect Resend's API limits.
          </p>
        </div>
      </div>

      <div className="p-8 md:p-12 max-w-[21cm] mx-auto" style={{ minHeight: '29.7cm' }}>
        <h3 className="text-xl font-bold mb-4 text-[#29B6D2] border-b-2 border-[#29B6D2] pb-2 flex items-center gap-2">
          <Mail className="h-5 w-5" />
          Automation Rules ({rules.length})
        </h3>
        <div className="overflow-x-auto mb-8">
          <table className="w-full border-collapse text-sm">
            <thead>
              <tr className="bg-[#29B6D2] text-white">
                <th className="border border-gray-300 p-2 text-left font-bold">Message Type</th>
                <th className="border border-gray-300 p-2 text-left font-bold">Trigger</th>
                <th className="border border-gray-300 p-2 text-left font-bold">Channels</th>
                <th className="border border-gray-300 p-2 text-left font-bold">Status</th>
              </tr>
            </thead>
            <tbody>
              {rules.map((r, i) => (
                <tr key={r.message_type} className={i % 2 ? 'bg-gray-50' : ''}>
                  <td className="border border-gray-300 p-2">
                    <strong>{r.message_type}</strong>
                    {r.description && <><br/><span className="text-gray-600 text-xs">{r.description}</span></>}
                  </td>
                  <td className="border border-gray-300 p-2 text-xs">{r.trigger_type}</td>
                  <td className="border border-gray-300 p-2">{channelBadges(r)}</td>
                  <td className="border border-gray-300 p-2">
                    {r.is_active ? (
                      <span className="text-green-700 text-xs">Active</span>
                    ) : (
                      <span className="text-gray-500 text-xs">Inactive</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="bg-[#E8F7FA] border-l-4 border-[#29B6D2] p-4 rounded-r-lg mb-6">
          <p className="text-sm text-gray-700 flex items-center gap-2">
            <Users className="h-4 w-4 text-[#29B6D2]" />
            <span>User preference keys are now unified (one key per automation, three channel toggles each). Managed from the user dashboard → Settings → Notifications.</span>
          </p>
        </div>

        <div className="border-t-4 border-[#29B6D2] pt-6">
          <div className="flex justify-between items-start">
            <div>
              <h3 className="font-bold text-lg mb-2">Technical Notes</h3>
              <ul className="text-sm text-gray-600 space-y-1">
                <li>• 3-channel delivery: Email · Dashboard · Push (per user preference)</li>
                <li>• Email sender: notifications@smartygym.com</li>
                <li>• Reply-to: smartygym@outlook.com</li>
                <li>• Always-on (no opt-out): welcome, purchases, renewals, holidays, security</li>
              </ul>
            </div>
            <div className="text-right">
              <p className="text-sm text-gray-500">Live document · auto-synced</p>
              <p className="text-sm text-gray-500">Last Updated: {new Date().toLocaleDateString()}</p>
            </div>
          </div>
          <div className="text-center mt-6 text-xs text-gray-500">
            © {new Date().getFullYear()} SmartyGym. All rights reserved. | System Documentation
          </div>
        </div>
      </div>
    </div>
  );
};

export default CronJobsDocumentation;
