/**
 * The user. Who is signed in (User), and the person who is registered (Profile).
 * It knows no steps, HTTP or DB. Every other file points here.
 * There are no organizations and no roles: every user stands the same.
 */
import { z } from "zod";
import type { System } from "hono-kit/system";

/**
 * The user ID. A brand to tell it apart from a plain string.
 * Mixing it up with other IDs is a type error. Only userId below may apply the brand
 */
declare const userIdBrand: unique symbol;

export type UserId = string & { readonly [userIdBrand]: true };

/** Brands a string from outside or from the DB as a user ID. The only place that writes `as` */
export const userId = (value: string) => value as UserId;

export const newUserId = () => userId(crypto.randomUUID());

/** An ID in the input (URL or body). Branded once it passes validation */
export const userIdSchema = z.string().min(1).transform(userId);

/**
 * The brand. Its name is invisible outside this file, so a literal like `{ kind: "system" }`
 * cannot produce a branded value. Only authenticatedUser below can create one
 */
declare const verified: unique symbol;

/** A signed-in user. Created only after authentication. It holds only who it is */
export type User = {
  readonly kind: "user";
  readonly id: UserId;
  readonly [verified]: true;
};

/** Creates an authenticated user. Called only by the auth middleware (and tests) */
export const authenticatedUser = (id: UserId) => ({ kind: "user", id }) as User;

/**
 * Who is acting right now: a user or the system.
 * Over HTTP the guard (requireAuth, allowSystem) puts it in c.get("actor"); for cron and queues, createWorker passes it.
 * A service always takes "acting as whom" as its first argument
 */
export type Actor = User | System;

/** The registered person (the row of the users table). Not the same as User, who is signed in */
export type Profile = {
  id: UserId;
  name: string;
  createdAt: Date;
  updatedAt: Date;
};

/** The name: 1 to 50 characters after trimming */
export const userInputSchema = z.object({
  name: z.string().trim().min(1).max(50),
});

export type UserInput = z.infer<typeof userInputSchema>;
