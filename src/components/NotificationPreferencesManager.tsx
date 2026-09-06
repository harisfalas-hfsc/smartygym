import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import {
  Loader2, Sun, Zap, Plus, BookOpen, FileText, BarChart3, Bell,
  CalendarClock, Trophy, Sparkles, Mail, Smartphone,
} from "lucide-react";
import { toast } from "sonner";

type Channel = "email" | "dashboard" | "push";
type ChannelPref = { email: boolean; dashboard: boolean; push: boolean };

type AutomationKey =
  | "morning_daily_digest"
  | "monday_motivation"
  | "new_workout"
  | "new_program"
  | "new_article"
  | "weekly_activity_report"
  | "checkin_reminder"
  | "scheduled_workout_reminder"
  | "scheduled_program_reminder"
  | "goal_achievement"
  | "welcome_onboarding"
  | "general_announcement";

type Preferences = {
  opt_out_all: boolean;
} & Record<AutomationKey, ChannelPref>;

const DEFAULT_CHANNEL: ChannelPref = { email: true, dashboard: true, push: true };

const DEFAULT_PREFS: Preferences = {
  opt_out_all: false,
  morning_daily_digest: { ...DEFAULT_CHANNEL },
  monday_motivation: { ...DEFAULT_CHANNEL },
  new_workout: { ...DEFAULT_CHANNEL },
  new_program: { ...DEFAULT_CHANNEL },
  new_article: { ...DEFAULT_CHANNEL },
  weekly_activity_report: { ...DEFAULT_CHANNEL },
  checkin_reminder: { ...DEFAULT_CHANNEL },
  scheduled_workout_reminder: { ...DEFAULT_CHANNEL },
  scheduled_program_reminder: { ...DEFAULT_CHANNEL },
  goal_achievement: { ...DEFAULT_CHANNEL },
  welcome_onboarding: { ...DEFAULT_CHANNEL },
  general_announcement: { ...DEFAULT_CHANNEL },
};

const ROWS: { key: AutomationKey; label: string; description: string; timing: string; icon: any }[] = [
  {
    key: "morning_daily_digest",
    label: "Morning Daily Digest",
    description: "One daily message with your Workout of the Day and Smarty Ritual.",
    timing: "Every day at 7:00 AM Cyprus",
    icon: Sun,
  },
  {
    key: "monday_motivation",
    label: "Monday Motivation",
    description: "Weekly motivational message to start your week.",
    timing: "Every Monday at 10:00 AM",
    icon: Zap,
  },
  {
    key: "new_workout",
    label: "New Workouts",
    description: "We let you know when a new workout is published.",
    timing: "Within 5 minutes of publication",
    icon: Plus,
  },
  {
    key: "new_program",
    label: "New Training Programs",
    description: "We let you know when a new program is published.",
    timing: "Within 5 minutes of publication",
    icon: BookOpen,
  },
  {
    key: "new_article",
    label: "New Blog Articles",
    description: "We let you know when a new article is published.",
    timing: "Within 5 minutes of publication",
    icon: FileText,
  },
  {
    key: "weekly_activity_report",
    label: "Weekly Activity Report",
    description: "Your weekly summary of workouts, check-ins and progress.",
    timing: "Every Monday at 9:00 AM",
    icon: BarChart3,
  },
  {
    key: "checkin_reminder",
    label: "Check-in Reminders",
    description: "Morning and evening reminders to log your check-in.",
    timing: "Every day at 8:00 AM & 8:00 PM",
    icon: Bell,
  },
  {
    key: "scheduled_workout_reminder",
    label: "Scheduled Workout Reminders",
    description: "Reminders for workouts you scheduled in your calendar.",
    timing: "At your chosen time",
    icon: CalendarClock,
  },
  {
    key: "scheduled_program_reminder",
    label: "Scheduled Program Reminders",
    description: "Reminders for training program days you scheduled.",
    timing: "At your chosen time",
    icon: CalendarClock,
  },
  {
    key: "goal_achievement",
    label: "Goal Achievements",
    description: "We celebrate with you when you hit a fitness goal.",
    timing: "Whenever you achieve a goal",
    icon: Trophy,
  },
  {
    key: "welcome_onboarding",
    label: "Welcome Onboarding Guide",
    description: "A 5-day guide to help you make the most of SmartyGym.",
    timing: "Days 1-5 after signup",
    icon: Sparkles,
  },
  {
    key: "general_announcement",
    label: "General Announcements",
    description: "Platform updates, new services, events, and non-essential admin announcements.",
    timing: "Only when SmartyGym has an announcement",
    icon: Bell,
  },
];

const CHANNELS: { id: Channel; label: string; icon: any }[] = [
  { id: "email", label: "Email", icon: Mail },
  { id: "dashboard", label: "Dashboard", icon: Bell },
  { id: "push", label: "Mobile Push", icon: Smartphone },
];

const LEGACY_PREF_KEYS: Record<AutomationKey, Record<Channel, string[]>> = {
  morning_daily_digest: {
    email: ["email_wod", "email_ritual"],
    dashboard: ["dashboard_wod", "dashboard_ritual"],
    push: ["mobile_push_wod", "mobile_push_ritual"],
  },
  monday_motivation: {
    email: ["email_monday_motivation"],
    dashboard: ["dashboard_monday_motivation"],
    push: ["mobile_push_monday_motivation"],
  },
  new_workout: {
    email: ["email_new_workout"],
    dashboard: ["dashboard_new_workout"],
    push: ["mobile_push_new_workout"],
  },
  new_program: {
    email: ["email_new_program"],
    dashboard: ["dashboard_new_program"],
    push: ["mobile_push_new_program"],
  },
  new_article: {
    email: ["email_new_article"],
    dashboard: ["dashboard_new_article"],
    push: ["mobile_push_new_article"],
  },
  weekly_activity_report: {
    email: ["email_weekly_activity"],
    dashboard: ["dashboard_weekly_activity"],
    push: ["mobile_push_weekly_activity"],
  },
  checkin_reminder: {
    email: ["email_checkin_reminders"],
    dashboard: ["dashboard_checkin_reminders"],
    push: ["mobile_push_checkin_reminders"],
  },
  scheduled_workout_reminder: {
    email: ["email_scheduled_workout_reminders"],
    dashboard: ["dashboard_scheduled_workout_reminders"],
    push: ["mobile_push_scheduled_workout_reminders"],
  },
  scheduled_program_reminder: {
    email: ["email_scheduled_program_reminders"],
    dashboard: ["dashboard_scheduled_program_reminders"],
    push: ["mobile_push_scheduled_program_reminders"],
  },
  goal_achievement: {
    email: ["email_goal_achievement"],
    dashboard: ["dashboard_goal_achievement"],
    push: ["mobile_push_goal_achievement"],
  },
  welcome_onboarding: {
    email: ["email_welcome_onboarding"],
    dashboard: ["dashboard_welcome_onboarding"],
    push: [],
  },
  general_announcement: {
    email: [],
    dashboard: [],
    push: [],
  },
};

function legacyChannelValue(raw: Record<string, any>, key: AutomationKey, channel: Channel): boolean {
  if (key === "checkin_reminder" && raw.checkin_reminders === false) return false;
  if (channel === "push" && raw.mobile_push_master === false) return false;
  const legacyKeys = LEGACY_PREF_KEYS[key][channel];
  if (legacyKeys.length === 0) return true;
  return legacyKeys.every((legacyKey) => raw[legacyKey] !== false);
}

function mergeLegacyKeys(raw: Record<string, any>, key: AutomationKey, channel: Channel, value: boolean) {
  if (key === "checkin_reminder" && value) raw.checkin_reminders = true;
  for (const legacyKey of LEGACY_PREF_KEYS[key][channel]) {
    raw[legacyKey] = value;
  }
}

function normalise(raw: any): Preferences {
  const base: Preferences = JSON.parse(JSON.stringify(DEFAULT_PREFS));
  if (!raw || typeof raw !== "object") return base;
  base.opt_out_all = raw.opt_out_all === true;
  for (const row of ROWS) {
    const node = raw[row.key];
    if (node && typeof node === "object") {
      base[row.key] = {
        email: node.email !== false && legacyChannelValue(raw, row.key, "email"),
        dashboard: node.dashboard !== false && legacyChannelValue(raw, row.key, "dashboard"),
        push: node.push !== false && legacyChannelValue(raw, row.key, "push"),
      };
    } else {
      base[row.key] = {
        email: legacyChannelValue(raw, row.key, "email"),
        dashboard: legacyChannelValue(raw, row.key, "dashboard"),
        push: legacyChannelValue(raw, row.key, "push"),
      };
    }
  }
  return base;
}

export const NotificationPreferencesManager = () => {
  const [prefs, setPrefs] = useState<Preferences>(DEFAULT_PREFS);
  // The untouched row exactly as stored in the database. Every save is merged on
  // top of this so legacy/one-click-unsubscribe flags are never silently dropped.
  const [rawPrefs, setRawPrefs] = useState<Record<string, any>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return;
        const { data, error } = await supabase
          .from("profiles")
          .select("notification_preferences")
          .eq("user_id", user.id)
          .single();
        if (error) {
          console.error("Load prefs failed:", error);
          return;
        }
        const raw = (data?.notification_preferences as Record<string, any>) || {};
        setRawPrefs(raw);
        setPrefs(normalise(raw));
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const persist = async (nextRaw: Record<string, any>) => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      toast.error("Please log in.");
      return false;
    }
    const { error } = await supabase
      .from("profiles")
      .update({ notification_preferences: nextRaw as any })
      .eq("user_id", user.id);
    if (error) throw error;
    // Read back so the UI always reflects what is actually stored.
    const { data: verify } = await supabase
      .from("profiles")
      .select("notification_preferences")
      .eq("user_id", user.id)
      .single();
    const stored = (verify?.notification_preferences as Record<string, any>) || nextRaw;
    setRawPrefs(stored);
    setPrefs(normalise(stored));
    return true;
  };

  const toggleChannel = async (key: AutomationKey, channel: Channel, value: boolean) => {
    const saveKey = `${key}:${channel}`;
    setSaving(saveKey);
    try {
      const existingNode =
        rawPrefs[key] && typeof rawPrefs[key] === "object" ? rawPrefs[key] : {};
      const nextRaw: Record<string, any> = {
        ...rawPrefs,
        [key]: { ...existingNode, ...prefs[key], [channel]: value },
      };
      mergeLegacyKeys(nextRaw, key, channel, value);
      if (value) {
        // Turning something back on must also lift a previous global opt-out,
        // otherwise the switch would look ON while nothing is delivered.
        nextRaw.opt_out_all = false;
        if (channel === "email") nextRaw.email_notifications = true;
      }
      const ok = await persist(nextRaw);
      if (ok) toast.success(value ? "Turned on" : "Turned off");
    } catch (e) {
      console.error(e);
      toast.error("Could not update preference");
    } finally {
      setSaving(null);
    }
  };

  const toggleOptOutAll = async (value: boolean) => {
    setSaving("opt_out_all");
    try {
      const nextRaw: Record<string, any> = { ...rawPrefs, opt_out_all: value };
      if (value) {
        nextRaw.email_notifications = false;
        nextRaw.opted_out_at = new Date().toISOString();
      } else {
        // Resuming clears the flat flags a one-click unsubscribe may have set,
        // so the per-item switches below become the single source of truth.
        nextRaw.email_notifications = true;
        for (const row of ROWS) {
          for (const ch of CHANNELS) {
            for (const legacyKey of LEGACY_PREF_KEYS[row.key][ch.id]) {
              if (nextRaw[legacyKey] === false) delete nextRaw[legacyKey];
            }
          }
        }
        if (nextRaw.checkin_reminders === false) delete nextRaw.checkin_reminders;
      }
      const ok = await persist(nextRaw);
      if (ok) toast.success(value ? "All notifications paused" : "Notifications resumed");
    } catch (e) {
      console.error(e);
      toast.error("Could not update preference");
    } finally {
      setSaving(null);
    }
  };

  if (loading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }

  const disabledAll = prefs.opt_out_all;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg">Notifications</CardTitle>
        <CardDescription>
          Choose which messages you want to receive — independently by channel.
          You can turn Email, Dashboard, and Mobile Push on or off for each item.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Master kill-switch */}
        <div className="flex items-center justify-between p-4 rounded-lg bg-muted/40">
          <div>
            <Label htmlFor="opt_out_all" className="font-medium cursor-pointer">
              Pause all notifications
            </Label>
            <p className="text-xs text-muted-foreground mt-1">
              Turns off every channel below. Essential account messages
              (welcome, purchases, renewals, holidays) are still delivered.
            </p>
          </div>
          <Switch
            id="opt_out_all"
            checked={prefs.opt_out_all}
            onCheckedChange={toggleOptOutAll}
            disabled={saving === "opt_out_all"}
          />
        </div>

        {/* Per-automation 3-channel grid */}
        <div className="space-y-1">
          {ROWS.map((row) => {
            const Icon = row.icon;
            const pref = prefs[row.key];
            return (
              <div
                key={row.key}
                className="py-4 border-b last:border-0 flex flex-col md:flex-row md:items-center md:justify-between gap-3"
              >
                <div className="flex items-start gap-3 flex-1">
                  <div className="mt-0.5 p-2 rounded-lg bg-primary/10 shrink-0">
                    <Icon className="h-4 w-4 text-primary" />
                  </div>
                  <div className="space-y-0.5">
                    <Label className="text-sm font-medium">{row.label}</Label>
                    <p className="text-xs text-muted-foreground">{row.description}</p>
                    <p className="text-xs text-primary font-medium">{row.timing}</p>
                  </div>
                </div>
                <div className="flex items-center gap-4 md:gap-6 md:pl-4 pl-10 flex-wrap">
                  {CHANNELS.map((ch) => {
                    const ChIcon = ch.icon;
                    const saveKey = `${row.key}:${ch.id}`;
                    const isOn = pref[ch.id] && !disabledAll;
                    return (
                      <div key={ch.id} className="flex items-center gap-2">
                        <ChIcon className="h-3.5 w-3.5 text-muted-foreground" />
                        <span className="text-xs text-muted-foreground hidden sm:inline">
                          {ch.label}
                        </span>
                        {saving === saveKey && (
                          <Loader2 className="h-3 w-3 animate-spin text-muted-foreground" />
                        )}
                        <Switch
                          checked={isOn}
                          onCheckedChange={(v) => toggleChannel(row.key, ch.id, v)}
                          disabled={disabledAll || saving === saveKey}
                          aria-label={`${row.label} — ${ch.label}`}
                        />
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>

        <div className="mt-2 p-4 bg-muted/50 rounded-lg">
          <p className="text-xs text-muted-foreground">
            <strong>Always delivered:</strong> welcome message, purchase
            confirmations, subscription renewals, holiday greetings, and
            replies from Coach Haris.
          </p>
        </div>
      </CardContent>
    </Card>
  );
};

export default NotificationPreferencesManager;