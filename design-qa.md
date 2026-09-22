# Design QA — ASCII Motion Renderer

- Source: `.impeccable/reference/ascii-motion-gallery-reference.jpg`
- Implementation screenshot: `.impeccable/review/matched.png`
- Comparison evidence: `.impeccable/review/comparison.png`
- Responsive evidence: `.impeccable/review/desktop.png`, `.impeccable/review/mobile.png`
- Viewport: matched comparison at 1440 × 663; desktop at 1440 × 1000; mobile at 390 × 844
- Dimensions / density normalization: source and matched implementation normalized to the same 2.17:1 viewport ratio; ASCII density held at 156 columns on desktop and 108 columns on mobile
- State: live playback after eight-sample temporal calibration, ASCII view selected

## Full-view comparison evidence

The implementation preserves the reference composition: graphite outer gutters, a white exhibition sheet, small three-part masthead, centered crop-marked artwork frame, pale periwinkle ASCII subject, caption at lower left, compact controls at lower right, ruler-like timeline beneath, a faint vertical index, and a minimal ruled footer. The subject shape intentionally follows the supplied source video rather than copying the reference asset: it resolves the spinning vinyl as an oval field and retains the stylus / cartridge as the darker structural area on the right.

## Focused regions

- Artwork: warm wall/background is removed; moving grooves and label remain; the stationary stylus is retained through high-contrast edge weighting.
- Caption/controls: no overlap at desktop or mobile sizes; controls remain reachable and text remains readable.
- Responsive: the mobile artwork is moved upward and reduced so the subject clears the caption; the material index is removed at the narrow breakpoint.

## Findings

- P0: none.
- P1: none.
- P2: source video is a cropped close-up, so the record appears as a perspective oval instead of the reference's complete circle. This is intentional and preserves source truth.

## Iteration history

1. Replaced the dashboard-like UI with the gallery composition from the user's reference.
2. Replaced single-frame darkness masking with temporal motion, background-color distance, and structural edge analysis.
3. Added an oval vinyl silhouette plus a structural stylus zone to remove the rectangular foreground block.
4. Reduced and repositioned the mobile motion stage to eliminate caption overlap.
5. Preserved the stylus cartridge and contact stem as a continuous high-opacity level 6–7 structure so the needle-to-groove relationship remains legible.

## Final result

passed
