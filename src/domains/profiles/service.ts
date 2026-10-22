/**
 * The steps for profiles (How). What to do with the domain thing, in what order
 */
import { err, ok, type Result } from "hono-kit/result";
import { NotFound } from "hono-kit/failures";
import type { Account } from "#src/domains/accounts/model";
import type { Profile, ProfileInput } from "./model";

/**
 * The storage shape the steps need. Declared here, by the user of it; repo.d1.ts fulfills it.
 * service does not know the storage implementation, so tests can pass a stand-in of the same shape
 */
export type ProfilesRepository = {
  /** null if absent */
  find(userId: string): Promise<Profile | null>;
  /** Creates it, or changes the name of the one there, in one statement */
  save(userId: string, name: string, now: Date): Promise<void>;
};

/**
 * Argument order: as whom (actor) → what → how → when (now).
 * It never reads the clock. Steps that need time take the now decided by the entry point
 */
export function profilesService(repo: ProfilesRepository) {
  return {
    /** The actor's own profile. NOT_FOUND until they save one */
    async get(actor: Account): Promise<Result<Profile, typeof NotFound.code>> {
      const found = await repo.find(actor.id);
      if (found === null) return err(NotFound.code);

      return ok(found);
    },

    /** Creates or changes the actor's own profile. Nobody else's can be named */
    async save(actor: Account, input: ProfileInput, now: Date): Promise<void> {
      await repo.save(actor.id, input.name, now);
    },
  };
}
