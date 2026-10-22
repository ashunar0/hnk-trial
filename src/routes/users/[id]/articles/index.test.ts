import { expect, it } from "vitest";
import {
  alice,
  at,
  bob,
  request,
  signUp,
  writeDraft,
  writePublished,
} from "../../../../../test/fixtures";

it("lists one person's published articles, the latest published first", async () => {
  await signUp(alice);
  await signUp(bob);
  const first = await writePublished(alice, "first", at(1));
  const second = await writePublished(alice, "second", at(2));
  await writePublished(bob, "bob's", at(3));
  await writeDraft(alice, "draft", at(4));

  const res = await request(null, "GET", "/users/alice/articles");
  const body = (await res.json()) as { items: { id: string }[] };
  expect(body.items.map((a) => a.id)).toEqual([second, first]);
});

it("is 404 for someone without a profile", async () => {
  expect((await request(null, "GET", "/users/nobody/articles")).status).toBe(404);
});
