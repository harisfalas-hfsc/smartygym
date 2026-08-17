import { useEffect, useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Apple, Bot, CreditCard, Globe, KeyRound, Lock, Webhook } from "lucide-react";
import { FREE_ACCESS_SETTING_KEY, setFreeAccessModeCache, useFreeAccessMode } from "@/hooks/useFreeAccessMode";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { STRIPE_PRICE_IDS, SUBSCRIPTION_PRICES, CORPORATE_PRICES } from "@/config/pricing";

const PLATFORM_KEYS = {
  ios: "payments_enabled_ios",
  android: "payments_enabled_android",
} as const;

type NativePlatform = keyof typeof PLATFORM_KEYS;

const WEBHOOK_URL =
  "https://cvccrvyimyzrxcwzmxwk.supabase.co/functions/v1/stripe-webhook";

const WEBHOOK_EVENTS = [
  "checkout.session.completed",
  "customer.subscription.created",
  "customer.subscription.updated",
  "customer.subscription.deleted",
  "invoice.paid",
  "invoice.payment_failed",
  "charge.refunded",
];

const CONFIG_ROW = (label: string, value: string) => ({ label, value });

const PlatformPanel = ({
  platform,
  title,
  storeName,
  guideline,
  enabled,
  saving,
  onToggle,
}: {
  platform: NativePlatform;
  title: string;
  storeName: string;
  guideline: string;
  enabled: boolean;
  saving: boolean;
  onToggle: (next: boolean) => void;
}) => (
  <div className="space-y-4">
    <div className="flex items-start justify-between gap-4 rounded-lg border p-4">
      <div className="space-y-1">
        <Label htmlFor={`toggle-${platform}`} className="text-base font-semibold">
          Purchasing on {title}
        </Label>
        <p className="text-sm text-muted-foreground">
          When off, every purchase button on {title} is replaced with a message
          pointing to the website. No prices, no checkout links.
        </p>
      </div>
      <Switch
        id={`toggle-${platform}`}
        checked={enabled}
        disabled={saving}
        onCheckedChange={onToggle}
      />
    </div>

    <div className="flex flex-wrap items-center gap-2">
      <span className="text-sm text-muted-foreground">
        Purchases visible to {storeName} reviewers:
      </span>
      <Badge variant={enabled ? "destructive" : "secondary"}>
        {enabled ? "YES" : "NO"}
      </Badge>
    </div>

    <p className="text-xs text-muted-foreground leading-relaxed">{guideline}</p>
  </div>
);

export const PaymentsManager = () => {
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<NativePlatform | null>(null);
  const [settings, setSettings] = useState<Record<NativePlatform, boolean>>({
    ios: true,
    android: true,
  });
  const [secretStatus, setSecretStatus] = useState<Record<string, boolean> | null>(null);

  useEffect(() => {
    const load = async () => {
      const { data, error } = await supabase
        .from("system_settings")
        .select("setting_key, setting_value")
        .in("setting_key", [PLATFORM_KEYS.ios, PLATFORM_KEYS.android]);

      if (error) {
        toast({
          title: "Could not load payment settings",
          description: error.message,
          variant: "destructive",
        });
      } else {
        const next = { ios: true, android: true };
        for (const row of data ?? []) {
          const on = row.setting_value === true || row.setting_value === "true";
          if (row.setting_key === PLATFORM_KEYS.ios) next.ios = on;
          if (row.setting_key === PLATFORM_KEYS.android) next.android = on;
        }
        setSettings(next);
      }
      setLoading(false);
    };
    load();
  }, [toast]);

  useEffect(() => {
    supabase.functions
      .invoke("check-stripe-config")
      .then(({ data }) => {
        if (data?.secrets) setSecretStatus(data.secrets);
      })
      .catch(() => setSecretStatus(null));
  }, []);

  const { freeAccessMode } = useFreeAccessMode();
  const [freeAccess, setFreeAccess] = useState(freeAccessMode);
  const [savingFreeAccess, setSavingFreeAccess] = useState(false);

  useEffect(() => {
    setFreeAccess(freeAccessMode);
  }, [freeAccessMode]);

  const handleFreeAccessToggle = async (next: boolean) => {
    setSavingFreeAccess(true);
    const { error } = await supabase
      .from("system_settings")
      .update({ setting_value: next as unknown as never })
      .eq("setting_key", FREE_ACCESS_SETTING_KEY);

    if (error) {
      toast({ title: "Failed to save", description: error.message, variant: "destructive" });
    } else {
      setFreeAccess(next);
      setFreeAccessModeCache(next);
      toast({
        title: next ? "Free Access Mode ON" : "Free Access Mode OFF",
        description: next
          ? "All content is free for signed-in members. Every price, purchase button and premium page is hidden everywhere."
          : "Normal paid mode restored. Existing subscriptions were never touched.",
      });
    }
    setSavingFreeAccess(false);
  };

  const handleToggle = async (platform: NativePlatform, next: boolean) => {
    setSaving(platform);
    const { error } = await supabase
      .from("system_settings")
      .update({ setting_value: next as unknown as never })
      .eq("setting_key", PLATFORM_KEYS[platform]);

    if (error) {
      toast({
        title: "Failed to save",
        description: error.message,
        variant: "destructive",
      });
    } else {
      setSettings((s) => ({ ...s, [platform]: next }));
      toast({
        title: next ? "Purchases enabled" : "Purchases disabled",
        description: `${platform === "ios" ? "iOS" : "Android"} app updated immediately — no rebuild needed.`,
      });
    }
    setSaving(null);
  };

  const activeProduct = [
    CONFIG_ROW("Product", "SmartyGym Premium Monthly"),
    CONFIG_ROW("Price", `€${SUBSCRIPTION_PRICES.premium_monthly.toFixed(2)} / month (recurring)`),
    CONFIG_ROW("Product ID", "prod_UqU78UzgA2ckcP"),
    CONFIG_ROW("Price ID", STRIPE_PRICE_IDS.premium_monthly),
  ];

  const corporateRows = [
    CONFIG_ROW(`Dynamic — €${CORPORATE_PRICES.dynamic}/yr`, STRIPE_PRICE_IDS.corporate_dynamic),
    CONFIG_ROW(`Power — €${CORPORATE_PRICES.power}/yr`, STRIPE_PRICE_IDS.corporate_power),
    CONFIG_ROW(`Elite — €${CORPORATE_PRICES.elite}/yr`, STRIPE_PRICE_IDS.corporate_elite),
    CONFIG_ROW(`Enterprise — €${CORPORATE_PRICES.enterprise}/yr`, STRIPE_PRICE_IDS.corporate_enterprise),
  ];

  return (
    <div className="space-y-6">
      <Card className={freeAccess ? "border-amber-500" : undefined}>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Lock className="w-5 h-5" />
            Global Free Access Mode
          </CardTitle>
          <CardDescription>
            Master switch. When ON, every signed-in member gets full premium access and
            the whole app becomes free-only: no prices, no purchase buttons, no premium or
            corporate pages, no "buy on the website" notices. Nothing in Stripe changes and
            existing subscriptions keep billing — flip it back any time.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-start justify-between gap-4 rounded-lg border p-4">
            <div className="space-y-1">
              <Label htmlFor="toggle-free-access" className="text-base font-semibold">
                Make the entire app free
              </Label>
              <p className="text-sm text-muted-foreground">
                Use this for App Store / Play Store review when a reviewer must not see any
                purchase path at all.
              </p>
            </div>
            <Switch
              id="toggle-free-access"
              checked={freeAccess}
              disabled={savingFreeAccess}
              onCheckedChange={handleFreeAccessToggle}
            />
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-sm text-muted-foreground">Current state:</span>
            <Badge variant={freeAccess ? "destructive" : "secondary"}>
              {freeAccess ? "EVERYTHING FREE" : "NORMAL PAID MODE"}
            </Badge>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <CreditCard className="w-5 h-5" />
            Payments
          </CardTitle>
          <CardDescription>
            Stripe configuration and per-platform purchase controls
          </CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <Skeleton className="h-40 w-full" />
          ) : (
            <>
            {freeAccess && (
              <div className="mb-4 rounded-lg border border-amber-500 bg-amber-500/10 p-3 text-sm">
                <strong>Free Access Mode is ON.</strong> It overrides everything below —
                purchases are forced OFF on iOS, Android and web, no matter what these
                switches say. Turn it off to restore the per-platform controls.
              </div>
            )}
            <Tabs defaultValue="ios" className="w-full">
              <TabsList className="grid w-full grid-cols-3">
                <TabsTrigger value="ios" className="flex items-center gap-2">
                  <Apple className="w-4 h-4" /> iOS / iPhone
                </TabsTrigger>
                <TabsTrigger value="android" className="flex items-center gap-2">
                  <Bot className="w-4 h-4" /> Android
                </TabsTrigger>
                <TabsTrigger value="web" className="flex items-center gap-2">
                  <Globe className="w-4 h-4" /> Web
                </TabsTrigger>
              </TabsList>

              <TabsContent value="ios" className="mt-4">
                <PlatformPanel
                  platform="ios"
                  title="iOS / iPhone"
                  storeName="Apple / iPhone users"
                  enabled={freeAccess ? false : settings.ios}
                  saving={saving === "ios" || freeAccess}
                  onToggle={(next) => handleToggle("ios", next)}
                  guideline="Apple App Store Guideline 3.1.1 requires digital goods sold inside an iOS app (or viewed on iPhone Safari/Chrome) to use Apple In-App Purchase. Switch this off during review so no external payment path is visible on the native iOS app or on iPhone browsers, then switch it back on once the app is approved."
                />
              </TabsContent>

              <TabsContent value="android" className="mt-4">
                <PlatformPanel
                  platform="android"
                  title="Android"
                  storeName="Google Play"
                  enabled={freeAccess ? false : settings.android}
                  saving={saving === "android" || freeAccess}
                  onToggle={(next) => handleToggle("android", next)}
                  guideline="Google Play's Payments policy requires in-app digital purchases to use Play Billing. Switch this off during review, then back on after approval."
                />
              </TabsContent>

              <TabsContent value="web" className="mt-4">
                <div className="rounded-lg border p-4 space-y-2">
                  <p className="font-semibold">
                    {freeAccess ? "Web purchasing is OFF (Free Access Mode)" : "Web purchasing is always on"}
                  </p>
                  <p className="text-sm text-muted-foreground">
                    smartygym.com sells normally at all times through Stripe. This is
                    intentional and cannot be switched off — it is where users are sent
                    when a mobile platform is disabled.
                  </p>
                  <Badge variant={freeAccess ? "destructive" : "secondary"}>
                    {freeAccess ? "Disabled by Free Access Mode" : "Enabled"}
                  </Badge>
                </div>
              </TabsContent>
            </Tabs>
            </>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <CreditCard className="w-5 h-5" />
            Stripe Configuration
          </CardTitle>
          <CardDescription>Active products and price IDs currently on sale</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div>
            <h4 className="font-semibold mb-2">Membership</h4>
            <div className="rounded-lg border divide-y">
              {activeProduct.map((row) => (
                <div key={row.label} className="flex flex-wrap justify-between gap-2 p-3 text-sm">
                  <span className="text-muted-foreground">{row.label}</span>
                  <code className="font-mono text-xs break-all">{row.value}</code>
                </div>
              ))}
            </div>
          </div>

          <div>
            <h4 className="font-semibold mb-2">Corporate plans</h4>
            <div className="rounded-lg border divide-y">
              {corporateRows.map((row) => (
                <div key={row.label} className="flex flex-wrap justify-between gap-2 p-3 text-sm">
                  <span className="text-muted-foreground">{row.label}</span>
                  <code className="font-mono text-xs break-all">{row.value}</code>
                </div>
              ))}
            </div>
          </div>

          <div>
            <h4 className="font-semibold mb-2 flex items-center gap-2">
              <Webhook className="w-4 h-4" /> Webhook
            </h4>
            <div className="rounded-lg border p-3 space-y-2">
              <code className="font-mono text-xs break-all block">{WEBHOOK_URL}</code>
              <div className="flex flex-wrap gap-1.5">
                {WEBHOOK_EVENTS.map((e) => (
                  <Badge key={e} variant="outline" className="font-mono text-[10px]">
                    {e}
                  </Badge>
                ))}
              </div>
            </div>
          </div>

          <div>
            <h4 className="font-semibold mb-2 flex items-center gap-2">
              <KeyRound className="w-4 h-4" /> Secrets
            </h4>
            <div className="rounded-lg border divide-y">
              {["STRIPE_SECRET_KEY", "STRIPE_WEBHOOK_SECRET"].map((name) => {
                const configured = secretStatus ? secretStatus[name] : undefined;
                return (
                  <div key={name} className="flex justify-between items-center gap-2 p-3 text-sm">
                    <code className="font-mono text-xs">{name}</code>
                    <Badge
                      variant={
                        configured === undefined ? "outline" : configured ? "secondary" : "destructive"
                      }
                    >
                      {configured === undefined ? "Checking…" : configured ? "Configured" : "Missing"}
                    </Badge>
                  </div>
                );
              })}
            </div>
            <p className="text-xs text-muted-foreground mt-2">
              Values are never displayed. Status only.
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};