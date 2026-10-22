/**
 * Storage for articles. Fulfills the ArticlesRepository declared in service.ts with D1.
 * Row shapes never leave this file; rows are mapped to the domain Article
 */
import { and, eq, or, sql } from "drizzle-orm";
import { index, integer, sqliteTable, text } from "drizzle-orm/sqlite-core";
import type { ReadDb, Scope } from "#src/db/index";
import { profilesTable } from "#src/domains/profiles/repo.d1";
import type { User } from "#src/domains/users/model";
import { articleId, articleStatuses, reachOf, type Article, type ArticleReach } from "./model";
import type { ArticlesRepository } from "./service";

/** Column default: the current time (ms). A SQL expression, not a JS Date */
const nowMs = sql`(cast(unixepoch('subsecond') * 1000 as integer))`;

export const articlesTable = sqliteTable(
  "articles",
  {
    id: text("id").primaryKey(),
    authorId: text("author_id")
      .notNull()
      .references(() => profilesTable.userId),
    title: text("title").notNull(),
    body: text("body").notNull(),
    status: text("status", { enum: articleStatuses }).notNull(),
    publishedAt: integer("published_at", { mode: "timestamp_ms" }),
    createdAt: integer("created_at", { mode: "timestamp_ms" }).default(nowMs).notNull(),
    updatedAt: integer("updated_at", { mode: "timestamp_ms" }).default(nowMs).notNull(),
  },
  (t) => [
    // GET /articles and GET /users/:id/articles: published, newest first
    index("articles_published").on(t.status, t.publishedAt, t.id),
    // GET /me/articles: the author's, newest created first
    index("articles_author").on(t.authorId, t.createdAt, t.id),
  ],
);

type ArticleRow = typeof articlesTable.$inferSelect;

/** Row → thing */
const toArticle = (row: ArticleRow): Article => ({
  id: articleId(row.id),
  authorId: row.authorId,
  title: row.title,
  body: row.body,
  status: row.status,
  publishedAt: row.publishedAt,
  createdAt: row.createdAt,
  updatedAt: row.updatedAt,
});

/** Reach → WHERE. The same for reads and writes */
const within = (reach: ArticleReach) => {
  switch (reach.kind) {
    case "published":
      return eq(articlesTable.status, "published");
    case "publishedOrOwn":
      return or(eq(articlesTable.status, "published"), eq(articlesTable.authorId, reach.userId));
  }
};

/**
 * The window every outside read of articles goes through: published ones, and the viewer's own drafts.
 * null is someone signed out, who sees only published ones
 */
export const articlesWithin = (db: ReadDb, viewer: User | null) =>
  db
    .select()
    .from(articlesTable)
    .where(within(reachOf(viewer)))
    .as("articles_within");

export function articlesRepository(scope: Scope<typeof articlesTable>): ArticlesRepository {
  return {
    async find(reach, id) {
      const [row] = await scope.reads
        .select()
        .from(articlesTable)
        .where(and(eq(articlesTable.id, id), within(reach)))
        .limit(1);

      return row ? toArticle(row) : null;
    },

    async insert(article) {
      const [row] = await scope.insert(article).returning();
      if (!row) throw new Error(`article ${article.id} was not returned after insert`);

      return toArticle(row);
    },

    async update(reach, id, changes) {
      const [row] = await scope
        .update(changes)
        .where(and(eq(articlesTable.id, id), within(reach)))
        .returning();

      return row ? toArticle(row) : null;
    },

    async delete(reach, id) {
      const rows = await scope
        .delete()
        .where(and(eq(articlesTable.id, id), within(reach)))
        .returning({ id: articlesTable.id });

      return rows.length > 0;
    },

    async transition(reach, id, from, changes) {
      const [row] = await scope
        .update(changes)
        .where(and(eq(articlesTable.id, id), within(reach), eq(articlesTable.status, from)))
        .returning();

      return row ? toArticle(row) : null;
    },
  };
}
