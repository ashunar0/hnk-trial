import { env } from "cloudflare:workers";
import { expect, it } from "vitest";
import { buildApp } from "#src/index";
import { makeDeps } from "#src/deps";
import { signUp } from "./fixtures";

/** The real app with the real x-user-id sign-in (appAs would skip it) */
const call = (headers: Record<string, string>) =>
  buildApp(makeDeps).request("/me/articles", { headers }, env);

it("treats the user of x-user-id as signed in", async () => {
  const user = await signUp();

  const res = await call({ "x-user-id": user.id });

  expect(res.status).toBe(200);
});

it("treats a request without x-user-id as signed out", async () => {
  const res = await call({});

  expect(res.status).toBe(401);
});

it("treats an x-user-id nobody has as signed out", async () => {
  const res = await call({ "x-user-id": crypto.randomUUID() });

  expect(res.status).toBe(401);
});

it("treats an empty x-user-id as signed out", async () => {
  const res = await call({ "x-user-id": "" });

  expect(res.status).toBe(401);
});
