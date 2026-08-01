import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@14.21.0";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { requireAdminOrServiceRole } from "../_shared/admin-or-service-auth.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const logStep = (step: string, details?: any) => {
  const detailsStr = details ? ` - ${JSON.stringify(details)}` : '';
  console.log(`[PULL-STRIPE-IMAGES] ${step}${detailsStr}`);
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const authError = await requireAdminOrServiceRole(req, corsHeaders);
  if (authError) return authError;

  try {
    logStep("Starting pull-stripe-images function");

    const stripeKey = Deno.env.get("STRIPE_SECRET_KEY");
    if (!stripeKey) {
      throw new Error("STRIPE_SECRET_KEY is not set");
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    
    if (!supabaseUrl || !supabaseServiceKey) {
      throw new Error("Supabase environment variables not set");
    }

    const stripe = new Stripe(stripeKey, { apiVersion: "2023-10-16" });
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Fetch workouts with stripe_product_id and is_free
    const { data: workouts, error: workoutsError } = await supabase
      .from("admin_workouts")
      .select("id, name, stripe_product_id, image_url, is_free")
      .not("stripe_product_id", "is", null);
    
    // Helper to check if image_url is valid (supports full URLs and relative paths)
    const hasValidImageUrl = (url: string | null): boolean => {
      if (!url) return false;
      return url.startsWith("http") || url.startsWith("/");
    };
    
    // Filter to only PAID items missing valid website images (exclude free items)
    const workoutsMissingImages = (workouts || []).filter(w => 
      !w.is_free && !hasValidImageUrl(w.image_url)
    );

    if (workoutsError) {
      logStep("Error fetching workouts", { error: workoutsError });
      throw workoutsError;
    }

    // Fetch programs with stripe_product_id and is_free
    const { data: programs, error: programsError } = await supabase
      .from("admin_training_programs")
      .select("id, name, stripe_product_id, image_url, is_free")
      .not("stripe_product_id", "is", null);

    if (programsError) {
      logStep("Error fetching programs", { error: programsError });
      throw programsError;
    }
    
    // Filter to only PAID items missing valid website images (exclude free items)
    const programsMissingImages = (programs || []).filter(p => 
      !p.is_free && !hasValidImageUrl(p.image_url)
    );

    const skippedFreeWorkouts = (workouts || []).filter(w => w.is_free).length;
    const skippedFreePrograms = (programs || []).filter(p => p.is_free).length;

    logStep("Found items missing website images", {
      workouts: workoutsMissingImages.length,
      programs: programsMissingImages.length,
      skippedFreeWorkouts,
      skippedFreePrograms,
    });

    const results = {
      workouts_pulled: 0,
      programs_pulled: 0,
      skipped_free_items: skippedFreeWorkouts + skippedFreePrograms,
      errors: [] as string[],
    };

    // Process workouts missing images
    for (const workout of workoutsMissingImages) {
      if (!workout.stripe_product_id) continue;
      
      try {
        logStep(`Processing workout: ${workout.name}`, { id: workout.id });
        
        const product = await stripe.products.retrieve(workout.stripe_product_id);
        
        if (product.images && product.images.length > 0) {
          const stripeImageUrl = product.images[0];
          logStep(`Found Stripe image for workout`, { url: stripeImageUrl });

          // Download the image from Stripe
          const imageResponse = await fetch(stripeImageUrl);
          if (!imageResponse.ok) {
            throw new Error(`Failed to download image: ${imageResponse.status}`);
          }
          
          const imageBlob = await imageResponse.blob();
          const imageBuffer = await imageBlob.arrayBuffer();
          const imageBytes = new Uint8Array(imageBuffer);
          
          // Generate filename
          const extension = stripeImageUrl.includes('.png') ? 'png' : 'jpg';
          const fileName = `workout-covers/${workout.id}-${Date.now()}.${extension}`;
          
          // Upload to Supabase Storage
          const { error: uploadError } = await supabase.storage
            .from("avatars")
            .upload(fileName, imageBytes, {
              contentType: `image/${extension === 'png' ? 'png' : 'jpeg'}`,
              upsert: true,
            });

          if (uploadError) {
            throw new Error(`Upload failed: ${uploadError.message}`);
          }

          // Get public URL
          const { data: urlData } = supabase.storage
            .from("avatars")
            .getPublicUrl(fileName);

          const publicUrl = urlData.publicUrl;
          logStep(`Uploaded image to storage`, { publicUrl });

          // Update workout with new image_url
          const { error: updateError } = await supabase
            .from("admin_workouts")
            .update({ image_url: publicUrl })
            .eq("id", workout.id);

          if (updateError) {
            throw new Error(`Update failed: ${updateError.message}`);
          }

          results.workouts_pulled++;
          logStep(`Successfully pulled image for workout: ${workout.name}`);
        } else {
          logStep(`No Stripe image found for workout: ${workout.name}`);
        }
      } catch (error) {
        const errorMsg = error instanceof Error ? error.message : String(error);
        logStep(`Error processing workout ${workout.name}`, { error: errorMsg });
        results.errors.push(`Workout ${workout.name}: ${errorMsg}`);
      }
    }

    // Process programs missing images
    for (const program of programsMissingImages) {
      if (!program.stripe_product_id) continue;
      
      try {
        logStep(`Processing program: ${program.name}`, { id: program.id });
        
        const product = await stripe.products.retrieve(program.stripe_product_id);
        
        if (product.images && product.images.length > 0) {
          const stripeImageUrl = product.images[0];
          logStep(`Found Stripe image for program`, { url: stripeImageUrl });

          // Download the image from Stripe
          const imageResponse = await fetch(stripeImageUrl);
          if (!imageResponse.ok) {
            throw new Error(`Failed to download image: ${imageResponse.status}`);
          }
          
          const imageBlob = await imageResponse.blob();
          const imageBuffer = await imageBlob.arrayBuffer();
          const imageBytes = new Uint8Array(imageBuffer);
          
          // Generate filename
          const extension = stripeImageUrl.includes('.png') ? 'png' : 'jpg';
          const fileName = `program-covers/${program.id}-${Date.now()}.${extension}`;
          
          // Upload to Supabase Storage
          const { error: uploadError } = await supabase.storage
            .from("avatars")
            .upload(fileName, imageBytes, {
              contentType: `image/${extension === 'png' ? 'png' : 'jpeg'}`,
              upsert: true,
            });

          if (uploadError) {
            throw new Error(`Upload failed: ${uploadError.message}`);
          }

          // Get public URL
          const { data: urlData } = supabase.storage
            .from("avatars")
            .getPublicUrl(fileName);

          const publicUrl = urlData.publicUrl;
          logStep(`Uploaded image to storage`, { publicUrl });

          // Update program with new image_url
          const { error: updateError } = await supabase
            .from("admin_training_programs")
            .update({ image_url: publicUrl })
            .eq("id", program.id);

          if (updateError) {
            throw new Error(`Update failed: ${updateError.message}`);
          }

          results.programs_pulled++;
          logStep(`Successfully pulled image for program: ${program.name}`);
        } else {
          logStep(`No Stripe image found for program: ${program.name}`);
        }
      } catch (error) {
        const errorMsg = error instanceof Error ? error.message : String(error);
        logStep(`Error processing program ${program.name}`, { error: errorMsg });
        results.errors.push(`Program ${program.name}: ${errorMsg}`);
      }
    }

    logStep("Pull from Stripe completed", results);

    return new Response(JSON.stringify(results), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 200,
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    logStep("ERROR in pull-stripe-images", { message: errorMessage });
    return new Response(JSON.stringify({ error: errorMessage }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 500,
    });
  }
});
