import { expect, it } from "vitest";
import { alice, at, bob, request, signUp, writeDraft } from "../../../../../test/fixtures";

it("publishes a draft once, and a republish takes the new time", async () => {
  await signUp(alice);
  const id = await writeDraft(alice);

  const res = await request(alice, "POST", `/articles/${id}/publish`, undefined, at(1));
  expect(await res.json()).toMatchObject({ status: "published", publishedAt: at(1).getTime() });

  const again = await request(alice, "POST", `/articles/${id}/publish`);
  expect(again.status).toBe(409);
  expect(await again.json()).toMatchObject({ error: { code: "ALREADY_PUBLISHED" } });

  await request(alice, "POST", `/articles/${id}/unpublish`, undefined, at(2));
  const republished = await request(alice, "POST", `/articles/${id}/publish`, undefined, at(3));
  expect(await republished.json()).toMatchObject({ publishedAt: at(3).getTime() });
});

it("is 404 for someone else's draft and 403 for their published article", async () => {
  await signUp(alice);
  const id = await writeDraft(alice);
  expect((await request(bob, "POST", `/articles/${id}/publish`)).status).toBe(404);

  await request(alice, "POST", `/articles/${id}/publish`);
  // Forbidden comes before the state: bob may not touch it at all
  expect((await request(bob, "POST", `/articles/${id}/publish`)).status).toBe(403);
  expect((await request(null, "POST", `/articles/${id}/publish`)).status).toBe(401);
});
