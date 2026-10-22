import { env } from "cloudflare:workers";
import { wireDb } from "#src/db/index";
import { buildApp } from "#src/index";
import { makeDeps } from "#src/deps";
import { authenticatedAccount, accountId, type Account } from "#src/domains/accounts/model";

export const db = () => wireDb(env.DB);

export const alice = authenticatedAccount(accountId("alice"));
export const bob = authenticatedAccount(accountId("bob"));

/**
 * Someone new each call. Tests in one file share the D1, so alice and bob keep what an earlier test saved;
 * use this for someone who must have nothing yet (no profile)
 */
export const someone = () => authenticatedAccount(accountId(crypto.randomUUID()));

/**
 * The app, signed in as this user (real deps and D1).
 * null means signed out. Instead of an auth provider it just sets the session user; everything else is as in production.
 * at fixes c.get("now") (the real clock when omitted)
 */
export const appAs = (account: Account | null, at?: Date) =>
  buildApp(
    makeDeps,
    async (c, next) => {
      c.set("account", account);
      await next();
    },
    at ? () => at : undefined,
  );

/** Send JSON through appAs. env points to the real D1. at fixes the request's now */
export const request = (
  account: Account | null,
  method: string,
  path: string,
  body?: unknown,
  at?: Date,
) =>
  appAs(account, at).request(
    path,
    {
      method,
      headers: body === undefined ? {} : { "Content-Type": "application/json" },
      body: body === undefined ? undefined : JSON.stringify(body),
    },
    env,
  );

/** A fixed time, minutes after a fixed start. Pass it as at wherever order or dates matter */
export const at = (minutes: number) => new Date(Date.UTC(2026, 9, 1, 0, minutes));

/** Send and read the JSON body, failing the test unless it is 200 */
const ok = async (res: Response) => {
  if (res.status !== 200) throw new Error(`expected 200, got ${res.status}: ${await res.text()}`);

  return (await res.json()) as { id: string };
};

/** Saves the user's profile (the name defaults to their ID) */
export const signUp = async (user: Account, name: string = user.id) =>
  ok(await request(user, "PUT", "/me/profile", { name }));

/** A draft by the user. Returns its ID */
export const writeDraft = async (user: Account, title = "title", when?: Date) =>
  (await ok(await request(user, "POST", "/articles", { title, body: "body" }, when))).id;

/** A published article by the user. Returns its ID */
export const writePublished = async (user: Account, title = "title", when?: Date) => {
  const id = await writeDraft(user, title, when);
  await ok(await request(user, "POST", `/articles/${id}/publish`, undefined, when));

  return id;
};
