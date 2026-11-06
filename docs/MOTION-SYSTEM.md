# CDPC Motion System

Status: implementation plan; this document does not claim that runtime dependencies or page animations are already shipped.

## Goals

Add a consistent, restrained motion language to the Next.js App Router experience. Motion should make state changes legible and interactions feel responsive without slowing creation workflows, the pixel editor, or the skinview3d canvas.

## Library responsibilities

| Technology | Responsibility | Usage rule |
|---|---|---|
| Motion for React (formerly Framer Motion) | Default React UI animation | Page/content transitions, dialogs, drawers, tabs, list/layout changes, hover/tap feedback |
| GSAP | Orchestrated timelines | Brand moments, multi-step onboarding, complex sequences and selected scroll narratives |
| CSS transitions/keyframes | Tiny visual feedback | Color, border, opacity and simple hover/focus states |
| Lottie | Optional asset playback | Add only when a real authored animation asset is available; do not make it a baseline dependency |

Use the current Motion package and imports from `motion/react` (not the legacy `framer-motion` package name). The official Motion documentation identifies Motion as the successor to Framer Motion and documents Next.js App Router support: https://motion.dev/docs/react-installation.

## Dependency proposal

Install the runtime packages through the repository's npm workflow, then commit the generated lockfile in the same change:

```bash
npm install motion gsap @gsap/react
```

Do not hand-edit `package-lock.json` or merge a package.json-only dependency change. Pin/resolve versions through npm, verify the resulting lockfile, and run the repository's supported Node/npm versions.

## Architecture

1. Create a small shared motion layer under the Next.js app components (for example, `app/components/motion/`):
   - shared duration/easing/spring tokens;
   - reusable page/content reveal variants;
   - reduced-motion-aware interaction helpers;
   - a small opt-in GSAP timeline hook/wrapper that always reverts its GSAP context on cleanup.
2. Keep server components as server components. Put `'use client'` only on the smallest component that actually needs interactive animation.
3. Prefer `motion/react-client` for simple server-rendered Motion elements where its API fits; use `motion/react` inside client components that need hooks or gestures.
4. Use GSAP only for sequences that Motion/CSS cannot express cleanly. Never let GSAP and Motion both animate the same DOM property on the same element.
5. Animate transform and opacity where possible. Avoid animating layout-heavy properties, large shadows, filters, or the 3D canvas itself.
6. Do not animate every page on every navigation. Keep route transitions short, avoid blocking navigation, and respect user intent and focus.

## Product rollout

### P0 — shared foundation
- Define motion tokens and shared primitives.
- Respect `prefers-reduced-motion`; provide a no-motion path and avoid parallax/large movement for reduced-motion users.
- Ensure animations do not hide content from assistive technology or delay keyboard interaction.
- Add a small demo/sandbox route or component gallery for review.

### P1 — high-value interaction feedback
- Site navigation and account menus: short opacity/transform transitions.
- Dialogs, drawers and popovers: enter/exit with focus behavior unchanged.
- Tabs and segmented controls: animate the active indicator, not the entire page.
- Cards and lists: subtle hover/tap feedback and layout transitions only where they clarify a change.
- Loading, empty and success states: use CSS or Motion first; Lottie remains optional.

### P2 — creation workflows
- AI generation: progress-state transitions and result reveal; progress must reflect real backend state, never decorative fake progress.
- Wardrobe/studio: selected-item highlight and lightweight panel transitions. Selecting a single garment must update the existing single-item preview immediately; a full character preview remains for outfit/complete-look mode.
- Editor: animate surrounding panels and tool feedback, not the pixel canvas or pointer/brush loop.
- 3D preview: preserve skinview3d render loop, camera responsiveness, pose switching and cape/elytra motion. Do not place a Motion/GSAP transform on the renderer canvas or model root unless the 3D engine explicitly owns that transform.

### P3 — deliberate GSAP moments
- Optional home-page brand sequence and guided onboarding.
- Only add scroll-triggered sequences to content pages where they improve comprehension; never make scrolling feel trapped or delayed.
- Lazy-load GSAP and its plugins only on routes/components that use them.

## Accessibility and performance acceptance

- All core actions remain immediately usable with animation disabled.
- Respect `prefers-reduced-motion` in Motion, GSAP and CSS; no essential information is animation-only.
- No hydration mismatch, layout shift, focus loss, stuck overlay, or animation that prevents route navigation.
- Animate primarily `transform` and `opacity`; avoid continuous JS animation on the main thread.
- Lazy-load GSAP and optional animation assets.
- Verify mobile touch interactions and keyboard focus states.
- Confirm service-worker/PWA caching remains compatible with versioned Next.js chunks; do not add a broad cache rule for animation libraries.
- Measure route JS/chunk impact before and after integration.

## Validation checklist

- [ ] Install dependencies and regenerate `package-lock.json` with npm.
- [ ] TypeScript and Next.js production build pass.
- [ ] Unit tests pass.
- [ ] Playwright checks for navigation, dialogs, tabs, reduced motion and mobile viewport pass.
- [ ] Check browser console for hydration warnings and animation cleanup errors.
- [ ] Confirm studio/editor 3D preview, pointer controls and cape/elytra behavior are unchanged.
- [ ] Test `prefers-reduced-motion: reduce` and keyboard-only navigation.
- [ ] Confirm the deployed Docker image is built from the Next.js application and no Vite runtime is reintroduced.

## Initial motion tokens

- Micro feedback: 100–160 ms.
- Menus/dialogs: 160–220 ms.
- Content/layout transitions: 180–260 ms.
- Brand/guide sequences: 350–700 ms, only when explicitly useful.
- Use restrained easing; avoid elastic/bouncy motion for routine admin and editing actions.

These are starting design tokens, not a requirement to animate every component.
