import { z } from "zod";
import { passwordProblem, isOurBlobUrl } from "@/lib/policies";

/** Shared password rule for every route that sets a password. */
export const passwordSchema = z.string().superRefine((value, ctx) => {
  const problem = passwordProblem(value);
  if (problem) ctx.addIssue({ code: z.ZodIssueCode.custom, message: problem });
});

/** One readable sentence from a failed zod parse, so forms can show it. */
export function firstIssue(err: z.ZodError): string {
  const issue = err.issues[0];
  if (!issue) return "Invalid input.";
  const field = issue.path.join(".");
  return field ? `${field}: ${issue.message}` : issue.message;
}

/** A stored owner-document link must point at our own file storage, never an arbitrary website. */
export const ownerDocumentUrlSchema = z
  .string()
  .url()
  .refine(isOurBlobUrl, { message: "Document links must come from secure storage." })
  .optional()
  .nullable();
