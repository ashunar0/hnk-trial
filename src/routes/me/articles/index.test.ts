import { expect, it } from "vitest";
import {
  alice,
  at,
  bob,
  request,
  signUp,
  writeDraft,
  writePublished,
} from "../../../../test/fixtures";

it("lists one's own articles with drafts, the latest created first", async () => {
  await signUp(alice);
  await signUp(bob);
  const published = await writePublished(alice, "published", at(1));
  const draft = await writeDraft(alice, "draft", at(2));
  await writePublished(bob, "bob's", at(3));

  const res = await request(alice, "GET", "/me/articles");
  expect(await res.json()).toEqual({
    items: [
      {
        id: draft,
        title: "draft",
        status: "draft",
        publishedAt: null,
        createdAt: at(2).getTime(),
        updatedAt: at(2).getTime(),
      },
      {
        id: published,
        title: "published",
        status: "published",
        publishedAt: at(1).getTime(),
        createdAt: at(1).getTime(),
        updatedAt: at(1).getTime(),
      },
    ],
    nextCursor: null,
  });
});

it("is 401 signed out", async () => {
  expect((await request(null, "GET", "/me/articles")).status).toBe(401);
});
