import { expect, it } from "vitest";
import { alice, request } from "../../../../test/fixtures";

it("is 404 until saved, then saves and changes the name", async () => {
  expect((await request(alice, "GET", "/me/profile")).status).toBe(404);

  const created = await request(alice, "PUT", "/me/profile", { name: "  Alice  " });
  expect(created.status).toBe(200);
  expect(await created.json()).toEqual({ id: "alice", name: "Alice" });

  await request(alice, "PUT", "/me/profile", { name: "Alice B." });
  const res = await request(alice, "GET", "/me/profile");
  expect(await res.json()).toEqual({ id: "alice", name: "Alice B." });
});

it("rejects an empty or too long name", async () => {
  expect((await request(alice, "PUT", "/me/profile", { name: "   " })).status).toBe(400);
  expect((await request(alice, "PUT", "/me/profile", { name: "a".repeat(51) })).status).toBe(400);
});

it("is 401 signed out", async () => {
  expect((await request(null, "GET", "/me/profile")).status).toBe(401);
  expect((await request(null, "PUT", "/me/profile", { name: "x" })).status).toBe(401);
});
