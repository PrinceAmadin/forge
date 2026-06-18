"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Eyebrow, PrimaryButton, TextInput, Label, FieldError } from "@/components/ui";
import { fmtHours } from "@/lib/format";
import type { Role } from "@/lib/types";
import { setUserRole, addManualEntry, removeManualEntry } from "../actions";

export interface HistoryItem {
  id: string;
  challenge_day: number;
  hours_claimed: number;
  hours_credited: number | null;
  topic: string;
  status: string;
  submitted_at: string;
}

const ROLE_OPTIONS: { value: Role; label: string }[] = [
  { value: "participant", label: "Participant" },
  { value: "admin", label: "Admin" },
  { value: "super_admin", label: "Super Admin" },
];

export function UserDetail({
  userId,
  currentRole,
  isSelf,
  manualEntries,
  history,
}: {
  userId: string;
  currentRole: Role;
  isSelf: boolean;
  manualEntries: HistoryItem[];
  history: HistoryItem[];
}) {
  const router = useRouter();
  const [role, setRole] = useState<Role>(currentRole);
  const [roleErr, setRoleErr] = useState<string>();
  const [roleBusy, setRoleBusy] = useState(false);
  const [roleSaved, setRoleSaved] = useState(false);

  const [day, setDay] = useState("");
  const [hours, setHours] = useState("");
  const [reason, setReason] = useState("");
  const [manErr, setManErr] = useState<string>();
  const [manBusy, setManBusy] = useState(false);

  async function saveRole() {
    setRoleErr(undefined);
    setRoleSaved(false);
    setRoleBusy(true);
    const res = await setUserRole(userId, role);
    setRoleBusy(false);
    if (!res.ok) return setRoleErr(res.error);
    setRoleSaved(true);
    router.refresh();
  }

  async function submitManual(e: React.FormEvent) {
    e.preventDefault();
    setManErr(undefined);
    setManBusy(true);
    const res = await addManualEntry(userId, Number(day), Number(hours), reason);
    setManBusy(false);
    if (!res.ok) return setManErr(res.error);
    setDay("");
    setHours("");
    setReason("");
    router.refresh();
  }

  async function remove(id: string) {
    await removeManualEntry(id, userId);
    router.refresh();
  }

  return (
    <div className="mt-10 flex flex-col gap-12">
      {/* Role */}
      <section>
        <Eyebrow>role</Eyebrow>
        <div className="mt-3 flex flex-col gap-2">
          {ROLE_OPTIONS.map((opt) => {
            const disabled = isSelf && currentRole === "super_admin" && opt.value !== "super_admin";
            return (
              <label
                key={opt.value}
                className={`flex items-center gap-3 py-1.5 text-[14px] ${disabled ? "text-quaternary" : "text-primary"}`}
              >
                <input
                  type="radio"
                  name="role"
                  value={opt.value}
                  checked={role === opt.value}
                  disabled={disabled}
                  onChange={() => setRole(opt.value)}
                  className="h-4 w-4 accent-amber-500"
                />
                {opt.label}
                {disabled && <span className="font-mono text-[11px] text-quaternary">can&rsquo;t demote yourself</span>}
              </label>
            );
          })}
        </div>
        <FieldError>{roleErr}</FieldError>
        <div className="mt-3 flex items-center gap-3">
          <PrimaryButton
            onClick={saveRole}
            disabled={roleBusy || role === currentRole}
            className="h-11 w-auto px-5"
          >
            {roleBusy ? "Saving…" : "Save changes"}
          </PrimaryButton>
          {roleSaved && <span className="text-[12px] text-verified">Saved</span>}
        </div>
      </section>

      {/* Manual hours */}
      <section>
        <Eyebrow>manual entries</Eyebrow>
        <form onSubmit={submitManual} className="mt-3 flex flex-col gap-3">
          <div className="flex gap-3">
            <div className="w-20">
              <Label htmlFor="day">Day</Label>
              <TextInput id="day" value={day} onChange={(e) => setDay(e.target.value)} inputMode="numeric" placeholder="1" />
            </div>
            <div className="w-24">
              <Label htmlFor="mhours">Hours</Label>
              <TextInput id="mhours" value={hours} onChange={(e) => setHours(e.target.value)} inputMode="decimal" placeholder="8" />
            </div>
          </div>
          <div>
            <Label htmlFor="reason">Reason</Label>
            <TextInput
              id="reason"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="Read day 1 before Forge was ready; verified via WhatsApp"
            />
          </div>
          <FieldError>{manErr}</FieldError>
          <PrimaryButton type="submit" disabled={manBusy || !day || !hours || !reason.trim()} className="h-11 w-auto px-5">
            {manBusy ? "Adding…" : "Add manual entry"}
          </PrimaryButton>
        </form>

        {manualEntries.length > 0 && (
          <ul className="mt-5 border-b border-[#27272a]">
            {manualEntries.map((m) => (
              <li key={m.id} className="flex items-start justify-between gap-4 border-t border-[#27272a] py-3">
                <span className="min-w-0">
                  <span className="text-[13px] text-primary">
                    Day {m.challenge_day} · {fmtHours(m.hours_credited ?? m.hours_claimed)}h
                  </span>
                  <span className="mt-0.5 block truncate text-[12px] italic text-tertiary">
                    {m.topic.replace(/^Manual entry — /, "")}
                  </span>
                </span>
                <button onClick={() => remove(m.id)} className="shrink-0 text-[12px] text-tertiary active:text-rejected sm:hover:text-rejected">
                  Remove
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* Submission history */}
      <section>
        <Eyebrow>submission history</Eyebrow>
        {history.length === 0 ? (
          <p className="mt-3 text-[13px] text-tertiary">No submissions yet.</p>
        ) : (
          <ul className="mt-3 border-b border-[#27272a]">
            {history.map((s) => (
              <li key={s.id} className="flex items-center justify-between gap-4 border-t border-[#27272a] py-3">
                <span className="text-[13px] text-primary">Day {s.challenge_day}</span>
                <span className="flex items-center gap-3">
                  <span className="font-mono text-[13px] tnum text-secondary">
                    {fmtHours(s.hours_credited ?? s.hours_claimed)}h
                  </span>
                  <span
                    className={`text-[11px] lowercase ${
                      s.status === "confirmed" ? "text-verified" : s.status === "rejected" ? "text-rejected" : "text-tertiary"
                    }`}
                    style={{ letterSpacing: "0.14em" }}
                  >
                    {s.status}
                  </span>
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
