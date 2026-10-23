/**
 * The comment: a person's words on a published article.
 */
import { z } from "zod";

declare const commentIdBrand: unique symbol;

export type CommentId = string & { readonly [commentIdBrand]: true };

/** Brands a string from outside or from the DB as a comment ID. The only place that writes `as` */
export const commentId = (value: string) => value as CommentId;

export const newCommentId = () => commentId(crypto.randomUUID());

export const commentIdSchema = z.string().min(1).transform(commentId);

export type Comment = {
  id: CommentId;
  /** The article's ID (a plain string: the articles domain owns the brand) */
  articleId: string;
  /** The author's account ID */
  authorId: string;
  body: string;
  createdAt: Date;
};

export const commentInputSchema = z.object({
  body: z.string().trim().min(1).max(1000),
});

export type CommentInput = z.infer<typeof commentInputSchema>;
