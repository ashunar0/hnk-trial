/**
 * The provisional sign-in: the real withUser, not the fixtures' stand-in
 */
import { env } from "cloudflare:workers";
import { expect, it } from "vitest";
import { buildApp } from "#src/index";
import { makeDeps } from "#src/deps";

const app = buildApp(makeDeps);

it("takes x-user-id as the signed-in person, and no header as signed out", async () => {
  const put = await app.request(
    "/me/profile",
    {
      method: "PUT",
      headers: { "x-user-id": "dana", "Content-Type": "application/json" },
      body: JSON.stringify({ name: "Dana" }),
    },
    env,
  );
  expect(await put.json()).toEqual({ id: "dana", name: "Dana" });

  expect((await app.request("/me/profile", {}, env)).status).toBe(401);
});
