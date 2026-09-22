import { useState, useEffect, useCallback, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Loader2, Search, X, Dumbbell, Activity, Target, Gauge, FolderOpen, Power } from "lucide-react";
import ExerciseDetailModal from "@/components/ExerciseDetailModal";
import ExerciseFrameAnimation from "@/components/ExerciseFrameAnimation";
import { useToast } from "@/hooks/use-toast";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

interface Exercise {
  id: string;
  name: string;
  body_part: string;
  equipment: string;
  target: string;
  secondary_muscles: string[];
  instructions: string[];
  gif_url: string | null;
  description: string | null;
  difficulty: string | null;
  category: string | null;
  frame_start_url: string | null;
  frame_end_url: string | null;
  is_generation_enabled: boolean;
}

const RESULT_LIMIT = 200;

const AdminExerciseDatabase = () => {
  const [exercises, setExercises] = useState<Exercise[]>([]);
  const [loading, setLoading] = useState(false);
  const [nameSearch, setNameSearch] = useState("");
  const [bodyPartFilter, setBodyPartFilter] = useState("");
  const [equipmentFilter, setEquipmentFilter] = useState("");
  const [targetFilter, setTargetFilter] = useState("");
  const [difficultyFilter, setDifficultyFilter] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("");
  const [usageFilter, setUsageFilter] = useState("all");
  const [selectedExercise, setSelectedExercise] = useState<Exercise | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [resultCount, setResultCount] = useState(0);
  const [totals, setTotals] = useState<{ total: number; enabled: number }>({ total: 0, enabled: 0 });
  const [bulkTarget, setBulkTarget] = useState<null | boolean>(null);
  const [bulkBusy, setBulkBusy] = useState(false);

  const [bodyParts, setBodyParts] = useState<string[]>([]);
  const [equipmentOptions, setEquipmentOptions] = useState<string[]>([]);
  const [targetOptions, setTargetOptions] = useState<string[]>([]);
  const [difficultyOptions, setDifficultyOptions] = useState<string[]>([]);
  const [categoryOptions, setCategoryOptions] = useState<string[]>([]);

  const { toast } = useToast();
  const debounceTimer = useRef<NodeJS.Timeout | null>(null);

  const fetchAllRows = async (column: string) => {
    const allData: Record<string, string | null>[] = [];
    let page = 0;
    const pageSize = 1000;
    let hasMore = true;

    while (hasMore) {
      const { data, error } = await supabase
        .from("exercises")
        .select(column)
        .order(column)
        .range(page * pageSize, (page + 1) * pageSize - 1);

      if (error) throw error;

      if (data && data.length > 0) {
        allData.push(...data);
        hasMore = data.length === pageSize;
        page++;
      } else {
        hasMore = false;
      }
    }

    return allData;
  };

  const loadTotals = useCallback(async () => {
    const [{ count: total }, { count: enabled }] = await Promise.all([
      supabase.from("exercises").select("id", { count: "exact", head: true }),
      supabase
        .from("exercises")
        .select("id", { count: "exact", head: true })
        .eq("is_generation_enabled", true),
    ]);
    setTotals({ total: total ?? 0, enabled: enabled ?? 0 });
  }, []);

  useEffect(() => {
    const loadFilterOptions = async () => {
      try {
        const [bodyPartData, equipmentData, targetData, difficultyData, categoryData] = await Promise.all([
          fetchAllRows("body_part"),
          fetchAllRows("equipment"),
          fetchAllRows("target"),
          fetchAllRows("difficulty"),
          fetchAllRows("category"),
        ]);

        setBodyParts([...new Set(bodyPartData.map((d) => d.body_part).filter(Boolean))].sort());
        setEquipmentOptions([...new Set(equipmentData.map((d) => d.equipment).filter(Boolean))].sort());
        setTargetOptions([...new Set(targetData.map((d) => d.target).filter(Boolean))].sort());
        setDifficultyOptions([...new Set(difficultyData.map((d) => d.difficulty).filter(Boolean))].sort());
        setCategoryOptions([...new Set(categoryData.map((d) => d.category).filter(Boolean))].sort());
      } catch (error) {
        console.error("Error loading filter options:", error);
      }
    };

    loadFilterOptions();
    loadTotals();
  }, [loadTotals]);

  const normalizeSearchTerm = (term: string): string[] => {
    const normalized = term.toLowerCase().trim();
    if (!normalized) return [];
    const variations = new Set<string>([normalized]);
    if (normalized.includes("body weight")) variations.add(normalized.replace("body weight", "bodyweight"));
    if (normalized.includes("bodyweight")) variations.add(normalized.replace("bodyweight", "body weight"));
    if (normalized.includes("dumbell")) variations.add(normalized.replace("dumbell", "dumbbell"));
    if (normalized.includes("dumbbell")) variations.add(normalized.replace("dumbbell", "dumbell"));
    if (normalized.includes("-")) {
      variations.add(normalized.replace(/-/g, " "));
      variations.add(normalized.replace(/-/g, ""));
    }
    if (normalized.includes(" ")) {
      variations.add(normalized.replace(/ /g, "-"));
      variations.add(normalized.replace(/ /g, ""));
    }
    if (normalized.endsWith("s")) variations.add(normalized.slice(0, -1));
    if (normalized.endsWith("es")) variations.add(normalized.slice(0, -2));
    return [...variations];
  };

  const fetchExercises = useCallback(async () => {
    setLoading(true);
    try {
      let query = supabase.from("exercises").select("*");

      if (bodyPartFilter && bodyPartFilter !== "all") query = query.eq("body_part", bodyPartFilter);
      if (equipmentFilter && equipmentFilter !== "all") query = query.eq("equipment", equipmentFilter);
      if (targetFilter && targetFilter !== "all") query = query.eq("target", targetFilter);
      if (difficultyFilter && difficultyFilter !== "all") query = query.eq("difficulty", difficultyFilter);
      if (categoryFilter && categoryFilter !== "all") query = query.eq("category", categoryFilter);
      if (usageFilter === "enabled") query = query.eq("is_generation_enabled", true);
      if (usageFilter === "disabled") query = query.eq("is_generation_enabled", false);

      if (nameSearch.trim()) {
        const searchVariations = normalizeSearchTerm(nameSearch);
        if (searchVariations.length > 0) {
          const orConditions = searchVariations
            .flatMap((term) => [
              `name.ilike.%${term}%`,
              `target.ilike.%${term}%`,
              `body_part.ilike.%${term}%`,
              `equipment.ilike.%${term}%`,
              `category.ilike.%${term}%`,
            ])
            .join(",");
          query = query.or(orConditions);
        }
      }

      query = query.order("name").limit(RESULT_LIMIT);

      const { data, error } = await query;
      if (error) throw error;

      setExercises((data || []) as Exercise[]);
      setResultCount(data?.length || 0);
    } catch (error) {
      console.error("Error fetching exercises:", error);
      toast({
        title: "Error loading exercises",
        description: error instanceof Error ? error.message : "Failed to fetch exercises",
        variant: "destructive",
      });
      setExercises([]);
      setResultCount(0);
    } finally {
      setLoading(false);
    }
  }, [nameSearch, bodyPartFilter, equipmentFilter, targetFilter, difficultyFilter, categoryFilter, usageFilter, toast]);

  useEffect(() => {
    if (debounceTimer.current) clearTimeout(debounceTimer.current);
    debounceTimer.current = setTimeout(() => {
      fetchExercises();
    }, 400);
    return () => {
      if (debounceTimer.current) clearTimeout(debounceTimer.current);
    };
  }, [fetchExercises]);

  const clearFilters = () => {
    setNameSearch("");
    setBodyPartFilter("");
    setEquipmentFilter("");
    setTargetFilter("");
    setDifficultyFilter("");
    setCategoryFilter("");
    setUsageFilter("all");
  };

  const toggleExercise = async (exercise: Exercise, next: boolean) => {
    setExercises((prev) => prev.map((e) => (e.id === exercise.id ? { ...e, is_generation_enabled: next } : e)));
    setTotals((t) => ({ ...t, enabled: t.enabled + (next ? 1 : -1) }));

    const { error } = await supabase
      .from("exercises")
      .update({ is_generation_enabled: next })
      .eq("id", exercise.id);

    if (error) {
      setExercises((prev) => prev.map((e) => (e.id === exercise.id ? { ...e, is_generation_enabled: !next } : e)));
      setTotals((t) => ({ ...t, enabled: t.enabled + (next ? -1 : 1) }));
      toast({
        title: "Could not save",
        description: error.message,
        variant: "destructive",
      });
      return;
    }

    toast({
      title: next ? "In use" : "Not in use",
      description: `${exercise.name} will ${next ? "now" : "no longer"} be used in new workouts and programs.`,
    });
  };

  const applyBulk = async (next: boolean) => {
    const ids = exercises.filter((e) => e.is_generation_enabled !== next).map((e) => e.id);
    if (ids.length === 0) {
      setBulkTarget(null);
      return;
    }
    setBulkBusy(true);
    const { error } = await supabase.from("exercises").update({ is_generation_enabled: next }).in("id", ids);
    setBulkBusy(false);
    setBulkTarget(null);

    if (error) {
      toast({ title: "Could not save", description: error.message, variant: "destructive" });
      return;
    }
    toast({
      title: next ? "Turned on" : "Turned off",
      description: `${ids.length} exercise${ids.length === 1 ? "" : "s"} updated.`,
    });
    await Promise.all([fetchExercises(), loadTotals()]);
  };

  const hasFilters =
    nameSearch.trim() ||
    (bodyPartFilter && bodyPartFilter !== "all") ||
    (equipmentFilter && equipmentFilter !== "all") ||
    (targetFilter && targetFilter !== "all") ||
    (difficultyFilter && difficultyFilter !== "all") ||
    (categoryFilter && categoryFilter !== "all") ||
    usageFilter !== "all";

  const formatLabel = (str: string) =>
    (str || "").split(" ").map((word) => word.charAt(0).toUpperCase() + word.slice(1)).join(" ");

  return (
    <div className="space-y-6">
      {/* Usage summary */}
      <div className="flex flex-wrap items-center gap-3 rounded-lg border border-primary/30 bg-primary/5 p-3">
        <Power className="h-4 w-4 text-primary" />
        <span className="text-sm font-medium">
          {totals.enabled} of {totals.total} exercises in use for new content
        </span>
        <span className="text-xs text-muted-foreground">
          Exercises turned off are never used in new workouts or training programs. Already created content is unaffected.
        </span>
      </div>

      {/* Smart Search Bar */}
      <div className="space-y-1">
        <label className="text-xs text-muted-foreground flex items-center gap-1">
          <Search className="h-3 w-3 text-primary" />
          Smart Search (name, muscle, body part, equipment, category)
        </label>
        <div className="relative">
          <Input
            type="text"
            placeholder='Try "push-ups", "quads", "body weight", "chest", "dumbbell"...'
            value={nameSearch}
            onChange={(e) => setNameSearch(e.target.value)}
            className="border-primary/50 pr-10"
          />
          {loading && (
            <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 animate-spin text-muted-foreground" />
          )}
        </div>
        {!loading && (
          <p className="text-xs text-muted-foreground">
            Showing {resultCount} exercise{resultCount !== 1 ? "s" : ""}
            {resultCount === RESULT_LIMIT ? " (refine your filters to see more)" : ""}
          </p>
        )}
      </div>

      {/* Filters */}
      <div className="flex flex-col gap-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-6 gap-3">
          <div className="space-y-1">
            <label className="text-xs text-muted-foreground flex items-center gap-1">
              <Activity className="h-3 w-3 text-green-500" />
              Body Part
            </label>
            <Select value={bodyPartFilter} onValueChange={setBodyPartFilter}>
              <SelectTrigger className="border-green-500/50">
                <SelectValue placeholder="All Body Parts" />
              </SelectTrigger>
              <SelectContent position="popper" side="bottom" align="start" sideOffset={4} className="max-h-60 overflow-y-auto z-[100] bg-popover">
                <SelectItem value="all">All Body Parts</SelectItem>
                {bodyParts.map((part) => (
                  <SelectItem key={part} value={part}>{formatLabel(part)}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1">
            <label className="text-xs text-muted-foreground flex items-center gap-1">
              <Dumbbell className="h-3 w-3 text-purple-500" />
              Equipment
            </label>
            <Select value={equipmentFilter} onValueChange={setEquipmentFilter}>
              <SelectTrigger className="border-purple-500/50">
                <SelectValue placeholder="All Equipment" />
              </SelectTrigger>
              <SelectContent position="popper" side="bottom" align="start" sideOffset={4} className="max-h-60 overflow-y-auto z-[100] bg-popover">
                <SelectItem value="all">All Equipment</SelectItem>
                {equipmentOptions.map((eq) => (
                  <SelectItem key={eq} value={eq}>{formatLabel(eq)}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1">
            <label className="text-xs text-muted-foreground flex items-center gap-1">
              <Target className="h-3 w-3 text-orange-500" />
              Target Muscle
            </label>
            <Select value={targetFilter} onValueChange={setTargetFilter}>
              <SelectTrigger className="border-orange-500/50">
                <SelectValue placeholder="All Targets" />
              </SelectTrigger>
              <SelectContent position="popper" side="bottom" align="start" sideOffset={4} className="max-h-60 overflow-y-auto z-[100] bg-popover">
                <SelectItem value="all">All Targets</SelectItem>
                {targetOptions.map((t) => (
                  <SelectItem key={t} value={t}>{formatLabel(t)}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1">
            <label className="text-xs text-muted-foreground flex items-center gap-1">
              <Gauge className="h-3 w-3 text-red-500" />
              Difficulty
            </label>
            <Select value={difficultyFilter} onValueChange={setDifficultyFilter}>
              <SelectTrigger className="border-red-500/50">
                <SelectValue placeholder="All Levels" />
              </SelectTrigger>
              <SelectContent position="popper" side="bottom" align="start" sideOffset={4} className="max-h-60 overflow-y-auto z-[100] bg-popover">
                <SelectItem value="all">All Levels</SelectItem>
                {difficultyOptions.map((d) => (
                  <SelectItem key={d} value={d}>{formatLabel(d)}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1">
            <label className="text-xs text-muted-foreground flex items-center gap-1">
              <FolderOpen className="h-3 w-3 text-blue-500" />
              Category
            </label>
            <Select value={categoryFilter} onValueChange={setCategoryFilter}>
              <SelectTrigger className="border-blue-500/50">
                <SelectValue placeholder="All Categories" />
              </SelectTrigger>
              <SelectContent position="popper" side="bottom" align="start" sideOffset={4} className="max-h-60 overflow-y-auto z-[100] bg-popover">
                <SelectItem value="all">All Categories</SelectItem>
                {categoryOptions.map((c) => (
                  <SelectItem key={c} value={c}>{formatLabel(c)}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1">
            <label className="text-xs text-muted-foreground flex items-center gap-1">
              <Power className="h-3 w-3 text-primary" />
              Usage
            </label>
            <Select value={usageFilter} onValueChange={setUsageFilter}>
              <SelectTrigger className="border-primary/50">
                <SelectValue placeholder="All" />
              </SelectTrigger>
              <SelectContent position="popper" side="bottom" align="start" sideOffset={4} className="max-h-60 overflow-y-auto z-[100] bg-popover">
                <SelectItem value="all">All</SelectItem>
                <SelectItem value="enabled">In use</SelectItem>
                <SelectItem value="disabled">Not in use</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="flex flex-wrap gap-2">
          <Button variant="outline" size="sm" onClick={() => setBulkTarget(true)} disabled={loading || !exercises.length}>
            Turn all on ({resultCount})
          </Button>
          <Button variant="outline" size="sm" onClick={() => setBulkTarget(false)} disabled={loading || !exercises.length}>
            Turn all off ({resultCount})
          </Button>
          {hasFilters && (
            <Button variant="ghost" size="sm" onClick={clearFilters}>
              <X className="h-4 w-4 mr-1" /> Clear
            </Button>
          )}
        </div>
      </div>

      {/* Results */}
      {loading && !exercises.length ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
          <span className="ml-2 text-muted-foreground">Loading exercises...</span>
        </div>
      ) : exercises.length > 0 ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 max-h-[600px] overflow-y-auto pr-2">
          {exercises.map((exercise) => (
            <div
              key={exercise.id}
              className={`group bg-card border rounded-lg p-4 transition-all duration-200 ${
                exercise.is_generation_enabled
                  ? "border-border hover:border-primary/50 hover:shadow-lg"
                  : "border-destructive/40 opacity-60"
              }`}
            >
              <div
                className="cursor-pointer"
                onClick={() => {
                  setSelectedExercise(exercise);
                  setModalOpen(true);
                }}
              >
                {exercise.gif_url ? (
                  <div className="w-full aspect-square rounded-md overflow-hidden bg-muted mb-3">
                    <img
                      src={exercise.gif_url}
                      alt={exercise.name}
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-200"
                      loading="lazy"
                    />
                  </div>
                ) : exercise.frame_start_url && exercise.frame_end_url ? (
                  <div className="mb-3">
                    <ExerciseFrameAnimation
                      frameStartUrl={exercise.frame_start_url}
                      frameEndUrl={exercise.frame_end_url}
                      altText={exercise.name}
                    />
                  </div>
                ) : null}

                <div className="space-y-2">
                  <h3 className="font-medium text-sm group-hover:text-primary transition-colors line-clamp-2">
                    {exercise.name}
                  </h3>
                  <div className="flex flex-wrap gap-1">
                    <Badge variant="secondary" className="text-xs">
                      <Activity className="h-3 w-3 mr-1" />
                      {formatLabel(exercise.body_part)}
                    </Badge>
                    <Badge variant="outline" className="text-xs">
                      <Target className="h-3 w-3 mr-1" />
                      {formatLabel(exercise.target)}
                    </Badge>
                    {exercise.difficulty && (
                      <Badge variant="outline" className="text-xs border-red-500/50 text-red-600 dark:text-red-400">
                        {formatLabel(exercise.difficulty)}
                      </Badge>
                    )}
                    {exercise.category && (
                      <Badge variant="outline" className="text-xs border-blue-500/50 text-blue-600 dark:text-blue-400">
                        {formatLabel(exercise.category)}
                      </Badge>
                    )}
                  </div>
                </div>
              </div>

              {/* Use / Don't use switch */}
              <div className="mt-3 pt-3 border-t border-border flex items-center justify-between gap-2">
                <span
                  className={`text-xs font-medium ${
                    exercise.is_generation_enabled ? "text-primary" : "text-muted-foreground"
                  }`}
                >
                  {exercise.is_generation_enabled ? "In use" : "Not in use"}
                </span>
                <Switch
                  checked={exercise.is_generation_enabled}
                  onCheckedChange={(next) => toggleExercise(exercise, next)}
                  aria-label={`Use ${exercise.name} in new content`}
                />
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="text-center py-12 text-muted-foreground">
          <Dumbbell className="h-12 w-12 mx-auto mb-4 opacity-50" />
          <p className="font-medium">No exercises found with those filters.</p>
        </div>
      )}

      <ExerciseDetailModal exercise={selectedExercise} open={modalOpen} onOpenChange={setModalOpen} />

      <AlertDialog open={bulkTarget !== null} onOpenChange={(open) => !open && setBulkTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {bulkTarget ? "Turn on all shown exercises?" : "Turn off all shown exercises?"}
            </AlertDialogTitle>
            <AlertDialogDescription>
              This applies to the {resultCount} exercise{resultCount === 1 ? "" : "s"} currently shown. It only affects
              which exercises can be used in new workouts and training programs.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={bulkBusy}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              disabled={bulkBusy}
              onClick={(e) => {
                e.preventDefault();
                applyBulk(bulkTarget === true);
              }}
            >
              {bulkBusy ? "Saving..." : "Confirm"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default AdminExerciseDatabase;
