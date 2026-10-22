/**
 * The article. What it is and which rules it has (What).
 * It knows no steps, HTTP or DB. Every other file points here.
 * Written as a draft, then published; publishing can be taken back, which makes it a draft again
 */
import { z } from "zod";
import type { User } from "#src/domains/users/model";

/**
 * The article ID. A brand to tell it apart from a plain string.
 * Mixing it up with other IDs is a type error. Only articleId below may apply the brand
 */
declare const articleIdBrand: unique symbol;

export type ArticleId = string & { readonly [articleIdBrand]: true };

/** Brands a string from outside or from the DB as an article ID. The only place that writes `as` */
export const articleId = (value: string) => value as ArticleId;

export const newArticleId = () => articleId(crypto.randomUUID());

/** An ID in the input (URL or body). Branded once it passes validation */
export const articleIdSchema = z.string().min(1).transform(articleId);

/** draft → published → draft → ... */
export const articleStatuses = ["draft", "published"] as const;

export type ArticleStatus = (typeof articleStatuses)[number];

export const articleStatusSchema = z.enum(articleStatuses);

export type Article = {
  id: ArticleId;
  /** The author's user ID. A plain string inside this domain */
  authorId: string;
  title: string;
  body: string;
  status: ArticleStatus;
  /** When it was last published. null while a draft */
  publishedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
};

export const articleInputSchema = z.strictObject({
  title: z.string().trim().min(1).max(200),
  body: z.string().min(1),
});

export type ArticleInput = z.infer<typeof articleInputSchema>;

/** Someone without a profile tried to write. The same rule (and code) lives in comments, as its own copy */
export const ProfileRequired = {
  code: "PROFILE_REQUIRED",
  kind: "conflict",
  message: "Save a profile before writing",
} as const;

export const AlreadyPublished = {
  code: "ALREADY_PUBLISHED",
  kind: "conflict",
  message: "The article is published already",
} as const;

export const NotPublished = {
  code: "NOT_PUBLISHED",
  kind: "conflict",
  message: "The article is a draft",
} as const;

/**
 * Which articles someone sees: published ones, and their own drafts when signed in.
 * Seeing is not changing: only the author changes one (mayChange)
 */
export type ArticleReach = { kind: "published" } | { kind: "publishedOrOwn"; userId: string };

/** null is someone signed out */
export const reachOf = (actor: User | null): ArticleReach =>
  actor === null ? { kind: "published" } : { kind: "publishedOrOwn", userId: actor.id };

/** Only the author changes, deletes, publishes or unpublishes an article */
export const mayChange = (actor: User, article: Pick<Article, "authorId">) =>
  article.authorId === actor.id;

/** A published article always has publishedAt; only a draft has none */
export const publishedAtOf = (article: { id: string; publishedAt: Date | null }) => {
  if (article.publishedAt === null)
    throw new Error(`published article ${article.id} has no publishedAt`);

  return article.publishedAt;
};
