import { and, asc, eq, gt, or } from "drizzle-orm";
import { toPage, type PageQuery } from "hono-kit/page";
import type { ReadDb } from "#src/db/index";
import type { CommentId } from "#src/domains/comments/model";
import { commentsWithin } from "#src/domains/comments/repo.d1";
import { usersWithin } from "#src/domains/users/repo.d1";

export function commentsQueries(db: ReadDb) {
  const select = () => {
    const comments = commentsWithin(db);
    const authors = usersWithin(db);

    return {
      comments,
      query: db
        .select({
          id: comments.id,
          articleId: comments.articleId,
          body: comments.body,
          createdAt: comments.createdAt,
          authorId: authors.id,
          authorName: authors.name,
        })
        .from(comments)
        .innerJoin(authors, eq(authors.id, comments.authorId)),
    };
  };

  return {
    /** The comments of an article, oldest first */
    async listOf(articleId: string, query: PageQuery) {
      const { comments, query: base } = select();
      const cursor = query.after;
      const rows = await base
        .where(
          and(
            eq(comments.articleId, articleId),
            cursor === undefined
              ? undefined
              : or(
                  gt(comments.createdAt, cursor.at),
                  and(eq(comments.createdAt, cursor.at), gt(comments.id, cursor.id)),
                ),
          ),
        )
        .orderBy(asc(comments.createdAt), asc(comments.id))
        .limit(query.limit + 1);

      return toPage(rows, query.limit, (row) => ({ at: row.createdAt, id: row.id }));
    },

    /** null if absent */
    async get(id: CommentId) {
      const { comments, query } = select();
      const [row] = await query.where(eq(comments.id, id)).limit(1);

      return row ?? null;
    },
  };
}

export type CommentRow = NonNullable<
  Awaited<ReturnType<ReturnType<typeof commentsQueries>["get"]>>
>;
