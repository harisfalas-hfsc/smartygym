// Queue of safe local mutations performed offline (favourites, completions,
// notes). Replayed automatically once the connection returns.
import { readOffline, saveOffline } from "./db";
import { supabase } from "@/integrations/supabase/client";

const QUEUE_KEY = "pending-mutations";

export type QueuedMutation =
  | { kind: "upsert"; table: string; payload: Record<string, unknown>; onConflict?: string }
  | { kind: "insert"; table: string; payload: Record<string, unknown> }
  | { kind: "update"; table: string; payload: Record<string, unknown>; match: Record<string, unknown> };

interface QueueEntry {
  id: string;
  createdAt: number;
  mutation: QueuedMutation;
}

export async function queueMutation(mutation: QueuedMutation, userId: string) {
  const existing = (await readOffline<QueueEntry[]>(QUEUE_KEY, userId))?.data ?? [];
  existing.push({ id: crypto.randomUUID(), createdAt: Date.now(), mutation });
  await saveOffline(QUEUE_KEY, existing, userId);
}

export async function pendingMutationCount(userId: string) {
  return ((await readOffline<QueueEntry[]>(QUEUE_KEY, userId))?.data ?? []).length;
}

export async function flushMutationQueue(userId: string): Promise<number> {
  if (typeof navigator !== "undefined" && !navigator.onLine) return 0;
  const entries = (await readOffline<QueueEntry[]>(QUEUE_KEY, userId))?.data ?? [];
  if (!entries.length) return 0;

  const remaining: QueueEntry[] = [];
  let flushed = 0;

  for (const entry of entries) {
    try {
      const mutation = entry.mutation;
      const { table, payload } = mutation;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const from = (supabase as any).from(table);
      let error: unknown = null;

      if (mutation.kind === "insert") ({ error } = await from.insert(payload));
      else if (mutation.kind === "upsert")
        ({ error } = await from.upsert(payload, { onConflict: mutation.onConflict }));
      else if (mutation.kind === "update") {
        let q = from.update(payload);
        for (const [col, val] of Object.entries(mutation.match)) q = q.eq(col, val);
        ({ error } = await q);
      }

      if (error) remaining.push(entry);
      else flushed += 1;
    } catch {
      remaining.push(entry);
    }
  }

  await saveOffline(QUEUE_KEY, remaining, userId);
  return flushed;
}
