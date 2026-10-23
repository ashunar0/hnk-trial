import { and, asc, eq, gt, or } from "drizzle-orm";
import { toPage, type PageQuery } from "hono-kit/page";
import type { ReadDb } from "#src/db/index";
import type { ArticleId } from "#src/domains/articles/model";
import type { CommentId } from "#src/domains/comments/model";
import { commentsWithin } from "#src/domains/comments/repo.d1";
import { profilesWithin } from "#src/domains/profiles/repo.d1";

export type CommentRow = {
  id: string;
  body: string;
  author: { id: string; displayName: string };
  createdAt: Date;
};

/** The reads of comments: one, and an article's, oldest first */
export const commentsQueries = (db: ReadDb) => {
  const joined = () => {
    const comments = commentsWithin(db);
    const profiles = profilesWithin(db);
    const from = db
      .select({
        id: comments.id,
        body: comments.body,
        createdAt: comments.createdAt,
        authorId: profiles.accountId,
        authorName: profiles.displayName,
      })
      .from(comments)
      .innerJoin(profiles, eq(profiles.accountId, comments.authorId))
      .$dynamic();

    return { comments, from };
  };

  const toRow = (row: {
    id: string;
    body: string;
    createdAt: Date;
    authorId: string;
    authorName: string;
  }): CommentRow => ({
    id: row.id,
    body: row.body,
    author: { id: row.authorId, displayName: row.authorName },
    createdAt: row.createdAt,
  });

  return {
    async get(id: CommentId): Promise<CommentRow | null> {
      const { comments, from } = joined();
      const [row] = await from.where(eq(comments.id, id)).limit(1);

      return row === undefined ? null : toRow(row);
    },

    /** The comments of an article, oldest first. Whether the article is shown is the caller's check */
    async list(articleId: ArticleId, query: PageQuery) {
      const { comments, from } = joined();
      const { after } = query;
      const rows = await from
        .where(
          and(
            eq(comments.articleId, articleId),
            after === undefined
              ? undefined
              : or(
                  gt(comments.createdAt, after.at),
                  and(eq(comments.createdAt, after.at), gt(comments.id, after.id)),
                ),
          ),
        )
        .orderBy(asc(comments.createdAt), asc(comments.id))
        .limit(query.limit + 1);

      return toPage(rows.map(toRow), query.limit, (item) => ({ at: item.createdAt, id: item.id }));
    },
  };
};
