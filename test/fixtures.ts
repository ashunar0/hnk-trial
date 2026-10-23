import { env } from "cloudflare:workers";
import { wireDb } from "#src/db/index";
import { buildApp } from "#src/index";
import { makeDeps } from "#src/deps";
import { authenticatedAccount, accountId, type Account } from "#src/domains/accounts/model";

export const db = () => wireDb(env.DB);

export const alice = authenticatedAccount(accountId("alice"));
export const bob = authenticatedAccount(accountId("bob"));
export const carol = authenticatedAccount(accountId("carol"));

/**
 * The app, signed in as this account (real deps and D1).
 * null means signed out. Instead of an auth provider it just sets the session's account; everything else is as in production.
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

/** A new person with a name nobody else has, so tests do not meet each other's rows */
export const person = (name: string) =>
  authenticatedAccount(accountId(`${name}-${crypto.randomUUID()}`));

/** A new person who already has a profile (displayName = name) */
export const personWithProfile = async (name: string) => {
  const account = person(name);
  const res = await request(account, "PUT", "/me/profile", { displayName: name });
  if (res.status !== 200) throw new Error(`could not make a profile: ${res.status}`);

  return account;
};

/** Writes an article as this person and returns its ID. publishAt publishes it at that time */
export const writeArticle = async (
  account: Account,
  input: { title?: string; body?: string } = {},
  publishAt?: Date,
) => {
  const res = await request(account, "POST", "/articles", {
    title: input.title ?? "title",
    body: input.body ?? "body",
  });
  if (res.status !== 200) throw new Error(`could not write an article: ${res.status}`);
  const { id } = (await res.json()) as { id: string };
  if (publishAt !== undefined) {
    const published = await request(
      account,
      "POST",
      `/articles/${id}/publish`,
      undefined,
      publishAt,
    );
    if (published.status !== 200) throw new Error(`could not publish: ${published.status}`);
  }

  return id;
};
