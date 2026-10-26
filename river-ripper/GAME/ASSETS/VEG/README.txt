CANOPY-1..4.png -- real Skyqualmie foliage, cut with real alpha.

Source: ARCHIVES/REFERENCES/RIVER/SHORELINES/SHORELINES-2.JPG, four different
slices of the same cottonwood/alder treeline (original x 2500 / 2960 / 3420 /
4100, y ~1180), so a bank does not repeat one crown.

How the alpha was made, in case these ever need regenerating:
  sky key   alpha = (g - (r+b)/2)*14 + (170 - luma)*3, clipped 0..255
            The sky in these frames is bright and near-neutral; the foliage is
            green-dominant and darker, so green-dominance plus darkness
            separates them cleanly with no fringing.
  envelope  alpha *= clip(2.4 - 2.2*hypot((X/W-0.5)/0.54, (Y/H-0.54)/0.62), 0, 1)
            Turns a chunk of continuous treeline into an isolated crown. The
            leaf detail breaks the ellipse, so the cut edge still reads organic.

Tuned so ~58% of the image survives the renderer's alphaTest of 0.42 and ~32%
is fully clear. Much sparser and the crown looks moth-eaten; much denser and it
goes back to being a green blob.

Regenerate with ffmpeg -- there is no PIL or numpy on this Mac.
