import { useState, useEffect, useMemo } from "react";
import { getDifficultyColorClasses } from "@/lib/wodCycle";
import { useNavigate, useParams } from "react-router-dom";
import { Helmet } from "react-helmet";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { ArrowLeft, Eye, CheckCircle, Search, X, Sparkles, Star, Crown, ShoppingCart, Check, Home, Dumbbell, Layers, Target, TrendingUp, Clock } from "lucide-react";

// Helper function for category color styling
const getCategoryColor = (category: string | null) => {
  if (!category) return "text-muted-foreground";
  const cat = category.toLowerCase();
  if (cat.includes("strength")) return "text-orange-600 dark:text-orange-400";
  if (cat.includes("cardio")) return "text-blue-600 dark:text-blue-400";
  if (cat.includes("mobility")) return "text-purple-600 dark:text-purple-400";
  if (cat.includes("challenge")) return "text-pink-600 dark:text-pink-400";
  if (cat.includes("stability")) return "text-teal-600 dark:text-teal-400";
  if (cat.includes("metabolic")) return "text-amber-600 dark:text-amber-400";
  if (cat.includes("pilates")) return "text-rose-500 dark:text-rose-400";
  if (cat.includes("recovery")) return "text-cyan-600 dark:text-cyan-400";
  return "text-red-600 dark:text-red-400";
};
import { AccessGate } from "@/components/AccessGate";
import IndividualWorkout from "@/pages/IndividualWorkout";
import { CompactFilters } from "@/components/CompactFilters";
import { PageBreadcrumbs } from "@/components/PageBreadcrumbs";
import { ContentLoadingSkeleton } from "@/components/ContentLoadingSkeleton";
import { useAllWorkouts } from "@/hooks/useWorkoutData";
import { useAccessControl } from "@/hooks/useAccessControl";
import { useFreeAccessMode } from "@/hooks/useFreeAccessMode";
import { useWorkoutInteractions } from "@/hooks/useWorkoutInteractions";
import { supabase } from "@/integrations/supabase/client";
import { stripHtmlTags } from "@/lib/text";
import { buildUniqueContentSlugs, slugifyContentName } from "@/lib/seo-slugs";
import { STRENGTH_FOCUS_OPTIONS, isStrengthFocus, type StrengthFocus } from "@/constants/workoutCategories";

type EquipmentFilter = "all" | "bodyweight" | "equipment";
type LevelFilter = "all" | "beginner" | "intermediate" | "advanced";
type FormatFilter = "all" | "circuit" | "amrap" | "for time" | "tabata" | "reps & sets" | "emom" | "mix";
type FocusFilter = "all" | StrengthFocus;
type DurationFilter = "all" | "15" | "20" | "30" | "40" | "50" | "various";
type StatusFilter = "all" | "viewed" | "completed" | "not-viewed" | "favorites";
type SortByFilter = "newest" | "oldest" | "name-asc" | "name-desc";
type AccessFilter = "all" | "free" | "premium" | "purchasable";

export interface Workout {
  id: string;
  name: string;
  description: string;
  duration: string;
  equipment: "bodyweight" | "equipment";
  level: "beginner" | "intermediate" | "advanced";
  format: "circuit" | "amrap" | "for time" | "tabata" | "reps & sets" | "mix";
  imageUrl: string;
  isFree?: boolean;
}

const WorkoutDetail = () => {
  const navigate = useNavigate();
  const { type } = useParams();
  const { userTier, hasPurchased } = useAccessControl();
  const [searchTerm, setSearchTerm] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [equipmentFilter, setEquipmentFilter] = useState<EquipmentFilter>("all");
  const [levelFilter, setLevelFilter] = useState<LevelFilter>("all");
  const [formatFilter, setFormatFilter] = useState<FormatFilter>("all");
  const [focusFilter, setFocusFilter] = useState<FocusFilter>("all");
  const [durationFilter, setDurationFilter] = useState<DurationFilter>("all");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [sortBy, setSortBy] = useState<SortByFilter>("newest");
  const [accessFilter, setAccessFilter] = useState<AccessFilter>("all");
  const [userId, setUserId] = useState<string | undefined>();

  // Debounce search
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(searchTerm);
    }, 300);
    return () => clearTimeout(timer);
  }, [searchTerm]);
  
  if (import.meta.env.DEV) {
    console.log("🎯 WorkoutDetail mounted - type:", type);
  }
  
  // Fetch current user
  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      setUserId(user?.id);
      if (import.meta.env.DEV) {
        console.log("👤 User ID:", user?.id || "NOT LOGGED IN");
      }
    });
  }, []);
  
  // Fetch workouts and interactions from database
  const { data: allWorkouts = [], isLoading } = useAllWorkouts();
  const { data: interactions = [] } = useWorkoutInteractions(userId);

  // Helper function to check if workout is new (created within last 2 days)
  const isNew = (createdAt: string | undefined) => {
    if (!createdAt) return false;
    const daysSinceCreation = (Date.now() - new Date(createdAt).getTime()) / (1000 * 60 * 60 * 24);
    return daysSinceCreation <= 2;
  };

  // Clear all filters
  const clearAllFilters = () => {
    setSearchTerm("");
    setEquipmentFilter("all");
    setLevelFilter("all");
    setFormatFilter("all");
    setFocusFilter("all");
    setDurationFilter("all");
    setStatusFilter("all");
    setSortBy("newest");
    setAccessFilter("all");
  };

  const isStrengthPage = type === "strength";
  const hasActiveFilters = searchTerm || equipmentFilter !== "all" || levelFilter !== "all" || 
    (isStrengthPage ? focusFilter !== "all" : formatFilter !== "all") || durationFilter !== "all" || statusFilter !== "all" || sortBy !== "newest" || accessFilter !== "all";
  
  if (import.meta.env.DEV) {
    console.log("📦 All Workouts:", allWorkouts.length, allWorkouts);
    console.log("⏳ Loading:", isLoading);
  }
  
  // Map URL type to database category
  const categoryMap: { [key: string]: string } = {
    "strength": "STRENGTH",
    "calorie-burning": "CALORIE BURNING",
    "metabolic": "METABOLIC",
    "cardio": "CARDIO",
    "mobility": "MOBILITY & STABILITY",
    "challenge": "CHALLENGE",
    "pilates": "PILATES",
    "recovery": "RECOVERY",
    "micro-workouts": "MICRO-WORKOUTS"
  };

  const workoutTitles: { [key: string]: string } = {
    "strength": "Strength Workouts",
    "calorie-burning": "Calorie Burning Workouts",
    "metabolic": "Metabolic Workouts",
    "cardio": "Cardio Workouts",
    "mobility": "Mobility & Stability Workouts",
    "challenge": "Challenge Workouts",
    "pilates": "Pilates Workouts",
    "recovery": "Recovery Workouts",
    "micro-workouts": "Micro-Workouts"
  };

  const workoutFallbackByType: Record<string, string> = {
    "strength": "/images/workouts/strength-category-bg.jpg",
    "calorie-burning": "/images/workouts/calorie-burning-category-bg.jpg",
    "metabolic": "/images/workouts/metabolic-category-bg.jpg",
    "cardio": "/images/workouts/cardio-category-bg.jpg",
    "mobility": "/images/workouts/mobility-category-bg.jpg",
    "challenge": "/images/workouts/challenge-category-bg.jpg",
    "pilates": "/images/workouts/pilates-category-bg.jpg",
    "recovery": "/images/workouts/recovery-category-bg.jpg",
    "micro-workouts": "/images/workouts/micro-workouts-category-bg.jpg",
  };

  // Category descriptions for the description card
  const categoryDescriptions: { [key: string]: { description: string; meta: string } } = {
    "strength": {
      description: "Build foundational power and muscular endurance with these single-session strength workouts. Whether using bodyweight or equipment, develop the strength that supports all aspects of fitness and daily life.",
      meta: "Single Session | Beginner-Advanced | Various Durations"
    },
    "calorie-burning": {
      description: "High-intensity interval training formats designed to maximize calorie expenditure. Various workout structures keep you challenged while achieving your fat-burning and metabolic goals.",
      meta: "Single Session | Beginner-Advanced | Various Durations"
    },
    "metabolic": {
      description: "Boost your metabolic rate with high-intensity conditioning sessions. These workouts are designed to enhance how efficiently your body burns energy, both during and after exercise.",
      meta: "Single Session | Beginner-Advanced | Various Durations"
    },
    "cardio": {
      description: "Improve cardiovascular endurance and aerobic capacity with dedicated cardio sessions. Build a stronger heart, better stamina, and enhanced endurance for everyday activities.",
      meta: "Single Session | Beginner-Advanced | Various Durations"
    },
    "mobility": {
      description: "Focus on joint health, mobility, and stability with sessions designed to improve how your joints move and stabilize during dynamic movements. Essential for injury prevention and movement quality.",
      meta: "Single Session | All Levels | Various Durations"
    },
    "challenge": {
      description: "Push beyond your comfort zone with gamification-style workouts. Challenge yourself to break personal boundaries, test your limits, and discover your true athletic potential.",
      meta: "Single Session | Intermediate-Advanced | Various Durations"
    },
    "pilates": {
      description: "Controlled movements focused on core strength, spinal alignment, and body awareness. Develop stability, flexibility, and precise body control through focused technique.",
      meta: "Single Session | Beginner-Advanced | Various Durations"
    },
    "recovery": {
      description: "Active recovery and regeneration sessions designed to help your body repair and rebuild. Essential for long-term performance, injury prevention, and overall wellness.",
      meta: "Single Session | All Levels | Various Durations"
    },
    "micro-workouts": {
      description: "No time for a run or a trip to the gym? Exercise 'snacks' are the answer. All you need is some stairs, a chair, a wall or just your body and 5 minutes away from your desk or sofa! Get fit in 5 minutes with these life-changing micro-workouts.",
      meta: "Single Session | All Levels | 5 Minutes"
    }
  };

  const title = workoutTitles[type || ""] || "Workout";
  const mappedCategory = categoryMap[type || "strength"];
  const fallbackWorkoutImage = workoutFallbackByType[type || ""] || "/images/workouts/strength-category-bg.jpg";
  // First filter by category from URL - EXCLUDE active WODs (they should only appear on WOD page)
  const currentTypeWorkouts = allWorkouts.filter(workout => {
    const categoryMatch = workout.category?.toUpperCase().includes(mappedCategory);
    const isNotActiveWOD = workout.is_workout_of_day !== true || workout.wod_source === 'library'; // Library-selected WODs remain visible in categories
    return categoryMatch && isNotActiveWOD;
  });
  
  if (import.meta.env.DEV) {
    console.log("📦 Category filtered workouts:", currentTypeWorkouts.length);
  }

  // Filter and sort workouts with memoization
  const filteredWorkouts = useMemo(() => {
    const filtered = currentTypeWorkouts.filter(workout => {
      // Search filter
      if (debouncedSearch) {
        const searchLower = debouncedSearch.toLowerCase();
        const matchesName = workout.name.toLowerCase().includes(searchLower);
        const matchesDescription = workout.description?.toLowerCase().includes(searchLower);
        const matchesCategory = workout.category?.toLowerCase().includes(searchLower);
        if (!matchesName && !matchesDescription && !matchesCategory) return false;
      }

      // Equipment filter
      if (equipmentFilter !== "all" && workout.equipment?.toLowerCase() !== equipmentFilter) return false;
      
      // Level filter
      if (levelFilter !== "all" && workout.difficulty?.toLowerCase() !== levelFilter) return false;

      // Strength-only focus filter
      if (mappedCategory === "STRENGTH" && focusFilter !== "all") {
        if (workout.focus !== focusFilter) return false;
      }
      
      // Format filter for non-Strength categories
      if (mappedCategory !== "STRENGTH" && formatFilter !== "all") {
        const workoutFormat = workout.format?.toLowerCase();
        if (formatFilter === "reps & sets" && workoutFormat !== "reps & sets") return false;
        if (formatFilter === "for time" && workoutFormat !== "for time") return false;
        if (formatFilter !== "reps & sets" && formatFilter !== "for time" && workoutFormat !== formatFilter) return false;
      }
      
      // Duration filter (range matching)
      if (durationFilter !== "all") {
        const durationNum = parseInt(workout.duration?.match(/\d+/)?.[0] || "0");
        const workoutDuration = workout.duration?.toLowerCase();
        const hasVariousText = workoutDuration?.includes("various") || workoutDuration?.includes("varies");
        
        if (durationFilter === "various") {
          if (!hasVariousText && durationNum > 0) return false;
        } else {
          if (hasVariousText) return false;
          const filterNum = parseInt(durationFilter);
          const rangeMin = filterNum - 5;
          const rangeMax = filterNum + 4;
          if (durationNum < rangeMin || durationNum > rangeMax) return false;
        }
      }
      
      // Status filter
      if (statusFilter !== "all" && userId) {
        const interaction = interactions.find(i => i.workout_id === workout.id);
        if (statusFilter === "viewed" && !interaction?.has_viewed) return false;
        if (statusFilter === "completed" && !interaction?.is_completed) return false;
        if (statusFilter === "not-viewed" && interaction?.has_viewed) return false;
        if (statusFilter === "favorites" && !interaction?.is_favorite) return false;
      }
      
      // Access filter
      if (accessFilter === "free" && workout.is_premium) return false;
      if (accessFilter === "premium" && !workout.is_premium) return false;
      if (accessFilter === "purchasable" && (!workout.is_standalone_purchase || !workout.price)) return false;
      
      return true;
    });

    // Sort workouts
    const sorted = [...filtered];
    switch (sortBy) {
      case "newest":
        sorted.sort((a, b) => {
          const dateA = a.created_at ? new Date(a.created_at).getTime() : 0;
          const dateB = b.created_at ? new Date(b.created_at).getTime() : 0;
          return dateB - dateA;
        });
        break;
      case "oldest":
        sorted.sort((a, b) => {
          const dateA = a.created_at ? new Date(a.created_at).getTime() : 0;
          const dateB = b.created_at ? new Date(b.created_at).getTime() : 0;
          return dateA - dateB;
        });
        break;
      case "name-asc":
        sorted.sort((a, b) => a.name.localeCompare(b.name));
        break;
      case "name-desc":
        sorted.sort((a, b) => b.name.localeCompare(a.name));
        break;
    }

    return sorted;
  }, [currentTypeWorkouts, debouncedSearch, equipmentFilter, levelFilter, focusFilter, formatFilter, 
      durationFilter, statusFilter, sortBy, accessFilter, userId, interactions, mappedCategory]);

  const workoutSlugs = useMemo(() => buildUniqueContentSlugs(currentTypeWorkouts), [currentTypeWorkouts]);

  if (type && !Object.prototype.hasOwnProperty.call(categoryMap, type)) {
    return <IndividualWorkout />;
  }

  return (
    <>
      {isLoading ? (
        <div className="min-h-screen bg-background px-4 pb-8">
          <div className="container mx-auto max-w-7xl md:max-w-[1500px]">
            <ContentLoadingSkeleton />
          </div>
        </div>
      ) : (
        <>
      <Helmet>
        <title>{title} Workouts | SmartyGym</title>
        <meta name="description" content={`${title} online workouts by Sports Scientist Haris Falas. Professional ${type || 'fitness'} workouts from beginner to advanced. AMRAP, HIIT, TABATA, circuit training. Free and premium online workouts for worldwide access.`} />
        <meta name="keywords" content={`online workouts, ${title}, ${type} workouts, online fitness, Haris Falas workouts, HIIT workouts, AMRAP workouts, TABATA training, circuit training, bodyweight workouts, online gym, home workouts, EMOM workout, strength workout, cardio workout, office workout, outdoor workout${type === 'micro-workouts' ? ', micro workouts, mini workouts, small workouts, 5 minute workouts, quick workouts, exercise snacks, desk workout, desk exercise' : ''}`} />
        
        {/* Open Graph */}
        <meta property="og:title" content={`${title} Online Workouts | Online Fitness by Haris Falas`} />
        <meta property="og:description" content={`Professional ${title.toLowerCase()} online workouts designed by Sports Scientist Haris Falas`} />
        <meta property="og:type" content="website" />
        <meta property="og:url" content={`https://smartygym.com/workout/${type || ''}`} />
        <meta property="og:site_name" content="SmartyGym" />
        
        {/* Twitter */}
        <meta name="twitter:card" content="summary_large_image" />
        <meta name="twitter:title" content={`${title} Online Workouts | Haris Falas`} />
        <meta name="twitter:description" content={`Professional ${title.toLowerCase()} by Cyprus Sports Scientist`} />
        
        <link rel="canonical" href={`https://smartygym.com/workout/${type || ''}`} />
        
        {/* Structured Data - Collection of Workouts */}
        <script type="application/ld+json">
          {JSON.stringify({
            "@context": "https://schema.org",
            "@type": "ItemList",
            "name": `${title} Online Workouts`,
            "description": `Collection of professional online ${title.toLowerCase()} designed by Cyprus Sports Scientist Haris Falas`,
            "numberOfItems": filteredWorkouts.length,
            "provider": {
              "@type": "Person",
              "name": "Haris Falas",
              "jobTitle": "Sports Scientist & Personal Trainer",
              "description": "Online fitness expert specializing in functional training"
            },
            "itemListElement": filteredWorkouts.slice(0, 50).map((workout, index) => ({
              "@type": "ListItem",
              "position": index + 1,
              "item": {
                "@type": "ExercisePlan",
                "name": workout.name,
                "description": workout.description,
                "image": workout.image_url ? {
                  "@type": "ImageObject",
                  "url": workout.image_url,
                  "name": `${workout.name} - online ${workout.category || ''} workout by Haris Falas at SmartyGym SmartGym Smart Gym`,
                  "caption": `${workout.duration || ''} ${workout.format || ''} ${workout.equipment || 'bodyweight'} workout - SmartyGym SmartGym online fitness platform`
                } : undefined,
                "duration": workout.duration,
                "workLocation": "Online / Home / Gym"
              }
            }))
          })}
        </script>
      </Helmet>
      
      <div className="min-h-screen bg-background">
      <div className="container mx-auto max-w-6xl md:max-w-[1500px] px-4 md:px-6 pb-8">
        <PageBreadcrumbs 
          items={[
            { label: "Home", href: "/" },
            { label: "Smarty Workouts", href: "/workout" },
            { label: title }
          ]} 
        />
        
        {/* Category Description Card */}
        {categoryDescriptions[type || ""] && (
          <Card className="mb-6 bg-white dark:bg-card border-2 border-primary/40 shadow-primary">
            <div className="p-4 sm:p-5">
              <h1 className="text-xl sm:text-2xl font-extrabold tracking-tight uppercase mb-3 text-center">{title}</h1>
              <div className="max-w-3xl mx-auto">
                <p className="text-sm sm:text-base text-muted-foreground text-center mb-4">
                  {categoryDescriptions[type || ""]?.description}
                </p>
                <div className="flex flex-col sm:flex-row items-center justify-center gap-2 text-xs text-muted-foreground text-center">
                  <span className="italic text-center">
                    Crafted by{" "}
                    <a href="/coach-profile" className="text-primary font-semibold hover:underline">
                      Haris Falas
                    </a>
                    {" "}BSc, Sport Science
                  </span>
                  <span className="hidden sm:inline">•</span>
                  <span className="font-medium text-primary text-center">
                    {categoryDescriptions[type || ""]?.meta}
                  </span>
                </div>
              </div>
            </div>
          </Card>
        )}
        {/* Search Bar */}
        <div className="mb-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              type="text"
              placeholder="Search workouts by name or keyword..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10 pr-10 text-sm h-10"
            />
            {searchTerm && (
              <Button
                variant="ghost"
                size="sm"
                className="absolute right-2 top-1/2 -translate-y-1/2 h-6 w-6 p-0"
                onClick={() => setSearchTerm('')}
              >
                <X className="h-4 w-4" />
              </Button>
            )}
          </div>
        </div>

        {/* Compact Filters */}
        <CompactFilters
          filters={[
            {
              name: "Equipment",
              value: equipmentFilter,
              onChange: (value) => setEquipmentFilter(value as EquipmentFilter),
              placeholder: "Equipment",
              options: [
                { value: "all", label: "All Equipment" },
                { value: "bodyweight", label: "Bodyweight" },
                { value: "equipment", label: "Equipment" },
              ],
            },
            {
              name: "Level",
              value: levelFilter,
              onChange: (value) => setLevelFilter(value as LevelFilter),
              placeholder: "Level",
              options: [
                { value: "all", label: "All Levels" },
                { value: "beginner", label: "Beginner" },
                { value: "intermediate", label: "Intermediate" },
                { value: "advanced", label: "Advanced" },
              ],
            },
            isStrengthPage
              ? {
                  name: "Focus",
                  value: focusFilter,
                  onChange: (value) => setFocusFilter(value as FocusFilter),
                  placeholder: "Focus",
                  options: [
                    { value: "all", label: "All Focuses" },
                    ...STRENGTH_FOCUS_OPTIONS.map((focus) => ({
                      value: focus,
                      label: focus
                    })),
                  ],
                }
              : {
                  name: "Format",
                  value: formatFilter,
                  onChange: (value) => setFormatFilter(value as FormatFilter),
                  placeholder: "Format",
                  options: [
                    { value: "all", label: "All Formats" },
                    { value: "circuit", label: "Circuit" },
                    { value: "amrap", label: "AMRAP" },
                    { value: "for time", label: "For Time" },
                    { value: "tabata", label: "Tabata" },
                    { value: "reps & sets", label: "Reps & Sets" },
                    { value: "emom", label: "EMOM" },
                    { value: "mix", label: "Mix" },
                  ],
                },
            {
              name: "Duration",
              value: durationFilter,
              onChange: (value) => setDurationFilter(value as DurationFilter),
              placeholder: "Duration",
              options: [
                { value: "all", label: "All Durations" },
                { value: "15", label: "15 min" },
                { value: "20", label: "20 min" },
                { value: "30", label: "30 min" },
                { value: "40", label: "40 min" },
                { value: "50", label: "50 min" },
                { value: "various", label: "Various" },
              ],
            },
            {
              name: "Access",
              value: accessFilter,
              onChange: (value) => setAccessFilter(value as AccessFilter),
              placeholder: "Access Level",
              options: [
                { value: "all", label: "All Content" },
                { value: "free", label: "Free Only" },
                { value: "premium", label: "Premium Only" },
                { value: "purchasable", label: "Purchasable" },
              ],
            },
            ...(userId ? [{
              name: "Status",
              value: statusFilter,
              onChange: (value) => setStatusFilter(value as StatusFilter),
              placeholder: "Status",
              options: [
                { value: "all", label: "All Workouts" },
                { value: "viewed", label: "Viewed" },
                { value: "completed", label: "Completed" },
                { value: "not-viewed", label: "Not Viewed Yet" },
                { value: "favorites", label: "Favorites" },
              ],
            }] : []),
            {
              name: "Sort By",
              value: sortBy,
              onChange: (value) => setSortBy(value as SortByFilter),
              placeholder: "Sort By",
              options: [
                { value: "newest", label: "Newest First" },
                { value: "oldest", label: "Oldest First" },
                { value: "name-asc", label: "Name A-Z" },
                { value: "name-desc", label: "Name Z-A" },
              ],
            },
          ]}
        />

        {/* Results Counter & Clear Filters */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 mb-4 px-1">
          <p className="text-xs sm:text-sm text-muted-foreground">
            Showing {filteredWorkouts.length} of {currentTypeWorkouts.length} workouts
            {searchTerm && ` matching "${searchTerm}"`}
          </p>
          
          {hasActiveFilters && (
            <Button
              variant="outline"
              size="sm"
              onClick={clearAllFilters}
              className="w-full sm:w-auto text-xs"
            >
              <X className="h-3 w-3 mr-1" />
              Clear All Filters
            </Button>
          )}
        </div>

        {/* Workout Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
          {filteredWorkouts.map((workout) => {
            const interaction = userId ? interactions.find(i => i.workout_id === workout.id) : null;
            const isViewed = interaction?.has_viewed;
            const isCompleted = interaction?.is_completed;
            const isFavorite = interaction?.is_favorite;
            const isNewWorkout = isNew(workout.created_at);
            
            return (
              <Card
                key={workout.id}
                className="overflow-hidden cursor-pointer transition-all duration-300 hover:scale-105 hover:shadow-primary bg-card border-border relative"
                onClick={() => navigate(`/workout/${type}/${workoutSlugs.get(workout.id) || slugifyContentName(workout.name || workout.id)}`)}
              >
                <div className="relative h-48 w-full overflow-hidden">
                  {/* Equipment Badge - Top Left */}
                  <div className="absolute top-2 left-2 z-10">
                    {workout.equipment === 'BODYWEIGHT' ? (
                      <span className="inline-flex items-center gap-1 bg-blue-500/90 text-white text-xs font-semibold px-2 py-1 rounded-full shadow-lg backdrop-blur-sm">
                        <Home className="h-3 w-3 shrink-0" />
                        No Equipment
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 bg-orange-500/90 text-white text-xs font-semibold px-2 py-1 rounded-full shadow-lg backdrop-blur-sm">
                        <Dumbbell className="h-3 w-3 shrink-0" />
                        With Equipment
                      </span>
                    )}
                  </div>

                  {/* NEW Badge - Top Right */}
                  {isNewWorkout && (
                    <div className="absolute top-2 right-2 z-10">
                      <span className="inline-flex items-center gap-1 bg-gradient-to-r from-yellow-400 to-orange-500 text-white text-xs font-bold px-2 py-1 rounded-full shadow-lg animate-pulse">
                        <Sparkles className="h-3 w-3 shrink-0" />
                        NEW
                      </span>
                    </div>
                  )}

                  {/* Premium/Free Badge - Bottom Right */}
                  <div className="absolute bottom-2 right-2 z-10">
                    {workout.is_premium ? (freeAccessMode ? null : (
                      <span className="inline-flex items-center gap-1 bg-gradient-to-r from-yellow-400 to-orange-500 text-white text-xs font-semibold px-2 py-1 rounded-full shadow-lg">
                        <Crown className="h-3 w-3 shrink-0" />
                        Premium
                      </span>
                    )) : (
                      <span className="inline-flex items-center gap-1 bg-gradient-to-r from-blue-500 to-cyan-600 text-white text-xs font-semibold px-2 py-1 rounded-full shadow-lg">
                        <Check className="h-3 w-3 shrink-0" />
                        FREE
                      </span>
                    )}
                  </div>

                  <img
                    src={workout.image_url || fallbackWorkoutImage}
                    alt={`${workout.name} - ${workout.duration} ${workout.difficulty} ${workout.equipment === 'BODYWEIGHT' ? 'bodyweight' : 'equipment-based'} ${workout.format} workout by Haris Falas Sports Scientist at SmartyGym SmartGym Smart Gym smartygym.com`}
                    width={1280}
                    height={720}
                    loading="lazy"
                    decoding="async"
                    className="w-full h-full object-cover"
                    onError={(e) => {
                      e.currentTarget.onerror = null;
                      e.currentTarget.src = fallbackWorkoutImage;
                    }}
                  />
                </div>
                
                <div className="p-4 space-y-3">
                  <h3 className="font-semibold text-base sm:text-lg">{workout.name}</h3>
                  <p className="text-xs sm:text-sm text-muted-foreground line-clamp-2">{stripHtmlTags(workout.description || "")}</p>
                  
                  {/* Details Row - Category, Focus, Difficulty, Duration */}
                  <div className="flex items-center gap-1.5 flex-wrap text-xs text-muted-foreground">
                    {workout.category && (
                      <>
                        <div className="flex items-center gap-1">
                          <Layers className="h-3 w-3 shrink-0 text-primary" />
                          <span className={`font-medium ${getCategoryColor(workout.category)}`}>{workout.category}</span>
                        </div>
                        <span>•</span>
                      </>
                    )}
                    <div className="flex items-center gap-1">
                      <Target className="h-3 w-3 shrink-0 text-primary" />
                      <span className="text-primary font-medium">
                        {workout.category === "STRENGTH" && isStrengthFocus(workout.focus) ? workout.focus : workout.format || "General"}
                      </span>
                    </div>
                    <span>•</span>
                    {workout.difficulty && (
                      <>
                        <div className="flex items-center gap-1">
                          <TrendingUp className={`h-3 w-3 shrink-0 ${getDifficultyColorClasses(workout.difficulty_stars || workout.difficulty).icon}`} />
                          <span className={`capitalize font-medium ${getDifficultyColorClasses(workout.difficulty_stars || workout.difficulty).text}`}>{workout.difficulty}</span>
                          {workout.difficulty_stars && workout.difficulty_stars > 0 ? (
                            <span className="text-yellow-500">({workout.difficulty_stars}★)</span>
                          ) : workout.difficulty?.toLowerCase() === 'all levels' ? (
                            <span className="text-muted-foreground">(All Levels)</span>
                          ) : null}
                        </div>
                        <span>•</span>
                      </>
                    )}
                    <div className="flex items-center gap-1">
                      <Clock className="h-3 w-3 shrink-0 text-purple-600 dark:text-purple-400" />
                      <span className="text-purple-600 dark:text-purple-400 font-medium">{workout.duration}</span>
                    </div>
                  </div>
                  
                  {/* Status Indicators Row */}
                  {userId && (isCompleted || isViewed || isFavorite) && (
                    <div className="flex items-center gap-2 flex-wrap">
                      {isCompleted && (
                        <div className="flex items-center gap-1 text-xs text-green-600 dark:text-green-400">
                          <CheckCircle className="h-3 w-3 sm:h-4 sm:w-4 shrink-0" />
                          <span className="hidden sm:inline">Completed</span>
                        </div>
                      )}
                      
                      {isViewed && !isCompleted && (
                        <div className="flex items-center gap-1 text-xs text-blue-600 dark:text-blue-400">
                          <Eye className="h-3 w-3 sm:h-4 sm:w-4 shrink-0" />
                          <span className="hidden sm:inline">Viewed</span>
                        </div>
                      )}
                      
                      {isFavorite && (
                        <div className="flex items-center gap-1 text-xs text-yellow-600 dark:text-yellow-400">
                          <Star className="h-3 w-3 sm:h-4 sm:w-4 fill-current shrink-0" />
                          <span className="hidden sm:inline">Favorite</span>
                        </div>
                      )}
                    </div>
                  )}
                  
                  {/* Buy Badge - Only if standalone purchasable and user can use it */}
                  {workout.is_standalone_purchase && workout.price && userTier !== "premium" && !hasPurchased(workout.id, "workout") && (
                    <div className="flex items-center">
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <span className="inline-flex items-center gap-1 bg-gradient-to-r from-green-500 to-emerald-600 text-white text-xs font-semibold px-2 py-1 rounded-full cursor-help">
                            <ShoppingCart className="h-3 w-3 shrink-0" />
                            BUY €{Number(workout.price).toFixed(2)}
                          </span>
                        </TooltipTrigger>
                        <TooltipContent side="top" align="center" className="max-w-xs text-center">
                          Buy this workout individually to try our coaching style before committing to a subscription.
                        </TooltipContent>
                      </Tooltip>
                    </div>
                  )}
                </div>
              </Card>
            );
          })}
        </div>

        {filteredWorkouts.length === 0 && (
          <Card className="p-8">
            <p className="text-center text-muted-foreground">
              No workouts found for this combination. Try different filters.
            </p>
          </Card>
        )}
      </div>

      </div>
      </>
      )}
    </>
  );
};

export default WorkoutDetail;
