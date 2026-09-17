import { useEffect, useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { ShieldCheck, RefreshCw, AlertTriangle, CheckCircle2, XCircle } from "lucide-react";

type Issue = { code: string; severity: string; message: string; section?: string };

type AuditRecord = {
  workout_id: string;
  name: string;
  category: string | null;
  format: string | null;
  status: "pass" | "warn" | "fail";
  repair_tier: number;
  errors: Issue[];
  warnings: Issue[];
  work_minutes: number;
  target_minutes: number | null;
  audited_at: string;
};

const BATCH = 100;

export const WorkoutComplianceAudit = () => {
  const { toast } = useToast();
  const [running, setRunning] = useState(false);
  const [progress, setProgress] = useState(0);
  const [records, setRecords] = useState<AuditRecord[]>([]);
  const [filter, setFilter] = useState<"all" | "fail" | "warn" | "pass">("fail");

  const loadRecords = async () => {
    const { data, error } = await supabase
      .from("workout_compliance_audit")
      .select("*")
      .order("status", { ascending: true })
      .limit(1000);
    if (error) {
      toast({ title: "Could not load the audit", description: error.message, variant: "destructive" });
      return;
    }
    setRecords((data ?? []) as unknown as AuditRecord[]);
  };

  useEffect(() => {
    loadRecords();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const runAudit = async () => {
    setRunning(true);
    setProgress(0);
    try {
      let offset = 0;
      let total = 0;
      let done = false;
      let guard = 0;
      while (!done && guard < 50) {
        guard += 1;
        const { data, error } = await supabase.functions.invoke("audit-workout-compliance", {
          body: { offset, limit: BATCH, reset: offset === 0 },
        });
        if (error) throw error;
        if (!data?.ok) throw new Error(data?.error ?? "Audit failed");
        total = data.total ?? total;
        offset = data.next_offset ?? offset + BATCH;
        done = Boolean(data.done);
        setProgress(total ? Math.min(100, Math.round((offset / total) * 100)) : 100);
      }
      await loadRecords();
      toast({ title: "Audit complete", description: `${total} workouts checked against the current rules.` });
    } catch (e) {
      toast({
        title: "Audit failed",
        description: e instanceof Error ? e.message : String(e),
        variant: "destructive",
      });
    } finally {
      setRunning(false);
    }
  };

  const counts = {
    total: records.length,
    pass: records.filter((r) => r.status === "pass").length,
    warn: records.filter((r) => r.status === "warn").length,
    fail: records.filter((r) => r.status === "fail").length,
  };

  const tierCounts = [1, 2, 3].map((tier) => ({
    tier,
    count: records.filter((r) => r.status === "fail" && r.repair_tier === tier).length,
  }));

  const issueCounts = new Map<string, number>();
  for (const r of records) {
    for (const issue of [...(r.errors ?? []), ...(r.warnings ?? [])]) {
      issueCounts.set(issue.code, (issueCounts.get(issue.code) ?? 0) + 1);
    }
  }
  const topIssues = [...issueCounts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 12);

  const visible = records.filter((r) => (filter === "all" ? true : r.status === filter));

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <ShieldCheck className="h-5 w-5" />
          Workout Compliance Audit
        </CardTitle>
        <CardDescription>
          Checks every workout in the library against the current rules — structure, exercise
          selection, category and format rules, prescriptions and timing. Read-only, no AI, no cost.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex flex-wrap items-center gap-2">
          <Button onClick={runAudit} disabled={running}>
            {running ? <RefreshCw className="mr-2 h-4 w-4 animate-spin" /> : <ShieldCheck className="mr-2 h-4 w-4" />}
            {running ? "Auditing…" : "Run Audit"}
          </Button>
          <Button variant="outline" onClick={loadRecords} disabled={running}>
            Refresh results
          </Button>
        </div>

        {running && <Progress value={progress} />}

        {counts.total > 0 && (
          <>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              <div className="rounded-lg border p-3">
                <p className="text-2xl font-bold">{counts.total}</p>
                <p className="text-xs text-muted-foreground">Audited</p>
              </div>
              <div className="rounded-lg border p-3">
                <p className="text-2xl font-bold text-green-600">{counts.pass}</p>
                <p className="text-xs text-muted-foreground">Fully compliant</p>
              </div>
              <div className="rounded-lg border p-3">
                <p className="text-2xl font-bold text-amber-600">{counts.warn}</p>
                <p className="text-xs text-muted-foreground">Minor issues</p>
              </div>
              <div className="rounded-lg border p-3">
                <p className="text-2xl font-bold text-destructive">{counts.fail}</p>
                <p className="text-xs text-muted-foreground">Not compliant</p>
              </div>
            </div>

            <div className="flex flex-wrap gap-2">
              {tierCounts.map(({ tier, count }) => (
                <Badge key={tier} variant="outline">
                  {tier === 1 ? "Auto-fixable" : tier === 2 ? "Section rewrite" : "Full rebuild"}: {count}
                </Badge>
              ))}
            </div>

            {topIssues.length > 0 && (
              <div className="rounded-lg border p-3">
                <p className="mb-2 text-sm font-medium">Most common findings</p>
                <div className="flex flex-wrap gap-2">
                  {topIssues.map(([code, count]) => (
                    <Badge key={code} variant="secondary">
                      {code.toLowerCase().replace(/_/g, " ")}: {count}
                    </Badge>
                  ))}
                </div>
              </div>
            )}

            <div className="flex flex-wrap gap-2">
              {(["fail", "warn", "pass", "all"] as const).map((f) => (
                <Button
                  key={f}
                  size="sm"
                  variant={filter === f ? "default" : "outline"}
                  onClick={() => setFilter(f)}
                >
                  {f === "fail" ? "Not compliant" : f === "warn" ? "Minor issues" : f === "pass" ? "Compliant" : "All"}
                </Button>
              ))}
            </div>

            <ScrollArea className="h-[420px] rounded-lg border">
              <div className="divide-y">
                {visible.map((r) => (
                  <div key={r.workout_id} className="p-3">
                    <div className="flex flex-wrap items-center gap-2">
                      {r.status === "pass" ? (
                        <CheckCircle2 className="h-4 w-4 text-green-600" />
                      ) : r.status === "warn" ? (
                        <AlertTriangle className="h-4 w-4 text-amber-600" />
                      ) : (
                        <XCircle className="h-4 w-4 text-destructive" />
                      )}
                      <span className="text-sm font-medium">{r.name}</span>
                      <Badge variant="outline" className="text-[10px]">{r.workout_id}</Badge>
                      <Badge variant="secondary" className="text-[10px]">{r.category}</Badge>
                      {r.format && <Badge variant="secondary" className="text-[10px]">{r.format}</Badge>}
                      <span className="text-[11px] text-muted-foreground">
                        ~{r.work_minutes} min work{r.target_minutes ? ` / ${r.target_minutes} min stated` : ""}
                      </span>
                    </div>
                    <ul className="mt-1 space-y-0.5 pl-6 text-xs">
                      {(r.errors ?? []).map((issue, i) => (
                        <li key={`e${i}`} className="text-destructive">• {issue.message}</li>
                      ))}
                      {(r.warnings ?? []).map((issue, i) => (
                        <li key={`w${i}`} className="text-muted-foreground">• {issue.message}</li>
                      ))}
                    </ul>
                  </div>
                ))}
                {visible.length === 0 && (
                  <p className="p-4 text-sm text-muted-foreground">Nothing in this group.</p>
                )}
              </div>
            </ScrollArea>
          </>
        )}
      </CardContent>
    </Card>
  );
};
