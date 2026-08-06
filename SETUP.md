# Setup — step by step, in plain words

No prior knowledge assumed. Follow these in order. About 40 minutes.

---

## Before you start

You need three free things:

1. A **GitHub account**
2. **Node.js version 20 or newer** — check by opening a terminal and typing `node -v`
3. About 40 minutes

You do **not** need a server, a domain, a credit card, or any paid service.
There is no required API key. It runs with zero keys.

---

## Step 1 — Run it on your laptop (10 min)

```bash
cd ~/projects
cd viral-radar
npm install
npm run run
```

**What just happened:** it read the news front page of 14 countries at the same
moment, plus Bluesky, Google Trends, Reddit and Wikipedia. Then it worked out
which of those ~530 headlines were actually the same story, and how many
countries each story is running in.

You should see something close to this:

```
1/7  collecting…
     bluesky      25 records
     googlenews   532 records
     gtrends      80 records
     reddit       94 records
     wikipedia    420 records
2/7  clustering headlines into stories…
     532 headlines → 36 stories
```

Then open the dashboard:

```bash
open docs/index.html          # Mac
xdg-open docs/index.html      # Linux
start docs/index.html         # Windows
```

> **The first run cannot show you spreading stories.** It measures *change in
> country count*, and on the first run there is nothing to compare against. Run
> it again in 3 hours and the `SPREADING` labels start appearing. That is not a
> bug — it is the whole reason the history matters.

---

## Step 2 — Reddit credentials (3 min, free, optional)

Skip this and everything still works — you just lose one of five sources when
running in the cloud.

**Why you need it:** Reddit blocks requests coming from data centres. Your laptop
is fine. GitHub Actions is a data centre, so it gets blocked. Credentials fix it.

1. Go to <https://www.reddit.com/prefs/apps>
2. Scroll down → **create another app**
3. Name: anything. Type: choose **script**. Redirect URI: `http://localhost`
4. Click create
5. The **client ID** is the short string under the app name. The **secret** is
   labelled `secret`.

```bash
cp .env.example .env
# paste both values into .env
```

---

## Step 3 — Anthropic key (5 min, optional, ~30 cents/month)

This writes the plain-English "why this matters" and "what to do about it" lines.
Those two lines are the difference between raw data and something someone pays
for.

1. Go to <https://console.anthropic.com>
2. Create an API key
3. Paste it into `.env` after `ANTHROPIC_API_KEY=`

It summarises 30 stories per run, 8 runs a day, on the cheapest model. Roughly
30 cents a month. Skip it if you want — everything else still works.

---

## Step 4 — Put it on GitHub (10 min)

```bash
git init
git add .
git commit -m "first commit"
gh repo create viral-radar --public --source=. --push
```

No `gh` command? Create the repo on github.com and follow the push instructions
it shows you.

**Make it public.** GitHub Actions is free forever on public repos.

---

## Step 5 — Add your keys to GitHub (5 min)

The `.env` file stays on your laptop. GitHub needs its own copy.

1. Repo → **Settings** → **Secrets and variables** → **Actions**
2. **New repository secret** for each of: `REDDIT_CLIENT_ID`,
   `REDDIT_CLIENT_SECRET`, `ANTHROPIC_API_KEY`
3. **Variables** tab → **New variable** → `SITE_URL` =
   `https://YOURNAME.github.io/viral-radar`

Skip any key you did not create.

---

## Step 6 — Turn on the robot (2 min)

1. Repo → **Actions** tab
2. If prompted, click **I understand my workflows, go ahead and enable them**
3. Click **viral-radar** on the left → **Run workflow** → **Run workflow**

Wait about a minute. Green tick means it worked.

**From now on it runs itself every 3 hours, forever.** Every run adds to your
history, and the history is the asset.

Why 3 hours and not 6? News moves in hours. On a 6-hour schedule a story can
break, go global and start fading between two readings, and you would never see
it spread.

---

## Step 7 — Put the site online (5 min)

1. Repo → **Settings** → **Pages**
2. **Source**: Deploy from a branch
3. **Branch**: `main`, **Folder**: `/docs` → **Save**

Two minutes later it is live at `https://YOURNAME.github.io/viral-radar`, and
`…/api/latest.json` is a working API anyone can call.

---

## Step 8 — Wait 24 hours, then read it properly

This is the step people skip, and it is the one that matters.

After a day you will have 8 readings. Open `newsletter/` and read them in order.
Ask one question of every `SPREADING` story:

> Did this actually go global afterwards, or did it die?

Write the answer down. After a week you will know whether your thresholds are
right. **Do not send this to anyone until you have done that week.** Automating a
brief you have not checked just sends wrong information faster.

---

## Troubleshooting

| Problem | Fix |
|---|---|
| `reddit 0 records` | Normal without credentials, or on GitHub Actions. Do Step 2. |
| `googlenews FAILED` | Rare. Google throttling. It retries automatically next run. |
| No `SPREADING` stories | Expected on the first 2 runs. Also normal on a quiet news day. |
| Clusters look wrong | Adjust `THRESHOLD` in `src/cluster.js`. Lower = bigger, looser groups. |
| Everything is one story | Threshold too low. Raise it back toward 0.55. |
| Action fails on push | Repo → Settings → Actions → General → Workflow permissions → **Read and write** |
| `enrichment skipped` | Anthropic key missing or out of credit. Harmless. |

---

## What to change first

After a week of running, these are the three knobs worth turning:

1. **`src/cluster.js` → `THRESHOLD`** (currently 0.48). The single most impactful
   number in the project. Too low merges unrelated stories; too high splits one
   story into five.
2. **`src/score.js` → `HALFLIFE_HOURS`** (currently 18). Lower it for breaking
   news, raise it for slower topics like business or science.
3. **`src/sources/googlenews.js` → `EDITIONS`**. Add or remove countries. More
   countries means better spread detection but slower runs. All editions are
   English on purpose, so headlines share words and can be matched — adding a
   French edition needs translation first.
