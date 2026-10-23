# friction

hono-kit の決まりで書いていて、引っかかったところの記録。書いた人が、作業の途中で足していく。

書き方: 1 項目ずつ、どのファイルのどこで、何に迷ったか、どうしたかを書く。「こうすべきだった」ではなく、起きたことを書く。

## ぶつかった

- **雛形の `Account` が組織と役割を持っている（`src/domains/accounts/model.ts`、`src/middleware/auth.ts`、`test/fixtures.ts`）**。api.md は「組織や役割は無い」。雛形は `orgId` / `role` / `requireRole` / `admin` / `carol(別組織)` まで入っていて、docs（rules.md の Account の節）は「ルールが要るものだけ持つ」と言うが、雛形をどこまで消してよいかは書いてない。`Account` から `orgId` と `role` を消し、`requireRole`・`roles`・`admin`・`carol` を削って `allowAnyone` を足した。docs に「雛形の org/role は要らなければ消す」の一言が欲しかった
- **「公開だが、ログイン中なら自分の下書きも見える」ガードの名前と置き場所**。rules.md に「`Account | null` を actor に入れるガードを書く」とあり、名前は例が無い。`allowAnonymous`（actor は null 固定）と紛らわしいので `allowAnyone` にした。`GET /articles/:id` などはこれ
- **`hono-kit/failures` を resource から import できない（`hnk/layer-imports`）**。`NotFound` / `Forbidden` は rules.md では「hono-kit の標準」。resources.md の例は `NotFound` をどこから import するか書いてなく、service の例は `hono-kit/failures`。resource でそれを書いたら lint に止められた（resource が許すのは `hono-kit` 本体のみ）。`hono-kit` の index からも `NotFound` / `Forbidden` が出ているので、そちらから import して通した。layout.md の表を読めば分かるが、最初は service の癖で書いてしまった
- **queries が `hono-kit` から `PageQuery` を import できない**。表では `hono-kit/page` だけ許可。型は `hono-kit` 本体にも出ているので迷って lint で気づいた。`hono-kit/page` から `PageQuery` も出ていた
- **`PROFILE_REQUIRED` の kind が決められなかった（rules.md「Failures」）**。docs の kind は unauthenticated / forbidden / notFound / conflict / unprocessable / upstream。「プロフィールを持たない人が書けない」は、状態に衝突（conflict）とも、リクエスト自体の誤り（unprocessable）とも、権限（forbidden）とも読める。api.md はステータスを書かない（hono-kit に任せる）ので決め手が無い。`forbidden`（403）にした。選ばなかった案: `unprocessable`（422）、`conflict`（409）
- **PUT /me/profile の「作る、または変える」と一意制約**。rules.md は「unique は uniqueIndex が決める。insert を try/catch し `uniqueViolationOf` で失敗に変える」。upsert は 1 文（`insert ... on conflict (account_id) do update`）で書けて、衝突は失敗にならず更新になる。`scope.insert(...)` が drizzle の builder を返すので `.onConflictDoUpdate` を繋げられた。この形が docs に出てこない（`find` → あれば `update`、なければ `insert` の 2 文にすると競合する、とも書いてない）。1 文にした

## 自分で決めた

- **プロフィールの ID**: api.md の「人の ID」はアカウントの ID。プロフィール行は自分の `id`（uuid）と `accountId`（一意）を持たせ、画面に出す「人の ID」は `accountId`。選ばなかった案: プロフィールの主キーをアカウント ID そのものにする（行は減るが、docs の「業務の人は自分の行を持ち、アカウント ID を保持する」から外れる）
- **著者の外部キー**: `articles.author_id` と `comments.author_id` は `profiles.account_id` を参照（プロフィールが必須なので）。選ばなかった案: 外部キー無しの文字列
- **著者の判定**: 「著者だけ」は `mayChange(actor, article)` を model に置き、service で `find`（見えなければ NOT_FOUND）→ `mayChange`（FORBIDDEN）→ `update`。下書きは到達範囲（reach）で本人以外に見えないので、他人の下書きは自然に NOT_FOUND になる。reach は 1 つ（公開中または自分の）だけ
- **到達範囲の中身**: `published-or-own`（`viewerId: string | null`）。`GET /users/:id/articles` と一覧は、窓を通した上で `status = published` を queries 側で足した
- **コメントの数**: コメントの repo が `commentCountByArticleWithin(db)`（actor 無し、記事ごとの集計）を出し、記事の queries が `leftJoin` + `coalesce` で付ける。公開を取り消している間も数えるので、数える側は記事の状態を見ない
- **PROFILE_REQUIRED の置き場所**: プロフィールが無い人は「入口のチェック」と考え、handler で `profiles.get(actor)` を呼んで返す。service には `Account` だけ渡す（service は他ドメインの失敗の値を import できないため）。選ばなかった案: articles / comments の model にそれぞれ同じコードの `Failure` を置く（重複する）。`ProfileRequired` は profiles の model に置き、routes から import した
- **検査の順序**: `POST /articles/:id/comments` は 記事が見えて公開中か（NOT_FOUND）→ プロフィール（PROFILE_REQUIRED）→ 書く、の順。api.md は順序を決めていない。記事が無いのに PROFILE_REQUIRED を返すと記事の有無が漏れるのでこの順にした。`POST /articles` は記事が無いので PROFILE_REQUIRED だけ
- **コメント service にも「公開中だけ」を持たせた**: handler で `isPublished` を見て NOT_FOUND を返すのに加え、`comments.create` も draft なら NOT_FOUND を返す（docs の「どの入口から呼んでも守る規則は service」に従う）。重複しているが、順序（上の件）のために handler 側でも見ている
- **`updatedAt`**: 公開・公開取り消しでも `updatedAt` を `now` にした。api.md の「変えた日時」が題・本文の変更だけを指すのか不明（api.md の曖昧さ）。選ばなかった案: 題・本文を変えたときだけ動かす
- **`createdAt` の同時刻**: コメントの並びと一覧のカーソルは `(日時, id)`。テストでは `at` を渡して並びを決めた
- **コメントに `updatedAt` は持たせない**: 書いた日時しか見せず、変えられない
- **一覧の行の型**: 詳細・公開一覧・自分の一覧で見せるものが違う（api.md の表）ので、`ArticleRow` / `ArticleListRow` / `MyArticleRow` の 3 つ。選ばなかった案: 全部を詳細の行にして、response 側で削る（本文を一覧で読んでしまう）
- **日時の表示**: ISO 8601（`toISOString()`）の文字列。api.md は形式を決めていない
- **`GET /me/profile` の queries の置き場所**: `routes/me/profile/_queries.ts`（`profileQueries`）。`GET /users/:id/articles` の入口確認もこれを使う。選ばなかった案: `routes/users/_queries.ts`
- **テストの人**: 固定の alice / bob ではなく、`person(name)` で毎回別の ID を作った（同じファイルの中で行が混ざらないように）。DB がテストごとに空になるか docs に書いてなかったため

## そのほか

- api.md: 「公開を取り消した記事のコメントは消さずに残し」と「コメントの数に取り消している間のコメントも含める」は読み取れたが、**公開を取り消した記事に他人がコメント済みの状態で記事を消す**ケースは明言が無い（「記事を消すとコメントも消える」で足りると読んだ）
- api.md: 限界値の長さ（題 200、表示名 50、コメント 1000）は「前後の空白を除いて」と書いてあるので `trim()` してから測る。docs の「`trim()` before checking length」と一致していた。本文は空白を除かず 1 文字以上、と読んだ
- api.md: 一覧の `limit` の上限と既定値は書いていない。`pageQuerySchema` の既定（20、最大 100）に任せた
- api.md の `GET /users/:id/articles` の `:id` は「人の ID」＝アカウント ID と読んだ
- docs: `pnpm hnk gen` が `export const <名前>Queries` の名前を `deps` の名前にするのは、resources.md では「ディレクトリ名から `invoicesQueries`」と読めたが、実際は export 名がそのまま使われた。私は `profileQueries`（単数）にして通った
- docs: `scope.insert(...)` が drizzle の builder をそのまま返すので `returning()` / `onConflictDoUpdate()` が使える。`db/index.ts` を読まないと分からない
- 雛形: `src/domains/*/service.test.ts` の生成物は、`create(now)` / `get(id)` だけの最小の形。実物に育てるときに消して書き直すことになる（生成されたものを残すとコンパイルが通らなくなる）
- `pnpm hnk g domain` が 3 回ともうまく通り、`deps.ts` に追記されたのは分かりやすかった
- `pnpm check` は最初から最後まで 1 回で通った（途中で出た lint は上の 2 件だけ）
