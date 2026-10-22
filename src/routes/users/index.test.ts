import { expect, it } from "vitest";
import { codeOf, request } from "../../../test/fixtures";

it("registers a user, signed out, and returns it", async () => {
  const res = await request(null, "POST", "/users", { name: "  Asahi  " });

  expect(res.status).toBe(200);
  expect(await res.json()).toMatchObject({ name: "Asahi", id: expect.any(String) });
});

it("returns 400 for a name that is empty, too long or missing", async () => {
  for (const body of [{ name: "   " }, { name: "a".repeat(51) }, {}]) {
    const res = await request(null, "POST", "/users", body);

    expect(res.status).toBe(400);
    expect(await codeOf(res)).toBe("VALIDATION_ERROR");
  }
});
