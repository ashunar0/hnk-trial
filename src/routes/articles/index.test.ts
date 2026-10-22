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
} from "../../../test/fixtures";

it("creates a draft, shown in full", async () => {
  await signUp(alice, "Alice");

  const res = await request(alice, "POST", "/articles", { title: " Hello ", body: "World" }, at(1));
  expect(res.status).toBe(200);
  expect(await res.json()).toMatchObject({
    title: "Hello",
    body: "World",
    author: { id: "alice", name: "Alice" },
    status: "draft",
    publishedAt: null,
    commentCount: 0,
    createdAt: at(1).getTime(),
    updatedAt: at(1).getTime(),
  });
});

it("needs a profile to write", async () => {
  const res = await request(someone(), "POST", "/articles", { title: "t", body: "b" });
  expect(res.status).toBe(409);
  expect(await res.json()).toMatchObject({ error: { code: "PROFILE_REQUIRED" } });
});

it("rejects bad input, and is 401 signed out", async () => {
  await signUp(alice);
  expect((await request(alice, "POST", "/articles", { title: " ", body: "b" })).status).toBe(400);
  expect((await request(alice, "POST", "/articles", { title: "t", body: "" })).status).toBe(400);
  expect((await request(null, "POST", "/articles", { title: "t", body: "b" })).status).toBe(401);
});

it("lists published articles only, the latest published first, page by page", async () => {
  await signUp(alice, "Alice");
  await signUp(bob, "Bob");
  const first = await writePublished(alice, "first", at(1));
  const second = await writePublished(bob, "second", at(2));
  await writeDraft(alice, "draft", at(3));

  const page1 = await request(null, "GET", "/articles?limit=1");
  const body1 = (await page1.json()) as { items: { id: string }[]; nextCursor: string };
  expect(body1.items).toEqual([
    {
      id: second,
      title: "second",
      author: { id: "bob", name: "Bob" },
      publishedAt: at(2).getTime(),
      commentCount: 0,
    },
  ]);

  const page2 = await request(null, "GET", `/articles?limit=1&cursor=${body1.nextCursor}`);
  expect(await page2.json()).toMatchObject({ items: [{ id: first }], nextCursor: null });
});
