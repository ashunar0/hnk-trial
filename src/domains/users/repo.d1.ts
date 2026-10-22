/**
 * Storage for users. Fulfills the UsersRepository declared in service.ts with D1.
 * Row shapes never leave this file; rows are mapped to the domain Profile
 */
import { eq, sql } from "drizzle-orm";
import { integer, sqliteTable, text } from "drizzle-orm/sqlite-core";
import type { ReadDb, Scope } from "#src/db/index";
import { userId, type Profile } from "./model";
import type { UsersRepository } from "./service";

/** Column default: the current time (ms). A SQL expression, not a JS Date */
const nowMs = sql`(cast(unixepoch('subsecond') * 1000 as integer))`;

export const usersTable = sqliteTable("users", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  createdAt: integer("created_at", { mode: "timestamp_ms" }).default(nowMs).notNull(),
  updatedAt: integer("updated_at", { mode: "timestamp_ms" }).default(nowMs).notNull(),
});

type UserRow = typeof usersTable.$inferSelect;

/** Row → thing. This is the gate that keeps new columns out of domain */
const toProfile = (row: UserRow): Profile => ({
  id: userId(row.id),
  name: row.name,
  createdAt: row.createdAt,
  updatedAt: row.updatedAt,
});

/**
 * The window every outside read of users goes through: the GET queries in src/routes, and other domains.
 * Nobody reads usersTable directly (no-foreign-table-reads). When who looks decides what is seen,
 * take actor and narrow the rows here with reachOf: usersWithin(db, actor)
 */
export const usersWithin = (db: ReadDb) => db.select().from(usersTable).as("users_within");

export function usersRepository(scope: Scope<typeof usersTable>): UsersRepository {
  return {
    async find(id) {
      const [row] = await scope.reads
        .select()
        .from(usersTable)
        .where(eq(usersTable.id, id))
        .limit(1);

      return row ? toProfile(row) : null;
    },

    async insert(user) {
      const [row] = await scope.insert(user).returning();
      if (!row) throw new Error(`user ${user.id} was not returned after insert`);

      return toProfile(row);
    },
  };
}
