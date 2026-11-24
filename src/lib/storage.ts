export const SUBMISSIONS_BUCKET = "submissions";

// submissions/{challenge_slug}/{participant_id}/{day}.jpg
//
// The participant id MUST stay the 2nd path segment: the storage policies in
// supabase/migrations/0004_storage.sql authorize uploads with
// `(storage.foldername(name))[2] = auth.uid()::text`. Changing the shape of
// this path silently breaks upload authorization for every participant.
//
// Both the signed-URL mint and the submission insert derive the path from this
// one function so they cannot drift — the earlier bug was that the insert took
// the path from the client instead of recomputing it.
export function submissionStoragePath(
  challengeSlug: string,
  participantId: string,
  day: number
): string {
  return `${challengeSlug}/${participantId}/${day}.jpg`;
}
