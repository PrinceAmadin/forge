"use client";

import { useMemo, useState } from "react";
import { Eyebrow, Label, SecondaryButton, TextInput } from "@/components/ui";
import { fmtNaira, toRomanUpper } from "@/lib/format";
import type { RewardKind } from "@/lib/types";

export interface TierRow {
  from: number;
  to: number;
  amount: string; // kept as a string so the input can be empty while typing
  label: string;
  note: string;
}

export function emptyTier(from: number): TierRow {
  return { from, to: from, amount: "", label: toRomanUpper(from), note: "" };
}

// Re-sequence `from` down the list so the run is always unbroken, whatever was
// edited. Exported and pure so the contiguity guarantee can be tested directly
// — it is the thing standing between an author and a prize structure where
// some position silently wins nothing.
export function normaliseTiers(rows: TierRow[]): TierRow[] {
  let next = 1;
  return rows.map((row) => {
    const from = next;
    const to = Math.max(from, Number.isFinite(row.to) ? row.to : from);
    next = to + 1;
    return { ...row, from, to };
  });
}

// What a tier row contributes to the pool: amount x seats, blank counting as 0.
export function tierRowTotal(row: TierRow): number {
  const amount = Number(row.amount);
  const seats = row.to - row.from + 1;
  return (Number.isFinite(amount) ? amount : 0) * seats;
}

// The prize structure editor.
//
// Rows are {from, to} rather than the stored {position} | {positions} union
// because a contiguous run is far easier to edit and to reason about. `from` is
// never typed — it is always the previous row's `to` + 1 — and rows can only be
// removed from the tail. That makes a gap or an overlap structurally
// impossible here, which matters because those are the two mistakes that would
// silently leave a position winning nothing. The zod schema re-checks all of it
// server-side anyway, since this form is not the only possible caller.
export function PrizeBuilder({
  rewardKind,
  initialTiers,
}: {
  rewardKind: RewardKind;
  initialTiers: TierRow[];
}) {
  const [tiers, setTiers] = useState<TierRow[]>(
    initialTiers.length > 0 ? initialTiers : [emptyTier(1)]
  );

  const showsMoney = rewardKind === "cash";

  const normalise = normaliseTiers;

  function update(i: number, patch: Partial<TierRow>) {
    setTiers((rows) => normalise(rows.map((r, j) => (j === i ? { ...r, ...patch } : r))));
  }

  function addTier() {
    setTiers((rows) => {
      const last = rows[rows.length - 1];
      return normalise([...rows, emptyTier((last?.to ?? 0) + 1)]);
    });
  }

  function removeLast() {
    setTiers((rows) => (rows.length > 1 ? normalise(rows.slice(0, -1)) : rows));
  }

  const cut = useMemo(() => tiers.reduce((max, t) => Math.max(max, t.to), 0), [tiers]);
  const pool = useMemo(
    () =>
      showsMoney
        ? tiers.reduce((sum, t) => sum + tierRowTotal(t), 0)
        : 0,
    [tiers, showsMoney]
  );

  // Serialised for the server action. The action re-parses and re-validates;
  // this is transport, not trust.
  const payload = JSON.stringify(
    tiers.map((t) => ({
      from: t.from,
      to: t.to,
      ...(showsMoney && t.amount !== "" ? { amount: Number(t.amount) } : {}),
      label: t.label,
      ...(!showsMoney && t.note ? { note: t.note } : {}),
    }))
  );

  return (
    <div>
      <input type="hidden" name="prize_structure" value={payload} />
      {/* The cut is derived, never typed — it IS the last awarded position. */}
      <input type="hidden" name="prize_line_position" value={cut} />

      <div className="flex flex-col gap-3">
        {tiers.map((tier, i) => (
          <div
            key={i}
            className="rounded-md border border-[#27272a] p-3"
          >
            <div className="flex items-baseline justify-between gap-3">
              <Eyebrow>
                {tier.from === tier.to ? `position ${tier.from}` : `positions ${tier.from}–${tier.to}`}
              </Eyebrow>
              {i === tiers.length - 1 && tiers.length > 1 && (
                <button
                  type="button"
                  onClick={removeLast}
                  className="font-mono text-[11px] text-tertiary active:text-rejected sm:hover:text-rejected"
                >
                  remove
                </button>
              )}
            </div>

            <div className="mt-3 grid grid-cols-2 gap-3">
              <div>
                <Label>Up to position</Label>
                <TextInput
                  type="text"
                  inputMode="numeric"
                  value={String(tier.to)}
                  onChange={(e) => {
                    const digits = e.target.value.replace(/\D/g, "").slice(0, 4);
                    update(i, { to: digits === "" ? tier.from : Number(digits) });
                  }}
                />
              </div>
              <div>
                <Label>Label</Label>
                <TextInput
                  value={tier.label}
                  maxLength={12}
                  placeholder="I"
                  onChange={(e) => update(i, { label: e.target.value })}
                />
              </div>
            </div>

            {showsMoney ? (
              <div className="mt-3">
                <Label>Amount each (₦)</Label>
                <TextInput
                  type="text"
                  inputMode="numeric"
                  value={tier.amount}
                  placeholder="5000"
                  onChange={(e) =>
                    update(i, { amount: e.target.value.replace(/\D/g, "").slice(0, 9) })
                  }
                />
              </div>
            ) : (
              <div className="mt-3">
                <Label>What they get</Label>
                <TextInput
                  value={tier.note}
                  maxLength={80}
                  placeholder="A trophy"
                  onChange={(e) => update(i, { note: e.target.value })}
                />
              </div>
            )}
          </div>
        ))}
      </div>

      <div className="mt-3">
        <SecondaryButton type="button" onClick={addTier} className="h-11">
          Add tier
        </SecondaryButton>
      </div>

      <div className="mt-4 flex items-baseline justify-between gap-4 border-t border-[#27272a] pt-4">
        <div>
          <Eyebrow>the cut</Eyebrow>
          <p className="mt-1 font-serif text-[20px] italic text-primary">{cut || "—"}</p>
        </div>
        {showsMoney && (
          <div className="text-right">
            <Eyebrow>total pool</Eyebrow>
            <p className="mt-1 font-serif text-[20px] italic text-primary">{fmtNaira(pool)}</p>
          </div>
        )}
      </div>
    </div>
  );
}
