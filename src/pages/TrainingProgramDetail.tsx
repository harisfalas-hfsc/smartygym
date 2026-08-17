import { useState, useEffect, useMemo } from "react";
import { getDifficultyColorClasses } from "@/lib/wodCycle";
import { useNavigate, useParams } from "react-router-dom";
import { Helmet } from "react-helmet";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { ArrowLeft, Calendar, Eye, CheckCircle, Search, X, Sparkles, Star, Crown, ShoppingCart, Check, Home, Dumbbell, TrendingUp, Layers } from "lucide-react";


// Helper function to get category color
const getCategoryColor = (category: string): string => {
  const colors: Record<string, string> = {
    "CARDIO ENDURANCE": "text-blue-600 dark:text-blue-400",
    "FUNCTIONAL STRENGTH": "text-orange-600 dark:text-orange-400",
    "MUSCLE HYPERTROPHY": "text-red-600 dark:text-red-400",
    "WEIGHT LOSS": "text-green-600 dark:text-green-400",
    "LOW BACK PAIN": "text-purple-600 dark:text-purple-400",
    "MOBILITY & STABILITY": "text-teal-600 dark:text-teal-400",
  };
  return colors[category?.toUpperCase()] || "text-primary";
};

// Helper function to derive difficulty from stars if missing
const getDifficultyFromStars = (difficulty: string | null, stars: number | null): string => {
  if (difficulty) return difficulty;
  if (!stars) return "Beginner";
  if (stars <= 2) return "Beginner";
  if (stars <= 4) return "Intermediate";
  return "Advanced";
};
import { AccessGate } from "@/components/AccessGate";
import IndividualTrainingProgram from "@/pages/IndividualTrainingProgram";
import { CompactFilters } from "@/components/CompactFilters";
import { PageBreadcrumbs } from "@/components/PageBreadcrumbs";
import { ContentLoadingSkeleton } from "@/components/ContentLoadingSkeleton";
import { useAllPrograms } from "@/hooks/useProgramData";
import { useProgramInteractions } from "@/hooks/useProgramInteractions";
import { supabase } from "@/integrations/supabase/client";
import { useAccessControl } from "@/hooks/useAccessControl";
import { useFreeAccessMode } from "@/hooks/useFreeAccessMode";
import { stripHtmlTags } from "@/lib/text";
import { buildUniqueContentSlugs, slugifyContentName } from "@/lib/seo-slugs";

type EquipmentFilter = "all" | "bodyweight" | "equipment";
type LevelFilter = "all" | "beginner" | "intermediate" | "advanced";
type DurationFilter = "all" | "4" | "6" | "8";
type StatusFilter = "all" | "viewed" | "completed" | "not-viewed" | "favorites";
type SortByFilter = "newest" | "oldest" | "name-asc" | "name-desc";
type AccessFilter = "all" | "free" | "premium" | "purchasable";

export interface TrainingProgram {
  id: string;
  name: string;
  description: string;
  duration: "4" | "6" | "8";
  equipment: "bodyweight" | "equipment";
  level: "beginner" | "intermediate" | "advanced";
  imageUrl: string;
  isFree?: boolean;
}

const TrainingProgramDetail = () => {
  const navigate = useNavigate();
  const { type } = useParams();
  const { userTier, hasPurchased } = useAccessControl();
  const [searchTerm, setSearchTerm] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [equipmentFilter, setEquipmentFilter] = useState<EquipmentFilter>("all");
  const [levelFilter, setLevelFilter] = useState<LevelFilter>("all");
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

  // Fetch current user
  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      setUserId(user?.id);
    });
  }, []);

  // Fetch programs and interactions from database
  const { data: allPrograms = [], isLoading } = useAllPrograms();
  const { data: interactions = [] } = useProgramInteractions(userId);

  // Helper function to check if program is new (created within last 2 days)
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
    setDurationFilter("all");
    setStatusFilter("all");
    setSortBy("newest");
    setAccessFilter("all");
  };

  const hasActiveFilters = searchTerm || equipmentFilter !== "all" || levelFilter !== "all" || 
    durationFilter !== "all" || statusFilter !== "all" || sortBy !== "newest" || accessFilter !== "all";
  
  // Map URL type to database category
  const categoryMap: { [key: string]: string } = {
    "cardio-endurance": "CARDIO ENDURANCE",
    "functional-strength": "FUNCTIONAL STRENGTH",
    "muscle-hypertrophy": "MUSCLE HYPERTROPHY",
    "weight-loss": "WEIGHT LOSS",
    "low-back-pain": "LOW BACK PAIN",
    "mobility-stability": "MOBILITY & STABILITY"
  };

  const programTitles: { [key: string]: string } = {
    "cardio-endurance": "Cardio Endurance Programs",
    "functional-strength": "Functional Strength Programs",
    "muscle-hypertrophy": "Muscle Hypertrophy Programs",
    "weight-loss": "Weight Loss Programs",
    "low-back-pain": "Low Back Pain Programs",
    "mobility-stability": "Mobility & Stability Programs"
  };

  const programFallbackByType: Record<string, string> = {
    "cardio-endurance": "/images/programs/cardio-endurance-bg.jpg",
    "functional-strength": "/images/programs/functional-strength-bg.jpg",
    "muscle-hypertrophy": "/images/programs/muscle-hypertrophy-bg.jpg",
    "weight-loss": "/images/programs/weight-loss-card-mobile.jpg",
    "low-back-pain": "/images/programs/low-back-pain-bg.jpg",
    "mobility-stability": "/images/programs/mobility-stability-bg.jpg",
  };

  const categoryDescriptions: { [key: string]: { description: string; meta: string } } = {
    "cardio-endurance": {
      description: "Structured multi-week programs designed to improve your cardiovascular endurance, VO2 max, and both aerobic and anaerobic thresholds. Build a stronger, more efficient heart.",
      meta: "Multi-Week Program | Beginner-Advanced | 4-8 Weeks"
    },
    "functional-strength": {
      description: "Programs focused on developing the strength every adult needs for better performance in daily life, hobbies, and sports. Real-world strength for real-world demands.",
      meta: "Multi-Week Program | Beginner-Advanced | 4-8 Weeks"
    },
    "muscle-hypertrophy": {
      description: "Strategic programs designed for muscle growth. Understand the importance of lean muscle mass for metabolism, strength, and long-term health.",
      meta: "Multi-Week Program | Beginner-Advanced | 4-8 Weeks"
    },
    "weight-loss": {
      description: "Comprehensive programs combining calorie burning, metabolic enhancement, and muscle building. A sustainable approach to losing weight and keeping it off.",
      meta: "Multi-Week Program | Beginner-Advanced | 4-8 Weeks"
    },
    "low-back-pain": {
      description: "Targeted programs addressing the modern epidemic of low back pain. Whether from office work, tactical jobs, or daily stress, these plans provide relief and prevention.",
      meta: "Multi-Week Program | All Levels | 4-8 Weeks"
    },
    "mobility-stability": {
      description: "Programs designed to improve joint mobility, stability, and overall movement quality. Essential for injury prevention and optimal physical function.",
      meta: "Multi-Week Program | All Levels | 4-8 Weeks"
    }
  };

  const programInfo: { [key: string]: { title: string; content: string } } = {
    "muscle-hypertrophy": {
      title: "Muscle Hypertrophy",
      content: "Building muscle requires consistent mechanical tension, sufficient training volume, and progressive overload—but recovery and nutrition are what turn effort into visible growth. Aim for 1.6–2.0 g of protein per kilogram of body weight daily, maintain a slight caloric surplus (around 200–300 kcal above maintenance), and get at least 7–9 hours of sleep each night to optimize anabolic hormones. Supplementation such as creatine monohydrate, whey protein, and omega-3 fatty acids can support muscle repair and performance. Stay hydrated and plan deload weeks if recovery feels compromised."
    },
    "functional-strength": {
      title: "Functional Strength",
      content: "Functional strength is about quality of movement, balance, and power that transfers to daily life and sport. To progress, focus on technique before load, emphasizing joint stability, core control, and mobility. Fuel your training with nutrient-dense meals rich in lean protein, complex carbohydrates, and healthy fats. Prioritize post-workout recovery meals containing both carbs and protein, and include mobility sessions or active recovery days to enhance performance longevity."
    },
    "cardio-endurance": {
      title: "Cardio",
      content: "Cardiovascular fitness improves heart health, endurance, and recovery capacity. For best results, combine steady-state sessions (65–75% max HR) with interval or tempo training to develop both aerobic and anaerobic systems. Support energy demands by eating enough carbohydrates, staying hydrated, and keeping electrolytes balanced. Limit alcohol and processed foods that interfere with recovery. Regular sleep and stress management are essential for maintaining consistent cardio output."
    },
    "weight-loss": {
      title: "Weight Loss",
      content: "Fat loss happens in a calorie deficit—burning more energy than you consume—without compromising muscle mass. Combine resistance training with cardio and aim for moderate caloric restriction (around –400 to –600 kcal/day). Emphasize high-protein meals to preserve lean tissue, control hunger, and improve metabolism. Reduce refined carbs and sugar, and favor whole foods and fiber-rich vegetables. Quality sleep (7–9 hours) and stress control are critical, since hormonal imbalance can slow fat loss. Stay consistent; small daily improvements create long-term change."
    },
    "low-back-pain": {
      title: "Low Back Pain",
      content: "A strong, stable core and proper movement mechanics are key to preventing and reducing low back pain. Alongside training, maintain good posture while sitting or working, avoid long periods of inactivity, and practice daily mobility for the hips and thoracic spine. Adequate hydration, anti-inflammatory foods (like omega-3 sources, fruits, and vegetables), and a healthy body weight reduce strain on the spine. Remember that pain often reflects movement habits—move more, move well, and progress gradually."
    },
    "mobility-stability": {
      title: "Mobility & Stability",
      content: "Mobility and stability training enhance joint range of motion, balance, and coordination—foundations for every other goal. Perform movements slowly, focusing on control, breathing, and alignment. Support your progress by avoiding prolonged sitting, incorporating dynamic warm-ups and stretching, and staying well-hydrated. Magnesium-rich foods and sufficient sleep improve muscle relaxation and recovery. Patience and consistency are the keys to lasting mobility improvements."
    }
  };

  const title = programTitles[type || ""] || "Training Programs";
  const mappedCategory = categoryMap[type || "cardio-endurance"];
  const fallbackProgramImage = programFallbackByType[type || ""] || "/images/programs/cardio-endurance-bg.jpg";
  // First filter by category from URL
  const currentTypePrograms = allPrograms.filter(program => {
    return program.category?.toUpperCase().includes(mappedCategory);
  });
  
  if (import.meta.env.DEV) {
    console.log("📦 Category filtered programs:", currentTypePrograms.length);
  }

  // Filter and sort programs with memoization
  const filteredPrograms = useMemo(() => {
    const filtered = currentTypePrograms.filter(program => {
      // Search filter
      if (debouncedSearch) {
        const searchLower = debouncedSearch.toLowerCase();
        const matchesName = program.name.toLowerCase().includes(searchLower);
        const matchesDescription = program.description?.toLowerCase().includes(searchLower);
        const matchesCategory = program.category?.toLowerCase().includes(searchLower);
        if (!matchesName && !matchesDescription && !matchesCategory) return false;
      }
    
      // Equipment filter
      if (equipmentFilter !== "all" && program.equipment?.toLowerCase() !== equipmentFilter) return false;
      
      // Level filter
      if (levelFilter !== "all" && program.difficulty?.toLowerCase() !== levelFilter) return false;
      
      // Duration filter
      if (durationFilter !== "all" && program.duration !== durationFilter) return false;
      
      // Status filter
      if (statusFilter !== "all" && userId) {
        const interaction = interactions.find(i => i.program_id === program.id);
        
        if (statusFilter === "viewed" && !interaction?.has_viewed) return false;
        if (statusFilter === "completed" && !interaction?.is_completed) return false;
        if (statusFilter === "not-viewed") {
          // Not viewed = no interaction OR has_viewed is false
          if (interaction?.has_viewed) return false;
        }
        if (statusFilter === "favorites" && !interaction?.is_favorite) return false;
      }
      
      // Access filter
      if (accessFilter === "free" && program.is_premium) return false;
      if (accessFilter === "premium" && !program.is_premium) return false;
      if (accessFilter === "purchasable" && (!program.is_standalone_purchase || !program.price)) return false;
      
      return true;
    });

    // Sort programs
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
  }, [currentTypePrograms, debouncedSearch, equipmentFilter, levelFilter, durationFilter, 
      statusFilter, sortBy, accessFilter, userId, interactions]);

  const programSlugs = useMemo(() => buildUniqueContentSlugs(currentTypePrograms), [currentTypePrograms]);

  if (type && !Object.prototype.hasOwnProperty.call(categoryMap, type)) {
    return <IndividualTrainingProgram />;
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
        <title>Smarty Programs | {title} | Haris Falas | SmartyGym</title>
        <meta name="description" content={`${title} online training programs by Sports Scientist Haris Falas. Professional structured long-term ${type || 'fitness'} programs. Evidence-based training for worldwide access. Expert online personal training approach.`} />
        <meta name="keywords" content={`online training programs, ${title}, ${type} programs, fitness programs, Haris Falas programs, structured training programs, online personal training, 6 week programs, 8 week programs, online fitness`} />
        
        {/* Open Graph */}
        <meta property="og:title" content={`${title} Online Training Programs | Haris Falas`} />
        <meta property="og:description" content={`Structured long-term ${title.toLowerCase()} online training programs by Sports Scientist Haris Falas`} />
        <meta property="og:type" content="website" />
        <meta property="og:url" content={`https://smartygym.com/trainingprogram/${type || ''}`} />
        <meta property="og:site_name" content="SmartyGym" />
        
        {/* Twitter */}
        <meta name="twitter:card" content="summary_large_image" />
        <meta name="twitter:title" content={`${title} Online Training Programs | Haris Falas`} />
        <meta name="twitter:description" content={`Professional ${title.toLowerCase()} with structured progression by Cyprus expert`} />
        
        <link rel="canonical" href={`https://smartygym.com/trainingprogram/${type || ''}`} />
        
        {/* Structured Data - Collection of Training Programs */}
        <script type="application/ld+json">
          {JSON.stringify({
            "@context": "https://schema.org",
            "@type": "ItemList",
            "name": `${title} Online Training Programs`,
            "description": `Collection of structured long-term ${title.toLowerCase()} training programs designed by Sports Scientist Haris Falas`,
            "numberOfItems": filteredPrograms.length,
            "provider": {
              "@type": "Person",
              "name": "Haris Falas",
              "jobTitle": "Sports Scientist & Personal Trainer",
              "description": "Online personal trainer with expertise in structured program design"
            },
            "itemListElement": filteredPrograms.slice(0, 50).map((program, index) => ({
              "@type": "ListItem",
              "position": index + 1,
              "item": {
                "@type": "ExercisePlan",
                "name": program.name,
                "description": program.description,
                "image": program.image_url ? {
                  "@type": "ImageObject",
                  "url": program.image_url,
                  "name": `${program.name} - online ${program.category || ''} training program by Haris Falas at SmartyGym SmartGym Smart Gym`,
                  "caption": `${program.duration || ''} week structured training program - SmartyGym SmartGym online fitness platform`
                } : undefined,
                "duration": program.duration,
                "workLocation": "Online / Home / Gym",
                "exerciseType": program.category
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
            { label: "Smarty Programs", href: "/trainingprogram" },
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
              placeholder="Search programs by name or keyword..."
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
            {
              name: "Duration",
              value: durationFilter,
              onChange: (value) => setDurationFilter(value as DurationFilter),
              placeholder: "Duration",
              options: [
                { value: "all", label: "All Durations" },
                { value: "4", label: "4 Weeks" },
                { value: "6", label: "6 Weeks" },
                { value: "8", label: "8 Weeks" },
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
                { value: "all", label: "All Programs" },
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
            Showing {filteredPrograms.length} of {currentTypePrograms.length} programs
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

        {/* Program Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
          {filteredPrograms.map((program) => {
            const interaction = userId ? interactions.find(i => i.program_id === program.id) : null;
            const isViewed = interaction?.has_viewed;
            const isCompleted = interaction?.is_completed;
            const isFavorite = interaction?.is_favorite;
            const isNewProgram = isNew(program.created_at);
            
            return (
              <Card
                key={program.id}
                className="overflow-hidden cursor-pointer transition-all duration-300 hover:scale-105 hover:shadow-primary bg-card border-border relative"
                onClick={() => navigate(`/trainingprogram/${type}/${programSlugs.get(program.id) || slugifyContentName(program.name || program.id)}`)}
              >
                <div className="relative h-48 w-full overflow-hidden">
                  {/* Equipment Badge - Top Left */}
                  <div className="absolute top-2 left-2 z-10">
                    {program.equipment?.toUpperCase() === 'BODYWEIGHT' || program.equipment?.toLowerCase().includes('no equipment') ? (
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
                  {isNewProgram && (
                    <div className="absolute top-2 right-2 z-10">
                      <span className="inline-flex items-center gap-1 bg-gradient-to-r from-yellow-400 to-orange-500 text-white text-xs font-bold px-2 py-1 rounded-full shadow-lg animate-pulse">
                        <Sparkles className="h-3 w-3 shrink-0" />
                        NEW
                      </span>
                    </div>
                  )}

                  {/* Premium/Free Badge - Bottom Right */}
                  <div className="absolute bottom-2 right-2 z-10">
                    {program.is_premium ? (freeAccessMode ? null : (
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
                    src={program.image_url || fallbackProgramImage}
                    alt={`${program.name} - ${program.duration} training program by Haris Falas Sports Scientist at SmartyGym SmartGym Smart Gym smartygym.com`}
                    className="w-full h-full object-cover"
                    loading="lazy"
                    onError={(e) => {
                      e.currentTarget.onerror = null;
                      e.currentTarget.src = fallbackProgramImage;
                    }}
                  />
                </div>
                
                <div className="p-4 space-y-3">
                  <h3 className="font-semibold text-base sm:text-lg">{program.name}</h3>
                  <p className="text-xs sm:text-sm text-muted-foreground line-clamp-2">{stripHtmlTags(program.description || "")}</p>
                  
                  {/* Details Row - Category, Difficulty, Duration */}
                  <div className="flex items-center gap-2 flex-wrap text-xs text-muted-foreground">
                    {/* Category */}
                    <div className="flex items-center gap-1">
                      <Layers className="h-3 w-3 shrink-0 text-primary" />
                      <span className={`font-medium ${getCategoryColor(program.category)}`}>
                        {program.category}
                      </span>
                    </div>
                    <span>•</span>
                    
                    {/* Difficulty */}
                    <div className="flex items-center gap-1">
                      <TrendingUp className={`h-3 w-3 shrink-0 ${getDifficultyColorClasses(program.difficulty_stars || program.difficulty).icon}`} />
                      <span className={`capitalize font-medium ${getDifficultyColorClasses(program.difficulty_stars || program.difficulty).text}`}>{getDifficultyFromStars(program.difficulty, program.difficulty_stars)}</span>
                      {program.difficulty_stars && (
                        <span className="text-yellow-500">({program.difficulty_stars}★)</span>
                      )}
                    </div>
                    <span>•</span>
                    
                    {/* Duration - Weeks and Days per Week */}
                    <div className="flex items-center gap-1">
                      <Calendar className="h-3 w-3 shrink-0 text-purple-600 dark:text-purple-400" />
                      <span className="text-purple-600 dark:text-purple-400 font-medium">{program.weeks} Weeks / {program.days_per_week} Days/Week</span>
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
                  {program.is_standalone_purchase && program.price && userTier !== "premium" && !hasPurchased(program.id, "program") && (
                    <div className="flex items-center">
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <span className="inline-flex items-center gap-1 bg-gradient-to-r from-green-500 to-emerald-600 text-white text-xs font-semibold px-2 py-1 rounded-full cursor-help">
                            <ShoppingCart className="h-3 w-3 shrink-0" />
                            BUY €{Number(program.price).toFixed(2)}
                          </span>
                        </TooltipTrigger>
                        <TooltipContent side="top" align="center" className="max-w-xs text-center">
                          Buy this program individually to try our coaching style before committing to a subscription.
                        </TooltipContent>
                      </Tooltip>
                    </div>
                  )}
                </div>
              </Card>
            );
          })}
        </div>

        {filteredPrograms.length === 0 && (
          <Card className="p-8">
            <p className="text-center text-muted-foreground">
              No programs found for this combination. Try different filters.
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

export default TrainingProgramDetail;
