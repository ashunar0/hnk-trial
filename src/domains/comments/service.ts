/**
 * The steps for comments (How)
 */
import { err, ok, type Result } from "hono-kit/result";
import { NotFound } from "hono-kit/failures";
import type { Account } from "#src/domains/accounts/model";
import { newCommentId, type Comment, type CommentId, type CommentInput } from "./model";

export type CommentsRepository = {
  insert(comment: Comment): Promise<void>;
};

/** What the steps need to know of the article: its ID and whether it is published */
export type CommentedArticle = { id: string; status: "draft" | "published" };

export function commentsService(repo: CommentsRepository) {
  return {
    /**
     * Writes a comment on an article. Only a published article takes comments: a draft is the same as absent.
     * The entry point has checked the actor has a profile
     */
    async create(
      actor: Account,
      article: CommentedArticle,
      input: CommentInput,
      now: Date,
    ): Promise<Result<CommentId, typeof NotFound.code>> {
      if (article.status !== "published") return err(NotFound.code);

      const id = newCommentId();
      await repo.insert({
        id,
        articleId: article.id,
        authorId: actor.id,
        body: input.body,
        createdAt: now,
      });

      return ok(id);
    },
  };
}
