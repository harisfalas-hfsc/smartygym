import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { AlertTriangle, CheckCircle2, ChevronDown, ChevronUp, Dumbbell } from "lucide-react";
import { format } from "date-fns";
import { normalizeWorkoutHtml } from "@/utils/htmlNormalizer";

interface CustomWorkoutRow {
  id: string;
  name: string;
  category: string | null;
  format: string | null;
  difficulty_label: string | null;
  duration_label: string | null;
  duration_min: number | null;
  equipment: string[] | null;
  location: string | null;
  status: string | null;
  needs_review: boolean | null;
  review_warnings: string[] | null;
  is_shared: boolean | null;
  main_workout: string | null;
  instructions_html: string | null;
  tips_html: string | null;
  created_at: string;
  generation_error: string | null;
}

const REQUIRED_SECTIONS = [
  { label: "Soft Tissue Prep", match: /soft tissue|warm[\s-]?up/i },
  { label: "Activation", match: /activation/i },
  { label: "Main Workout", match: /main workout/i },
  { label: "Finisher", match: /finisher/i },
  { label: "Cool Down", match: /cool[\s-]?down/i },
];

function checkStructure(w: CustomWorkoutRow) {
  const html = w.main_workout ? normalizeWorkoutHtml(w.main_workout) : "";
  const text = html.replace(/<[^>]+>/g, " ");
  const missing = REQUIRED_SECTIONS.filter((s) => !s.match.test(text)).map((s) => s.label);
  // Exercises are stored as library references ({{exercise:ID:Name}}) and are
  // turned into links when the workout is displayed — both forms count.
  const exerciseLinks =
    (html.match(/\{\{exercise:/g) || []).length + (html.match(/href="\/exercise/g) || []).length;
  const issues: string[] = [];
  if (!html.trim()) issues.push("No workout content saved");
  else if (missing.length) issues.push(`Missing sections: ${missing.join(", ")}`);
  else if (exerciseLinks === 0) issues.push("No exercises from the library");
  if (w.status === "failed" && w.generation_error) issues.push(w.generation_error);
  return { html, issues, exerciseLinks };
}

export function UserWorkoutsTab({ userId }: { userId: string }) {
  const [rows, setRows] = useState<CustomWorkoutRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [openId, setOpenId] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      const { data } = await supabase
        .from("user_custom_workouts")
        .select("*")
        .eq("user_id", userId)
        .order("created_at", { ascending: false });
      if (!cancelled) {
        setRows((data as unknown as CustomWorkoutRow[]) || []);
        setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [userId]);

  const checked = useMemo(() => rows.map((w) => ({ w, ...checkStructure(w) })), [rows]);
  const flagged = checked.filter((c) => c.issues.length > 0).length;

  if (loading) {
    return (
      <div className="space-y-2">
        <Skeleton className="h-16 w-full rounded-lg" />
        <Skeleton className="h-16 w-full rounded-lg" />
      </div>
    );
  }

  if (rows.length === 0) {
    return <p className="text-sm text-muted-foreground">This member has not created any workouts yet.</p>;
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
        <Badge variant="outline">{rows.length} created</Badge>
        {flagged > 0 ? (
          <Badge variant="destructive">{flagged} need a look</Badge>
        ) : (
          <Badge className="bg-green-600 text-white hover:bg-green-700">All well structured</Badge>
        )}
      </div>

      {checked.map(({ w, html, issues, exerciseLinks }) => {
        const isOpen = openId === w.id;
        return (
          <div key={w.id} className="rounded-lg border p-3">
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <p className="flex items-center gap-2 font-medium break-words">
                  <Dumbbell className="h-4 w-4 shrink-0 text-muted-foreground" />
                  <span className="break-words">{w.name}</span>
                </p>
                <p className="mt-1 text-xs text-muted-foreground break-words">
                  {[w.category, w.format, w.difficulty_label, w.duration_label || (w.duration_min ? `${w.duration_min} min` : null), w.location]
                    .filter(Boolean)
                    .join(" • ")}
                </p>
                <p className="mt-1 text-xs text-muted-foreground">
                  {format(new Date(w.created_at), "MMM d, yyyy")} • {exerciseLinks} linked exercises
                  {w.equipment?.length ? ` • ${w.equipment.join(", ")}` : ""}
                </p>
              </div>
              <div className="flex shrink-0 flex-col items-end gap-1">
                {w.status && w.status !== "created" && (
                  <Badge variant="secondary" className="text-[10px]">{w.status}</Badge>
                )}
                {w.is_shared && <Badge variant="outline" className="text-[10px]">Shared</Badge>}
                {issues.length === 0 ? (
                  <CheckCircle2 className="h-4 w-4 text-green-600" />
                ) : (
                  <AlertTriangle className="h-4 w-4 text-amber-500" />
                )}
              </div>
            </div>

            {issues.length > 0 && (
              <ul className="mt-2 list-disc space-y-0.5 pl-5 text-xs text-amber-600 dark:text-amber-400">
                {issues.map((i, idx) => (
                  <li key={idx}>{i}</li>
                ))}
              </ul>
            )}

            <Button
              variant="ghost"
              size="sm"
              className="mt-2 h-8 px-2 text-xs"
              onClick={() => setOpenId(isOpen ? null : w.id)}
            >
              {isOpen ? <ChevronUp className="mr-1 h-3 w-3" /> : <ChevronDown className="mr-1 h-3 w-3" />}
              {isOpen ? "Hide workout" : "View workout"}
            </Button>

            {isOpen && (
              <div className="mt-2 rounded-md bg-muted/40 p-3">
                {html ? (
                  <div
                    className="workout-content prose prose-sm max-w-none dark:prose-invert text-sm break-words"
                    dangerouslySetInnerHTML={{ __html: html }}
                  />
                ) : (
                  <p className="text-xs text-muted-foreground">No content saved for this workout.</p>
                )}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
