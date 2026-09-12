import { buildPackWorkout } from "./pack.server.ts";
import { estimateWorkMinutes } from "./enforce.server.ts";
const mk = (i:number)=>({id:`ex${i}`,name:`Exercise ${i}`,bodyPart:"upper legs",target:"quads",secondaryMuscles:[],equipment:"dumbbell",category:"strength",difficulty:"intermediate",gifUrl:null} as any);
const pool = Array.from({length:40},(_,i)=>mk(i));
const r = buildPackWorkout(pool, pool, {category:"STRENGTH",format:"REPS & SETS",level:"intermediate",minutes:30,focus:"FULL BODY",favoriteIds:[],activationPool:pool,cooldownPool:pool,seed:7} as any);
console.log(r.html.replace(/<[^>]+>/g," ").replace(/\s+/g," ").slice(0,2000));
console.log("EST", estimateWorkMinutes(r.html));
