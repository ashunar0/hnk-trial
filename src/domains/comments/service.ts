/**
 * The steps for comments (How). What to do with the domain thing, in what order
 */
import { err, ok, type Result } from "hono-kit/result";
import { NotFound } from "hono-kit/failures";
import type { User } from "#src/domains/users/model";
import {
  isCommentable,
  newCommentId,
  type Comment,
  type CommentId,
  type CommentInput,
  type CommentTarget,
} from "./model";

/**
 * The storage shape the steps need. Declared here, by the user of it; repo.d1.ts fulfills it.
 * service does not know the storage implementation, so tests can pass a stand-in of the same shape
 */
export type CommentsRepository = {
  /** null if absent */
  find(id: CommentId): Promise<Comment | null>;
  insert(comment: Comment): Promise<Comment>;
};

/**
 * Argument order: as whom (actor) → what → how → when (now).
 * It never reads the clock. Steps that need time take the now decided by the entry point
 */
export function commentsService(repo: CommentsRepository) {
  return {
    async get(id: CommentId): Promise<Result<Comment, typeof NotFound.code>> {
      const found = await repo.find(id);
      if (found === null) return err(NotFound.code);

      return ok(found);
    },

    /**
     * Writes a comment on an article the handler has read (visible to the actor).
     * A draft cannot be commented on, and looks absent
     */
    async create(
      actor: User,
      target: CommentTarget,
      input: CommentInput,
      now: Date,
    ): Promise<Result<CommentId, typeof NotFound.code>> {
      if (!isCommentable(target)) return err(NotFound.code);

      const created = await repo.insert({
        id: newCommentId(),
        articleId: target.id,
        authorId: actor.id,
        body: input.body,
        createdAt: now,
        updatedAt: now,
      });

      return ok(created.id);
    },
  };
}
