# Ferio Design Language

A short reference for anyone designing or building on this product — engineers, other designers, or a freelancer picking up a screen. The goal in one line:

**Let the product speak. The interface should disappear.**

References: get.ru (grid discipline, restrained badges, product-first layout), Apple.com/Apple Store (pill buttons, single-typeface hierarchy, generous whitespace).

---

## 1. Principle

Minimalism here doesn't mean "less stuff." It means every element earns its place. If a color, icon, border, or shadow isn't carrying real information, it gets removed. The interface is mostly white space, black type, and product photography — color is reserved for things the user actually needs to notice (a sale, a status, an error).

This is also a deliberate reaction against a look that's become the default for AI-generated interfaces: a warm cream background with a serif headline and a terracotta accent, or a dark dashboard with five different named accent colors and emoji-style icons in the sidebar. None of that is here. If a screen needs a second glance to tell whether a human or a template built it, it's wrong.

---

## 2. Color

Grayscale does almost all the work. Color is only introduced for semantic meaning, never for decoration.

| Token | Hex | Use |
|---|---|---|
| `ink` | `#111114` | Primary text, buttons, headlines |
| `ink2` | `#6e6e73` | Secondary text, captions, labels |
| `line` | `#e8e8ea` | Hairline borders, dividers |
| `surface` | `#fafafa` | Subtle section backgrounds, image placeholders |
| `paper` | `#ffffff` | Page background |

Semantic color (status pills, alerts only) — use standard muted tints, never saturated:
- Success / delivered → pale emerald (`bg-emerald-50 text-emerald-700`)
- Pending / needs attention → pale amber
- Error / cancelled / returned → pale rose
- In progress / neutral → the gray `surface` tone, not a color at all

**Rule of thumb:** if you're reaching for a fourth named brand color, stop — you're decorating, not communicating.

---

## 3. Typography

One typeface family, used at different weights and sizes to build the entire hierarchy — not a serif-display-plus-sans-body pairing. That pairing is one of the most common tells of a templated design, so it's avoided here on purpose.

- **Typeface:** Inter (or any clean, neutral grotesk — system font is fine too)
- **Headlines:** semibold, tight tracking (slightly negative letter-spacing), large size (24–52px depending on context)
- **Body:** regular weight, 13–15px, relaxed line height
- **Eyebrows / labels:** 11px, uppercase, wide letter-spacing (`0.12em`), gray — used sparingly above section headers, never as decoration on every element
- **No mixed decorative fonts.** No script fonts, no multiple serif weights. Restraint here is what makes it feel designed, not assembled.

---

## 4. Shape & Space

- **Buttons:** fully rounded pills (`border-radius: 9999px`), solid black fill, white text, no shadow, no gradient. Apple's "Buy" button is the reference.
- **Cards / images / inputs:** small consistent radius (~10px), never sharp corners, never heavily rounded "bubble" corners.
- **Borders:** 1px hairlines in the `line` gray. Prefer a hairline divider over a boxed card with a shadow wherever possible — shadows read as "SaaS dashboard template."
- **Spacing:** generous. Err on the side of more whitespace between sections than feels necessary at first. Density is earned only in data tables (order lists, product tables), where a tighter grid signals "operational tool."
- **No drop shadows, no glassmorphism, no gradients.** Flat surfaces only.

---

## 5. Iconography

Avoid single Unicode glyphs standing in for icons (things like ◧ ▤ ◫ ◍) — they read as AI-generated placeholders. Two acceptable options instead:
1. **Plain text labels** — for a sidebar or nav, text alone (with an active-state background tint) is often cleaner than any icon.
2. **Real line icons** — simple 1.5px stroke outline icons (e.g. a cart, a chevron), used only where meaning genuinely needs a pictogram, not for every menu item.

---

## 6. Product & Data Display

- **Product cards:** image-first, no border, no shadow. Category label → name → price, in that order, small type. A discount shows as a small solid-black chip with the percentage (`−28%`), not a colored ribbon banner.
- **Tables (admin):** hairline row dividers, no zebra striping, no bold gridlines. Status shown as a small pill with muted semantic color. Uppercase gray micro-labels for column headers.
- **Empty / zero states:** plain, calm, one sentence plus one action — no illustration, no mascot.

---

## 7. Motion

Minimal and functional only: opacity/scale transitions on hover (e.g. a product image scales 1.03x), color transitions on interactive elements. No page-load animation sequences, no scroll-triggered reveals, no bouncing or spring effects. If it doesn't help the user understand a state change, it doesn't animate.

---

## 8. Voice (UI copy)

Plain, direct, active voice. "Add to cart," not "Submit." "Cash on delivery — pay when your order arrives," not marketing language. Errors and empty states explain what happened and what to do next, without personality or apology.

---

## 9. The one-sentence test

Before shipping any screen, ask: *if I removed every color except black, white, and gray, would this screen still make sense?* If yes, you've built it right — color was never doing the structural work, so it's free to be used sparingly and meaningfully. If the screen falls apart without its accent colors, it was decorated, not designed.