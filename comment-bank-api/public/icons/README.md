# Local icons

## Why these exist

`footer.html` previously loaded the three Creative Commons licence icons from
`mirrors.creativecommons.org`. On any network that cannot reach that host the
image requests hang, the page's `load` event never fires, and the page appears
to stall — which is the normal case on a filtered school network, and was also
the reason the Playwright e2e suite could not run at all in the dev sandbox.

They are now served from this directory, so the app has no external asset
dependency. See `school-resource-design`: no CDNs, no web-font services, no
remote images.

## Provenance — read before assuming these are official

These SVGs were **hand-drawn to match the Creative Commons marks**; they are not
copies of the official artwork, which could not be downloaded in the sandbox
where they were made. They are visually equivalent at the 22px size the footer
uses, and `by.svg` is a simplified bust rather than the official figure with
arms and legs.

If exact fidelity to the official marks matters, replace these three files with
the real ones from
<https://mirrors.creativecommons.org/presskit/icons/> (`cc.svg`, `by.svg`,
`sa.svg`) on a machine with network access. Keep the same filenames and no
markup needs to change.

Note that the icons are **optional branding**, not a licensing requirement — the
licence notice and the link to
<https://creativecommons.org/licenses/by-sa/4.0/> are what actually satisfy
CC BY-SA attribution. Deleting the images entirely would also be valid.

## Rules for anything added here

- Self-contained: no external references from inside an asset either.
- Decorative images get `alt=""` (the footer already states "CC BY-SA 4.0" in
  text, so the icons carry no additional information).
- `tests/e2e/ui-smoke.spec.js` has a test that fails if any page requests an
  off-origin asset. Do not add a CDN reference to make it pass.
