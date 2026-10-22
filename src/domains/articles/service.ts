/**
 * The steps for articles (How). What to do with the domain thing, in what order
 */
import { err, ok, type Result } from "hono-kit/result";
import { Forbidden, NotFound } from "hono-kit/failures";
import type { User } from "#src/domains/users/model";
import {
  AlreadyPublished,
  mayChange,
  newArticleId,
  NotPublished,
  ownReachOf,
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
  /** null if absent, or if the reach does not see it */
  find(reach: ArticleReach, id: ArticleId): Promise<Article | null>;
  insert(article: Article): Promise<Article>;
  /** null if absent, or if the reach does not touch it */
  update(
    reach: ArticleReach,
    id: ArticleId,
    changes: { title: string; body: string; updatedAt: Date },
  ): Promise<Article | null>;
  /** true when a row was deleted */
  delete(reach: ArticleReach, id: ArticleId): Promise<boolean>;
  /** Moves from one status to the other in one statement. null if it is not in `from` any more */
  transition(
    reach: ArticleReach,
    id: ArticleId,
    from: ArticleStatus,
    changes: { status: ArticleStatus; publishedAt: Date | null; updatedAt: Date },
  ): Promise<Article | null>;
};

type NotFoundOrForbidden = typeof NotFound.code | typeof Forbidden.code;

/**
 * Argument order: as whom (actor) → what → how → when (now).
 * It never reads the clock. Steps that need time take the now decided by the entry point
 */
export function articlesService(repo: ArticlesRepository) {
  /** What the actor sees (a draft of someone else is absent), and may change (the author) */
  const findChangeable = async (
    actor: User,
    id: ArticleId,
  ): Promise<Result<Article, NotFoundOrForbidden>> => {
    const found = await repo.find(reachOf(actor), id);
    if (found === null) return err(NotFound.code);
    if (!mayChange(actor, found)) return err(Forbidden.code);

    return ok(found);
  };

  return {
    /** An article the actor sees. null-like NOT_FOUND for a draft of someone else */
    async get(actor: User, id: ArticleId): Promise<Result<Article, typeof NotFound.code>> {
      const found = await repo.find(reachOf(actor), id);
      if (found === null) return err(NotFound.code);

      return ok(found);
    },

    /** A new article is a draft */
    async create(actor: User, input: ArticleInput, now: Date): Promise<ArticleId> {
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

      return created.id;
    },

    async update(
      actor: User,
      id: ArticleId,
      input: ArticleInput,
      now: Date,
    ): Promise<Result<void, NotFoundOrForbidden>> {
      const target = await findChangeable(actor, id);
      if (!target.ok) return target;

      const updated = await repo.update(ownReachOf(actor), id, {
        title: input.title,
        body: input.body,
        updatedAt: now,
      });
      if (updated === null) return err(NotFound.code);

      return ok(undefined);
    },

    async remove(actor: User, id: ArticleId): Promise<Result<void, NotFoundOrForbidden>> {
      const target = await findChangeable(actor, id);
      if (!target.ok) return target;

      const deleted = await repo.delete(ownReachOf(actor), id);
      if (!deleted) return err(NotFound.code);

      return ok(undefined);
    },

    async publish(
      actor: User,
      id: ArticleId,
      now: Date,
    ): Promise<Result<void, NotFoundOrForbidden | typeof AlreadyPublished.code>> {
      const target = await findChangeable(actor, id);
      if (!target.ok) return target;
      if (target.value.status === "published") return err(AlreadyPublished.code);

      const moved = await repo.transition(ownReachOf(actor), id, "draft", {
        status: "published",
        publishedAt: now,
        updatedAt: now,
      });
      // Another request published it first
      if (moved === null) return err(AlreadyPublished.code);

      return ok(undefined);
    },

    async unpublish(
      actor: User,
      id: ArticleId,
      now: Date,
    ): Promise<Result<void, NotFoundOrForbidden | typeof NotPublished.code>> {
      const target = await findChangeable(actor, id);
      if (!target.ok) return target;
      if (target.value.status === "draft") return err(NotPublished.code);

      const moved = await repo.transition(ownReachOf(actor), id, "published", {
        status: "draft",
        publishedAt: null,
        updatedAt: now,
      });
      // Another request unpublished it first
      if (moved === null) return err(NotPublished.code);

      return ok(undefined);
    },
  };
}
