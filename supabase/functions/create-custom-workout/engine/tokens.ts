// Client-safe helpers for the {{exercise:ID:Name}} markup contract.

export const EXERCISE_TOKEN_RE = /\{\{exercise:([A-Za-z0-9_-]+):([^}]*)\}\}/g;

export type ExerciseToken = { id: string; name: string; raw: string; index: number };

/** A real library id is short and alphanumeric (0043, 1160). Slugs are rejected. */
export function isLibraryId(id: string): boolean {
  return /^[A-Za-z0-9]{2,8}$/.test(id) && /\d/.test(id);
}

export function findTokens(html: string): ExerciseToken[] {
  const out: ExerciseToken[] = [];
  const re = new RegExp(EXERCISE_TOKEN_RE.source, "g");
  let m: RegExpExecArray | null;
  while ((m = re.exec(html))) {
    out.push({ id: m[1]!, name: (m[2] ?? "").trim(), raw: m[0]!, index: m.index });
  }
  return out;
}

export function uniqueTokenIds(html: string): string[] {
  return Array.from(new Set(findTokens(html).filter((t) => isLibraryId(t.id)).map((t) => t.id)));
}

export function stripTokens(text: string): string {
  return text.replace(new RegExp(EXERCISE_TOKEN_RE.source, "g"), (_m, _id, name) => String(name));
}

export function stripHtml(html: string): string {
  return html
    .replace(/<[^>]*>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/\s+/g, " ")
    .trim();
}
