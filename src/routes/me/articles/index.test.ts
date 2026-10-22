import { expect, it } from "vitest";
import { request, signUp, writeDraft, writePublished } from "../../../../test/fixtures";

type Page = { items: { id: string; status: string }[]; nextCursor: string | null };

it("lists one's own articles, drafts included, newest created first, with their status", async () => {
  const me = await signUp();
  const other = await signUp();
  const first = await writeDraft(me, "first");
  await new Promise((resolve) => setTimeout(resolve, 5));
  const second = await writePublished(me);
  await new Promise((resolve) => setTimeout(resolve, 5));
  const third = await writeDraft(me, "third");
  await writePublished(other);

  const res = await request(me, "GET", "/me/articles");

  expect(res.status).toBe(200);
  const page = (await res.json()) as Page;
  expect(page.items.map((item) => [item.id, item.status])).toEqual([
    [third, "draft"],
    [second, "published"],
    [first, "draft"],
  ]);
});

it("pages with a cursor", async () => {
  const me = await signUp();
  await writeDraft(me);
  await writeDraft(me);
  await writeDraft(me);

  const first = (await (await request(me, "GET", "/me/articles?limit=2")).json()) as Page;
  expect(first.items).toHaveLength(2);
  const rest = (await (
    await request(me, "GET", `/me/articles?limit=2&cursor=${first.nextCursor}`)
  ).json()) as Page;
  expect(rest.items).toHaveLength(1);
  expect(rest.nextCursor).toBeNull();
});

it("returns 401 when signed out", async () => {
  const res = await request(null, "GET", "/me/articles");

  expect(res.status).toBe(401);
});
