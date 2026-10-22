/**
 * The user: who is signed in. This app has no organizations and no roles.
 * It holds no ID of a business row (a member, a staff, a patient): that row holds `userId` in its own domain's table,
 * and "only their own" reaches go through it. A session, once issued, would keep an old ID after the row is deleted
 * Other domains' domains borrow only types from here.
 * The system (a caller with no user) belongs to hono-kit. cron, queues and webhooks receive it
 */
import { z } from "zod";
import type { System } from "hono-kit/system";

/**
 * The brand for user IDs. Mixing one up with a plain string is a type error.
 * Only userId below may apply the brand
 */
declare const userIdBrand: unique symbol;

export type UserId = string & { readonly [userIdBrand]: true };

/** Brands a string from outside or from the DB as a user ID. The only place that writes `as` */
export const userId = (value: string) => value as UserId;

/** A user ID in the input (URL). Branded once it passes validation */
export const userIdSchema = z.string().min(1).transform(userId);

/**
 * The brand. Its name is invisible outside this file, so a literal like `{ kind: "system" }`
 * cannot produce a branded value. Only authenticatedUser below can create one
 */
declare const verified: unique symbol;

/** A signed-in user. Created only after authentication */
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
