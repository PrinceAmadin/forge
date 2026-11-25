"use client";

import { useActionState, useState } from "react";
import { Eyebrow, FieldError, Label, PrimaryButton, TextInput } from "@/components/ui";
import { PrizeBuilder, emptyTier, type TierRow } from "@/components/admin/prize-builder";
import { createChallenge, type CreateChallengeState } from "./actions";
import type { RewardKind } from "@/lib/types";

// Matches TextInput's styling; there is no shared textarea primitive yet and
// one belongs in components/ui.tsx only once a second form needs it.
function TextArea(props: React.TextareaHTMLAttributes<HTMLTextAreaElement>) {
  const { className = "", ...rest } = props;
  return (
    <textarea
      className={`w-full rounded-md border border-[#27272a] bg-[#09090b] px-4 py-3 text-primary placeholder:text-[#52525b] focus:border-accent focus:outline-none focus:ring-1 focus:ring-amber-500/20 ${className}`}
      {...rest}
    />
  );
}

const REWARDS: { value: RewardKind; label: string; hint: string }[] = [
  { value: "cash", label: "Cash", hint: "Tiers pay naira. The cut is the last paid position." },
  { value: "none", label: "Friendly", hint: "No money. The cut is an honours line." },
  { value: "custom", label: "Other", hint: "A trophy, a certificate — described in words." },
];

function err(state: CreateChallengeState, field: string): string | undefined {
  return state.fieldErrors?.[field]?.[0];
}

export function ChallengeForm() {
  const [state, action, pending] = useActionState<CreateChallengeState, FormData>(
    createChallenge,
    {}
  );
  const [rewardKind, setRewardKind] = useState<RewardKind>("cash");
  const [slug, setSlug] = useState("");
  const [name, setName] = useState("");
  const [tiers] = useState<TierRow[]>([emptyTier(1)]);

  // Suggest a slug from the name until the author types one themselves — the
  // slug is permanent once the challenge leaves draft, so it is worth getting
  // right, but not worth typing twice.
  const [slugTouched, setSlugTouched] = useState(false);
  const suggested = name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40);
  const slugValue = slugTouched ? slug : suggested;

  return (
    <form action={action} className="flex flex-col gap-7">
      <section>
        <Eyebrow>identity</Eyebrow>
        <div className="mt-3 flex flex-col gap-4">
          <div>
            <Label htmlFor="name">Name</Label>
            <TextInput
              id="name"
              name="name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="The Exam Flame"
              maxLength={80}
              required
            />
            <FieldError>{err(state, "name")}</FieldError>
          </div>

          <div>
            <Label htmlFor="slug">URL slug</Label>
            <TextInput
              id="slug"
              name="slug"
              value={slugValue}
              onChange={(e) => {
                setSlugTouched(true);
                setSlug(e.target.value);
              }}
              placeholder="exam-flame"
              maxLength={40}
              required
            />
            <p className="mt-2 font-mono text-[11px] text-tertiary">
              /c/{slugValue || "…"} — permanent once the challenge goes live, because it is
              also part of every uploaded screenshot&rsquo;s path.
            </p>
            <FieldError>{err(state, "slug")}</FieldError>
          </div>

          <div>
            <Label htmlFor="description">Description</Label>
            <TextArea
              id="description"
              name="description"
              rows={2}
              maxLength={500}
              placeholder="Read 8 hours a day for 20 days. 15 winners."
            />
            <FieldError>{err(state, "description")}</FieldError>
          </div>
        </div>
      </section>

      <section>
        <Eyebrow>the campaign</Eyebrow>
        <div className="mt-3 flex flex-col gap-4">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label htmlFor="start_date">Starts</Label>
              <TextInput id="start_date" name="start_date" type="date" required />
              <FieldError>{err(state, "start_date")}</FieldError>
            </div>
            <div>
              <Label htmlFor="end_date">Ends</Label>
              <TextInput id="end_date" name="end_date" type="date" required />
              <FieldError>{err(state, "end_date")}</FieldError>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label htmlFor="timezone">Timezone</Label>
              <TextInput id="timezone" name="timezone" defaultValue="Africa/Lagos" />
              <p className="mt-2 font-mono text-[11px] text-tertiary">Sets every day boundary.</p>
              <FieldError>{err(state, "timezone")}</FieldError>
            </div>
            <div>
              <Label htmlFor="daily_hour_ceiling">Daily cap (hours)</Label>
              <TextInput
                id="daily_hour_ceiling"
                name="daily_hour_ceiling"
                type="text"
                inputMode="decimal"
                defaultValue="24"
              />
              <FieldError>{err(state, "daily_hour_ceiling")}</FieldError>
            </div>
          </div>
        </div>
      </section>

      <section>
        <Eyebrow>the reward</Eyebrow>
        <div className="mt-3 flex flex-col gap-4">
          <div>
            {/* Radios, not a select: three options worth seeing at once, since
                the choice changes what the tier editor below asks for. */}
            <div className="flex flex-col gap-2">
              {REWARDS.map((r) => (
                <label
                  key={r.value}
                  className="flex cursor-pointer items-start gap-3 rounded-md border border-[#27272a] p-3 text-[14px]"
                >
                  <input
                    type="radio"
                    name="reward_kind"
                    value={r.value}
                    checked={rewardKind === r.value}
                    onChange={() => setRewardKind(r.value)}
                    className="mt-0.5 h-4 w-4 shrink-0 accent-amber-500"
                  />
                  <span>
                    <span className="block text-primary">{r.label}</span>
                    <span className="block text-[12px] text-tertiary">{r.hint}</span>
                  </span>
                </label>
              ))}
            </div>
            <FieldError>{err(state, "reward_kind")}</FieldError>
          </div>

          {rewardKind !== "cash" && (
            <div>
              <Label htmlFor="prize_note">Reward, in a line</Label>
              <TextInput
                id="prize_note"
                name="prize_note"
                maxLength={200}
                placeholder="Bragging rights and a trophy"
              />
              <FieldError>{err(state, "prize_note")}</FieldError>
            </div>
          )}

          <div>
            <Label>Tiers</Label>
            <PrizeBuilder rewardKind={rewardKind} initialTiers={tiers} />
            <FieldError>{err(state, "prize_structure")}</FieldError>
            <FieldError>{err(state, "prize_line_position")}</FieldError>
          </div>
        </div>
      </section>

      <section>
        <Eyebrow>rules &amp; terms</Eyebrow>
        <div className="mt-3 flex flex-col gap-4">
          <div>
            <Label htmlFor="rules">Rules</Label>
            <TextArea
              id="rules"
              name="rules"
              rows={5}
              maxLength={4000}
              placeholder={"One rule per line.\nSubmit one entry per day with evidence."}
            />
            <p className="mt-2 font-mono text-[11px] text-tertiary">
              One per line. Shown as a numbered list on the challenge page.
            </p>
            <FieldError>{err(state, "rules")}</FieldError>
          </div>

          <div>
            <Label htmlFor="terms">Entry terms</Label>
            <TextArea
              id="terms"
              name="terms"
              rows={4}
              maxLength={2000}
              placeholder={"I understand that submissions require evidence."}
            />
            <p className="mt-2 font-mono text-[11px] text-tertiary">
              One per line, each a checkbox a participant must tick to enter. Different from the
              rules above: these are the contract. Left blank, the three standard ones are used.
            </p>
            <FieldError>{err(state, "terms")}</FieldError>
          </div>

          <div>
            <Label htmlFor="visibility">Visibility</Label>
            <select
              id="visibility"
              name="visibility"
              defaultValue="listed"
              className="w-full rounded-md border border-[#27272a] bg-[#09090b] px-4 py-3 text-primary focus:border-accent focus:outline-none"
            >
              <option value="listed">Listed — shown on /challenges</option>
              <option value="unlisted">Unlisted — reachable by link only</option>
            </select>
            <FieldError>{err(state, "visibility")}</FieldError>
          </div>
        </div>
      </section>

      <div className="border-t border-[#27272a] pt-5">
        <p className="mb-3 text-[13px] text-tertiary">
          Saved as a <span className="text-primary">draft</span>. Nobody can see or join it until
          you launch it from the challenge page.
        </p>
        <FieldError>{state.error}</FieldError>
        <PrimaryButton type="submit" disabled={pending} className="mt-2 h-[52px]">
          {pending ? "Creating…" : "Create draft"}
        </PrimaryButton>
      </div>
    </form>
  );
}
