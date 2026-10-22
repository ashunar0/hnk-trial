import { env } from "cloudflare:workers";
import { wireDb } from "#src/db/index";
import { buildApp } from "#src/index";
import { makeDeps } from "#src/deps";
import { authenticatedUser, type User } from "#src/domains/users/model";

export const db = () => wireDb(env.DB);

/** Registers a user through the users service and returns it signed in. Every test makes its own, so tests do not meet */
export const signUp = async (name = "someone") =>
  authenticatedUser(await makeDeps(env).users.create({ name }, new Date()));

/**
 * The app, signed in as this user (real deps and D1).
 * null means signed out. Instead of an auth provider it just sets the session user; everything else is as in production.
 * at fixes c.get("now") (the real clock when omitted)
 */
export const appAs = (user: User | null, at?: Date) =>
  buildApp(
    makeDeps,
    async (c, next) => {
      c.set("user", user);
      await next();
    },
    at ? () => at : undefined,
  );

/** Send JSON through appAs. env points to the real D1. at fixes the request's now */
export const request = (
  user: User | null,
  method: string,
  path: string,
  body?: unknown,
  at?: Date,
) =>
  appAs(user, at).request(
    path,
    {
      method,
      headers: body === undefined ? {} : { "Content-Type": "application/json" },
      body: body === undefined ? undefined : JSON.stringify(body),
    },
    env,
  );

/** Writes a draft as `author` and returns its ID */
export const writeDraft = async (author: User, title = "title", body = "body") => {
  const res = await request(author, "POST", "/articles", { title, body });
  const json = (await res.json()) as { id: string };

  return json.id;
};

/** Writes an article as `author` and publishes it at `at`. Returns its ID */
export const writePublished = async (author: User, at = new Date(), title = "title") => {
  const id = await writeDraft(author, title);
  await request(author, "POST", `/articles/${id}/publish`, undefined, at);

  return id;
};

/** The error code of a failure response */
export const codeOf = async (res: Response) => {
  const json = (await res.json()) as { error: { code: string } };

  return json.error.code;
};
