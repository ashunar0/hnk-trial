import { expect, it } from "vitest";
import { request, signUp } from "./fixtures";

it("returns the OpenAPI document", async () => {
  const user = await signUp();

  const res = await request(user, "GET", "/openapi.json");

  expect(res.status).toBe(200);
});
