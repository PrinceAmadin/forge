import { describe, expect, it } from "vitest";
import { SUBMISSIONS_BUCKET, submissionStoragePath } from "@/lib/storage";

const UID = "11111111-2222-3333-4444-555555555555";

describe("submissionStoragePath", () => {
  it("builds the documented shape", () => {
    expect(submissionStoragePath("exam-flame", UID, 5)).toBe(`exam-flame/${UID}/5.jpg`);
  });

  // The storage policies in 0004_storage.sql authorize uploads with
  // (storage.foldername(name))[2] = auth.uid(). foldername() returns the
  // directory segments, so the uid must be the 2nd of them. If this test fails,
  // every participant's upload authorization is broken.
  it("keeps the participant id as the second directory segment", () => {
    const path = submissionStoragePath("exam-flame", UID, 5);
    const segments = path.split("/");
    expect(segments).toHaveLength(3);
    expect(segments[1]).toBe(UID);
  });

  it("holds the shape for any challenge slug", () => {
    const path = submissionStoragePath("code-habit-2027", UID, 20);
    expect(path.split("/")[1]).toBe(UID);
    expect(path).toBe(`code-habit-2027/${UID}/20.jpg`);
  });

  it("is stable for the same inputs, so the mint and the insert agree", () => {
    // The original bug was these two diverging: requestUploadUrl computed the
    // path while createSubmission took it from the client.
    expect(submissionStoragePath("exam-flame", UID, 1)).toBe(
      submissionStoragePath("exam-flame", UID, 1)
    );
  });

  it("gives different days different objects", () => {
    expect(submissionStoragePath("exam-flame", UID, 1)).not.toBe(
      submissionStoragePath("exam-flame", UID, 2)
    );
  });

  it("names the private bucket the policies were written for", () => {
    expect(SUBMISSIONS_BUCKET).toBe("submissions");
  });
});
