"use client";

import { useState } from "react";
import Link from "next/link";
import { TextInput } from "@/components/ui";
import type { Role } from "@/lib/types";

export interface UserRow {
  id: string;
  fullName: string;
  email: string;
  role: Role;
}

function roleClass(role: Role): string {
  return role === "super_admin" ? "text-accent" : role === "admin" ? "text-primary" : "text-tertiary";
}

export function UsersList({ users }: { users: UserRow[] }) {
  const [q, setQ] = useState("");
  const term = q.trim().toLowerCase();
  const filtered = term
    ? users.filter((u) => u.fullName.toLowerCase().includes(term) || u.email.toLowerCase().includes(term))
    : users;

  return (
    <div className="mt-6">
      <TextInput
        value={q}
        onChange={(e) => setQ(e.target.value)}
        placeholder="Search by name or email"
        className="text-[16px]"
      />
      <ul className="mt-2 border-b border-[#27272a]">
        {filtered.map((u) => (
          <li key={u.id}>
            <Link
              href={`/admin/users/${u.id}`}
              className="flex items-center justify-between gap-4 border-t border-[#27272a] py-3.5 transition-colors active:bg-zinc-900/40 sm:hover:bg-zinc-900/40"
            >
              <span className="min-w-0">
                <span className="block truncate text-[14px] text-primary">{u.fullName}</span>
                <span className="block truncate text-[12px] text-tertiary">{u.email}</span>
              </span>
              <span
                className={`shrink-0 text-[10px] lowercase ${roleClass(u.role)}`}
                style={{ letterSpacing: "0.18em" }}
              >
                {u.role}
              </span>
            </Link>
          </li>
        ))}
        {filtered.length === 0 && (
          <li className="border-t border-[#27272a] py-4 text-[13px] text-tertiary">No matches.</li>
        )}
      </ul>
    </div>
  );
}
