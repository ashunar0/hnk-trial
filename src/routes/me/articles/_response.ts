/**
 * How one's own article is shown in /me/articles
 */
import { z } from "zod";
import { articleStatusSchema } from "#src/domains/articles/model";
import type { MyArticleRow } from "./_queries";

export const myArticleResponseSchema = z.object({
  id: z.string(),
  title: z.string(),
  status: articleStatusSchema,
  /** null while a draft */
  publishedAt: z.number().nullable(),
  createdAt: z.number(),
  updatedAt: z.number(),
});

export const myArticleResponse = (
  article: MyArticleRow,
): z.infer<typeof myArticleResponseSchema> => ({
  id: article.id,
  title: article.title,
  status: article.status,
  publishedAt: article.publishedAt?.getTime() ?? null,
  createdAt: article.createdAt.getTime(),
  updatedAt: article.updatedAt.getTime(),
});
