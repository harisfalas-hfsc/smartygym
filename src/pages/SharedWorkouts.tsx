import { useMemo, useState } from "react";
import { Helmet } from "react-helmet";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, Clock, Dumbbell, Search, Star, Users, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { AccessGate } from "@/components/AccessGate";
import { CompactFilters } from "@/components/CompactFilters";
import { PageBreadcrumbs } from "@/components/PageBreadcrumbs";
import { DesktopPageIntro } from "@/components/DesktopPageIntro";
import { ContentLoadingSkeleton } from "@/components/ContentLoadingSkeleton";
import { useSharedWorkouts, type SharedWorkoutRow } from "@/hooks/useSharedWorkouts";
import { WORKOUT_CATEGORY_BY_SLUG, workoutCategoryToSlug } from "@/constants/workoutCategories";
import { BODY_FOCUS } from "@/lib/coach-options";
import { stripHtmlTags } from "@/lib/text";

const FALLBACK_IMAGE = "/images/workouts/shared-workouts-card-mobile.jpg";

const levelOf = (stars: number) =>
  stars >= 5 ? "advanced" : stars >= 3 ? "intermediate" : "beginner";

const durationBucket = (minutes: number) => {
  if (minutes <= 10) return "10";
  if (minutes <= 20) return "20";
  if (minutes <= 30) return "30";
  if (minutes <= 45) return "45";
  return "60";
};

const SharedWorkouts = () => {
  const navigate = useNavigate();
  const { data: workouts = [], isLoading } = useSharedWorkouts();

  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("all");
  const [focus, setFocus] = useState("all");
  const [equipment, setEquipment] = useState("all");
  const [format, setFormat] = useState("all");
  const [level, setLevel] = useState("all");
  const [duration, setDuration] = useState("all");
  const [sortBy, setSortBy] = useState("newest");

  const formats = useMemo(
    () =>
      Array.from(
        new Set(workouts.map((w) => (w.format ?? "").trim()).filter(Boolean)),
      ).sort(),
    [workouts],
  );

  // Members build sessions around coaching goals (e.g. Muscle Building), so the
  // category list comes from the shared workouts themselves, not the fixed
  // library categories.
  const categories = useMemo(
    () =>
      Array.from(new Set(workouts.map((w) => w.category.trim()).filter(Boolean))).sort(),
    [workouts],
  );

  const focusOptions = useMemo(() => {
    const used = new Set(
      workouts.map((w) => (w.focus ?? "").trim().toUpperCase()).filter(Boolean),
    );
    const known = BODY_FOCUS.filter((f) => used.has(f.id)).map((f) => ({
      value: f.id,
      label: f.label,
    }));
    const extras = Array.from(used)
      .filter((f) => !BODY_FOCUS.some((b) => b.id === f))
      .map((f) => ({ value: f, label: f }));
    return [...known, ...extras];
  }, [workouts]);

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    return workouts
      .filter((w) => {
        if (term && !w.name.toLowerCase().includes(term)) return false;
        if (category !== "all" && w.category.trim() !== category) return false;
        if (focus !== "all" && (w.focus ?? "").toUpperCase() !== focus) return false;
        if (format !== "all" && (w.format ?? "") !== format) return false;
        if (level !== "all" && levelOf(w.difficulty_stars) !== level) return false;
        if (duration !== "all" && durationBucket(w.duration_min) !== duration) return false;
        if (equipment !== "all") {
          const list = (w.equipment ?? []).map((e) => e.toLowerCase());
          const bodyweightOnly = list.length === 0 || list.every((e) => e.includes("bodyweight"));
          if (equipment === "bodyweight" && !bodyweightOnly) return false;
          if (equipment === "equipment" && bodyweightOnly) return false;
        }
        return true;
      })
      .sort((a, b) => {
        const aKey = a.shared_at ?? a.created_at;
        const bKey = b.shared_at ?? b.created_at;
        switch (sortBy) {
          case "oldest":
            return aKey.localeCompare(bKey);
          case "name-asc":
            return a.name.localeCompare(b.name);
          case "name-desc":
            return b.name.localeCompare(a.name);
          default:
            return bKey.localeCompare(aKey);
        }
      });
  }, [workouts, search, category, focus, format, level, duration, equipment, sortBy]);

  const clearAll = () => {
    setSearch("");
    setCategory("all");
    setFocus("all");
    setEquipment("all");
    setFormat("all");
    setLevel("all");
    setDuration("all");
    setSortBy("newest");
  };

  const renderCard = (w: SharedWorkoutRow) => (
    <Card
      key={w.id}
      onClick={() => navigate(`/workout/shared/${w.id}`)}
      className="group cursor-pointer overflow-hidden rounded-2xl border-2 border-border transition-all duration-300 hover:-translate-y-1 hover:border-primary/60 hover:shadow-xl"
      role="button"
      aria-label={`${w.name} — shared workout`}
    >
      <div className="relative h-44 overflow-hidden bg-muted">
        <img
          src={FALLBACK_IMAGE}
          alt={w.name}
          loading="lazy"
          className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
        />
        <span className="absolute right-2 top-2 rounded-full bg-primary/90 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-primary-foreground">
          Shared by {w.shared_by_name || "a member"}
        </span>
      </div>
      <div className="space-y-2 p-4">
        <h3 className="line-clamp-2 text-base font-extrabold">{w.name}</h3>
        <div className="flex flex-wrap items-center gap-2 text-[11px] font-semibold uppercase tracking-wide text-primary">
          <span>{w.category}</span>
          {w.focus ? <span className="text-muted-foreground">{w.focus}</span> : null}
          {w.format ? <span className="text-muted-foreground">{w.format}</span> : null}
        </div>
        {w.description_html ? (
          <p className="line-clamp-2 text-xs text-muted-foreground">
            {stripHtmlTags(w.description_html)}
          </p>
        ) : null}
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
          <span className="flex items-center gap-1">
            <Clock className="h-3.5 w-3.5" />
            {w.duration_label ?? `${w.duration_min} min`}
          </span>
          {w.equipment?.length ? (
            <span className="flex items-center gap-1">
              <Dumbbell className="h-3.5 w-3.5" />
              {w.equipment.join(", ")}
            </span>
          ) : null}
          <span className="flex items-center gap-0.5">
            {Array.from({ length: 6 }).map((_, i) => (
              <Star
                key={i}
                className={`h-3 w-3 ${i < w.difficulty_stars ? "fill-primary text-primary" : "text-muted-foreground/40"}`}
              />
            ))}
          </span>
        </div>
      </div>
    </Card>
  );

  return (
    <AccessGate requireAuth requirePremium contentType="workout" contentName="Shared Workouts">
      <div className="container mx-auto max-w-6xl px-4 pb-10 md:max-w-[1500px] md:px-6">
        <Helmet>
          <title>Shared Workouts | Member-Made Sessions | SmartyGym</title>
          <meta
            name="description"
            content="Workouts built and shared by SmartyGym members, assembled from the Smarty Gym exercise library and Haris Falas's coaching rules."
          />
          <meta name="robots" content="noindex" />
        </Helmet>

        <PageBreadcrumbs
          items={[
            { label: "Home", href: "/" },
            { label: "Smarty Workouts", href: "/workout" },
            { label: "Shared Workouts" },
          ]}
        />

        <DesktopPageIntro icon={Users} title="Shared Workouts">
          <p>
            Sessions built by SmartyGym members and shared with the community. Every one of them is
            assembled from the Smarty Gym exercise library using Haris Falas's coaching rules.
          </p>
        </DesktopPageIntro>

        <div className="mb-4 lg:hidden">
          <h1 className="text-2xl font-extrabold uppercase tracking-tight text-primary">
            Shared Workouts
          </h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Sessions built by members and shared with the community.
          </p>
        </div>

        <div className="relative mb-3">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search shared workouts"
            className="pl-9"
          />
          {search ? (
            <button
              type="button"
              onClick={() => setSearch("")}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground"
              aria-label="Clear search"
            >
              <X className="h-4 w-4" />
            </button>
          ) : null}
        </div>

        <CompactFilters
          filters={[
            {
              name: "Category",
              value: category,
              onChange: setCategory,
              options: [
                { value: "all", label: "All categories" },
                ...categories.map((c) => ({ value: c, label: c })),
              ],
            },
            {
              name: "Focus",
              value: focus,
              onChange: setFocus,
              options: [
                { value: "all", label: "All focus" },
                ...focusOptions,
              ],
            },
            {
              name: "Equipment",
              value: equipment,
              onChange: setEquipment,
              options: [
                { value: "all", label: "All equipment" },
                { value: "bodyweight", label: "Bodyweight" },
                { value: "equipment", label: "With equipment" },
              ],
            },
            {
              name: "Format",
              value: format,
              onChange: setFormat,
              options: [
                { value: "all", label: "All formats" },
                ...formats.map((f) => ({ value: f, label: f })),
              ],
            },
            {
              name: "Level",
              value: level,
              onChange: setLevel,
              options: [
                { value: "all", label: "All levels" },
                { value: "beginner", label: "Beginner" },
                { value: "intermediate", label: "Intermediate" },
                { value: "advanced", label: "Advanced" },
              ],
            },
            {
              name: "Duration",
              value: duration,
              onChange: setDuration,
              options: [
                { value: "all", label: "All durations" },
                { value: "10", label: "Up to 10 min" },
                { value: "20", label: "Up to 20 min" },
                { value: "30", label: "Up to 30 min" },
                { value: "45", label: "Up to 45 min" },
                { value: "60", label: "45+ min" },
              ],
            },
            {
              name: "Sort",
              value: sortBy,
              onChange: setSortBy,
              options: [
                { value: "newest", label: "Newest first" },
                { value: "oldest", label: "Oldest first" },
                { value: "name-asc", label: "Name A-Z" },
                { value: "name-desc", label: "Name Z-A" },
              ],
            },
          ]}
        />

        {isLoading ? (
          <ContentLoadingSkeleton />
        ) : workouts.length === 0 ? (
          <Card className="rounded-3xl border-2 border-primary/30 p-8 text-center">
            <p className="text-base font-semibold">No shared workouts yet.</p>
            <p className="mt-2 text-sm text-muted-foreground">
              Build one in Create Your Own Workout and share it with the community.
            </p>
            <Button
              className="mt-5 h-12 rounded-2xl font-bold"
              onClick={() => navigate("/create-your-own-workout")}
            >
              Create your own workout
            </Button>
          </Card>
        ) : filtered.length === 0 ? (
          <Card className="rounded-3xl border-2 border-border p-8 text-center">
            <p className="text-sm text-muted-foreground">No shared workouts match these filters.</p>
            <Button variant="outline" className="mt-4 rounded-2xl" onClick={clearAll}>
              Clear filters
            </Button>
          </Card>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {filtered.map(renderCard)}
          </div>
        )}

        <Button
          type="button"
          variant="outline"
          className="mt-6 min-h-11 w-full gap-2"
          onClick={() => navigate("/workout")}
        >
          <ArrowLeft className="h-4 w-4" />
          Back to workouts
        </Button>
      </div>
    </AccessGate>
  );
};

export default SharedWorkouts;
