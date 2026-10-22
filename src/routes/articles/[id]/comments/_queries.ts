/**
 * The reads of an article's comments. Whether the article is visible is checked by the handler first
 */
import { and, asc, eq, gt, or } from "drizzle-orm";
import { toPage, type Page, type PageQuery } from "hono-kit/page";
import type { ReadDb } from "#src/db/index";
import type { ArticleId } from "#src/domains/articles/model";
import type { CommentId } from "#src/domains/comments/model";
import { commentsWithin } from "#src/domains/comments/repo.d1";
import { profilesWithin } from "#src/domains/profiles/repo.d1";

const seen = (db: ReadDb) => {
  const comments = commentsWithin(db);
  const authors = profilesWithin(db);
  const query = db
    .select({
      id: comments.id,
      body: comments.body,
      author: { id: authors.userId, name: authors.name },
      createdAt: comments.createdAt,
    })
    .from(comments)
    .innerJoin(authors, eq(authors.userId, comments.authorId));

  return { comments, query };
};

/** A comment as shown. Its shape is the select above */
export type CommentRow = Awaited<ReturnType<typeof seen>["query"]>[number];

export function articleCommentsQueries(db: ReadDb) {
  return {
    /** The article's comments, oldest first */
    async list(articleId: ArticleId, { after, limit }: PageQuery): Promise<Page<CommentRow>> {
      const { comments, query } = seen(db);
      const rows = await query
        .where(
          and(
            eq(comments.articleId, articleId),
            after
              ? or(
                  gt(comments.createdAt, after.at),
                  and(eq(comments.createdAt, after.at), gt(comments.id, after.id)),
                )
              : undefined,
          ),
        )
        .orderBy(asc(comments.createdAt), asc(comments.id))
        .limit(limit + 1);

      return toPage(rows, limit, (row) => ({ at: row.createdAt, id: row.id }));
    },

    /** For the read after a write. null if absent */
    async get(id: CommentId): Promise<CommentRow | null> {
      const { comments, query } = seen(db);
      const [row] = await query.where(eq(comments.id, id)).limit(1);

      return row ?? null;
    },
  };
}
