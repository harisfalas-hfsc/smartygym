import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { Image } from "https://deno.land/x/imagescript@1.2.17/mod.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

/**
 * Generates the cover image for a workout a member shared with the community.
 * Called by the database when `is_shared` first becomes true, so the image is
 * produced even if the member closes the app straight after sharing.
 */
serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const run = async () => {
    const { workout_id } = await req.json();
    if (!workout_id || typeof workout_id !== "string") {
      throw new Error("workout_id is required");
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const { data: workout, error } = await supabase
      .from("user_custom_workouts")
      .select("id, name, category, format, difficulty_stars, image_url, is_shared")
      .eq("id", workout_id)
      .maybeSingle();

    if (error) throw error;
    if (!workout) throw new Error(`Workout not found: ${workout_id}`);
    if (workout.image_url || !workout.is_shared) {
      return { skipped: true };
    }

    const difficultyLabel =
      workout.difficulty_stars > 4 ? "advanced" : workout.difficulty_stars > 2 ? "intermediate" : "beginner";

    const imagePrompt = `Create a professional fitness workout cover image.

CRITICAL REQUIREMENT: Generate ONLY a photograph with NO TEXT whatsoever. Absolutely NO words, NO labels, NO titles, NO overlays, NO watermarks, NO captions of any kind. Pure photography only.

Visual Direction:
- Show a dynamic ${difficultyLabel}-level fitness scene that captures the energy of "${workout.name}"
- The exercise style should visually reflect ${(workout.category ?? "general fitness").toLowerCase()} training with ${(workout.format ?? "structured").toLowerCase()} workout energy
- High-energy, professional fitness photography in a gym, outdoor, or home workout setting
- Clean, vibrant colors with excellent lighting
- 16:9 landscape aspect ratio suitable for a cover image

Remember: ZERO text or writing of any kind on the image.`;

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY not configured");

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash-image-preview",
        messages: [{ role: "user", content: imagePrompt }],
        modalities: ["image", "text"],
      }),
    });

    if (!response.ok) {
      throw new Error(`AI gateway error: ${response.status} ${await response.text()}`);
    }

    const data = await response.json();
    const imageBase64 = data.choices?.[0]?.message?.images?.[0]?.image_url?.url;
    if (!imageBase64) throw new Error("No image generated");

    const base64Data = imageBase64.replace(/^data:image\/\w+;base64,/, "");
    const originalBuffer = Uint8Array.from(atob(base64Data), (c) => c.charCodeAt(0));

    let uploadBuffer: Uint8Array = originalBuffer;
    let uploadExt = "png";
    let uploadContentType = "image/png";

    try {
      const decoded = await Image.decode(originalBuffer);
      if (decoded.width > 800) decoded.resize(800, Image.RESIZE_AUTO);
      uploadBuffer = await decoded.encodeJPEG(82);
      uploadExt = "jpg";
      uploadContentType = "image/jpeg";
    } catch (optErr) {
      console.warn("[shared-cover] optimization failed, keeping PNG:", optErr);
    }

    const fileName = `shared-workout-${Date.now()}-${Math.random().toString(36).substring(7)}.${uploadExt}`;
    const { error: uploadError } = await supabase.storage
      .from("avatars")
      .upload(`workout-covers/${fileName}`, uploadBuffer, {
        contentType: uploadContentType,
        upsert: false,
      });
    if (uploadError) throw uploadError;

    const { data: urlData } = supabase.storage
      .from("avatars")
      .getPublicUrl(`workout-covers/${fileName}`);

    await supabase
      .from("user_custom_workouts")
      .update({ image_url: urlData.publicUrl })
      .eq("id", workout.id);

    console.log("[shared-cover] image ready:", urlData.publicUrl);
    return { image_url: urlData.publicUrl };
  };

  try {
    const result = await run();
    return new Response(JSON.stringify({ success: true, ...result }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("[shared-cover] failed:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : String(error) }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
