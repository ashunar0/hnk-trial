import { createMiddleware } from "hono/factory";
import type { MiddlewareHandler } from "hono";
import type { AppEnv, AuthVariables } from "#src/env";
import { authenticatedUser, userIdSchema, type User } from "#src/domains/users/model";
import type { usersService } from "#src/domains/users/service";
import { fail, guard, Unauthorized } from "hono-kit";

/** What withUser needs from the deps: the users service */
type UserLookup = { users: Pick<ReturnType<typeof usersService>, "get"> };

/**
 * Builds the middleware that sets the session user in the context. Lets signed-out requests through.
 *
 * Provisional sign-in: the user whose ID is in the x-user-id header is the one making the request.
 * No header, or no such user, means signed out. Replace this with the real session when an auth provider arrives.
 * Middleware does not receive deps from provideDeps, and importing deps.ts here would make an import cycle
 * (deps -> routes -> middleware), so buildApp passes how to build them
 */
export const withUser =
  (makeDeps: (env: AppEnv["Bindings"]) => UserLookup): MiddlewareHandler<AppEnv> =>
  async (c, next) => {
    c.set("user", null);

    const parsed = userIdSchema.safeParse(c.req.header("x-user-id"));
    if (parsed.success) {
      const found = await makeDeps(c.env).users.get(parsed.data);
      if (found.ok) c.set("user", authenticatedUser(found.value.id));
    }

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
