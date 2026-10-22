/**
 * Storage for articles. Fulfills the ArticlesRepository declared in service.ts with D1.
 * Row shapes never leave this file; rows are mapped to the domain Article
 */
import { and, eq, or, sql } from "drizzle-orm";
import { index, integer, sqliteTable, text } from "drizzle-orm/sqlite-core";
import type { ReadDb, Scope } from "#src/db/index";
import { usersTable } from "#src/domains/users/repo.d1";
import type { Actor, User } from "#src/domains/users/model";
import {
  articleId,
  articleStatuses,
  ownReachOf,
  reachOf,
  type Article,
  type ArticleReach,
} from "./model";
import type { ArticlesRepository } from "./service";

/** Column default: the current time (ms). A SQL expression, not a JS Date */
const nowMs = sql`(cast(unixepoch('subsecond') * 1000 as integer))`;

export const articlesTable = sqliteTable(
  "articles",
  {
    id: text("id").primaryKey(),
    authorId: text("author_id")
      .notNull()
      .references(() => usersTable.id),
    title: text("title").notNull(),
    body: text("body").notNull(),
    status: text("status", { enum: articleStatuses }).notNull(),
    publishedAt: integer("published_at", { mode: "timestamp_ms" }),
    createdAt: integer("created_at", { mode: "timestamp_ms" }).default(nowMs).notNull(),
    updatedAt: integer("updated_at", { mode: "timestamp_ms" }).default(nowMs).notNull(),
  },
  (table) => [
    // Lists: published ones newest first, and one author's ones newest first
    index("articles_status_published_at_idx").on(table.status, table.publishedAt, table.id),
    index("articles_author_created_at_idx").on(table.authorId, table.createdAt, table.id),
  ],
);

type ArticleRow = typeof articlesTable.$inferSelect;

/** Row → thing. This is the gate that keeps new columns out of domain */
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

/** Reach → WHERE. undefined means every row */
const within = (reach: ArticleReach) => {
  switch (reach.kind) {
    case "all":
      return undefined;
    case "published":
      return eq(articlesTable.status, "published");
    case "visible":
      return or(eq(articlesTable.status, "published"), eq(articlesTable.authorId, reach.userId));
    case "own":
      return eq(articlesTable.authorId, reach.userId);
  }
};

/**
 * The windows every outside read of articles goes through: the GET queries in src/routes, and other domains.
 * Nobody reads articlesTable directly (no-foreign-table-reads).
 * What the viewer sees: published ones, and the viewer's own drafts. null is someone not signed in.
 * All three windows use one alias, so a reader can take any of them with the same type
 */
export const articlesWithin = (db: ReadDb, viewer: Actor | null) =>
  db
    .select()
    .from(articlesTable)
    .where(within(reachOf(viewer)))
    .as("articles_within");

/** Published articles. The same whoever looks, so it takes no actor */
export const publishedArticlesWithin = (db: ReadDb) =>
  db
    .select()
    .from(articlesTable)
    .where(within({ kind: "published" }))
    .as("articles_within");

/** What one wrote, drafts included */
export const ownArticlesWithin = (db: ReadDb, actor: User) =>
  db
    .select()
    .from(articlesTable)
    .where(within(ownReachOf(actor)))
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
        .where(and(eq(articlesTable.id, id), eq(articlesTable.status, from), within(reach)))
        .returning();

      return row ? toArticle(row) : null;
    },
  };
}
