import { z } from "zod";
import type { CommentRow } from "./_queries";

export const commentResponseSchema = z.object({
  id: z.string(),
  body: z.string(),
  author: z.object({ id: z.string(), displayName: z.string() }),
  createdAt: z.string(),
});

export const commentResponse = (row: CommentRow): z.infer<typeof commentResponseSchema> => ({
  id: row.id,
  body: row.body,
  author: row.author,
  createdAt: row.createdAt.toISOString(),
});
