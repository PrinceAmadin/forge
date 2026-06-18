"use client";

import { useState } from "react";
import { Label, FieldError } from "@/components/ui";
import { updateProfile, type ProfileInput } from "./actions";

const selectClass =
  "w-full rounded-md border border-[#27272a] bg-[#09090b] px-4 py-3 text-primary focus:border-accent focus:outline-none focus:ring-1 focus:ring-amber-500/20";
const inputClass =
  "w-full rounded-md border border-[#27272a] bg-[#09090b] px-4 text-primary placeholder:text-[#52525b] focus:border-accent focus:outline-none focus:ring-1 focus:ring-amber-500/20";

export function ProfileForm({
  halls,
  email,
  initial,
}: {
  halls: { id: string; name: string }[];
  email: string;
  initial: ProfileInput;
}) {
  const [fullName, setFullName] = useState(initial.full_name);
  const [hallId, setHallId] = useState(initial.hall_id);
  const [course, setCourse] = useState(initial.course);
  const [phoneLocal, setPhoneLocal] = useState(initial.phone_local);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string>();
  const [message, setMessage] = useState<string>();

  const dirty =
    fullName !== initial.full_name ||
    hallId !== initial.hall_id ||
    course !== initial.course ||
    phoneLocal.replace(/\D/g, "") !== initial.phone_local;

  const valid = fullName.trim().length >= 2 && hallId.trim() !== "" && course.trim() !== "";

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!dirty) {
      setMessage("No changes to save");
      return;
    }
    setBusy(true);
    setError(undefined);
    setMessage(undefined);
    // On success the action redirects to /settings; we only return here on a
    // no-op or an error.
    const res = await updateProfile({
      full_name: fullName,
      hall_id: hallId,
      course,
      phone_local: phoneLocal,
    });
    setBusy(false);
    if (res?.error) return setError(res.error);
    if (res?.message) return setMessage(res.message);
  }

  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-5 pb-28 sm:pb-10">
      <div>
        <Label htmlFor="full_name">Full name</Label>
        <input
          id="full_name"
          value={fullName}
          onChange={(e) => setFullName(e.target.value)}
          required
          autoComplete="name"
          className={`${inputClass} h-14`}
        />
      </div>

      <div>
        <Label htmlFor="hall_id">Hall</Label>
        <select
          id="hall_id"
          value={hallId}
          onChange={(e) => setHallId(e.target.value)}
          required
          className={selectClass}
        >
          <option value="" disabled>
            Select your hall
          </option>
          {halls.map((h) => (
            <option key={h.id} value={h.id}>
              {h.name}
            </option>
          ))}
        </select>
      </div>

      <div>
        <Label htmlFor="course">Course</Label>
        <input
          id="course"
          value={course}
          onChange={(e) => setCourse(e.target.value)}
          required
          autoComplete="organization-title"
          placeholder="e.g., Mechanical Engineering"
          className={`${inputClass} h-14`}
        />
      </div>

      <div>
        <Label htmlFor="phone">Phone (optional)</Label>
        <div className="flex items-stretch gap-2">
          <span className="inline-flex h-14 items-center rounded-md border border-[#27272a] bg-[#09090b] px-3 text-[14px] text-tertiary">
            +234
          </span>
          <input
            id="phone"
            value={phoneLocal}
            onChange={(e) => setPhoneLocal(e.target.value.replace(/\D/g, "").slice(0, 11))}
            inputMode="tel"
            autoComplete="tel-national"
            placeholder="803 000 0000"
            className={`${inputClass} h-14 flex-1`}
          />
        </div>
      </div>

      {/* Read-only identity — email is the auth identifier, never editable here. */}
      <div>
        <Label htmlFor="email">Email</Label>
        <p id="email" className="text-[14px] text-tertiary">
          {email}
        </p>
        <p className="mt-1 text-[12px] text-tertiary">
          Email cannot be changed. Contact an admin if this needs updating.
        </p>
      </div>

      <FieldError>{error}</FieldError>
      {message && <p className="text-[13px] text-secondary">{message}</p>}

      <button
        type="submit"
        disabled={busy || !valid || !dirty}
        className="h-14 w-full rounded-md bg-accent font-medium text-black transition-colors active:bg-amber-600 disabled:bg-[#27272a] disabled:text-tertiary"
      >
        {busy ? "Saving…" : "Save changes"}
      </button>
    </form>
  );
}
