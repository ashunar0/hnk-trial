/**
 * The steps for comments (How). What to do with the domain thing, in what order
 */
import { err, ok, type Result } from "hono-kit/result";
import type { Account } from "#src/domains/accounts/model";
import {
  newCommentId,
  ProfileRequired,
  type Comment,
  type CommentId,
  type CommentInput,
} from "./model";

/**
 * The storage shape the steps need. Declared here, by the user of it; repo.d1.ts fulfills it
 */
export type CommentsRepository = {
  insert(comment: Comment): Promise<Comment>;
};

/**
 * What a comment is decided from. Both belong to other domains, so the entry point reads them and hands them in:
 * the published article it hangs under (absent ones never get here: the entry point returns 404),
 * and the writer's profile (null when they have none)
 */
export type Commenting = {
  article: { id: string };
  profile: { userId: string } | null;
};

/**
 * Argument order: as whom (actor) → what → how → when (now).
 * It never reads the clock. Steps that need time take the now decided by the entry point
 */
export function commentsService(repo: CommentsRepository) {
  return {
    async create(
      actor: Account,
      { article, profile }: Commenting,
      input: CommentInput,
      now: Date,
    ): Promise<Result<CommentId, typeof ProfileRequired.code>> {
      if (profile === null) return err(ProfileRequired.code);
      if (profile.userId !== actor.id)
        throw new Error(`profile ${profile.userId} is not the actor ${actor.id}`);

      const created = await repo.insert({
        id: newCommentId(),
        articleId: article.id,
        authorId: actor.id,
        body: input.body,
        createdAt: now,
      });

      return ok(created.id);
    },
  };
}
