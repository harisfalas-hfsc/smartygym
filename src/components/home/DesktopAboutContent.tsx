import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { LazySection } from "@/components/LazySection";
import { useAccessControl } from "@/hooks/useAccessControl";
import {
  CheckCircle2, Award, Shield, Users, Heart, Target, Sparkles, Rocket,
  GraduationCap, UserCheck, Calendar, Plane, Dumbbell, BookOpen, Brain,
  ChevronRight, Crown,
} from "lucide-react";
import harisPhoto from "@/assets/haris-falas-coach.png";
import valueBuiltForRealLife from "@/assets/value-built-for-real-life.jpg";
import valueScientificApproach from "@/assets/value-scientific-approach.jpg";
import valueAccessibleToAll from "@/assets/value-accessible-to-all.jpg";
import valueSafeEffective from "@/assets/value-safe-effective.jpg";
import valueRealExpertise from "@/assets/value-real-expertise.jpg";
import valuePersonalTouch from "@/assets/value-personal-touch.jpg";
import valueNotARobot from "@/assets/value-not-a-robot.jpg";
import valueNeverStopExpanding from "@/assets/value-never-stop-expanding.jpg";
import valueEvidenceBased from "@/assets/value-evidence-based.jpg";
import valueStructureClarity from "@/assets/value-structure-clarity.jpg";
import valueHumanConnection from "@/assets/value-human-connection.jpg";
import valueResultsDriven from "@/assets/value-results-driven.jpg";

/**
 * Shared desktop-only content used by both the Homepage and the About page,
 * starting at "Your Gym Re-imagined" and continuing through the CTA.
 * Rendering pages must gate this with `hidden md:block` themselves.
 */
export const DesktopAboutContent = ({ showPremiumCta = false }: { showPremiumCta?: boolean } = {}) => {
  const navigate = useNavigate();
  const { userTier } = useAccessControl();
  const isPremium = userTier === "premium";
  const shouldShowPremiumCta = showPremiumCta && !isPremium;
  const [activeAudienceTooltip, setActiveAudienceTooltip] = useState<string | null>(null);

  return (
    <>
            <section className="hidden md:block bg-background mt-8">
              <div className="container mx-auto max-w-6xl md:max-w-[1500px] px-4 md:px-6">
                <div className="relative mb-10 md:mb-14">
                  <span aria-hidden="true" className="ghost-headline absolute -top-6 md:-top-10 left-0 right-0 text-center text-[80px] md:text-[160px] hidden sm:block">
                    THE GYM
                  </span>
                  <div className="relative pt-6 md:pt-12 text-center">
                    <p className="text-xs md:text-sm font-bold tracking-[0.3em] text-primary uppercase mb-3">Your Fitness Partner</p>
                    <h1 className="text-3xl md:text-5xl font-black tracking-tight uppercase">Anywhere, Anytime.</h1>
                  </div>
                </div>
                <div className="bg-background/60 backdrop-blur-sm p-6 rounded-lg border-2 border-primary/30 text-center">
                  <p className="text-base text-muted-foreground leading-relaxed">
                    We are not here to replace your gym. We are here to back you up when life gets in the way. Whether you're traveling, on holiday, can't make it to the gym, or your gym is closed, SmartyGym is your backup plan. Or, if you go to your gym but want to follow a professional, science-based workout or training program designed by{' '}
                    <Link to="/coach-profile" className="text-primary hover:underline font-medium">Haris Falas</Link>, we provide that expert guidance.
                  </p>
                  <Link to="/smarty-premium" className="inline-flex items-center gap-2 text-base font-semibold text-green-500 hover:text-green-600 hover:underline mt-2">
                    <Crown className="w-5 h-5" />
                    Join Premium
                    <ChevronRight className="w-5 h-5" />
                  </Link>

                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mt-5">
                    <article className="flex items-start gap-3 p-4 bg-background/50 rounded-lg border border-primary/20 h-full min-h-[88px]">
                      <GraduationCap className="w-5 h-5 text-primary flex-shrink-0 mt-0.5 lg:hidden" aria-hidden="true" />
                      <div className="flex-1 text-left">
                        <div className="hidden lg:block aspect-[16/9] overflow-hidden rounded-md mb-3">
                          <img src={valueRealExpertise} alt="Certified expert coach with clipboard" loading="lazy" width={1280} height={720} className="w-full h-full object-cover" />
                        </div>
                        <p className="font-semibold text-sm mb-1 flex items-center gap-1.5">
                          <GraduationCap className="w-4 h-4 text-primary hidden lg:inline-block" aria-hidden="true" />
                          Real Expertise
                        </p>
                        <p className="text-xs text-muted-foreground leading-relaxed">Every program designed by certified coach Haris Falas — never by AI, always with 20+ years of experience.</p>
                      </div>
                    </article>
                    <article className="flex items-start gap-3 p-4 bg-background/50 rounded-lg border border-primary/20 h-full min-h-[88px]">
                      <Heart className="w-5 h-5 text-primary flex-shrink-0 mt-0.5 lg:hidden" aria-hidden="true" />
                      <div className="flex-1 text-left">
                        <div className="hidden lg:block aspect-[16/9] overflow-hidden rounded-md mb-3">
                          <img src={valuePersonalTouch} alt="Coach guiding a client's form" loading="lazy" width={1280} height={720} className="w-full h-full object-cover" />
                        </div>
                        <p className="font-semibold text-sm mb-1 flex items-center gap-1.5">
                          <Heart className="w-4 h-4 text-primary hidden lg:inline-block" aria-hidden="true" />
                          Personal Touch
                        </p>
                        <p className="text-xs text-muted-foreground leading-relaxed">Direct access to the coach who created your program. Real support, real guidance, real results.</p>
                      </div>
                    </article>
                    <article className="flex items-start gap-3 p-4 bg-background/50 rounded-lg border border-primary/20 h-full min-h-[88px]">
                      <UserCheck className="w-5 h-5 text-primary flex-shrink-0 mt-0.5 lg:hidden" aria-hidden="true" />
                      <div className="flex-1 text-left">
                        <div className="hidden lg:block aspect-[16/9] overflow-hidden rounded-md mb-3">
                          <img src={valueNotARobot} alt="Coach hand-writing a workout plan in a notebook" loading="lazy" width={1280} height={720} className="w-full h-full object-cover" />
                        </div>
                        <p className="font-semibold text-sm mb-1 flex items-center gap-1.5">
                          <UserCheck className="w-4 h-4 text-primary hidden lg:inline-block" aria-hidden="true" />
                          Not a Robot
                        </p>
                        <p className="text-xs text-muted-foreground leading-relaxed">We don't generate workouts with algorithms. We design them with care, experience, and your goals in mind.</p>
                      </div>
                    </article>
                    <article className="flex items-start gap-3 p-4 bg-background/50 rounded-lg border border-primary/20 h-full min-h-[88px]">
                      <Rocket className="w-5 h-5 text-primary flex-shrink-0 mt-0.5 lg:hidden" aria-hidden="true" />
                      <div className="flex-1 text-left">
                        <div className="hidden lg:block aspect-[16/9] overflow-hidden rounded-md mb-3">
                          <img src={valueNeverStopExpanding} alt="Upward green growth chart with rocket launching" loading="lazy" width={1280} height={720} className="w-full h-full object-cover" />
                        </div>
                        <p className="font-semibold text-sm mb-1 flex items-center gap-1.5">
                          <Rocket className="w-4 h-4 text-primary hidden lg:inline-block" aria-hidden="true" />
                          Never Stop Expanding
                        </p>
                        <p className="text-xs text-muted-foreground leading-relaxed">New workouts, programs, tools, and articles — keeping you current with the latest science and trends.</p>
                      </div>
                    </article>
                  </div>

                  <div className="space-y-2 text-center mt-6 pt-4 border-t border-primary/20">
                    <p className="text-base font-semibold text-primary">
                      Every workout and training program is science-based and personally created by{' '}
                      <Link to="/coach-profile" className="text-primary hover:underline font-medium">Haris Falas</Link>.
                    </p>
                    <p className="text-base text-muted-foreground leading-relaxed">
                      Never by AI. Never by algorithms. Always by a real human expert who understands YOUR needs. Training designed by humans, for humans.
                    </p>
                  </div>

                  <div className="mt-6 pt-4 border-t border-primary/20">
                    <h4 className="text-sm font-semibold text-muted-foreground mb-3 text-center">
                      Who is <span className="text-primary">SmartyGym</span> For?
                    </h4>
                    <div className="grid grid-cols-6 gap-2 max-w-2xl mx-auto">
                      {[
                        { icon: Users, label: "Busy Adults", color: "text-blue-500", description: "Perfect for professionals juggling work and life. Get effective workouts that fit your schedule—no commute, no waiting for equipment. Train when you have time, not when the gym is open." },
                        { icon: Heart, label: "Parents", color: "text-pink-500", description: "Train at home while kids nap or play nearby. No babysitter needed, no guilt about \"me time.\" Quick, focused sessions that work around your family's schedule." },
                        { icon: GraduationCap, label: "Beginners", color: "text-emerald-500", description: "Start your fitness journey with confidence. Clear instructions, proper form guidance, and progressive programs designed to build your foundation safely." },
                        { icon: Target, label: "Intermediate", color: "text-orange-500", description: "Break through plateaus with structured periodization. Challenge yourself with varied programming that keeps you progressing without the guesswork." },
                        { icon: Plane, label: "Travelers", color: "text-cyan-500", description: "Stay consistent no matter where you are. Hotel room, Airbnb, or park—these workouts adapt to any space with minimal or no equipment needed." },
                        { icon: Dumbbell, label: "Gym-Goers", color: "text-purple-500", description: "Enhance your gym routine with expert programming. Follow structured plans that maximize your gym time and ensure balanced, progressive training." },
                      ].map((audience) => {
                        const Icon = audience.icon;
                        return (
                          <Tooltip key={audience.label} open={activeAudienceTooltip === audience.label}>
                            <TooltipTrigger asChild>
                              <div
                                className="flex flex-col items-center gap-1 cursor-pointer"
                                onMouseEnter={() => setActiveAudienceTooltip(audience.label)}
                                onMouseLeave={() => setActiveAudienceTooltip(null)}
                                onClick={() => setActiveAudienceTooltip(audience.label)}
                              >
                                <Icon className={`w-6 h-6 ${audience.color}`} />
                                <span className="text-sm font-bold text-foreground text-center">{audience.label}</span>
                              </div>
                            </TooltipTrigger>
                            <TooltipContent side="top" className="max-w-xs text-center">
                              {audience.description}
                            </TooltipContent>
                          </Tooltip>
                        );
                      })}
                    </div>
                    <div className="flex flex-wrap items-center justify-center gap-x-6 gap-y-2 mt-4">
                      <Link to="/why-invest-in-smartygym" className="inline-flex items-center gap-1.5 text-sm font-semibold text-green-500 hover:text-green-600 hover:underline">
                        Why Invest in SmartyGym
                        <ChevronRight className="w-4 h-4" />
                      </Link>
                      <Link to="/the-smarty-method" className="inline-flex items-center gap-1.5 text-sm font-semibold text-green-500 hover:text-green-600 hover:underline">
                        <BookOpen className="w-4 h-4" />
                        Discover The Smarty Method
                        <ChevronRight className="w-4 h-4" />
                      </Link>
                    </div>
                  </div>
                </div>
              </div>
            </section>
        <LazySection minHeight="400px" rootMargin="300px">
        <div className="container mx-auto max-w-6xl md:max-w-[1500px] px-4 md:px-6">
          {/* Mission Statement with Cards */}
          <section className="mb-20 mt-12 hidden md:block">
            <div className="relative mb-10 md:mb-14">
              <span aria-hidden="true" className="ghost-headline absolute -top-6 md:-top-10 left-0 right-0 text-center text-[80px] md:text-[160px] hidden sm:block">
                THE PROMISE
              </span>
              <div className="relative pt-6 md:pt-12 text-center">
                <p className="text-xs md:text-sm font-bold tracking-[0.3em] text-primary uppercase mb-3">Why SmartyGym</p>
                <h2 className="text-3xl md:text-5xl font-black tracking-tight uppercase">Built for Real Life</h2>
              </div>
            </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6 mb-8">
            <Card className="border-2 border-border text-center hover:shadow-lg transition-all hover:-translate-y-1">
              <CardHeader>
                <div className="hidden lg:block aspect-[16/9] overflow-hidden rounded-md mb-4 -mt-2">
                  <img src={valueBuiltForRealLife} alt="Built for real life — busy professionals training" loading="lazy" className="w-full h-full object-cover" />
                </div>
                <div className="w-14 h-14 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-4 lg:hidden">
                  <Target className="w-7 h-7 text-orange-500" />
                </div>
                <CardTitle className="text-xl flex items-center justify-center gap-2">
                  <Target className="w-5 h-5 text-orange-500 hidden lg:inline-block" />
                  Built for Real Life
                </CardTitle>
              </CardHeader>
              <CardContent>
                <CardDescription className="text-sm text-muted-foreground">
                  Flexible, effective training designed for busy professionals who want real results
                </CardDescription>
              </CardContent>
            </Card>

            <Card className="border-2 border-border text-center hover:shadow-lg transition-all hover:-translate-y-1">
              <CardHeader>
                <div className="hidden lg:block aspect-[16/9] overflow-hidden rounded-md mb-4 -mt-2">
                  <img src={valueScientificApproach} alt="Scientific approach to training" loading="lazy" className="w-full h-full object-cover" />
                </div>
                <div className="w-14 h-14 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-4 lg:hidden">
                  <Brain className="w-7 h-7 text-purple-500" />
                </div>
                <CardTitle className="text-xl flex items-center justify-center gap-2">
                  <Brain className="w-5 h-5 text-purple-500 hidden lg:inline-block" />
                  Scientific Approach
                </CardTitle>
              </CardHeader>
              <CardContent>
                <CardDescription className="text-sm text-muted-foreground">
                  Rooted in proven exercise science, biomechanics, and progressive overload. No gimmicks, just results.
                </CardDescription>
              </CardContent>
            </Card>

            <Card className="border-2 border-border text-center hover:shadow-lg transition-all hover:-translate-y-1">
              <CardHeader>
                <div className="hidden lg:block aspect-[16/9] overflow-hidden rounded-md mb-4 -mt-2">
                  <img src={valueAccessibleToAll} alt="Accessible training for all levels" loading="lazy" className="w-full h-full object-cover" />
                </div>
                <div className="w-14 h-14 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-4 lg:hidden">
                  <Users className="w-7 h-7 text-emerald-500" />
                </div>
                <CardTitle className="text-xl flex items-center justify-center gap-2">
                  <Users className="w-5 h-5 text-emerald-500 hidden lg:inline-block" />
                  Accessible to All
                </CardTitle>
              </CardHeader>
              <CardContent>
                <CardDescription className="text-sm text-muted-foreground">
                  For beginners and athletes alike. Train at home, in the gym, or on the go with programs for every level.
                </CardDescription>
              </CardContent>
            </Card>

            <Card className="border-2 border-border text-center hover:shadow-lg transition-all hover:-translate-y-1">
              <CardHeader>
                <div className="hidden lg:block aspect-[16/9] overflow-hidden rounded-md mb-4 -mt-2">
                  <img src={valueSafeEffective} alt="Safe and effective training programs" loading="lazy" className="w-full h-full object-cover" />
                </div>
                <div className="w-14 h-14 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-4 lg:hidden">
                  <Shield className="w-7 h-7 text-blue-500" />
                </div>
                <CardTitle className="text-xl flex items-center justify-center gap-2">
                  <Shield className="w-5 h-5 text-blue-500 hidden lg:inline-block" />
                  Safe & Effective
                </CardTitle>
              </CardHeader>
              <CardContent>
                <CardDescription className="text-sm text-muted-foreground">
                  Programs designed to build strength, mobility, and conditioning while reducing injury risk.
                </CardDescription>
              </CardContent>
            </Card>
          </div>

          {/* The SmartyGym Promise */}
          <Card className="dark-band border-2 border-green-500 overflow-hidden relative rounded-2xl">
            <span aria-hidden="true" className="ghost-headline ghost-headline-on-dark absolute top-4 left-1/2 -translate-x-1/2 text-[60px] md:text-[110px] leading-none opacity-40 hidden md:block pointer-events-none whitespace-nowrap">
              PROMISE
            </span>
            <CardContent className="p-8 md:p-14 md:pt-24 relative">
              <p className="text-xs md:text-sm font-bold tracking-[0.3em] text-primary uppercase mb-3 text-center">Our Commitment</p>
              <h3 className="text-3xl md:text-5xl font-black uppercase tracking-tight mb-8 text-center">The SmartyGym Promise</h3>
              <div className="max-w-3xl mx-auto space-y-4">
              <p className="text-base md:text-lg leading-relaxed text-center">
                Every workout and training program at <span className="text-primary font-semibold">SmartyGym</span> is crafted with one goal: to help you reach YOUR fitness goals,
                whatever they may be. Whether you're building muscle, losing weight, improving endurance, or simply staying active,
                we provide the structure, guidance, and flexibility you need to succeed — on your terms, in your time, wherever you are.
              </p>
              <p className="text-base md:text-lg leading-relaxed text-center">
                This promise also means we never stop developing SmartyGym — adding new workouts, training programs, tools, and blog articles — and staying on top of the latest trends and science-based evidence so you always have the most current, effective approach to your fitness.
              </p>
                <p className="text-base md:text-lg font-semibold text-center text-primary tracking-wide">
                  Real coaching. Real results. Anywhere you train.
                </p>
              </div>
            </CardContent>
          </Card>
        </section>

        {/* Core Values Section */}
        <section className="mb-20 hidden md:block">
          <div className="relative mb-10 md:mb-14">
            <span aria-hidden="true" className="ghost-headline absolute -top-6 md:-top-10 left-0 right-0 text-center text-[80px] md:text-[160px] hidden sm:block">
              VALUES
            </span>
            <div className="relative pt-6 md:pt-12 text-center">
              <p className="text-xs md:text-sm font-bold tracking-[0.3em] text-primary uppercase mb-3">Our Principles</p>
              <h2 className="text-3xl md:text-5xl font-black tracking-tight uppercase">What We Stand For</h2>
            </div>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            <Card className="border-2 border-border text-center hover:shadow-lg transition-all hover:-translate-y-1">
              <CardHeader>
                <div className="hidden lg:block aspect-[16/9] overflow-hidden rounded-md mb-4 -mt-2">
                  <img src={valueEvidenceBased} alt="Evidence-based training methodology" loading="lazy" className="w-full h-full object-cover" />
                </div>
                <div className="w-14 h-14 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-4 lg:hidden">
                  <Award className="w-7 h-7 text-cyan-500" />
                </div>
                <CardTitle className="text-xl flex items-center justify-center gap-2">
                  <Award className="w-5 h-5 text-cyan-500 hidden lg:inline-block" />
                  Evidence-Based
                </CardTitle>
              </CardHeader>
              <CardContent>
                <CardDescription className="text-sm text-muted-foreground">
                  Every program is backed by sports science, biomechanics, and proven training principles — not trends or guesswork.
                </CardDescription>
              </CardContent>
            </Card>

            <Card className="border-2 border-border text-center hover:shadow-lg transition-all hover:-translate-y-1">
              <CardHeader>
                <div className="hidden lg:block aspect-[16/9] overflow-hidden rounded-md mb-4 -mt-2">
                  <img src={valueStructureClarity} alt="Structured workout plans with clarity" loading="lazy" className="w-full h-full object-cover" />
                </div>
                <div className="w-14 h-14 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-4 lg:hidden">
                  <CheckCircle2 className="w-7 h-7 text-pink-500" />
                </div>
                <CardTitle className="text-xl flex items-center justify-center gap-2">
                  <CheckCircle2 className="w-5 h-5 text-pink-500 hidden lg:inline-block" />
                  Structure & Clarity
                </CardTitle>
              </CardHeader>
              <CardContent>
                <CardDescription className="text-sm text-muted-foreground">
                  Clear workout plans, step-by-step guidance, and structured progression so you always know what to do and why.
                </CardDescription>
              </CardContent>
            </Card>

            <Card className="border-2 border-border text-center hover:shadow-lg transition-all hover:-translate-y-1">
              <CardHeader>
                <div className="hidden lg:block aspect-[16/9] overflow-hidden rounded-md mb-4 -mt-2">
                  <img src={valueHumanConnection} alt="Human connection in coaching" loading="lazy" className="w-full h-full object-cover" />
                </div>
                <div className="w-14 h-14 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-4 lg:hidden">
                  <Heart className="w-7 h-7 text-red-500" />
                </div>
                <CardTitle className="text-xl flex items-center justify-center gap-2">
                  <Heart className="w-5 h-5 text-red-500 hidden lg:inline-block" />
                  Human Connection
                </CardTitle>
              </CardHeader>
              <CardContent>
                <CardDescription className="text-sm text-muted-foreground">
                  Real coaching, personalized support, and direct access to expert guidance — not chatbots or automated responses.
                </CardDescription>
              </CardContent>
            </Card>

            <Card className="border-2 border-border text-center hover:shadow-lg transition-all hover:-translate-y-1">
              <CardHeader>
                <div className="hidden lg:block aspect-[16/9] overflow-hidden rounded-md mb-4 -mt-2">
                  <img src={valueResultsDriven} alt="Results-driven training programs" loading="lazy" className="w-full h-full object-cover" />
                </div>
                <div className="w-14 h-14 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-4 lg:hidden">
                  <Target className="w-7 h-7 text-green-500" />
                </div>
                <CardTitle className="text-xl flex items-center justify-center gap-2">
                  <Target className="w-5 h-5 text-green-500 hidden lg:inline-block" />
                  Results-Driven
                </CardTitle>
              </CardHeader>
              <CardContent>
                <CardDescription className="text-sm text-muted-foreground">
                  Our programs are designed to deliver measurable results — strength gains, fat loss, endurance, or whatever your goal is.
                </CardDescription>
              </CardContent>
            </Card>
          </div>
        </section>

        {/* Premium CTA (About page desktop only, signed-in non-premium users) */}
        {shouldShowPremiumCta && (
          <section className="mb-20 hidden md:block">
            <Card
              role="button"
              tabIndex={0}
              onClick={() => navigate('/smarty-premium')}
              onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') navigate('/smarty-premium'); }}
              className="border-2 border-primary cursor-pointer hover:bg-primary/5 transition-colors"
            >
              <CardContent className="p-10">
                <div className="flex items-center gap-8">
                  <div className="w-20 h-20 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                    <Crown className="w-10 h-10 text-primary" />
                  </div>
                  <div className="flex-1">
                    <p className="text-xs font-bold tracking-[0.3em] text-primary uppercase mb-2">Membership</p>
                    <h3 className="text-3xl font-black tracking-tight uppercase mb-2">Get the Full Experience</h3>
                    <p className="text-base text-muted-foreground max-w-2xl">
                      Every workout, program, ritual and tool — designed 100% by humans. Cancel anytime.
                    </p>
                  </div>
                  <div className="text-right flex-shrink-0">
                    <p className="text-4xl font-extrabold text-primary leading-none">
                      €9.99<span className="text-lg font-medium text-muted-foreground">/month</span>
                    </p>
                    <span className="inline-flex items-center gap-1.5 mt-3 text-sm font-semibold text-green-500">
                      Unlock Smarty Premium
                      <ChevronRight className="w-4 h-4" />
                    </span>
                  </div>
                </div>
              </CardContent>
            </Card>
          </section>
        )}

        {/* Message from Head Coach */}
        {/* Message from Head Coach */}
        <section className="mb-20 hidden md:block">
          <div className="relative mb-10 md:mb-14">
            <span aria-hidden="true" className="ghost-headline absolute -top-6 md:-top-10 left-0 right-0 text-center text-[80px] md:text-[160px] hidden sm:block">
              THE COACH
            </span>
            <div className="relative pt-6 md:pt-12 text-center">
              <p className="text-xs md:text-sm font-bold tracking-[0.3em] text-primary uppercase mb-3">A Word From</p>
              <h2 className="text-3xl md:text-5xl font-black tracking-tight uppercase">Message from Haris Falas</h2>
            </div>
          </div>
          <Card className="dark-band border-2 border-primary/30 overflow-hidden relative rounded-2xl">
            <div className="absolute top-0 right-0 w-40 h-40 bg-primary/10 rounded-full -mr-20 -mt-20" aria-hidden="true"></div>

            <CardContent className="relative p-8 md:p-14 grid grid-cols-1 lg:grid-cols-[280px_1fr] gap-10 items-start">
              <div className="flex flex-col items-center lg:items-start text-center lg:text-left gap-4">
                <div className="w-40 h-40 lg:w-64 lg:h-64 rounded-2xl overflow-hidden border-2 border-primary/40 shadow-2xl">
                  <img src={harisPhoto} alt="Haris Falas - Personal Coach" className="w-full h-full object-cover" />
                </div>
                <div>
                  <p className="text-2xl font-black uppercase tracking-tight">
                    <a href="/coach-profile" className="text-primary hover:underline">Haris Falas</a>
                  </p>
                  <p className="text-sm uppercase tracking-[0.2em] text-primary/80 mt-1">Founder · Head Coach</p>
                  <p className="text-sm text-muted-foreground mt-2">Sports Scientist · Strength & Conditioning Coach</p>
                </div>
              </div>

              <div className="space-y-4">
              <p className="text-base leading-relaxed">
                For more than twenty years I've coached athletes, teams, and everyday people — beginners, busy professionals, and gym-goers who simply want to train with purpose. If there's one thing I've learned, it's that people don't struggle because they're lazy. They struggle because they walk into their training without a clear plan, without structure, and without guidance they can trust.
              </p>

              <p className="text-base leading-relaxed">
                That's exactly why I created SmartyGym.
              </p>

              <p className="text-base leading-relaxed">
                My vision is to give people the kind of coaching that makes everything simpler: structured programs, smart progressions, expert guidance, and clear workouts you can follow with confidence — whether you train at home, outdoors, or inside a gym. SmartyGym is here to support your fitness journey, not replace any part of it. If you train in a gym, you'll have a plan. If you train at home, you'll have a structure. If you're busy or traveling, you'll still know exactly what to do.
              </p>

              <p className="text-base leading-relaxed">
                I built this platform for people who want real training, not random exercises. For those who want to feel stronger, move better, improve performance, and see results — with a system that removes confusion and brings clarity every step of the way.
              </p>

              <div className="bg-primary/15 p-4 rounded-lg border-l-4 border-primary">
                <p className="text-base leading-relaxed font-medium">
                  Every single program you see here? I designed it myself. No AI. No automation. No copy-paste templates.
                  Just years of education, experience, and a genuine commitment to YOUR success.
                </p>
              </div>

              <p className="text-base leading-relaxed">
                This project isn't just another fitness idea. It's the result of decades of experience, passion for coaching, and a deep belief that everyone deserves access to smart, effective training, no matter their level or lifestyle.
              </p>

              <p className="text-base leading-relaxed">
                Thank you for trusting me with your fitness. I'm here to guide you, support you, and help you improve — one session at a time.
              </p>

              <p className="text-base leading-relaxed font-medium">
                Every day is a game day.
              </p>

              <div className="flex items-center justify-center gap-2 pt-4">
                <div className="h-px flex-grow bg-primary/30"></div>
                <p className="font-black uppercase tracking-[0.2em] text-primary">
                  <a href="/coach-profile" className="hover:underline">Haris Falas</a>
                </p>
                <div className="h-px flex-grow bg-primary/30"></div>
              </div>
              <p className="text-center text-sm text-muted-foreground">Founder, SmartyGym</p>
              </div>
            </CardContent>
          </Card>
        </section>


        {/* CTA Section */}
        <section className="mb-20 hidden md:block">
          <Card className="dark-band border-2 border-primary/30 overflow-hidden relative rounded-2xl">
            <span aria-hidden="true" className="ghost-headline ghost-headline-on-dark absolute top-4 left-1/2 -translate-x-1/2 text-[60px] md:text-[110px] leading-none opacity-40 hidden md:block pointer-events-none whitespace-nowrap">
              JOIN
            </span>
            <CardContent className="p-10 md:p-16 md:pt-24 text-center space-y-6 relative">
              <div className="flex items-center justify-center gap-2">
                <Sparkles className="h-6 w-6 text-primary" />
                <h2 className="text-3xl md:text-5xl font-black uppercase tracking-tight">{isPremium ? "Continue Your Journey" : "Ready to Start Your Journey?"}</h2>
                <Sparkles className="h-6 w-6 text-primary" />
              </div>
              <p className="text-lg md:text-xl text-muted-foreground max-w-2xl mx-auto">
                {isPremium
                  ? "Continue training smarter with thousands of SmartyGym members."
                  : "Join thousands of people who are training smarter with SmartyGym."}
              </p>
              <p className="text-muted-foreground max-w-2xl mx-auto">
                Work with a real coach who designed every program personally — not an AI.
              </p>
              <div className="flex flex-wrap gap-4 justify-center pt-4">
                <Button size="lg" onClick={() => navigate("/workout")} className="gap-2 rounded-full px-8 uppercase tracking-wider font-bold">
                  <Target className="h-5 w-5" />
                  Browse Workouts
                </Button>
                <Button size="lg" variant="outline" onClick={() => navigate("/trainingprogram")} className="gap-2 rounded-full px-8 uppercase tracking-wider font-bold border-primary text-primary hover:bg-primary hover:text-primary-foreground">
                  <Calendar className="h-5 w-5" />
                  Explore Programs
                </Button>
                {!isPremium && <Button size="lg" variant="outline" onClick={() => navigate("/smarty-premium")} className="gap-2 rounded-full px-8 uppercase tracking-wider font-bold border-primary text-primary hover:bg-primary hover:text-primary-foreground">
                    <UserCheck className="h-5 w-5" />
                    Join Premium
                  </Button>}
              </div>
            </CardContent>
          </Card>
        </section>
      </div>
        </LazySection>
    </>
  );
};
