import { eq } from "drizzle-orm";
import type { ReadDb } from "#src/db/index";
import { usersWithin } from "#src/domains/users/repo.d1";
import type { UserId } from "#src/domains/users/model";

export function usersQueries(db: ReadDb) {
  const select = () => {
    const users = usersWithin(db);

    return {
      users,
      query: db.select({ id: users.id, name: users.name, createdAt: users.createdAt }).from(users),
    };
  };

  return {
    /** null if absent */
    async get(id: UserId) {
      const { users, query } = select();
      const [row] = await query.where(eq(users.id, id)).limit(1);

      return row ?? null;
    },
  };
}

export type UserRow = NonNullable<Awaited<ReturnType<ReturnType<typeof usersQueries>["get"]>>>;
