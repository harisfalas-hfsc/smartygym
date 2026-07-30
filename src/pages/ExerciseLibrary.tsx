import { useNavigate } from "react-router-dom";
import { Helmet } from "react-helmet";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { PageBreadcrumbs } from "@/components/PageBreadcrumbs";
import { DesktopPageIntro } from "@/components/DesktopPageIntro";
import { Youtube, Video, Dumbbell } from "lucide-react";

import { SEOEnhancer } from "@/components/SEOEnhancer";
import ExerciseVideoGrid from "@/components/ExerciseVideoGrid";
import ExerciseDatabase from "@/components/ExerciseDatabase";

const ExerciseLibrary = () => {
  const navigate = useNavigate();
  

  return (
    <>
      <Helmet>
        <title>Exercise Library | Video Demonstrations | The Smarty Gym YouTube</title>
        <meta name="description" content="Watch expert exercise demonstrations and training tutorials on The Smarty Gym YouTube channel. Learn proper form, technique, and get workout inspiration from Sports Scientist Haris Falas." />
        <meta name="keywords" content="exercise library, workout videos, exercise demonstrations, training tutorials, YouTube workouts, fitness videos, proper form, exercise technique, SmartyGym, Haris Falas, fitness education, training videos" />
        <link rel="canonical" href="https://smartygym.com/exerciselibrary" />
        
        <meta property="og:title" content="Exercise Library | The Smarty Gym YouTube" />
        <meta property="og:description" content="Expert exercise demonstrations and training tutorials by Sports Scientist Haris Falas" />
        <meta property="og:type" content="website" />
        <meta property="og:url" content="https://smartygym.com/exerciselibrary" />
        <meta property="og:image" content="https://smartygym.com/smarty-gym-logo.png" />
        
        <meta name="twitter:card" content="summary_large_image" />
        <meta name="twitter:title" content="Exercise Library | The Smarty Gym" />
        <meta name="twitter:description" content="Expert exercise demonstrations and training tutorials" />
        <meta name="twitter:image" content="https://smartygym.com/smarty-gym-logo.png" />
        
        <script type="application/ld+json">
          {JSON.stringify({
            "@context": "https://schema.org",
            "@type": "VideoGallery",
            "name": "The Smarty Gym Exercise Library",
            "description": "Comprehensive video library of exercise demonstrations, training tips, and workout tutorials",
            "publisher": {
              "@type": "Organization",
              "name": "SmartyGym",
              "founder": {
                "@type": "Person",
                "name": "Haris Falas",
                "jobTitle": "Sports Scientist"
              }
            }
          })}
        </script>
      </Helmet>
      
      <SEOEnhancer 
        entities={["SmartyGym", "The Smarty Gym YouTube", "Haris Falas", "Exercise Library"]}
        topics={["exercise demonstrations", "workout videos", "training tutorials", "proper form", "fitness education"]}
        expertise={["Sports Science", "Exercise Technique", "Coaching"]}
        contentType="video-library"
        aiSummary="The Smarty Gym YouTube channel offers a comprehensive exercise library featuring expert demonstrations, training tips, and workout tutorials by Sports Scientist Haris Falas. Learn proper form and technique for all major exercises."
        aiKeywords={["exercise library", "workout videos", "exercise demos", "training tutorials", "YouTube fitness", "proper form", "exercise technique", "fitness education"]}
        relatedContent={["Workout Library", "Training Programs", "Free Content", "Blog"]}
        targetAudience="fitness beginners, athletes, personal trainers, exercise learners"
        pageType="VideoGallery"
      />
      
      <div className="min-h-screen bg-background">
        
        <div className="container mx-auto max-w-6xl md:max-w-[1500px] px-4 md:px-6 pb-8">
          
          <PageBreadcrumbs 
            items={[
              { label: "Home", href: "/" },
              { label: "Exercise Library" }
            ]} 
          />

          {/* About Exercise Library */}
          <Card className="mb-8 bg-white dark:bg-card border-2 border-primary/40 shadow-primary">
            <CardContent className="p-4 sm:p-5">
              <h2 className="text-xl sm:text-2xl font-extrabold tracking-tight uppercase mb-3 text-center">Exercise Library</h2>
              <div className="space-y-2 text-muted-foreground max-w-3xl mx-auto">
                {/* Mobile: Short description only */}
                <p className="md:hidden text-sm text-center">
                  Your resource for learning exercises through video demos and detailed instructions.
                </p>
                {/* Desktop: Full description */}
                <p className="hidden md:block text-base text-center">
                  Your comprehensive resource for learning exercises through video demonstrations and detailed instructions. 
                  Browse the Exercise Database with hundreds of movements, watch curated videos in the <span className="text-primary font-semibold">SmartyGym</span> Video Gallery, 
                  and explore The <span className="text-primary font-semibold">SmartyGym</span> YouTube channel for expert tutorials by Sports Scientist <a href="/coach-profile" className="text-primary hover:underline font-semibold whitespace-nowrap">Haris Falas</a>. 
                  Master proper form and technique to train safely and effectively.
                </p>
              </div>
            </CardContent>
          </Card>

          {/* Exercise Database Card - Gym Fit API */}
          <Card className="border-2 border-primary/30 shadow-lg mb-6">
            <CardContent className="p-6">
              <div className="flex items-center gap-3 mb-4">
                <Dumbbell className="h-6 w-6 text-primary" />
                <h2 className="text-xl font-semibold text-foreground">Exercise Database</h2>
              </div>
              <p className="text-muted-foreground mb-6">
                Browse hundreds of exercises with detailed instructions and filtering by body part or equipment
              </p>
              <ExerciseDatabase />
            </CardContent>
          </Card>

          {/* SmartyGym Video Gallery Card - Temporarily hidden, keep code for future use */}
          {/* <Card className="hidden md:block border-2 border-primary/30 shadow-lg mb-6">
            <CardContent className="p-6">
              <div className="flex items-center gap-3 mb-4">
                <Video className="h-6 w-6 text-primary" />
                <h2 className="text-xl font-semibold text-foreground">
                  <span className="text-primary">SmartyGym</span> Video Gallery
                </h2>
              </div>
              <ExerciseVideoGrid />
            </CardContent>
          </Card> */}

          {/* YouTube Channel Card - Hidden on mobile */}
          <Card className="hidden md:block border-2 border-primary/30 shadow-lg">
            <CardContent className="p-6">
              <div className="bg-gradient-to-r from-primary/10 to-primary/5 p-6 rounded-lg border border-primary/20 mb-6">
                <div className="flex flex-col sm:flex-row items-center gap-2 sm:gap-3 justify-center mb-3">
                  <Youtube className="h-6 w-6 text-primary flex-shrink-0" />
                  <h2 className="text-xl font-semibold text-foreground text-center">The Smarty Gym YouTube Channel</h2>
                </div>
                <div className="flex justify-center">
                  <Button
                    asChild
                    className="gap-2"
                    size="lg"
                  >
                    <a href="https://www.youtube.com/@TheSmartyGym" target="_blank" rel="noopener noreferrer">
                      <Youtube className="h-5 w-5" />
                      Visit YouTube Channel
                    </a>
                  </Button>
                </div>
              </div>

              <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                <Card className="border border-border">
                  <CardContent className="p-3">
                    <h3 className="font-semibold mb-1 text-foreground text-sm">💪 Exercise Demonstrations & Technique Breakdown</h3>
                    <p className="text-xs text-muted-foreground">
                      Proper form and detailed technique analysis
                    </p>
                  </CardContent>
                </Card>
                
                <Card className="border border-border">
                  <CardContent className="p-3">
                    <h3 className="font-semibold mb-1 text-foreground text-sm">🎯 Training Tips & Educational Talks</h3>
                    <p className="text-xs text-muted-foreground">
                      Expert coaching insights and fitness education
                    </p>
                  </CardContent>
                </Card>
                
                <Card className="border border-border">
                  <CardContent className="p-3">
                    <h3 className="font-semibold mb-1 text-foreground text-sm">🔥 Workout Previews & Program Walkthroughs</h3>
                    <p className="text-xs text-muted-foreground">
                      Preview workouts and see program breakdowns
                    </p>
                  </CardContent>
                </Card>
                
                <Card className="border border-border">
                  <CardContent className="p-3">
                    <h3 className="font-semibold mb-1 text-foreground text-sm">🎓 Master Classes, Webinars & Workshops</h3>
                    <p className="text-xs text-muted-foreground">
                      In-depth educational sessions and live events
                    </p>
                  </CardContent>
                </Card>
                
                <Card className="border border-border">
                  <CardContent className="p-3">
                    <h3 className="font-semibold mb-1 text-foreground text-sm">📋 Training Tips</h3>
                    <p className="text-xs text-muted-foreground">
                      Quick tips and coaching methodology
                    </p>
                  </CardContent>
                </Card>
                
                <Card className="border border-border">
                  <CardContent className="p-3">
                    <h3 className="font-semibold mb-1 text-foreground text-sm">📚 Tutorial Videos</h3>
                    <p className="text-xs text-muted-foreground">
                      Step-by-step guides for complex movements
                    </p>
                  </CardContent>
                </Card>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </>
  );
};

export default ExerciseLibrary;
