"use server";

import { redirect } from "next/navigation";
import { createClient, createAdminClient } from "@/lib/supabase/server";

export type WelcomeState = { error?: string };

export async function completeProfile(
  _prev: WelcomeState,
  formData: FormData
): Promise<WelcomeState> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/auth");

  const fullName = String(formData.get("full_name") ?? "").trim();
  const course = String(formData.get("course") ?? "").trim();
  const level = String(formData.get("academic_level") ?? "").trim();
  const hallId = String(formData.get("hall_id") ?? "").trim();
  const customHall = String(formData.get("custom_hall") ?? "").trim();
  const avatarUrl = String(formData.get("avatar_url") ?? "").trim();

  if (!fullName || !course || !level) {
    return { error: "Fill in your name, course, and level." };
  }

  // "Other" hall → create it with the service role (halls are superadmin-write).
  let resolvedHallId: string | null = hallId || null;
  if (hallId === "__other__") {
    if (!customHall) return { error: "Name your hall." };
    const admin = createAdminClient();
    const { data: existing } = await admin
      .from("halls")
      .select("id")
      .ilike("name", customHall)
      .maybeSingle();
    if (existing) {
      resolvedHallId = existing.id as string;
    } else {
      const { data: created, error } = await admin
        .from("halls")
        .insert({ name: customHall })
        .select("id")
        .single();
      if (error) return { error: "Couldn't save that hall. Try again." };
      resolvedHallId = created.id as string;
    }
  }

  const { error } = await supabase.from("profiles").insert({
    id: user.id,
    full_name: fullName,
    hall_id: resolvedHallId,
    course,
    academic_level: level,
    avatar_url: avatarUrl || null,
  });
  if (error) return { error: "Couldn't save your profile. Try again." };

  await supabase.from("events").insert({ user_id: user.id, name: "profile.completed" });
  redirect("/exam-flame");
}
