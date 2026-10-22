/**
 * The steps for articles (How). What to do with the domain thing, in what order
 */
import { err, ok, type Result } from "hono-kit/result";
import { Forbidden, NotFound } from "hono-kit/failures";
import type { Account } from "#src/domains/accounts/model";
import {
  AlreadyPublished,
  mayChange,
  newArticleId,
  NotPublished,
  ProfileRequired,
  reachOf,
  type Article,
  type ArticleId,
  type ArticleInput,
  type ArticleReach,
  type ArticleStatus,
} from "./model";

/**
 * The storage shape the steps need. Declared here, by the user of it; repo.d1.ts fulfills it.
 * service does not know the storage implementation, so tests can pass a stand-in of the same shape
 */
export type ArticlesRepository = {
  /** null if absent, or outside the reach */
  find(reach: ArticleReach, id: ArticleId): Promise<Article | null>;
  insert(article: Article): Promise<Article>;
  /** null if absent, or outside the reach */
  update(
    reach: ArticleReach,
    id: ArticleId,
    changes: Pick<Article, "title" | "body" | "updatedAt">,
  ): Promise<Article | null>;
  /** false if absent, or outside the reach */
  delete(reach: ArticleReach, id: ArticleId): Promise<boolean>;
  /** Moves it only from `from`, in one statement. null if it is not in `from` (any more) */
  transition(
    reach: ArticleReach,
    id: ArticleId,
    from: ArticleStatus,
    changes: Pick<Article, "status" | "publishedAt" | "updatedAt">,
  ): Promise<Article | null>;
};

/**
 * Who writes it. The profile belongs to another domain, so the entry point reads it and hands it in
 * (null when the actor has none)
 */
export type Authoring = {
  profile: { userId: string } | null;
};

type NotFoundOrForbidden = typeof NotFound.code | typeof Forbidden.code;

/**
 * Argument order: as whom (actor) → what → how → when (now).
 * It never reads the clock. Steps that need time take the now decided by the entry point
 */
export function articlesService(repo: ArticlesRepository) {
  /** NOT_FOUND when the actor does not see it, FORBIDDEN when they see it but are not the author */
  const findChangeable = async (
    actor: Account,
    id: ArticleId,
  ): Promise<Result<Article, NotFoundOrForbidden>> => {
    const found = await repo.find(reachOf(actor), id);
    if (found === null) return err(NotFound.code);
    if (!mayChange(actor, found)) return err(Forbidden.code);

    return ok(found);
  };

  return {
    /** A published article, whoever asks. For things that hang under it (comments) */
    async getPublished(id: ArticleId): Promise<Result<Article, typeof NotFound.code>> {
      const found = await repo.find(reachOf(null), id);
      if (found === null) return err(NotFound.code);

      return ok(found);
    },

    /** Every article starts as a draft */
    async create(
      actor: Account,
      { profile }: Authoring,
      input: ArticleInput,
      now: Date,
    ): Promise<Result<ArticleId, typeof ProfileRequired.code>> {
      if (profile === null) return err(ProfileRequired.code);
      if (profile.userId !== actor.id)
        throw new Error(`profile ${profile.userId} is not the actor ${actor.id}`);

      const created = await repo.insert({
        id: newArticleId(),
        authorId: actor.id,
        title: input.title,
        body: input.body,
        status: "draft",
        publishedAt: null,
        createdAt: now,
        updatedAt: now,
      });

      return ok(created.id);
    },

    async update(
      actor: Account,
      id: ArticleId,
      input: ArticleInput,
      now: Date,
    ): Promise<Result<void, NotFoundOrForbidden>> {
      const found = await findChangeable(actor, id);
      if (!found.ok) return found;

      const updated = await repo.update(reachOf(actor), id, { ...input, updatedAt: now });
      // Deleted in between
      if (updated === null) return err(NotFound.code);

      return ok(undefined);
    },

    async remove(actor: Account, id: ArticleId): Promise<Result<void, NotFoundOrForbidden>> {
      const found = await findChangeable(actor, id);
      if (!found.ok) return found;

      if (!(await repo.delete(reachOf(actor), id))) return err(NotFound.code);

      return ok(undefined);
    },

    async publish(
      actor: Account,
      id: ArticleId,
      now: Date,
    ): Promise<Result<void, NotFoundOrForbidden | typeof AlreadyPublished.code>> {
      const found = await findChangeable(actor, id);
      if (!found.ok) return found;
      if (found.value.status !== "draft") return err(AlreadyPublished.code);

      const moved = await repo.transition(reachOf(actor), id, "draft", {
        status: "published",
        publishedAt: now,
        updatedAt: now,
      });
      // Another request published it first
      if (moved === null) return err(AlreadyPublished.code);

      return ok(undefined);
    },

    async unpublish(
      actor: Account,
      id: ArticleId,
      now: Date,
    ): Promise<Result<void, NotFoundOrForbidden | typeof NotPublished.code>> {
      const found = await findChangeable(actor, id);
      if (!found.ok) return found;
      if (found.value.status !== "published") return err(NotPublished.code);

      const moved = await repo.transition(reachOf(actor), id, "published", {
        status: "draft",
        publishedAt: null,
        updatedAt: now,
      });
      // Another request took it back first
      if (moved === null) return err(NotPublished.code);

      return ok(undefined);
    },
  };
}
