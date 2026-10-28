window.RR = window.RR || {};

RR.Config = {
    CANVAS_WIDTH: 1280,
    CANVAS_HEIGHT: 720,

    SEGMENT_LENGTH: 200,
    // 1800, not 3000. The finish gate sits at 95.5% of this, so a river went
    // from ~96 seconds in the baseline Alaskan to ~57 -- Tyler's "too long to
    // get to the end of each". Sections repeat until the count is reached, so
    // shortening it simply ends the course sooner; nothing else has to change.
    TOTAL_SEGMENTS: 1800,
    BASE_RIVER_HALF_WIDTH: 2000,

    MAX_SPEED: 6000,
    ACCELERATION: 1800,
    BRAKING: 2500,
    NATURAL_DECEL: 600,
    // Assisted stern-driven helm. The heading spring preserves momentum,
    // while the aft pivot gives the bow a natural sweep into a turn.
    WORLD_SCALE: 0.05,
    STERN_PIVOT_FRACTION: 0.55,
    MAX_BOW_ANGLE: 0.29,
    STEER_RESPONSE: 10.0,
    STEER_RELEASE: 8.0,
    STEER_TILT_RESPONSE: 10.0,
    HIGH_SPEED_STEER_MULT: 0.95,
    // The river may scrub every bit of progress off, but it must never pull
    // the player backwards or leave a throttled boat permanently pinned.
    MIN_THROTTLE_PROGRESS: 0.035,
    EDGE_STEER_RECOVERY: 9.0,
    // Leave enough normalized room for the hull at the narrow finish gate.
    BOAT_EDGE_LIMIT: 0.78,
    BOAT_BASE_Y: 0.82,
    BOAT_Y_RANGE: 0.06,

    RAMP_BOOST_SECONDS: 3.2,
    RAMP_BOOST_MULT: 0.25,
    LOG_CLEAR_HEIGHT: 90,
    JUMP_VELOCITY: 1150,
    GRAVITY: 2800,
    JUMP_COOLDOWN: 0.22,

    // --- River shape. Real rivers never run straight, so a slow meander
    // rides under the whole course and each authored bend sits on top of it.
    CURVE_GAIN: 2.2,
    MEANDER_AMP_1: 0.85, MEANDER_FREQ_1: 0.0085,
    MEANDER_AMP_2: 0.35, MEANDER_FREQ_2: 0.026,

    // Rock mesh scale. Sized so the drawn boulder matches the collision
    // radius collision.js already used (obs.size * 0.2 in lateral units,
    // which is obs.size * 20 world units across). Turn this down and rocks
    // become invisible hazards again; turn it up and you'll clip on nothing.
    // Half the hull's DRAWN length, for the 18' ALASKAN baseline; scaled per
    // model by lengthScale. Collision needs this because the longitudinal hit
    // window used to be SEGMENT_LENGTH * 0.8 -- 160 drawn units -- while the
    // hull is only ~33 long and a rock ~16 across. You were being crashed by
    // rocks still a boat-length-and-a-half ahead of the bow, which is the
    // "I get close to objects and it makes me crash" Tyler reported.
    HULL_HALF_LENGTH: 17,

    ROCK_SCALE: 12,

    // Logs are visual-only hazards (see collision.js) -- jump one for the
    // bonus, bump over it otherwise. Drawn large so they read early.
    LOG_SCALE: 9,

    // Fraction of floating logs actually kept. Tyler asked for "at least half
    // less" -- 0.42 drops 58% of them, authored and procedural alike, and
    // thins the log jams to match. A log is now worth half a hull strike, so
    // there being fewer of them matters more than it used to.
    LOG_KEEP: 0.42,
    LOG_STRIKE: 0.5,

    // Channel snags are drawn at size * TREE_OBSTACLE_SCALE. They used to be
    // size * 2, which was far smaller than the hit box they carry and hard to
    // pick out of the water in time.
    TREE_OBSTACLE_SCALE: 3.4,

    // Segments either side of an island kept clear of obstacles. Picking a
    // channel around an island is enough work on its own.
    ISLAND_CLEAR_SEGMENTS: 6,

    // Strong enough to demand an upstream line. Boat mass moderates both
    // values in boat.js, so the light LT dances in eddies while the Sportster
    // carries momentum through them.
    BASE_CURRENT_STRENGTH: 0.30,
    // The cross-river shove, in normalised lateral units per second.
    //
    // This was 1.65, which put the strongest push on the course at 0.644/s
    // against a full-lock steering rate of 0.636/s -- the river was literally
    // stronger than the helm. The player had to hold the bow hard across the
    // channel just to stand still, which is the "boat gets sideways with the
    // bow facing the current and gets stuck" Tyler reported, and no amount of
    // steering could bring it back.
    //
    // 0.22 is Tyler's "affect the boat a little bit". Measured across all
    // eight rivers and all six hulls, the worst push is then about a third of
    // what full lock can produce -- on the Nile, in the Sportster, which is
    // the hardest combination in the game. Everywhere else it is milder still.
    // The current sets you across the channel and has to be corrected for, but
    // a few degrees of bow holds a line and the hull stays near straight.
    //
    // NEVER raise this to where the push approaches the steering rate. At the
    // original 1.65 the strongest current was 0.644/s against a full-lock helm
    // of 0.636/s -- the river beat the helm, the player had to hold the bow
    // hard across the channel just to stand still, and the boat stuck sideways
    // with no way to recover. That is the bug this number caused.
    // 0.18 as of 2026-09-03 -- Tyler, "take the edge off". Still a real demand
    // on the helm, just less insistent on a straight run.
    MAX_LATERAL_CURRENT: 0.18,

    // THE CURRENT IS ONE VECTOR, NOT TWO PUSHES.
    //
    // You run this river UPSTREAM, so water that shoves you sideways is also
    // pushing you back down it -- the flow arrives at the hull diagonally, and
    // that is what the HUD chevrons draw. Before this, cross-flow and upstream
    // push were authored independently, so a hard sideways shove could arrive
    // with no matching push back and read as an invisible hand moving the boat
    // left and right rather than as water running past at an angle.
    //
    // This is the upstream component carried per unit of cross-flow. Keep it
    // modest: it is subtracted from forward progress, so raising it lengthens
    // every level. At 0.30 the measured cost to a full run is small -- see the
    // 2026-09-03 changelog entry for the before/after times.
    CURRENT_DIAGONAL: 0.30,

    // Size of the HUD current chevrons.
    //
    // 1.0 was the original size and it was too much: at full strength the
    // strip measured 282 x 260 px, 7.9% of the whole frame, sitting dead
    // centre where you look to read the river ahead. 0.65 halves that to
    // about 3.3% and still reads instantly -- Tyler's "noticeable but not in
    // your face". 0.55 is legible too but starts losing the punch the design
    // wants, since the current is the main thing pushing you off your line.
    //
    // Scales chevron width, height AND spacing together, so the strip keeps
    // its proportions and its 38-degree slant. This is the only knob to turn
    // if it wants to be bigger or smaller.
    CURRENT_CHEVRON_SCALE: 0.65,

    // Cloud drift, world units per second. Tyler played the Skyqualmie and
    // said the clouds "did not move" -- they did not: the drift was written to
    // position.x and then overwritten on the SAME frame by the camera re-park
    // (see the cloud block in update). 9 units/s moves a cloud about 610 units
    // over a 68-second run, which is more than its own width, so the sky
    // clearly breathes without pulling the eye off the river. 0 parks them.
    CLOUD_DRIFT: 9,

    SHALLOW_DRAG_MULT: 3.0,
    SHALLOW_STEER_MULT: 0.65,
    // Recovery window before a shallow-water warning becomes a grounding.
    // Boat-specific multipliers preserve the lineup differences (about
    // 5.1 seconds for the heaviest hull through 8.1 for the lightest).
    SHALLOW_GROUND_TIME: 6.5,

    // A bear only reaches you if you genuinely commit to its bank. The boat's
    // own edge limit is ~0.78, so 0.72 means the hull has to be in the outer
    // ~8% of its range on the bear's side -- "super close", per Tyler. It was
    // 0.62, which is a band a third of the channel wide and caught players who
    // were nowhere near the bank.
    BEAR_DANGER_LATERAL: 0.72,
    BEAR_WARNING_SEGMENTS: 5,
    // Fore-and-aft reach of a swipe, in drawn units -- same unit system as
    // HULL_HALF_LENGTH. Was SEGMENT_LENGTH * 0.72 (144 units), which grabbed
    // you most of a segment before you drew level with the animal.
    BEAR_REACH: 16,
    // Presentation scale for the bank wildlife. A literal six-foot bear is
    // unreadable beside a river this wide; Tyler asked for them bigger again.
    BEAR_SCALE: 3.2,
    // A jumping salmon that comes down over the hull is worth catching.
    SALMON_POINTS: 1000,
    // How close, in normalised lateral units, a fish has to land to count as
    // being IN the boat. The hull is about 0.062 lateral units half-beam.
    SALMON_CATCH_LATERAL: 0.11,

    DISTANCE_POINTS: 10,
    JUMP_POINTS: 500,
    NEAR_MISS_POINTS: 200,
    SPEED_MULT_THRESHOLD: 0.7,
    ROUTE_BONUS: 1000,
    CHANNEL_BONUS: 300,
    // The canyon's secret tunnel (river.js shortcut). Paid once per run for
    // taking it; inside, the boat covers ground SHORTCUT_GAIN times faster.
    SHORTCUT_BONUS: 2500,
    SHORTCUT_GAIN: 1.7,

    MASTER_VOLUME: 0.7,

    // Music level, as a fraction of master. Was a bare 0.4 inside audio.js.
    // 0.38 on 2026-09-03 -- Tyler wants the music audible but the RIVER
    // audible with it, and the forest/river ambience loop runs at 0.30. Any
    // further apart and the music buries the water.
    MUSIC_MIX: 0.38,
    // River ambience loop level, likewise as a fraction of master.
    AMBIENCE_MIX: 0.30,

    SKY_TOP: '#4A8AC4',
    SKY_MID: '#7EB4D8',
    SKY_BOTTOM: '#B8D0E0',
    SKY_HAZE: '#D0DCE8',
    SKY_CLOUD_BRIGHT: '#F2F5F8',
    SKY_CLOUD_SHADOW: '#C8D4E0',
    MOUNTAIN_FAR: '#7888A0',
    MOUNTAIN_MID: '#5A6878',
    MOUNTAIN_NEAR: '#3A4A5C',
    MOUNTAIN_SNOW: '#E0E8F0',
    MOUNTAIN_TREE: '#2A4A30',
    WATER_DEEP_1: '#2E5565',
    WATER_DEEP_2: '#28505E',
    WATER_MID: '#3A6878',
    WATER_SHALLOW: '#6A8E8A',
    WATER_GRAVEL: '#8AA898',
    WATER_HIGHLIGHT: '#5A8898',
    WATER_REFLECT: '#7EB0C0',
    WATER_CURRENT_STREAK: 'rgba(90,160,180,0.3)',
    BANK_EARTH: '#3E3325',
    BANK_EARTH_ALT: '#2F2619',
    BANK_GRASS: '#74804A',
    BANK_GRASS_ALT: '#8A9459',
    BANK_UNDERCUT: '#3A2A1A',
    GRAVEL: '#B8A888',
    GRAVEL_WET: '#8A7A62',
    TREE_CONIFER_DARK: '#2B4A2C',
    TREE_CONIFER_MED: '#375B36',
    TREE_CONIFER_LIGHT: '#456B3E',
    TREE_DECID_DARK: '#6E8C48',
    TREE_DECID_MED: '#8CA855',
    TREE_DECID_LIGHT: '#A8C06B',
    TREE_TRUNK: '#6B6355',
    // Islands were flat planes lying ON the water, so they were invisible
    // until you were already on one, and at their authored widths they ate a
    // third of the channel. Narrower, and given a real rounded bank so they
    // read from a long way off.
    ISLAND_WIDTH_SCALE: 0.62,
    // 9.0, not 5.0. At 5 the mound stood only 3.3 units proud of the water,
    // which is about four pixels at the distance you actually spot one from --
    // barely better than the flat planes it replaced. At 9 it stands 5.9 proud,
    // roughly a fifth of the hull's length, which reads as a bank from a long
    // way off without turning the island into a wall.
    ISLAND_HEIGHT: 9.0,

    ISLAND_GREEN: '#2E6B2E',
    ISLAND_GRAVEL: '#A09070',
    ROCK: '#5A5A58',
    ROCK_HIGHLIGHT: '#787876',
    ROCK_SHADOW: '#3A3A38',
    LOG: '#9A8A70',
    LOG_DARK: '#6A5A40',
    LOG_BLEACHED: '#B8A890',
    BOAT_HULL: '#B8B8B8',
    BOAT_ACCENT: '#2563EB',
    BOAT_DARK: '#333333',
    BOAT_WINDSHIELD: '#87CEEB',
    BOAT_RAILING: '#999999',
    UI_GOLD: '#FFD700',
    UI_GOLD_DARK: '#C8A800',
    UI_BG: '#0A0E18',
    UI_TEXT: '#FFFFFF',
    UI_ACCENT: '#FF4444',
    UI_GREEN: '#44DD44',
    // --- Wooldridge house theme, sampled from dev.wooldridgeboats.com ---
    // No CDN allowed, so we reuse the site's own font stacks: Inter and
    // Rockwell render if they're installed locally, otherwise these fall
    // back exactly the way the site does.
    FONT_UI: 'Inter, -apple-system, "Segoe UI", Helvetica, Arial, sans-serif',
    FONT_DISPLAY: 'Rockwell, Georgia, Palatino, "Palatino Linotype", "Times New Roman", Times, serif',

    WB_BLUE: '#1B75BB',
    WB_BLUE_DEEP: '#12558A',
    WB_INK: '#23282D',
    WB_BODY: '#2F353A',
    WB_MUTED: '#4D5359',
    WB_LINE: '#DFE3E6',
    WB_DEEP: '#0D141A',
    WB_WHITE: '#FFFFFF',
    WB_BLACK: '#1A1A1A',
};
