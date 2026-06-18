import { redirect } from "next/navigation";

// The admin surface is organised under /admin/*. Land on the review queue.
export default function AdminIndex() {
  redirect("/admin/queue");
}
