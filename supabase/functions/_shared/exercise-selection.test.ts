import { assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";
import {
  applySelectionPolicy,
  isPriorityName,
  isSelectable,
  matchesCategoryPool,
  poolsOf,
  selectionTier,
} from "./exercise-selection.ts";

Deno.test("new common vocabulary resolves exact and live-library aliases", () => {
  for (const name of [
    "Air Squats",
    "suspension row",
    "butt kickers",
    "neutral grip chin up",
    "straight arm cable pulldown",
    "medicine ball slam",
    "Smith machine Romanian deadlift",
  ]) {
    assertEquals(isPriorityName(name), true, name);
  }
});

Deno.test("priority vocabulary remains preference rather than permission", () => {
  assertEquals(isPriorityName("pistol squat"), false);
  assertEquals(isPriorityName("Turkish get-up"), false);
  assertEquals(isPriorityName("Nordic hamstring curl"), false);
  assertEquals(isPriorityName("handstand push-up"), false);
  assertEquals(isSelectable("pistol squat"), false);
  assertEquals(isSelectable("Turkish get-up"), false);
  assertEquals(isSelectable("Nordic hamstring curl"), false);
});

Deno.test("equipment-aware pools distinguish functional kit and machines", () => {
  assertEquals(poolsOf("TRX row").includes("FREE_WEIGHT"), true);
  assertEquals(poolsOf("medicine ball rotational throw").includes("FREE_WEIGHT"), true);
  assertEquals(poolsOf("cable Pallof press").includes("MACHINE"), true);
  assertEquals(poolsOf("leg press").includes("MACHINE"), true);
});

Deno.test("category priority never promotes machines into conditioning", () => {
  assertEquals(matchesCategoryPool("leg press", "METABOLIC"), false);
  assertEquals(matchesCategoryPool("kettlebell swing", "METABOLIC"), true);
  assertEquals(selectionTier("leg press", "METABOLIC"), 2);
  assertEquals(selectionTier("kettlebell swing", "METABOLIC"), 0);
});

Deno.test("shared policy puts common safe variants before exotic legal variants", () => {
  const ordered = applySelectionPolicy([
    { name: "dumbbell goblet squat with pause" },
    { name: "dumbbell goblet squat" },
    { name: "uncommon rotational squat variation" },
  ], "STRENGTH");
  assertEquals(ordered[0]?.name, "dumbbell goblet squat");
});