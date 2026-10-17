# PPLO — Anatomy of a Builder

A scroll-led, procedural Three.js portfolio for **Youssef Elsaid (pplo)**, Software Engineer & AI Architect in Alexandria, Egypt. Seven chapters turn a motherboard assembly into a biography, six real projects, a skills index, and ways to get in touch. Free orbit offers a second, component-by-component route through the same content.

## Run locally

Use Node.js **22.12+** (or a supported newer LTS) and npm. The checked-in lockfile is the dependency contract.

```sh
npm ci
npm run dev
```

Open the local URL printed by Vite. To type-check, build, and serve the production bundle:

```sh
npm run build
npm run preview
```

`npm run build` runs `tsc --noEmit` before Vite and writes the static site to `dist/`. Deploy that directory to an HTTPS static host. `npm run preview` is a local verification server, not a production hosting service.

## Controls and accessibility

- **Scroll normally** to follow the story; use the seven chapter buttons or the Work / About / Contact navigation to jump.
- **RAM tabs** select one of four project modules and move the story to its corresponding scroll position.
- **Free orbit / O** switches to the complete assembly. Drag to orbit, scroll to zoom, and select a component on the canvas or in the component list.
- **Escape** closes the component inspector and restores focus; another Escape leaves free orbit. Inspector, RAM, skills, and chapter controls support keyboard navigation.
- Chapter sidebars scroll independently when their content is taller than the available screen area. Native scrolling remains the underlying navigation mechanism.
- **Reduced motion** uses chapter-rest camera poses and suppresses decorative motion. It is not a promise to disable every redraw or the user-controlled orbit interaction.
- If WebGL cannot initialize or rendering fails while JavaScript is enabled, the **static edition** retains the biography, all six projects, every skill group, contacts, chapter navigation, and the DOM inspector. This runtime fallback has its own native scroll container.
- With **JavaScript disabled**, `index.html` provides a separate, complete `<noscript>` portfolio: the biography, all six project links/descriptions, all eight skill groups, location/availability, and all five contact routes. It uses ordinary document scrolling and links, not the interactive chapter dock, tabs, or inspector. Its content is maintained directly in the HTML and should stay aligned with `src/data.ts`; this is not server rendering.

## Architecture

There are no downloaded 3D models, HDRIs, photos, or texture assets. Geometry, routed traces, particles, engraving textures, and scene atmosphere are generated in the browser. Space Grotesk and JetBrains Mono are bundled locally through Fontsource rather than fetched from a font CDN.

| Module | Responsibility |
| --- | --- |
| `index.html` | Application shell, SEO/social metadata, non-executable JSON-LD, and the complete JavaScript-disabled portfolio. |
| `src/main.ts` | Loads local fonts/styles, creates the DOM interface, boots the scene asynchronously, routes UI actions/hash navigation, exposes read-only diagnostics, and handles boot failure/disposal. |
| `src/scene/experience.ts` | Owns the renderer, lighting/postprocessing, camera/orbit/raycast interaction, Lenis/ScrollTrigger integration, frame loop, resize/quality handling, and scene diagnostics/lifecycle. |
| `src/scene/projection.ts` | Projects world-space anchors into pooled DOM/SVG callouts, leaders, reticles, and measurement overlays, with responsive placement and visibility checks. |
| `src/data.ts` | Identity, verified destinations, project copy, skills, and the seven chapter ranges. |
| `src/types.ts` | Shared hardware IDs, rig interfaces, and the DOM/scene boundary. |
| `src/scene/choreography.ts` | Pure clamping, chapter/RAM lookup, power-up easing, and coordinated position/look-at splines with physical focal lengths. |
| `src/scene/hardware.ts` | Procedural board, CPU, GPU, four DIMMs, two NVMe drives, chipset, I/O, deterministic assembly, picking meshes, and disposal. |
| `src/scene/circuits.ts` | Batched copper routes, vias, and scroll-powered traveling-signal shaders. |
| `src/scene/labels.ts` | Seeded Canvas2D engraving/silkscreen textures and fitted local-font labels. |
| `src/scene/environment.ts` | Procedural opening constellation, glyphs, haze, dust, and assembly accents. |
| `src/ui/interface.ts` | Accessible pinned DOM interface, tablists, focus-managed dialog, and complete static edition; it does not own the renderer. |
| `src/style.css` | Responsive chapter layouts, projection layers, touch targets, fallback styling, and reduced-motion CSS. |

Three.js renders the stage; the application coordinates scroll, GSAP/ScrollTrigger, Lenis, camera projection, picking, and the DOM controller. The stage uses a fixed `canvas#webgl`, a native `#scroll-story` of `1000svh`, and a fixed `#interface` overlay. Projection labels do not intercept canvas input. Hardware poses are functions of absolute progress, not accumulated animation steps, so scrolling backward disassembles the same scene. Time drives decorative effects separately.

### Coordinate frames

- Three.js uses a **right-handed, Y-up** world. The motherboard lies in the **XZ plane**: X runs across the board, +Y is above it, and the front is +Z. Coordinates are design units, not physical measurements.
- Hardware is authored in board-local coordinates under a shared carrier. The PCB top is at local `y = 0.06`; the supporting island extends to `y = -0.80`. A part's rest position, assembly offset, local anchor, and surface-label orientation are distinct.
- Anchors must be transformed through their ancestors into **world space** before camera projection. Do not project a part-local position as though it were a world-space point.
- Three.js projection gives normalized device coordinates; DOM coordinates use a top-left origin with Y downward. Convert to CSS pixels using the canvas bounds, and invert that mapping for raycasting. Device pixel ratio affects the drawing buffer, not pointer/DOM coordinates.
- Camera position and look-at target follow separate `Vector3` splines. Focal lengths interpolate from **35–85 mm**. Portrait framing backs away from the target by **1.20×** and scales the focal length by **0.78×**; FOV is derived by the perspective camera, not interpolated independently.

### Scroll contract

Progress is normalized to `[0, 1]`. Chapter starts are inclusive and ends exclusive, except `1`, which belongs to the final chapter. Non-finite progress normalizes to `0`; finite out-of-range input is clamped.

| Chapter | Range | Scene / content |
| --- | --- | --- |
| 01 — VOID | `0.00 ≤ p < 0.14` | Procedural code constellation and introduction. |
| 02 — PCB | `0.14 ≤ p < 0.30` | Foundation, connections, and power-up (`0.22–0.30`). |
| 03 — CPU / BIO | `0.30 ≤ p < 0.45` | Processor assembly and biography. |
| 04 — GPU / AI | `0.45 ≤ p < 0.62` | I3rbly and PPLO-GPT. |
| 05 — RAM / WORK | `0.62 ≤ p < 0.80` | Steam1st, Alcoders, EasyBio, and Kotobee. |
| 06 — NVMe / ARSENAL | `0.80 ≤ p < 0.92` | Storage assembly and all skill categories. |
| 07 — I/O / CONTACT | `0.92 ≤ p ≤ 1.00` | Complete system, contact fibers, and contact links. |

The RAM interval is divided evenly into four modules: `[0.620, 0.665)`, `[0.665, 0.710)`, `[0.710, 0.755)`, and `[0.755, 0.800]`. Tab destinations are the midpoints `0.6425`, `0.6875`, `0.7325`, and `0.7775`. Assembly tracks can overlap chapter boundaries; chapter selection is not itself a hardware visibility switch.

## Content provenance

The source of truth is the published [pplo.dev portfolio](https://pplo.dev), including its public project/contact links and skill list, cross-checked on **2026-10-18**. Tests pin these destinations offline; they do not depend on third-party site uptime, bypass login pages, or claim that every destination will remain available forever.

| Project | Verified destination | Published scope |
| --- | --- | --- |
| I3rbly / A3rbly | [a3rbly.com](https://a3rbly.com) | Arabic grammatical analysis; four years of R&D. |
| PPLO-GPT | [pplo.vercel.app](https://pplo.vercel.app) | AI chatbot using Python and machine learning. |
| Steam1st Store | [steam1st.store](https://steam1st.store) | Gaming top-ups; Flask backend and PostgreSQL. |
| Alcoders | [alcoders.com](https://alcoders.com) | Developer community and coding platform. |
| EasyBio — Dr. Abdelrahman | [easybio-drabdelrahman.com](https://easybio-drabdelrahman.com) | Biology education for Egyptian secondary-school students. |
| Kotobee | [kotobee.com](https://kotobee.com) | Backend development for an e-learning platform. |

Contacts: [email](mailto:youssefdev74@gmail.com), [GitHub](https://github.com/youssef-pplo), [Instagram](https://instagram.com/pplo.dev), [WhatsApp](https://wa.me/201091734838), and [pplo.dev](https://pplo.dev). The WhatsApp link normalizes the published phone number to the digits-only `wa.me` format.

Project category tags are not independent evidence of an implementation stack. In particular, do not infer a platform's frameworks from the global skills list; the published I3rbly description establishes its NLP purpose, not a specific model/framework. Keep descriptive labels descriptive and verify any new technology, degree, employer, or contribution claim before changing the content. The independent fixture in `tests/fixtures/portfolio.ts` protects against accidental substitutions and invented additions.

## Tests

```sh
npm test
npm run test:e2e
```

- **Vitest** runs `tests/choreography.test.ts` and `tests/data.test.ts` in Node. Coverage focuses on exact chapter/RAM boundaries, invalid input, reversible finite real-`Vector3` camera sampling, focal length/FOV, portrait/reduced-motion behavior, and independent content integrity checks.
- **Playwright** uses `tests/e2e/*.e2e.ts`, deliberately named so Vitest does not discover the browser suite. Its managed web server runs `npm run dev -- --port 4173 --strictPort` at `http://127.0.0.1:4173`; keep that port free. No separate server is needed.
- The configuration uses `/opt/google/chrome/chrome` when installed, otherwise Playwright's bundled Chromium. On machines without that Chrome binary, install the browser first:

  ```sh
  npx playwright install chromium
  # Linux hosts missing browser system libraries may need:
  npx playwright install --with-deps chromium
  ```

- Headless tests use `--no-sandbox --use-angle=swiftshader --enable-unsafe-swiftshader` for software WebGL. These are **test-only** flags; do not use the no-sandbox setting for ordinary browsing or production. Tests run with one worker, bounded timeouts, and no automatic retries.
- Browser coverage checks real WebGL/draw calls, shader/page errors, chapter navigation and reverse assembly, RAM synchronization, complete free-orbit inspection, canvas raycasting when an unobstructed projected component is available, 390px mobile layout/touch targets/sidebar scrolling, arsenal tabs, reduced motion, and deliberately disabled WebGL with complete static content/navigation.
- Browser interactions wait for readiness and observed progress/state, not fixed sleep delays. Scroll helpers check scene progress, native position, and Lenis idle state together in one browser evaluation per poll, with a **45-second bound** for software WebGL; the tolerances remain `0.0002` progress and `1` CSS pixel. Before issuing a native scroll, they also wait for any existing `lenis-scrolling` state to clear, so a still-running no-op navigation cannot overwrite it. Success screenshots and failure artifacts are written under `test-results/`; screenshots are review artifacts, not cross-GPU pixel goldens. A skipped raycast case must be reported as skipped, not passed coverage.

For a focused run:

```sh
npm test -- tests/choreography.test.ts
npm run test:e2e -- tests/e2e/portfolio.e2e.ts
```

### Read-only scene diagnostics

Development builds, or an explicit `?debug` URL, expose `window.__PPLO__.getState()`. It reports progress, chapter, orbit/selection/hover state, camera vectors and focal length, hardware visibility/positions/projected screen points, and renderer calls/triangles/pixel ratio/FPS. Tests read this state only after the renderer is ready; they do not inject replacement state or call private scene actions.

The canvas publishes `data-ready="true"` and the document publishes `data-renderer="ready"` after loading. A rendering failure publishes `data-renderer="fallback"`. Do not assume the debug object exists before initialization or on an ordinary production URL.

## Performance, privacy, and deployment

- **60–120 FPS is a GPU-, viewport-, browser-, thermal-, and refresh-rate-dependent target, not a guarantee.** Software WebGL/SwiftShader is substantially slower and browser tests are not a hardware benchmark. Batched/instanced geometry and bounded pixel ratio reduce cost, but accessibility and complete content take precedence over a frame-rate claim.
- Hardware-style telemetry such as RAM speed and voltage is **illustrative**, not real hardware monitoring. Render FPS, draw calls, triangle counts, pixel ratio, and camera focal length describe the application renderer, not a probe of the visitor's motherboard.
- The application has no tracking, audio, remote model downloads, remote texture/HDRI requests, or remote font requests. The browser requests the site's own HTML, JS, CSS, local fonts, and favicon. The inline JSON-LD publishes public identity/contact information for structured-data consumers; its `schema.org` context and `sameAs` URLs are metadata, not browser requests or analytics. Social-preview metadata points to the site's own `social-card.svg`, which crawlers may fetch when a link is shared. Following project/contact links leaves the portfolio and is subject to those destinations' policies.
- `@studio-freight/lenis` is **deprecated**. Its requested package/version line is retained deliberately, with the exact resolution recorded in `package-lock.json`; do not silently replace it. Migration to the maintained `lenis` package is an optional separate change requiring scroll, reduced-motion, and nested-scroll regression testing.
- Serve production over HTTPS with correct JS/CSS/font MIME types. Prefer immutable caching for hashed build assets and revalidation for HTML. Disable directory listings and avoid deploying development tooling or secrets.
- Consider CSP as an HTTP response header. A starting point for a self-hosted production build is `default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; font-src 'self'; img-src 'self' data: blob:; connect-src 'self'; object-src 'none'; base-uri 'self'; frame-ancestors 'none'; form-action 'none'`. This is a deployment recommendation, not a header configured by the application. Inline styling in the UI/projection layers and the `<noscript>` style block currently motivates the style allowance; test a stricter policy in both JavaScript-enabled and disabled modes before removing it. Vite HMR needs development-only connection allowances.
- **JSON-LD is not executable inline JavaScript:** `index.html` uses `type="application/ld+json"`, a [script data block](https://developer.mozilla.org/en-US/docs/Web/HTML/Reference/Elements/script/type). Do not add `script-src 'unsafe-inline'` or a remote `schema.org` script/connect allowance just for that metadata. Any future executable inline script must instead be moved to a same-origin file or explicitly authorized with an exact-content CSP hash or a fresh per-response nonce. Static hosting favors build-generated hashes; regenerate them after changes to the final script text, and never bake a reusable nonce into static HTML. Verify the deployed policy with browser CSP reports and the structured-data consumers you support.
- Also consider `X-Content-Type-Options: nosniff`, `Referrer-Policy: strict-origin-when-cross-origin`, and a restrictive camera/microphone/geolocation Permissions Policy.
