import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";
import Stripe from "https://esm.sh/stripe@18.5.0";
import { requireAdminOrServiceRole } from "../_shared/admin-or-service-auth.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

function logStep(step: string, details?: any) {
  const detailsStr = details ? ` - ${JSON.stringify(details)}` : '';
  console.log(`[REPAIR-STRIPE-METADATA] ${step}${detailsStr}`);
}

// Determine content_type based on workout type/category
function getContentType(item: any, isProgram: boolean): string {
  if (isProgram) return "Training Program";
  
  // Check for micro-workouts
  if (item.type === "MICRO-WORKOUTS" || item.category === "MICRO-WORKOUTS") {
    return "Micro-Workout";
  }
  
  // Check for WOD
  if (item.is_workout_of_day || item.type === "WOD") {
    return "Workout";
  }
  
  // Default to Workout
  return "Workout";
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const authError = await requireAdminOrServiceRole(req, corsHeaders);
  if (authError) return authError;

  const startTime = Date.now();
  
  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const stripeKey = Deno.env.get("STRIPE_SECRET_KEY");

    if (!stripeKey) {
      throw new Error("STRIPE_SECRET_KEY not configured");
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);
    const stripe = new Stripe(stripeKey, { apiVersion: "2025-08-27.basil" });

    logStep("Starting automatic Stripe metadata repair");

    // Fetch ALL workouts (including those with NULL stripe_product_id to create products for them)
    const { data: workoutsWithId, error: workoutsError } = await supabase
      .from("admin_workouts")
      .select("id, name, stripe_product_id, stripe_price_id, type, category, is_workout_of_day, image_url, price, description")
      .not("stripe_product_id", "is", null);

    if (workoutsError) {
      throw new Error(`Failed to fetch workouts: ${workoutsError.message}`);
    }

    // Fetch workouts with NULL stripe_product_id (need to create products)
    const { data: workoutsWithoutId, error: workoutsNullError } = await supabase
      .from("admin_workouts")
      .select("id, name, stripe_product_id, stripe_price_id, type, category, is_workout_of_day, image_url, price, description, is_standalone_purchase")
      .is("stripe_product_id", null)
      .eq("is_standalone_purchase", true);

    if (workoutsNullError) {
      throw new Error(`Failed to fetch workouts without stripe: ${workoutsNullError.message}`);
    }

    // Fetch ALL programs (including those with NULL stripe_product_id)
    const { data: programsWithId, error: programsError } = await supabase
      .from("admin_training_programs")
      .select("id, name, stripe_product_id, stripe_price_id, category, image_url, price, description")
      .not("stripe_product_id", "is", null);

    if (programsError) {
      throw new Error(`Failed to fetch programs: ${programsError.message}`);
    }

    // Fetch programs with NULL stripe_product_id (need to create products)
    const { data: programsWithoutId, error: programsNullError } = await supabase
      .from("admin_training_programs")
      .select("id, name, stripe_product_id, stripe_price_id, category, image_url, price, description, is_standalone_purchase")
      .is("stripe_product_id", null)
      .eq("is_standalone_purchase", true);

    if (programsNullError) {
      throw new Error(`Failed to fetch programs without stripe: ${programsNullError.message}`);
    }

    const workouts = workoutsWithId || [];
    const programs = programsWithId || [];
    const workoutsNeedingProduct = workoutsWithoutId || [];
    const programsNeedingProduct = programsWithoutId || [];

    logStep("Fetched items", { 
      workoutsWithStripe: workouts.length, 
      workoutsNeedingProduct: workoutsNeedingProduct.length,
      programsWithStripe: programs.length,
      programsNeedingProduct: programsNeedingProduct.length
    });

    const results = {
      fixed: 0,
      alreadyCorrect: 0,
      recreated: 0,
      created: 0,
      errors: [] as string[],
      details: [] as { name: string; action: string; productId: string }[]
    };

    // PHASE 1: Create products for workouts that have NULL stripe_product_id
    for (const workout of workoutsNeedingProduct) {
      try {
        const contentType = getContentType(workout, false);
        logStep(`Creating NEW product for workout`, { name: workout.name });
        
        const newProduct = await stripe.products.create({
          name: workout.name,
          description: workout.description || `${workout.category || workout.type} Workout`,
          images: workout.image_url ? [workout.image_url] : [],
          metadata: {
            project: "SMARTYGYM",
            content_type: contentType,
            content_id: workout.id
          }
        });

        const newPrice = await stripe.prices.create({
          product: newProduct.id,
          unit_amount: Math.round((workout.price || 3.99) * 100),
          currency: "eur"
        });

        const { error: updateError } = await supabase
          .from("admin_workouts")
          .update({
            stripe_product_id: newProduct.id,
            stripe_price_id: newPrice.id
          })
          .eq("id", workout.id);

        if (updateError) {
          results.errors.push(`Failed to update DB for new ${workout.name}: ${updateError.message}`);
        } else {
          results.created++;
          results.details.push({
            name: workout.name,
            action: "created_new",
            productId: newProduct.id
          });
          logStep(`Created NEW product`, { 
            name: workout.name, 
            productId: newProduct.id,
            priceId: newPrice.id
          });
        }
      } catch (err: any) {
        results.errors.push(`New Workout ${workout.name}: ${err.message}`);
        logStep(`Error creating workout product`, { name: workout.name, error: err.message });
      }
    }

    // PHASE 2: Create products for programs that have NULL stripe_product_id
    for (const program of programsNeedingProduct) {
      try {
        logStep(`Creating NEW product for program`, { name: program.name });
        
        const newProduct = await stripe.products.create({
          name: program.name,
          description: program.description || `${program.category} Training Program`,
          images: program.image_url ? [program.image_url] : [],
          metadata: {
            project: "SMARTYGYM",
            content_type: "Training Program",
            content_id: program.id
          }
        });

        const newPrice = await stripe.prices.create({
          product: newProduct.id,
          unit_amount: Math.round((program.price || 9.99) * 100),
          currency: "eur"
        });

        const { error: updateError } = await supabase
          .from("admin_training_programs")
          .update({
            stripe_product_id: newProduct.id,
            stripe_price_id: newPrice.id
          })
          .eq("id", program.id);

        if (updateError) {
          results.errors.push(`Failed to update DB for new program ${program.name}: ${updateError.message}`);
        } else {
          results.created++;
          results.details.push({
            name: program.name,
            action: "created_new",
            productId: newProduct.id
          });
          logStep(`Created NEW program product`, { 
            name: program.name, 
            productId: newProduct.id
          });
        }
      } catch (err: any) {
        results.errors.push(`New Program ${program.name}: ${err.message}`);
        logStep(`Error creating program product`, { name: program.name, error: err.message });
      }
    }

    // PHASE 3: Process workouts that already have stripe_product_id (fix metadata/recreate)
    for (const workout of (workouts || [])) {
      try {
        const contentType = getContentType(workout, false);
        let product: Stripe.Product;
        
        try {
          product = await stripe.products.retrieve(workout.stripe_product_id);
        } catch (retrieveError: any) {
          // Product doesn't exist in Stripe - need to recreate
          logStep(`Product not found, recreating`, { 
            name: workout.name, 
            oldProductId: workout.stripe_product_id 
          });
          
          // Create new product
          const newProduct = await stripe.products.create({
            name: workout.name,
            description: workout.description || `${workout.category} Workout`,
            images: workout.image_url ? [workout.image_url] : [],
            metadata: {
              project: "SMARTYGYM",
              content_type: contentType,
              content_id: workout.id
            }
          });

          // Create new price
          const newPrice = await stripe.prices.create({
            product: newProduct.id,
            unit_amount: Math.round((workout.price || 3.99) * 100),
            currency: "eur"
          });

          // Update database with new IDs
          const { error: updateError } = await supabase
            .from("admin_workouts")
            .update({
              stripe_product_id: newProduct.id,
              stripe_price_id: newPrice.id
            })
            .eq("id", workout.id);

          if (updateError) {
            results.errors.push(`Failed to update DB for ${workout.name}: ${updateError.message}`);
          } else {
            results.recreated++;
            results.details.push({
              name: workout.name,
              action: "recreated",
              productId: newProduct.id
            });
            logStep(`Recreated product`, { 
              name: workout.name, 
              newProductId: newProduct.id,
              newPriceId: newPrice.id
            });
          }
          continue;
        }

        // Product exists - check if metadata is correct
        const hasCorrectProject = product.metadata?.project === "SMARTYGYM";
        const hasCorrectContentType = product.metadata?.content_type === contentType;

        if (hasCorrectProject && hasCorrectContentType) {
          results.alreadyCorrect++;
          continue;
        }

        // Fix metadata
        await stripe.products.update(workout.stripe_product_id, {
          metadata: {
            ...product.metadata,
            project: "SMARTYGYM",
            content_type: contentType,
            content_id: workout.id
          }
        });

        results.fixed++;
        results.details.push({
          name: workout.name,
          action: "fixed_metadata",
          productId: workout.stripe_product_id
        });
        logStep(`Fixed metadata`, { name: workout.name, contentType });

      } catch (err: any) {
        results.errors.push(`Workout ${workout.name}: ${err.message}`);
        logStep(`Error processing workout`, { name: workout.name, error: err.message });
      }
    }

    // PHASE 4: Process programs that already have stripe_product_id (fix metadata/recreate)
    for (const program of (programs || [])) {
      try {
        const contentType = "Training Program";
        let product: Stripe.Product;
        
        try {
          product = await stripe.products.retrieve(program.stripe_product_id);
        } catch (retrieveError: any) {
          // Product doesn't exist - recreate
          logStep(`Program product not found, recreating`, { 
            name: program.name, 
            oldProductId: program.stripe_product_id 
          });
          
          const newProduct = await stripe.products.create({
            name: program.name,
            description: program.description || `${program.category} Training Program`,
            images: program.image_url ? [program.image_url] : [],
            metadata: {
              project: "SMARTYGYM",
              content_type: contentType,
              content_id: program.id
            }
          });

          const newPrice = await stripe.prices.create({
            product: newProduct.id,
            unit_amount: Math.round((program.price || 9.99) * 100),
            currency: "eur"
          });

          const { error: updateError } = await supabase
            .from("admin_training_programs")
            .update({
              stripe_product_id: newProduct.id,
              stripe_price_id: newPrice.id
            })
            .eq("id", program.id);

          if (updateError) {
            results.errors.push(`Failed to update DB for program ${program.name}: ${updateError.message}`);
          } else {
            results.recreated++;
            results.details.push({
              name: program.name,
              action: "recreated",
              productId: newProduct.id
            });
          }
          continue;
        }

        // Check metadata
        const hasCorrectProject = product.metadata?.project === "SMARTYGYM";
        const hasCorrectContentType = product.metadata?.content_type === contentType;

        if (hasCorrectProject && hasCorrectContentType) {
          results.alreadyCorrect++;
          continue;
        }

        // Fix metadata
        await stripe.products.update(program.stripe_product_id, {
          metadata: {
            ...product.metadata,
            project: "SMARTYGYM",
            content_type: contentType,
            content_id: program.id
          }
        });

        results.fixed++;
        results.details.push({
          name: program.name,
          action: "fixed_metadata",
          productId: program.stripe_product_id
        });
        logStep(`Fixed program metadata`, { name: program.name });

      } catch (err: any) {
        results.errors.push(`Program ${program.name}: ${err.message}`);
        logStep(`Error processing program`, { name: program.name, error: err.message });
      }
    }

    const duration = Date.now() - startTime;
    
    logStep("Repair complete", {
      duration_ms: duration,
      created: results.created,
      fixed: results.fixed,
      recreated: results.recreated,
      alreadyCorrect: results.alreadyCorrect,
      errors: results.errors.length
    });

    return new Response(
      JSON.stringify({
        success: true,
        duration_ms: duration,
        created: results.created,
        fixed: results.fixed,
        recreated: results.recreated,
        alreadyCorrect: results.alreadyCorrect,
        errors: results.errors,
        details: results.details
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200 }
    );

  } catch (error: any) {
    logStep("FATAL ERROR", { error: error.message });
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: error.message 
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 500 }
    );
  }
});
