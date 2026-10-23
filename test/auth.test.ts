import { env } from "cloudflare:workers";
import { expect, it } from "vitest";
import { buildApp } from "#src/index";
import { makeDeps } from "#src/deps";

const app = () => buildApp(makeDeps);

it("trusts x-user-id as the signed-in person; no header means signed out", async () => {
  const id = `header-${crypto.randomUUID()}`;
  const put = await app().request(
    "/me/profile",
    {
      method: "PUT",
      headers: { "x-user-id": id, "Content-Type": "application/json" },
      body: JSON.stringify({ displayName: "H" }),
    },
    env,
  );
  expect(put.status).toBe(200);
  expect(await put.json()).toEqual({ id, displayName: "H" });

  expect((await app().request("/me/profile", {}, env)).status).toBe(401);
  expect((await app().request("/me/profile", { headers: { "x-user-id": "" } }, env)).status).toBe(
    401,
  );
});
