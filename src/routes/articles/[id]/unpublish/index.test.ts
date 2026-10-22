import { expect, it } from "vitest";
import {
  alice,
  bob,
  request,
  signUp,
  writeDraft,
  writePublished,
} from "../../../../../test/fixtures";

it("takes a published article back to a draft, hidden from others", async () => {
  await signUp(alice);
  const id = await writePublished(alice);

  const res = await request(alice, "POST", `/articles/${id}/unpublish`);
  expect(await res.json()).toMatchObject({ status: "draft", publishedAt: null });
  expect((await request(null, "GET", `/articles/${id}`)).status).toBe(404);

  const again = await request(alice, "POST", `/articles/${id}/unpublish`);
  expect(again.status).toBe(409);
  expect(await again.json()).toMatchObject({ error: { code: "NOT_PUBLISHED" } });
});

it("is 403 for someone else's published article and 404 for their draft", async () => {
  await signUp(alice);
  expect(
    (await request(bob, "POST", `/articles/${await writePublished(alice)}/unpublish`)).status,
  ).toBe(403);
  expect(
    (await request(bob, "POST", `/articles/${await writeDraft(alice)}/unpublish`)).status,
  ).toBe(404);
});
