/**
 * The steps for users (How). What to do with the domain thing, in what order
 */
import { err, ok, type Result } from "hono-kit/result";
import { NotFound } from "hono-kit/failures";
import { newUserId, type Profile, type UserId, type UserInput } from "./model";

/**
 * The storage shape the steps need. Declared here, by the user of it; repo.d1.ts fulfills it.
 * service does not know the storage implementation, so tests can pass a stand-in of the same shape
 */
export type UsersRepository = {
  /** null if absent */
  find(id: UserId): Promise<Profile | null>;
  insert(user: Profile): Promise<Profile>;
};

/**
 * Argument order: as whom (actor) → what → how → when (now).
 * It never reads the clock. Steps that need time take the now decided by the entry point
 */
export function usersService(repo: UsersRepository) {
  return {
    async get(id: UserId): Promise<Result<Profile, typeof NotFound.code>> {
      const found = await repo.find(id);
      if (found === null) return err(NotFound.code);

      return ok(found);
    },

    async create(input: UserInput, now: Date): Promise<UserId> {
      const created = await repo.insert({
        id: newUserId(),
        name: input.name,
        createdAt: now,
        updatedAt: now,
      });

      return created.id;
    },
  };
}
