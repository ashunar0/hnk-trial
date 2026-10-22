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

it("shows a published article to anyone, a draft only to its author", async () => {
  await signUp(alice);
  const published = await writePublished(alice);
  const draft = await writeDraft(alice);

  expect((await request(null, "GET", `/articles/${published}`)).status).toBe(200);
  expect((await request(bob, "GET", `/articles/${published}`)).status).toBe(200);

  expect((await request(alice, "GET", `/articles/${draft}`)).status).toBe(200);
  expect((await request(bob, "GET", `/articles/${draft}`)).status).toBe(404);
  expect((await request(null, "GET", `/articles/${draft}`)).status).toBe(404);
  expect((await request(null, "GET", "/articles/missing")).status).toBe(404);
});

it("lets only the author replace it: 404 for someone else's draft, 403 for their published one", async () => {
  await signUp(alice);
  const draft = await writeDraft(alice);
  const published = await writePublished(alice);
  const input = { title: "new", body: "new body" };

  const res = await request(alice, "PUT", `/articles/${published}`, input, at(9));
  expect(res.status).toBe(200);
  expect(await res.json()).toMatchObject({
    ...input,
    status: "published",
    updatedAt: at(9).getTime(),
  });

  expect((await request(bob, "PUT", `/articles/${draft}`, input)).status).toBe(404);
  expect((await request(bob, "PUT", `/articles/${published}`, input)).status).toBe(403);
  expect((await request(alice, "PUT", "/articles/missing", input)).status).toBe(404);
});

it("lets only the author delete it", async () => {
  await signUp(alice);
  const draft = await writeDraft(alice);
  const published = await writePublished(alice);

  expect((await request(bob, "DELETE", `/articles/${draft}`)).status).toBe(404);
  expect((await request(bob, "DELETE", `/articles/${published}`)).status).toBe(403);

  const res = await request(alice, "DELETE", `/articles/${published}`);
  expect(await res.json()).toEqual({ ok: true });
  expect((await request(alice, "GET", `/articles/${published}`)).status).toBe(404);
  expect((await request(alice, "DELETE", `/articles/${published}`)).status).toBe(404);
});
