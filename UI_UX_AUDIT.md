# myHoodora Web — UI/UX & Responsive Design Audit

Scope: `apps/web` (Next.js 16 + Tailwind v4) and the shared `packages/ui` primitives.
Stack notes: Tailwind is configured in CSS via `@theme inline` in `apps/web/src/app/globals.css` (no `tailwind.config.js`). Fonts: **Outfit** (sans/heading) + JetBrains Mono, loaded via `next/font`. Brand tokens (`--brand-teal #147c73`, `--brand-coral #ff6b5b`, `--brand-ink`, `--brand-gray`) live in `globals.css`.

This document is **recommendations + implementation plan only** — nothing here has been applied to the code yet.

---

## 1. Executive summary

The site has a clear, coherent visual identity (teal/coral, Outfit, rounded cards) and the marketing copy is strong. The problems are **systemic, not page-specific**:

1. **Typography has no weight scale.** Weights are hand-picked per usage with a heavy bias toward `font-bold` (96 uses), `font-black` (36) and `font-extrabold` (8), while `font-medium` appears only 2×. Because Outfit is a geometric sans that already reads strong, 700–900 weights make the whole app feel heavy — especially headings and buttons on mobile.
2. **Spacing and container padding are inconsistent.** Section padding, card padding, container gutters and shadows each vary slightly from page to page.
3. **The home hero is a desktop layout squeezed onto mobile.** A full-bleed landscape photo behind a left-to-right gradient, inside a `min-h-[85vh]` section, with the signup card stacked *below* the headline — the image is almost entirely invisible on a phone and the section is enormous.
4. **The hero image has no device-aware configuration.** `site-images.ts` stores only `src`/`alt`/`credit` — no aspect ratio, no focal point, no mobile treatment. The renderer defaults to `object-cover` + a left gradient, which crops badly on portrait screens.
5. **Repeated one-off patterns** (kicker pills, "or" dividers, radii, shadows) are re-implemented inline instead of shared.

Root cause of all five: **there is no design-token layer for typography/spacing/radius/shadow, and the hero image config doesn't model device differences.**

---

## 2. Typography & visual weight

### 2.1 Findings (what is actually excessive)

Weight usage across `apps/web/src` + `packages/ui/src`:

| Weight | Count | Where it's used (and whether it's justified) |
|---|---|---|
| `font-bold` (700) | 96 | Buttons, card titles, labels, badges, nav, avatar initials — overused |
| `font-semibold` (600) | 55 | Nav, links, breadcrumbs, dropdown items — appropriate |
| `font-black` (900) | 36 | Nearly every page heading + stat numerals + 404 + initials — excessive |
| `font-extrabold` (800) | 8 | Section headings, sidebar group labels — excessive |
| `font-medium` (500) | 2 | Almost never used — the missing middle |

Concrete offenders:

- `HeroSection.tsx:122` — `<h1 class="text-5xl lg:text-7xl font-black tracking-tight">` (900 weight at up to 72px).
- `AboutHero` (`about-hero.tsx:40`) — `text-4xl sm:text-5xl lg:text-6xl font-black`.
- `SectionHeading` (`packages/ui/src/section.tsx:59`) — `h2` uses `font-extrabold`.
- `CTASection.tsx:18`, `CommunityFeedSection.tsx:303`, `coming-soon.tsx:178` — `font-extrabold`.
- `Button` base (`packages/ui/src/button.tsx:24`) — every button is `font-bold`.
- Auth pages (`login/page.tsx:88`, `register/page.tsx:95`), `feature-preview-header.tsx:20`, `profile-hero.tsx:37` — `font-black` headings.
- `Badge` (`badge.tsx:6`), kicker pills (`section.tsx:52`, `CommunityFeedSection.tsx:300`, `coming-soon.tsx:173`, `about-hero.tsx:35`), labels (`login:98`, `register:120`) — `text-xs font-bold uppercase tracking-wider` (tiny bold-caps is visually noisy).
- `SidebarGroupLabel` (`sidebar.tsx:317`) and the "V0.1" tag (`dashboard-sidebar.tsx:74`) — `text-[10px] font-extrabold uppercase`.
- Stat numerals (`about-story.tsx:103`) — `text-4xl sm:text-5xl font-black` (900).
- Avatar/initials (`HeaderActions.tsx:67`, `dashboard-sidebar`, `FeedPost`) — `font-black` / `font-bold`.

The heaviness is compounded by Outfit itself: at 700–900 it reads much bolder than e.g. Inter or system-ui. Body text is mostly fine (`font-normal` default, `leading-relaxed`), so the fix is about *headings, buttons, and micro-labels*, not body copy.

### 2.2 Proposed typography system (Outfit)

A single weight scale, applied consistently. No new library — just a documented mapping enforced in the shared primitives first, then swept through page components.

| Role | Now | Proposed | Rationale |
|---|---|---|---|
| Display / H1 (hero) | `font-black` (900) | `font-bold` (700) + `tracking-tight` | 700 is already strong in Outfit |
| Page H1 (auth, 404 title) | `font-black` | `font-bold` | consistent |
| Section H2 | `font-extrabold` (800) | `font-bold` (700) | one step lighter |
| Card / feature H3 | `font-bold` (700) | `font-semibold` (600) | hierarchy: H2 > H3 |
| Stat numerals | `font-black` (900) | `font-bold` (700) | keep numerals heavy-ish, drop 900 |
| Buttons | `font-bold` (700) | `font-semibold` (600) | buttons read clearly at 600 |
| Nav links | `font-semibold` | `font-medium` (500) | less shouting in the chrome |
| Uppercase micro-labels / kickers / badges | `font-bold` + `tracking-wider` | `font-semibold` (600) + `tracking-wide` | caps already add weight; trim both |
| Body / helper text | `font-normal` | unchanged | already correct |

Recommended size scale (mobile-first, scale up at `sm`/`lg`):

```
Display  : text-4xl  sm:text-5xl  lg:text-6xl   (hero — down from 5xl/7xl)
H1 page  : text-3xl  sm:text-4xl                (auth, section tops)
H2       : text-2xl  sm:text-3xl  lg:text-4xl   (section headings)
H3       : text-lg   sm:text-xl                 (card titles)
Body     : text-base (16px), leading-relaxed
Small    : text-sm
Micro    : text-xs, tracking-wide, uppercase (labels/kickers)
```

### 2.3 Implementation

1. **Add font-weight tokens** in `globals.css` `@theme inline` so the mapping is data, not scattered decisions:

   ```css
   @theme inline {
     --font-weight-display: 700;   /* h1 */
     --font-weight-heading: 700;   /* h2 */
     --font-weight-subhead: 600;   /* h3 / card titles */
     --font-weight-strong: 600;    /* buttons, labels */
     --font-weight-body: 400;
   }
   ```

   (Tailwind's built-in `font-bold`/`font-semibold` map to these fixed values; the tokens above are the *semantic* contract to follow.)

2. **Fix the shared primitives first** (one edit fixes the whole app):

   - `packages/ui/src/button.tsx:24` — `font-bold` → `font-semibold`.
   - `packages/ui/src/section.tsx:59` — `font-extrabold` → `font-bold`; kicker `:52` `font-bold … tracking-wider` → `font-semibold … tracking-wide`.
   - `packages/ui/src/badge.tsx:6` — `font-bold` → `font-semibold`.
   - `packages/ui/src/avatar.tsx:41` — `font-bold` → `font-semibold`.
   - `packages/ui/src/sidebar.tsx:317` — `font-extrabold` → `font-semibold`; `:381` `font-bold` → `font-semibold`.
   - `packages/ui/src/breadcrumb.tsx:54` — `font-bold` → `font-semibold`.
   - `packages/ui/src/select.tsx:100` / `dropdown-menu.tsx:61` — `font-bold` → `font-semibold`.

3. **Sweep page components** — mechanical replacements only (no layout changes):

   - `font-black` → `font-bold` in: `HeroSection.tsx:122`, `about-hero.tsx:40`, `login/page.tsx:88`, `register/page.tsx:95`, `forgot-password` / `reset-password` headings, `not-found.tsx:18`, `feature-preview-header.tsx:20`, `profile-hero.tsx:37`, `about-story.tsx:103`, `how-it-works.tsx:64`, `HeaderActions.tsx:67`.
   - `font-extrabold` → `font-bold` in: `CTASection.tsx:18`, `CommunityFeedSection.tsx:303`, `coming-soon.tsx:178`.
   - `font-bold` → `font-semibold` on **card titles and uppercase labels**: `FeaturesSection.tsx:32/48/66`, `neighborhood-network.tsx:115`, `about-story.tsx:81`, `how-it-works.tsx:70`, `trust-safety.tsx:73`, `Footer.tsx:63/101/139` (footer column headings), plus all `text-xs font-bold uppercase` label/kicker occurrences.
   - `font-semibold` → `font-medium` on **nav chrome**: `Header.tsx:100`, `dashboard-sidebar.tsx:27`.

4. **Reduce the hero display size** (ties into §4): `HeroSection.tsx:122` `text-5xl lg:text-7xl` → `text-4xl sm:text-5xl lg:text-6xl`.

---

## 3. Responsive design audit

### 3.1 Findings

- **Container gutters disagree.** `Section` (`section.tsx:15`) uses `px-6 lg:px-20`; `Header` (`Header.tsx:67`) uses `px-4 sm:px-6 lg:px-8`; `Footer` (`Footer.tsx:6`) uses `px-6 lg:px-20`. Three different paddings for the same 7xl container → misaligned left edges on desktop.
- **Section vertical rhythm is inconsistent.** `py-24` (Features), `py-20 lg:py-24` (about sections), `py-24 sm:py-32` (CTA), `py-20 sm:py-28` (coming-soon), `py-16` (footer). No shared rhythm token.
- **Cards too large on mobile.** `FeaturesSection.tsx:27` uses `p-8` (32px) with `size-20` icons; `neighborhood-network.tsx:92` `p-7`; on a 375px screen these eat horizontal space and feel padded-out. Icons don't scale down.
- **Button `lg` is tall** (`button.tsx:20` `px-8 py-4`). Fine on desktop, heavy on mobile; the default `px-4 py-3` is the better mobile baseline.
- **Inputs are visually loud** (`input.tsx:5` `py-4 shadow-xl`, `border-2`). `shadow-xl` on every input makes forms glow; `py-4` is a lot for a single-line input.
- **CTA section is very tall** (`CTASection.tsx:11` `py-24 sm:py-32` = 128px top/bottom on desktop).
- **Footer** uses `mt-20` before the bottom bar plus `py-16` — generous but acceptable; the inconsistency is the `lg:px-20` gutter (see above).
- **CommunityFeedSection** is `h-[220vh]` (`CommunityFeedSection.tsx:295`) — a long scroll to drive the pinned phone. This is a deliberate scroll-driven feature; see §6 for what to leave alone.

### 3.2 Proposed changes

1. **Standardize container gutters** to one value everywhere: `px-4 sm:px-6 lg:px-8` (match the Header). Update `Section` (`section.tsx:15`) and `Footer` (`Footer.tsx:6`) to use it. This aligns every section edge with the header.
2. **Standardize section vertical padding** with a token and a single scale:

   ```css
   /* globals.css */
   @theme inline {
     --section-y: 4rem;          /* 64px mobile */
     --section-y-lg: 6rem;       /* 96px desktop */
   }
   ```

   Then sections use `py-16 lg:py-24` (or the token). Drop the `sm:py-32` CTA over-padding to `py-16 lg:py-24`.
3. **Scale cards/features down on mobile.** `FeaturesSection` cards: `p-6 sm:p-8`, icon container `size-14 sm:size-20`, icon `size-7 sm:size-10`. `neighborhood-network` cards: `p-5 sm:p-7`.
4. **Calm the inputs.** `input.tsx:5` / `password-input.tsx:22` / `select.tsx:26` / `textarea.tsx:15`: `shadow-xl` → `shadow-sm`, `py-4` → `py-3` (keep `py-3.5` for selects is fine). Keep the `border-2` focus treatment — it's part of the identity — but the heavy shadow is the noise.
5. **Button size on mobile.** Leave `default`/`lg` as-is for desktop, but the hero CTA row (`HeroSection.tsx:131-143`) should use `size="default"` on mobile and only widen at `sm`.

---

## 4. Hero / image view on mobile

### 4.1 Findings (why it looks bad on a phone)

`HeroSection.tsx:95-143`:

- `min-h-[85vh]` with `lg:grid-cols-2` → below `lg` everything stacks into one column: headline → subtext → address form → **entire signup card**. On a phone the section is ~3+ viewports tall.
- The image is `SmartImage fill object-cover` (`:97-103`) — a **landscape** photo (`hero-street.webp`) forced into a tall portrait container, so `object-cover` crops it to a thin vertical sliver.
- The overlay is `bg-gradient-to-r from-background/95 via-background/60 to-transparent` (`:104`) — a **left-to-right** gradient. On a narrow screen the left 95%-opaque white hides the image behind the text and only the far-right edge of the photo peeks out. The photo is effectively invisible on mobile.
- The headline is `text-5xl font-black` (`:122`) — huge + heavy at 375px.
- The address input + "Find my hood" (`:131-143`) is a decorative (non-functional) form that pushes the real signup card further down.

### 4.2 Proposed refactor — a *different* mobile composition (not a shrunk desktop hero)

Keep the desktop layout (2-col with full-bleed image + left gradient) but give mobile its own structure:

**Mobile / tablet (< lg):**
- Compact hero with a clean (light) background: `h2`-weight headline (`text-4xl font-bold`), subtext, and a single primary CTA — **no** background photo, **no** address form.
- The photo becomes a **contained, intentional card** below the copy: `aspect-[16/10]` (or `4/3`), `rounded-3xl`, `object-cover`, with the credit caption. This is the "image as a supporting visual" pattern, and it reads like a designed mobile layout.
- The signup card stays, but as a normal stacked section (it already is), now reachable right after the compact hero instead of after 2.5 viewports of padding.

**Desktop (lg+):** unchanged structure — full-bleed image, left gradient, copy left + signup card right.

Suggested concrete shape (reference only):

```tsx
{/* Mobile-only hero copy (light bg) */}
<div className="lg:hidden px-4 sm:px-6 pt-12 pb-8 text-left">
  <h1 className="text-4xl font-bold tracking-tight text-foreground">
    Discover your <span className="text-primary">neighborhood</span>
  </h1>
  <p className="mt-4 text-base leading-relaxed text-muted-foreground">…</p>
  <Button size="default" className="mt-6">Find my hood</Button>

  {/* contained image card, not a full-bleed bg */}
  <div className="relative mt-8 aspect-[16/10] overflow-hidden rounded-3xl border border-border shadow-lg">
    <SmartImage fill className="object-cover" src={HERO_IMAGE.src} alt={HERO_IMAGE.alt} sizes="100vw" />
    {/* credit caption */}
  </div>
</div>
```

(The desktop block is the current markup, unchanged, wrapped in `hidden lg:block`.)

---

## 5. Settings / hero configuration

### 5.1 Finding — what the "settings UI" actually is

There is **no admin/settings screen that controls the landing hero**. The hero image is configured in code, in `apps/web/src/lib/site-images.ts`:

- `HERO_IMAGES[]` (order = preference), active image selected by index: `HERO_IMAGE = at(HERO_IMAGES, 0)` (`:130`).
- `TRUST_IMAGES[]` / `TRUST_IMAGE = at(TRUST_IMAGES, 2)` (`:131`).
- `ABOUT_AERIAL` single entry (`:113`).

The `ProfileHero` under `dashboard/settings` (`settings/profile-hero.tsx`) is a **different thing** — a teal gradient banner for the user's own profile (avatar + name + verification badge), not the landing-page image hero. It does not configure the marketing hero.

### 5.2 Root cause

The `SiteImage` interface (`site-images.ts:20-30`) models only `src`, `alt`, `label`, `credit`, `creditUrl`. It has **no aspect ratio, no focal point, and no mobile-specific crop**, so the renderer has no way to place the image well on a portrait screen — it falls back to a center `object-cover` inside whatever container it's dropped into.

### 5.3 Proposed refactor (small, additive, backwards-compatible)

Extend the config type so each image can declare how it should render per breakpoint:

```ts
export interface SiteImage {
  src: string;
  alt: string;
  label: string;
  credit: string;
  creditUrl: string;
  /** Intrinsic aspect ratio of the source image, e.g. "16/9", "4/3". */
  aspectRatio?: string;
  /** Focal point for object-position, e.g. "center", "50% 30%". */
  position?: string;
  /** Optional device-specific crop overrides. */
  mobile?: {
    aspectRatio?: string;
    position?: string;
  };
}
```

Then:

1. Populate `aspectRatio` / `position` for `HERO_IMAGE`, `TRUST_IMAGE`, `ABOUT_AERIAL` (e.g. hero street ≈ `16/9` with `position: "50% 40%"` to keep the street + commuters in frame; trust ≈ `4/3`).
2. In `HeroSection` / `AboutHero` / `TrustSafety`, use a small helper so `object-position` comes from config:

   ```tsx
   <SmartImage
     fill
     className="object-cover"
     style={{ objectPosition: HERO_IMAGE.mobile?.position ?? HERO_IMAGE.position }}
     ...
   />
   ```

3. `TrustSafetySection.tsx:62-69` already uses the correct responsive pattern (`width/height` + `aspect-[4/3]` + `sizes`); apply the same pattern to the new mobile hero card in §4 so it stays consistent.

This is a **config-structure refactor, not a UI**, and it directly answers "desktop settings reused in ways that produce poor mobile results": the missing piece is per-device crop metadata.

---

## 6. Consistency — shared pieces to introduce

Repeated inline patterns that should become shared primitives (in `packages/ui`, registered in `index.ts` + `package.json` exports):

1. **Kicker pill** — duplicated in `section.tsx:52`, `CommunityFeedSection.tsx:300`, `coming-soon.tsx:173`, `about-hero.tsx:35`, `neighborhood-network.tsx:107`. Extract a `<Kicker>` (or expose the existing `SectionHeading` kicker styling) so the tint, radius, and `font-semibold` weight are defined once.
2. **"or" divider** — identical markup in `HeroSection.tsx:255-261`, `login/page.tsx:133-139`, `register/page.tsx:110-116`. Extract `<Divider label="or" />`.
3. **Radius scale** — currently `rounded-xl` (inputs/buttons/feed), `rounded-2xl` (feature cards), `rounded-3xl` (signup card / network cards / trust panel). Propose a 3-step scale and stick to it: **inputs/buttons = `rounded-xl`, cards = `rounded-2xl`, hero/panel containers = `rounded-3xl`**. Move the signup card and network cards from `rounded-3xl` → `rounded-2xl` for card consistency, keep `rounded-3xl` only for the large trust-safety panel.
4. **Shadow scale** — currently `shadow-sm/lg/xl/2xl` plus custom values. Propose: **surface cards `shadow-sm`, interactive/primary CTAs `shadow-lg` with the brand-tinted shadow** (already the button default), drop `shadow-xl/2xl` on inputs and the signup card (`shadow-2xl` → `shadow-lg`).
5. **Container component** — `Section` already exists; adopt it for the Footer and any marketing section that currently rolls its own padding, so the gutter fix (§3.1) is applied once.

Color usage is already well tokenized (`--primary`, `--brand-coral`, `--muted`, etc.) — no change needed. Note that the **app shell (dashboard/admin) uses a `slate` palette** while **marketing uses the brand tokens**; this split is acceptable (app vs. marketing surfaces), but the dashboard's `slate-*` grays should stay consistent with each other, which they already are.

---

## 7. Ordered implementation checklist

Grouped so each step is independently safe and reversible. Steps 1–2 fix everything via the shared layer; 3–5 are page-level.

1. **Tokens** — add `--font-weight-*`, `--section-y` tokens to `globals.css`.
2. **Shared primitives** (`packages/ui`): button, section (heading + kicker), badge, avatar, sidebar, breadcrumb, select, dropdown-menu weight fixes; input/password-input/select/textarea shadow+padding; introduce `Kicker` and `Divider`.
3. **Typography sweep** — `font-black`→`font-bold`, `font-extrabold`→`font-bold`, card-title `font-bold`→`font-semibold`, nav `font-semibold`→`font-medium` across the files listed in §2.3.
4. **Spacing/container sweep** — unify gutters (`Section` + `Footer` → `px-4 sm:px-6 lg:px-8`), unify section padding (`py-16 lg:py-24`), scale feature cards/icons on mobile, tame CTA padding.
5. **Hero refactor** — mobile-specific composition (§4.2) + `site-images.ts` device-aware config (§5.3) + `object-position` wiring.

Verification after implementation: `cd apps/web && pnpm lint && pnpm check-types && pnpm build`, then a visual pass at 375 / 768 / 1024 / 1440 px on `/`, `/about`, `/how-it-works`, `/coming-soon/*`, `/login`, `/register`, `/not-found`, and the dashboard.

---

## 8. What stays unchanged (and why)

- **Brand colors and the Outfit typeface** — the identity is strong; only *weight* and *scale* change.
- **The CommunityFeedSection scroll-pinned phone** (`h-[220vh]`) — it's a deliberate scroll-driven feature; not a responsiveness bug. Only the copy heading weight changes (per §2).
- **The dashboard/admin `slate` palette** — intentional app-vs-marketing split; no re-theming.
- **The `TrustSafetySection` image pattern** — it already does `aspect-ratio` + `object-cover` + `sizes` correctly; it becomes the reference pattern, not a target for change.
- **No new UI library / design system** — everything is done with existing Tailwind v4 + the shared `@myhoodora/ui` primitives.
- **The decorative "Find my hood" address form** — retained on desktop (it's part of the hero), only *omitted from the mobile composition* where it crowds the viewport.
- **Functionality, routes, and animations** (`AnimatedSection`, framer-motion) — untouched.
