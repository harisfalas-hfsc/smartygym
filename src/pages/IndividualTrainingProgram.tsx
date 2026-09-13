import { useEffect } from "react";
import { useLocation, useNavigate, useParams } from "react-router-dom";
import { Helmet } from "react-helmet";
import { WorkoutDisplay } from "@/components/WorkoutDisplay";
import { AccessGate } from "@/components/AccessGate";
import { useTrainingProgramData, type TrainingProgramData } from "@/hooks/useTrainingProgramData";
import { useAccessControl } from "@/hooks/useAccessControl";
import { ContentNotFound } from "@/components/ContentNotFound";
import { PageBreadcrumbs } from "@/components/PageBreadcrumbs";
import { getProgramCategorySlug, slugifyContentName } from "@/lib/seo-slugs";

// Helper function to generate SEO-optimized alt text
const generateProgramAltText = (program: TrainingProgramData): string => {
  const parts = [
    program.name,
    program.weeks ? `${program.weeks} week` : '',
    program.difficulty ? `${program.difficulty} level` : '',
    program.category || '',
    'training program by Sports Scientist Haris Falas',
    'SmartyGym'
  ].filter(Boolean);
  return parts.join(' - ');
};

const IndividualTrainingProgram = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { type, id } = useParams();
  const lookupId = id || type;
  const { userTier, hasPurchased } = useAccessControl();
  
  // Helper function to format focus label
  const getFocusLabel = (type: string | undefined): string => {
    const focusMap: { [key: string]: string } = {
      'cardio': 'Cardio',
      'functional': 'Functional Training',
      'hypertrophy': 'Hypertrophy',
      'weightloss': 'Weight Loss',
      'weight-loss': 'Weight Loss',
      'backcare': 'Back Care',
      'back-care': 'Back Care',
      'mobility': 'Mobility & Stability',
      'strength': 'Strength',
      'endurance': 'Endurance'
    };
    return focusMap[type || ''] || 'General Training';
  };

  
  // Fetch program from database
  const { data: dbProgram, isLoading: isLoadingDb } = useTrainingProgramData(lookupId);

  useEffect(() => {
    if (!dbProgram || !lookupId) return;
    const programCategorySlug = getProgramCategorySlug(dbProgram.category, type || "functional-strength");
    const canonicalSlug = dbProgram.canonical_slug || slugifyContentName(dbProgram.name || dbProgram.id);
    const canonicalPath = `/trainingprogram/${programCategorySlug}/${canonicalSlug}`;
    if (!id || id !== canonicalSlug || type !== programCategorySlug) {
      navigate(`${canonicalPath}${location.search}`, { replace: true });
    }
  }, [dbProgram, id, location.search, lookupId, navigate, type]);

  // If we have database program, use it directly
  if (isLoadingDb) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <p className="text-muted-foreground">Loading program...</p>
      </div>
    );
  }

  if (dbProgram) {
    const isPremium = dbProgram.is_premium;
    const canPurchase = dbProgram.is_standalone_purchase && dbProgram.price && isPremium;
    const alreadyPurchased = hasPurchased(dbProgram.id, "program");
    const hasAccess = freeAccessMode || userTier === "premium" || alreadyPurchased || !isPremium;
    
    const programCategorySlug = getProgramCategorySlug(dbProgram.category, type || "functional-strength");
    const programUrl = `https://smartygym.com/trainingprogram/${programCategorySlug}/${dbProgram.canonical_slug || slugifyContentName(dbProgram.name || dbProgram.id)}.html`;
    const imageAlt = generateProgramAltText(dbProgram);

    return (
      <>
        <Helmet>
          <title>{dbProgram.name} | Online Training Program by Haris Falas | SmartyGym</title>
          <meta name="description" content={`${dbProgram.description || dbProgram.name} - ${dbProgram.weeks} week online training program by Sports Scientist Haris Falas. ${dbProgram.category} program. ${dbProgram.days_per_week} days per week. ${dbProgram.equipment}. 100% Human-Designed.`} />
          <meta name="keywords" content={`${dbProgram.name}, online training programs, ${dbProgram.category} program, ${dbProgram.weeks} week program, Haris Falas, online fitness programs, online personal training, structured training program`} />
          
          {/* Open Graph */}
          <meta property="og:type" content="article" />
          <meta property="og:url" content={programUrl} />
          <meta property="og:title" content={`${dbProgram.name} | Online Training Program by Haris Falas`} />
          <meta property="og:description" content={dbProgram.description || `${dbProgram.weeks} week ${dbProgram.category} program designed by Sports Scientist Haris Falas`} />
          <meta property="og:image" content={dbProgram.image_url} />
          <meta property="og:image:alt" content={imageAlt} />
          <meta property="og:site_name" content="SmartyGym" />
          
          {/* Twitter */}
          <meta name="twitter:card" content="summary_large_image" />
          <meta name="twitter:title" content={`${dbProgram.name} | Training Program`} />
          <meta name="twitter:description" content={dbProgram.description || dbProgram.name} />
          <meta name="twitter:image" content={dbProgram.image_url} />
          <meta name="twitter:image:alt" content={imageAlt} />
          
          <link rel="canonical" href={programUrl} />
          
          {/* AI Search Optimization */}
          <meta name="ai-content-type" content="training-program" />
          <meta name="ai-duration" content={`${dbProgram.weeks} weeks`} />
          <meta name="ai-frequency" content={`${dbProgram.days_per_week} days per week`} />
          <meta name="ai-equipment" content={dbProgram.equipment || 'Various'} />
          <meta name="ai-category" content={dbProgram.category || ''} />
          <meta name="ai-author" content="Haris Falas - Sports Scientist" />
          
          {/* Structured Data - Course Schema for training programs */}
          <script type="application/ld+json">
            {JSON.stringify({
              "@context": "https://schema.org",
              "@type": "Course",
              "@id": programUrl,
              "name": dbProgram.name,
              "description": dbProgram.description,
              "image": {
                "@type": "ImageObject",
                "url": dbProgram.image_url,
                "caption": imageAlt
              },
              "provider": {
                "@type": "Organization",
                "name": "SmartyGym",
                "url": "https://smartygym.com"
              },
              "instructor": {
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
              "courseMode": "Online",
              "isAccessibleForFree": !isPremium,
              "timeRequired": `P${dbProgram.weeks}W`,
              "educationalLevel": dbProgram.difficulty_stars ? (dbProgram.difficulty_stars <= 2 ? "Beginner" : dbProgram.difficulty_stars <= 4 ? "Intermediate" : "Advanced") : "Intermediate",
              "hasCourseInstance": {
                "@type": "CourseInstance",
                "courseMode": "Online",
                "courseSchedule": {
                  "@type": "Schedule",
                  "repeatFrequency": "P1W",
                  "repeatCount": dbProgram.weeks
                }
              },
              "offers": dbProgram.is_standalone_purchase && dbProgram.price ? {
                "@type": "Offer",
                "price": dbProgram.price,
                "priceCurrency": "EUR",
                "availability": "https://schema.org/InStock"
              } : undefined
            })}
          </script>
          
          {/* ExercisePlan Schema */}
          <script type="application/ld+json">
            {JSON.stringify({
              "@context": "https://schema.org",
              "@type": "ExercisePlan",
              "name": dbProgram.name,
              "description": dbProgram.description,
              "image": dbProgram.image_url,
              "duration": `P${dbProgram.weeks}W`,
              "category": dbProgram.category,
              "exerciseType": dbProgram.category,
              "intensity": dbProgram.difficulty_stars ? `${dbProgram.difficulty_stars}/6 stars` : "Intermediate",
              "repetitions": `${dbProgram.days_per_week} days per week for ${dbProgram.weeks} weeks`,
              "workLocation": "Online / Home / Gym",
              "author": {
                "@type": "Person",
                "name": "Haris Falas",
                "jobTitle": "Sports Scientist & Strength and Conditioning Coach"
              },
              "identifier": dbProgram.id
            })}
          </script>
          
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
                  "name": "Smarty Programs",
                  "item": "https://smartygym.com/trainingprogram"
                },
                {
                  "@type": "ListItem",
                  "position": 3,
                  "name": dbProgram.name,
                  "item": programUrl
                }
              ]
            })}
          </script>
        </Helmet>
        <div className="min-h-screen bg-background">
          <div className="container mx-auto px-4 pb-8">
            <PageBreadcrumbs items={[
              { label: "Home", href: "/" },
              { label: "Smarty Programs", href: "/trainingprogram" },
              { label: dbProgram.name }
            ]} />


            <AccessGate 
              requireAuth={true} 
              requirePremium={!freeAccessMode && isPremium && !hasAccess} 
              contentType="program"
              contentId={dbProgram.id}
              contentName={dbProgram.name}
              price={canPurchase ? Number(dbProgram.price) : undefined}
              stripePriceId={dbProgram.stripe_price_id || undefined}
              stripeProductId={dbProgram.stripe_product_id || undefined}
            >
              <WorkoutDisplay
                offlineLocked={(dbProgram as any)?.offline_locked === true}
                exercises={[]}
                planContent=""
                title={dbProgram.name}
                serial={dbProgram.id}
                focus={dbProgram.category || getFocusLabel(type)}
                difficulty={dbProgram.difficulty_stars || 3}
                imageUrl={dbProgram.image_url}
                duration={`${dbProgram.weeks} weeks / ${dbProgram.days_per_week} days per week`}
                equipment={dbProgram.equipment}
                description={dbProgram.description}
                overview={dbProgram.overview}
                target_audience={dbProgram.target_audience}
                program_structure={dbProgram.program_structure}
                weekly_schedule={dbProgram.weekly_schedule}
                progression_plan={dbProgram.progression_plan}
                nutrition_tips={dbProgram.nutrition_tips}
                expected_results={dbProgram.expected_results}
                programId={dbProgram.id}
                programType={programCategorySlug}
                isFreeContent={!isPremium}
              />
            </AccessGate>
          </div>
        </div>
      </>
    );
  }

  // No program found in database
  return (
    <ContentNotFound contentType="program" contentId={lookupId || 'unknown'} />
  );
};

export default IndividualTrainingProgram;
