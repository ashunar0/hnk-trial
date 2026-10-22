import { expect, it } from "vitest";
import { codeOf, request, signUp, writeDraft, writePublished } from "../../../../../test/fixtures";

type Page = { items: { id: string; commentCount: number }[]; nextCursor: string | null };

it("lists the user's published articles newest published first, without drafts or others'", async () => {
  const author = await signUp();
  const other = await signUp();
  const old = await writePublished(author, new Date("2035-01-01T00:00:00Z"));
  const recent = await writePublished(author, new Date("2035-01-02T00:00:00Z"));
  await writeDraft(author);
  await writePublished(other);
  await request(author, "POST", `/articles/${recent}/comments`, { body: "c" });

  const res = await request(null, "GET", `/users/${author.id}/articles`);

  expect(res.status).toBe(200);
  const page = (await res.json()) as Page;
  expect(page.items.map((item) => item.id)).toEqual([recent, old]);
  expect(page.items.map((item) => item.commentCount)).toEqual([1, 0]);
});

it("pages with a cursor", async () => {
  const author = await signUp();
  const a = await writePublished(author, new Date("2036-01-01T00:00:00Z"));
  const b = await writePublished(author, new Date("2036-01-02T00:00:00Z"));
  const c = await writePublished(author, new Date("2036-01-03T00:00:00Z"));

  const first = (await (
    await request(null, "GET", `/users/${author.id}/articles?limit=2`)
  ).json()) as Page;
  expect(first.items.map((item) => item.id)).toEqual([c, b]);
  const rest = (await (
    await request(null, "GET", `/users/${author.id}/articles?limit=2&cursor=${first.nextCursor}`)
  ).json()) as Page;
  expect(rest.items.map((item) => item.id)).toEqual([a]);
  expect(rest.nextCursor).toBeNull();
});

it("returns an empty list for a user with no published article, and 404 for an unknown user", async () => {
  const author = await signUp();
  await writeDraft(author);

  const empty = await request(null, "GET", `/users/${author.id}/articles`);
  expect(((await empty.json()) as Page).items).toEqual([]);

  const missing = await request(null, "GET", `/users/${crypto.randomUUID()}/articles`);
  expect(missing.status).toBe(404);
  expect(await codeOf(missing)).toBe("NOT_FOUND");
});
