# Mascot pack: what was done, and what is still needed

## Delivered
- `PNG_Native/myhoodora_mascot_lockup_transparent_cutout.png` (1227x1258): background and the white sticker halo removed; wordmark counters made transparent. Whites inside the art (eyes, teeth, clouds, chair) are kept. Edges were un-matted from white to avoid a halo.
- `PNG_Native/myhoodora_mascot_lockup_transparent_sticker.png` (1253x1316): same art with a rebuilt white die-cut border (about 13 px) so it works on teal and dark backgrounds. The original border cannot be separated from the white page by colour, so this border is reconstructed, not extracted.
- `SVG|PDF|PNG_4K/myhoodora_mascot_wordmark_roof_onlight|ondark`: vector rebuild of the roof-over-the-H wordmark (coral "my", teal "Hoodora", roof, four-pane window, tapered swoosh). Colours sampled from Image 2: coral #FD5F46, teal #016566.
- `SVG|PDF|PNG_4K/myhoodora_mascot_house_icon_onlight|ondark`: the coral roof + four-pane window used on the hoodie and cap.

## Honest limitations
- The character, backdrop and shading are painterly raster art. I did NOT vectorise them: an automatic trace would fake the shading and lose detail. Raster PNGs are native size only; they were not upscaled, so the 4K minimum does not apply to them.
- The rebuilt vector lettering uses Fredoka Bold as the nearest open font. Image 2's lettering is bespoke (wider H, smaller round o, taller d), so it is a close lookalike, not identical. Its roof and swoosh are fitted to the measured shapes.
- One 1-2 px near-white speck remains between the "r" and "a" in the cutout.
- The mascot palette (teal #016566, coral #FD5F46) differs from the flat logo palette (#147C73, #FF6B5B). Decide whether to unify them.

## To fully vectorise the character
Hire an illustrator to redraw it (best: clean flat shapes, brand palette), or run a vector-trace tool (Illustrator Image Trace, Vectorizer.ai) and have the result cleaned by hand. Ask for the source file at 4000 px or larger if the image came from a generator.
