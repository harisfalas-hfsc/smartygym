import { useState, useEffect } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { Helmet } from "react-helmet";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { PageBreadcrumbs } from "@/components/PageBreadcrumbs";
import { DesktopPageIntro } from "@/components/DesktopPageIntro";
import { InfoRibbon } from "@/components/InfoRibbon";
import { Clock, Calendar, ChevronLeft, ChevronRight, BookOpen } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { CompactFilters } from "@/components/CompactFilters";
import { Link } from "react-router-dom";
import { SEOEnhancer } from "@/components/SEOEnhancer";
import { generateHarisFalasSchema } from "@/utils/seoSchemas";
import { getBlogArticleImage } from "@/utils/blogImages";
import { BlogSEOEnhancement } from "@/components/seo/BlogSEOEnhancement";
import { useIsMobile } from "@/hooks/use-mobile";
import { Carousel, CarouselContent, CarouselItem, type CarouselApi } from "@/components/ui/carousel";
import { cn } from "@/lib/utils";
import categoryFitnessImg from "@/assets/blog/category-fitness.jpg";
import categoryNutritionImg from "@/assets/blog/category-nutrition.jpg";
import categoryWellnessImg from "@/assets/blog/category-wellness.jpg";
interface Article {
  id: string;
  slug: string;
  title: string;
  excerpt: string;
  image: string;
  readTime: string;
  date: string;
  timestamp: number;
  category: string;
  author_name?: string;
}
const Blog = () => {
  const navigate = useNavigate();
  const isMobile = useIsMobile();
  const { category: categoryParam } = useParams<{ category?: string }>();
  const [categoryFilter, setCategoryFilter] = useState<string>(
    categoryParam ? categoryParam.toLowerCase() : "all",
  );
  useEffect(() => {
    setCategoryFilter(categoryParam ? categoryParam.toLowerCase() : "all");
  }, [categoryParam]);
  const [sortFilter, setSortFilter] = useState<string>("newest");
  const [allArticles, setAllArticles] = useState<Article[]>([]);
  useEffect(() => {
    const fetchArticles = async () => {
      try {
        const {
          data,
          error
        } = await supabase.from('blog_articles').select('*').eq('is_published', true);
        if (error) throw error;
        if (data && data.length > 0) {
          const formattedArticles: Article[] = data
            .map((article: any) => {
              const articleDate = article.published_at || article.created_at;
              return {
                id: article.id,
                slug: article.slug,
                title: article.title,
                excerpt: article.excerpt,
                image: getBlogArticleImage(article.image_url, article.slug),
                readTime: article.read_time || '5 min read',
                date: new Date(articleDate).toLocaleDateString('en-US', {
                  year: 'numeric',
                  month: 'long',
                  day: 'numeric'
                }),
                timestamp: new Date(articleDate).getTime(),
                category: article.category,
                author_name: article.author_name
              };
            })
            .sort((a, b) => b.timestamp - a.timestamp);
          setAllArticles(formattedArticles);
        }
      } catch (error) {
        console.error('Error fetching articles:', error);
      }
    };
    fetchArticles();
  }, []);
  const filteredArticles = allArticles.filter(article => categoryFilter === "all" || article.category.toLowerCase() === categoryFilter.toLowerCase()).sort((a, b) => {
    const dateA = a.timestamp;
    const dateB = b.timestamp;
    return sortFilter === "newest" ? dateB - dateA : dateA - dateB;
  });

  const blogCategories = [
    { key: "fitness", label: "Fitness", image: categoryFitnessImg, description: "Training, strength, and performance" },
    { key: "nutrition", label: "Nutrition", image: categoryNutritionImg, description: "Fueling for results and health" },
    { key: "wellness", label: "Wellness", image: categoryWellnessImg, description: "Recovery, mobility, and healthy aging" },
  ];
  const showMobileCategoryHub = isMobile && !categoryParam;
  const showMobileCompactList = isMobile && !!categoryParam;
  const [blogCatApi, setBlogCatApi] = useState<CarouselApi>();
  const [blogCatSlide, setBlogCatSlide] = useState(0);
  useEffect(() => {
    if (!blogCatApi) return;
    const onSelect = () => setBlogCatSlide(blogCatApi.selectedScrollSnap());
    onSelect();
    blogCatApi.on("select", onSelect);
    return () => { blogCatApi.off("select", onSelect); };
  }, [blogCatApi]);
  return <>
      <Helmet>
        <title>Fitness Blog Articles by Haris Falas | SmartyGym</title>
        <meta name="description" content="Evidence-based fitness blog articles by Sports Scientist Haris Falas: strength training, nutrition, recovery and healthy aging." />
        <meta name="keywords" content="fitness blog, nutrition blog, wellness blog, strength training, fat loss, muscle hypertrophy, HIIT, recovery, longevity, healthy aging, Haris Falas, Sports Scientist, CSCS, online personal trainer, SmartyGym, evidence-based fitness" />
        
        <meta property="og:title" content="Fitness Blog - Expert Training & Nutrition Advice by Haris Falas | SmartyGym" />
        <meta property="og:description" content="Expert fitness articles by sports scientist Haris Falas. Training tips, nutrition advice, and performance insights." />
        <meta property="og:type" content="website" />
        <meta property="og:url" content={window.location.href} />
        <meta property="og:image" content="https://images.unsplash.com/photo-1581009146145-b5ef050c2e1e?auto=format&fit=crop&q=80&w=1200" />
        
        <meta name="twitter:card" content="summary_large_image" />
        <meta name="twitter:title" content="Fitness Blog by Haris Falas - SmartyGym.com" />
        <meta name="twitter:description" content="Expert fitness articles by sports scientist Haris Falas. Training tips, nutrition advice, and performance insights." />
        <meta name="twitter:image" content="https://images.unsplash.com/photo-1581009146145-b5ef050c2e1e?auto=format&fit=crop&q=80&w=1200" />
        
        <link rel="canonical" href="https://smartygym.com/blog.html" />

        {/* Structured Data for Blog */}
        <script type="application/ld+json">
          {JSON.stringify({
          "@context": "https://schema.org",
          "@type": "Blog",
          "name": "SmartyGym Fitness Blog",
          "description": "Expert fitness, nutrition and wellness articles by Sports Scientist Haris Falas (CSCS).",
          "url": "https://smartygym.com/blog.html",
          "author": {
            "@type": "Person",
            "@id": "https://smartygym.com/coach-profile#person",
            "name": "Haris Falas",
            "jobTitle": "Sports Scientist & Strength and Conditioning Coach",
            "url": "https://smartygym.com/coach-profile"
          },
          "inLanguage": "en",
          "publisher": {
            "@type": "Organization",
            "name": "SmartyGym",
            "url": "https://smartygym.com",
            "logo": {
              "@type": "ImageObject",
              "url": "https://smartygym.com/smarty-gym-logo.png"
            }
          }
        })}
        </script>
        {/* Author Person schema (E-E-A-T) */}
        <script type="application/ld+json">
          {JSON.stringify(generateHarisFalasSchema())}
        </script>
        {/* ItemList of all articles so Google sees /blog as a real publication */}
        {allArticles.length > 0 && (
          <script type="application/ld+json">
            {JSON.stringify({
              "@context": "https://schema.org",
              "@type": "ItemList",
              "name": "SmartyGym Blog Articles",
              "numberOfItems": allArticles.length,
              "itemListElement": allArticles.map((a, i) => ({
                "@type": "ListItem",
                "position": i + 1,
                "url": `https://smartygym.com/blog/${a.slug}.html`,
                "name": a.title
              }))
            })}
          </script>
        )}
      </Helmet>

      <SEOEnhancer entities={["Fitness Blog", "Training Articles", "Workout Tips", "Nutrition Advice"]} topics={["fitness education", "training science", "workout techniques", "health tips"]} expertise={["sports science", "exercise physiology", "nutrition", "training methods"]} contentType="Blog Articles" aiSummary="SmartyGym Blog: Expert fitness articles by Sports Scientist Haris Falas. Training tips, workout techniques, nutrition advice, exercise science, and evidence-based fitness education for all levels." aiKeywords={["fitness blog", "training articles", "workout tips", "exercise science", "fitness education", "sports science blog"]} relatedContent={["Workouts", "Training Programs", "Exercise Library", "Fitness Tools"]} targetAudience="fitness enthusiasts seeking knowledge" pageType="Blog" />

      <div className="min-h-screen bg-gradient-to-b from-background to-accent/20">
        <div className="container mx-auto max-w-6xl md:max-w-[1500px] px-4 md:px-6 pb-8">
          <PageBreadcrumbs items={[{
          label: "Home",
          href: "/"
        }, {
          label: "Blog"
        }]} />

          {/* About Blog */}
          <DesktopPageIntro icon={BookOpen} title="Smarty Blog">
            <p className="font-bold text-foreground">
              Evidence-based articles by <a href="/coach-profile" className="text-primary hover:underline font-semibold">Haris Falas</a> on Fitness, Nutrition, and Wellness to empower your journey.
            </p>
            <p className="font-semibold text-foreground">
              Explore all <span className="text-primary font-bold">{allArticles.length} free articles</span> across Fitness, Nutrition, and Wellness.
            </p>
          </DesktopPageIntro>

          <Card className="lg:hidden mb-6 md:mb-8 bg-white dark:bg-card border-2 border-primary/40 shadow-primary">
            <CardContent className="p-4 sm:p-5">
              <h1 className="text-xl sm:text-2xl font-extrabold tracking-tight uppercase mb-3 text-center">Smarty Blog</h1>
              <div className="space-y-2 text-muted-foreground max-w-3xl mx-auto">
                <p className="text-sm sm:text-base text-center font-bold">
                  Evidence-based articles by <a href="/coach-profile" className="text-primary hover:underline font-semibold">Haris Falas</a> on Fitness, Nutrition, and Wellness to empower your journey.
                </p>
                <p className="text-sm sm:text-base text-center font-semibold text-foreground">
                  Explore all <span className="text-primary font-bold">{allArticles.length} free articles</span> across Fitness, Nutrition, and Wellness.
                </p>
              </div>
            </CardContent>
          </Card>

          {!isMobile && (
          <div className="mb-6 sm:mb-8">
            <CompactFilters filters={[{
          name: "Sort by",
          value: sortFilter,
          onChange: setSortFilter,
          options: [{
            value: "newest",
            label: "Newest"
          }, {
            value: "oldest",
            label: "Oldest"
          }],
          placeholder: "Sort"
        }, {
          name: "Category",
          value: categoryFilter,
          onChange: setCategoryFilter,
          options: [{
            value: "all",
            label: "All"
          }, {
            value: "fitness",
            label: "Fitness"
          }, {
            value: "wellness",
            label: "Wellness"
          }, {
            value: "nutrition",
            label: "Nutrition"
          }],
          placeholder: "Category"
        }]} />
          </div>
          )}

          {showMobileCategoryHub && (
            <div className="mb-6">
              <div className="flex items-center justify-between mb-3">
                <h2 className="text-lg font-bold">Smarty Blog</h2>
                <div className="flex items-center gap-2">
                  <button type="button" onClick={() => blogCatApi?.scrollPrev()} className="p-1.5 rounded-full bg-primary/10 hover:bg-primary/20 transition-colors" aria-label="Previous category">
                    <ChevronLeft className="h-5 w-5 text-primary" />
                  </button>
                  <button type="button" onClick={() => blogCatApi?.scrollNext()} className="p-1.5 rounded-full bg-primary/10 hover:bg-primary/20 transition-colors" aria-label="Next category">
                    <ChevronRight className="h-5 w-5 text-primary" />
                  </button>
                </div>
              </div>
              <Carousel className="w-full" opts={{ align: "center", loop: true }} setApi={setBlogCatApi}>
                <CarouselContent className="-ml-3">
                  {blogCategories.map((cat, index) => (
                    <CarouselItem key={cat.key} className="pl-3 basis-[75%] sm:basis-[60%]">
                      <div onClick={() => navigate(`/blog/category/${cat.key}`)} className="border-2 border-green-500/60 rounded-xl overflow-hidden hover:border-green-500 hover:scale-[1.02] hover:shadow-xl transition-all duration-300 cursor-pointer bg-card flex flex-col">
                        <div className="relative aspect-[16/8] w-full overflow-hidden flex-shrink-0">
                          <img
                            src={cat.image}
                            alt={`${cat.label} blog articles by Haris Falas`}
                            loading={index === 0 ? "eager" : "lazy"}
                            decoding="async"
                            className="absolute inset-0 w-full h-full object-cover"
                          />
                        </div>
                        <div className="flex flex-col justify-center flex-1 p-2 text-center">
                          <h3 className="text-xs font-bold text-foreground leading-tight">{cat.label}</h3>
                          <p className="text-[10px] text-muted-foreground leading-snug line-clamp-2">{cat.description}</p>
                          <div className="flex items-center justify-center gap-1 text-primary text-[9px] font-medium mt-0.5">
                            Explore
                            <ChevronRight className="w-2.5 h-2.5" />
                          </div>
                        </div>
                      </div>
                    </CarouselItem>
                  ))}
                </CarouselContent>
              </Carousel>
              <div className="flex justify-center gap-2 mt-4">
                {blogCategories.map((_, index) => (
                  <button
                    key={index}
                    onClick={() => blogCatApi?.scrollTo(index)}
                    className={cn(
                      "w-2.5 h-2.5 rounded-full transition-all duration-300",
                      blogCatSlide === index ? "bg-primary scale-125" : "bg-primary/30 hover:bg-primary/50"
                    )}
                    aria-label={`Go to category ${index + 1}`}
                  />
                ))}
              </div>
            </div>
          )}

          {showMobileCategoryHub && allArticles.length > 0 && (
            <div className="mb-6">
              <div className="flex items-center gap-2 mb-3">
                <span className="text-sm font-extrabold tracking-tight text-primary uppercase">
                  Featured {blogCategories[blogCatSlide]?.label ?? ""} Articles
                </span>
                <div className="h-px flex-1 bg-primary/20" />
              </div>
              <div className="flex flex-col gap-3">
                {allArticles
                  .filter(a => a.category.toLowerCase() === blogCategories[blogCatSlide]?.key)
                  .slice(0, 3)
                  .map((article) => (
                  <button
                    key={article.id}
                    type="button"
                    onClick={() => navigate(`/blog/${article.slug}.html`)}
                    className="flex items-stretch bg-card border-2 border-green-500/60 rounded-xl overflow-hidden hover:border-green-500 hover:shadow-xl transition-all duration-300 text-left"
                    aria-label={article.title}
                  >
                    <div className="relative w-28 flex-shrink-0 bg-muted">
                      <img
                        src={article.image}
                        alt={`${article.title} - SmartyGym blog by Haris Falas`}
                        loading="lazy"
                        decoding="async"
                        className="absolute inset-0 w-full h-full object-cover"
                      />
                    </div>
                    <div className="flex-1 min-w-0 p-3 flex flex-col justify-center">
                      <span className="text-[10px] font-semibold uppercase tracking-wider text-primary">{article.category}</span>
                      <h3 className="text-sm font-bold text-foreground leading-tight line-clamp-2 mt-0.5">{article.title}</h3>
                      <p className="text-[11px] text-muted-foreground mt-1 line-clamp-1">{article.readTime} · {article.date}</p>
                    </div>
                  </button>
                ))}
              </div>
            </div>
          )}

          {showMobileCompactList && (
            <div className="mb-6">
              <div className="flex items-center gap-2 mb-3">
                <span className="text-sm font-extrabold tracking-tight text-primary uppercase capitalize">{categoryParam} Articles</span>
                <div className="h-px flex-1 bg-primary/20" />
                <button
                  type="button"
                  onClick={() => navigate('/blog')}
                  className="text-xs text-primary hover:underline"
                >
                  ← All categories
                </button>
              </div>
              <CompactFilters filters={[{
                name: "Sort by",
                value: sortFilter,
                onChange: setSortFilter,
                options: [{
                  value: "newest",
                  label: "Newest"
                }, {
                  value: "oldest",
                  label: "Oldest"
                }],
                placeholder: "Sort"
              }]} compact />
              <div className="flex flex-col gap-3">
                {filteredArticles.map((article) => (
                  <button
                    key={article.id}
                    type="button"
                    onClick={() => navigate(`/blog/${article.slug}.html`)}
                    className="flex items-stretch bg-card border-2 border-green-500/60 rounded-xl overflow-hidden hover:border-green-500 hover:shadow-xl transition-all duration-300 text-left"
                    aria-label={article.title}
                  >
                    <div className="relative w-28 flex-shrink-0 bg-muted">
                      <img
                        src={article.image}
                        alt={`${article.title} - SmartyGym blog by Haris Falas`}
                        loading="lazy"
                        decoding="async"
                        className="absolute inset-0 w-full h-full object-cover"
                      />
                    </div>
                    <div className="flex-1 min-w-0 p-3 flex flex-col justify-center">
                      <span className="text-[10px] font-semibold uppercase tracking-wider text-primary">{article.category}</span>
                      <h3 className="text-sm font-bold text-foreground leading-tight line-clamp-2 mt-0.5">{article.title}</h3>
                      <p className="text-[11px] text-muted-foreground mt-1 line-clamp-1">{article.readTime} · {article.date}</p>
                    </div>
                  </button>
                ))}
                {filteredArticles.length === 0 && (
                  <div className="text-sm text-muted-foreground text-center py-6">No articles yet in this category.</div>
                )}
              </div>
            </div>
          )}

          {!isMobile && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredArticles.map(article => <Card key={article.id} itemScope itemType="https://schema.org/BlogPosting" className="overflow-hidden cursor-pointer transition-all duration-300 hover:scale-105 hover:shadow-lg" onClick={() => navigate(`/blog/${article.slug}.html`)} data-article-id={article.id} data-keywords="smarty gym blog, online fitness tips, smartygym.com, Haris Falas, online gym advice" aria-label={`${article.title} - SmartyGym blog - Online fitness at smartygym.com`}>
                <div className="relative aspect-video overflow-hidden">
                  <img
                    src={article.image}
                    alt={`${article.title} - SmartyGym online fitness blog - smartygym.com by Haris Falas`}
                    width={1280}
                    height={720}
                    loading="lazy"
                    decoding="async"
                    className="w-full h-full object-cover"
                    itemProp="image"
                  />
                  <div className="absolute top-3 right-3">
                    <span className="bg-primary text-primary-foreground px-3 py-1 rounded-full text-xs font-medium">
                      {article.category}
                    </span>
                  </div>
                </div>
                
                <div className="p-5">
                  <h2 className="text-xl font-bold mb-2 line-clamp-2" itemProp="headline">
                {article.title}
                  </h2>
                  <p className="text-muted-foreground text-sm mb-4 line-clamp-2" itemProp="description">
                    {article.excerpt}
                  </p>
                  
                  <div className="flex items-center justify-between text-xs text-muted-foreground">
                    <div className="flex items-center gap-1">
                      <Clock className="h-3 w-3" />
                      <span>{article.readTime}</span>
                    </div>
                    <div className="flex items-center gap-1">
                      <Calendar className="h-3 w-3" />
                      <span itemProp="datePublished">{article.date}</span>
                    </div>
                  </div>
                  <meta itemProp="author" content="Haris Falas - SmartyGym - smartygym.com" />
                  <meta itemProp="publisher" content="SmartyGym - smartygym.com" />
                </div>
              </Card>)}
          </div>
          )}

          {!isMobile && <BlogSEOEnhancement articleCount={allArticles.length} />}
        </div>
      </div>
    </>;
};
export default Blog;