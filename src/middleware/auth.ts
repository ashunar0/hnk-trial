import { createMiddleware } from "hono/factory";
import type { MiddlewareHandler } from "hono";
import type { AppEnv, AuthVariables } from "#src/env";
import { authenticatedUser, userId, type User } from "#src/domains/users/model";
import { fail, guard, Unauthorized } from "hono-kit";

/**
 * Sets the session user in the context. Lets signed-out requests through.
 *
 * Provisional (docs/api.md): the ID in the x-user-id header is trusted as a verified session.
 * Replace this with the auth provider's session when it arrives
 */
export const withUser: MiddlewareHandler<AppEnv> = async (c, next) => {
  const id = c.req.header("x-user-id");
  c.set("user", id ? authenticatedUser(userId(id)) : null);
  await next();
};

/**
 * Requires sign-in. Put it in an endpoint's middleware and, in the handler after it,
 * actor (who is acting) becomes a User (user itself still includes null).
 * Unauthorized is added to responses automatically
 */
export const requireAuth = guard(
  [Unauthorized],
  createMiddleware<{
    Variables: AuthVariables & { actor: User };
  }>(async (c, next) => {
    const user = c.get("user");
    if (user === null) throw fail(Unauthorized);

    c.set("actor", user);
    await next();
  }),
);

/**
 * Says explicitly that no auth is required. Does nothing.
 *
 * It exists so every endpoint declares exactly one auth guard. It separates forgetting from
 * "meant to be public", which would otherwise look the same. grep it to list
 * every unauthenticated endpoint in this app
 */
export const allowAnonymous: MiddlewareHandler<AppEnv> = (_c, next) => next();

/**
 * Public, but tells who is looking: in the handler after it, c.get("viewer") is the signed-in User, or null.
 * For a read where everyone sees something and the signed-in see a little more (their own drafts).
 * It never fails, so it adds nothing to responses
 */
export const allowAnyone = createMiddleware<{
  Variables: AuthVariables & { viewer: User | null };
}>(async (c, next) => {
  c.set("viewer", c.get("user"));
  await next();
});
