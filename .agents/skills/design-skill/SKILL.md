---
name: design-skill
description: Ferio Design Language — apply when building or reviewing any UI screen in this project. Covers color tokens, typography, shape, spacing, iconography, data display, motion and voice rules.
---

# Ferio Design Language

Read `design-language.md` in this folder for the full reference. The goal in one line:

**Let the product speak. The interface should disappear.**

## Quick reference

| Token | Hex | Use |
|---|---|---|
| `ink` | `#111114` | Primary text, buttons, headlines |
| `ink2` | `#6e6e73` | Secondary text, captions |
| `line` | `#e8e8ea` | Hairline borders |
| `surface` | `#fafafa` | Subtle backgrounds |
| `paper` | `#ffffff` | Page background |

## Non-negotiables

- Grayscale does the structural work; color only for semantic meaning
- Pill buttons (`9999px` radius), solid black fill, white text — no shadow/gradient
- 1px hairline borders in `line` gray; prefer dividers over boxed cards
- No drop shadows, no glassmorphism, no gradients, no page-load animations
- Inter (or clean grotesk), single family; eyebrows 11px uppercase wide-tracking used sparingly
- Empty states: one sentence + one action, no illustrations

## The test

If the screen falls apart without its accent colors, it was decorated, not designed.
