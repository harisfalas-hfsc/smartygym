import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Copy, Check, Dumbbell, Sun, Zap, Plus, BookOpen, FileText, BarChart3, Bell, ExternalLink } from "lucide-react";
import { toast } from "sonner";

interface NotificationTemplate {
  id: string;
  type: string;
  title: string;
  message: string;
  link: string;
  imageUrl?: string;
  icon: React.ComponentType<{ className?: string }>;
  frequency: string;
}

const NOTIFICATION_TEMPLATES: NotificationTemplate[] = [
  {
    id: "wod",
    type: "Workout of the Day",
    title: "💪 Today's WOD is Ready!",
    message: "Your daily workout is waiting. Let's crush it!",
    link: "/workout/wod",
    icon: Dumbbell,
    frequency: "Daily",
  },
  {
    id: "ritual",
    type: "Smarty Ritual",
    title: "🌅 Start Your Smarty Ritual",
    message: "Your morning ritual is ready. Mind, body, focus.",
    link: "/smarty-ritual",
    icon: Sun,
    frequency: "Daily",
  },
  {
    id: "monday_motivation",
    type: "Monday Motivation",
    title: "🔥 Monday Motivation",
    message: "New week, new goals. Let's make this week count!",
    link: "/dashboard",
    icon: Zap,
    frequency: "Weekly (Monday)",
  },
  {
    id: "new_workout",
    type: "New Workout",
    title: "🆕 New Workout Added!",
    message: "Check out our latest workout just added to the library!",
    link: "/workout-library",
    icon: Plus,
    frequency: "When published",
  },
  {
    id: "new_program",
    type: "New Program",
    title: "📚 New Training Program!",
    message: "A new training program is now available. Start your journey!",
    link: "/training-programs",
    icon: BookOpen,
    frequency: "When published",
  },
  {
    id: "new_article",
    type: "New Article",
    title: "📖 Fresh Content Published!",
    message: "New article just dropped on our blog. Check it out!",
    link: "/blog",
    icon: FileText,
    frequency: "When published",
  },
  {
    id: "weekly_activity",
    type: "Weekly Activity",
    title: "📊 Your Weekly Summary",
    message: "See your fitness progress this week. Keep up the momentum!",
    link: "/dashboard",
    icon: BarChart3,
    frequency: "Weekly (Sunday)",
  },
  {
    id: "checkin_morning",
    type: "Morning Check-in",
    title: "☀️ Good Morning!",
    message: "Ready to start your day? Complete your morning check-in.",
    link: "/smarty-ritual",
    icon: Bell,
    frequency: "Daily (Morning)",
  },
  {
    id: "checkin_evening",
    type: "Evening Check-in",
    title: "🌙 Evening Check-in",
    message: "How was your day? Log your evening check-in before bed.",
    link: "/smarty-ritual",
    icon: Bell,
    frequency: "Daily (Evening)",
  },
];

export const MobilePushTemplates = () => {
  const [copiedField, setCopiedField] = useState<string | null>(null);

  const copyToClipboard = (text: string, fieldId: string) => {
    navigator.clipboard.writeText(text);
    setCopiedField(fieldId);
    toast.success("Copied to clipboard!");
    setTimeout(() => setCopiedField(null), 2000);
  };

  const getFullUrl = (link: string) => {
    // Use your production URL
    return `https://smartygym.com${link}`;
  };

  const CopyButton = ({ text, fieldId }: { text: string; fieldId: string }) => (
    <Button
      variant="ghost"
      size="icon"
      className="h-7 w-7 shrink-0"
      onClick={() => copyToClipboard(text, fieldId)}
    >
      {copiedField === fieldId ? (
        <Check className="h-3 w-3 text-green-500" />
      ) : (
        <Copy className="h-3 w-3" />
      )}
    </Button>
  );

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-lg">Notification Templates for AppMySite</CardTitle>
        <CardDescription>
          Ready-to-use templates for manual push notifications. Click to copy each field.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {NOTIFICATION_TEMPLATES.map((template) => {
          const Icon = template.icon;
          const fullUrl = getFullUrl(template.link);
          
          return (
            <div
              key={template.id}
              className="border rounded-lg p-4 space-y-3 hover:bg-muted/10 transition-colors"
            >
              {/* Header */}
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex min-w-0 items-center gap-2">
                  <div className="p-2 rounded-lg bg-primary/10 shrink-0">
                    <Icon className="h-4 w-4 text-primary" />
                  </div>
                  <span className="font-semibold break-words">{template.type}</span>
                </div>
                <Badge variant="outline" className="text-xs shrink-0">
                  {template.frequency}
                </Badge>
              </div>

              {/* Template Fields */}
              <div className="grid gap-2 text-sm min-w-0">
                {/* Title */}
                <div className="flex min-w-0 items-start gap-2 p-2 bg-muted/30 rounded border">
                  <span className="text-xs font-medium text-muted-foreground w-16 shrink-0 pt-0.5">Title:</span>
                  <span className="flex-1 min-w-0 font-medium break-words">{template.title}</span>
                  <CopyButton text={template.title} fieldId={`${template.id}-title`} />
                </div>

                {/* Message */}
                <div className="flex min-w-0 items-start gap-2 p-2 bg-muted/30 rounded border">
                  <span className="text-xs font-medium text-muted-foreground w-16 shrink-0 pt-0.5">Message:</span>
                  <span className="flex-1 min-w-0 break-words">{template.message}</span>
                  <CopyButton text={template.message} fieldId={`${template.id}-message`} />
                </div>

                {/* Link */}
                <div className="flex min-w-0 items-start gap-2 p-2 bg-muted/30 rounded border">
                  <span className="text-xs font-medium text-muted-foreground w-16 shrink-0 pt-0.5">Link:</span>
                  <span className="flex-1 min-w-0 text-xs font-mono break-all text-primary">{fullUrl}</span>
                  <CopyButton text={fullUrl} fieldId={`${template.id}-link`} />
                  <a 
                    href={fullUrl} 
                    target="_blank" 
                    rel="noopener noreferrer"
                    className="shrink-0"
                  >
                    <Button variant="ghost" size="icon" className="h-7 w-7">
                      <ExternalLink className="h-3 w-3" />
                    </Button>
                  </a>
                </div>
              </div>

              {/* Copy All Button */}
              <Button
                variant="outline"
                size="sm"
                className="w-full mt-2"
                onClick={() => {
                  const allText = `Title: ${template.title}\nMessage: ${template.message}\nLink: ${fullUrl}`;
                  copyToClipboard(allText, `${template.id}-all`);
                }}
              >
                {copiedField === `${template.id}-all` ? (
                  <Check className="h-4 w-4 mr-2 text-green-500" />
                ) : (
                  <Copy className="h-4 w-4 mr-2" />
                )}
                Copy All Fields
              </Button>
            </div>
          );
        })}

        <div className="p-4 bg-amber-500/10 border border-amber-500/30 rounded-lg mt-4">
          <p className="text-sm font-medium text-amber-600 dark:text-amber-400">
            💡 Tip for AppMySite
          </p>
          <p className="text-xs text-muted-foreground mt-1">
            When sending notifications in AppMySite dashboard, paste the Title, Message, and Link into their respective fields. 
            For images, you can use workout thumbnails or leave blank for text-only notifications.
          </p>
        </div>
      </CardContent>
    </Card>
  );
};
