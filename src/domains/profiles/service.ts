/**
 * The steps for profiles (How)
 */
import { err, ok, type Result } from "hono-kit/result";
import { NotFound } from "hono-kit/failures";
import type { Account } from "#src/domains/accounts/model";
import { newProfileId, type Profile, type ProfileInput } from "./model";

export type ProfilesRepository = {
  /** null if absent */
  findByAccount(accountId: string): Promise<Profile | null>;
  /** Creates the profile, or changes the display name if the account has one. One statement */
  upsert(profile: Profile): Promise<void>;
};

export function profilesService(repo: ProfilesRepository) {
  return {
    /** The profile of this account, or NOT_FOUND */
    async get(actor: Account): Promise<Result<Profile, typeof NotFound.code>> {
      const found = await repo.findByAccount(actor.id);
      if (found === null) return err(NotFound.code);

      return ok(found);
    },

    /** Creates my profile, or changes its display name */
    async save(actor: Account, input: ProfileInput, now: Date): Promise<void> {
      await repo.upsert({
        id: newProfileId(),
        accountId: actor.id,
        displayName: input.displayName,
        createdAt: now,
        updatedAt: now,
      });
    },
  };
}
