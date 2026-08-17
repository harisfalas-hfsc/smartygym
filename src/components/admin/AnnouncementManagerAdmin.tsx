import { useEffect, useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Megaphone } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import {
  SISTER_ANNOUNCEMENT_SETTING_KEY,
  setSisterAnnouncementCache,
  useSisterAnnouncement,
} from "@/hooks/useSisterAnnouncement";

export const AnnouncementManagerAdmin = () => {
  const { toast } = useToast();
  const { enabled, loading } = useSisterAnnouncement();
  const [value, setValue] = useState(enabled);
  const [saving, setSaving] = useState(false);

  useEffect(() => setValue(enabled), [enabled]);

  const handleToggle = async (next: boolean) => {
    setSaving(true);
    const { error } = await supabase
      .from("system_settings")
      .update({ setting_value: next as unknown as never })
      .eq("setting_key", SISTER_ANNOUNCEMENT_SETTING_KEY);

    if (error) {
      toast({ title: "Failed to save", description: error.message, variant: "destructive" });
    } else {
      setValue(next);
      setSisterAnnouncementCache(next);
      toast({
        title: next ? "Announcement enabled" : "Announcement disabled",
        description: next
          ? "The Smarty family popup will show to visitors again."
          : "The Smarty family popup is now hidden everywhere.",
      });
    }
    setSaving(false);
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Megaphone className="w-5 h-5" />
          Announcement
        </CardTitle>
        <CardDescription>
          Control the sister-apps announcement popup (SmartyMove, SmartyWorkout, SmartyDiet)
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="flex items-start justify-between gap-4 rounded-lg border p-4">
          <div className="space-y-1">
            <Label htmlFor="toggle-sister-announcement" className="text-base font-semibold">
              Sister Apps Announcement
            </Label>
            <p className="text-sm text-muted-foreground">
              When off, the slide-in Smarty family panel never appears on any page.
            </p>
          </div>
          <div className="flex flex-col items-end gap-2">
            <Switch
              id="toggle-sister-announcement"
              checked={value}
              disabled={loading || saving}
              onCheckedChange={handleToggle}
            />
            <Badge variant={value ? "default" : "secondary"}>{value ? "VISIBLE" : "HIDDEN"}</Badge>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};
