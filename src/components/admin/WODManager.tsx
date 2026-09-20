import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { toast } from "sonner";
import {
  Flame,
  RefreshCw,
  Calendar,
  ExternalLink,
  BookOpen,
  Edit,
  HeartPulse,
  Rocket,
  Shield,
  Library,
  Eye,
  Trash2,
} from "lucide-react";
import { format, addDays } from "date-fns";
import { WODSchedulePreview } from "./WODSchedulePreview";
import { PeriodizationSystemDialog } from "./PeriodizationSystemDialog";
import { WorkoutEditDialog } from "./WorkoutEditDialog";
import { TomorrowWODPreviewDialog } from "./TomorrowWODPreviewDialog";
import { getWODInfoForDate, getDayIn84Cycle } from "@/lib/wodCycle";
import { getCyprusTodayStr } from "@/lib/cyprusDate";

/**
 * WOD Manager — LIBRARY MODE ONLY.
 *
 * AI generation has been removed entirely. The system now selects the daily
 * Workout of the Day from existing published library workouts using the
 * 84-day periodization. This panel surfaces:
 *   - Today's active WODs
 *   - The next 7 days planned categories
   *   - Health / Future Ready / verification checks (all read-only)
 *   - Periodization view + recent picks history
 */
export const WODManager = () => {
  const [isRunningHealthCheck, setIsRunningHealthCheck] = useState(false);
  const [isCheckingFuture, setIsCheckingFuture] = useState(false);
  const [isRunningWatchdog, setIsRunningWatchdog] = useState(false);
  const [periodizationDialogOpen, setPeriodizationDialogOpen] = useState(false);
  const [tomorrowPreviewOpen, setTomorrowPreviewOpen] = useState(false);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [editingWorkout, setEditingWorkout] = useState<any>(null);
  const queryClient = useQueryClient();

  const handleDeleteWorkout = async (wod: any) => {
    if (!confirm(`Delete "${wod.name}"? This permanently removes the workout from the library.`)) return;
    try {
      const { error } = await supabase.from("admin_workouts").delete().eq("id", wod.id);
      if (error) throw error;
      toast.success("Workout deleted", { description: wod.name });
      queryClient.invalidateQueries({ queryKey: ["current-wod"] });
      queryClient.invalidateQueries({ queryKey: ["wod-history"] });
    } catch (e: any) {
      toast.error("Delete failed", { description: e?.message || String(e) });
    }
  };

  const cyprusToday = getCyprusTodayStr();

  // Today's active WODs
  const { data: currentWODs, isLoading: wodLoading } = useQuery({
    queryKey: ["current-wod", cyprusToday],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("admin_workouts")
        .select("*")
        .eq("is_workout_of_day", true)
        .eq("generated_for_date", cyprusToday);
      if (error) throw error;
      return data || [];
    },
  });

  // Recent library picks (last 30 WOD rows)
  const { data: wodHistory, isLoading: historyLoading } = useQuery({
    queryKey: ["wod-history"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("admin_workouts")
        .select("*")
        .eq("wod_source", "library")
        .order("updated_at", { ascending: false })
        .limit(30);
      if (error) throw error;
      return data || [];
    },
  });

  // ─────────────────────────────────────────────────────────────────────
  // HEALTH CHECK — library mode
  // ─────────────────────────────────────────────────────────────────────
  const handleHealthCheck = async () => {
    setIsRunningHealthCheck(true);
    try {
      const today = cyprusToday;
      const expectedInfo = getWODInfoForDate(today);
      const isRecovery = expectedInfo.category === "RECOVERY";
      const expectedCount = isRecovery ? 1 : 2;
      const issues: string[] = [];
      const passed: string[] = [];

      const { data: todayWods, error } = await supabase
        .from("admin_workouts")
        .select("id, name, image_url, stripe_product_id, stripe_price_id, equipment, category, wod_source")
        .eq("is_workout_of_day", true)
        .eq("generated_for_date", today);

      if (error) {
        issues.push(`Database error: ${error.message}`);
      } else if (!todayWods || todayWods.length === 0) {
        issues.push(`No active WODs for today (${today}). Use Tomorrow's WOD Preview to select from the library.`);
      } else if (todayWods.length < expectedCount) {
        issues.push(`Only ${todayWods.length}/${expectedCount} slot(s) filled. Use Tomorrow's WOD Preview to select from the library.`);
      } else {
        passed.push(`Today's WODs: ${todayWods.length} active for ${today}`);
        const noImg = todayWods.filter((w) => !w.image_url);
        if (noImg.length > 0) issues.push(`Missing image: ${noImg.map((w) => w.name).join(", ")}`);
        else passed.push("All WODs have images");
        const noStripe = todayWods.filter((w) => !w.stripe_product_id || !w.stripe_price_id);
        if (noStripe.length > 0) issues.push(`Missing Stripe link: ${noStripe.map((w) => w.name).join(", ")}`);
        else passed.push("All WODs have Stripe products");
      }

      if (issues.length === 0) {
        toast.success("WOD Health Check passed", { description: `${passed.length} checks OK`, duration: 6000 });
      } else {
        toast.error(`Found ${issues.length} issue(s)`, { description: issues[0], duration: 8000 });
        alert(`WOD HEALTH CHECK\n\nIssues:\n- ${issues.join("\n- ")}\n\nPassed:\n- ${passed.join("\n- ")}`);
      }
    } catch (err: any) {
      toast.error("Health check failed", { description: err?.message || String(err) });
    } finally {
      setIsRunningHealthCheck(false);
    }
  };

  // ─────────────────────────────────────────────────────────────────────
  // FUTURE READY — verify library has eligible matches for next 7 days
  // ─────────────────────────────────────────────────────────────────────
  const handleFutureReadinessCheck = async () => {
    setIsCheckingFuture(true);
    try {
      type Row = { date: string; cat: string; eq: string; available: number };
      const rows: Row[] = [];
      const fail: string[] = [];
      const warn: string[] = [];

      for (let i = 0; i <= 7; i++) {
        const d = format(addDays(new Date(), i), "yyyy-MM-dd");
        const info = getWODInfoForDate(d);
        const slots = info.category === "RECOVERY" ? [{ eq: null, label: "RECOVERY" }] : [
          { eq: "BODYWEIGHT", label: "BODYWEIGHT" },
          { eq: "EQUIPMENT", label: "EQUIPMENT" },
        ];
        for (const s of slots) {
          let q = supabase
            .from("admin_workouts")
            .select("id", { count: "exact", head: true })
            .eq("category", info.category)
            .eq("is_workout_of_day", false)
            .eq("is_visible", true)
            .eq("is_premium", true)
            .eq("is_free", false)
            .not("main_workout", "is", null);
          if (s.eq) q = q.eq("equipment", s.eq);
          const { count, error } = await q;
          const n = error ? 0 : (count || 0);
          rows.push({ date: d, cat: info.category, eq: s.label, available: n });
          if (n === 0) fail.push(`${d} ${info.category}/${s.label}: 0 eligible library workouts`);
          else if (n < 3) warn.push(`${d} ${info.category}/${s.label}: only ${n} eligible`);
        }
      }

      const lines = rows.map((r) => `  ${r.date} ${r.cat}/${r.eq}: ${r.available} eligible`);
      const summary = `${rows.length - fail.length - warn.length} OK • ${warn.length} warn • ${fail.length} fail`;
      if (fail.length === 0 && warn.length === 0) {
        toast.success("Future Ready: library covers next 7 days", { description: summary, duration: 6000 });
      } else if (fail.length === 0) {
        toast.warning("Future Ready: warnings", { description: summary, duration: 8000 });
      } else {
        toast.error("Future Ready: critical gaps", { description: summary, duration: 10000 });
      }
      alert(`FUTURE READY? (library mode)\n${summary}\n\n${lines.join("\n")}\n\n${
        fail.length ? "FAILS:\n- " + fail.join("\n- ") + "\n\n" : ""
      }${warn.length ? "WARNINGS:\n- " + warn.join("\n- ") : ""}`);
    } catch (err: any) {
      toast.error("Future Ready check failed", { description: err?.message || String(err) });
    } finally {
      setIsCheckingFuture(false);
    }
  };

  // ─────────────────────────────────────────────────────────────────────
  // READ-ONLY VERIFIER — never selects, generates, or changes workouts
  // ─────────────────────────────────────────────────────────────────────
  const handleRunWatchdog = async () => {
    setIsRunningWatchdog(true);
    try {
      const { data, error } = await supabase.functions.invoke("watchdog-wod-check");
      if (error) throw error;
      const r: any = data || {};
      const issueCount = Array.isArray(r.checks)
        ? r.checks.reduce((total: number, check: any) => total + (check.issues?.length || 0), 0)
        : 0;
      if (r?.success) {
        toast.success("WOD verification passed", {
          description: "Today and the next two days contain only valid library selections.",
          duration: 6000,
        });
      } else if (issueCount > 0) {
        toast.warning("WOD verification found issues", {
          description: `${issueCount} issue(s) found. No automatic changes were made.`,
          duration: 8000,
        });
      } else {
        toast.info("WOD verification completed", { description: "No automatic changes were made." });
      }
    } catch (err: any) {
      toast.error("WOD verification failed", { description: err?.message || String(err) });
    } finally {
      setIsRunningWatchdog(false);
    }
  };

  const getDifficultyColor = (stars: number | null | undefined) => {
    if (!stars) return "bg-blue-500/20 text-blue-400 border-blue-500/30";
    if (stars <= 2) return "bg-yellow-500/20 text-yellow-400 border-yellow-500/30";
    if (stars <= 4) return "bg-green-500/20 text-green-400 border-green-500/30";
    return "bg-red-500/20 text-red-400 border-red-500/30";
  };

  const tomorrowCategory = getWODInfoForDate(format(addDays(new Date(), 1), "yyyy-MM-dd")).category;
  const todayDayInCycle = getDayIn84Cycle(cyprusToday);

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h3 className="text-lg font-semibold flex items-center gap-2">
            <Flame className="h-5 w-5 text-primary" />
            Workout of the Day Management
          </h3>
          <p className="text-sm text-muted-foreground flex items-center gap-2">
            <Library className="h-3.5 w-3.5" />
            Library mode — daily WODs are picked from your published workouts at 06:30 / 06:50 UTC for the next day.
          </p>
        </div>

        <div className="flex items-center gap-1 sm:gap-2 flex-wrap">
          <Button
            variant="outline"
            size="sm"
            className="flex items-center gap-1 sm:gap-2 border-green-500 text-xs sm:text-sm h-8 sm:h-9 px-2 sm:px-3"
            disabled={isRunningHealthCheck}
            onClick={handleHealthCheck}
          >
            {isRunningHealthCheck ? <RefreshCw className="h-4 w-4 animate-spin" /> : <HeartPulse className="h-4 w-4 text-green-500" />}
            <span className="hidden sm:inline">{isRunningHealthCheck ? "Checking..." : "WOD Health Check"}</span>
            <span className="sm:hidden">Health</span>
          </Button>

          <Button
            variant="outline"
            size="sm"
            className="flex items-center gap-1 sm:gap-2 border-purple-500 text-xs sm:text-sm h-8 sm:h-9 px-2 sm:px-3"
            disabled={isCheckingFuture}
            onClick={handleFutureReadinessCheck}
          >
            {isCheckingFuture ? <RefreshCw className="h-4 w-4 animate-spin" /> : <Rocket className="h-4 w-4 text-purple-500" />}
            <span className="hidden sm:inline">{isCheckingFuture ? "Auditing..." : "Future Ready?"}</span>
            <span className="sm:hidden">Future?</span>
          </Button>

          <Button
            variant="outline"
            size="sm"
            className="flex items-center gap-1 sm:gap-2 border-cyan-500 text-xs sm:text-sm h-8 sm:h-9 px-2 sm:px-3"
            disabled={isRunningWatchdog}
            onClick={handleRunWatchdog}
            title="Verify library selections without changing workouts"
          >
            {isRunningWatchdog ? <RefreshCw className="h-4 w-4 animate-spin" /> : <Shield className="h-4 w-4 text-cyan-500" />}
            <span className="hidden sm:inline">{isRunningWatchdog ? "Checking..." : "Verify WODs"}</span>
            <span className="sm:hidden">Verify</span>
          </Button>

          <Button
            variant="outline"
            size="sm"
            className="flex items-center gap-1 sm:gap-2 text-xs sm:text-sm h-8 sm:h-9 px-2 sm:px-3"
            onClick={() => setPeriodizationDialogOpen(true)}
          >
            <BookOpen className="h-4 w-4" />
            <span className="hidden sm:inline">View Periodization</span>
            <span className="sm:hidden">Period.</span>
          </Button>

          <Button
            variant="outline"
            size="sm"
            className="flex items-center gap-1 sm:gap-2 border-amber-500 text-xs sm:text-sm h-8 sm:h-9 px-2 sm:px-3"
            onClick={() => setTomorrowPreviewOpen(true)}
            title="Review, edit, swap, or approve the workouts pre-picked for tomorrow"
          >
            <Calendar className="h-4 w-4 text-amber-500" />
            <span className="hidden sm:inline">Tomorrow's WOD Preview</span>
            <span className="sm:hidden">Preview</span>
          </Button>
        </div>
      </div>

      {/* Statistics */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardDescription className="flex items-center gap-2">
              <Flame className="h-4 w-4" />
              Today's Slots
            </CardDescription>
          </CardHeader>
          <CardContent>
            {wodLoading ? <Skeleton className="h-8 w-16" /> : <p className="text-2xl font-bold">{currentWODs?.length || 0}</p>}
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription className="flex items-center gap-2">
              <Calendar className="h-4 w-4" />
              Tomorrow's Category
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Badge variant="outline" className="text-sm font-semibold">{tomorrowCategory}</Badge>
            <p className="text-xs text-muted-foreground mt-1">{format(addDays(new Date(), 1), "EEE, MMM d")} • Day {((todayDayInCycle) % 84) + 1}/84</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription className="flex items-center gap-2">
              <Library className="h-4 w-4" />
              Mode
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Badge variant="outline" className="bg-green-500/10 text-green-600 border-green-500/30">Library Only</Badge>
            <p className="text-xs text-muted-foreground mt-1">No AI generation. Zero credits used.</p>
          </CardContent>
        </Card>
      </div>

      {/* Upcoming schedule */}
      <WODSchedulePreview />

      {/* Today's active WOD */}
      <Card className="border-primary/50">
        <CardHeader>
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <div>
              <CardTitle className="flex items-center gap-2 text-primary">
                <Flame className="h-5 w-5" />
                Today's Active WOD — {format(new Date(), "EEEE, MMMM d, yyyy")}
              </CardTitle>
              <CardDescription className="mt-1">
                What users see at <strong>/workout/wod</strong> right now
              </CardDescription>
            </div>
            <Button variant="outline" size="sm" asChild>
              <a href="/workout/wod" target="_blank" rel="noopener noreferrer">
                <ExternalLink className="h-4 w-4 mr-2" /> View on Site
              </a>
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {wodLoading ? (
            <Skeleton className="h-24 w-full" />
          ) : !currentWODs || currentWODs.length === 0 ? (
            <div className="text-center py-8 space-y-2">
              <Flame className="h-12 w-12 text-muted-foreground/50 mx-auto" />
              <p className="text-muted-foreground font-medium">No Active WOD</p>
              <p className="text-sm text-muted-foreground">Use Tomorrow's WOD Preview to select from the library.</p>
            </div>
          ) : (
            <div className="grid gap-4 md:grid-cols-2">
              {currentWODs.map((wod: any) => {
                const isBodyweight = (wod.equipment || "").toUpperCase() === "BODYWEIGHT";
                return (
                  <div key={wod.id} className="border rounded-lg p-4 space-y-3">
                    <div className="flex items-center gap-2">
                      <span className="text-lg">{isBodyweight ? "🤸" : "🏋️"}</span>
                      <span className="font-semibold text-sm">{isBodyweight ? "Bodyweight Version" : "Equipment Version"}</span>
                    </div>
                    {wod.image_url && <img src={wod.image_url} alt={wod.name} className="w-full h-24 object-cover rounded-lg" />}
                    <h4 className="font-semibold">{wod.name}</h4>
                    <div className="flex flex-wrap gap-1">
                      <Badge variant="secondary" className="text-xs">{wod.category}</Badge>
                      {wod.format && <Badge variant="outline" className="text-xs">{wod.format}</Badge>}
                      <Badge className={`text-xs ${getDifficultyColor(wod.difficulty_stars)}`}>{wod.difficulty_stars || "-"}★</Badge>
                      {wod.price && <Badge className="bg-primary/20 text-primary border-primary/30 text-xs">€{Number(wod.price).toFixed(2)}</Badge>}
                    </div>
                    <div className="flex gap-2">
                      <Button variant="outline" size="sm" className="flex-1" asChild>
                        <a href={`/workout/${wod.type}/${wod.id}`} target="_blank" rel="noopener noreferrer">
                          <ExternalLink className="h-3 w-3 mr-1" /> View
                        </a>
                      </Button>
                      <Button variant="outline" size="sm" className="flex-1" onClick={() => { setEditingWorkout(wod); setEditDialogOpen(true); }}>
                        <Edit className="h-3 w-3 mr-1" /> Edit
                      </Button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Recent library picks */}
      <Card>
        <CardHeader>
          <CardTitle className="text-sm">Recent Library Picks</CardTitle>
          <CardDescription>Last 30 workouts promoted to WOD from the library.</CardDescription>
        </CardHeader>
        <CardContent>
          {historyLoading ? (
            <div className="space-y-2">{[...Array(5)].map((_, i) => <Skeleton key={i} className="h-12 w-full" />)}</div>
          ) : wodHistory && wodHistory.length > 0 ? (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Promoted</TableHead>
                    <TableHead>Name</TableHead>
                    <TableHead>Category</TableHead>
                    <TableHead>Equipment</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {wodHistory.map((wod: any) => (
                    <TableRow key={wod.id}>
                      <TableCell className="whitespace-nowrap">
                        {wod.updated_at ? format(new Date(wod.updated_at), "MMM d, yyyy") : "—"}
                      </TableCell>
                      <TableCell className="font-medium max-w-[220px] truncate">{wod.name}</TableCell>
                      <TableCell><Badge variant="secondary" className="text-xs">{wod.category}</Badge></TableCell>
                      <TableCell><Badge variant="outline" className="text-xs">{wod.equipment}</Badge></TableCell>
                      <TableCell>
                        {wod.is_workout_of_day ? (
                          <Badge className="bg-primary/20 text-primary border-primary/30">🔥 Current</Badge>
                        ) : (
                          <Badge variant="outline" className="text-green-400 border-green-500/30">✅ In Library</Badge>
                        )}
                      </TableCell>
                      <TableCell>
                        <div className="flex gap-0.5 justify-end">
                          <Button variant="ghost" size="icon" className="h-8 w-8" asChild title="View on site">
                            <a href={`/workout/${wod.type}/${wod.id}`} target="_blank" rel="noopener noreferrer">
                              <Eye className="h-4 w-4" />
                            </a>
                          </Button>
                          <Button variant="ghost" size="icon" className="h-8 w-8" title="Edit" onClick={() => { setEditingWorkout(wod); setEditDialogOpen(true); }}>
                            <Edit className="h-4 w-4" />
                          </Button>
                          <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive hover:text-destructive" title="Delete" onClick={() => handleDeleteWorkout(wod)}>
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          ) : (
            <p className="text-center text-muted-foreground py-8">No library picks yet.</p>
          )}
        </CardContent>
      </Card>

      <PeriodizationSystemDialog
        open={periodizationDialogOpen}
        onOpenChange={setPeriodizationDialogOpen}
        wodState={null}
      />

      <WorkoutEditDialog
        workout={editingWorkout}
        open={editDialogOpen}
        onOpenChange={(open) => { setEditDialogOpen(open); if (!open) setEditingWorkout(null); }}
        onSave={() => {
          queryClient.invalidateQueries({ queryKey: ["current-wod"] });
          queryClient.invalidateQueries({ queryKey: ["wod-history"] });
          queryClient.invalidateQueries({ queryKey: ["workoutOfDay"] });
          setEditDialogOpen(false);
          setEditingWorkout(null);
        }}
      />

      <TomorrowWODPreviewDialog
        open={tomorrowPreviewOpen}
        onOpenChange={setTomorrowPreviewOpen}
      />
    </div>
  );
};