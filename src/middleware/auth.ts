import { createMiddleware } from "hono/factory";
import type { MiddlewareHandler } from "hono";
import type { AppEnv, AuthVariables } from "#src/env";
import { authenticatedAccount, accountId, type Account } from "#src/domains/accounts/model";
import { fail, guard, Unauthorized } from "hono-kit";

/**
 * Sets the session's account in the context. Lets signed-out requests through.
 *
 * Provisional (docs/api.md): the ID in the x-user-id header is trusted as a verified session.
 * Replace this with the auth provider's session when it arrives
 */
export const withAccount: MiddlewareHandler<AppEnv> = async (c, next) => {
  const id = c.req.header("x-user-id");
  c.set("account", id ? authenticatedAccount(accountId(id)) : null);
  await next();
};

/**
 * Requires sign-in. Put it in an endpoint's middleware and, in the handler after it,
 * actor (who is acting) becomes an Account (account itself still includes null).
 * Unauthorized is added to responses automatically
 */
export const requireAuth = guard(
  [Unauthorized],
  createMiddleware<{
    Variables: AuthVariables & { actor: Account };
  }>(async (c, next) => {
    const account = c.get("account");
    if (account === null) throw fail(Unauthorized);

    c.set("actor", account);
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
 * Public, but tells who is looking: in the handler after it, actor is the signed-in Account, or null.
 * For a read where everyone sees something and the signed-in see a little more (their own drafts).
 * It never fails, so it adds nothing to responses
 */
export const allowAnyone = createMiddleware<{
  Variables: AuthVariables & { actor: Account | null };
}>(async (c, next) => {
  c.set("actor", c.get("account"));
  await next();
});
