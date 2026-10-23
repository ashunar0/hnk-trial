import { expect, it } from "vitest";
import { person, request } from "../../../../test/fixtures";

it("401 when signed out", async () => {
  expect((await request(null, "GET", "/me/profile")).status).toBe(401);
  expect((await request(null, "PUT", "/me/profile", { displayName: "x" })).status).toBe(401);
});

it("404 before the profile exists", async () => {
  const res = await request(person("a"), "GET", "/me/profile");

  expect(res.status).toBe(404);
  expect(await res.json()).toMatchObject({ error: { code: "NOT_FOUND" } });
});

it("creates the profile, then changes it", async () => {
  const me = person("a");

  const created = await request(me, "PUT", "/me/profile", { displayName: "  Asahi  " });
  expect(created.status).toBe(200);
  expect(await created.json()).toEqual({ id: me.id, displayName: "Asahi" });

  const changed = await request(me, "PUT", "/me/profile", { displayName: "New" });
  expect(await changed.json()).toEqual({ id: me.id, displayName: "New" });

  const read = await request(me, "GET", "/me/profile");
  expect(await read.json()).toEqual({ id: me.id, displayName: "New" });
});

it("400 for a blank or too long display name", async () => {
  const me = person("a");

  for (const displayName of ["", "   ", "x".repeat(51)]) {
    const res = await request(me, "PUT", "/me/profile", { displayName });
    expect(res.status).toBe(400);
  }
  expect((await request(me, "PUT", "/me/profile", { displayName: "x".repeat(50) })).status).toBe(
    200,
  );
});
