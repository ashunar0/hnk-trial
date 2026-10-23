/**
 * The profile: the display name a signed-in person chooses for themselves. One per account.
 * It holds the account's ID (accountId); the account itself carries nothing else
 */
import { z } from "zod";

declare const profileIdBrand: unique symbol;

export type ProfileId = string & { readonly [profileIdBrand]: true };

/** Brands a string from outside or from the DB as a profile ID. The only place that writes `as` */
export const profileId = (value: string) => value as ProfileId;

export const newProfileId = () => profileId(crypto.randomUUID());

export type Profile = {
  id: ProfileId;
  /** The account this profile belongs to. Shown to clients as the person's ID */
  accountId: string;
  displayName: string;
  createdAt: Date;
  updatedAt: Date;
};

/** PUT /me/profile */
export const profileInputSchema = z.object({
  displayName: z.string().trim().min(1).max(50),
});

export type ProfileInput = z.infer<typeof profileInputSchema>;

/** Who may write an article or a comment: the account of this profile */
export const ProfileRequired = {
  code: "PROFILE_REQUIRED",
  kind: "forbidden",
  message: "A profile is required",
} as const;
