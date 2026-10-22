import { expect, it } from "vitest";
import { codeOf, request, signUp, writeDraft, writePublished } from "../../../test/fixtures";

type Page = { items: { id: string }[]; nextCursor: string | null };

it("writes an article as a draft and returns it as its GET shows", async () => {
  const author = await signUp("Asahi");

  const res = await request(author, "POST", "/articles", { title: "  Hello  ", body: "World" });

  expect(res.status).toBe(200);
  expect(await res.json()).toMatchObject({
    title: "Hello",
    body: "World",
    status: "draft",
    publishedAt: null,
    author: { id: author.id, name: "Asahi" },
    commentCount: 0,
  });
});

it("returns 401 when signed out, and 400 for a bad title or body", async () => {
  const author = await signUp();

  const signedOut = await request(null, "POST", "/articles", { title: "t", body: "b" });
  expect(signedOut.status).toBe(401);
  expect(await codeOf(signedOut)).toBe("UNAUTHORIZED");

  for (const body of [
    { title: " ", body: "b" },
    { title: "a".repeat(201), body: "b" },
    { title: "t", body: "" },
    { title: "t" },
  ]) {
    const res = await request(author, "POST", "/articles", body);
    expect(res.status).toBe(400);
    expect(await codeOf(res)).toBe("VALIDATION_ERROR");
  }
});

it("lists published articles newest published first, without drafts, for anyone", async () => {
  const author = await signUp("Asahi");
  const old = await writePublished(author, new Date("2030-01-01T00:00:00Z"));
  const recent = await writePublished(author, new Date("2030-01-03T00:00:00Z"));
  const middle = await writePublished(author, new Date("2030-01-02T00:00:00Z"));
  const draft = await writeDraft(author);

  const res = await request(null, "GET", "/articles?limit=100");

  expect(res.status).toBe(200);
  const ids = ((await res.json()) as Page).items.map((item) => item.id);
  expect(ids).not.toContain(draft);
  expect(ids.filter((id) => [old, recent, middle].includes(id))).toEqual([recent, middle, old]);
});

it("counts comments and shows the author in the list", async () => {
  const author = await signUp("Asahi");
  const id = await writePublished(author, new Date("2031-01-01T00:00:00Z"));
  await request(author, "POST", `/articles/${id}/comments`, { body: "one" });
  await request(author, "POST", `/articles/${id}/comments`, { body: "two" });

  const res = await request(null, "GET", "/articles?limit=1");

  const page = (await res.json()) as { items: { id: string; commentCount: number }[] };
  expect(page.items[0]).toMatchObject({ id, commentCount: 2, author: { name: "Asahi" } });
});

it("pages with a cursor and returns 400 for a bad limit", async () => {
  const author = await signUp();
  await writePublished(author, new Date("2032-01-01T00:00:00Z"));
  await writePublished(author, new Date("2032-01-02T00:00:00Z"));

  const first = (await (await request(null, "GET", "/articles?limit=1")).json()) as Page;
  expect(first.items).toHaveLength(1);
  expect(first.nextCursor).not.toBeNull();

  const second = (await (
    await request(null, "GET", `/articles?limit=1&cursor=${first.nextCursor}`)
  ).json()) as Page;
  expect(second.items).toHaveLength(1);
  expect(second.items[0]?.id).not.toBe(first.items[0]?.id);

  expect((await request(null, "GET", "/articles?limit=0")).status).toBe(400);
  expect((await request(null, "GET", "/articles?cursor=garbage")).status).toBe(400);
});
