#!/usr/bin/env bash
# Pre-PR gate. Catches the three things svelte-check and the build cannot see:
# a stale base, a PR carrying more than one concern, and scaffolding left
# behind after the feature it described was removed.
#
#   npm run check:pr
#
# Exits non-zero on a stale base or dead scaffolding. Scope is reported for a
# human to judge, since some changes legitimately span areas.

set -uo pipefail
cd "$(git rev-parse --show-toplevel)"

BASE_REMOTE="${BASE_REMOTE:-upstream}"
BASE_BRANCH="${BASE_BRANCH:-main}"
BASE="$BASE_REMOTE/$BASE_BRANCH"

bold=$(tput bold 2>/dev/null || echo '')
red=$(tput setaf 1 2>/dev/null || echo '')
yellow=$(tput setaf 3 2>/dev/null || echo '')
green=$(tput setaf 2 2>/dev/null || echo '')
off=$(tput sgr0 2>/dev/null || echo '')

fail=0
note() { printf '%s\n' "$1"; }
bad()  { printf '%s%s%s\n' "$red" "$1" "$off"; fail=1; }
warn() { printf '%s%s%s\n' "$yellow" "$1" "$off"; }
ok()   { printf '%s%s%s\n' "$green" "$1" "$off"; }

if ! git remote get-url "$BASE_REMOTE" >/dev/null 2>&1; then
	warn "No '$BASE_REMOTE' remote. Set BASE_REMOTE=origin if that is your base."
	exit 0
fi
git fetch "$BASE_REMOTE" "$BASE_BRANCH" --quiet 2>/dev/null

# ── 1. Is the branch built on the current base? ───────────────────────────────
printf '%s\n' "${bold}Base${off}"
read -r behind ahead <<<"$(git rev-list --left-right --count "$BASE"...HEAD)"

if [ "$behind" -eq 0 ]; then
	ok "  Up to date with $BASE ($ahead ahead)."
elif [ "$behind" -le 5 ]; then
	warn "  $behind commit(s) behind $BASE. Rebase before opening the PR:"
	warn "      git fetch $BASE_REMOTE && git rebase $BASE"
else
	bad "  $behind commits behind $BASE. This PR is not based on current code."
	bad "      git fetch $BASE_REMOTE && git rebase $BASE"
fi

changed=$(git diff --name-only "$BASE"...HEAD)

# ── 2. Does the PR carry one concern? ─────────────────────────────────────────
printf '\n%s\n' "${bold}Scope${off}"
if [ -z "$changed" ]; then
	note "  No changes against $BASE."
else
	# Coarse on purpose: the question is "does this PR do one thing", not
	# "which directory did it touch". First pattern wins, so order matters.
	areas=$(printf '%s\n' "$changed" | python3 -c '
import re, sys
RULES = [
    (r"^src/routes/\(zine\)/newsletter",   "newsletter"),
    (r"^src/lib/content/unfolding",        "newsletter"),
    (r"^src/routes/\(zine\)/wiggling",     "wiggling"),
    (r"^src/routes/\(zine\)/docs",         "docs"),
    (r"^src/routes/\(admin\)/",            "admin"),
    (r"^src/routes/\(auth\)/",             "auth"),
    (r"^src/routes/\(app\)/",              "app"),
    (r"^src/routes/\+page",                "landing"),
    (r"^src/routes/",                      "other-routes"),
    (r"^src/lib/",                         "shared-lib"),
    (r"^supabase/",                        "database"),
    (r"^(tests?|e2e)/",                    "tests"),
    (r"^scripts/",                         "scripts"),
]
seen, order = {}, []
for path in (l.strip() for l in sys.stdin if l.strip()):
    area = next((n for p, n in RULES if re.match(p, path)), "root")
    if area not in seen:
        seen[area] = 0
        order.append(area)
    seen[area] += 1
for a in sorted(order):
    print(f"    {a} ({seen[a]})")
print(f"__COUNT__{len(order)}")
')
	count=$(printf '%s\n' "$areas" | sed -n 's/^__COUNT__//p')
	printf '%s\n' "$areas" | grep -v '^__COUNT__'

	if [ "${count:-1}" -le 2 ]; then
		ok "  $count area(s). Reads as one concern."
	else
		warn "  $count areas in one PR. Split unless they genuinely ship together:"
		warn "      git log --oneline $BASE..HEAD   then cherry-pick onto fresh branches"
	fi
fi

# ── 3. Did the scaffolding leave with the feature? ────────────────────────────
printf '\n%s\n' "${bold}Leftovers${off}"
svelte_files=$(printf '%s\n' "$changed" | grep '\.svelte$' || true)

if [ -z "$svelte_files" ]; then
	note "  No .svelte files changed."
else
	# Deliberately narrow. svelte-check reports unused *selectors*; it says
	# nothing about empty blocks or comments that outlived their code. Only two
	# patterns are reported here because only these two are decidable without
	# guessing: a comment sitting above a live rule is indistinguishable from a
	# stale one, so it is left to review rather than flagged noisily.
	leftovers=$(printf '%s\n' "$svelte_files" | python3 -c '
import re, sys

COMMENT = re.compile(r"/\*.*?\*/", re.S)
EMPTY   = re.compile(r"\{\s*\}")
found = []

for path in (l.strip() for l in sys.stdin if l.strip()):
    try:
        src = open(path, encoding="utf-8").read()
    except OSError:
        continue
    m = re.search(r"<style[^>]*>(.*?)</style>", src, re.S)
    if not m:
        continue
    css, offset = m.group(1), m.start(1)
    line_of = lambda i: src.count("\n", 0, offset + i) + 1

    empties = [(e.start(), e.end()) for e in EMPTY.finditer(css)]
    for start, _ in empties:
        found.append((path, line_of(start), "empty rule block"))

    # Walk each run of consecutive comments and ask what real content follows.
    # If the answer is a closing brace, the end of the stylesheet, or an empty
    # block, the run describes something that is no longer there.
    comments = list(COMMENT.finditer(css))
    i = 0
    while i < len(comments):
        run_start, j = comments[i].start(), i
        while j + 1 < len(comments) and not css[comments[j].end():comments[j + 1].start()].strip():
            j += 1
        stripped = css[comments[j].end():].lstrip()
        # Nothing left, a closing brace, or a selector/at-rule with an empty
        # body: in all three the run describes code that is no longer there.
        dead = (
            stripped == ""
            or stripped.startswith("}")
            or re.match(r"[^{};]*\{\s*\}", stripped) is not None
        )
        if dead:
            first = re.sub(r"\s+", " ", comments[i].group(0)[2:-2].strip())[:56]
            found.append((path, line_of(run_start), f"orphaned comment: {first}"))
        i = j + 1

for path, line, what in sorted(found, key=lambda f: (f[0], f[1])):
    print(f"    {path}:{line}  {what}")
print(f"__COUNT__{len(found)}")
')
	total=$(printf '%s\n' "$leftovers" | sed -n 's/^__COUNT__//p')
	printf '%s\n' "$leftovers" | grep -v '^__COUNT__' || true

	if [ "${total:-0}" -eq 0 ]; then
		ok "  No empty blocks or orphaned comments."
	else
		bad "  $total leftover(s). Delete the scaffolding with the feature."
	fi
fi

# ── 4. Exported copy that nothing renders ─────────────────────────────────────
printf '\n%s\n' "${bold}Dead copy${off}"
if [ -f src/lib/copy.ts ]; then
	# Only keys this branch added or touched. The repo carries pre-existing
	# unrendered keys, and a gate that is red on arrival is a gate nobody
	# reads — the same way the 42 standing svelte-check warnings went unread.
	# [[:space:]] rather than \s: BSD grep on macOS does not understand \s and
	# silently matches nothing, which made this check pass on everything.
	keys=$(git diff -U0 "$BASE"...HEAD -- src/lib/copy.ts \
		| grep -E '^\+' | grep -oE '^\+[[:space:]]*[a-zA-Z][a-zA-Z0-9_]*:' \
		| tr -d '+ \t:' | sort -u)
	dead=""
	while read -r key; do
		[ -z "$key" ] && continue
		# No trailing slash on the search roots, and slashes squeezed: `grep -r
		# src/` emits `src//lib/copy.ts`, which silently defeated the exclusion
		# below and made every key look used.
		uses=$(grep -rF --include='*.svelte' --include='*.ts' -l -- "$key" src tests 2>/dev/null \
			| sed 's#//*#/#g' | grep -cv '^src/lib/copy\.ts$' || true)
		[ "$uses" -eq 0 ] && dead="$dead    $key"$'\n'
	done <<<"$keys"

	if [ -z "$dead" ]; then
		ok "  Every copy key is rendered somewhere."
	else
		printf '%s' "$dead"
		warn "  Unrendered copy keys. Delete them, or say in the PR why they stay."
	fi
else
	note "  No src/lib/copy.ts."
fi

printf '\n'
if [ "$fail" -eq 1 ]; then
	printf '%sNot ready to open.%s Fix the red items above.\n' "$bold" "$off"
	exit 1
fi
ok "Ready to open."
