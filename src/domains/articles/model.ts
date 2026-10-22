/**
 * The article. What it is and which rules it has (What).
 * It knows no steps, HTTP or DB. Every other file points here.
 *
 * A draft is seen only by its author. A published article is seen by everyone.
 * Only the author changes, deletes, publishes or unpublishes it.
 */
import { z } from "zod";
import type { Failure } from "hono-kit/failures";
import type { Actor, User } from "#src/domains/users/model";

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

export const articleStatuses = ["draft", "published"] as const;

export const articleStatusSchema = z.enum(articleStatuses);

export type ArticleStatus = z.infer<typeof articleStatusSchema>;

export type Article = {
  id: ArticleId;
  /** The author's user ID (another domain's ID is a plain string) */
  authorId: string;
  title: string;
  body: string;
  status: ArticleStatus;
  /** When it was published last. null while it is a draft */
  publishedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
};

/** The title is 1 to 200 characters after trimming; the body is at least 1 character */
export const articleInputSchema = z.object({
  title: z.string().trim().min(1).max(200),
  body: z.string().min(1),
});

export type ArticleInput = z.infer<typeof articleInputSchema>;

export const AlreadyPublished = {
  code: "ALREADY_PUBLISHED",
  kind: "conflict",
  message: "The article is already published",
} as const satisfies Failure;

export const NotPublished = {
  code: "NOT_PUBLISHED",
  kind: "conflict",
  message: "The article is not published",
} as const satisfies Failure;

/**
 * Which articles one looks at.
 * - all: the system
 * - published: someone who is not signed in
 * - visible: published ones, and one's own drafts
 * - own: only what one wrote (for writing)
 */
export type ArticleReach =
  | { kind: "all" }
  | { kind: "published" }
  | { kind: "visible"; userId: string }
  | { kind: "own"; userId: string };

/** Who sees what. null is someone who is not signed in */
export const reachOf = (viewer: Actor | null): ArticleReach => {
  if (viewer === null) return { kind: "published" };
  if (viewer.kind === "system") return { kind: "all" };

  return { kind: "visible", userId: viewer.id };
};

/** What one may write */
export const ownReachOf = (actor: User): ArticleReach => ({ kind: "own", userId: actor.id });

/** Only the author changes, deletes, publishes or unpublishes */
export const mayChange = (actor: User, article: Article) => article.authorId === actor.id;
