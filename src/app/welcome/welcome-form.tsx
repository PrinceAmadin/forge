"use client";

import { useActionState, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { completeProfile, type WelcomeState } from "./actions";
import { PrimaryButton, TextInput, Label, FieldError } from "@/components/ui";

const LEVELS = ["100L", "200L", "300L", "400L", "500L", "600L", "Postgraduate"];

const selectClass =
  "w-full rounded-md border border-[#27272a] bg-[#09090b] px-4 py-3 text-primary focus:border-accent focus:outline-none focus:ring-1 focus:ring-amber-500/20";

export function WelcomeForm({
  halls,
  userId,
}: {
  halls: { id: string; name: string }[];
  userId: string;
}) {
  const [state, action, pending] = useActionState<WelcomeState, FormData>(completeProfile, {});
  const [hall, setHall] = useState("");
  const [avatarUrl, setAvatarUrl] = useState("");
  const [uploading, setUploading] = useState(false);

  async function onPhoto(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    const supabase = createClient();
    const path = `${userId}/avatar.jpg`;
    const { error } = await supabase.storage
      .from("avatars")
      .upload(path, file, { upsert: true, contentType: file.type });
    if (!error) {
      const { data } = supabase.storage.from("avatars").getPublicUrl(path);
      setAvatarUrl(data.publicUrl);
    }
    setUploading(false);
  }

  return (
    <div className="mx-auto min-h-dvh w-full max-w-[420px] px-5 pb-28 pt-16 sm:px-7">
      <h1 className="mb-8 font-serif text-[28px] italic leading-none text-primary">
        One more thing.
      </h1>

      <form action={action} className="flex flex-col gap-4">
        <input type="hidden" name="avatar_url" value={avatarUrl} />

        <div>
          <Label htmlFor="full_name">Full name</Label>
          <TextInput id="full_name" name="full_name" required autoComplete="name" />
        </div>

        <div>
          <Label htmlFor="hall_id">Hall</Label>
          <select
            id="hall_id"
            name="hall_id"
            required
            value={hall}
            onChange={(e) => setHall(e.target.value)}
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
            <option value="__other__">Other</option>
          </select>
        </div>

        {hall === "__other__" && (
          <div>
            <Label htmlFor="custom_hall">Your hall</Label>
            <TextInput id="custom_hall" name="custom_hall" placeholder="Name your hall" />
          </div>
        )}

        <div>
          <Label htmlFor="course">Course</Label>
          <TextInput id="course" name="course" required placeholder="e.g., Mechanical Engineering" />
        </div>

        <div>
          <Label htmlFor="academic_level">Academic level</Label>
          <select id="academic_level" name="academic_level" required defaultValue="" className={selectClass}>
            <option value="" disabled>
              Select your level
            </option>
            {LEVELS.map((l) => (
              <option key={l} value={l}>
                {l}
              </option>
            ))}
          </select>
        </div>

        <div>
          <Label htmlFor="photo">Profile photo (optional)</Label>
          <input
            id="photo"
            type="file"
            accept="image/*"
            onChange={onPhoto}
            className="block w-full text-[13px] text-tertiary file:mr-3 file:rounded-md file:border-0 file:bg-[#27272a] file:px-4 file:py-2 file:text-primary"
          />
          {uploading && <p className="mt-2 text-[12px] text-tertiary">Uploading…</p>}
          {avatarUrl && !uploading && (
            <p className="mt-2 text-[12px] text-verified">Photo added.</p>
          )}
        </div>

        <FieldError>{state.error}</FieldError>

        <div className="fixed inset-x-0 bottom-0 border-t border-[#27272a] bg-bg px-5 py-3 pb-safe sm:static sm:border-0 sm:bg-transparent sm:px-0 sm:py-0">
          <div className="mx-auto max-w-[420px]">
            <PrimaryButton type="submit" disabled={pending} className="h-[52px]">
              {pending ? "Saving…" : "Enter Forge"}
            </PrimaryButton>
          </div>
        </div>
      </form>
    </div>
  );
}
