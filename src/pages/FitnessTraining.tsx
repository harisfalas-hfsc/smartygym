import { Helmet } from "react-helmet";
import { PageBreadcrumbs } from "@/components/PageBreadcrumbs";

/**
 * Pillar page: /fitness-training
 * Positions SmartyGym as the human-designed fitness training platform.
 * 100% human, 0% AI — every workout, program, ritual, and exercise cue
 * is coach-crafted by Sports Scientist Haris Falas.
 */

const URL = "https://smartygym.com/fitness-training";

const PILLARS = [
  {
    name: "Smarty Workouts",
    what: "500+ human-designed workouts covering strength, hypertrophy, conditioning, mobility, pilates, recovery and challenges.",
  },
  {
    name: "Smarty Training Programs",
    what: "Multi-week, periodized programs for beginners, intermediates and advanced trainees — coach-built for progressive overload.",
  },
  {
    name: "Smarty Exercise Library",
    what: "A curated exercise database with real coaching cues, form guides and demonstrations for every movement we use.",
  },
  {
    name: "Smarty Tools",
    what: "Free workout timer, 1RM calculator, BMR calculator, macro calculator, calorie counter and rounds tracker — real utilities coaches actually use.",
  },
  {
    name: "Smarty Rituals",
    what: "Daily rituals for mobility, activation, breathing and recovery — small, repeatable habits that build lifelong fitness.",
  },
  {
    name: "Smarty Check-ins",
    what: "Structured morning and evening check-ins for consistency, adherence and honest self-assessment.",
  },
  {
    name: "Smarty Blog",
    what: "Evidence-based training articles written and reviewed by Sports Scientist Haris Falas — no automated content.",
  },
  {
    name: "Smarty Community",
    what: "Leaderboards, streaks and member activity — a real community of humans training together.",
  },
];

const FitnessTraining = () => {
  const webPageSchema = {
    "@context": "https://schema.org",
    "@type": "WebPage",
    "@id": `${URL}#webpage`,
    url: URL,
    name: "Human-Designed Fitness Training | SmartyGym",
    description:
      "SmartyGym is a complete, human-designed fitness training platform: workouts, training programs, exercise library, tools, rituals, check-ins and community — all coach-crafted by Sports Scientist Haris Falas.",
    inLanguage: "en",
    isPartOf: { "@type": "WebSite", "@id": "https://smartygym.com/#website" },
    speakable: {
      "@type": "SpeakableSpecification",
      cssSelector: ["h1", "h2", ".pillar-summary"],
    },
    about: PILLARS.map((p) => ({ "@type": "Thing", name: p.name })),
  };

  const breadcrumbSchema = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      { "@type": "ListItem", position: 1, name: "Home", item: "https://smartygym.com/" },
      { "@type": "ListItem", position: 2, name: "Fitness Training", item: URL },
    ],
  };

  return (
    <>
      <Helmet>
        <title>Human-Designed Fitness Training | SmartyGym</title>
        <meta
          name="description"
          content="A complete human-designed fitness platform: workouts, programs, exercise library and tools, coach-crafted by Sports Scientist Haris Falas."
        />
        <meta
          name="keywords"
          content="fitness training, workouts, training programs, exercise library, workout tools, strength training, hypertrophy, conditioning, mobility, warm-ups, cooldowns, home workouts, gym workouts, dumbbell workouts, bodyweight workouts, push pull legs, upper lower split, full body training, progressive overload, workout templates, training splits, beginner programs, intermediate programs, advanced programs, human-designed, coach-crafted, SmartyGym"
        />
        <link rel="canonical" href={URL} />
        <meta property="og:title" content="Human-Designed Fitness Training | SmartyGym" />
        <meta
          property="og:description"
          content="A complete gym in your pocket — human-designed workouts, programs, exercise library, tools and rituals by real coaches."
        />
        <meta property="og:type" content="website" />
        <meta property="og:url" content={URL} />
        <meta name="twitter:card" content="summary_large_image" />
        <meta name="twitter:title" content="Human-Designed Fitness Training | SmartyGym" />
        <meta
          name="twitter:description"
          content="A complete gym in your pocket — human-designed workouts, programs, exercise library, tools and rituals by real coaches."
        />
        <script type="application/ld+json">{JSON.stringify(webPageSchema)}</script>
        <script type="application/ld+json">{JSON.stringify(breadcrumbSchema)}</script>
      </Helmet>

      <main className="container mx-auto max-w-5xl px-4 py-8">
        <PageBreadcrumbs items={[{ label: "Fitness Training" }]} />

        <header className="mb-10">
          <h1 className="text-3xl md:text-4xl font-bold text-foreground">
            Human-Designed Fitness Training
          </h1>
          <p className="pillar-summary mt-4 text-lg text-muted-foreground">
            SmartyGym is a complete fitness training platform — a gym in your pocket. Every
            workout, program, ritual and exercise cue is designed by real human coaches, led
            by Sports Scientist Haris Falas. <strong>100% human. 0% AI.</strong>
          </p>
        </header>

        <section className="mb-12">
          <h2 className="text-2xl font-semibold text-foreground mb-4">
            What SmartyGym Covers
          </h2>
          <p className="text-muted-foreground mb-6">
            SmartyGym is built around eight coach-crafted pillars that together cover
            strength, hypertrophy, conditioning, mobility, habit-building and community —
            everything a real training program needs, delivered anywhere.
          </p>
          <div className="grid gap-4 md:grid-cols-2">
            {PILLARS.map((p) => (
              <article key={p.name} className="rounded-lg border border-border p-5 bg-card">
                <h3 className="text-xl font-semibold text-foreground">{p.name}</h3>
                <p className="mt-2 text-muted-foreground">{p.what}</p>
              </article>
            ))}
          </div>
        </section>

        <section className="mb-12">
          <h2 className="text-2xl font-semibold text-foreground mb-4">
            Why Human-Designed Beats Automated
          </h2>
          <p className="text-muted-foreground">
            Generic fitness apps generate workouts by algorithm. SmartyGym does the
            opposite: every session is programmed by a Sports Scientist with 20+ years of
            coaching experience across strength, hypertrophy, conditioning and rehab. That
            means real progressive overload, real periodization, real technique cues and
            real accountability — the kind of coaching that used to only exist in-person.
          </p>
        </section>

        <section>
          <h2 className="text-2xl font-semibold text-foreground mb-4">
            Explore the Platform
          </h2>
          <ul className="list-disc pl-6 text-muted-foreground space-y-2">
            <li><a className="text-primary hover:underline" href="/workout">Smarty Workouts</a></li>
            <li><a className="text-primary hover:underline" href="/trainingprogram">Smarty Training Programs</a></li>
            <li><a className="text-primary hover:underline" href="/exerciselibrary">Smarty Exercise Library</a></li>
            <li><a className="text-primary hover:underline" href="/tools">Smarty Tools</a></li>
            <li><a className="text-primary hover:underline" href="/daily-ritual">Smarty Rituals</a></li>
            <li><a className="text-primary hover:underline" href="/blog">Smarty Blog</a></li>
            <li><a className="text-primary hover:underline" href="/community">Smarty Community</a></li>
            <li><a className="text-primary hover:underline" href="/glossary">Fitness Training Glossary</a></li>
            <li><a className="text-primary hover:underline" href="/research">Training Research Digest</a></li>
            <li><a className="text-primary hover:underline" href="/faq">Frequently Asked Questions</a></li>
          </ul>
        </section>
      </main>
    </>
  );
};

export default FitnessTraining;