/**
 * The comment on a published article (What). It knows no steps, HTTP or DB
 */
import { z } from "zod";

/**
 * The comment ID. A brand to tell it apart from a plain string.
 * Mixing it up with other IDs is a type error. Only commentId below may apply the brand
 */
declare const commentIdBrand: unique symbol;

export type CommentId = string & { readonly [commentIdBrand]: true };

/** Brands a string from outside or from the DB as a comment ID. The only place that writes `as` */
export const commentId = (value: string) => value as CommentId;

export const newCommentId = () => commentId(crypto.randomUUID());

export type Comment = {
  id: CommentId;
  /** The article it hangs under. A plain string inside this domain */
  articleId: string;
  /** The writer's user ID */
  authorId: string;
  body: string;
  createdAt: Date;
};

export const commentInputSchema = z.strictObject({
  body: z.string().trim().min(1).max(1000),
});

export type CommentInput = z.infer<typeof commentInputSchema>;

/** Someone without a profile tried to write. Its own copy of the rule articles also keeps */
export const ProfileRequired = {
  code: "PROFILE_REQUIRED",
  kind: "conflict",
  message: "Save a profile before writing",
} as const;
