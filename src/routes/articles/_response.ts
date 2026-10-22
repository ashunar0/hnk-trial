import { z } from "zod";
import { articleStatusSchema } from "#src/domains/articles/model";
import type { ArticleRow } from "./_queries";

export const articleResponseSchema = z.object({
  id: z.string(),
  title: z.string(),
  body: z.string(),
  status: articleStatusSchema,
  publishedAt: z.string().nullable(),
  author: z.object({ id: z.string(), name: z.string() }),
  commentCount: z.number(),
  createdAt: z.string(),
  updatedAt: z.string(),
});

export const articleResponse = (article: ArticleRow): z.infer<typeof articleResponseSchema> => ({
  id: article.id,
  title: article.title,
  body: article.body,
  status: article.status,
  publishedAt: article.publishedAt?.toISOString() ?? null,
  author: { id: article.authorId, name: article.authorName },
  commentCount: Number(article.commentCount),
  createdAt: article.createdAt.toISOString(),
  updatedAt: article.updatedAt.toISOString(),
});
