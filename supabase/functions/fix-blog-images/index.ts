import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";
import { requireAdminOrServiceRole } from "../_shared/admin-or-service-auth.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

const stripHtml = (value = "") =>
  value
    .replace(/<[^>]*>/g, " ")
    .replace(/&nbsp;|&#160;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;|&apos;/gi, "'")
    .replace(/\s+/g, " ")
    .trim();

const buildArticleSpecificPrompt = (article: any) => {
  const articleBrief = stripHtml(`${article.title}. ${article.excerpt || ""}. ${article.content || ""}`).slice(0, 1800);
  const text = articleBrief.toLowerCase();
  const subjectRules: string[] = [];

  if (/glute|hip thrust|gluteal|posterior chain|rdl|romanian deadlift|lunge/.test(text)) {
    subjectRules.push("GLUTE MEANS BUTT/HIPS: show a correct lower-body glute hypertrophy scene where the butt/glute muscles and hip extension are the unmistakable main subject.");
    subjectRules.push("Prefer a barbell hip thrust or glute bridge with the padded bar across the hips/pelvis, bench behind the upper back, knees bent, and feet planted.");
    subjectRules.push("Forbidden for glute articles: bar on shoulders/neck, back squat, good morning, seated upper-body lift, deadlift-only image, head-hanging pose, treadmill, boxing, yoga, nutrition, or any generic gym image.");
  }
  if (/belly fat|waist|abdominal|over 50|men over 50/.test(text)) {
    subjectRules.push("Show a realistic adult male waist/body-composition scene; do not show a young model or a woman when the article is about men.");
  }
  if (/hydration|water|electrolyte|dehydration/.test(text)) {
    subjectRules.push("Show water, hydration, electrolytes, or an athlete drinking water; never show meat, fish, or unrelated food.");
  }
  if (/protein|meal|nutrition|diet|cholesterol|ldl|supplement/.test(text)) {
    subjectRules.push("Show the specific nutrition subject from the article, not a generic salad unless the article is actually about salads.");
  }

  return `Create ONE professional, realistic, text-free featured image for this SmartyGym blog article.

Article title: "${article.title}"
Article category: ${article.category || "General"}
Article brief: ${articleBrief}

Mandatory subject selection protocol:
- The visual subject must come from the article title and article brief first; category is only secondary context.
- If the article names a body part, movement, demographic, food, supplement, health marker, or training method, the image must show that exact subject in the foreground.
- Avoid generic category imagery. Fitness does not mean random gym photo; nutrition does not mean random food photo; wellness does not mean random meditation photo.
- ${subjectRules.length ? subjectRules.join("\n- ") : "Choose the most literal, article-specific visual subject from the title and brief."}

Style: premium editorial fitness/health photography, clean bright lighting, professional and realistic.
Composition: horizontal 16:9, strong first-glance relevance to the article.
Quality gate before finalizing: if the generated image could be mistaken for a different exercise, body part, demographic, food, or topic than the article title, reject it and generate a more literal image.
Forbidden: text, title overlays, captions, letters, numbers, logos, watermarks, unrelated stock-photo scenes, sexualized imagery, exaggerated anatomy.`;
};

serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const authError = await requireAdminOrServiceRole(req, corsHeaders);
  if (authError) return authError;

  try {
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) {
      throw new Error("LOVABLE_API_KEY is not configured");
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Fetch all articles with broken image paths
    const { data: articles, error: fetchError } = await supabase
      .from("blog_articles")
      .select("id, title, category, slug, image_url, excerpt, content")
      .or("image_url.like./src/%,image_url.is.null");

    if (fetchError) throw fetchError;

    console.log(`Found ${articles?.length || 0} articles to fix`);

    const results: any[] = [];

    for (const article of articles || []) {
      try {
        console.log(`Processing article: ${article.title}`);

        const prompt = buildArticleSpecificPrompt(article);

        // Generate image
        const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
          method: "POST",
          headers: {
            Authorization: `Bearer ${LOVABLE_API_KEY}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            model: "google/gemini-2.5-flash-image-preview",
            messages: [{ role: "user", content: prompt }],
            modalities: ["image", "text"],
          }),
        });

        if (!response.ok) {
          console.error(`Failed to generate image for ${article.title}: ${response.status}`);
          results.push({ id: article.id, title: article.title, status: "failed", error: `API error: ${response.status}` });
          continue;
        }

        const data = await response.json();
        const base64ImageUrl = data.choices?.[0]?.message?.images?.[0]?.image_url?.url;

        if (!base64ImageUrl) {
          results.push({ id: article.id, title: article.title, status: "failed", error: "No image generated" });
          continue;
        }

        // Extract base64 data
        const base64Data = base64ImageUrl.split(",")[1];
        const binaryString = atob(base64Data);
        const bytes = new Uint8Array(binaryString.length);
        for (let i = 0; i < binaryString.length; i++) {
          bytes[i] = binaryString.charCodeAt(i);
        }

        // Generate unique filename
        const timestamp = Date.now();
        const safeSlug = (article.slug || article.title)
          .toLowerCase()
          .replace(/[^a-z0-9]+/g, "-")
          .replace(/(^-|-$)/g, "")
          .substring(0, 50);
        const fileName = `${safeSlug}-${timestamp}.jpg`;

        // Upload to storage
        const { error: uploadError } = await supabase.storage
          .from("blog-images")
          .upload(fileName, bytes, {
            contentType: "image/jpeg",
            upsert: false,
          });

        if (uploadError) {
          console.error(`Upload failed for ${article.title}:`, uploadError);
          results.push({ id: article.id, title: article.title, status: "failed", error: uploadError.message });
          continue;
        }

        // Get public URL
        const { data: urlData } = supabase.storage
          .from("blog-images")
          .getPublicUrl(fileName);

        const publicUrl = urlData.publicUrl;

        // Update article in database
        const { error: updateError } = await supabase
          .from("blog_articles")
          .update({ image_url: publicUrl })
          .eq("id", article.id);

        if (updateError) {
          results.push({ id: article.id, title: article.title, status: "failed", error: updateError.message });
          continue;
        }

        results.push({ id: article.id, title: article.title, status: "success", imageUrl: publicUrl });
        console.log(`Successfully updated: ${article.title}`);

        // Small delay to avoid rate limiting
        await new Promise(resolve => setTimeout(resolve, 2000));
      } catch (error: any) {
        console.error(`Error processing ${article.title}:`, error);
        results.push({ id: article.id, title: article.title, status: "failed", error: error.message });
      }
    }

    return new Response(
      JSON.stringify({ 
        message: `Processed ${results.length} articles`,
        results 
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      }
    );
  } catch (error: any) {
    console.error("Error fixing blog images:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
