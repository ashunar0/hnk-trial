import { z } from "zod";
import { articleStatusSchema } from "#src/domains/articles/model";
import type { ArticleListRow, ArticleRow, MyArticleRow } from "./_queries";

const authorSchema = z.object({ id: z.string(), displayName: z.string() });

/** GET /articles/:id, and after a write */
export const articleResponseSchema = z.object({
  id: z.string(),
  title: z.string(),
  body: z.string(),
  author: authorSchema,
  status: articleStatusSchema,
  publishedAt: z.string().nullable(),
  commentCount: z.number(),
  createdAt: z.string(),
  updatedAt: z.string(),
});

export const articleResponse = (row: ArticleRow): z.infer<typeof articleResponseSchema> => ({
  id: row.id,
  title: row.title,
  body: row.body,
  author: row.author,
  status: row.status,
  publishedAt: row.publishedAt === null ? null : row.publishedAt.toISOString(),
  commentCount: row.commentCount,
  createdAt: row.createdAt.toISOString(),
  updatedAt: row.updatedAt.toISOString(),
});

/** A line of GET /articles and GET /users/:id/articles */
export const articleListItemSchema = z.object({
  id: z.string(),
  title: z.string(),
  author: authorSchema,
  publishedAt: z.string(),
  commentCount: z.number(),
});

export const articleListItem = (row: ArticleListRow): z.infer<typeof articleListItemSchema> => ({
  id: row.id,
  title: row.title,
  author: row.author,
  publishedAt: row.publishedAt.toISOString(),
  commentCount: row.commentCount,
});

/** A line of GET /me/articles */
export const myArticleItemSchema = z.object({
  id: z.string(),
  title: z.string(),
  status: articleStatusSchema,
  publishedAt: z.string().nullable(),
  createdAt: z.string(),
  updatedAt: z.string(),
});

export const myArticleItem = (row: MyArticleRow): z.infer<typeof myArticleItemSchema> => ({
  id: row.id,
  title: row.title,
  status: row.status,
  publishedAt: row.publishedAt === null ? null : row.publishedAt.toISOString(),
  createdAt: row.createdAt.toISOString(),
  updatedAt: row.updatedAt.toISOString(),
});
