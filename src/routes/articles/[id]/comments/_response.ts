/**
 * How a comment is shown over HTTP
 */
import { z } from "zod";
import type { CommentRow } from "./_queries";

export const commentResponseSchema = z.object({
  id: z.string(),
  body: z.string(),
  author: z.object({ id: z.string(), name: z.string() }),
  createdAt: z.number(),
});

export const commentResponse = (comment: CommentRow): z.infer<typeof commentResponseSchema> => ({
  id: comment.id,
  body: comment.body,
  author: comment.author,
  createdAt: comment.createdAt.getTime(),
});
