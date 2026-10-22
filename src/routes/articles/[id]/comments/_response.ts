import { z } from "zod";
import type { CommentRow } from "./_queries";

export const commentResponseSchema = z.object({
  id: z.string(),
  articleId: z.string(),
  body: z.string(),
  author: z.object({ id: z.string(), name: z.string() }),
  createdAt: z.string(),
});

export const commentResponse = (comment: CommentRow): z.infer<typeof commentResponseSchema> => ({
  id: comment.id,
  articleId: comment.articleId,
  body: comment.body,
  author: { id: comment.authorId, name: comment.authorName },
  createdAt: comment.createdAt.toISOString(),
});
