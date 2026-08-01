import { Helmet } from "react-helmet";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { ScrollReveal } from "@/components/ScrollReveal";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { HelpCircle, MessageCircle } from "lucide-react";
import { SEOEnhancer } from "@/components/SEOEnhancer";
import { PageBreadcrumbs } from "@/components/PageBreadcrumbs";

const FAQ = () => {
  const navigate = useNavigate();

  return (
    <>
      <Helmet>
        <title>FAQ | SmartyGym Online Fitness</title>
        <meta name="description" content="Answers to common SmartyGym questions: online workouts, training programs, pricing, equipment needs and how to get started." />
        <meta name="keywords" content="smartygym faq, online fitness questions, home workout help, training program questions, fitness coaching faq, online gym help" />
        
        {/* Open Graph */}
        <meta property="og:title" content="FAQ - Your Questions Answered | SmartyGym" />
        <meta property="og:description" content="Everything you need to know about SmartyGym - workouts, programs, pricing, and getting started." />
        <meta property="og:type" content="website" />
        <meta property="og:url" content="https://smartygym.com/faq" />
        
        {/* Twitter Card */}
        <meta name="twitter:card" content="summary" />
        <meta name="twitter:title" content="FAQ - SmartyGym" />
        <meta name="twitter:description" content="Common questions about online fitness training with SmartyGym." />
        
        {/* Canonical URL */}
        <link rel="canonical" href="https://smartygym.com/faq" />
        
        {/* FAQ Structured Data */}
        <script type="application/ld+json">
          {JSON.stringify({
            "@context": "https://schema.org",
            "@type": "FAQPage",
            "mainEntity": [
              {
                "@type": "Question",
                "name": "What is SmartyGym?",
                "acceptedAnswer": {
                  "@type": "Answer",
                  "text": "SmartyGym is an online fitness platform providing functional, science-based workouts and training programs designed by certified coaches. Whether you're training at home, in the gym, or on the go, SmartyGym is your backup when life gets in the way — or your complete fitness solution if you prefer training from home."
                }
              },
              {
                "@type": "Question",
                "name": "Who is Haris Falas?",
                "acceptedAnswer": {
                  "@type": "Answer",
                  "text": "Haris Falas is a certified Sports Scientist and Strength & Conditioning Coach with over 20 years of professional experience. He has worked with elite athletes and professional football teams in the Cypriot First Division. As the founder of HFSC and SmartyGym, Haris personally designs every single workout and program."
                }
              },
              {
                "@type": "Question",
                "name": "What makes SmartyGym different?",
                "acceptedAnswer": {
                  "@type": "Answer",
                  "text": "We're 100% human, 0% AI. Every workout is personally designed by Haris Falas, a qualified Sports Scientist and S&C Coach — never by algorithms or AI. You get real expertise from a real coach with 20+ years of experience, real support, and direct access to the person who created your program."
                }
              },
              {
                "@type": "Question",
                "name": "Do I need gym equipment?",
                "acceptedAnswer": {
                  "@type": "Answer",
                  "text": "Not necessarily. We offer a wide variety of workouts and programs designed for different equipment scenarios: bodyweight only, minimal equipment (resistance bands, dumbbells), and full gym access. You can filter content based on what you have available."
                }
              },
              {
                "@type": "Question",
                "name": "Is there a free trial?",
                "acceptedAnswer": {
                  "@type": "Answer",
                  "text": "We don't offer a free trial, but you can explore a selection of free workouts, free training programs, and our fitness tools at no cost before deciding to upgrade. SmartyGym Premium is €9.99/month and unlocks every workout, program, ritual and tool, with all future updates included. Cancel anytime from your account."
                }
              },
              {
                "@type": "Question",
                "name": "What is a standalone purchase?",
                "acceptedAnswer": {
                  "@type": "Answer",
                  "text": "A standalone purchase allows you to buy individual premium workouts or training programs without committing to a subscription. This is perfect for trying our training methodology before upgrading. Simply create a free account, browse our content, click 'Buy Now' on any standalone-enabled item, complete payment, and access it immediately. You get full dashboard access for purchased content including logbook tracking, ratings, and all calculator tools."
                }
              },
              {
                "@type": "Question",
                "name": "What is Smarty Ritual?",
                "acceptedAnswer": {
                  "@type": "Answer",
                  "text": "Smarty Ritual is your all-day game plan for movement, recovery, and performance. Each day, Premium members receive a fresh ritual with three phases: Morning Ritual for activation, Midday Ritual for reset and recharge, and Evening Ritual for unwinding. Every ritual is designed by Haris Falas and delivered fresh each morning at 7:00 AM."
                }
              },
              {
                "@type": "Question",
                "name": "What is Smarty Check-ins?",
                "acceptedAnswer": {
                  "@type": "Answer",
                  "text": "Smarty Check-ins is a daily self-assessment feature helping you track wellness and stay accountable. Complete Morning Check-ins (6-9 AM) rating sleep, energy, and motivation, and Night Check-ins (6-9 PM) reflecting on nutrition, hydration, and stress. Each generates a Daily Smarty Score (0-100) to track progress, build streaks, and earn badges."
                }
              },
              {
                "@type": "Question",
                "name": "How can I track my progress and stay accountable?",
                "acceptedAnswer": {
                  "@type": "Answer",
                  "text": "SmartyGym offers a complete fitness tracking ecosystem through your personal LogBook and Goals system. Set personal targets for weight, body fat, and muscle mass with visual progress indicators. Your LogBook automatically tracks workouts, training programs, favorites, calculator records, and body measurements. View activity trends through interactive charts, export your data, and receive automated weekly progress reports. Your daily Smarty Check-in scores appear on the LogBook calendar, helping you see the connection between daily habits and training results."
                }
              }
            ]
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
                "name": "FAQ",
                "item": "https://smartygym.com/faq"
              }
            ]
          })}
        </script>
      </Helmet>

      <SEOEnhancer
        entities={["FAQ", "Frequently Asked Questions", "Help Center", "Support"]}
        topics={["fitness questions", "membership help", "workout guidance", "training support"]}
        expertise={["customer support", "fitness guidance", "platform help"]}
        contentType="FAQ Page"
        aiSummary="SmartyGym FAQ: Answers to common questions about online workouts, training programs, membership plans, equipment needs, and getting started with your fitness journey."
        aiKeywords={["smartygym faq", "online fitness questions", "gym membership help", "workout questions", "training program help"]}
        relatedContent={["Contact", "About", "Premium Membership", "Getting Started"]}
        targetAudience="users seeking help and information"
        pageType="FAQPage"
      />

      <div className="min-h-screen bg-background">
        <div className="container mx-auto max-w-4xl md:max-w-[1200px] px-4 md:px-6 pb-8">
          
          <PageBreadcrumbs items={[
            { label: "Home", href: "/" },
            { label: "FAQ" }
          ]} />

          {/* Hero Section */}
          <ScrollReveal>
            <div className="text-center mb-10">
              <HelpCircle className="w-16 h-16 text-primary mx-auto mb-4" />
              <h1 className="text-4xl md:text-5xl font-extrabold tracking-tight uppercase mb-4 text-foreground">
                Frequently Asked Questions
              </h1>
              <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
                Everything you need to know about SmartyGym
              </p>
            </div>
          </ScrollReveal>

          {/* FAQ Accordion */}
          <ScrollReveal>
            <Card className="border-2 border-primary mb-8">
              <CardContent className="p-3 sm:p-4">
                <Accordion type="single" collapsible className="w-full">
                  
                  <AccordionItem value="item-1">
                    <AccordionTrigger className="text-left">What is SmartyGym?</AccordionTrigger>
                    <AccordionContent className="py-2 leading-relaxed">
                      SmartyGym is an online fitness platform providing functional, science-based workouts and training programs
                      designed by certified coaches. Whether you're training at home, in the gym, or on the go, SmartyGym 
                      is your backup when life gets in the way — or your complete fitness solution if you prefer training from home. 
                      We make quality fitness accessible anywhere, anytime.
                    </AccordionContent>
                  </AccordionItem>

                  <AccordionItem value="item-2">
                    <AccordionTrigger className="text-left">Who is Haris Falas?</AccordionTrigger>
                    <AccordionContent className="py-2 leading-relaxed">
                      <a href="/coach-profile" className="text-primary hover:underline font-medium">Haris Falas</a> is a certified Sports Scientist
                      and Strength & Conditioning Coach with over 20 years of professional experience. He has worked with elite athletes and professional 
                      football teams in the Cypriot First Division. As the founder of <a href="https://hfsc.eu/" target="_blank" rel="noopener noreferrer" className="text-primary hover:underline font-medium">HFSC</a> and 
                      SmartyGym, <strong>Haris personally designs every single workout and program</strong> — never by AI, always with evidence-based
                      training principles and real coaching experience.
                    </AccordionContent>
                  </AccordionItem>

                  <AccordionItem value="item-3">
                    <AccordionTrigger className="text-left">What makes SmartyGym different?</AccordionTrigger>
                    <AccordionContent className="py-2 leading-relaxed">
                      <strong>We're 100% human, 0% AI.</strong> Every workout is personally designed by <a href="/coach-profile" className="text-primary hover:underline font-medium">Haris Falas</a>,
                      a qualified Sports Scientist and S&C Coach — never by algorithms or AI. You get real expertise from a real coach with 20+ years 
                      of experience, real support, and direct access to the person who created your program. We focus on sustainable, functional training 
                      that fits into your real life — not quick fixes or unrealistic promises.
                    </AccordionContent>
                  </AccordionItem>

                  <AccordionItem value="item-3a">
                    <AccordionTrigger className="text-left">What's the difference between a workout and training program?</AccordionTrigger>
                    <AccordionContent className="py-2 leading-relaxed">
                      A <strong>workout</strong> is a standalone training session designed for a specific goal — whether that's calorie burning, 
                      strength building, cardio conditioning, mobility work, or power development. It's perfect when you want a single, 
                      focused session or when you're mixing and matching your own training plan.<br/><br/>
                      
                      A <strong>training program</strong> is a complete, structured plan that spans multiple weeks (e.g., 4, 6, or 12 weeks). 
                      It includes progressive training phases, periodization, recovery strategies, and a clear roadmap toward a specific goal 
                      (like building strength, losing fat, or improving performance). Programs are ideal if you want a full training cycle 
                      with built-in progression and accountability.
                    </AccordionContent>
                  </AccordionItem>

                  <AccordionItem value="item-4">
                    <AccordionTrigger className="text-left">What kind of workouts do you offer?</AccordionTrigger>
                    <AccordionContent className="py-2 leading-relaxed">
                      We offer a wide variety of training styles to match your goals and preferences: Strength Training, Hypertrophy (Muscle Building), 
                      Metabolic Conditioning, HIIT, Cardio, Mobility & Flexibility, Functional Training, Endurance, Core & Stability, Power & Explosiveness, 
                      and Sport-Specific workouts. All workouts are categorized by difficulty level (beginner, intermediate, advanced), duration, and equipment requirements.
                    </AccordionContent>
                  </AccordionItem>

                  <AccordionItem value="item-5">
                    <AccordionTrigger className="text-left">Do I need gym equipment?</AccordionTrigger>
                    <AccordionContent className="py-2 leading-relaxed">
                      Not necessarily. We offer a wide variety of workouts and programs designed for different equipment scenarios: <strong>bodyweight only</strong>, 
                      <strong>minimal equipment</strong> (resistance bands, dumbbells), and <strong>full gym access</strong>. You can filter content based on what you have available. 
                      Whether you're training at home, in a hotel room, or at a fully equipped gym, there's something for you.
                    </AccordionContent>
                  </AccordionItem>

                  <AccordionItem value="item-6">
                    <AccordionTrigger className="text-left">Who is SmartyGym for?</AccordionTrigger>
                    <AccordionContent className="py-2 leading-relaxed">
                      SmartyGym is for <strong>everyone</strong> — whether you're a complete beginner taking your first steps into fitness, 
                      or an experienced athlete looking for structured, science-based training. Our platform is designed to meet you where you are 
                      and guide you forward with safe, effective programming. If you value expert coaching, flexibility, and real results, SmartyGym is for you.
                    </AccordionContent>
                  </AccordionItem>

              <AccordionItem value="item-7">
                    <AccordionTrigger className="text-left">Can I really get results training with SmartyGym?</AccordionTrigger>
                    <AccordionContent className="py-2 leading-relaxed">
                      Let's be honest — simply subscribing to SmartyGym won't automatically transform your body. That's like owning a Ferrari but never getting behind the wheel.<br/><br/>
                      
                      <strong>However</strong>, SmartyGym provides you with the <strong>complete ecosystem</strong> to succeed. Every single day, you receive <strong>two fresh workouts</strong> designed by a certified coach, plus access to structured <a href="/trainingprogram" className="text-primary hover:underline font-medium">training programs</a> for every goal and level. Add to that daily <a href="/daily-ritual" className="text-primary hover:underline font-medium">Smarty Rituals</a> for movement and recovery, <a href="/userdashboard?tab=checkins" className="text-primary hover:underline font-medium">Smarty Check-ins</a> for accountability, <a href="/blog" className="text-primary hover:underline font-medium">blog articles</a> with expert knowledge, and a supportive <a href="/community" className="text-primary hover:underline font-medium">community</a> that keeps you motivated.<br/><br/>
                      
                      Your personal <a href="/userdashboard?tab=logbook" className="text-primary hover:underline font-medium">LogBook</a> tracks every workout, program, and measurement — with visual analytics and <strong>weekly progress reports</strong> delivered straight to your inbox.<br/><br/>
                      
                      It's like having a <strong>complete personal trainer in your pocket</strong> — one that keeps you accountable, motivated, and constantly improving. Use it the way it's designed, and SmartyGym won't just help you reach your goals — <strong>it can change your entire life</strong>.
                    </AccordionContent>
                  </AccordionItem>

                  <AccordionItem value="item-7c">
                    <AccordionTrigger className="text-left">How can I track my progress and stay accountable?</AccordionTrigger>
                    <AccordionContent className="py-2 leading-relaxed">
                      SmartyGym offers a complete fitness tracking ecosystem through your personal <a href="/userdashboard?tab=logbook" className="text-primary hover:underline font-medium">LogBook</a> and Goals system.<br/><br/>
                      
                      <strong>🎯 Set Your Goals:</strong> Define personal targets — weight, body fat percentage, muscle mass — with optional target dates. 
                      Track your progress visually with intuitive progress bars and see how close you are to achieving your goals.<br/><br/>
                      
                      <strong>📓 Your Personal LogBook:</strong> Your LogBook automatically tracks everything: workouts completed, training programs in progress, 
                      favorited content, calculator records (1RM, BMR, Macros), and body measurements. It's your complete fitness journal — all in one place.<br/><br/>
                      
                      <strong>📊 Visual Analytics & Export:</strong> View activity trends and distribution through interactive charts. Filter by activity type, 
                      time period, or specific categories. Export your data and charts for deeper analysis or to share with your coach.<br/><br/>
                      
                      <strong>📧 Weekly Progress Reports:</strong> Receive automated weekly summaries of your training activity, consistency, and progress 
                      directly to your inbox — keeping you informed and motivated.<br/><br/>
                      
                      <strong>✅ Integrated Check-ins:</strong> Your daily <a href="/userdashboard?tab=checkins" className="text-primary hover:underline font-medium">Smarty Check-in</a> scores 
                      appear on the LogBook calendar with color-coded indicators, helping you see the connection between your daily habits (sleep, nutrition, stress) 
                      and your training results.<br/><br/>
                      
                      The LogBook ecosystem is designed to keep you motivated, accountable, and fully aware of your progress — not just during workouts, 
                      but throughout your entire health and fitness journey.
                    </AccordionContent>
                  </AccordionItem>

                  <AccordionItem value="item-7a">
                    <AccordionTrigger className="text-left">What is Smarty Ritual?</AccordionTrigger>
                    <AccordionContent className="py-2 leading-relaxed">
                      <strong>Smarty Ritual</strong> is your all-day game plan for movement, recovery, and performance. 
                      Each day, Premium members receive a fresh ritual with three expertly designed phases:<br/><br/>
                      
                      <strong>🌅 Morning Ritual (~8:00 AM):</strong> Wake up your body with joint unlock movements, light activation exercises, 
                      and a nutrition tip to start your day strong.<br/><br/>
                      
                      <strong>☀️ Midday Ritual (~1:00 PM):</strong> Reset and recharge with desk-friendly micro movements, 
                      breathing exercises, and a quick energy boost.<br/><br/>
                      
                      <strong>🌙 Evening Ritual (~5:00 PM):</strong> Unwind with decompression stretches, stress release techniques, 
                      and pre-bed guidance for quality sleep.<br/><br/>
                      
                      Every ritual is personally designed by <a href="/coach-profile" className="text-primary hover:underline font-medium">Haris Falas</a> and 
                      delivered fresh each morning at 7:00 AM. You can even add the ritual phases to your calendar with one click. 
                      Smarty Ritual is exclusively available for <a href="/smarty-premium" className="text-primary hover:underline font-medium">Premium members</a>.
                    </AccordionContent>
                  </AccordionItem>

                  <AccordionItem value="item-7b">
                    <AccordionTrigger className="text-left">What is Smarty Check-ins?</AccordionTrigger>
                    <AccordionContent className="py-2 leading-relaxed">
                      <strong>Smarty Check-ins</strong> is a daily self-assessment feature that helps you track your overall wellness and stay accountable to your fitness journey.<br/><br/>
                      
                      <strong>🌅 Morning Check-in (6:00 AM - 9:00 AM):</strong> Rate your sleep quality, energy levels, motivation, 
                      and readiness to train — setting the tone for your day.<br/><br/>
                      
                      <strong>🌙 Night Check-in (6:00 PM - 9:00 PM):</strong> Reflect on your nutrition, hydration, activity level, 
                      stress, and overall day before winding down.<br/><br/>
                      
                      Each check-in generates a <strong>Daily Smarty Score</strong> (0-100) that tracks your progress over time. 
                      Build streaks, earn badges, view your history in graphs, and export your data for deeper analysis. 
                      Your scores also appear on the LogBook calendar with color-coded indicators so you can spot patterns at a glance.<br/><br/>
                      
                      Smarty Check-ins is available in your <a href="/userdashboard?tab=checkins" className="text-primary hover:underline font-medium">Dashboard</a> and 
                      helps you understand the connection between your daily habits and your fitness results.
                    </AccordionContent>
                  </AccordionItem>

                  <AccordionItem value="item-8">
                    <AccordionTrigger className="text-left">Is there a free trial?</AccordionTrigger>
                    <AccordionContent className="py-2 leading-relaxed">
                      We don't offer a free trial, but you can explore a selection of <strong>free workouts</strong>, <strong>free training programs</strong>, and our <strong>fitness tools</strong> at no cost before deciding to upgrade. SmartyGym <strong>Premium Membership</strong> is <strong>€9.99/month</strong> and unlocks every workout, program, ritual and tool, with all future updates included. <strong>Cancel anytime</strong> from your account. You can also buy individual workouts and programs as standalone purchases. Check out our <a href="/smarty-premium" className="text-primary hover:underline font-medium">Smarty Plans</a> to see what's included.
                    </AccordionContent>
                  </AccordionItem>

                  <AccordionItem value="item-8a">
                    <AccordionTrigger className="text-left">What is a standalone purchase?</AccordionTrigger>
                    <AccordionContent className="py-2 leading-relaxed">
                      A <strong>standalone purchase</strong> allows you to buy individual premium workouts or training programs without committing to a subscription. 
                      This is perfect for trying our training methodology and coaching style before deciding to upgrade.<br/><br/>
                      
                      <strong>How to purchase:</strong><br/>
                      1. <strong>Create a free account</strong> — sign up to access the platform.<br/>
                      2. <strong>Browse</strong> our workouts or training programs.<br/>
                      3. <strong>Click "Buy Now"</strong> on any standalone-enabled content (marked with a price).<br/>
                      4. <strong>Complete payment</strong> securely via Stripe.<br/>
                      5. <strong>Access immediately</strong> — your purchased content is unlocked right away.<br/><br/>
                      
                      <strong>What you get:</strong> Full dashboard access for your purchased content, including logbook tracking, 
                      the ability to rate and review, mark as complete, add to favorites, and access to all our calculator tools. 
                      It's a great way to try before you commit to a full plan!
                    </AccordionContent>
                  </AccordionItem>

                  <AccordionItem value="item-9">
                    <AccordionTrigger className="text-left">How do I get started?</AccordionTrigger>
                    <AccordionContent className="py-2 leading-relaxed">
                      Getting started is simple:<br/>
                      1. <strong>Browse</strong> our free workouts and tools to get a feel for the platform.<br/>
                      2. <a href="/auth?mode=signup" className="text-primary hover:underline font-medium"><strong>Sign up</strong></a> for a free account to save your progress and track your training.<br/>
                      3. <a href="/smarty-premium" className="text-primary hover:underline font-medium"><strong>Become a Premium Member</strong></a> for €9.99/month and unlock everything — every workout, every training program, the Smarty Ritual, Smarty Tools, check-ins and all future content. Cancel anytime.<br/>
                      4. <strong>Start training</strong> — pick a workout or program and get moving!<br/><br/>
                      
                      If you need guidance, <a href="/contact" className="text-primary hover:underline font-medium">contact us</a> directly.
                    </AccordionContent>
                  </AccordionItem>

                  <AccordionItem value="item-10">
                    <AccordionTrigger className="text-left">How can I contact you?</AccordionTrigger>
                    <AccordionContent className="py-2 leading-relaxed">
                      We're here to help! You can reach us through our <a href="/contact" className="text-primary hover:underline font-medium">Contact page</a>, 
                      where you can send a message or get direct access to coach <a href="/coach-profile" className="text-primary hover:underline font-medium">Haris Falas</a>. 
                      We typically respond within 24 hours. You can also follow us on social media for updates, tips, and community support.
                    </AccordionContent>
                  </AccordionItem>

                </Accordion>
              </CardContent>
            </Card>
          </ScrollReveal>

          {/* Still Have Questions CTA */}
          <ScrollReveal>
            <Card className="border-2 border-border bg-primary/5 text-center">
              <CardContent className="p-6 space-y-4">
                <MessageCircle className="w-12 h-12 text-primary mx-auto" />
                <h2 className="text-2xl font-bold">Still Have Questions?</h2>
                <p className="text-muted-foreground max-w-xl mx-auto">
                  Can't find what you're looking for? Get in touch with us directly and we'll be happy to help.
                </p>
                <Button 
                  size="lg" 
                  onClick={() => navigate('/contact')}
                  className="mt-4"
                >
                  Contact Us
                </Button>
              </CardContent>
            </Card>
          </ScrollReveal>

        </div>
      </div>
    </>
  );
};

export default FAQ;
