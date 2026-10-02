# myHoodora logo system v1.0

Built from your two supplied files. Colours, house, coral dot and wordmark style come from Image 1; nothing was redesigned. Start with `08_Guidelines/PDF/myhoodora_brand_guidelines.pdf` and `myhoodora_contact_sheet.png`; `FILE_INDEX.md` lists every file and its best use.

## Palette (sampled from Image 1)
| Colour | HEX | RGB | CMYK (formula approx.) |
|---|---|---|---|
| Teal | #147C73 | 20 124 115 | 84 0 7 51 |
| Coral | #FF6B5B | 255 107 91 | 0 58 64 0 |
| Off-white | #F2F2F2 | 242 242 242 | 0 0 0 5 |
| Ink (proposed, not in your files) | #1B2B29 | 27 43 41 | 37 0 5 83 |

## Decisions I made (please review)
1. **Wordmark font.** All text is outlined. It is a custom rebuild using Sora as the base: "my" at weight 650, "Hoodora" at about weight 900 (extrapolated), set about 4% narrower. Letter positions land within ~0.5 px of your file, but I cannot confirm it is your original font. If you have the original font file, send it and the wordmark can be swapped.
2. **"White" = #F2F2F2** in all colour versions (as in your file). Pure #FFFFFF is used only in the one-colour white files.
3. **Clear space / padding** = one "x" (height of the "o", 33.6 units) on every side of every file. For icon-only files this is generous (about 35% of the disc diameter per side).
4. **Door.** In your image the door egg is exactly tangent to the base line. I let it break through the base by 0.3 units so the vector has no pinch point; it reads as a doorway open at the bottom.
5. **Reversed lockup** drops the disc, exactly as in your Image 1. I added an "inverse badge" (off-white disc, teal house) because you named `icon_circle_white`.
6. **New arrangements (not in your files):** stacked lockup, one-colour badges (house and dot knocked out), app icons, banners, profile pictures, OG image. They only reuse existing elements.
7. **Favicons 16 and 32 px** use an optically adjusted badge (house 15% larger, dot larger) so they stay legible. 48 px and up use the exact master proportions.
8. iOS rounded icon uses a 22.37% circular corner radius (Apple's true corner is a continuous curve; iOS applies its own mask from the full-bleed file).

## Known limits / compromises
- **Coral is low contrast**: 2.8:1 on white, 2.5:1 on off-white, 1.8:1 on teal. Fine for the decorative dot and underline, never for text or information.
- Teal on off-white is 4.51:1, a narrow AA pass for text.
- CMYK values are formula approximations; proof with your printer and add a Pantone match.
- Social safe zones follow commonly published platform sizes; platforms change them, so re-check before a campaign.
- Profile pictures, banners, OG image and app icons have solid backgrounds by nature; all other PNGs are transparent.
- Favicons are supplied as exact sizes plus `favicon.ico` (16/32/48, each rendered natively) and SVG; a 4K favicon would be meaningless.
- Mascot: see `06_Mascot/MASCOT_NOTES.md`.

## QC performed
Colour audit of all SVGs against the palette (0 off-palette fills), crop/centring/clear-space audit of all 26 transparent 4K PNGs (worst deviation under 1 px at 3840 px), 4K rule check, wordmark at 100 px wide, icon at 16/32/48 px (`08_Guidelines/PNG_4K/qc_small_size_test.png`), WCAG contrast on intended backgrounds. The rebuilt lockup matches your original at native size with a mean pixel difference of 0.95 / 255.
