import { useEffect } from "react";
import { useLocation, useNavigate, useParams } from "react-router-dom";
import { Helmet } from "react-helmet";
import { WorkoutDisplay } from "@/components/WorkoutDisplay";
import { AccessGate } from "@/components/AccessGate";
import { useWorkoutData, type WorkoutData } from "@/hooks/useWorkoutData";
import { ContentNotFound } from "@/components/ContentNotFound";
import { PageBreadcrumbs } from "@/components/PageBreadcrumbs";
import { getWorkoutCategorySlug, slugifyContentName } from "@/lib/seo-slugs";

// Helper function to generate SEO-optimized alt text
const generateWorkoutAltText = (workout: WorkoutData): string => {
  const parts = [
    workout.name,
    workout.difficulty ? `${workout.difficulty} level` : '',
    workout.format ? `${workout.format} format` : '',
    workout.duration ? `${workout.duration}` : '',
    workout.category || '',
    'workout by Sports Scientist Haris Falas',
    'SmartyGym'
  ].filter(Boolean);
  return parts.join(' - ');
};

const IndividualWorkout = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { type, id } = useParams();
  const lookupId = id || type;
  
  // Use centralized category labels
  const getCategoryLabel = (category: string | undefined | null): string => {
    if (!category) return '';
    const categoryMap: { [key: string]: string } = {
      'STRENGTH': 'Strength',
      'CALORIE BURNING': 'Calorie Burning',
      'METABOLIC': 'Metabolic',
      'CARDIO': 'Cardio',
      'CARDIO ENDURANCE': 'Cardio Endurance',
      'MOBILITY & STABILITY': 'Mobility & Stability',
      'CHALLENGE': 'Challenge',
      'PILATES': 'Pilates',
      'RECOVERY': 'Recovery',
      'MICRO-WORKOUTS': 'Micro-Workouts',
      // Lowercase versions for focus field
      'strength': 'Strength',
      'calorie-burning': 'Calorie Burning',
      'metabolic': 'Metabolic',
      'cardio': 'Cardio',
      'cardio-endurance': 'Cardio Endurance',
      'mobility-stability': 'Mobility & Stability',
      'challenge': 'Challenge',
      'pilates': 'Pilates',
      'recovery': 'Recovery',
      'micro-workouts': 'Micro-Workouts'
    };
    return categoryMap[category] || category;
  };


  // Fetch from database
  const { data: dbWorkout, isLoading: isLoadingDb } = useWorkoutData(lookupId);

  useEffect(() => {
    if (!dbWorkout || !lookupId) return;
    const workoutCategorySlug = getWorkoutCategorySlug(dbWorkout.category, type || "strength");
    const canonicalSlug = dbWorkout.canonical_slug || slugifyContentName(dbWorkout.name || dbWorkout.id);
    const canonicalPath = `/workout/${workoutCategorySlug}/${canonicalSlug}`;
    if (!id || id !== canonicalSlug || type !== workoutCategorySlug) {
      navigate(`${canonicalPath}${location.search}`, { replace: true });
    }
  }, [dbWorkout, id, location.search, lookupId, navigate, type]);

  // If we have database workout, use it directly
  if (isLoadingDb) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <p className="text-muted-foreground">Loading workout...</p>
      </div>
    );
  }

  if (dbWorkout) {
    const workoutCategorySlug = getWorkoutCategorySlug(dbWorkout.category, type || "strength");
    const workoutUrl = `https://smartygym.com/workout/${workoutCategorySlug}/${dbWorkout.canonical_slug || slugifyContentName(dbWorkout.name || dbWorkout.id)}.html`;
    const imageAlt = generateWorkoutAltText(dbWorkout);
    
    // Generate HowTo steps from workout sections
    const howToSteps = [];
    if (dbWorkout.warm_up) howToSteps.push({ name: "Warm Up", text: "Complete the warm-up exercises to prepare your body" });
    if (dbWorkout.activation) howToSteps.push({ name: "Activation", text: "Perform activation exercises to engage target muscles" });
    if (dbWorkout.main_workout) howToSteps.push({ name: "Main Workout", text: "Execute the main workout following the prescribed format" });
    if (dbWorkout.finisher) howToSteps.push({ name: "Finisher", text: "Complete the finisher for extra conditioning" });
    if (dbWorkout.cool_down) howToSteps.push({ name: "Cool Down", text: "Finish with cool-down stretches for recovery" });

    return (
      <>
        <Helmet>
          <title>{dbWorkout.name} | Online Workout by Haris Falas | SmartyGym</title>
          <meta name="description" content={(() => {
            const base = `${dbWorkout.duration || ''} ${dbWorkout.format || ''} workout by Haris Falas. ${dbWorkout.description || dbWorkout.name}`.trim().replace(/\s+/g, ' ');
            return base.length > 158 ? base.slice(0, 155).trimEnd() + '…' : base;
          })()} />
          <meta name="keywords" content={`${dbWorkout.name}, online workouts, ${dbWorkout.format} workout, ${dbWorkout.category} training, Haris Falas, online fitness, ${dbWorkout.equipment} workout, ${dbWorkout.difficulty} workout, SmartyGym workout, circuit workout, HIIT workout, AMRAP workout, EMOM workout, strength workout, cardio workout, office workout, outdoor workout, bodyweight workout${dbWorkout.category?.includes('MICRO') ? ', micro workouts, mini workouts, small workouts, 5 minute workout, quick workout, exercise snacks, desk workout' : ''}`} />
          
          {/* Open Graph */}
          <meta property="og:type" content="article" />
          <meta property="og:url" content={workoutUrl} />
          <meta property="og:title" content={`${dbWorkout.name} | Online Workout by Haris Falas`} />
          <meta property="og:description" content={dbWorkout.description || `Professional ${dbWorkout.format} workout designed by Sports Scientist`} />
          <meta property="og:image" content={dbWorkout.image_url} />
          <meta property="og:image:alt" content={imageAlt} />
          <meta property="og:site_name" content="SmartyGym" />
          
          {/* Twitter */}
          <meta name="twitter:card" content="summary_large_image" />
          <meta name="twitter:title" content={`${dbWorkout.name} | Online Workout`} />
          <meta name="twitter:description" content={dbWorkout.description || dbWorkout.name} />
          <meta name="twitter:image" content={dbWorkout.image_url} />
          <meta name="twitter:image:alt" content={imageAlt} />
          
          <link rel="canonical" href={workoutUrl} />
          
          {/* AI Search Optimization */}
          <meta name="ai-content-type" content={dbWorkout.category?.includes('MICRO') ? 'micro-workout' : 'workout'} />
          <meta name="ai-difficulty" content={dbWorkout.difficulty || 'Intermediate'} />
          <meta name="ai-duration" content={dbWorkout.duration || ''} />
          <meta name="ai-equipment" content={dbWorkout.equipment || 'Various'} />
          <meta name="ai-category" content={dbWorkout.category || ''} />
          <meta name="ai-author" content="Haris Falas - Sports Scientist" />
          <meta name="ai-workout-format" content={dbWorkout.format || ''} />
          {dbWorkout.category?.includes('MICRO') && (
            <>
              <meta name="ai-workout-type" content="micro-workout - 5 minute exercise snack" />
              <meta name="ai-time-commitment" content="5 minutes" />
              <meta name="ai-workout-location" content="office, home, anywhere" />
              <meta name="ai-micro-workout-keywords" content="micro workouts, mini workouts, small workouts, 5 minute workout, quick workout, exercise snacks, desk workout, office exercise" />
            </>
          )}
          
          {/* Structured Data - ExercisePlan with enhanced details */}
          <script type="application/ld+json">
            {JSON.stringify({
              "@context": "https://schema.org",
              "@type": "ExercisePlan",
              "@id": workoutUrl,
              "name": dbWorkout.name,
              "description": dbWorkout.description,
              "image": {
                "@type": "ImageObject",
                "url": dbWorkout.image_url,
                "caption": imageAlt
              },
              "duration": dbWorkout.duration,
              "category": dbWorkout.category,
              "activityDuration": dbWorkout.duration,
              "exerciseType": dbWorkout.format,
              "intensity": dbWorkout.difficulty_stars ? `${dbWorkout.difficulty_stars}/6 stars` : dbWorkout.difficulty,
              "workLocation": "Online / Home / Gym",
              "isAccessibleForFree": !dbWorkout.is_premium,
              "author": {
                "@type": "Person",
                "@id": "https://smartygym.com/coach-profile#person",
                "name": "Haris Falas",
                "jobTitle": "Sports Scientist & Strength and Conditioning Coach",
                "description": "BSc Sports Science, CSCS certified with 20+ years experience",
                "url": "https://smartygym.com/coach-profile",
                "hasCredential": [
                  {"@type": "EducationalOccupationalCredential", "name": "BSc Sports Science"},
                  {"@type": "EducationalOccupationalCredential", "name": "CSCS"},
                  {"@type": "EducationalOccupationalCredential", "name": "EXOS Performance Specialist"}
                ]
              },
              "provider": {
                "@type": "Organization",
                "name": "SmartyGym",
                "url": "https://smartygym.com"
              },
              "identifier": dbWorkout.id
            })}
          </script>
          
          {/* HowTo Schema for workout instructions */}
          {howToSteps.length > 0 && (
            <script type="application/ld+json">
              {JSON.stringify({
                "@context": "https://schema.org",
                "@type": "HowTo",
                "name": `How to complete: ${dbWorkout.name}`,
                "description": `Step-by-step guide to complete the ${dbWorkout.name} workout by Haris Falas`,
                "totalTime": dbWorkout.duration,
                "image": dbWorkout.image_url,
                "step": howToSteps.map((step, index) => ({
                  "@type": "HowToStep",
                  "position": index + 1,
                  "name": step.name,
                  "text": step.text
                })),
                "author": {
                  "@type": "Person",
                  "name": "Haris Falas"
                }
              })}
            </script>
          )}
          
          {/* Breadcrumb Schema */}
          <script type="application/ld+json">
            {JSON.stringify({
              "@context": "https://schema.org",
              "@type": "BreadcrumbList",
              "itemListElement": [
                {
                  "@type": "ListItem",
                  "position": 1,
                  "name": "Home",
                  "item": "https://smartygym.com"
                },
                {
                  "@type": "ListItem",
                  "position": 2,
                  "name": "Smarty Workouts",
                  "item": "https://smartygym.com/workout"
                },
                {
                  "@type": "ListItem",
                  "position": 3,
                  "name": dbWorkout.name,
                  "item": workoutUrl
                }
              ]
            })}
          </script>
        </Helmet>
        <div className="min-h-screen bg-background">
          <div className="container mx-auto px-4 pb-8">
            <PageBreadcrumbs items={[
              { label: "Home", href: "/" },
              { label: "Smarty Workouts", href: "/workout" },
              { label: dbWorkout.name }
            ]} />


            <AccessGate 
              requireAuth={true} 
              requirePremium={dbWorkout?.is_premium || false}
              contentType="workout"
              contentId={dbWorkout.id}
              contentName={dbWorkout.name}
              price={dbWorkout.price || undefined}
              stripePriceId={dbWorkout.stripe_price_id || undefined}
              stripeProductId={dbWorkout.stripe_product_id || undefined}
            >
              <WorkoutDisplay
                exercises={[]}
                planContent=""
                title={dbWorkout.name}
                serial={dbWorkout.id}
                focus={getCategoryLabel(dbWorkout.category)}
                difficulty={dbWorkout.difficulty_stars ?? 0}
                workoutType={dbWorkout.format}
                imageUrl={dbWorkout.image_url}
                duration={dbWorkout.duration}
                equipment={dbWorkout.equipment}
                description={dbWorkout.description}
                format={dbWorkout.format}
                instructions={dbWorkout.instructions}
                tips={dbWorkout.tips}
                activation={dbWorkout.activation}
                warm_up={dbWorkout.warm_up}
                main_workout={dbWorkout.main_workout}
                finisher={dbWorkout.finisher}
                cool_down={dbWorkout.cool_down}
                workoutId={dbWorkout.id}
                workoutCategory={workoutCategorySlug}
                isFreeContent={!dbWorkout.is_premium}
              />
            </AccessGate>
          </div>
        </div>
      </>
    );
  }

  // No workout found in database
  return (
    <ContentNotFound contentType="workout" contentId={lookupId || 'unknown'} />
  );
};

export default IndividualWorkout;
