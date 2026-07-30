import { useEffect, useState, useCallback, useRef } from "react";
import { Helmet } from "react-helmet";
import { Link, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAccessControl } from "@/hooks/useAccessControl";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PageBreadcrumbs } from "@/components/PageBreadcrumbs";
import { DesktopPageIntro } from "@/components/DesktopPageIntro";
import { InfoRibbon } from "@/components/InfoRibbon";
import { SEOEnhancer } from "@/components/SEOEnhancer";

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Carousel,
  CarouselContent,
  CarouselItem,
  CarouselPrevious,
  CarouselNext,
  type CarouselApi,
} from "@/components/ui/carousel";
import { Trophy, MessageSquare, Star, User, Calendar, ClipboardCheck, Eye, Award, Quote, Lock, Crown } from "lucide-react";
import { SwipeToExplore } from "@/components/ui/SwipeToExplore";
import { TestimonialsSection } from "@/components/community/TestimonialsSection";
import { formatDistanceToNow } from "date-fns";
import { CompactFilters } from "@/components/CompactFilters";
import { generateTestimonialsSchema, generateCommunityLeaderboardSchema } from "@/utils/seoHelpers";

// Mapping for fake comment user IDs to display names
const FAKE_USER_DISPLAY_NAMES: Record<string, string> = {
  '00000000-0000-0000-0000-000000000012': 'Alexandra Mitchell',
  '00000000-0000-0000-0000-000000000013': 'Thomas Anderson',
  '00000000-0000-0000-0000-000000000014': 'Sophia Williams',
  '00000000-0000-0000-0000-000000000015': 'Marcus Chen',
  '00000000-0000-0000-0000-000000000016': 'Emma Richardson',
  '00000000-0000-0000-0000-000000000017': 'Daniel Foster',
  '00000000-0000-0000-0000-000000000018': 'Rachel Torres',
};

interface LeaderboardEntry {
  user_id: string;
  display_name: string;
  total_completions: number;
}

interface RatedContent {
  content_id: string;
  content_name: string;
  content_type: "workout" | "program";
  workout_type?: string;
  program_type?: string;
  average_rating: number;
  rating_count: number;
}

interface Comment {
  id: string;
  user_id: string;
  workout_id: string | null;
  workout_name: string | null;
  workout_type: string | null;
  program_id: string | null;
  program_name: string | null;
  program_type: string | null;
  comment_text: string;
  created_at: string;
  display_name: string;
}
interface Testimonial {
  id: string;
  display_name: string;
  rating: number;
  testimonial_text: string;
  created_at: string;
}

const Community = () => {
  const navigate = useNavigate();
  const { userTier, purchasedContent } = useAccessControl();
  const canViewLeaderboard =
    userTier === "premium" ||
    (userTier === "subscriber" && purchasedContent.size > 0);

  const [workoutLeaderboard, setWorkoutLeaderboard] = useState<LeaderboardEntry[]>([]);
  const [programLeaderboard, setProgramLeaderboard] = useState<LeaderboardEntry[]>([]);
  const [checkinLeaderboard, setCheckinLeaderboard] = useState<LeaderboardEntry[]>([]);
  const [ratedContent, setRatedContent] = useState<RatedContent[]>([]);
  const [comments, setComments] = useState<Comment[]>([]);
  const [testimonials, setTestimonials] = useState<Testimonial[]>([]);
  const [isLoadingLeaderboard, setIsLoadingLeaderboard] = useState(true);
  const [isLoadingRatings, setIsLoadingRatings] = useState(true);
  const [isLoadingComments, setIsLoadingComments] = useState(true);
  const [leaderboardFilter, setLeaderboardFilter] = useState<"workouts" | "programs" | "checkins">("workouts");
  const [ratingsFilter, setRatingsFilter] = useState<"workouts" | "programs">("workouts");
  const [commentsFilter, setCommentsFilter] = useState<"all" | "workouts" | "programs">("all");
  const [expandedComments, setExpandedComments] = useState<Set<string>>(new Set());

  const toggleCommentExpanded = (commentId: string) => {
    setExpandedComments(prev => {
      const newSet = new Set(prev);
      if (newSet.has(commentId)) {
        newSet.delete(commentId);
      } else {
        newSet.add(commentId);
      }
      return newSet;
    });
  };
  const [sortOrder, setSortOrder] = useState<"newest" | "oldest">("newest");
  const [testimonialsSortOrder, setTestimonialsSortOrder] = useState<"newest" | "oldest">("newest");
  
  
  // Modal state for comments only (Leaderboard and Ratings are top 6 competitions)
  const [showCommentsModal, setShowCommentsModal] = useState(false);
  
  // Mobile carousel state
  const [carouselApi, setCarouselApi] = useState<CarouselApi>();
  const [selectedSlide, setSelectedSlide] = useState(0);

  // Desktop carousel state
  const [desktopCarouselApi, setDesktopCarouselApi] = useState<CarouselApi>();
  const [desktopSelectedSlide, setDesktopSelectedSlide] = useState(0);

  // Fixed height for all mobile carousel slides so cards stay consistent
  // regardless of auth state or which slide has the tallest content.
  const MOBILE_CAROUSEL_CARD_CLASS = "h-[480px]";

  // Update selected slide when mobile carousel changes
  useEffect(() => {
    if (!carouselApi) return;
    
    const onSelect = () => {
      setSelectedSlide(carouselApi.selectedScrollSnap());
    };
    
    carouselApi.on("select", onSelect);
    onSelect();
    
    return () => {
      carouselApi.off("select", onSelect);
    };
  }, [carouselApi]);

  // Update selected slide when desktop carousel changes
  useEffect(() => {
    if (!desktopCarouselApi) return;
    
    const onSelect = () => {
      setDesktopSelectedSlide(desktopCarouselApi.selectedScrollSnap());
    };
    
    desktopCarouselApi.on("select", onSelect);
    onSelect();
    
    return () => {
      desktopCarouselApi.off("select", onSelect);
    };
  }, [desktopCarouselApi]);


  useEffect(() => {
    if (canViewLeaderboard) {
      fetchLeaderboards();
    } else {
      setIsLoadingLeaderboard(false);
    }
    fetchRatedContent();
    fetchTestimonials();
  }, [canViewLeaderboard]);

  useEffect(() => {
    fetchComments();
  }, [sortOrder, commentsFilter]);

  const fetchTestimonials = async () => {
    try {
      const { data, error } = await supabase.rpc("get_public_testimonials");
      if (error) throw error;
      setTestimonials(data || []);
    } catch (error) {
      console.error("Error fetching testimonials for SEO:", error);
    }
  };

  const fetchLeaderboards = async () => {
    try {
      // Use secure RPC functions that bypass RLS to aggregate across all users
      const [workoutResult, programResult, checkinResult] = await Promise.all([
        supabase.rpc('get_workout_leaderboard'),
        supabase.rpc('get_program_leaderboard'),
        supabase.rpc('get_checkin_leaderboard'),
      ]);

      if (workoutResult.error) console.error("Workout leaderboard error:", workoutResult.error);
      if (programResult.error) console.error("Program leaderboard error:", programResult.error);
      if (checkinResult.error) console.error("Checkin leaderboard error:", checkinResult.error);

      const workoutEntries: LeaderboardEntry[] = (workoutResult.data || []).map((item: any) => ({
        user_id: item.user_id,
        display_name: item.display_name || "Anonymous User",
        total_completions: Number(item.completed_count),
      }));
      setWorkoutLeaderboard(workoutEntries);

      const programEntries: LeaderboardEntry[] = (programResult.data || []).map((item: any) => ({
        user_id: item.user_id,
        display_name: item.display_name || "Anonymous User",
        total_completions: Number(item.completed_count),
      }));
      setProgramLeaderboard(programEntries);

      const checkinEntries: LeaderboardEntry[] = (checkinResult.data || []).map((item: any) => ({
        user_id: item.user_id,
        display_name: item.display_name || "Anonymous User",
        total_completions: Number(item.consistency_score),
      }));
      setCheckinLeaderboard(checkinEntries);
      
    } catch (error) {
      console.error("Error fetching leaderboards:", error);
    } finally {
      setIsLoadingLeaderboard(false);
    }
  };

  const fetchRatedContent = async () => {
    try {
      // Use secure RPC functions that bypass RLS to aggregate ratings across all users
      const [workoutResult, programResult] = await Promise.all([
        supabase.rpc('get_workout_ratings'),
        supabase.rpc('get_program_ratings'),
      ]);

      if (workoutResult.error) console.error("Workout ratings error:", workoutResult.error);
      if (programResult.error) console.error("Program ratings error:", programResult.error);

      const allRatedContent: RatedContent[] = [];

      (workoutResult.data || []).forEach((item: any) => {
        allRatedContent.push({
          content_id: item.workout_id,
          content_name: item.workout_name,
          content_type: "workout",
          workout_type: item.workout_type,
          average_rating: Number(item.average_rating),
          rating_count: Number(item.rating_count),
        });
      });

      (programResult.data || []).forEach((item: any) => {
        allRatedContent.push({
          content_id: item.program_id,
          content_name: item.program_name,
          content_type: "program",
          program_type: item.program_type,
          average_rating: Number(item.average_rating),
          rating_count: Number(item.rating_count),
        });
      });

      allRatedContent.sort((a, b) => {
        if (b.average_rating !== a.average_rating) return b.average_rating - a.average_rating;
        return b.rating_count - a.rating_count;
      });

      setRatedContent(allRatedContent);
    } catch (error) {
      console.error("Error fetching rated content:", error);
    } finally {
      setIsLoadingRatings(false);
    }
  };

  const fetchComments = async () => {
    try {
      let query = supabase
        .from("workout_comments")
        .select("id, user_id, workout_id, workout_name, workout_type, program_id, program_name, program_type, comment_text, created_at")
        .order("created_at", { ascending: sortOrder === "oldest" })
        .limit(50);

      // Apply filter
      if (commentsFilter === "workouts") {
        query = query.not("workout_name", "is", null);
      } else if (commentsFilter === "programs") {
        query = query.not("program_name", "is", null);
      }

      const { data: commentsData, error: commentsError } = await query;

      if (commentsError) throw commentsError;

      // Fetch profiles for comment authors
      const userIds = [...new Set(commentsData?.map((c) => c.user_id) || [])];
      const { data: profilesData, error: profilesError } = await supabase.rpc(
        "get_profile_display_names",
        { user_ids: userIds }
      );

      if (profilesError) {
        console.error("Error fetching profiles for comments:", profilesError);
      }

      // Combine comments with display names (check fake names first, then profiles)
      const commentsWithNames = commentsData?.map((comment) => {
        const fakeName = FAKE_USER_DISPLAY_NAMES[comment.user_id];
        const profile = profilesData?.find((p) => p.user_id === comment.user_id);
        return {
          ...comment,
          display_name: fakeName || profile?.full_name || "Anonymous User",
        };
      }) || [];

      const allComments = commentsWithNames;
      allComments.sort((a, b) => {
        const dateA = new Date(a.created_at).getTime();
        const dateB = new Date(b.created_at).getTime();
        return sortOrder === "newest" ? dateB - dateA : dateA - dateB;
      });

      setComments(allComments);
    } catch (error) {
      console.error("Error fetching comments:", error);
    } finally {
      setIsLoadingComments(false);
    }
  };

  const getMedalIcon = (index: number) => {
    if (index === 0) return "🥇";
    if (index === 1) return "🥈";
    if (index === 2) return "🥉";
    if (index === 3) return (
      <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-amber-100 dark:bg-amber-900/30">
        <Award className="h-4 w-4 text-amber-600 dark:text-amber-400" />
      </span>
    );
    if (index === 4) return (
      <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-slate-100 dark:bg-slate-800">
        <Award className="h-4 w-4 text-slate-600 dark:text-slate-400" />
      </span>
    );
    if (index === 5) return (
      <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-primary/10 dark:bg-primary/20">
        <Award className="h-4 w-4 text-primary" />
      </span>
    );
    // Positions 7-10 (indices 6-9) - gray badges
    if (index >= 6 && index <= 9) return (
      <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-gray-200 dark:bg-gray-700">
        <Award className="h-4 w-4 text-gray-500 dark:text-gray-400" />
      </span>
    );
    return null;
  };

  // Top 6 competition logic for leaderboard (always sorted by most completions)
  const getLeaderboardWithPlaceholders = (): (LeaderboardEntry | null)[] => {
    let data: LeaderboardEntry[];
    if (leaderboardFilter === "workouts") {
      data = workoutLeaderboard;
    } else if (leaderboardFilter === "programs") {
      data = programLeaderboard;
    } else {
      data = checkinLeaderboard;
    }
    
    // Always sort by most completions (descending)
    const sorted = [...data].sort((a, b) => b.total_completions - a.total_completions);
    
    // Fill with placeholders for 10 positions
    const result: (LeaderboardEntry | null)[] = [];
    for (let i = 0; i < 10; i++) {
      result.push(sorted[i] || null);
    }
    return result;
  };

  // Top 6 competition logic for ratings (always sorted by highest rating)
  const getRatingsWithPlaceholders = (): (RatedContent | null)[] => {
    const data = ratedContent.filter(item => 
      item.content_type === (ratingsFilter === "workouts" ? "workout" : "program")
    );
    
    // Always sort by highest rating (descending), then by review count
    const sorted = [...data].sort((a, b) => {
      if (b.average_rating !== a.average_rating) {
        return b.average_rating - a.average_rating;
      }
      return b.rating_count - a.rating_count;
    });
    
    // Fill with placeholders for 10 positions
    const result: (RatedContent | null)[] = [];
    for (let i = 0; i < 10; i++) {
      result.push(sorted[i] || null);
    }
    return result;
  };

  // Get top 6 comments
  const getTopComments = () => {
    return comments.slice(0, 6);
  };

  const LockedLeaderboardBody = ({ compact = false }: { compact?: boolean }) => (
    <div className={`flex flex-col items-center justify-center text-center ${compact ? "py-8 px-4" : "py-16 px-6"} h-full`}>
      <div className="p-4 bg-primary/10 rounded-full mb-4">
        <Lock className="h-8 w-8 text-primary" />
      </div>
      <h3 className="font-semibold text-base md:text-lg mb-2">Leaderboard is for competitors</h3>
      <p className="text-sm text-muted-foreground mb-5 max-w-xs">
        The leaderboard is reserved for premium members and customers who purchased a workout or program — the people who can earn entries here.
      </p>
      <div className="flex flex-col gap-2 w-full max-w-[220px]">
        <Button onClick={() => navigate("/smarty-premium")} size="sm" className="w-full">
          <Crown className="h-4 w-4 mr-2" />
          Upgrade to Premium
        </Button>
        {userTier === "guest" && (
          <Button onClick={() => navigate("/auth")} variant="outline" size="sm" className="w-full">
            Log In / Sign Up
          </Button>
        )}
      </div>
    </div>
  );

  return (
    <>
      <Helmet>
        <title>SmartyGym Reviews | HFM Reviews | Haris Falas Testimonials | Community</title>
        <meta name="description" content="Read 22+ verified SmartyGym reviews and testimonials. Real member feedback on Coach Haris Falas fitness programs. HFM reviews, Smarty Gym reviews, smartygym.com reviews. 4.59/5 average rating." />
        <meta name="keywords" content="SmartyGym reviews, smartygym reviews, Smarty Gym reviews, smartygym.com reviews, HFM reviews, Haris Falas reviews, Haris Falas testimonials, gym reviews, online fitness reviews, fitness platform reviews, Haris Falas fitness reviews, SmartyGym testimonials, SmartyGym member reviews, online gym reviews, fitness community, workout leaderboards, member reviews, fitness social, training community, SmartyGym community, fitness motivation, workout reviews, online fitness community" />
        <link rel="canonical" href="https://smartygym.com/community" />
        
        {/* AI Search Optimization - Reviews Focus */}
        <meta name="ai-content-type" content="reviews-testimonials" />
        <meta name="ai-reviews" content={`${testimonials.length} verified SmartyGym member reviews`} />
        <meta name="ai-rating" content={testimonials.length > 0 ? `${(testimonials.reduce((sum, t) => sum + t.rating, 0) / testimonials.length).toFixed(2)} out of 5 stars from ${testimonials.length} reviews` : ''} />
        <meta name="ai-brand-reviews" content="SmartyGym reviews, HFM reviews, Haris Falas reviews, smartygym.com reviews, Smarty Gym reviews" />
        <meta name="ai-review-summary" content={`SmartyGym has ${testimonials.length} verified reviews with an average rating of ${testimonials.length > 0 ? (testimonials.reduce((sum, t) => sum + t.rating, 0) / testimonials.length).toFixed(2) : '0'}/5. Read real member testimonials about Coach Haris Falas fitness programs.`} />
        
        {/* Community Leaderboard Schema */}
        <script type="application/ld+json">
          {JSON.stringify(generateCommunityLeaderboardSchema('workouts'))}
        </script>
        
        {/* Testimonials with AggregateRating Schema */}
        {testimonials.length > 0 && (
          <script type="application/ld+json">
            {JSON.stringify(generateTestimonialsSchema(
              testimonials.map(t => ({
                author: t.display_name,
                rating: t.rating,
                text: t.testimonial_text,
                datePublished: t.created_at.split('T')[0]
              }))
            ))}
          </script>
        )}
        
        {/* Individual Review Schemas for Rich Results */}
        {testimonials.slice(0, 5).map((testimonial, index) => (
          <script key={testimonial.id} type="application/ld+json">
            {JSON.stringify({
              "@context": "https://schema.org",
              "@type": "Review",
              "author": {
                "@type": "Person",
                "name": testimonial.display_name
              },
              "reviewRating": {
                "@type": "Rating",
                "ratingValue": testimonial.rating,
                "bestRating": 5,
                "worstRating": 1
              },
              "reviewBody": testimonial.testimonial_text,
              "datePublished": testimonial.created_at.split('T')[0],
              "itemReviewed": {
                "@type": "Product",
                "name": "SmartyGym Premium Membership",
                "brand": { "@type": "Organization", "name": "SmartyGym" },
                "url": "https://smartygym.com"
              },
              "publisher": {
                "@type": "Organization",
                "name": "SmartyGym"
              }
            })}
          </script>
        ))}
      </Helmet>
      
      <SEOEnhancer 
        entities={["SmartyGym", "SmartyGym Reviews", "HFM Reviews", "Haris Falas", "Fitness Community"]}
        topics={["SmartyGym reviews", "HFM reviews", "Haris Falas reviews", "smartygym.com reviews", "Smarty Gym reviews", "fitness community", "workout leaderboards", "member reviews", "fitness motivation"]}
        expertise={["Fitness Reviews", "Member Testimonials", "Community Building"]}
        contentType="reviews-testimonials"
        aiSummary={`SmartyGym reviews page with ${testimonials.length} verified member testimonials. Read real feedback about Coach Haris Falas fitness programs. HFM reviews, Smarty Gym reviews, smartygym.com reviews. Average rating: ${testimonials.length > 0 ? (testimonials.reduce((sum, t) => sum + t.rating, 0) / testimonials.length).toFixed(2) : '0'}/5 stars.`}
        aiKeywords={["SmartyGym reviews", "smartygym reviews", "HFM reviews", "Haris Falas reviews", "smartygym.com reviews", "Smarty Gym reviews", "gym reviews", "online fitness reviews", "fitness platform reviews", "fitness community", "workout leaderboards", "member reviews"]}
        relatedContent={["Workout Library", "Training Programs", "Premium Membership", "Coach Profile"]}
        targetAudience="fitness enthusiasts looking for SmartyGym reviews, people researching Haris Falas, potential members"
        pageType="ReviewsPage"
      />

      <div className="min-h-screen bg-background">
        <div className="container mx-auto max-w-6xl md:max-w-[1500px] px-4 md:px-6 pb-8">
          
          <PageBreadcrumbs
            items={[
              { label: "Home", href: "/" },
              { label: "Community" }
            ]} 
          />

          {/* About Community */}
          <DesktopPageIntro icon={Trophy} title="Community">
            <p className="font-bold text-foreground">
              Welcome to <span className="text-primary font-semibold">SmartyGym</span> Community! Connect, compete, and interact through leaderboards and shared experiences.
            </p>
          </DesktopPageIntro>

          <Card className="lg:hidden mb-6 md:mb-8 bg-white dark:bg-card border-2 border-primary/40 shadow-primary">
            <CardContent className="p-4 sm:p-5">
              <h2 className="text-xl sm:text-2xl font-extrabold tracking-tight uppercase mb-3 text-center">Community</h2>
              <div className="space-y-2 text-muted-foreground max-w-3xl mx-auto">
                <p className="text-sm sm:text-base text-center font-bold">
                  Welcome to <span className="text-primary font-semibold">SmartyGym</span> Community! Connect, compete, and interact through leaderboards and shared experiences.
                </p>
              </div>
            </CardContent>
          </Card>

          {/* Mobile: Swipe indicator */}
          <div className="md:hidden">
            <SwipeToExplore onPrev={() => carouselApi?.scrollPrev()} onNext={() => carouselApi?.scrollNext()} />
          </div>

          {/* Desktop: Swipe indicator */}
          <div className="hidden md:block">
            <SwipeToExplore onPrev={() => desktopCarouselApi?.scrollPrev()} onNext={() => desktopCarouselApi?.scrollNext()} />
          </div>

          {/* Mobile: Carousel of all community cards with peek effect */}
          <div className="md:hidden mb-6 px-4">
            <Carousel setApi={setCarouselApi} className="w-full">
              <CarouselContent className="-ml-2">
                {/* Slide 1: Leaderboard */}
                <CarouselItem className="pl-2 basis-[88%]">
                  <Card className={`border-2 border-green-500/60 shadow-lg flex flex-col ${MOBILE_CAROUSEL_CARD_CLASS}`}>
                    <CardHeader className="bg-gradient-to-r from-primary/10 to-primary/5 p-4">
                      <CardTitle className="flex items-center gap-2 text-lg">
                        <Trophy className="h-5 w-5 text-primary" />
                        Leaderboard
                      </CardTitle>
                      {canViewLeaderboard && (
                      <CompactFilters
                        filters={[
                          {
                            name: "Type",
                            value: leaderboardFilter,
                            onChange: (value) => setLeaderboardFilter(value as "workouts" | "programs" | "checkins"),
                            options: [
                              { value: "workouts", label: "Workouts" },
                              { value: "programs", label: "Programs" },
                              { value: "checkins", label: "Check-ins" }
                            ],
                            placeholder: "Select type"
                          }
                        ]}
                      />
                      )}
                    </CardHeader>
                    <CardContent className="p-3 flex-1 min-h-0 overflow-auto">
                      {!canViewLeaderboard ? (
                        <LockedLeaderboardBody compact />
                      ) : isLoadingLeaderboard ? (
                        <div className="space-y-2">
                          {[...Array(10)].map((_, i) => (
                            <Skeleton key={i} className="h-10 w-full" />
                          ))}
                        </div>
                      ) : (
                        <Table>
                          <TableHeader>
                            <TableRow className="border-primary/30">
                              <TableHead className="w-10 text-xs p-2">Rank</TableHead>
                              <TableHead className="text-xs p-2">Member</TableHead>
                              <TableHead className="text-right text-xs p-2">{leaderboardFilter === "checkins" ? "Score" : "Done"}</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {getLeaderboardWithPlaceholders().map((entry, index) => (
                              <TableRow key={entry?.user_id || `empty-${index}`} className="border-primary/20">
                                <TableCell className="p-2">
                                  <span className="text-sm">{getMedalIcon(index)}</span>
                                </TableCell>
                                <TableCell className="p-2">
                                  {entry ? (
                                    <div className="flex items-center gap-1">
                                      <User className="h-3 w-3 text-muted-foreground flex-shrink-0" />
                                      <span className="text-xs truncate max-w-[100px]">{entry.display_name}</span>
                                    </div>
                                  ) : (
                                    <span className="text-muted-foreground italic text-xs">Awaiting...</span>
                                  )}
                                </TableCell>
                                <TableCell className="text-right p-2">
                                  {entry ? (
                                    <span className="inline-flex px-2 py-0.5 rounded-full bg-primary/10 text-primary font-semibold text-xs">
                                      {entry.total_completions}
                                    </span>
                                  ) : (
                                    <span className="text-muted-foreground">---</span>
                                  )}
                                </TableCell>
                              </TableRow>
                            ))}
                          </TableBody>
                        </Table>
                      )}
                    </CardContent>
                  </Card>
                </CarouselItem>

                {/* Slide 2: Ratings */}
                <CarouselItem className="pl-2 basis-[88%]">
                  <Card className={`border-2 border-green-500/60 shadow-lg flex flex-col ${MOBILE_CAROUSEL_CARD_CLASS}`}>
                    <CardHeader className="bg-gradient-to-r from-primary/10 to-primary/5 p-4">
                      <CardTitle className="flex items-center gap-2 text-lg">
                        <Star className="h-5 w-5 text-primary" />
                        Ratings
                      </CardTitle>
                      <CompactFilters
                        filters={[
                          {
                            name: "Type",
                            value: ratingsFilter,
                            onChange: (value) => setRatingsFilter(value as "workouts" | "programs"),
                            options: [
                              { value: "workouts", label: "Workouts" },
                              { value: "programs", label: "Programs" }
                            ],
                            placeholder: "Select type"
                          }
                        ]}
                      />
                    </CardHeader>
                    <CardContent className="p-3 flex-1 min-h-0 overflow-auto">
                      {isLoadingRatings ? (
                        <div className="space-y-2">
                          {[...Array(10)].map((_, i) => (
                            <Skeleton key={i} className="h-10 w-full" />
                          ))}
                        </div>
                      ) : (
                        <Table>
                          <TableHeader>
                            <TableRow className="border-primary/30">
                              <TableHead className="w-10 text-xs p-2">Rank</TableHead>
                              <TableHead className="text-xs p-2">Name</TableHead>
                              <TableHead className="text-center text-xs p-2">Rating</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {getRatingsWithPlaceholders().map((item, index) => (
                              <TableRow key={item?.content_id || `empty-${index}`} className="border-primary/20">
                                <TableCell className="p-2">
                                  <span className="text-sm">{getMedalIcon(index)}</span>
                                </TableCell>
                                <TableCell className="p-2">
                                  {item ? (
                                    <Link 
                                      to={item.content_type === "workout" 
                                        ? `/workout/${item.workout_type}/${item.content_id}`
                                        : `/trainingprogram/${item.program_type}/${item.content_id}`
                                      }
                                      className="text-xs truncate text-primary hover:underline max-w-[100px] block"
                                    >
                                      {item.content_name}
                                    </Link>
                                  ) : (
                                    <span className="text-muted-foreground italic text-xs">Awaiting...</span>
                                  )}
                                </TableCell>
                                <TableCell className="text-center p-2">
                                  {item ? (
                                    <div className="flex items-center justify-center gap-1">
                                      <Star className="h-3 w-3 fill-primary text-primary" />
                                      <span className="font-semibold text-xs">{item.average_rating.toFixed(1)}</span>
                                    </div>
                                  ) : (
                                    <span className="text-muted-foreground">---</span>
                                  )}
                                </TableCell>
                              </TableRow>
                            ))}
                          </TableBody>
                        </Table>
                      )}
                    </CardContent>
                  </Card>
                </CarouselItem>

                {/* Slide 3: Comments */}
                <CarouselItem className="pl-2 basis-[88%]">
                  <Card className={`border-2 border-green-500/60 shadow-lg flex flex-col ${MOBILE_CAROUSEL_CARD_CLASS}`}>
                    <CardHeader className="bg-gradient-to-r from-primary/10 to-primary/5 p-4">
                      <CardTitle className="flex items-center gap-2 text-lg">
                        <MessageSquare className="h-5 w-5 text-primary" />
                        Comments
                      </CardTitle>
                      <CompactFilters
                        compact
                        filters={[
                          {
                            name: "Type",
                            value: commentsFilter,
                            onChange: (value) => setCommentsFilter(value as "all" | "workouts" | "programs"),
                            options: [
                              { value: "all", label: "All" },
                              { value: "workouts", label: "Workouts" },
                              { value: "programs", label: "Programs" }
                            ],
                            placeholder: "Type"
                          },
                          {
                            name: "Sort",
                            value: sortOrder,
                            onChange: (value) => setSortOrder(value as "newest" | "oldest"),
                            options: [
                              { value: "newest", label: "New" },
                              { value: "oldest", label: "Old" }
                            ],
                            placeholder: "Sort"
                          }
                        ]}
                      />
                    </CardHeader>
                    <CardContent className="p-3 flex-1 overflow-auto">
                      {isLoadingComments ? (
                        <div className="space-y-2">
                          {[...Array(6)].map((_, i) => (
                            <Skeleton key={i} className="h-16 w-full" />
                          ))}
                        </div>
                      ) : comments.length === 0 ? (
                        <div className="text-center py-8 text-muted-foreground">
                          <MessageSquare className="h-8 w-8 mx-auto mb-2 opacity-30" />
                          <p className="text-sm">No comments yet</p>
                        </div>
                      ) : (
                        <>
                          <div className="space-y-2">
                            {getTopComments().map((comment) => {
                              const isExpanded = expandedComments.has(comment.id);
                              return (
                                <div
                                  key={comment.id}
                                  onClick={() => toggleCommentExpanded(comment.id)}
                                  className="p-2 rounded-lg border border-primary/20 bg-gradient-to-r from-background to-primary/5 cursor-pointer active:bg-primary/10 transition-colors"
                                >
                                  <div className="flex items-center justify-between mb-1">
                                    <div className="flex items-center gap-1">
                                      <User className="h-3 w-3 text-primary flex-shrink-0" />
                                      <span className="font-semibold text-xs truncate max-w-[100px]">
                                        {comment.display_name}
                                      </span>
                                    </div>
                                    <span className="text-[10px] text-muted-foreground">
                                      {formatDistanceToNow(new Date(comment.created_at), { addSuffix: true })}
                                    </span>
                                  </div>
                                  <p className="text-[10px] text-primary font-medium mb-1">
                                    {comment.workout_name ? (
                                      <>
                                        Workout:{" "}
                                        <Link
                                          to={`/workout/${comment.workout_type}/${comment.workout_id}`}
                                          className="hover:underline font-semibold"
                                          onClick={(e) => e.stopPropagation()}
                                        >
                                          {comment.workout_name}
                                        </Link>
                                      </>
                                    ) : (
                                      <>
                                        Program:{" "}
                                        <Link
                                          to={`/trainingprogram/${comment.program_type}/${comment.program_id}`}
                                          className="hover:underline font-semibold"
                                          onClick={(e) => e.stopPropagation()}
                                        >
                                          {comment.program_name}
                                        </Link>
                                      </>
                                    )}
                                  </p>
                                  <p className={`text-xs leading-relaxed ${isExpanded ? '' : 'line-clamp-2'}`}>
                                    {comment.comment_text}
                                  </p>
                                  {!isExpanded && comment.comment_text.length > 80 && (
                                    <p className="text-[10px] text-muted-foreground mt-1">Tap to read more</p>
                                  )}
                                </div>
                              );
                            })}
                          </div>
                          {comments.length > 6 && (
                            <div className="mt-3 text-center">
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => setShowCommentsModal(true)}
                                className="gap-1 text-xs h-8"
                              >
                                <Eye className="h-3 w-3" />
                                View All ({comments.length})
                              </Button>
                            </div>
                          )}
                        </>
                      )}
                    </CardContent>
                  </Card>
                </CarouselItem>

                {/* Slide 4: Testimonials */}
                <CarouselItem className="pl-2 basis-[88%]">
                  <div className={MOBILE_CAROUSEL_CARD_CLASS}>
                    <TestimonialsSection compact />
                  </div>
                </CarouselItem>
              </CarouselContent>
            </Carousel>
            
            {/* Dot navigation indicators */}
            <div className="flex justify-center gap-2 mt-4">
              {[0, 1, 2, 3].map((index) => (
                <button
                  key={index}
                  onClick={() => carouselApi?.scrollTo(index)}
                  className={`h-2.5 w-2.5 rounded-full transition-all duration-200 ${
                    selectedSlide === index 
                      ? "bg-primary scale-110" 
                      : "bg-muted-foreground/30 hover:bg-muted-foreground/50"
                  }`}
                  aria-label={`Go to slide ${index + 1}`}
                />
              ))}
            </div>
          </div>

          {/* Desktop: Carousel with peek effect */}
          <div className="hidden md:block mb-6">
            <Carousel 
              setApi={setDesktopCarouselApi} 
              opts={{ align: "center", loop: true }}
              className="w-full"
            >
              <CarouselContent className="-ml-4">
                {/* Slide 1: Leaderboard */}
                <CarouselItem className="pl-4 basis-[70%]">
                  <Card 
                    itemScope
                    itemType="https://schema.org/ItemList"
                    className="h-[600px] border-2 border-primary/30 shadow-lg flex flex-col"
                    data-keywords="smarty gym community, online gym leaderboard, online fitness community, smartygym.com, Haris Falas"
                    aria-label="Community Leaderboard - SmartyGym online fitness community - smartygym.com"
                  >
                    <CardHeader className="bg-gradient-to-r from-primary/10 to-primary/5 p-4 md:p-6">
                      <CardTitle 
                        className="flex items-center gap-2 text-xl md:text-2xl mb-4"
                        itemProp="name"
                      >
                        <Trophy className="h-5 w-5 md:h-6 md:w-6 text-primary" />
                        Leaderboard
                      </CardTitle>
                      {canViewLeaderboard && (
                      <CompactFilters
                        filters={[
                          {
                            name: "Type",
                            value: leaderboardFilter,
                            onChange: (value) => setLeaderboardFilter(value as "workouts" | "programs" | "checkins"),
                            options: [
                              { value: "workouts", label: "Workouts" },
                              { value: "programs", label: "Training Programs" },
                              { value: "checkins", label: "Check-ins" }
                            ],
                            placeholder: "Select type"
                          }
                        ]}
                      />
                      )}
                    </CardHeader>
                    <CardContent className="p-4 md:pt-6 flex-1 overflow-auto">
                      {!canViewLeaderboard ? (
                        <LockedLeaderboardBody />
                      ) : isLoadingLeaderboard ? (
                        <div className="space-y-3">
                          {[...Array(10)].map((_, i) => (
                            <Skeleton key={i} className="h-12 w-full" />
                          ))}
                        </div>
                      ) : (
                        <div className="overflow-x-auto">
                          <Table>
                            <TableHeader>
                              <TableRow className="border-primary/30">
                                <TableHead className="w-12 md:w-16 text-xs md:text-sm">Rank</TableHead>
                                <TableHead className="text-xs md:text-sm">Member</TableHead>
                                <TableHead className="text-right text-xs md:text-sm">{leaderboardFilter === "checkins" ? "Consistency Score" : "Completions"}</TableHead>
                              </TableRow>
                            </TableHeader>
                            <TableBody>
                              {getLeaderboardWithPlaceholders().map((entry, index) => (
                                <TableRow
                                  key={entry?.user_id || `empty-${index}`}
                                  className="border-primary/20 hover:bg-primary/5"
                                >
                                  <TableCell className="font-medium text-xs md:text-sm py-2 md:py-3">
                                    <div className="flex items-center gap-1 md:gap-2">
                                      <span className="text-base md:text-lg">{getMedalIcon(index)}</span>
                                    </div>
                                  </TableCell>
                                  <TableCell className="py-2 md:py-3">
                                    {entry ? (
                                      <div className="flex items-center gap-1 md:gap-2">
                                        <User className="h-3 w-3 md:h-4 md:w-4 text-muted-foreground flex-shrink-0" />
                                        <span className="font-medium text-xs md:text-sm truncate">{entry.display_name}</span>
                                      </div>
                                    ) : (
                                      <span className="text-muted-foreground italic text-xs md:text-sm">Awaiting competitor...</span>
                                    )}
                                  </TableCell>
                                  <TableCell className="text-right py-2 md:py-3">
                                    {entry ? (
                                      <span className="inline-flex items-center gap-1 px-2 md:px-3 py-0.5 md:py-1 rounded-full bg-primary/10 text-primary font-semibold text-xs md:text-sm whitespace-nowrap">
                                        {entry.total_completions}
                                      </span>
                                    ) : (
                                      <span className="text-muted-foreground">---</span>
                                    )}
                                  </TableCell>
                                </TableRow>
                              ))}
                            </TableBody>
                          </Table>
                        </div>
                      )}
                    </CardContent>
                  </Card>
                </CarouselItem>

                {/* Slide 2: Ratings */}
                <CarouselItem className="pl-4 basis-[70%]">
                  <Card className="h-[600px] border-2 border-primary/30 shadow-lg flex flex-col">
                    <CardHeader className="bg-gradient-to-r from-primary/10 to-primary/5 p-4 md:p-6">
                      <CardTitle className="flex items-center gap-2 text-xl md:text-2xl mb-4">
                        <Star className="h-5 w-5 md:h-6 md:w-6 text-primary" />
                        Ratings
                      </CardTitle>
                      <CompactFilters
                        filters={[
                          {
                            name: "Type",
                            value: ratingsFilter,
                            onChange: (value) => setRatingsFilter(value as "workouts" | "programs"),
                            options: [
                              { value: "workouts", label: "Workouts" },
                              { value: "programs", label: "Training Programs" }
                            ],
                            placeholder: "Select type"
                          }
                        ]}
                      />
                    </CardHeader>
                    <CardContent className="p-4 md:pt-6 flex-1 overflow-auto">
                      {isLoadingRatings ? (
                        <div className="space-y-3">
                          {[...Array(10)].map((_, i) => (
                            <Skeleton key={i} className="h-12 w-full" />
                          ))}
                        </div>
                      ) : (
                        <div className="overflow-x-auto">
                          <Table>
                            <TableHeader>
                              <TableRow className="border-primary/30">
                                <TableHead className="w-12 md:w-16 text-xs md:text-sm">Rank</TableHead>
                                <TableHead className="text-xs md:text-sm">Name</TableHead>
                                <TableHead className="text-center text-xs md:text-sm">Rating</TableHead>
                                <TableHead className="text-right text-xs md:text-sm">Reviews</TableHead>
                              </TableRow>
                            </TableHeader>
                            <TableBody>
                              {getRatingsWithPlaceholders().map((item, index) => (
                                <TableRow
                                  key={item?.content_id || `empty-${index}`}
                                  className="border-primary/20 hover:bg-primary/5"
                                >
                                  <TableCell className="font-medium text-xs md:text-sm py-2 md:py-3">
                                    <div className="flex items-center gap-1 md:gap-2">
                                      <span className="text-base md:text-lg">{getMedalIcon(index)}</span>
                                    </div>
                                  </TableCell>
                                  <TableCell className="py-2 md:py-3">
                                    {item ? (
                                      <Link 
                                        to={item.content_type === "workout" 
                                          ? `/workout/${item.workout_type}/${item.content_id}`
                                          : `/trainingprogram/${item.program_type}/${item.content_id}`
                                        }
                                        className="font-medium text-xs md:text-sm truncate text-primary hover:underline"
                                      >
                                        {item.content_name}
                                      </Link>
                                    ) : (
                                      <span className="text-muted-foreground italic text-xs md:text-sm">Awaiting rating...</span>
                                    )}
                                  </TableCell>
                                  <TableCell className="text-center py-2 md:py-3">
                                    {item ? (
                                      <div className="flex items-center justify-center gap-1">
                                        <Star className="h-3 w-3 md:h-4 md:w-4 fill-primary text-primary" />
                                        <span className="font-semibold text-xs md:text-sm">{item.average_rating.toFixed(1)}</span>
                                      </div>
                                    ) : (
                                      <span className="text-muted-foreground">---</span>
                                    )}
                                  </TableCell>
                                  <TableCell className="text-right py-2 md:py-3">
                                    {item ? (
                                      <span className="inline-flex items-center gap-1 px-2 md:px-3 py-0.5 md:py-1 rounded-full bg-primary/10 text-primary font-semibold text-xs md:text-sm whitespace-nowrap">
                                        {item.rating_count}
                                      </span>
                                    ) : (
                                      <span className="text-muted-foreground">---</span>
                                    )}
                                  </TableCell>
                                </TableRow>
                              ))}
                            </TableBody>
                          </Table>
                        </div>
                      )}
                    </CardContent>
                  </Card>
                </CarouselItem>

                {/* Slide 3: Comments */}
                <CarouselItem className="pl-4 basis-[70%]">
                  <Card className="h-[600px] border-2 border-primary/30 shadow-lg flex flex-col">
                    <CardHeader className="bg-gradient-to-r from-primary/10 to-primary/5 p-4 md:p-6">
                      <CardTitle className="flex items-center gap-2 text-xl md:text-2xl mb-4">
                        <MessageSquare className="h-5 w-5 md:h-6 md:w-6 text-primary" />
                        Comments
                      </CardTitle>
                      <CompactFilters
                        filters={[
                          {
                            name: "Type",
                            value: commentsFilter,
                            onChange: (value) => setCommentsFilter(value as "all" | "workouts" | "programs"),
                            options: [
                              { value: "all", label: "All Comments" },
                              { value: "workouts", label: "Workouts" },
                              { value: "programs", label: "Training Programs" }
                            ],
                            placeholder: "Select type"
                          },
                          {
                            name: "Sort",
                            value: sortOrder,
                            onChange: (value) => setSortOrder(value as "newest" | "oldest"),
                            options: [
                              { value: "newest", label: "Newest First" },
                              { value: "oldest", label: "Oldest First" }
                            ],
                            placeholder: "Sort by"
                          }
                        ]}
                      />
                    </CardHeader>
                    <CardContent className="p-4 md:pt-6 flex-1 overflow-auto">
                      {isLoadingComments ? (
                        <div className="space-y-4">
                          {[...Array(6)].map((_, i) => (
                            <div key={i} className="space-y-2">
                              <Skeleton className="h-6 w-3/4" />
                              <Skeleton className="h-16 w-full" />
                            </div>
                          ))}
                        </div>
                      ) : comments.length === 0 ? (
                        <div className="text-center py-12 text-muted-foreground">
                          <MessageSquare className="h-12 w-12 mx-auto mb-4 opacity-30" />
                          <p className="text-lg font-medium mb-2">
                            No comments yet
                          </p>
                          <p className="text-sm">
                            Be the first premium member to share your experience!
                          </p>
                        </div>
                      ) : (
                        <>
                          <div className="space-y-3 md:space-y-4">
                            {getTopComments().map((comment) => (
                              <div
                                key={comment.id}
                                className="p-3 md:p-4 rounded-lg border-2 border-primary/20 bg-gradient-to-r from-background to-primary/5 hover:border-primary/40 transition-colors"
                              >
                                <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-2 mb-2">
                                  <div className="flex items-center gap-2">
                                    <User className="h-3 w-3 md:h-4 md:w-4 text-primary flex-shrink-0" />
                                    <span className="font-semibold text-xs md:text-sm truncate">
                                      {comment.display_name}
                                    </span>
                                  </div>
                                  <div className="flex items-center gap-1 text-xs text-muted-foreground whitespace-nowrap">
                                    <Calendar className="h-3 w-3" />
                                    <span className="text-[10px] md:text-xs">
                                      {formatDistanceToNow(new Date(comment.created_at), {
                                        addSuffix: true,
                                      })}
                                    </span>
                                  </div>
                                </div>
                                <p className="text-[10px] md:text-xs text-primary font-medium mb-2">
                                  {comment.workout_name ? (
                                    <>
                                      Workout:{" "}
                                      <Link
                                        to={`/workout/${comment.workout_type}/${comment.workout_id}`}
                                        className="hover:underline font-semibold"
                                      >
                                        {comment.workout_name}
                                      </Link>
                                    </>
                                  ) : (
                                    <>
                                      Program:{" "}
                                      <Link
                                        to={`/trainingprogram/${comment.program_type}/${comment.program_id}`}
                                        className="hover:underline font-semibold"
                                      >
                                        {comment.program_name}
                                      </Link>
                                    </>
                                  )}
                                </p>
                                <p className="text-xs md:text-sm leading-relaxed">{comment.comment_text}</p>
                              </div>
                            ))}
                          </div>
                          {comments.length > 6 && (
                            <div className="mt-4 text-center">
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => setShowCommentsModal(true)}
                                className="gap-2"
                              >
                                <Eye className="h-4 w-4" />
                                View All ({comments.length})
                              </Button>
                            </div>
                          )}
                        </>
                      )}
                    </CardContent>
                  </Card>
                </CarouselItem>

                {/* Slide 4: Testimonials */}
                <CarouselItem className="pl-4 basis-[70%]">
                  <Card className="h-[600px] border-2 border-primary/30 shadow-lg flex flex-col">
                    <CardHeader className="bg-gradient-to-r from-primary/10 to-primary/5 p-4 md:p-6">
                      <CardTitle className="flex items-center gap-2 text-xl md:text-2xl mb-4">
                        <Quote className="h-5 w-5 md:h-6 md:w-6 text-primary" />
                        Testimonials
                      </CardTitle>
                      <CompactFilters
                        filters={[
                          {
                            name: "Sort",
                            value: testimonialsSortOrder,
                            onChange: (value) => setTestimonialsSortOrder(value as "newest" | "oldest"),
                            options: [
                              { value: "newest", label: "Newest First" },
                              { value: "oldest", label: "Oldest First" }
                            ],
                            placeholder: "Sort by"
                          }
                        ]}
                      />
                    </CardHeader>
                    <CardContent className="p-4 md:pt-6 flex-1 overflow-auto">
                      <TestimonialsSection 
                        desktopCarouselMode 
                        externalSortOrder={testimonialsSortOrder}
                        onSortOrderChange={setTestimonialsSortOrder}
                      />
                    </CardContent>
                  </Card>
                </CarouselItem>
              </CarouselContent>
              
              <CarouselPrevious className="-left-24 lg:-left-28 xl:-left-32 h-14 w-14 z-20" />
              <CarouselNext className="-right-24 lg:-right-28 xl:-right-32 h-14 w-14 z-20" />
            </Carousel>

            {/* Dot navigation */}
            <div className="flex justify-center gap-2 mt-2">
              {[0, 1, 2, 3].map((index) => (
                <button
                  key={index}
                  onClick={() => desktopCarouselApi?.scrollTo(index)}
                  className={`h-2.5 w-2.5 rounded-full transition-all ${
                    desktopSelectedSlide === index 
                      ? "bg-primary scale-110" 
                      : "bg-muted-foreground/30 hover:bg-muted-foreground/50"
                  }`}
                  aria-label={`Go to slide ${index + 1}`}
                />
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Comments Modal */}
      <Dialog open={showCommentsModal} onOpenChange={setShowCommentsModal}>
        <DialogContent className="max-w-2xl max-h-[80vh]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <MessageSquare className="h-5 w-5 text-primary" />
              All Community Comments
            </DialogTitle>
          </DialogHeader>
          <ScrollArea className="h-[60vh] pr-4">
            <div className="space-y-3 md:space-y-4">
              {comments.map((comment) => (
                <div
                  key={comment.id}
                  className="p-3 md:p-4 rounded-lg border-2 border-primary/20 bg-gradient-to-r from-background to-primary/5"
                >
                  <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-2 mb-2">
                    <div className="flex items-center gap-2">
                      <User className="h-3 w-3 md:h-4 md:w-4 text-primary flex-shrink-0" />
                      <span className="font-semibold text-xs md:text-sm truncate">
                        {comment.display_name}
                      </span>
                    </div>
                    <div className="flex items-center gap-1 text-xs text-muted-foreground whitespace-nowrap">
                      <Calendar className="h-3 w-3" />
                      <span className="text-[10px] md:text-xs">
                        {formatDistanceToNow(new Date(comment.created_at), {
                          addSuffix: true,
                        })}
                      </span>
                    </div>
                  </div>
                  <p className="text-[10px] md:text-xs text-primary font-medium mb-2">
                    {comment.workout_name ? (
                      <>
                        Workout:{" "}
                        <Link
                          to={`/workout/${comment.workout_type}/${comment.workout_id}`}
                          className="hover:underline font-semibold"
                          onClick={() => setShowCommentsModal(false)}
                        >
                          {comment.workout_name}
                        </Link>
                      </>
                    ) : (
                      <>
                        Program:{" "}
                        <Link
                          to={`/trainingprogram/${comment.program_type}/${comment.program_id}`}
                          className="hover:underline font-semibold"
                          onClick={() => setShowCommentsModal(false)}
                        >
                          {comment.program_name}
                        </Link>
                      </>
                    )}
                  </p>
                  <p className="text-xs md:text-sm leading-relaxed">{comment.comment_text}</p>
                </div>
              ))}
            </div>
          </ScrollArea>
        </DialogContent>
      </Dialog>
    </>
  );
};

export default Community;
