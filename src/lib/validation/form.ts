import { z } from "zod";

export type ParseResult<T> =
  | { ok: true; value: T }
  | { ok: false; formErrors: string[]; fieldErrors: Record<string, string[]> };

// Turn a FormData into a plain object. Every value arrives as a string, so the
// schemas below do the coercing — which is why they use z.coerce.* rather than
// z.number() and friends.
//
// Repeated keys collapse to an array so multi-value fields (checkbox groups)
// work; File values are dropped, since uploads go straight to Storage and never
// through a server action.
export function formDataToObject(formData: FormData): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [key, value] of formData.entries()) {
    if (typeof value !== "string") continue;
    const existing = out[key];
    if (existing === undefined) {
      out[key] = value;
    } else if (Array.isArray(existing)) {
      existing.push(value);
    } else {
      out[key] = [existing, value];
    }
  }
  return out;
}

// The single entry point for validating a server action's input.
//
// Returns the same `{ ok, ... }` shape the existing actions use rather than
// throwing, so it drops into the established pattern. zod 4 exposes flattening
// as a top-level function — z.flattenError(err) — not a method on the error.
export function parseForm<S extends z.ZodType>(
  schema: S,
  input: FormData | Record<string, unknown>
): ParseResult<z.output<S>> {
  const raw = input instanceof FormData ? formDataToObject(input) : input;
  const result = schema.safeParse(raw);
  if (result.success) return { ok: true, value: result.data };

  const flat = z.flattenError(result.error);
  return {
    ok: false,
    formErrors: flat.formErrors,
    fieldErrors: flat.fieldErrors as Record<string, string[]>,
  };
}

// The first field error, for actions that surface a single string.
export function firstError<T>(result: ParseResult<T>): string | undefined {
  if (result.ok) return undefined;
  const field = Object.values(result.fieldErrors).flat()[0];
  return field ?? result.formErrors[0] ?? "That input isn't valid.";
}

// An empty text input posts "" rather than being absent, which would coerce to
// 0 or fail a min() check. Treat blank as "not provided".
//
// IMPORTANT: the schema passed in must itself accept undefined — put the
// .optional() or .default() INSIDE the call:
//
//   blankToUndefined(z.string().max(60).default("Africa/Lagos"))   correct
//   blankToUndefined(z.string().max(60)).default("Africa/Lagos")   broken
//
// The second form reads the default off the ORIGINAL input, and "" is not
// undefined, so the default never fires and the inner schema is handed
// undefined instead.
export const blankToUndefined = <S extends z.ZodType>(schema: S) =>
  z.preprocess((v) => (typeof v === "string" && v.trim() === "" ? undefined : v), schema);

// A hidden input carrying JSON (the prize builder serialises its rows this way).
export const jsonField = <S extends z.ZodType>(schema: S) =>
  z.preprocess((v) => {
    if (typeof v !== "string") return v;
    try {
      return JSON.parse(v);
    } catch {
      return z.NEVER;
    }
  }, schema);
