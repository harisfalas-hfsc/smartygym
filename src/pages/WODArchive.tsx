import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Helmet } from "react-helmet";
import { useQuery } from "@tanstack/react-query";
import { format } from "date-fns";
import { DateRange } from "react-day-picker";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { 
  Select, 
  SelectContent, 
  SelectItem, 
  SelectTrigger, 
  SelectValue 
} from "@/components/ui/select";
import { CalendarCheck, CalendarIcon, Clock, Dumbbell, Star, Crown, ShoppingBag, Archive, X } from "lucide-react";
import { PageBreadcrumbs } from "@/components/PageBreadcrumbs";
import { cn } from "@/lib/utils";
import { fetchVisibleWorkoutMetadata } from "@/hooks/useTodayWods";
import { useFreeAccessMode } from "@/hooks/useFreeAccessMode";

const WOD_CATEGORIES = [
  "STRENGTH",
  "CALORIE BURNING", 
  "METABOLIC",
  "CARDIO",
  "MOBILITY & STABILITY",
  "CHALLENGE"
];

const EQUIPMENT_OPTIONS = ["BODYWEIGHT", "EQUIPMENT"];
const DIFFICULTY_OPTIONS = ["Beginner", "Intermediate", "Advanced"];

const WODArchive = () => {
  const navigate = useNavigate();
  const { freeAccessMode } = useFreeAccessMode();
  const [selectedDateRange, setSelectedDateRange] = useState<DateRange | undefined>(undefined);
  const [categoryFilter, setCategoryFilter] = useState<string>("all");
  const [equipmentFilter, setEquipmentFilter] = useState<string>("all");
  const [difficultyFilter, setDifficultyFilter] = useState<string>("all");

  // Fetch date range constraints
  const { data: dateRange, isLoading: isLoadingDateRange } = useQuery({
    queryKey: ["wod-date-range"],
    queryFn: async () => {
      const wods = (await fetchVisibleWorkoutMetadata(null))
        .filter((workout) => workout.id?.startsWith("WOD-") || workout.is_workout_of_day === true)
        .sort((a, b) => new Date(a.created_at || 0).getTime() - new Date(b.created_at || 0).getTime());
      const first = wods[0];
      const last = wods[wods.length - 1];
      
      return {
        minDate: first?.created_at ? new Date(first.created_at) : null,
        maxDate: last?.created_at ? new Date(last.created_at) : null
      };
    }
  });

  const { data: pastWODs, isLoading } = useQuery({
    queryKey: ["wod-archive", selectedDateRange?.from?.toISOString(), selectedDateRange?.to?.toISOString(), categoryFilter, equipmentFilter, difficultyFilter],
    queryFn: async () => {
      let wods = (await fetchVisibleWorkoutMetadata(null))
        .filter((workout) => workout.id?.startsWith("WOD-") || workout.is_workout_of_day === true)
        .sort((a, b) => new Date(b.created_at || 0).getTime() - new Date(a.created_at || 0).getTime());
      
      // Filter by selected date range
      if (selectedDateRange?.from) {
        const startOfDay = new Date(selectedDateRange.from);
        startOfDay.setHours(0, 0, 0, 0);
        
        if (selectedDateRange.to) {
          const endOfDay = new Date(selectedDateRange.to);
          endOfDay.setHours(23, 59, 59, 999);
          wods = wods.filter((wod) => wod.created_at && new Date(wod.created_at) >= startOfDay && new Date(wod.created_at) <= endOfDay);
        } else {
          // Single day selected - use same day as end
          const endOfDay = new Date(selectedDateRange.from);
          endOfDay.setHours(23, 59, 59, 999);
          wods = wods.filter((wod) => wod.created_at && new Date(wod.created_at) >= startOfDay && new Date(wod.created_at) <= endOfDay);
        }
      }
      
      if (categoryFilter && categoryFilter !== "all") {
        wods = wods.filter((wod) => wod.category === categoryFilter);
      }
      if (equipmentFilter && equipmentFilter !== "all") {
        wods = wods.filter((wod) => wod.equipment === equipmentFilter);
      }
      if (difficultyFilter && difficultyFilter !== "all") {
        wods = wods.filter((wod) => wod.difficulty === difficultyFilter);
      }

      return wods;
    }
  });

  const clearFilters = () => {
    setSelectedDateRange(undefined);
    setCategoryFilter("all");
    setEquipmentFilter("all");
    setDifficultyFilter("all");
  };

  const hasActiveFilters = selectedDateRange !== undefined || categoryFilter !== "all" || equipmentFilter !== "all" || difficultyFilter !== "all";

  const getCategorySlug = (category: string) => {
    return category?.toLowerCase().replace(/\s+/g, "-").replace(/&/g, "and") || "strength";
  };

  const getDifficultyColor = (difficulty: string | null) => {
    switch (difficulty?.toLowerCase()) {
      case "beginner":
        return "bg-yellow-500/20 text-yellow-400 border-yellow-500/30"; // Beginner = YELLOW
      case "intermediate":
        return "bg-green-500/20 text-green-400 border-green-500/30"; // Intermediate = GREEN
      case "advanced":
        return "bg-red-500/20 text-red-400 border-red-500/30"; // Advanced = RED
      default:
        return "bg-muted text-muted-foreground";
    }
  };

  const renderStars = (count: number | null) => {
    const stars = count || 1;
    return Array.from({ length: stars }, (_, i) => (
      <Star key={i} className="w-3 h-3 fill-primary text-primary" />
    ));
  };

  // Fix 1: Allow date selection while loading, only disable outside valid range once loaded
  const isDateDisabled = (date: Date) => {
    // Allow all dates while loading
    if (isLoadingDateRange || !dateRange?.minDate || !dateRange?.maxDate) {
      return false;
    }
    
    // Set times for accurate comparison
    const checkDate = new Date(date);
    checkDate.setHours(0, 0, 0, 0);
    
    const minDate = new Date(dateRange.minDate);
    minDate.setHours(0, 0, 0, 0);
    
    const maxDate = new Date(dateRange.maxDate);
    maxDate.setHours(23, 59, 59, 999);
    
    return checkDate < minDate || checkDate > maxDate;
  };

  // Format selected date range for display
  const getDateRangeDisplay = () => {
    if (!selectedDateRange?.from) return "Select Dates";
    
    if (selectedDateRange.to) {
      return `${format(selectedDateRange.from, "MMM d")} - ${format(selectedDateRange.to, "MMM d, yyyy")}`;
    }
    
    return format(selectedDateRange.from, "PPP");
  };

  return (
    <div className="min-h-screen bg-background">
      <Helmet>
        <title>Workout of the Day Archive | SmartyGym</title>
        <meta
          name="description"
          content="Browse SmartyGym's full Workout of the Day archive — every past WOD by Haris Falas, filterable by date, category, equipment, and difficulty."
        />
        <link rel="canonical" href="https://smartygym.com/wod-archive" />
        <meta property="og:title" content="Workout of the Day Archive | SmartyGym" />
        <meta
          property="og:description"
          content="Browse every past Workout of the Day on SmartyGym. 100% human-designed by Haris Falas."
        />
        <meta property="og:url" content="https://smartygym.com/wod-archive" />
        <meta property="og:type" content="website" />
      </Helmet>
      <div className="container mx-auto max-w-6xl md:max-w-[1500px] px-4 md:px-6 pb-8">
        {/* Breadcrumbs */}
        <PageBreadcrumbs 
          items={[
            { label: "Home", href: "/" },
            { label: "Smarty Workouts", href: "/workout" },
            { label: "WOD Archive" }
          ]} 
        />

        {/* Header Card */}
        <Card className="mb-8 bg-gradient-to-br from-primary/10 via-background to-primary/10 border-2 border-primary/50 shadow-primary">
          <div className="p-4 sm:p-6 text-center">
            <div className="w-20 h-20 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-4">
              <Archive className="w-10 h-10 text-primary" />
            </div>
            <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight uppercase text-primary mb-3">
              WOD Archive
            </h1>
            <p className="text-muted-foreground max-w-2xl mx-auto mb-4">
              Browse our collection of past Workouts of the Day. Each workout was 
              expertly designed and delivered daily following our strategic periodization cycle. 
              Missed one? Get it here!
            </p>
            <Button 
              variant="outline" 
              onClick={() => navigate("/workout")}
              className="border-primary/50 hover:bg-primary/10"
            >
              <CalendarCheck className="w-4 h-4 mr-2" />
              View Today's WOD
            </Button>
          </div>
        </Card>

        {/* Filters */}
        <div className="flex flex-wrap items-center gap-3 mb-6">
          <div className="flex items-center gap-2 text-muted-foreground">
            <span className="text-sm font-medium">Filters:</span>
          </div>
          
          {/* Date Range Filter - PRIMARY (Fix 4: Range mode) */}
          <Popover>
            <PopoverTrigger asChild>
              <Button
                variant="outline"
                className={cn(
                  "w-[240px] justify-start text-left font-normal",
                  !selectedDateRange && "text-muted-foreground"
                )}
              >
                <CalendarIcon className="mr-2 h-4 w-4" />
                {getDateRangeDisplay()}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="start">
              <Calendar
                mode="range"
                selected={selectedDateRange}
                onSelect={setSelectedDateRange}
                disabled={isDateDisabled}
                initialFocus
                numberOfMonths={1}
                className={cn("p-3 pointer-events-auto")}
                modifiers={{
                  today: new Date()
                }}
                modifiersClassNames={{
                  today: "border-2 border-primary/50 bg-transparent font-bold"
                }}
              />
            </PopoverContent>
          </Popover>
          
          <Select value={categoryFilter} onValueChange={setCategoryFilter}>
            <SelectTrigger className="w-[180px]">
              <SelectValue placeholder="Category" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Categories</SelectItem>
              {WOD_CATEGORIES.map((cat) => (
                <SelectItem key={cat} value={cat}>{cat}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          
          <Select value={equipmentFilter} onValueChange={setEquipmentFilter}>
            <SelectTrigger className="w-[160px]">
              <SelectValue placeholder="Equipment" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Equipment</SelectItem>
              {EQUIPMENT_OPTIONS.map((eq) => (
                <SelectItem key={eq} value={eq}>{eq}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          
          <Select value={difficultyFilter} onValueChange={setDifficultyFilter}>
            <SelectTrigger className="w-[160px]">
              <SelectValue placeholder="Difficulty" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Difficulties</SelectItem>
              {DIFFICULTY_OPTIONS.map((diff) => (
                <SelectItem key={diff} value={diff}>{diff}</SelectItem>
              ))}
            </SelectContent>
          </Select>

          {hasActiveFilters && (
            <Button variant="ghost" size="sm" onClick={clearFilters} className="text-muted-foreground">
              <X className="w-4 h-4 mr-1" />
              Clear
            </Button>
          )}
        </div>

        {/* Results Count */}
        {!isLoading && pastWODs && (
          <p className="text-sm text-muted-foreground mb-4">
            {pastWODs.length} workout{pastWODs.length !== 1 ? "s" : ""} found
          </p>
        )}

        {/* Loading State */}
        {isLoading && (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {[1, 2, 3, 4, 5, 6].map((i) => (
              <Card key={i} className="overflow-hidden">
                <Skeleton className="h-40 w-full" />
                <div className="p-4">
                  <Skeleton className="h-4 w-3/4 mb-3" />
                  <div className="flex gap-2 mb-3">
                    <Skeleton className="h-5 w-16" />
                    <Skeleton className="h-5 w-16" />
                    <Skeleton className="h-5 w-16" />
                  </div>
                  <Skeleton className="h-8 w-full" />
                </div>
              </Card>
            ))}
          </div>
        )}

        {/* Grid of Past WODs (Fix 3: Removed card onClick - only button navigates) */}
        {!isLoading && pastWODs && pastWODs.length > 0 && (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {pastWODs.map((wod) => (
              <Card 
                key={wod.id} 
                className="overflow-hidden hover:scale-[1.02] transition-transform duration-200 border-primary/30 hover:border-primary/50"
              >
                {/* Image */}
                <div className="relative h-40">
                  {wod.image_url ? (
                    <img 
                      src={wod.image_url} 
                      alt={wod.name} 
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <div className="w-full h-full bg-gradient-to-br from-primary/20 to-primary/5 flex items-center justify-center">
                      <CalendarCheck className="w-12 h-12 text-primary/50" />
                    </div>
                  )}
                  <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/20 to-transparent" />
                  <div className="absolute bottom-3 left-3 right-3">
                    <h3 className="text-white font-bold text-sm line-clamp-2">{wod.name}</h3>
                  </div>
                  {/* Premium Badge */}
                  {wod.is_premium && !freeAccessMode && (
                    <div className="absolute top-2 right-2">
                      <Badge className="bg-gradient-to-r from-primary to-yellow-500 text-primary-foreground">
                        <Crown className="w-3 h-3 mr-1" />
                        Premium
                      </Badge>
                    </div>
                  )}
                </div>
                
                {/* Details */}
                <CardContent className="p-4">
                  {/* Badges */}
                  <div className="flex flex-wrap gap-1.5 mb-3">
                    <Badge variant="outline" className="text-xs bg-primary/10 text-primary border-primary/30">
                      {wod.category}
                    </Badge>
                    {wod.format && (
                      <Badge variant="outline" className="text-xs">
                        {wod.format}
                      </Badge>
                    )}
                    {wod.difficulty && (
                      <Badge variant="outline" className={`text-xs ${getDifficultyColor(wod.difficulty)}`}>
                        <span className="flex items-center gap-0.5">
                          {renderStars(wod.difficulty_stars)}
                        </span>
                      </Badge>
                    )}
                    {wod.equipment && (
                      <Badge variant="outline" className="text-xs">
                        <Dumbbell className="w-3 h-3 mr-1" />
                        {wod.equipment}
                      </Badge>
                    )}
                    {wod.duration && (
                      <Badge variant="outline" className="text-xs">
                        <Clock className="w-3 h-3 mr-1" />
                        {wod.duration}
                      </Badge>
                    )}
                  </div>
                  
                  {/* Price & Action */}
                  <div className="flex items-center justify-between gap-2">
                    {!freeAccessMode && wod.price && wod.is_standalone_purchase && (
                      <Badge className="bg-gradient-to-r from-green-500 to-emerald-500 text-white border-0">
                        <ShoppingBag className="w-3 h-3 mr-1" />
                        €{wod.price.toFixed(2)}
                      </Badge>
                    )}
                    <Button 
                      size="sm"
                      className="ml-auto w-full sm:w-auto"
                      onClick={() => navigate(`/workout/${getCategorySlug(wod.category)}/${wod.id}`)}
                    >
                      View Workout
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}

        {/* Empty State */}
        {!isLoading && pastWODs && pastWODs.length === 0 && (
          <Card className="p-12 text-center">
            <Archive className="w-16 h-16 text-muted-foreground/50 mx-auto mb-4" />
            <h3 className="text-lg font-semibold mb-2">No Workouts Found</h3>
            <p className="text-muted-foreground mb-4">
              {hasActiveFilters 
                ? "No workouts match your current filters. Try adjusting your selection."
                : "Workouts of the Day will appear here."}
            </p>
            {hasActiveFilters && (
              <Button variant="outline" onClick={clearFilters}>
                Clear Filters
              </Button>
            )}
          </Card>
        )}
      </div>
    </div>
  );
};

export default WODArchive;
