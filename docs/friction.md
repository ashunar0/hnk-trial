# friction

hono-kit の決まりで書いていて、引っかかったところの記録。書いた人が、作業の途中で足していく。

書き方: 1 項目ずつ、どのファイルのどこで、何に迷ったか、どうしたかを書く。「こうすべきだった」ではなく、起きたことを書く。

## ぶつかった

（docs を読んでも答えが無かった、docs と実物が食い違った、lint や型に止められて直し方が分からなかった）

- **`pnpm hnk g domain users` が `src/domains/users already exists` で止まった。** 雛形には `src/domains/users/model.ts` だけが先にあり（サインイン中の `User`・`Role`・`OrgId` を持つ）、生成器は「ディレクトリがあれば作らない」。docs（domains.md）にも「雛形の users をどうするか」は無い。`model.ts` を scratchpad に退避 → 生成 → 自分で中身を統合、で回避した。生成器が既存の model.ts を見て足してくれるか、docs に一行あれば迷わなかった
- **雛形の `User`（サインインしている人）と、生成された `User`（ユーザー表の 1 行）が同じ名前でぶつかる。** rules.md は「`User` は誰がサインインしているかと役割だけ。業務上の人は自分の domain の行にする」と言うが、この API では「ユーザー」が名前を持つ業務上の人そのもの。`User`（セッション。`kind` と `id` だけ）と `Profile`（行。名前つき）に分けた。「業務上の人の行」の名前の付け方は docs に無いので `Profile` は自分で付けた（下の「自分で決めた」にも書く）
- **ログインの代わりの `x-user-id` で、ミドルウェアから DB を読む方法が docs に無い。** ID のユーザーが存在するか確かめたいが、`provideDeps` が作る deps はハンドラにしか渡らない（ミドルウェアからは触れない。`DEPS_KEY` は hono-kit 内部）。`auth.ts` から `makeDeps` を直接 import したら `import/no-cycle`（deps → routes.gen → routes → middleware/auth → deps）で止まった。`withUser(makeDeps)` と「deps の作り方を受け取る関数」にして、`buildApp` の既定引数 `authenticate = withUser(makeDeps)` で渡して解決。ただし `auth.ts` では `import type { usersService }` で形だけ借りている。docs の「認証がまだ無いときの入れ方」に載せてほしい
- **リソースから `hono-kit/failures` を import すると `layer-imports` に止まる。** NotFound / Forbidden は `hono-kit`（index）からも取れるので、そちらに直した。docs の resources.md の例は `NotFound` をどこから import するか書いておらず、service・model は `hono-kit/failures` なので同じだと思って書いた。逆に queries は `hono-kit` を import できず、`PageQuery` 型は `hono-kit/page` から取る（docs の layout.md は「`PageQuery` を取る」としか書いていない）。lint のメッセージに「許される import」が出るので直せたが、docs 側に表があるとよい
- **匿名でも見られる GET で「ログインしていれば自分の下書きも見える」をどう書くか、docs に無い。** `allowAnonymous` のときは `c.get("actor")` が無い。`c.get("user")`（`User | null`）は型の上では読める（env.ts のコメントは「ハンドラは読まない」と言う）ので、それを `viewer` としてクエリに渡した。窓（`articlesWithin(db, viewer)`）の引数は「actor」が決まりだが、ここは `Actor | null` にしている
- **`pnpm exec prettier --write .` が `docs/api.md`（与えられた仕様）の表の幅を整形して書き換えた。** 空白だけの差だが、仕様書が動く。`.prettierignore` に足して format の対象から外すと check を黙らせることになるので、整形されたままコミットした
- **「記事を消すとコメントも消える」を 1 回の書き込みでやる方法が docs に無い。** 記事の repo は自分の表（`scopeTo(db, articlesTable)`）にしか書けず、コメントは別 domain。`cross-domain.md` の「親の下にぶら下がるもの」は子 domain の作り方は書くが、親を消すときの子の扱いは書いていない。FK の `onDelete: "cascade"` に任せた（`comments.articleId`）。D1 が FK を強制することはテスト（`test/article-delete.test.ts`）で確かめた
- **「本人以外の下書き → NOT_FOUND、本人以外の公開中 → FORBIDDEN」を、rules.md の「確認してから書く、は禁止（WHERE に入れて 1 文で）」とどう両立するか。** 404 と 403 を分けたいので、まず `find(reach, id)`（見える範囲で探す）で NOT_FOUND、`mayChange` で FORBIDDEN を決め、書くときは `update(own reach, ...)` と `transition(own reach, from, ...)` の WHERE に著者と元の状態を入れ直した。読んでから書くので競合の隙はあるが、書き込み自体は著者でない行を決して変えない。これで良いのか docs に答えが無い

## 自分で決めた

（docs に書いていないので、自分で選んだ。選ばなかった案も書く）

- **`User`（サインイン中の人）と `Profile`（ユーザー表の 1 行）に分けた。** 選ばなかった案: ① 1 つの `User` に名前も入れて `withUser` が行を読んで丸ごと作る（rules.md の「User は誰かと役割だけ」から外れる）、② 行の名前を `Member`（会員）にする（この API に会員は出てこない）。`orgId`・`role`・`requireRole`・`Role` は「組織や役割は無い」ので雛形から消した
- **記事の状態は `status`（`draft` | `published`）と `publishedAt` の両方を持つ。** state.md に従って列挙にしたが、「公開が新しい順」に並べるには公開した時刻も要る。重複なので、非公開に戻したら `publishedAt = null` に戻し、`transition` で 2 つを一緒に書く。選ばなかった案: `publishedAt` だけ（null なら下書き）。docs の「列挙にする」に従った
- **コメントの domain を記事と分けた。** 記事とコメントは「片方だけ書かれると困る」関係ではない（記事の削除だけ、FK の cascade に任せる）。選ばなかった案: 記事の domain に表を 2 つ入れる
- **コメントを書ける条件（記事が公開中）はコメントの service が持つ。** ハンドラが `articles.get(actor, id)` で「見える記事」を読んで `{ id, status }` を渡し、service が `status === "published"` でなければ NOT_FOUND を返す。`"published"` という文字列はコメント側の model にコピーを持った（domain は互いに import できないので）。選ばなかった案: ハンドラで `status` を見て弾く（コマンドラインや別の入口から呼ぶと抜ける）
- **本人以外が公開中の記事を公開する・公開を取り消そうとしたとき。** api.md には変更・削除しか書いていない。rules.md の確認の順（NOT_FOUND → FORBIDDEN → conflict）に従い、FORBIDDEN を ALREADY_PUBLISHED / NOT_PUBLISHED より先に返す。本人以外の下書きは NOT_FOUND
- **ユーザーの存在確認が必要な `x-user-id`。** 形式が正しくない（空文字）ID、存在しない ID は、どちらもログインしていない扱い（401）にする。api.md の「ヘッダーが無いとき、または ID のユーザーがいないとき」の解釈
- **記事のレスポンスは全エンドポイントで 1 つの形。** 一覧・単体・`/me/articles` すべて `id, title, body, status, publishedAt, author{id,name}, commentCount, createdAt, updatedAt`。api.md は一覧ごとに「著者つき」「コメント数つき」「公開中かどうかつき」と違うが、`_response.ts` は 1 つ（resources.md「同じものを見せるなら同じ `_response.ts`」）に従って揃えた。一覧にも本文を入れた。選ばなかった案: 一覧用の要約の形を別に作る
- **窓を 3 つ書いた。** `articlesWithin(db, viewer)`（公開中＋自分の下書き）・`publishedArticlesWithin(db)`（誰が見ても同じ）・`ownArticlesWithin(db, actor)`。「誰が見ても同じ数は actor を取らない窓」という docs の考えを記事の一覧にも当てはめた。3 つとも別名は `articles_within` に揃えた（型が同じになり、`selectArticles` が 1 つで済む）
- **コメントの窓は actor を取らない。** コメントはだれにでも見える。記事が見えるかどうかは、ハンドラの入り口の確認（`articlesQueries.getPublished`）で判断する
- **`commentCount` は `commentCountByArticleWithin(db)`（コメントの repo が出す件数の窓）を `leftJoin` + `coalesce` で。** layout.md の「数え方」の書き方どおり。下書きに戻した記事のコメントも数える（消さずに残す、というルールなので）
- **一覧の並び。** 公開中は `publishedAt desc, id desc`、自分の記事は `createdAt desc, id desc`、コメントは `createdAt asc, id asc`。カーソルの `at` は並べる時刻。昇順の続きの条件は `(at, id) > (cursor)` を自分で書いた（page.ts は並びの向きを持たない）
- **ID の形。** URL の `:id` は `z.string().min(1)`（UUID かは見ない）。存在しなければ 404。UUID の形でなければ 400 にする案もあったが、docs の `…IdSchema` の雛形に従った
- **テスト用の下ごしらえ（`test/fixtures.ts` の `signUp` / `writeDraft` / `writePublished`）。** `signUp` は users の service で作る。`writeDraft` / `writePublished` は HTTP 経由（`request`）で作った。rules.md は「他の domain の行は、その domain の service で作る」だが、公開時刻を `at` で固定したかったので HTTP を使った。domain の `service.test.ts`（comments）がこの HTTP の下ごしらえに頼っている
- **本人の確認のあと、`update` / `delete` が null や false を返したら NOT_FOUND に倒す。** 読んだあとに他のリクエストが消した場合

## そのほか

- 生成された `service.test.ts` は `create(now)` などの引数が雛形のままなので、フィールドを足すとすぐ型が通らなくなる。生成器が出すテストは書き直す前提で書かれていると理解した
- `routes/articles/[id]/comments` のパラメータ名は、兄弟の `articles/[id]/index.ts` と同じ `[id]` でなければならない（`[articleId]` にはできない）。docs の例は `[issueId]/comments` と親の名前を変えているが、同じ階層に `[id]/index.ts` もある場合は `id` で揃う。そこは試して分かった
- `ReturnType<typeof articlesQueries>` から行の型を取ろうとすると、メソッドの戻り値が自分自身の型を含んで循環する（`TS2456`）。`select` を関数の外に出して、そこから型を取ると解けた
- `pnpm hnk g domain` が生成する `repo.d1.ts` の `…Within` は actor を取らない版。actor を取る版への書き換えの例は docs（cross-domain.md）にあって助かった
- `/me/articles` の並びのテストは、作成時刻（`createdAt`、`new Date()` から取る）が同じ ms になると `id` の順に落ちて不安定になるので、書く間に 5ms 待っている。`request()` の `at` は公開など `now` を使う書き込みにだけ効き、`POST /articles` を呼ぶ `writeDraft` は `at` を渡していない
- hono-kit は `link:` で手元の main を指している（0.7.0）
