import { buildSessionPlan } from "./programming.ts";
import { estimateWorkMinutes } from "./enforce.server.ts";
const plan = buildSessionPlan({ category:"STRENGTH", format:"REPS & SETS", level:"intermediate", stars:3, minutes:30, mood:"good", location:"home", focus:"FULL BODY", equipmentCount:2 });
console.log(JSON.stringify(plan, null, 2));
