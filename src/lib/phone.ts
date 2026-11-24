export interface NormalizedPhone {
  value: string | null;
  error?: string;
}

// Normalize a Nigerian mobile number to E.164 (+234XXXXXXXXXX). Accepts the
// local part with or without a leading 0 / +234 / 234. Returns null for empty
// (phone is optional). §profile-edit
//
// Extracted from the profile server action so it can be unit-tested — a
// "use server" module can't be imported by a test runner.
export function normalizeNigerianPhone(local: string): NormalizedPhone {
  let d = local.replace(/\D/g, "");
  if (!d) return { value: null };
  if (d.startsWith("234")) d = d.slice(3);
  if (d.startsWith("0")) d = d.slice(1);
  if (d.length !== 10 || !/^[789]/.test(d)) {
    return { value: null, error: "Enter a valid Nigerian phone number." };
  }
  return { value: `+234${d}` };
}
