/**
 * How an article is shown over HTTP: a summary in the lists of published ones, and one in full
 */
import { z } from "zod";
import { articleStatusSchema, publishedAtOf } from "#src/domains/articles/model";
import type { ArticleRow, ArticleSummaryRow } from "./_queries";

const authorSchema = z.object({ id: z.string(), name: z.string() });

export const articleSummaryResponseSchema = z.object({
  id: z.string(),
  title: z.string(),
  author: authorSchema,
  publishedAt: z.number(),
  commentCount: z.number(),
});

export const articleSummaryResponse = (
  article: ArticleSummaryRow,
): z.infer<typeof articleSummaryResponseSchema> => ({
  id: article.id,
  title: article.title,
  author: article.author,
  publishedAt: publishedAtOf(article).getTime(),
  commentCount: article.commentCount,
});

export const articleResponseSchema = z.object({
  id: z.string(),
  title: z.string(),
  body: z.string(),
  author: authorSchema,
  status: articleStatusSchema,
  /** null while a draft */
  publishedAt: z.number().nullable(),
  commentCount: z.number(),
  createdAt: z.number(),
  updatedAt: z.number(),
});

export const articleResponse = (article: ArticleRow): z.infer<typeof articleResponseSchema> => ({
  id: article.id,
  title: article.title,
  body: article.body,
  author: article.author,
  status: article.status,
  publishedAt: article.publishedAt?.getTime() ?? null,
  commentCount: article.commentCount,
  createdAt: article.createdAt.getTime(),
  updatedAt: article.updatedAt.getTime(),
});
