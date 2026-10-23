/**
 * The article. What it is and which rules it has (What).
 * It knows no steps, HTTP or DB. Every other file points here.
 */
import { z } from "zod";
import type { Account } from "#src/domains/accounts/model";

declare const articleIdBrand: unique symbol;

export type ArticleId = string & { readonly [articleIdBrand]: true };

/** Brands a string from outside or from the DB as an article ID. The only place that writes `as` */
export const articleId = (value: string) => value as ArticleId;

export const newArticleId = () => articleId(crypto.randomUUID());

/** An ID in the input (URL or body). Branded once it passes validation */
export const articleIdSchema = z.string().min(1).transform(articleId);

export const articleStatuses = ["draft", "published"] as const;
export const articleStatusSchema = z.enum(articleStatuses);
export type ArticleStatus = z.infer<typeof articleStatusSchema>;

export type Article = {
  id: ArticleId;
  /** The author's account ID (the author must have a profile) */
  authorId: string;
  title: string;
  body: string;
  status: ArticleStatus;
  /** null while a draft */
  publishedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
};

/** POST and PUT of an article: the whole input */
export const articleInputSchema = z.object({
  title: z.string().trim().min(1).max(200),
  body: z.string().min(1),
});

export type ArticleInput = z.infer<typeof articleInputSchema>;

export const AlreadyPublished = {
  code: "ALREADY_PUBLISHED",
  kind: "conflict",
  message: "The article is already published",
} as const;

export const NotPublished = {
  code: "NOT_PUBLISHED",
  kind: "conflict",
  message: "The article is not published",
} as const;

/**
 * Who sees which articles: a published one is seen by everyone, a draft only by its author.
 * viewerId is null when signed out
 */
export type ArticleReach = { kind: "published-or-own"; viewerId: string | null };

export const reachOf = (actor: Account | null): ArticleReach => ({
  kind: "published-or-own",
  viewerId: actor === null ? null : actor.id,
});

/** Only the author changes an article (edit, delete, publish, unpublish) */
export const mayChange = (actor: Account, article: Article) => article.authorId === actor.id;

export const isPublished = (article: Pick<Article, "status">) => article.status === "published";

export const canPublish = (article: Article) => article.status === "draft";

export const canUnpublish = (article: Article) => article.status === "published";
