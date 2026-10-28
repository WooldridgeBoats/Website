window.RR = window.RR || {};

RR.River = {
    segments: [],
    totalLength: 0,
    level: 1,
    finishSegment: 0,
    bears: [],
    salmon: [],
    crocs: [],
    braids: [],
    logJams: [],
    profile: null,
    tour: 1,
    launchClearSegments: 120,

    // Home-screen difficulty sets the broad shape of the run. Successive
    // course levels then tighten that preset without collapsing the channel.
    levelTuning: function (level) {
        var P = RR.RiverLevels ? RR.RiverLevels.get(level) : {
            id: 'rogue', widthMult: 1, curveMult: 1, currentMult: 1,
            hazardMult: 1, treeMult: 1, finishNarrow: 0.34
        };
        var tour = RR.RiverLevels ? RR.RiverLevels.tour(level) : 1;
        var tourIndex = Math.max(0, tour - 1);
        var D = RR.Difficulty ? RR.Difficulty.getSelected() : {
            id: 'medium', widthMult: 1.38, curveMult: 1,
            currentMult: 1, authoredKeep: 0.75,
            treeChance: 0.075, hazardChance: 0.014
        };
        return {
            difficulty: D.id,
            profile: P,
            tour: tour,
            curveMult: D.curveMult * P.curveMult * (1 + tourIndex * 0.06),
            widthMult: D.widthMult * P.widthMult * Math.max(0.82, 1 - tourIndex * 0.04),
            authoredKeep: Math.min(1, D.authoredKeep + tourIndex * 0.05),
            treeChance: Math.min(0.78, D.treeChance * P.treeMult + tourIndex * 0.035),
            currentMult: D.currentMult * P.currentMult * (1 + tourIndex * 0.10),
            hazardChance: Math.min(0.070, D.hazardChance * P.hazardMult + tourIndex * 0.006)
        };
    },

    generate: function (level) {
        var C = RR.Config;
        this.segments = [];
        this.bears = [];
        this.salmon = [];
        this.crocs = [];
        this.braids = [];
        this.logJams = [];
        this.level = level || 1;
        var LV = this.levelTuning(this.level);
        var LAUNCH_CLEAR_SEGMENTS = this.launchClearSegments;
        this.profile = LV.profile;
        this.tour = LV.tour;

        // Repeatable layout: a difficult line should be learnable rather than
        // changing because Math.random happened to roll badly on a restart.
        function noise(seed, salt) {
            var v = Math.sin(seed * 12.9898 + salt * 78.233 + (level || 1) * 19.19) * 43758.5453;
            return v - Math.floor(v);
        }

        var sections = [
            { len: 60, curve: 0, width: 1.3, current: 0.15, lateral: 0, desc: 'Launch' },
            { len: 30, curve: 0, width: 1.2, current: 0.2, lateral: 0, obstacles: [{t:'log',at:15,x:0.3,s:0.6}], desc: 'Warmup' },
            { len: 50, curve: 0.4, width: 1.0, current: 0.3, lateral: 0.15, obstacles: [{t:'rock',at:20,x:-0.4,s:0.8}], desc: 'First bend' },
            { len: 40, curve: -0.2, width: 1.0, current: 0.3, lateral: -0.1, obstacles: [{t:'log',at:10,x:0.2,s:0.7},{t:'tree',at:25,x:-0.7,s:1.0}], desc: 'Counter bend' },
            { len: 20, curve: 0, width: 0.8, current: 0.4, lateral: 0, obstacles: [{t:'rock',at:8,x:0.3,s:0.5}], desc: 'Narrows entry' },
            { len: 40, curve: 0, width: 0.7, current: 0.45, lateral: 0, shallow: {side:'right',start:10,end:30,depth:0.6}, obstacles: [{t:'tree',at:20,x:-0.6,s:1.2},{t:'log_jump',at:32,x:0,s:0.5}], desc: 'The Narrows' },
            { len: 30, curve: 0.15, width: 1.0, current: 0.3, lateral: 0, desc: 'Narrows exit' },
            { len: 100, curve: 0, width: 1.4, current: 0.35, lateral: 0,
              island: {start:15,end:85,pos:0,w:0.25,leftCur:0.3,rightCur:0.5,leftLat:-0.1,rightLat:0.15},
              obstacles: [{t:'log',at:40,x:0.55,s:0.6},{t:'rock',at:60,x:-0.5,s:0.7},{t:'log_jump',at:70,x:0.5,s:0.5}],
              desc: 'First Island' },
            { len: 30, curve: 0, width: 1.2, current: 0.4, lateral: 0, desc: 'Island merge' },
            { len: 70, curve: 0.1, width: 1.3, current: 0.25, lateral: 0, obstacles: [{t:'log',at:30,x:-0.3,s:0.5},{t:'log',at:50,x:0.4,s:0.5}], desc: 'Open run' },
            { len: 60, curve: -0.15, width: 1.1, current: 0.3, lateral: 0,
              shallow: {side:'left',start:15,end:45,depth:0.7},
              obstacles: [{t:'rock',at:10,x:0.5,s:0.6},{t:'rock',at:40,x:0.3,s:0.7}],
              desc: 'Gravel bar fields' },
            { len: 50, curve: 0.6, width: 1.0, current: 0.4, lateral: 0.25, obstacles: [{t:'tree',at:15,x:-0.6,s:1.0},{t:'rock',at:30,x:0.4,s:0.6},{t:'log_jump',at:40,x:-0.2,s:0.5}], desc: 'S-bend right' },
            { len: 50, curve: -0.6, width: 1.0, current: 0.4, lateral: -0.25, obstacles: [{t:'tree',at:10,x:0.6,s:1.0},{t:'rock',at:25,x:-0.3,s:0.6},{t:'log',at:38,x:0.2,s:0.6}], desc: 'S-bend left' },
            { len: 30, curve: 0.2, width: 1.1, current: 0.35, lateral: 0.1, desc: 'S-bend recovery' },
            { len: 120, curve: 0, width: 1.6, current: 0.4, lateral: 0,
              island: {start:10,end:50,pos:-0.25,w:0.2,leftCur:0.5,rightCur:0.3,leftLat:0,rightLat:0},
              island2: {start:55,end:100,pos:0.2,w:0.22,leftCur:0.35,rightCur:0.45,leftLat:-0.1,rightLat:0.1},
              marker: {type:'fishing',at:45,x:-0.6},
              obstacles: [{t:'rock',at:30,x:0.5,s:0.6},{t:'log',at:70,x:-0.4,s:0.5},{t:'log_jump',at:85,x:0.3,s:0.5}],
              desc: 'Twin Islands - fishing spot left' },
            { len: 30, curve: -0.1, width: 1.3, current: 0.45, lateral: -0.1, desc: 'Twin merge' },
            { len: 80, curve: 0.2, width: 0.9, current: 0.5, lateral: 0.15,
              obstacles: [{t:'rock',at:5,x:-0.3,s:0.6},{t:'rock',at:20,x:0,s:0.7},{t:'log',at:35,x:0.3,s:0.6},{t:'rock',at:42,x:-0.2,s:0.6},{t:'log_jump',at:50,x:0.1,s:0.5},{t:'rock',at:65,x:-0.4,s:0.6},{t:'tree',at:72,x:-0.65,s:0.8}],
              desc: 'Rapids' },
            { len: 90, curve: -0.3, width: 1.2, current: 0.35, lateral: -0.15,
              side_channel: {start:10,end:70,side:'right',width:0.3,current:0.2,obstacles:[{t:'tree',at:20,x:0.1,s:0.8},{t:'log_jump',at:40,x:0,s:0.4}]},
              obstacles: [{t:'log',at:30,x:-0.3,s:0.6},{t:'rock',at:50,x:0.3,s:0.6}],
              desc: 'Side channel shortcut' },
            { len: 60, curve: 0.1, width: 1.3, current: 0.4, lateral: 0.05,
              marker: {type:'hunting',at:30,x:0.7},
              obstacles: [{t:'log',at:15,x:-0.2,s:0.7},{t:'log',at:45,x:0.3,s:0.6}],
              desc: 'Deep Run - hunting spot right' },
            { len: 100, curve: 0, width: 1.5, current: 0.45, lateral: 0,
              island: {start:20,end:80,pos:0.1,w:0.2,leftCur:0.4,rightCur:0.55,leftLat:-0.15,rightLat:0.2},
              shallow: {side:'both',start:15,end:25,depth:0.5},
              obstacles: [{t:'rock',at:10,x:-0.3,s:0.6},{t:'log_jump',at:35,x:-0.4,s:0.5},{t:'tree',at:65,x:0.6,s:0.9},{t:'rock',at:75,x:-0.5,s:0.6},{t:'log',at:88,x:0.2,s:0.6}],
              desc: 'Channel junction' },
            { len: 80, curve: -0.4, width: 0.85, current: 0.5, lateral: -0.2,
              obstacles: [{t:'rock',at:5,x:0.3,s:0.5},{t:'tree',at:12,x:-0.6,s:0.9},{t:'log_jump',at:18,x:0.2,s:0.5},{t:'rock',at:32,x:0.5,s:0.5},{t:'log',at:40,x:-0.1,s:0.6},{t:'tree',at:55,x:0.6,s:1.0},{t:'rock',at:62,x:-0.4,s:0.5},{t:'log_jump',at:70,x:0,s:0.5}],
              desc: 'Technical section' },
            { len: 140, curve: 0.15, width: 1.7, current: 0.45, lateral: 0.1,
              island: {start:20,end:120,pos:0,w:0.3,leftCur:0.35,rightCur:0.55,leftLat:-0.2,rightLat:0.2},
              obstacles: [{t:'rock',at:15,x:-0.5,s:0.7},{t:'log',at:40,x:0.5,s:0.6},{t:'log_jump',at:70,x:-0.45,s:0.5},{t:'rock',at:85,x:0.55,s:0.6},{t:'tree',at:95,x:0.65,s:1.0},{t:'log',at:115,x:0.4,s:0.5}],
              desc: 'The Big Island' },
            { len: 100, curve: -0.3, width: 1.0, current: 0.55, lateral: -0.15,
              obstacles: [{t:'rock',at:8,x:0.3,s:0.6},{t:'log',at:24,x:0.2,s:0.7},{t:'tree',at:32,x:-0.6,s:0.9},{t:'rock',at:40,x:0.5,s:0.5},{t:'log_jump',at:48,x:-0.1,s:0.5},{t:'rock',at:64,x:0.4,s:0.6},{t:'log',at:72,x:-0.2,s:0.6},{t:'tree',at:88,x:0.65,s:1.0},{t:'rock',at:95,x:-0.5,s:0.5}],
              desc: 'Final push' },
            { len: 100, curve: 0.1, width: 0.9, current: 0.6, lateral: 0.1,
              obstacles: [{t:'rock',at:5,x:-0.3,s:0.5},{t:'log',at:15,x:-0.1,s:0.6},{t:'rock',at:20,x:0.3,s:0.5},{t:'tree',at:25,x:-0.6,s:0.8},{t:'log_jump',at:35,x:0,s:0.5},{t:'rock',at:40,x:-0.4,s:0.5},{t:'log',at:50,x:-0.3,s:0.6},{t:'rock',at:55,x:0.5,s:0.5},{t:'log_jump',at:65,x:0.1,s:0.5},{t:'tree',at:70,x:0.6,s:0.9},{t:'rock',at:75,x:-0.2,s:0.6},{t:'log',at:85,x:-0.3,s:0.6},{t:'rock',at:90,x:0.3,s:0.7}],
              desc: 'Summit gauntlet' },
            { len: 50, curve: 0, width: 1.5, current: 0.2, lateral: 0, desc: 'Summit pool - victory lap' }
        ];

        var segIdx = 0;
        var si, s, i, seg, localIdx, obs, o, oi, obsList, isInIsland, isInIsland2, isInSideChannel, isShallow, shallowVal, marker;

        for (si = 0; si < sections.length; si++) {
            s = sections[si];
            for (i = 0; i < s.len; i++) {
                localIdx = i;
                // A real river never runs straight. Lay a slow two-harmonic
                // meander under the whole course so even the "straight"
                // sections wander, then ride each authored bend on top of it.
                var C = RR.Config;
                var meander = Math.sin(segIdx * C.MEANDER_FREQ_1) * C.MEANDER_AMP_1 +
                              Math.sin(segIdx * C.MEANDER_FREQ_2 + 1.7) * C.MEANDER_AMP_2;

                seg = {
                    index: segIdx,
                    curve: (s.curve * C.CURVE_GAIN + meander) * LV.curveMult,
                    width: s.width * LV.widthMult,
                    currentStrength: s.current * LV.currentMult,
                    currentLateral: s.lateral,
                    obstacles: [],
                    island: null,
                    sideChannel: null,
                    shallowLeft: 0,
                    shallowRight: 0,
                    marker: null,
                    section: si,
                    sectionName: s.desc
                };

                if (s.island && localIdx >= s.island.start && localIdx <= s.island.end) {
                    seg.island = {
                        position: s.island.pos,
                        // 0 at the upstream tip, 1 at the downstream tip. The
                        // renderer tapers the bar to a point at both ends with
                        // this -- real gravel bars are lens-shaped, and cutting
                        // them off square at the first and last segment is half
                        // of what made the shorelines look blocky.
                        t: (localIdx - s.island.start) /
                           Math.max(1, s.island.end - s.island.start),
                        // Scaled here, once, rather than editing every authored
                        // course literal. Shrinks the drawn island AND its
                        // collision footprint together -- isOnIsland reads the
                        // same width -- so what you can see is what you hit.
                        width: s.island.w * RR.Config.ISLAND_WIDTH_SCALE,
                        leftCurrent: s.island.leftCur,
                        rightCurrent: s.island.rightCur,
                        leftLateral: s.island.leftLat,
                        rightLateral: s.island.rightLat
                    };
                }

                if (s.island2 && localIdx >= s.island2.start && localIdx <= s.island2.end) {
                    seg.island = {
                        position: s.island2.pos,
                        t: (localIdx - s.island2.start) /
                           Math.max(1, s.island2.end - s.island2.start),
                        width: s.island2.w * RR.Config.ISLAND_WIDTH_SCALE,
                        leftCurrent: s.island2.leftCur,
                        rightCurrent: s.island2.rightCur,
                        leftLateral: s.island2.leftLat,
                        rightLateral: s.island2.rightLat
                    };
                }

                if (s.side_channel && localIdx >= s.side_channel.start && localIdx <= s.side_channel.end) {
                    seg.sideChannel = {
                        side: s.side_channel.side,
                        width: s.side_channel.width,
                        current: s.side_channel.current
                    };
                }

                if (s.shallow) {
                    if (localIdx >= (s.shallow.start || 0) && localIdx <= (s.shallow.end || s.len)) {
                        if (s.shallow.side === 'left' || s.shallow.side === 'both') seg.shallowLeft = s.shallow.depth;
                        if (s.shallow.side === 'right' || s.shallow.side === 'both') seg.shallowRight = s.shallow.depth;
                    }
                }

                if (s.marker && localIdx === s.marker.at) {
                    seg.marker = { type: s.marker.type, x: s.marker.x };
                }

                if (s.obstacles) {
                    // Picking a channel around an island is hard enough on its
                    // own -- no rocks in or near the split. The margin covers
                    // the approach and the exit as well as the island itself.
                    var ISLAND_CLEAR = 8;
                    var nearIsland =
                        (s.island && localIdx >= s.island.start - ISLAND_CLEAR &&
                                     localIdx <= s.island.end + ISLAND_CLEAR) ||
                        (s.island2 && localIdx >= s.island2.start - ISLAND_CLEAR &&
                                      localIdx <= s.island2.end + ISLAND_CLEAR);

                    for (oi = 0; oi < s.obstacles.length; oi++) {
                        o = s.obstacles[oi];
                        if (localIdx !== o.at) continue;
                        if (segIdx < LAUNCH_CLEAR_SEGMENTS) continue;
                        if (o.t === 'rock' && nearIsland) continue;
                        if (noise(segIdx, 67 + oi) > LV.authoredKeep) continue;
                        seg.obstacles.push({ type: o.t, x: o.x, size: o.s });
                    }
                }

                // Higher levels drop extra timber right in the channel.
                if (segIdx >= LAUNCH_CLEAR_SEGMENTS &&
                    LV.treeChance > 0 && noise(segIdx, 47) < LV.treeChance * 0.06) {
                    seg.obstacles.push({
                        type: 'tree',
                        x: (noise(segIdx, 53) - 0.5) * 1.3,
                        size: 0.8 + noise(segIdx, 59) * 0.6
                    });
                }

                this.segments.push(seg);
                segIdx++;
            }
        }

        // The authored sections run out around segment 1600; everything past
        // that used to be a dead-straight run to the end of the world. Keep
        // the meander going out there too, with a slow width breathe so it
        // still reads as river rather than canal.
        var CC = RR.Config;
        while (this.segments.length < CC.TOTAL_SEGMENTS) {
            var bi = this.segments.length;
            this.segments.push({
                index: bi,
                curve: (Math.sin(bi * CC.MEANDER_FREQ_1) * CC.MEANDER_AMP_1 * 1.4 +
                        Math.sin(bi * CC.MEANDER_FREQ_2 + 1.7) * CC.MEANDER_AMP_2 * 1.4) * LV.curveMult,
                width: (1.35 + Math.sin(bi * 0.004) * 0.25) * LV.widthMult,
                currentStrength: 0.2 * LV.currentMult, currentLateral: 0,
                obstacles: [], island: null, sideChannel: null,
                shallowLeft: 0, shallowRight: 0, marker: null,
                section: sections.length, sectionName: 'Beyond'
            });
        }

        // --- Real river shape, traced off the satellite tiles ----------------
        // This overwrites the procedural curve and width for every segment, so
        // the course the player actually runs is the geometry of the real
        // Skykomish / Snoqualmie rather than a sine meander. The authored
        // sections above still supply all the gameplay -- obstacles, islands,
        // shallows, markers -- they just no longer decide the shape.
        // See GAME/DATA/RIVER-COURSE.js for how the trace was produced.
        var RC = RR.RiverCourse;
        if (RC && RC.curve && RC.curve.length > 1) {
            var CF = (RR.Renderer3D && RR.Renderer3D.CURVE_FACTOR) || 0.01;
            var total = this.segments.length;
            var perStation = total / RC.curve.length;
            var P = LV.profile || {};
            var offset = P.courseOffset || 0;
            var stationCount = RC.curve.length;
            var rawCurve = new Float32Array(total);
            var rawWidth = new Float32Array(total);
            var finishCount = Math.floor(total * 0.955);
            var driftSum = 0;
            var q2, st, wrapped, i0, i1, fr, cv, wd;
            for (q2 = 0; q2 < total; q2++) {
                st = q2 / perStation;
                wrapped = (st + offset) % stationCount;
                i0 = Math.floor(wrapped);
                i1 = (i0 + 1) % stationCount;
                fr = wrapped - i0;
                cv = RC.curve[i0] + (RC.curve[i1] - RC.curve[i0]) * fr;
                wd = RC.width[i0] + (RC.width[i1] - RC.width[i0]) * fr;
                cv += Math.sin(st * (P.waveFreq || 0.05) + offset * 0.013) * (P.waveAmp || 0);
                rawCurve[q2] = cv;
                rawWidth[q2] = wd;
                if (q2 < finishCount) driftSum += cv;
            }

            // SMOOTH OUT THE TRACER'S ZIG-ZAG (2026-10-26). The walker that
            // traced the satellite tiles re-centres every station, so its
            // curvature alternates sign every 3-4 stations -- 122 left/right
            // flips over one Skyqualmie run, one every ~half second at speed.
            // That is not the river, it is the walker, and it swung the chase
            // camera constantly: a big part of "all driving is jolty". Two
            // box passes of radius 10 segments keep every real bend (the
            // largest heading swing over 100 segments goes 62 -> ~53 degrees)
            // and remove the snaking (122 -> ~45 flips). Measured on segments,
            // so it is the same filter whatever perStation is.
            (function (arr) {
                var R = 10, N = arr.length, tmp = new Float32Array(N), pass, ii, jj, sum, cnt;
                for (pass = 0; pass < 2; pass++) {
                    for (ii = 0; ii < N; ii++) {
                        sum = 0; cnt = 0;
                        for (jj = Math.max(0, ii - R); jj <= Math.min(N - 1, ii + R); jj++) { sum += arr[jj]; cnt++; }
                        tmp[ii] = sum / cnt;
                    }
                    arr.set(tmp);
                }
            })(rawCurve);
            driftSum = 0;
            for (q2 = 0; q2 < finishCount; q2++) driftSum += rawCurve[q2];

            // The trace contains a legitimate 100-degree geographic change
            // in bearing. In a chase-view game that accumulated yaw made the
            // boat appear sideways and increasingly hard to read near the
            // finish. Remove only the long-run mean: local bends remain, but
            // every river arrives at its gate facing approximately forward.
            var courseDrift = driftSum / Math.max(1, finishCount);
            for (q2 = 0; q2 < total; q2++) {
                // curve[] is radians across a whole station; spread it over the
                // segments that station covers, then convert to the engine's
                // curve unit (heading += curve * CURVE_FACTOR per segment).
                this.segments[q2].curve = ((rawCurve[q2] - courseDrift) / perStation) / CF * LV.curveMult;
                this.segments[q2].width = rawWidth[q2] * LV.widthMult;
            }
        }

        // --- The head of navigation. Over the last stretch the river pinches
        // down until it's barely wider than the boat, and the timber on the
        // banks crowds in. The finish gate sits inside that squeeze.
        var n = this.segments.length;
        var narrowStart = Math.floor(n * 0.86);
        this.finishSegment = Math.floor(n * 0.955);

        for (var q = narrowStart; q < n; q++) {
            var f = (q - narrowStart) / (n - 1 - narrowStart);   // 0 -> 1
            var sq = this.segments[q];
            // Each famous river has its own closing squeeze, but none crushes
            // down to the old one-third-width, steering-trap finish.
            sq.width = sq.width * (1 - f * (LV.profile.finishNarrow || 0.34));
            sq.narrowness = f;                 // renderer uses this to crowd trees
            sq.currentStrength = sq.currentStrength * (1 + f * 0.5);
            if (q > this.finishSegment) sq.pastFinish = true;
        }

        // --- BRAIDED CHANNELS ------------------------------------------------
        // The Skykomish braids: an island splits the flow and one side is
        // clearly wider than the other. The narrow side is the fast line and
        // pays CHANNEL_BONUS; the wide side is the safe one.
        //
        // Geometry budget, so both sides stay runnable. Usable channel is
        // BOAT_EDGE_LIMIT 0.78 each way. The island occupies
        // [pos - w, pos + w], so the narrow lane is 0.78 - (pos + w). Keeping
        // pos <= 0.24 and w <= 0.20 leaves that lane at least 0.34 wide, which
        // a hull with 0.2 of collision radius can take. Widen either and you
        // will wall the river off -- there is no runtime check for this.
        var braidChance = LV.profile.braidChance || 0;
        this.braids = [];
        if (braidChance > 0) {
            var bz = LAUNCH_CLEAR_SEGMENTS + 60;
            // Clean water through the middle of the run, around the HALF WAY
            // THERE sign. Tyler, 2026-10-26: the braid that landed here
            // (segments 797-879 on the Skyqualmie, right side) "pops up out of
            // nowhere ... Take it out!!!"
            var midA = this.finishSegment * 0.42, midB = this.finishSegment * 0.56;
            while (bz < this.finishSegment - 120) {
                if (bz + 90 > midA && bz < midB) { bz += 40; continue; }
                if (noise(bz, 71) < braidChance) {
                    var bLen  = 44 + Math.floor(noise(bz, 73) * 46);
                    var bSide = noise(bz, 77) < 0.5 ? -1 : 1;   // narrow side
                    var bW    = 0.15 + noise(bz, 79) * 0.05;
                    var bPos  = bSide * (0.16 + noise(bz, 83) * 0.08);
                    var clear = true;
                    for (var bq = bz - 6; bq < bz + bLen + 6; bq++) {
                        var bs = this.segments[bq];
                        if (!bs || bs.island || bs.marker) { clear = false; break; }
                    }
                    if (clear) {
                        var braidId = this.braids.length;
                        this.braids.push({ start: bz, end: bz + bLen, narrowSide: bSide });
                        for (bq = bz; bq < bz + bLen; bq++) {
                            this.segments[bq].island = {
                                position: bPos, width: bW,
                                // Braid islands taper at their tips too -- they
                                // are the same lens-shaped gravel bars.
                                t: (bq - bz) / Math.max(1, bLen - 1),
                                // Narrow side runs faster, as it does in life.
                                leftCurrent:  bSide < 0 ? 0.55 : 0.32,
                                rightCurrent: bSide < 0 ? 0.32 : 0.55,
                                leftLateral: 0, rightLateral: 0,
                                narrowSide: bSide, braidId: braidId
                            };
                        }
                        bz += bLen + 70;
                        continue;
                    }
                }
                bz += 40;
            }
        }

        // Use the river reference library's pattern: debris collects in short
        // fields near bends and gravel bars, with clean recovery water between.
        // Keep a generous, predictable launch corridor on every river and
        // difficulty before procedural hazards begin.
        for (var hi = LAUNCH_CLEAR_SEGMENTS; hi < this.finishSegment; hi++) {
            var hs = this.segments[hi];
            if (!hs || hs.island || hs.marker) continue;
            var bendLoad = Math.min(0.018, Math.abs(hs.curve) * 0.22) *
                (0.40 + LV.authoredKeep * 0.60);
            if (noise(hi, 3) < LV.hazardChance + bendLoad) {
                var roll = noise(hi, 5);
                var weights = LV.profile.obstacleWeights || { rock: 0.48, snag: 0.28 };
                var type = roll < weights.rock ? 'rock' :
                    (roll < weights.rock + weights.snag ? 'tree' : 'log');
                var lateralBias = hs.currentLateral * 0.35;
                hs.obstacles.push({
                    type: type,
                    x: Math.max(-0.72, Math.min(0.72, (noise(hi, 7) - 0.5) * 1.36 + lateralBias)),
                    size: type === 'rock' ? 0.55 + noise(hi, 11) * 0.35 : 0.72 + noise(hi, 11) * 0.45
                });
            }

            // (A per-segment sine "eddy" rhythm and a raw per-segment bend
            // term used to be added here. Both changed direction every few
            // seconds of running and are gone -- see _settleCurrents.)
        }

        // --- LOG JAMS --------------------------------------------------------
        // The other thing you see in every reference photo: a raft of bleached
        // trunks and root wads piled against one bank in the wide water. Built
        // from the pieces that already exist -- a spread of logs (survivable,
        // they cost speed) anchored by one or two snags (fatal) as root wads.
        //
        // Always hugs ONE bank and never crosses the centreline, so there is a
        // lane of at least 0.73 normalized units past it. A jam that spans the
        // channel is not a hazard, it is a wall.
        var jamChance = LV.profile.logJamChance || 0;
        this.logJams = [];
        if (jamChance > 0) {
            var widthSum = 0;
            for (var wq = 0; wq < this.segments.length; wq++) widthSum += this.segments[wq].width;
            var wideEnough = (widthSum / this.segments.length) * 1.06;   // "wide water"

            var jz = LAUNCH_CLEAR_SEGMENTS + 40;
            while (jz < this.finishSegment - 40) {
                var js = this.segments[jz];
                if (js && !js.island && !js.marker && js.width >= wideEnough &&
                        noise(jz, 89) < jamChance) {
                    var jLen  = 5 + Math.floor(noise(jz, 91) * 5);
                    var jSide = noise(jz, 93) < 0.5 ? -1 : 1;
                    var jOk = true;
                    for (var jq = jz; jq < jz + jLen; jq++) {
                        var js2 = this.segments[jq];
                        if (!js2 || js2.island || js2.marker) { jOk = false; break; }
                    }
                    if (jOk) {
                        this.logJams.push({ start: jz, end: jz + jLen, side: jSide });
                        for (jq = jz; jq < jz + jLen; jq++) {
                            var seg2 = this.segments[jq];
                            var pieces = 2 + Math.floor(noise(jq, 97) * 2);
                            for (var pq = 0; pq < pieces; pq++) {
                                // Bank edge inward, never past the centreline.
                                var t = noise(jq, 101 + pq * 7);
                                var lx = jSide * (0.06 + t * 0.68);
                                var isRootWad = (pq === 0 && noise(jq, 131) < 0.34);
                                seg2.obstacles.push({
                                    type: isRootWad ? 'tree' : 'log',
                                    x: lx,
                                    size: isRootWad ? 1.05 + noise(jq, 137) * 0.35
                                                    : 0.85 + noise(jq, 139) * 0.5
                                });
                            }
                        }
                        jz += jLen + 55;
                        continue;
                    }
                }
                jz += 22;
            }
        }

        // Wildlife is deterministic too, so players can read and learn it.
        // Bears stay just above the waterline on alternating gravel banks;
        // getting close enough for a swipe makes the bank line genuinely risky.
        // A spacing wider than the river means NO bears -- the loop below would
        // otherwise still place one on its first pass before the step ever
        // applied, which is how a grizzly ended up on the Nile.
        var bearStep = LV.profile.bearSpacing || 92;
        var wantBears = bearStep < this.finishSegment;
        var salmonStep = LV.profile.salmonSpacing || 27;
        // Start at the corridor edge, not 115 -- a bear five segments inside
        // the "guaranteed clear" launch corridor made that guarantee false.
        for (var bi = wantBears ? LAUNCH_CLEAR_SEGMENTS : this.finishSegment;
             bi < this.finishSegment - 30;
             bi += bearStep + Math.floor(noise(bi, 13) * 34)) {
            this.bears.push({
                segment: bi,
                side: noise(bi, 17) < 0.5 ? -1 : 1,
                phase: noise(bi, 19) * Math.PI * 2,
                size: 0.88 + noise(bi, 23) * 0.28
            });
        }
        for (var fi = 82; fi < this.finishSegment; fi += salmonStep + Math.floor(noise(fi, 29) * 18)) {
            this.salmon.push({
                segment: fi,
                x: (noise(fi, 31) - 0.5) * 1.30,
                phase: noise(fi, 37) * 6,
                period: 3.4 + noise(fi, 41) * 2.4,
                size: 0.78 + noise(fi, 43) * 0.42
            });
        }

        // --- CROCODILES ------------------------------------------------------
        // The Nile only. Half hauled out on the bank, half lying in the water.
        // The bank ones behave like bears -- a hazard if you hug that side.
        // The water ones sit off the centreline so the main lane stays open;
        // they are a reason to pick a side, not a wall.
        var crocCount = LV.profile.crocodiles || 0;
        if (crocCount > 0) {
            var cSpan = this.finishSegment - LAUNCH_CLEAR_SEGMENTS - 80;
            for (var ci = 0; ci < crocCount; ci++) {
                var cSeg = LAUNCH_CLEAR_SEGMENTS + 40 +
                    Math.floor((ci + noise(ci, 151) * 0.7) / crocCount * cSpan);
                // Biased to the BANK, not the water. Tyler asked to see them
                // hauled out, and a croc lying awash in the channel is mostly
                // hidden by the surface -- the ones on the bank are the ones
                // that read.
                var inWater = noise(ci, 157) < 0.34;
                var cSide = noise(ci, 163) < 0.5 ? -1 : 1;
                this.crocs.push({
                    segment: cSeg,
                    side: cSide,
                    inWater: inWater,
                    // In the water they lie between the lane and the bank;
                    // on the bank they sit just above the waterline.
                    x: inWater ? cSide * (0.42 + noise(ci, 167) * 0.28)
                               : cSide * (0.98 + noise(ci, 173) * 0.10),
                    phase: noise(ci, 179) * Math.PI * 2,
                    size: 0.9 + noise(ci, 181) * 0.5
                });
            }
        }

        // Final safety net: future authored sections and hazard generators
        // cannot accidentally put an unavoidable object in the launch lane.
        for (var clearIdx = 0;
             clearIdx < Math.min(LAUNCH_CLEAR_SEGMENTS, this.segments.length);
             clearIdx++) {
            this.segments[clearIdx].obstacles = [];
        }

        // --- ISLANDS GET CLEAR WATER ----------------------------------------
        // Reading a braid and committing to one side of an island is enough to
        // ask of the player on its own; stacking rocks and snags into the same
        // stretch made the line unreadable. Everything within
        // ISLAND_CLEAR_SEGMENTS of any island segment is scrubbed. The
        // procedural pass already skipped island segments themselves, but
        // authored obstacles and log jams did not, and neither respected the
        // approach.
        var clearBand = RR.Config.ISLAND_CLEAR_SEGMENTS || 0;
        if (clearBand > 0) {
            var islandAt = [];
            for (var isI = 0; isI < this.segments.length; isI++) {
                if (this.segments[isI].island) islandAt.push(isI);
            }
            for (var isJ = 0; isJ < islandAt.length; isJ++) {
                var lo = Math.max(0, islandAt[isJ] - clearBand);
                var hi2 = Math.min(this.segments.length - 1, islandAt[isJ] + clearBand);
                for (var isK = lo; isK <= hi2; isK++) this.segments[isK].obstacles = [];
            }
        }

        // --- FEWER FLOATING LOGS --------------------------------------------
        // Thin the logs down to LOG_KEEP, deterministically so a river is the
        // same shape every run. Applied last so it catches authored logs, the
        // procedural pass and the log jams together. Rocks and snags are left
        // alone -- this is only about the deadheads.
        var keep = RR.Config.LOG_KEEP;
        if (keep < 1) {
            for (var lgI = 0; lgI < this.segments.length; lgI++) {
                var lgSeg = this.segments[lgI];
                if (!lgSeg.obstacles.length) continue;
                var kept = [], lgN = 0;
                for (var lgJ = 0; lgJ < lgSeg.obstacles.length; lgJ++) {
                    var ob = lgSeg.obstacles[lgJ];
                    if (ob.type === 'log' || ob.type === 'log_jump') {
                        if (noise(lgI * 7 + lgN, 53) >= keep) { lgN++; continue; }
                        lgN++;
                    }
                    kept.push(ob);
                }
                lgSeg.obstacles = kept;
            }
        }

        // --- THE CANYON SHORTCUT (2026-10-26) --------------------------------
        // Tyler spotted a gap in the canyon wall on the right about halfway up
        // and asked for "a rad other channel tunnel that is a short cut". So
        // every canyon river now has one: on the RIGHT (+lateral), a gap in
        // the wall opens at ~46% of the course, a side channel runs behind a
        // rock divider under a rock roof, and it rejoins the river ~120
        // segments later (mouths ~1.3 s long at speed, so there is time to
        // commit). Inside, the water is fast and smooth and the boat
        // covers ground SHORTCUT_GAIN times quicker; taking it pays
        // SHORTCUT_BONUS once.
        //
        // Lateral layout (normal channel edge is ~0.78):
        //   0.84 - 1.06   rock divider (fatal), only between the two mouths
        //   1.08 - 1.60   the tunnel lane
        // Mouths are MOUTH segments long at each end, open to the river.
        this.shortcut = null;
        if (true) {
            var scS = Math.round(this.finishSegment * 0.46);
            this.shortcut = { open: !LV.profile.canyon, start: scS, end: scS + 120, mouth: 40, exit: 34, outer: 1.60, divIn: 0.84, divOut: 1.06 };
            for (var scI = scS - 10; scI <= scS + 120 + 40; scI++) {
                var scSeg = this.segments[scI];
                if (!scSeg) continue;
                scSeg.island = null;
                // Keep the right side of the mouths and the divider line clear.
                scSeg.obstacles = scSeg.obstacles.filter(function (o) { return o.x < 0.25; });
                scSeg.shallowRight = 0;
            }
            // Nothing lives on the right bank there any more -- it is rock.
            var scLo = scS - 10, scHi = scS + 120 + 40;
            this.bears = this.bears.filter(function (b) {
                return !(b.segment > scLo && b.segment < scHi && b.side > 0);
            });
            // The former right bank is now navigable water. Its crocodiles
            // must move out with the bears, or they attack from inside the lane.
            this.crocs = this.crocs.filter(function (c) {
                return !(c.segment >= scLo && c.segment <= scHi && c.side > 0);
            });
        }

        if (LV.profile.id==='rogue' || LV.profile.id==='colorado') {
            this.segments.forEach(function(seg,i){
                var reach=0.5-0.5*Math.cos(i*0.012);
                seg.width*=1.15+0.35*reach;
            });
        }
        this._settleCurrents(LV);

        this.totalLength = this.segments.length * RR.Config.SEGMENT_LENGTH;
        this.finishZ = this.finishSegment * RR.Config.SEGMENT_LENGTH;
        // Sparse lone snags; most remaining timber is a low root/branch
        // cluster beside a bank, anchored visually by a small boulder.
        this.segments.forEach(function(seg,index){
            seg.obstacles=seg.obstacles.filter(function(o,j){
                if(o.type!=='tree')return true;
                var seed=Math.abs(Math.sin(index*12.9898+j*78.233)*43758.5453)%1;
                if(seed>0.38)return false;
                o.cluster=seed>0.065;
                if(o.cluster)o.x=(o.x<0?-1:1)*(0.48+seed*0.45);
                return true;
            });
        });
        if (RR.Ramps) RR.Ramps.generate();

        // INVALIDATE THE RENDERER'S BUILD SIGNATURE.
        //
        // RiverScene skips its buildScene when Renderer3D._builtSig already
        // matches, which is what killed the duplicate build. That check is
        // only safe while the built geometry and THIS data describe the same
        // river. Regenerating here moves the data underneath it, so the
        // signature has to die with it -- otherwise the next enter() reuses
        // geometry for one river while segments, obstacles, wildlife,
        // finishSegment and profile.name all belong to another. The symptom is
        // nasty precisely because it looks fine: correct scenery, wrong river
        // name on the HUD and the wrong course under the hull.
        //
        // LaunchScene calls generate() then buildScene(), which re-stamps the
        // signature, so the Launch -> River reuse still works.
        if (RR.Renderer3D) RR.Renderer3D._builtSig = null;
    },

    getSegment: function (index) {
        if (index < 0) index = 0;
        if (index >= this.segments.length) index = this.segments.length - 1;
        return this.segments[index];
    },

    getSegmentAtZ: function (worldZ) {
        var idx = Math.floor(worldZ / RR.Config.SEGMENT_LENGTH);
        return this.getSegment(idx);
    },

    getAccumulatedCurve: function (fromIndex, toIndex) {
        var total = 0;
        var i;
        for (i = fromIndex; i <= toIndex && i < this.segments.length; i++) {
            total += this.segments[i].curve;
        }
        return total;
    },

    // CURRENTS THAT BEHAVE LIKE A RIVER (2026-10-26).
    //
    // Tyler: "Currents change too quickly and really jolt you around ... Have
    // the currents change directions way way less. Like the currents should
    // change when there is islands and channels like a real river."
    //
    // Before this, cross-current was a step function. Each authored section
    // carried its own lateral value (the S-bends flip +0.25 to -0.25 at a
    // single segment boundary), a sine "eddy" added a new direction every
    // ~90 segments, a per-segment bend term followed the satellite trace's
    // station steps, and an island switched strength and lateral the instant
    // the boat's segment had one. All of it arrived at the hull unfiltered.
    //
    // Now:
    //   - On open water the only cross-set is the bend: water piles toward
    //     the OUTSIDE of a turn. It is taken from the course curvature
    //     averaged over ~60 segments, so it builds through a bend and eases
    //     out after it instead of flickering.
    //   - Strength is averaged the same way, so a faster stretch arrives as
    //     a gradual pick-up, not a shove.
    //   - Islands do the rest: approaching an island's head the flow SPLITS
    //     away from it into the two channels, and past its tail the two
    //     channels MERGE back toward the middle. Each channel keeps its own
    //     speed, ramped in over the island's tips.
    //   - Everything is interpolated along the river at the boat's exact
    //     position, and boat.js low-pass filters what it feels on top.
    _settleCurrents: function (LV) {
        var S = this.segments, n = S.length, i, k;
        var mult = LV.currentMult || 1;
        function smooth(arr, r) {
            var out = new Array(n), sum = 0, cnt = 0, lo = 0, hi = -1;
            for (i = 0; i < n; i++) {
                while (hi < Math.min(n - 1, i + r)) { hi++; sum += arr[hi]; cnt++; }
                while (lo < i - r) { sum -= arr[lo]; cnt--; lo++; }
                out[i] = sum / cnt;
            }
            return out;
        }
        var bend = new Array(n), str = new Array(n);
        for (i = 0; i < n; i++) {
            // curve > 0 bends right; water sets to the outside, i.e. left.
            bend[i] = -S[i].curve;
            str[i] = S[i].currentStrength;
        }
        bend = smooth(smooth(bend, 30), 30);
        str = smooth(smooth(str, 20), 20);
        var maxBend = 0;
        for (i = 0; i < n; i++) maxBend = Math.max(maxBend, Math.abs(bend[i]));
        for (i = 0; i < n; i++) {
            // Normalised to the course's own tightest bend, so every river
            // tops out at the same push in its hardest turn.
            S[i].currentLateral = maxBend > 0 ? (bend[i] / maxBend) * 0.32 * mult : 0;
            S[i].currentStrength = str[i];
            S[i].islandFlow = null;
        }

        // Split ahead of each island, merge behind it.
        var APPROACH = 45, WAKE = 35;     // ~1.8 s / 1.4 s at full speed
        for (i = 0; i < n; i++) {
            if (!S[i].island || (i > 0 && S[i - 1].island)) continue;
            var start = i, end = i;
            while (end + 1 < n && S[end + 1].island) end++;
            var pos = S[start].island.position;
            for (k = 1; k <= APPROACH; k++) {
                if (start - k < 0 || S[start - k].island) break;
                var a = 1 - k / (APPROACH + 1);
                S[start - k].islandFlow = { pos: pos, k: a * a * (3 - 2 * a), dir: 1 };
            }
            for (k = 1; k <= WAKE; k++) {
                if (end + k >= n || S[end + k].island) break;
                var b = 1 - k / (WAKE + 1);
                S[end + k].islandFlow = { pos: S[end].island.position, k: b * b * (3 - 2 * b), dir: -1 };
            }
            i = end;
        }
    },

    // Flow at one segment, for a hull at lateralPos.
    _flowAtSeg: function (seg, lateralPos) {
        var strength = seg.currentStrength;
        var lateral = seg.currentLateral;
        var side, tip, t;
        if (seg.island) {
            var isl = seg.island;
            // Which channel, eased across the island's own width so the
            // centreline is not a cliff.
            side = Math.max(-1, Math.min(1, (lateralPos - isl.position) / Math.max(0.05, isl.width)));
            var chan = side < 0 ? isl.leftCurrent : isl.rightCurrent;
            t = isl.t === undefined ? 0.5 : isl.t;
            tip = Math.min(1, t / 0.18, (1 - t) / 0.18);
            tip = tip * tip * (3 - 2 * tip);
            if (chan !== undefined) strength += (chan - strength) * tip;
            // Inside a channel the water runs along it; the bend set fades.
            lateral *= 1 - 0.7 * tip;
        } else if (seg.islandFlow) {
            var f = seg.islandFlow;
            // Away from the island's line ahead of it (split), back toward it
            // behind (merge). tanh-shaped so a hull dead on the line feels no
            // sudden left/right flip.
            var d = (lateralPos - f.pos) / 0.12;
            var e = Math.exp(2 * Math.max(-6, Math.min(6, d)));
            side = (e - 1) / (e + 1);
            lateral += f.dir * side * 0.30 * f.k;
        }
        return { strength: strength, lateral: lateral };
    },

    getCurrentAtPosition: function (worldZ, lateralPos) {
        var L = RR.Config.SEGMENT_LENGTH;
        var fz = worldZ / L - 0.5;
        var i0 = Math.floor(fz), u = fz - i0;
        var a = this._flowAtSeg(this.getSegment(i0), lateralPos);
        var b = this._flowAtSeg(this.getSegment(i0 + 1), lateralPos);
        if (lateralPos > 0.95 && this.shortcutOuter(worldZ) > 0) {
            // In the tunnel lane: straight, smooth water, no cross-set.
            return { strength: a.strength * 0.6, lateral: 0 };
        }
        return {
            strength: a.strength + (b.strength - a.strength) * u,
            lateral: a.lateral + (b.lateral - a.lateral) * u
        };
    },

    isShallowAt: function (worldZ, lateralPos) {
        var seg = this.getSegmentAtZ(worldZ);
        if (lateralPos < -0.3 && seg.shallowLeft > 0) return seg.shallowLeft;
        if (lateralPos > 0.3 && seg.shallowRight > 0) return seg.shallowRight;
        return 0;
    },

    // Half width of an island, in lateral units, at a (fractional) segment.
    // THE ONE SHAPE both the renderer and the collision use (2026-10-26).
    // The island used to be DRAWN lens-shaped -- tapering to a point at each
    // tip -- but COLLIDED as a full-width rectangle the whole way, so its tips
    // were invisible walls: "You can't see it until you hit it." Now what is
    // drawn is what you hit. The wobble is capped at 1 so the narrow lane of
    // a braid never gets tighter than river.js budgeted for.
    islandHalf: function (isl, si) {
        var wob = Math.min(1, 1 + Math.sin(si * 0.085) * 0.12 + Math.sin(si * 0.031 + 1.7) * 0.07);
        var t = isl.t === undefined ? 0.5 : isl.t;
        var taper = Math.pow(Math.sin(Math.PI * Math.max(0, Math.min(1, t))), 0.55);
        return isl.width * wob * (0.14 + 0.86 * taper);
    },

    isOnIsland: function (worldZ, lateralPos) {
        var seg = this.getSegmentAtZ(worldZ);
        if (!seg.island) return false;
        var isl = seg.island;
        var si = worldZ / RR.Config.SEGMENT_LENGTH;
        return Math.abs(lateralPos - isl.position) < this.islandHalf(isl, si);
    },

    isOutOfBounds: function (worldZ, lateralPos) {
        // lateralPos is already normalized to the local river half-width.
        // seg.width controls the rendered size of that local half-width; using
        // it again here made the legal steering range collapse in narrow water.
        return lateralPos < -1 || lateralPos > Math.max(1, this.shortcutOuter(worldZ) + 0.25);
    },

    // Segment position (fractional) if worldZ is in or just past the shortcut.
    _scPos: function (worldZ) {
        var sc = this.shortcut;
        if (!sc) return -1;
        var s = worldZ / RR.Config.SEGMENT_LENGTH;
        return (s >= sc.start && s <= sc.end + sc.exit) ? s : -1;
    },

    // How far right the hull may go here. 0 = no extension. Through the
    // tunnel it is the lane's outer wall; past the exit it eases back in over
    // one mouth length, so a boat leaving the lane is guided home, not
    // snapped there.
    shortcutOuter: function (worldZ) {
        var s = this._scPos(worldZ), sc = this.shortcut;
        if (s < 0) return 0;
        if (s <= sc.end) return sc.outer;
        var f = (s - sc.end) / sc.exit;
        return sc.outer + (0.70 - sc.outer) * f;
    },

    // The rock between the river and the tunnel lane.
    shortcutDividerHalf: function (s) {
        var sc=this.shortcut;
        if (!sc) return 0;
        var a=sc.start+sc.mouth,b=sc.end-sc.mouth;
        if(s<=a || s>=b)return 0;
        var taper=sc.open ? Math.pow(Math.sin(Math.PI*(s-a)/(b-a)),0.55) : 1;
        return (sc.divOut-sc.divIn)*0.5*taper;
    },
    hitsShortcutDivider: function (worldZ, lateralPos) {
        var s = this._scPos(worldZ), sc = this.shortcut;
        if (s < 0 || s < sc.start + sc.mouth || s > sc.end - sc.mouth) return false;
        return Math.abs(lateralPos-(sc.divIn+sc.divOut)*0.5) < this.shortcutDividerHalf(s);
    },

    inShortcutLane: function (worldZ, lateralPos) {
        var s = this._scPos(worldZ), sc = this.shortcut;
        return s >= 0 && s <= sc.end && lateralPos > sc.divOut;
    }
};
