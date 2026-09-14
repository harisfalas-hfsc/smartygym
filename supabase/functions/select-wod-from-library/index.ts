import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import Stripe from "https://esm.sh/stripe@18.5.0";
import { getDayIn84Cycle, getPeriodizationForDay } from "../_shared/periodization-84day.ts";
import { validateWodPublishContract } from "../_shared/wod-integrity.ts";
import { requireServiceRole } from "../_shared/cron-auth.ts";
import { freezeGuard } from "../_shared/system-freeze.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const WOD_PRICE_EUR = 3.99;

/**
 * Ensure a library workout has a valid Stripe product + default price linked
 * before being promoted to WOD. If anything is missing, create it now.
 * Returns { stripeProductId, stripePriceId } or throws.
 */
async function ensureWodStripeAssociation(
  supabase: any,
  stripe: Stripe,
  workout: any,
  effectiveDate: string,
) {
  let productId: string | null = workout.stripe_product_id || null;
  let priceId: string | null = workout.stripe_price_id || null;
  const productImage = workout.image_url && workout.image_url.startsWith("https://") ? workout.image_url : null;

  if (!productImage) {
    throw new Error(`Library WOD ${workout.id} has no valid image_url; refusing to create a product without a picture`);
  }

  // 1. Validate or create product
  if (productId) {
    try {
      const product = await stripe.products.retrieve(productId);
      if (!product.active || !product.images?.includes(productImage)) {
        await stripe.products.update(productId, {
          active: true,
          images: [productImage],
          metadata: {
            ...product.metadata,
            project: "SMARTYGYM",
            content_type: "Workout",
            type: "wod",
            workout_id: workout.id,
            content_id: workout.id,
            equipment: workout.equipment || "",
            generated_for_date: effectiveDate,
            source: "select-wod-from-library",
          },
        });
      }
    } catch (e) {
      logStep("Existing stripe_product_id invalid - will recreate", { id: workout.id, error: (e as Error).message });
      productId = null;
      priceId = null;
    }
  }

  if (!productId) {
    const product = await stripe.products.create({
      name: workout.name,
      description: `SMARTYGYM Workout of the Day — ${workout.equipment || ""} ${workout.category || ""} ${workout.format || ""}`.trim(),
      images: [productImage],
      metadata: {
        project: "SMARTYGYM",
        content_type: "Workout",
        type: "wod",
        workout_id: workout.id,
        content_id: workout.id,
        equipment: workout.equipment || "",
        generated_for_date: effectiveDate,
        source: "select-wod-from-library",
      },
    }, {
      idempotencyKey: `SMARTYGYM:wod:${workout.id}:product`,
    });
    productId = product.id;
  }

  // 2. Validate or create price
  if (priceId) {
    try {
      const price = await stripe.prices.retrieve(priceId);
      if (!price.active || price.product !== productId) {
        priceId = null;
      }
    } catch (e) {
      logStep("Existing stripe_price_id invalid - will recreate", { id: workout.id, error: (e as Error).message });
      priceId = null;
    }
  }

  if (!priceId) {
    const price = await stripe.prices.create({
      product: productId,
      unit_amount: Math.round(WOD_PRICE_EUR * 100),
      currency: "eur",
      metadata: {
        project: "SMARTYGYM",
        content_type: "Workout",
        type: "wod",
        workout_id: workout.id,
        content_id: workout.id,
        equipment: workout.equipment || "",
        generated_for_date: effectiveDate,
        source: "select-wod-from-library",
      },
    }, {
      idempotencyKey: `SMARTYGYM:wod:${workout.id}:price:${Math.round(WOD_PRICE_EUR * 100)}:eur`,
    });
    priceId = price.id;

    await stripe.products.update(productId, { default_price: priceId });
  }

  const finalProduct = await stripe.products.retrieve(productId);
  const defaultPriceId = typeof finalProduct.default_price === "string"
    ? finalProduct.default_price
    : finalProduct.default_price?.id;
  if (defaultPriceId !== priceId || !finalProduct.images?.includes(productImage)) {
    await stripe.products.update(productId, {
      default_price: priceId,
      images: [productImage],
    });
  }

  return { stripeProductId: productId, stripePriceId: priceId };
}

function logStep(step: string, details?: any) {
  const detailsStr = details ? ` - ${JSON.stringify(details)}` : '';
  console.log(`[SELECT-WOD-FROM-LIBRARY] ${step}${detailsStr}`);
}

function getCyprusDateStr(): string {
  const now = new Date();
  const cyprusFormatter = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/Athens",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
  return cyprusFormatter.format(now);
}

function getCyprusDateOffsetStr(daysAhead: number): string {
  const now = new Date();
  const offset = new Date(now.getTime() + daysAhead * 24 * 60 * 60 * 1000);
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/Athens",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(offset);
}

// Same forbidden-name patterns enforced by the DB trigger
// `validate_public_workout_integrity`. We pre-filter candidates here so we
// never burn promotion attempts on workouts the trigger will reject.
const FORBIDDEN_NAME_PATTERNS: RegExp[] = [
  /\d/,
  /\b\d{4}(BW|EQ|V)\b$/i,
  /\b\d{6,}\b$/,
  /\b(v\d+|#\d+)\b$/i,
  /\b(II|III|IV|V|VI|VII|VIII|IX|X)\b$/,
  /\b(axial|matrix|meridian|protocol|helix|arcus|synergy|conduit|integration|current|vector|quantum|algorithm|neural|system|module|phase|sequence)\b/i,
];
function hasForbiddenPublicName(name?: string | null): boolean {
  if (!name) return true;
  const trimmed = name.trim();
  return FORBIDDEN_NAME_PATTERNS.some((re) => re.test(trimmed));
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const unauthorized = requireServiceRole(req, corsHeaders);
    if (unauthorized) return unauthorized;

    const frozen = await freezeGuard(corsHeaders, "select-wod-from-library");
    if (frozen) return frozen;

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);
    const stripeKey = Deno.env.get("STRIPE_SECRET_KEY") || "";
    const stripe = new Stripe(stripeKey, { apiVersion: "2025-08-27.basil" as any });

    // Determine target date in Cyprus timezone. Scheduled WOD picker jobs must
    // pre-build TOMORROW by default; explicit targetDate/date still wins for
    // watchdog, admin, and repair invocations.
    let targetDate: string;
    let parsedBody: any = {};
    try {
      parsedBody = await req.json();
      const daysAhead = Number.isFinite(Number(parsedBody?.daysAhead)) ? Number(parsedBody.daysAhead) : 1;
      targetDate = parsedBody?.targetDate || parsedBody?.date || getCyprusDateOffsetStr(daysAhead);
    } catch {
      targetDate = getCyprusDateOffsetStr(1);
    }

    logStep("Starting library selection", { targetDate });

    // Get periodization for today
    const dayIn84 = getDayIn84Cycle(targetDate);
    const periodization = getPeriodizationForDay(dayIn84);
    const isRecoveryDay = periodization.category === "RECOVERY";

    logStep("Periodization", {
      dayIn84,
      category: periodization.category,
      difficulty: periodization.difficulty,
      difficultyStars: periodization.difficultyStars,
      strengthFocus: periodization.strengthFocus,
      isRecoveryDay,
    });

    // Check which WOD slots already exist for the target date.
    // SLOT-AWARE: do NOT skip the whole day if one slot is filled —
    // fill only the missing slot(s). This is what watchdog/repair relies on.
    const { data: existingWods } = await supabase
      .from("admin_workouts")
      .select("id, name, equipment")
      .eq("is_workout_of_day", true)
      .eq("generated_for_date", targetDate);

    const existingEquipments = new Set(
      (existingWods || []).map((w: any) => (w.equipment || "").toUpperCase())
    );

    const requiredSlots = isRecoveryDay
      ? (existingEquipments.has("VARIOUS") ? [] : ["VARIOUS"])
      : (() => {
          const need: string[] = [];
          if (!existingEquipments.has("BODYWEIGHT")) need.push("BODYWEIGHT");
          if (!existingEquipments.has("EQUIPMENT")) need.push("EQUIPMENT");
          return need;
        })();

    if (requiredSlots.length === 0) {
      logStep("All WOD slots already filled for date, skipping", {
        count: (existingWods || []).length,
        equipments: Array.from(existingEquipments),
      });
      return new Response(
        JSON.stringify({
          success: true,
          skipped: true,
          message: `All WOD slots already filled for ${targetDate}`,
          existing: (existingWods || []).map((w: any) => w.name),
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200 }
      );
    }

    logStep("Slots to fill", { requiredSlots, alreadyFilled: Array.from(existingEquipments) });

    // EXHAUSTION-FIRST ROTATION:
    // `wod_selection_cooldown` is treated as a permanent "ever-used" ledger.
    // A workout is only re-picked once every other eligible workout in the
    // same {category,equipment} slot has been used at least once. When the
    // slot is fully exhausted we restart from the least-recently-used.
    // New workouts the admin adds appear immediately because the candidate
    // pool is queried LIVE every invocation (no cache, no snapshot).
    const { data: cooldownWorkouts } = await supabase
      .from("wod_selection_cooldown")
      .select("source_workout_id, selected_for_date")
      .order("selected_for_date", { ascending: true });

    const cooldownIds = new Set((cooldownWorkouts || []).map(c => c.source_workout_id));
    const lastUsedAt = new Map<string, string>();
    for (const row of (cooldownWorkouts || [])) {
      lastUsedAt.set(row.source_workout_id, row.selected_for_date);
    }
    logStep("Ever-used ledger loaded", { uniqueIds: cooldownIds.size });

    const selectedWorkouts: any[] = [];

    for (const slot of requiredSlots) {
      const isRecoverySlot = slot === "VARIOUS";
      const candidates = await selectWorkoutCandidates(supabase, {
        category: isRecoverySlot ? "RECOVERY" : periodization.category,
        difficulty: isRecoverySlot ? null : periodization.difficulty,
        difficultyStars: isRecoverySlot ? null : periodization.difficultyStars,
        equipment: isRecoverySlot ? null : slot,
        cooldownIds,
        lastUsedAt,
        strengthFocus: isRecoverySlot ? null : (periodization.strengthFocus || null),
        targetDate,
      });
      if (candidates && candidates.length > 0) {
        selectedWorkouts.push({ slot, candidates });
      } else {
        logStep(`WARNING: No ${slot} workout found for`, {
          category: isRecoverySlot ? "RECOVERY" : periodization.category,
          difficulty: isRecoverySlot ? null : periodization.difficulty,
        });
      }
    }

    if (selectedWorkouts.length === 0) {
      logStep("ERROR: No workouts found in library matching criteria");
      return new Response(
        JSON.stringify({
          success: false,
          error: "No matching workouts found in library",
          criteria: {
            category: periodization.category,
            difficulty: periodization.difficulty,
            isRecoveryDay,
          },
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 404 }
      );
    }

    let promotedCount = 0;
    const finallyPromoted: any[] = [];

    // Iterate slots; for each slot try candidates in order until one passes
    // the publish contract. This protects against pre-existing data quality
    // issues in older library workouts (missing density, raw placeholders, etc.)
    for (const slotEntry of selectedWorkouts) {
      const { slot, candidates } = slotEntry as { slot: string; candidates: any[] };
      logStep(`Trying slot ${slot} with ${candidates.length} candidate(s)`);
      let slotPromoted = false;

      for (const workout of candidates) {
        if (slotPromoted) break;
      // Guarantee a valid Stripe product + price BEFORE promoting to WOD
      let stripeProductId: string;
      let stripePriceId: string;
      try {
        const association = await ensureWodStripeAssociation(supabase, stripe, workout, targetDate);
        stripeProductId = association.stripeProductId;
        stripePriceId = association.stripePriceId;
      } catch (assocError) {
        logStep("ERROR ensuring Stripe association - skipping promotion", {
          id: workout.id,
          error: (assocError as Error).message,
        });
        continue;
      }

      const { error: updateError } = await supabase
        .from("admin_workouts")
        .update({
          is_workout_of_day: true,
          generated_for_date: targetDate,
          wod_source: "library",
          is_free: false,
          is_premium: true,
          is_standalone_purchase: true,
          price: WOD_PRICE_EUR,
          stripe_product_id: stripeProductId,
          stripe_price_id: stripePriceId,
          updated_at: new Date().toISOString(),
        })
        .eq("id", workout.id);

      if (updateError) {
        logStep("ERROR flagging workout as WOD", { id: workout.id, error: updateError.message });
        continue;
      }

      // Re-fetch the row and apply the shared WOD publish contract.
      // Library fallback is NOT allowed to publish anything that would
      // not pass the same gate as a freshly generated WOD.
      const { data: postRow } = await supabase
        .from("admin_workouts")
        .select("id, name, equipment, category, is_workout_of_day, is_visible, main_workout, description, instructions, tips, image_url, is_standalone_purchase, price, stripe_product_id, stripe_price_id, generated_for_date")
        .eq("id", workout.id)
        .single();
      const contract = validateWodPublishContract(postRow || {}, targetDate);
      if (!contract.ok) {
        logStep("REJECT: library candidate failed publish contract - rolling back", {
          id: workout.id,
          failures: contract.failures,
        });
        await supabase
          .from("admin_workouts")
          .update({
            is_workout_of_day: false,
            generated_for_date: null,
            wod_source: null,
            updated_at: new Date().toISOString(),
          })
          .eq("id", workout.id);
        // Don't burn the slot for a workout that didn't actually publish:
        // remove any cooldown record from a stale prior attempt today.
        await supabase
          .from("wod_selection_cooldown")
          .delete()
          .eq("source_workout_id", workout.id)
          .eq("selected_for_date", targetDate);
        continue;
      }

      logStep("Flagged workout as WOD with payment links", {
        id: workout.id,
        name: workout.name,
        equipment: workout.equipment,
        stripeProductId,
        stripePriceId,
      });
      promotedCount++;
      slotPromoted = true;
      finallyPromoted.push(postRow);

      // Insert cooldown record for the workout we just promoted
      await supabase.from("wod_selection_cooldown").insert({
        source_workout_id: workout.id,
        selected_for_date: targetDate,
        category: workout.category || periodization.category,
        difficulty: workout.difficulty,
        equipment: workout.equipment,
      });
      } // end candidate loop

      if (!slotPromoted) {
        logStep(`SLOT FAILED: no usable candidate for ${slot} after trying ${candidates.length}`);
      }
    } // end slot loop

    const expectedCount = requiredSlots.length;
    if (promotedCount < expectedCount) {
      // ALL-OR-NONE: if we could not complete every required slot, roll back
      // the ones we already promoted in this run so the day never goes live
      // with a half-published WOD set. Without this, a partial promote leaked
      // into production (e.g. one Pilates BODYWEIGHT WOD with no matching
      // EQUIPMENT WOD) and the watchdog had no signal to fix it.
      for (const promoted of finallyPromoted) {
        try {
          await supabase
            .from("admin_workouts")
            .update({
              is_workout_of_day: false,
              generated_for_date: null,
              wod_source: null,
              updated_at: new Date().toISOString(),
            })
            .eq("id", promoted.id);
          await supabase
            .from("wod_selection_cooldown")
            .delete()
            .eq("source_workout_id", promoted.id)
            .eq("selected_for_date", targetDate);
          logStep("Rolled back partial promotion (all-or-none)", {
            id: promoted.id,
            equipment: promoted.equipment,
          });
        } catch (rollbackErr) {
          logStep("ERROR during partial-promotion rollback", {
            id: promoted.id,
            error: (rollbackErr as Error).message,
          });
        }
      }

      await supabase.from("wod_generation_runs").insert({
        cyprus_date: targetDate,
        status: "failed",
        expected_count: expectedCount,
        found_count: 0,
        is_recovery_day: isRecoveryDay,
        expected_category: periodization.category,
        trigger_source: "library-selection",
        completed_at: new Date().toISOString(),
        error_message: `Library fallback could only fill ${promotedCount}/${expectedCount} slot(s) (${requiredSlots.join(", ")}); rolled back to keep day all-or-none`,
      });

      throw new Error(`Library fallback promoted ${promotedCount}/${expectedCount} WOD slot(s) (${requiredSlots.join(", ")}); rolled back partial publish to enforce all-or-none`);
    }

    // Log to wod_generation_runs
    await supabase.from("wod_generation_runs").insert({
      cyprus_date: targetDate,
      status: "success",
      expected_count: expectedCount,
      found_count: promotedCount,
      is_recovery_day: isRecoveryDay,
      expected_category: periodization.category,
      trigger_source: "library-selection",
      completed_at: new Date().toISOString(),
      wods_created: finallyPromoted.map(w => ({
        id: w.id,
        name: w.name,
        equipment: w.equipment,
        source: "library",
      })),
    });

    // NOTE: Do NOT trigger any WOD-only notification here.
    // User-facing daily notifications are sent EXCLUSIVELY by the combined
    // `send-morning-notifications` job (07:00 Cyprus / 05:00 UTC), which
    // delivers the Workout of the Day and the Daily Smarty Ritual together
    // in a single email + dashboard message.

    logStep("Library selection complete", {
      selectedCount: finallyPromoted.length,
      workouts: finallyPromoted.map(w => `${w.name} (${w.equipment})`),
    });

    return new Response(
      JSON.stringify({
        success: true,
        mode: "library-selection",
        date: targetDate,
        periodization: {
          dayIn84,
          category: periodization.category,
          difficulty: periodization.difficulty,
          strengthFocus: periodization.strengthFocus,
        },
        selected: finallyPromoted.map(w => ({
          id: w.id,
          name: w.name,
          equipment: w.equipment,
          category: w.category,
        })),
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200 }
    );
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    logStep("ERROR", { message: errorMessage });
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 500 }
    );
  }
});

/**
 * Select a workout from the library matching the given criteria.
 * First tries exact match (category + difficulty + equipment).
 * If strengthFocus is provided, tries to match focus first then falls back.
 * If all candidates are in cooldown, picks the one used longest ago.
 */
async function selectWorkout(
  supabase: any,
  params: {
    category: string;
    difficulty: string | null;
    difficultyStars: [number, number] | null;
    equipment: string | null;
    cooldownIds: Set<string>;
    lastUsedAt?: Map<string, string>;
    strengthFocus: string | null;
    targetDate?: string;
  }
): Promise<any | null> {
  const list = await selectWorkoutCandidates(supabase, params);
  return list && list.length > 0 ? list[0] : null;
}

/**
 * Like selectWorkout but returns a *prioritised list* of all valid candidates,
 * highest-priority first. The caller can then iterate and skip any that fail
 * the publish contract — so a single broken library workout never fails the slot.
 */
async function selectWorkoutCandidates(
  supabase: any,
  params: {
    category: string;
    difficulty: string | null;
    difficultyStars: [number, number] | null;
    equipment: string | null;
    cooldownIds: Set<string>;
    lastUsedAt?: Map<string, string>;
    strengthFocus: string | null;
    targetDate?: string;
  }
): Promise<any[]> {
  const { category, difficulty, difficultyStars, equipment, cooldownIds, lastUsedAt, strengthFocus, targetDate } = params;

  logStep("Selecting candidate list", { category, difficulty, equipment, strengthFocus, cooldownSize: cooldownIds.size });

  // Build base query
  // HARD SAFETY FILTERS (never relax these):
  //  - is_workout_of_day = false  (don't reuse an active WOD)
  //  - is_visible        = true   (no hidden/unpublished drafts)
  //  - is_premium        = true   (only paid library workouts)
  //  - is_free           = false  (NEVER pick a free workout as WOD)
  //  - main_workout      not null (no broken/empty rows)
  //  - image_url starts with https:// (Stripe needs a real image)
  let query = supabase
    .from("admin_workouts")
    .select("*")
    .eq("category", category)
    .eq("is_workout_of_day", false)
    .eq("is_visible", true)
    .eq("is_premium", true)
    .eq("is_free", false)
    .not("main_workout", "is", null)
    .ilike("image_url", "https://%");

  // Filter by equipment if specified
  if (equipment) {
    query = query.eq("equipment", equipment);
  }

  // Filter by difficulty range using stars
  if (difficultyStars) {
    query = query.gte("difficulty_stars", difficultyStars[0]).lte("difficulty_stars", difficultyStars[1]);
  }

  const { data: candidates, error } = await query;

  if (error) {
    logStep("Error querying candidates", { error: error.message });
    return [];
  }

  const pool: any[] = candidates || [];

  // Filter candidates whose public name would be rejected by the DB
  // validation trigger. Doing this here prevents the slot from "failing"
  // simply because random shuffling kept landing on internal/AI-flavoured
  // names like "Helix", "Matrix", "Protocol", "Sequence" etc.
  const filtered = pool.filter((c) => !hasForbiddenPublicName(c.name));
  if (filtered.length < pool.length) {
    logStep("Filtered out candidates with forbidden public names", {
      total: pool.length,
      kept: filtered.length,
      dropped: pool.length - filtered.length,
    });
  }

  if (filtered.length === 0) {
    logStep("No candidates found with exact periodization filters; refusing difficulty fallback");
    return [];
  }

  // EXHAUSTION-FIRST: workouts never picked before in this slot go first
  // (shuffled). Only when every workout in the pool has been used at least
  // once do we recycle, and then we recycle the LEAST-RECENTLY-USED first.
  const neverUsed = filtered.filter(c => !cooldownIds.has(c.id));
  const alreadyUsed = filtered.filter(c => cooldownIds.has(c.id));

  // Optional focus prioritisation within never-used pool
  let prioritised = neverUsed;
  if (strengthFocus && neverUsed.length > 1) {
    const focusMatch = neverUsed.filter(c =>
      c.focus && c.focus.toUpperCase().includes(strengthFocus.toUpperCase())
    );
    if (focusMatch.length > 0) {
      const others = neverUsed.filter(c => !focusMatch.includes(c));
      prioritised = [...focusMatch, ...others];
    }
  }

  const shuffle = (arr: any[]) => arr.map(v => [Math.random(), v] as const).sort((a,b) => a[0]-b[0]).map(([,v]) => v);

  // Recycled pool: oldest-used first (least recently picked).
  const recycled = [...alreadyUsed].sort((a, b) => {
    const da = lastUsedAt?.get(a.id) || "0000-00-00";
    const db = lastUsedAt?.get(b.id) || "0000-00-00";
    return da.localeCompare(db); // ascending = oldest first
  });

  const ordered = [...shuffle(prioritised), ...recycled];
  const publishable = targetDate
    ? ordered.filter((candidate) => {
        const result = validateWodPublishContract({
          ...candidate,
          is_workout_of_day: true,
          generated_for_date: targetDate,
          is_standalone_purchase: true,
          price: WOD_PRICE_EUR,
        }, targetDate, { mode: "structural" });
        if (!result.ok) {
          logStep("Filtered out structurally unpublishable candidate", { id: candidate.id, name: candidate.name, failures: result.failures });
        }
        return result.ok;
      })
    : ordered;

  logStep("Candidate list built (exhaustion-first)", {
    total: publishable.length,
    neverUsed: neverUsed.length,
    recycled: recycled.length,
    structurallyRejected: ordered.length - publishable.length,
  });
  return publishable;
}

/**
 * Pick best candidate from a list, preferring those not in cooldown.
 * If strengthFocus is provided, prefer workouts matching that focus.
 */
async function pickFromCandidates(
  supabase: any,
  candidates: any[],
  cooldownIds: Set<string>,
  strengthFocus: string | null
): Promise<any | null> {
  // Split candidates: those outside cooldown vs inside
  const available = candidates.filter(c => !cooldownIds.has(c.id));
  const inCooldown = candidates.filter(c => cooldownIds.has(c.id));

  logStep("Candidate split", { available: available.length, inCooldown: inCooldown.length });

  let pool = available.length > 0 ? available : candidates;

  // If strengthFocus, try to match focus first
  if (strengthFocus && pool.length > 1) {
    const focusMatch = pool.filter(c => 
      c.focus && c.focus.toUpperCase().includes(strengthFocus.toUpperCase())
    );
    if (focusMatch.length > 0) {
      pool = focusMatch;
      logStep("Narrowed by strength focus", { focus: strengthFocus, count: pool.length });
    }
  }

  // If all candidates are in cooldown, pick the one used longest ago
  if (available.length === 0 && inCooldown.length > 0) {
    logStep("All candidates in cooldown, picking oldest-used");
    
    // Get cooldown records with dates to find the oldest
    const { data: cooldownRecords } = await supabase
      .from("wod_selection_cooldown")
      .select("source_workout_id, selected_for_date")
      .in("source_workout_id", candidates.map(c => c.id))
      .order("selected_for_date", { ascending: true });

    if (cooldownRecords && cooldownRecords.length > 0) {
      // Pick the candidate whose most recent cooldown entry is oldest
      const oldestId = cooldownRecords[0].source_workout_id;
      const oldest = candidates.find(c => c.id === oldestId);
      if (oldest) return oldest;
    }
  }

  // Random selection from available pool
  const randomIndex = Math.floor(Math.random() * pool.length);
  return pool[randomIndex];
}
