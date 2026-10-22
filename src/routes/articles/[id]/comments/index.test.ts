import { expect, it } from "vitest";
import { codeOf, request, signUp, writeDraft, writePublished } from "../../../../../test/fixtures";

type Page = {
  items: { id: string; body: string; author: { id: string; name: string } }[];
  nextCursor: string | null;
};

it("comments on a published article and returns the comment as the list shows it", async () => {
  const author = await signUp("Writer");
  const reader = await signUp("Reader");
  const id = await writePublished(author);

  const res = await request(reader, "POST", `/articles/${id}/comments`, { body: "  Nice  " });

  expect(res.status).toBe(200);
  expect(await res.json()).toMatchObject({
    articleId: id,
    body: "Nice",
    author: { id: reader.id, name: "Reader" },
  });
  const article = (await (await request(null, "GET", `/articles/${id}`)).json()) as {
    commentCount: number;
  };
  expect(article.commentCount).toBe(1);
});

it("lists comments oldest first, signed out too, and pages them", async () => {
  const author = await signUp();
  const id = await writePublished(author);
  await request(
    author,
    "POST",
    `/articles/${id}/comments`,
    { body: "first" },
    new Date("2034-01-01T00:00:00Z"),
  );
  await request(
    author,
    "POST",
    `/articles/${id}/comments`,
    { body: "third" },
    new Date("2034-01-03T00:00:00Z"),
  );
  await request(
    author,
    "POST",
    `/articles/${id}/comments`,
    { body: "second" },
    new Date("2034-01-02T00:00:00Z"),
  );

  const all = (await (await request(null, "GET", `/articles/${id}/comments`)).json()) as Page;
  expect(all.items.map((item) => item.body)).toEqual(["first", "second", "third"]);

  const first = (await (
    await request(null, "GET", `/articles/${id}/comments?limit=2`)
  ).json()) as Page;
  expect(first.items.map((item) => item.body)).toEqual(["first", "second"]);
  const rest = (await (
    await request(null, "GET", `/articles/${id}/comments?limit=2&cursor=${first.nextCursor}`)
  ).json()) as Page;
  expect(rest.items.map((item) => item.body)).toEqual(["third"]);
  expect(rest.nextCursor).toBeNull();
});

it("treats a draft as absent for reading and writing, even for its author", async () => {
  const author = await signUp();
  const id = await writeDraft(author);

  const read = await request(author, "GET", `/articles/${id}/comments`);
  expect(read.status).toBe(404);
  expect(await codeOf(read)).toBe("NOT_FOUND");
  const write = await request(author, "POST", `/articles/${id}/comments`, { body: "x" });
  expect(write.status).toBe(404);
  expect((await request(null, "GET", `/articles/${id}/comments`)).status).toBe(404);
});

it("treats an unknown article as absent, and someone else's draft too", async () => {
  const author = await signUp();
  const other = await signUp();
  const draft = await writeDraft(author);

  expect((await request(other, "POST", `/articles/${draft}/comments`, { body: "x" })).status).toBe(
    404,
  );
  expect(
    (await request(other, "POST", `/articles/${crypto.randomUUID()}/comments`, { body: "x" }))
      .status,
  ).toBe(404);
  expect((await request(other, "GET", `/articles/${crypto.randomUUID()}/comments`)).status).toBe(
    404,
  );
});

it("returns 401 when signed out and 400 for a bad body", async () => {
  const author = await signUp();
  const id = await writePublished(author);

  expect((await request(null, "POST", `/articles/${id}/comments`, { body: "x" })).status).toBe(401);
  for (const body of [{ body: "   " }, { body: "a".repeat(1001) }, {}]) {
    const res = await request(author, "POST", `/articles/${id}/comments`, body);
    expect(res.status).toBe(400);
    expect(await codeOf(res)).toBe("VALIDATION_ERROR");
  }
});
