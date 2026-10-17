# PPLO portfolio — compact chat handoff

Updated: 2026-10-18. Read this and `README.md` instead of loading the full chat export.

## Context and stopping point

- Original conversation: `/home/oem/Videos/Procedural 3D Portfolio Scrollytelling Website.md` (14,754 lines, approximately 765 KB).
- The export contains one user build brief followed by implementation, debugging, and verification. It ends with `Context Compaction (Failed)` during final screenshot review, before the final delivery message.
- Context was recovered by reading the original brief and final verification sections, extracting progress notes, and skipping the bulk of tool logs. This is a selective handoff, not an exhaustive audit of every historical action.
- The existing application had reached final QA; do not restart the implementation from scratch. No additional user feature request was found in the export.

## Original objective and constraints

Build a polished procedural 3D scrollytelling portfolio for **Youssef Elsaid / pplo**, Software Engineer & AI Architect in Alexandria, Egypt.

- All hardware, scenery, traces, and engraving textures must be generated locally in Three.js: no external GLB/GLTF models, downloaded textures/HDRIs, or placeholders.
- Seven scroll chapters assemble a motherboard diorama and reveal the biography, six projects, skills, and contacts. Scrolling backward must reverse assembly deterministically.
- Include spline-based camera/look-at choreography, subtle parallax, GSAP ScrollTrigger + Lenis, restrained bloom, shader-powered traces, CanvasTexture hardware labels, and world-projected SVG/DOM callouts.
- Provide chapter navigation, synchronized RAM project tabs, free orbit, raycast picking, and an accessible component inspector.
- Support mobile framing, keyboard access, reduced motion, renderer failure, and JavaScript-disabled content. Frame rate is hardware-dependent, not a guaranteed 60–120 FPS.
- Visual direction: graphite/near-black, warm-white typography, acid-lime controls, cyan/gold circuitry, technical HUD, and blueprint-peel transitions. Fonts are bundled locally.

## Story and content

| Progress | Chapter / content |
| --- | --- |
| 0–14% | VOID — procedural opening constellation and identity |
| 14–30% | PCB — bare motherboard assembly; power ignition at 22–30% |
| 30–45% | CPU / BIO — identity, engraved processor, biography |
| 45–62% | GPU / AI — I3rbly and PPLO-GPT |
| 62–80% | RAM / WORK — Steam1st, Alcoders, EasyBio, Kotobee |
| 80–92% | NVMe / ARSENAL — drives, chipset, eight skill groups |
| 92–100% | I/O / CONTACT — complete assembly and contact hub |

Canonical content lives in `src/data.ts`; independent content expectations live in `tests/fixtures/portfolio.ts`. The complete no-JavaScript portfolio in `index.html` must stay aligned with the data. Published destinations and provenance are documented in `README.md`. Do not invent project stacks, qualifications, or contact URLs; descriptive category tags are not evidence of a framework.

## Code map

- `src/main.ts`: application boot, DOM/scene integration, navigation, failure handling, diagnostics.
- `src/scene/experience.ts`: renderer/postprocessing, camera, Lenis/ScrollTrigger, orbit, picking, lifecycle.
- `src/scene/choreography.ts`: pure progress/chapter/RAM lookup, camera curves, assembly easing.
- `src/scene/hardware.ts`: procedural hardware, assembly poses, anchors, picking meshes, disposal.
- `src/scene/circuits.ts`: copper routing and traveling electrical signals.
- `src/scene/labels.ts`: procedural engraving/silkscreen textures.
- `src/scene/environment.ts`: opening constellation, atmosphere, particles, accents.
- `src/scene/projection.ts`: pooled world-to-screen callouts, leaders, reticles, measurements.
- `src/ui/interface.ts`: chapter interface, tabs, inspector, focus management, runtime static edition.
- `src/style.css`: responsive layouts, HUD, transitions, fallback and reduced-motion styling.

## Important completed fixes

- Floating-point RAM boundary selection and TypeScript integration issues were resolved.
- Rapid chapter/RAM navigation exposed a Lenis scroll handoff race. Tests now wait for existing `lenis-scrolling` state to clear before a native scroll, then jointly check scene progress, native scroll position, and Lenis idle state. Do not loosen assertions or add arbitrary sleeps to mask this race.
- Final visual refinements included CPU macro framing, a darker biography backdrop, directional blueprint-peel transitions, and installation-dependent GPU fan speed/component lighting.

## Verification checkpoint

**Freshly run during this context recovery:**

- `npm test`: **81 passed** across two Vitest files.
- `npm run build`: TypeScript check and Vite production build **passed**.
- Reviewed saved desktop assembled/CPU and mobile CPU/arsenal screenshots from `test-results/`; these were existing captures, not a new browser run.

**Recorded at the end of the previous thread:**

- `npm run test:e2e`: **9 passed**, no skips, approximately seven minutes using software WebGL.
- Project diagnostics: no errors or warnings reported.
- Placeholder/TODO/external-model search: no matches reported.
- Current saved `test-results/.last-run.json` also reports `passed` with no failed tests. The browser suite was **not rerun** during context recovery.

No application source changes were made during recovery; the build regenerated `dist/`, and this handoff was added.

## Working environment and next steps

- Project root: `/home/oem/Desktop/3dpplodev`. It is currently **not a Git repository**; do not assume a clean worktree or available history.
- Stack: Vite + TypeScript, Three.js, GSAP, `@studio-freight/lenis`, Tailwind/custom CSS, Vitest, Playwright. Use the existing lockfile and Node 22.12+ or a supported newer LTS.
- The requested `@studio-freight/lenis` package is deprecated but deliberately retained. A migration is a separate task, not an incidental cleanup.
- Local development: `npm run dev`. Production build: `npm run build`; static output: `dist/`. Deployment has not been verified.
- Browser regression: `npm run test:e2e`; Playwright manages its Vite server on port 4173. Allow sufficient time for SwiftShader. Browser setup and test-only flags are documented in `README.md`.
- The original implementation is at delivery/feedback stage, with no unresolved blocker identified in the recovered final checkpoint. Continue with specific user feedback rather than speculative rewrites or unrelated enhancements.
