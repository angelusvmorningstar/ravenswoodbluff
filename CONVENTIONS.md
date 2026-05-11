# Ravenswood Bluff – Project Conventions

Binding rules for all contributors and AI-assisted development.
These conventions are machine-verified at Epic 5 readiness (Story 5.9).

---

## Negative requirements (architectural hard stops)

**No payment surface.** No donation widget, Patreon link, ko-fi badge, sponsor banner,
"Buy me a coffee" affordance, or sales-spirit copy anywhere in the codebase or rendered pages.
FR27 is a structural constraint, not a review note.

**No user-upload affordance.** No `<input type="file">`, no image-upload form, no
registration form, no login flow, no comment form, no visitor-authored content of any kind.
The site is read-only from the visitor's side. FR28.

**No third-party tracking scripts.** No Google Analytics, no Plausible, no Hotjar, no
social-media tracking pixels, no ad networks. NFR15. (Google Fonts are also excluded;
fonts are self-hosted under `public/fonts/`.)

**No third-party cookies.** NFR16. The only cookies permitted are first-party functional
cookies, of which there are currently none planned.

**No inline hex codes outside `tokens.css`.** All colour values are CSS custom properties
consumed via `var(--token-name)`. Palette changes happen exclusively in `src/css/tokens.css`.
NFR30.

**Token-printer code stays in a separate private repository.** If Phase 2 token-printer
tooling is ever developed, it must live outside the public source of this project. AR11.

---

## Prose conventions

**British English throughout.** Spelling: -ise, -our, -re endings (recognise, colour, theatre).
Common words to watch: realise, honour, licence (noun), practice (noun), defence, colour,
behaviour, catalogue, centred, travelling.

**No em-dashes.** Em-dashes (—) are forbidden in all body copy. Use an en-dash (–) with
spaces where a dash is needed, or rephrase. Commas are preferred. This rule applies to HTML,
Markdown, JSON text fields, and CSS comments.

**Grep check before marking a story done:**
```
grep -r "—" src/ src/content/ src/data/ CONVENTIONS.md
```
Zero results required.

---

## Design token rules

- `src/css/tokens.css` is the single source of truth for all palette, typography, spacing,
  radius, and motion values.
- Component CSS files (`shared.css`, `scripts.css`, `storytelling.css`, etc.) consume tokens
  exclusively via `var(--token-name)`. No raw hex codes, no raw font names, no magic numbers
  for spacing.
- Adding a new colour: add a palette token first, then a semantic alias if needed. Do not
  introduce a new palette colour without a semantic alias that describes its purpose.

---

## Font setup (Story 1.3)

Self-hosted font files belong at `public/fonts/`. Download from Google Fonts:

| File | Family | Weight | Style |
|------|--------|--------|-------|
| `cinzel-decorative-regular.woff2` | Cinzel Decorative | 400 | normal |
| `cinzel-decorative-bold.woff2` | Cinzel Decorative | 700 | normal |
| `cinzel-regular.woff2` | Cinzel | 400 | normal |
| `cinzel-semibold.woff2` | Cinzel | 600 | normal |
| `cinzel-bold.woff2` | Cinzel | 700 | normal |
| `lora-regular.woff2` | Lora | 400 | normal |
| `lora-italic.woff2` | Lora | 400 | italic |
| `lora-bold.woff2` | Lora | 700 | normal |
| `spectral-bold.woff2` | Spectral | 700 | normal |
| `libre-baskerville-regular.woff2` | Libre Baskerville | 400 | normal |
| `libre-baskerville-bold.woff2` | Libre Baskerville | 700 | normal |

Until these files are placed, pages render in a fallback `serif` face. The build still
succeeds and `npm run dev` still works.

---

## Accessibility baseline

- One `<h1>` per page. No skipped heading levels.
- `<html lang="en-GB">` on every page.
- Skip-to-content link as first focusable element in `<body>` on every page.
- `<main id="main" tabindex="-1">` as the skip target.
- `aria-current="page"` on the active nav link (set by inline JS in `_nav.html`).
- All decorative images: `aria-hidden="true"` and empty `alt=""`.
- Informative images (character icons): `alt="<Name> icon"`.
- No `outline: none` without a clearly visible replacement.
- Focus ring: 2px `var(--focus-ring)` outline + 1px `var(--ink)` inner.
- `@media (prefers-reduced-motion: no-preference)` gate on all transitions.

---

## CCC logo and non-affiliation disclaimer

The footer `_footer.html` must appear on every page. It carries:

1. The Pandemonium Institute "Community Created Content" parchment-variant logo.
   Source: https://bloodontheclocktower.com/pages/community-created-content-policy
   Place the image at `public/images/ccc-logo.png`.

2. Non-affiliation disclaimer linking to:
   `https://bloodontheclocktower.com/pages/community-created-content-policy`

3. Icon non-redistribution notice linking to `/license-icons/`.

These are structural requirements (FR24, FR25, FR26), not optional content.

---

## Icon library rules

- Canonical icons: `Icons - alternative/` (~324 PNGs) – Angelus Morningstar's IP.
- Icons are served at display resolution only (96–128px tall). Print-quality originals
  do not appear in `public/icons/`.
- No zip / archive download of the icon set.
- Copy-friction tactics: `draggable="false"` on all `<img>` tags in character cards.
- A non-redistribution notice appears in the footer and in full on `/license-icons/`.

---

## URL scheme (locked – NFR27)

| URL | Entry file |
|-----|-----------|
| `/` | `src/index.html` |
| `/into-the-woods/` | `src/into-the-woods/index.html` |
| `/scripts/` | `src/scripts/index.html` |
| `/scripts/<id>/` | Generated: `src/scripts/<id>/index.html` |
| `/storytelling/` | `src/storytelling/index.html` |
| `/storytelling/<slug>/` | Generated: `src/storytelling/<slug>/index.html` |
| `/admin/` | `src/admin/index.html` (Phase 2 seam, no public nav link) |
| `/license-icons/` | `src/license-icons/index.html` |
| `/404.html` | `src/404.html` |

Do not change this scheme. Any URL rename requires 301 redirects to preserve SEO.

---

## Phase 2 seam

`src/admin/index.html` is a placeholder. It builds and deploys. It is not linked from
any visitor-facing navigation. Phase 2 admin tooling grafts on here. Token-printer code
stays in a separate private repository (AR11).

---

## Public/private data divergence

`src/data/characters.json` in this public project contains only officially released BotC
characters (173 entries as of 2026-05-08). It diverges permanently from the private project's
version, which includes Into the Woods homebrew characters. Do not copy-paste character entries
from the private project into this file.

`src/data/jinxes.json` is hand-authored. Update it manually when TPI publishes new characters
(add any jinxes they carry) or when official errata changes jinx text.
