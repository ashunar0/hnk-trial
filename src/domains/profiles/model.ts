/**
 * The profile: the name a signed-in person shows (What). One per person, keyed by their user ID.
 * The account itself belongs to the auth provider; the name is this app's business, so it lives here
 */
import { z } from "zod";

export type Profile = {
  /** The signed-in person's ID (users). A plain string inside this domain */
  userId: string;
  name: string;
  createdAt: Date;
  updatedAt: Date;
};

export const profileInputSchema = z.strictObject({
  name: z.string().trim().min(1).max(50),
});

export type ProfileInput = z.infer<typeof profileInputSchema>;
