/**
 * The comment. What it is and which rules it has (What).
 * It knows no steps, HTTP or DB. Every other file points here.
 *
 * A comment is written on a published article. It stays when the article is unpublished.
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

/** An ID in the input (URL or body). Branded once it passes validation */
export const commentIdSchema = z.string().min(1).transform(commentId);

export type Comment = {
  id: CommentId;
  /** The article's ID (another domain's ID is a plain string) */
  articleId: string;
  /** The author's user ID */
  authorId: string;
  body: string;
  createdAt: Date;
  updatedAt: Date;
};

/** The body is 1 to 1000 characters after trimming */
export const commentInputSchema = z.object({
  body: z.string().trim().min(1).max(1000),
});

export type CommentInput = z.infer<typeof commentInputSchema>;

/**
 * The article a comment is written on. Only what this domain needs; the status is a copy of the
 * articles domain's value, kept here so domains do not import each other
 */
export type CommentTarget = { id: string; status: string };

/** Comments are written on published articles only */
export const isCommentable = (target: CommentTarget) => target.status === "published";
