import { ArrowRight, ChevronRight } from "lucide-react";
import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useFreeAccessMode } from "@/hooks/useFreeAccessMode";
import { getBlogArticleImage } from "@/utils/blogImages";
import toolTimerImage from "@/assets/tools/timer-card-mobile.jpg";
import tool1RmImage from "@/assets/tools/1rm-card-mobile.jpg";
import toolMacroImage from "@/assets/tools/macro-card-mobile.jpg";
import heroCityRunningAsset from "@/assets/hero-city-running.jpg.asset.json";
import heroBarbellAsset from "@/assets/hero/hero-barbell-lift.avif.asset.json";
import heroRopesAsset from "@/assets/hero/hero-battle-ropes.avif.asset.json";
import heroTimerAsset from "@/assets/hero/hero-timer-tablet.avif.asset.json";

const heroSlides = [
  heroCityRunningAsset.url,
  heroBarbellAsset.url,
  heroRopesAsset.url,
  heroTimerAsset.url,
  "https://cvccrvyimyzrxcwzmxwk.supabase.co/storage/v1/object/public/avatars/workout-covers/workout-1780027701304-rvna4t.png",
  "https://cvccrvyimyzrxcwzmxwk.supabase.co/storage/v1/object/public/avatars/workout-covers/workout-1779073192594-qq9ham.jpg",
];
import heroWorkoutsImage from "@/assets/hero-workouts-bright.jpg";
import heroProgramsImage from "@/assets/hero-programs.jpg";
import heroBlogImage from "@/assets/hero-blog.jpg";
import heroToolsImage from "@/assets/hero-tools.jpg";

/**
 * Desktop-only wellness-style landing:
 * fullscreen looping video hero followed by four alternating brand sections
 * (Workouts, Programs, Blog, Tools). Mirrors the SMARTY WELLNESS layout.
 */
type Props = {
  workouts?: any[];
  programs?: any[];
  articles?: any[];
  workoutCategoryToSlug?: (cat?: string | null) => string;
  programCategoryToSlug?: (cat?: string | null) => string;
};

type FeaturedItem = {
  id: string;
  title: string;
  meta?: string;
  image: string;
  route: string;
};

export const DesktopWellnessHero = ({
  workouts = [],
  programs = [],
  articles = [],
  workoutCategoryToSlug = (c) => (c || "").toLowerCase().replace(/\s+/g, "-"),
  programCategoryToSlug = (c) => (c || "").toLowerCase().replace(/\s+/g, "-"),
}: Props = {}) => {
  const navigate = useNavigate();
  const { freeAccessMode } = useFreeAccessMode();
  const [slide, setSlide] = useState(0);

  useEffect(() => {
    const id = setInterval(() => {
      setSlide((s) => (s + 1) % heroSlides.length);
    }, 2750);
    return () => clearInterval(id);
  }, []);

  const workoutItems: FeaturedItem[] = (workouts || []).slice(0, 3).map((w: any) => ({
    id: w.id,
    title: w.name,
    meta: [w.duration, w.difficulty].filter(Boolean).join(" · ") || w.category,
    image: w.image_url || "/images/workouts/wod-card-mobile.jpg",
    route: `/workout/${workoutCategoryToSlug(w.category)}/${w.id}`,
  }));

  const programItems: FeaturedItem[] = (programs || []).slice(0, 3).map((p: any) => ({
    id: p.id,
    title: p.name,
    meta: [p.weeks ? `${p.weeks} weeks` : null, p.difficulty].filter(Boolean).join(" · ") || p.category,
    image: p.image_url || "/images/programs/functional-strength-card-mobile.jpg",
    route: `/trainingprogram/${programCategoryToSlug(p.category)}/${p.id}`,
  }));

  const articleItems: FeaturedItem[] = (articles || []).slice(0, 3).map((a: any) => ({
    id: a.id,
    title: a.title,
    meta: [a.read_time, a.category].filter(Boolean).join(" · "),
    image: getBlogArticleImage(a.image_url, a.slug),
    route: `/blog/${a.slug}.html`,
  }));

  const toolItems: FeaturedItem[] = [
    { id: "timer", title: "Workout Timer", meta: "HIIT · Tabata · EMOM", image: toolTimerImage, route: "/tools/workout-timer" },
    { id: "1rm", title: "1RM Calculator", meta: "Find your one-rep max", image: tool1RmImage, route: "/tools/1rm-calculator" },
    { id: "macro", title: "Macro Calculator", meta: "Personalized nutrition", image: toolMacroImage, route: "/tools/macro-calculator" },
  ];

  const sections = [
    {
      id: "workouts",
      image: heroWorkoutsImage,
      tag: "Train",
      name: "Smarty Workouts",
      accentWord: "Workouts",
      route: "/workout",
      cta: "Explore All Workouts",
      accent: "#4CAF50",
      description:
        "Expert-designed, single-session workouts for every goal — strength, conditioning, mobility, HIIT, recovery and more. 100% human-designed by Sports Scientist Haris Falas. Filter by equipment, difficulty and duration, and train anywhere with clear coaching cues and video demos for every exercise.",
      featured: workoutItems,
    },
    {
      id: "programs",
      image: heroProgramsImage,
      tag: "Progress",
      name: "Smarty Programs",
      accentWord: "Programs",
      route: "/trainingprogram",
      cta: "Explore All Programs",
      accent: "#29B6D2",
      description:
        "Structured multi-week training programs that take you from where you are to where you want to be. Strength, hypertrophy, fat loss, athletic performance, mobility and beginner-friendly plans — periodized week by week and built for real life, not the gym floor only.",
      featured: programItems,
    },
    {
      id: "blog",
      image: heroBlogImage,
      tag: "Learn",
      name: "Smarty Blog",
      accentWord: "Blog",
      route: "/blog",
      cta: "Explore All Articles",
      accent: "#4CAF50",
      description:
        "Evidence-based articles on training, recovery, nutrition, longevity and mindset — written for people who want the real 'why' behind their programs. No hype, no trends, no shortcuts: just clear, science-based guidance from a working coach.",
      featured: articleItems,
    },
    {
      id: "tools",
      image: heroToolsImage,
      tag: "Measure",
      name: "Smarty Tools",
      accentWord: "Tools",
      route: "/tools",
      cta: "Explore All Tools",
      accent: "#29B6D2",
      description:
        "A growing toolbox to plan, track and understand your training — 1RM calculator, macro & calorie calculators, BMR, workout timer (HIIT · Tabata · EMOM), rounds tracker and more. Fast, mobile-friendly, and free to use for everyone.",
      featured: toolItems,
    },
  ];

  return (
    <div className="hidden md:block">
      {/* HERO — fullscreen image (NYC-style running couple) */}
      <section className="relative w-full h-[90vh] overflow-hidden">
        <div className="absolute inset-0 bg-black" />
        {heroSlides.map((src, i) => (
          <img
            key={src}
            src={src}
            alt=""
            aria-hidden="true"
            loading={i === 0 ? "eager" : "lazy"}
            fetchPriority={i === 0 ? "high" : "auto"}
            decoding="async"
            className={`absolute inset-0 w-full h-full object-cover transition-opacity ease-in-out ${
              slide === i ? "opacity-100" : "opacity-0"
            }`}
            style={{
              transitionDuration: "2600ms",
              animation: "heroKenBurns 20s ease-in-out infinite alternate",
              transformOrigin: i % 2 === 0 ? "center center" : "center 40%",
            }}
          />
        ))}
        <div className="absolute inset-0 pointer-events-none bg-black/25 bg-gradient-to-b from-black/25 via-transparent to-transparent" aria-hidden="true" />
        <div
          className="absolute inset-x-0 bottom-0 z-[1] dark:bg-gradient-to-t dark:from-background dark:from-0% dark:via-background/0 dark:via-[82%] dark:to-transparent dark:to-100%"
          style={{ height: "22%" }}
          aria-hidden="true"
        />

        <div className="relative z-10 h-full px-6 lg:px-0">
          <div className="w-full max-w-[1080px] mx-auto px-6 pt-[144px]">
            <div className="text-left w-[576px] max-w-full">
              <h1 className="text-[38px] lg:text-[60px] font-extrabold leading-[1.05] tracking-tight text-white">
                <span className="block whitespace-nowrap">Your Gym Re-imagined</span>
                <span className="block whitespace-nowrap text-primary">Anywhere, Anytime.</span>
              </h1>
              <p className="mt-2 text-base lg:text-lg leading-relaxed text-white/80">
                Expert-designed workouts, structured programs, blog insights and smart tools.
              </p>
              <p className="mt-1 text-base lg:text-lg leading-relaxed text-white/80">
                <span className="font-bold">100% Human</span>,{" "}
                <span className="font-bold text-red-400">0% AI</span>.
              </p>
              <div className="mt-3 flex flex-wrap items-center gap-3">
                {!freeAccessMode && (
                  <button
                    type="button"
                    onClick={() => navigate("/smarty-premium")}
                    className="inline-flex h-11 items-center gap-2 rounded-full bg-primary px-8 text-base font-bold text-primary-foreground hover:opacity-95 transition-all"
                  >
                    Get Premium <ArrowRight className="w-4 h-4" />
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => navigate("/workout")}
                  className="inline-flex h-11 items-center gap-2 rounded-full border-2 border-primary px-8 text-base font-bold text-primary hover:bg-primary/10 transition-all"
                >
                  Browse Workouts <ArrowRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          </div>
        </div>

      </section>

      {/* Brand sections */}
      <div id="wellness-sections">
        {sections.map((s, idx) => {
          const reverse = idx % 2 === 1;
          return (
            <section
              key={s.id}
              id={s.id}
              className="bg-background"
            >
              <div
                className={`max-w-7xl mx-auto px-6 lg:px-8 py-8 lg:py-10 grid grid-cols-1 md:grid-cols-2 gap-8 md:gap-12 items-start ${
                  reverse ? "md:[&>*:first-child]:order-2" : ""
                }`}
              >
                <button
                  type="button"
                  onClick={() => navigate(s.route)}
                  aria-label={s.name}
                  className="group relative rounded-3xl overflow-hidden aspect-[4/3] shadow-2xl block"
                >
                  <img
                    src={s.image}
                    alt={s.name}
                    loading="lazy"
                    className="w-full h-full object-cover group-hover:scale-[1.03] transition-transform duration-500"
                  />
                </button>

                <div className="aspect-[4/3] min-h-0 flex flex-col justify-between py-1">
                  <div className="min-h-0">
                  <div
                    className="inline-flex items-center gap-2 text-[10px] uppercase tracking-[0.18em]"
                    style={{ color: s.accent }}
                  >
                    <span
                      className="h-px w-6"
                      style={{ backgroundColor: s.accent }}
                    />
                    {s.tag}
                  </div>
                  <h2 className="mt-2 text-2xl lg:text-3xl font-extrabold tracking-tight text-foreground">
                    Smarty{" "}
                    <span style={{ color: s.accent }}>{s.accentWord}</span>
                  </h2>
                  <p className="mt-3 text-muted-foreground text-sm leading-snug line-clamp-3">
                    {s.description}
                  </p>

                  {s.featured.length > 0 && (
                    <div className="mt-5 flex flex-col gap-2 lg:gap-2.5">
                      {s.featured.map((item) => (
                        <button
                          key={item.id}
                          type="button"
                          onClick={() => navigate(item.route)}
                          className="group flex min-h-12 lg:min-h-14 xl:min-h-16 items-center gap-3 text-left transition-colors hover:text-primary"
                        >
                          <img
                            src={item.image}
                            alt={item.title}
                            loading="lazy"
                            className="w-12 h-12 lg:w-14 lg:h-14 xl:w-16 xl:h-16 rounded-md object-cover flex-shrink-0"
                          />
                          <div className="min-w-0 flex-1">
                            <div className="text-sm xl:text-base font-semibold text-foreground group-hover:text-primary truncate">
                              {item.title}
                            </div>
                            {item.meta && (
                              <div className="mt-0.5 text-xs xl:text-sm leading-tight text-muted-foreground truncate">
                                {item.meta}
                              </div>
                            )}
                          </div>
                          <ChevronRight className="w-4 h-4 text-muted-foreground group-hover:text-primary flex-shrink-0" />
                        </button>
                      ))}
                    </div>
                  )}
                  </div>

                  <div className="pt-3">
                    <button
                      type="button"
                      onClick={() => navigate(s.route)}
                      className="group inline-flex items-center gap-2 text-sm font-semibold transition-all hover:gap-3"
                      style={{ color: s.accent }}
                    >
                      {s.cta}
                      <ArrowRight className="w-4 h-4 transition-transform group-hover:translate-x-0.5" />
                    </button>
                  </div>
                </div>
              </div>
            </section>
          );
        })}
      </div>
    </div>
  );
};
