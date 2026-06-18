"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Eyebrow, PrimaryButton, TextInput, Label, FieldError } from "@/components/ui";
import { formatHM, hmToDecimalHours } from "@/lib/time/format";
import type { Role } from "@/lib/types";
import { setUserRole, addManualEntry, removeManualEntry, deleteUser } from "../actions";

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
  fullName,
  currentRole,
  isSelf,
  manualEntries,
  history,
}: {
  userId: string;
  fullName: string;
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
  const [hrs, setHrs] = useState("");
  const [mins, setMins] = useState("");
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
    const decimal = hmToDecimalHours(Number(hrs || 0), Number(mins || 0));
    if (decimal <= 0) return setManErr("Enter hours and/or minutes.");
    setManBusy(true);
    const res = await addManualEntry(userId, Number(day), decimal, reason);
    setManBusy(false);
    if (!res.ok) return setManErr(res.error);
    setDay("");
    setHrs("");
    setMins("");
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
            <div className="w-16">
              <Label htmlFor="day">Day</Label>
              <TextInput id="day" value={day} onChange={(e) => setDay(e.target.value.replace(/[^\d]/g, ""))} inputMode="numeric" placeholder="1" />
            </div>
            <div className="w-20">
              <Label htmlFor="mhours">Hours</Label>
              <TextInput id="mhours" value={hrs} onChange={(e) => setHrs(e.target.value.replace(/[^\d]/g, "").slice(0, 2))} inputMode="numeric" placeholder="8" />
            </div>
            <div className="w-20">
              <Label htmlFor="mmins">Minutes</Label>
              <TextInput id="mmins" value={mins} onChange={(e) => setMins(e.target.value.replace(/[^\d]/g, "").slice(0, 2))} inputMode="numeric" placeholder="0" />
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
          <PrimaryButton type="submit" disabled={manBusy || !day || (!hrs && !mins) || !reason.trim()} className="h-11 w-auto px-5">
            {manBusy ? "Adding…" : "Add manual entry"}
          </PrimaryButton>
        </form>

        {manualEntries.length > 0 && (
          <ul className="mt-5 border-b border-[#27272a]">
            {manualEntries.map((m) => (
              <li key={m.id} className="flex items-start justify-between gap-4 border-t border-[#27272a] py-3">
                <span className="min-w-0">
                  <span className="text-[13px] text-primary">
                    Day {m.challenge_day} · {formatHM(m.hours_credited ?? m.hours_claimed, "compact")}
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
                    {formatHM(s.hours_credited ?? s.hours_claimed, "compact")}
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

      {/* Danger zone — the whole page is super_admin-gated server-side
          (requireSuperAdmin), so reaching here already means super_admin. */}
      <DangerZone userId={userId} fullName={fullName} isSelf={isSelf} />
    </div>
  );
}

function DangerZone({ userId, fullName, isSelf }: { userId: string; fullName: string; isSelf: boolean }) {
  const [open, setOpen] = useState(false);

  if (isSelf) {
    return (
      <section>
        <p className="text-[10px] lowercase text-rejected" style={{ letterSpacing: "0.22em" }}>
          danger zone
        </p>
        <p className="mt-3 text-[12px] text-tertiary">You cannot delete your own account.</p>
      </section>
    );
  }

  return (
    <section>
      <p className="text-[10px] lowercase text-rejected" style={{ letterSpacing: "0.22em" }}>
        danger zone
      </p>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="mt-4 h-12 w-full rounded-md border border-rejected text-[14px] text-rejected transition-colors active:bg-rejected/10 sm:hover:bg-rejected/10"
      >
        Delete this account permanently
      </button>
      <p className="mt-2 font-mono text-[12px] text-quaternary">
        This permanently removes the user, their profile, enrollments, submissions, marks, and
        appeals. Audit log entries are preserved with the actor anonymized.
      </p>
      {open && <DeleteDialog userId={userId} fullName={fullName} onClose={() => setOpen(false)} />}
    </section>
  );
}

function DeleteDialog({
  userId,
  fullName,
  onClose,
}: {
  userId: string;
  fullName: string;
  onClose: () => void;
}) {
  const firstName = fullName.trim().split(/\s+/)[0] ?? "";
  const [typed, setTyped] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string>();
  const matches = typed === firstName && firstName.length > 0;

  async function onConfirm() {
    if (!matches || busy) return;
    setBusy(true);
    setErr(undefined);
    // On success the action redirects (navigates away); we only return here on
    // failure, so surface the error without closing the sheet.
    const res = await deleteUser(userId);
    setBusy(false);
    if (res && !res.ok) setErr(res.error);
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/70 p-0 sm:items-center sm:p-4"
      onClick={onClose}
    >
      <div
        className="w-full max-w-[420px] border border-[#27272a] bg-bg p-5 sm:rounded-md"
        onClick={(e) => e.stopPropagation()}
      >
        <p className="font-serif text-[22px] italic text-primary">Delete {fullName}?</p>
        <p className="mt-2 text-[14px] text-secondary">
          This cannot be undone. Type the user&rsquo;s first name below to confirm.
        </p>
        <input
          value={typed}
          onChange={(e) => setTyped(e.target.value)}
          placeholder={firstName}
          autoFocus
          className="mt-4 w-full rounded-md border border-[#27272a] bg-[#09090b] px-4 py-3 text-primary placeholder:text-[#52525b] focus:border-accent focus:outline-none"
        />
        {err && <p className="mt-2 text-[13px] text-rejected">{err}</p>}
        <div className="mt-4 flex gap-3">
          <button
            type="button"
            onClick={onClose}
            className="flex-1 rounded-md border border-[#3f3f46] py-3 text-[14px] text-secondary"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={!matches || busy}
            className="flex-1 rounded-md bg-rejected py-3 text-[14px] font-medium text-primary disabled:opacity-50"
          >
            {busy ? "Deleting…" : "Delete account"}
          </button>
        </div>
      </div>
    </div>
  );
}
