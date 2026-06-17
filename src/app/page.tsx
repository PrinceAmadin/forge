import { redirect } from "next/navigation";

// "/" is public; the leaderboard is the product, so send everyone there.
// Middleware bounces unauthenticated visitors to /auth and back.
export default function Home() {
  redirect("/leaderboard");
}
