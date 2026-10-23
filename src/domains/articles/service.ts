/**
 * The steps for articles (How). What to do with the domain thing, in what order
 */
import { err, ok, type Result } from "hono-kit/result";
import { Forbidden, NotFound } from "hono-kit/failures";
import type { Account } from "#src/domains/accounts/model";
import {
  AlreadyPublished,
  NotPublished,
  canPublish,
  canUnpublish,
  mayChange,
  newArticleId,
  reachOf,
  type Article,
  type ArticleId,
  type ArticleInput,
  type ArticleReach,
  type ArticleStatus,
} from "./model";

/**
 * The storage shape the steps need. Declared here, by the user of it; repo.d1.ts fulfills it.
 * Every method that takes a reach looks only at the articles that reach sees
 */
export type ArticlesRepository = {
  /** null if absent (or not seen by this reach) */
  find(reach: ArticleReach, id: ArticleId): Promise<Article | null>;
  insert(article: Article): Promise<void>;
  /** Changes title and body. null if absent */
  update(
    reach: ArticleReach,
    id: ArticleId,
    changes: { title: string; body: string; updatedAt: Date },
  ): Promise<Article | null>;
  delete(reach: ArticleReach, id: ArticleId): Promise<void>;
  /** One statement: only moves an article that is still in `from`. null if another request moved it first */
  transition(
    reach: ArticleReach,
    id: ArticleId,
    from: ArticleStatus,
    changes: { status: ArticleStatus; publishedAt: Date | null; updatedAt: Date },
  ): Promise<Article | null>;
};

type Changed = typeof NotFound.code | typeof Forbidden.code;

/**
 * Argument order: as whom (actor) → what → how → when (now).
 * It never reads the clock. Steps that need time take the now decided by the entry point
 */
export function articlesService(repo: ArticlesRepository) {
  /** Finds an article the actor sees (NOT_FOUND otherwise) and checks the actor is its author (FORBIDDEN) */
  const findOwn = async (actor: Account, id: ArticleId): Promise<Result<Article, Changed>> => {
    const found = await repo.find(reachOf(actor), id);
    if (found === null) return err(NotFound.code);
    if (!mayChange(actor, found)) return err(Forbidden.code);

    return ok(found);
  };

  return {
    /** An article the actor sees (a published one, or their own draft). The actor may be signed out */
    async get(
      actor: Account | null,
      id: ArticleId,
    ): Promise<Result<Article, typeof NotFound.code>> {
      const found = await repo.find(reachOf(actor), id);
      if (found === null) return err(NotFound.code);

      return ok(found);
    },

    /** Writes a draft. The author's profile is checked by the entry point; authorId is the account ID */
    async create(actor: Account, input: ArticleInput, now: Date): Promise<ArticleId> {
      const id = newArticleId();
      await repo.insert({
        id,
        authorId: actor.id,
        title: input.title,
        body: input.body,
        status: "draft",
        publishedAt: null,
        createdAt: now,
        updatedAt: now,
      });

      return id;
    },

    async update(
      actor: Account,
      id: ArticleId,
      input: ArticleInput,
      now: Date,
    ): Promise<Result<void, Changed>> {
      const found = await findOwn(actor, id);
      if (!found.ok) return err(found.error);

      const updated = await repo.update(reachOf(actor), id, { ...input, updatedAt: now });
      if (updated === null) return err(NotFound.code);

      return ok(undefined);
    },

    async remove(actor: Account, id: ArticleId): Promise<Result<void, Changed>> {
      const found = await findOwn(actor, id);
      if (!found.ok) return err(found.error);

      // The comments go with it: comments.article_id is ON DELETE CASCADE
      await repo.delete(reachOf(actor), id);

      return ok(undefined);
    },

    async publish(
      actor: Account,
      id: ArticleId,
      now: Date,
    ): Promise<Result<void, Changed | typeof AlreadyPublished.code>> {
      const found = await findOwn(actor, id);
      if (!found.ok) return err(found.error);
      if (!canPublish(found.value)) return err(AlreadyPublished.code);

      const moved = await repo.transition(reachOf(actor), id, "draft", {
        status: "published",
        publishedAt: now,
        updatedAt: now,
      });
      if (moved === null) return err(AlreadyPublished.code);

      return ok(undefined);
    },

    async unpublish(
      actor: Account,
      id: ArticleId,
      now: Date,
    ): Promise<Result<void, Changed | typeof NotPublished.code>> {
      const found = await findOwn(actor, id);
      if (!found.ok) return err(found.error);
      if (!canUnpublish(found.value)) return err(NotPublished.code);

      const moved = await repo.transition(reachOf(actor), id, "published", {
        status: "draft",
        publishedAt: null,
        updatedAt: now,
      });
      if (moved === null) return err(NotPublished.code);

      return ok(undefined);
    },
  };
}
