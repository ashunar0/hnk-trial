import { expect, it } from "vitest";
import {
  alice,
  at,
  bob,
  request,
  signUp,
  someone,
  writeDraft,
  writePublished,
} from "../../../../../test/fixtures";

it("comments on a published article and lists them oldest first, page by page", async () => {
  await signUp(alice, "Alice");
  await signUp(bob, "Bob");
  const id = await writePublished(alice);

  const res = await request(bob, "POST", `/articles/${id}/comments`, { body: " nice " }, at(1));
  expect(res.status).toBe(200);
  const first = (await res.json()) as { id: string };
  expect(first).toMatchObject({
    body: "nice",
    author: { id: "bob", name: "Bob" },
    createdAt: at(1).getTime(),
  });
  await request(alice, "POST", `/articles/${id}/comments`, { body: "thanks" }, at(2));

  const page1 = await request(null, "GET", `/articles/${id}/comments?limit=1`);
  const body1 = (await page1.json()) as { items: { id: string }[]; nextCursor: string };
  expect(body1.items.map((c) => c.id)).toEqual([first.id]);
  const page2 = await request(
    null,
    "GET",
    `/articles/${id}/comments?limit=1&cursor=${body1.nextCursor}`,
  );
  expect(await page2.json()).toMatchObject({ items: [{ body: "thanks" }], nextCursor: null });

  const article = await request(null, "GET", `/articles/${id}`);
  expect(await article.json()).toMatchObject({ commentCount: 2 });
});

it("treats a draft's comments as absent, even for its author", async () => {
  await signUp(alice);
  const id = await writeDraft(alice);

  expect((await request(alice, "GET", `/articles/${id}/comments`)).status).toBe(404);
  expect((await request(alice, "POST", `/articles/${id}/comments`, { body: "x" })).status).toBe(
    404,
  );
  expect((await request(alice, "GET", "/articles/missing/comments")).status).toBe(404);
});

it("keeps comments while unpublished and shows them again when republished", async () => {
  await signUp(alice);
  const id = await writePublished(alice);
  await request(alice, "POST", `/articles/${id}/comments`, { body: "kept" });

  await request(alice, "POST", `/articles/${id}/unpublish`);
  const draft = await request(alice, "GET", `/articles/${id}`);
  expect(await draft.json()).toMatchObject({ commentCount: 1 });

  await request(alice, "POST", `/articles/${id}/publish`);
  const res = await request(null, "GET", `/articles/${id}/comments`);
  expect(await res.json()).toMatchObject({ items: [{ body: "kept" }] });
});

it("needs a profile, valid input and sign-in", async () => {
  await signUp(alice);
  const id = await writePublished(alice);

  const res = await request(someone(), "POST", `/articles/${id}/comments`, { body: "hi" });
  expect(res.status).toBe(409);
  expect(await res.json()).toMatchObject({ error: { code: "PROFILE_REQUIRED" } });
  expect((await request(alice, "POST", `/articles/${id}/comments`, { body: "  " })).status).toBe(
    400,
  );
  expect((await request(null, "POST", `/articles/${id}/comments`, { body: "hi" })).status).toBe(
    401,
  );
});
