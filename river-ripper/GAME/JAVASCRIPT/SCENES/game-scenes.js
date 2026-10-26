window.RR = window.RR || {};

// Which stop the player is on, and the score carried from the previous river.
// Level 1 is the Skyqualmie -- home water, the confluence this game was built
// on. After the full set a tougher tour begins.
RR.Progress = {
    level: 1,
    carriedScore: 0,
    // Who is driving this run, once they have signed the board. Set by
    // NameEntryScene, so a run that clears a river and keeps going is not
    // asked for its name twice.
    runName: null,
    reset: function () {
        this.level = RR.RiverLevels ? RR.RiverLevels.selectedIndex + 1 : 1;
        this.carriedScore = 0;
        this.runName = null;
    },
    // Record this run's score on the board. Returns the scene to show next:
    // the name entry screen when the run qualifies and has no name yet,
    // otherwise `next` (the run is updated silently if it is already on).
    boardThen: function (score, distance, next) {
        if (this.runName) {
            if (RR.Scores.qualifies(score) || this._onBoard()) {
                RR.Scores.add(this.runName.first, this.runName.initial, score, distance, this.runName.run);
            }
            return next;
        }
        if (RR.Scores && RR.Scores.qualifies(score)) {
            RR.NameEntryScene.prime(score, distance, next);
            return RR.NameEntryScene;
        }
        return next;
    },
    _onBoard: function () {
        var l = RR.Scores.load(), i;
        for (i = 0; i < l.length; i++) if (l[i].run === this.runName.run) return true;
        return false;
    }
};

// ---------------------------------------------------------------------------
// LAUNCH — a short cinematic in four shots, built from the photos in
// ARCHIVES/REFERENCES/TRUCK-AND-LAUNCH/:
//
//   silver metallic Suburban, black Thule roof box, black wheels, running
//   boards, chrome window trim, towing a single-axle galvanised EZ Loader
//   with the boat on the bunks.
//
//   1  0.0-2.8s  THE FARM        rig rolls into frame, title card
//   2  2.8-5.0s  BACKING DOWN    reverses, trailer wheels enter the river
//   3  5.0-7.4s  IN SHE GOES     boat slides off stern-first, splash
//   4  7.4-9.6s  LET'S RIP       Suburban pulls out with the empty trailer
//
// The rig is drawn on the 2D overlay; the boat, water and camera moves are
// the real 3D scene underneath.
// ---------------------------------------------------------------------------
RR.LaunchScene = {
    time: 0,
    phase: 0,
    hornPlayed: false,
    splashPlayed: false,
    sceneBuilt: false,

    SHOTS: [
        { at: 0.0, title: 'THE FARM',   sub: 'WOOLDRIDGE BOATS HQ' },
        { at: 2.8, title: 'THE RAMP',   sub: 'BACKING HER DOWN' },
        { at: 5.0, title: 'LAUNCH',     sub: 'STERN FIRST, LIKE ALWAYS' },
        { at: 7.4, title: null,         sub: null }
    ],

    enter: function () {
        this.time = 0;
        this.phase = 0;
        this.hornPlayed = false;
        this.splashPlayed = false;
        this.sceneBuilt = false;

        RR.River.generate(RR.Progress.level);
        RR.Renderer3D.buildScene();
        this.sceneBuilt = true;

        RR.Boat.reset();
        RR.Boat.z = 5 * RR.Config.SEGMENT_LENGTH;
    },

    shotIndex: function () {
        var i, n = this.SHOTS.length;
        for (i = n - 1; i >= 0; i--) if (this.time >= this.SHOTS[i].at) return i;
        return 0;
    },

    update: function (dt) {
        this.time += dt;
        if (this.time > 0.8) this.phase = 1;
        if (this.time > 2.8) this.phase = 2;
        if (this.time > 3.4 && !this.hornPlayed) {
            RR.Audio.play('horn', 0.8);
            this.hornPlayed = true;
        }
        if (this.time > 5.0) this.phase = 3;
        if (this.time > 6.3 && !this.splashPlayed) {
            RR.Audio.play('splash', 0.7);
            this.splashPlayed = true;
        }
        if (this.time > 7.4) this.phase = 4;
        if (this.time > 9.6 || RR.Input.justPressed('Space') || RR.Input.justPressed('Enter') || RR.Input.clicked) {
            RR.Input.clicked = false;
            RR.Engine.changeScene(RR.RiverScene);
        }
    },

    render3D: function (dt) {
        if (!this.sceneBuilt) return;
        var R = RR.Renderer3D;
        var SEG = RR.Config.SEGMENT_LENGTH;
        var t = this.time;

        function ease(x) { return x < 0.5 ? 2 * x * x : 1 - Math.pow(-2 * x + 2, 2) / 2; }
        function seg(t0, t1) { return Math.max(0, Math.min(1, (t - t0) / (t1 - t0))); }

        // --- camera: a distinct move per shot rather than one long drift ---
        var anchor = R.getWorldPos(5 * SEG, 0);
        var look = R.getWorldPos(9 * SEG, 0);
        var camX, camY, camZ, lookY = 2;

        if (t < 2.8) {                       // 1. wide establishing, slow drift in
            var k = ease(seg(0, 2.8));
            camX = anchor.x - 70 + k * 14;
            camY = 40 - k * 6;
            camZ = anchor.z - 96 + k * 16;
        } else if (t < 5.0) {                // 2. push in on the ramp
            var k2 = ease(seg(2.8, 5.0));
            camX = anchor.x - 56 + k2 * 20;
            camY = 34 - k2 * 12;
            camZ = anchor.z - 80 + k2 * 28;
        } else if (t < 7.4) {                // 3. drop low and close for the splash
            var k3 = ease(seg(5.0, 7.4));
            camX = anchor.x - 36 + k3 * 12;
            camY = 22 - k3 * 8;
            camZ = anchor.z - 52 + k3 * 10;
            lookY = 3;
        } else {                             // 4. settle into the chase position
            var k4 = ease(seg(7.4, 9.6));
            camX = anchor.x - 24 + k4 * 24;
            camY = 14 + k4 * 5;
            camZ = anchor.z - 42 - k4 * 4;
            lookY = 2;
        }

        R.camera.up.set(0, 1, 0);
        R.camera.position.set(camX, camY, camZ);
        R.camera.lookAt(
            anchor.x * 0.55 + look.x * 0.45,
            lookY,
            anchor.z * 0.55 + look.z * 0.45
        );

        if (R.boatGroup) {
            if (this.phase < 3) {
                R.boatGroup.visible = false;
            } else {
                // Off the bunks STERN-FIRST: sliding back down the trailer and
                // dropping as she goes, bow-up on the ramp the whole way, then
                // levelling out and bobbing once she floats.
                R.boatGroup.visible = true;
                var slideT = seg(5.0, 7.2);
                var sm = slideT * slideT * (3 - 2 * slideT);

                var atZ = (5.75 + (5.00 - 5.75) * sm) * SEG;
                var bp = R.getWorldPos(atZ, 0);

                var by = 5.2 + (0.2 - 5.2) * sm;
                if (slideT >= 1) {
                    var settle = t - 7.2;
                    by = 0.2 + Math.sin(settle * 7) * Math.max(0, 0.5 - settle) * 0.6;
                }

                R.boatGroup.position.set(bp.x, by, bp.z);
                R.boatGroup.rotation.y = -bp.heading;
                R.boatGroup.rotation.x = -0.16 + 0.14 * sm;
                R.boatGroup.rotation.z = 0;
            }
        }

        // Splash as the transom bites, reusing the wake rig's churn and spray.
        if (R.wakeGroup) {
            var entry = t - 6.30;
            if (this.phase >= 3 && entry > 0 && entry < 1.6) {
                R.wakeGroup.visible = true;
                R.wakeGroup.position.copy(R.boatGroup.position);
                R.wakeGroup.position.y = 0;
                R.wakeGroup.rotation.y = R.boatGroup.rotation.y;

                var burst = 1 - entry / 1.6;
                var churn = R.wakeGroup.getObjectByName('churn');
                if (churn) {
                    churn.material.opacity = burst * 0.7;
                    churn.scale.set(1.3, 0.45, 1);
                }
                var si, sp;
                for (si = 0; si < 6; si++) {
                    sp = R.wakeGroup.getObjectByName('spray' + si);
                    if (!sp) continue;
                    sp.material.opacity = burst * 0.7;
                    sp.scale.setScalar(1.1 + burst * 1.6);
                    sp.position.y = 0.5 + burst * 2.6;
                    sp.lookAt(R.camera.position);
                }
                var aL = R.wakeGroup.getObjectByName('wakeL');
                var aR = R.wakeGroup.getObjectByName('wakeR');
                if (aL) aL.material.opacity = 0;
                if (aR) aR.material.opacity = 0;
            } else {
                R.wakeGroup.visible = false;
            }
        }

        if (R.skyDome) R.skyDome.position.set(R.camera.position.x, 0, R.camera.position.z);
        if (R.waterUniforms) R.waterUniforms.uTime.value = t;
        R._updateVisibleObjects(RR.Boat);
        R._updateWildlife(RR.Boat, RR.Engine.totalTime);
        R.render();
    },

    render: function (ctx) {
        var W = RR.Config.CANVAS_WIDTH;
        var H = RR.Config.CANVAS_HEIGHT;
        var C = RR.Config;
        var t = this.time;

        function seg(t0, t1) { return Math.max(0, Math.min(1, (t - t0) / (t1 - t0))); }
        function ease(x) { return x < 0.5 ? 2 * x * x : 1 - Math.pow(-2 * x + 2, 2) / 2; }

        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';

        // --- cinematic letterbox, opening out as the sequence ends ---
        var barH = H * 0.085 * (1 - ease(seg(8.4, 9.6)));
        if (barH > 0.5) {
            ctx.fillStyle = '#000';
            ctx.fillRect(0, 0, W, barH);
            ctx.fillRect(0, H - barH, W, barH);
        }

        // --- the rig ---------------------------------------------------
        // Shots 1-2 it rolls in and reverses down the ramp; shot 4 it pulls
        // back out with the trailer empty.
        var rigX, rigScale, wetLine = null, reversing = false;

        // The rig is drawn mirrored, so the Suburban faces RIGHT and the
        // trailer leads to the LEFT -- toward the water, and toward where the
        // 3D boat actually comes off the bunks.
        if (t < 2.8) {
            var k = ease(seg(0.4, 2.8));
            rigX = W * 1.10 - k * W * 0.42;
            rigScale = 0.85 + k * 0.20;
        } else if (t < 7.4) {
            var k2 = ease(seg(2.8, 5.0));
            rigX = W * 0.68 - k2 * W * 0.20;
            rigScale = 1.05 + k2 * 0.30;
            reversing = t < 5.0;
            // river creeps up the trailer as she goes in
            wetLine = -34 + k2 * 26;
        } else {
            var k4 = ease(seg(7.4, 9.6));
            rigX = W * 0.48 + k4 * W * 0.85;      // pulls back out to the right
            rigScale = 1.35 - k4 * 0.25;
            wetLine = -8 - k4 * 30;
        }

        if (t > 0.35) {
            ctx.save();
            ctx.translate(rigX, H * 0.60);
            ctx.scale(-rigScale, rigScale);   // mirrored, see above
            ctx.globalAlpha = Math.min(1, seg(0.35, 0.9));
            RR.LaunchScene.drawRig(ctx, C, this.phase < 3, wetLine, reversing);
            ctx.restore();
        }

        // --- shot captions ---------------------------------------------
        var shot = this.SHOTS[this.shotIndex()];
        if (shot.title) {
            var inAt = shot.at;
            var appear = Math.min(1, (t - inAt) / 0.45);
            var fade = 1;
            var nextAt = this.SHOTS[this.shotIndex() + 1];
            if (nextAt) fade = Math.min(1, (nextAt.at - t) / 0.45);
            ctx.globalAlpha = Math.max(0, Math.min(appear, fade));
            RR.UI.headline(ctx, shot.title, W / 2, H * 0.13, 50, C.WB_WHITE, C.WB_BLUE);
            ctx.save();
            ctx.shadowColor = 'rgba(0,0,0,0.7)';
            ctx.shadowBlur = 5;
            RR.UI.label(ctx, shot.sub, W / 2, H * 0.205, 13, 'rgba(255,255,255,0.92)', 600);
            ctx.restore();
            ctx.globalAlpha = 1;
        }

        if (this.phase >= 4) {
            var flash = (Math.sin((t - 7.4) * 5) + 1) * 0.5;
            ctx.save();
            ctx.globalAlpha = 0.6 + flash * 0.4;
            RR.UI.headline(ctx, "LET'S RIP!", W / 2, H * 0.44, 62, C.WB_WHITE, C.WB_BLUE);
            ctx.restore();
        }

        RR.UI.label(ctx, 'PRESS SPACE TO SKIP', W / 2, H * 0.955, 12, 'rgba(223,227,230,0.5)', 500);
    }
};

// ---------------------------------------------------------------------------
// The tow rig, side on, straight off ARCHIVES/REFERENCES/TRUCK-AND-LAUNCH/.
//
// Silver metallic Suburban: long boxy three-row body, black Thule box on the
// roof rails, blacked-out wheels, running boards, chrome window surround,
// tinted glass. Behind it a single-axle galvanised EZ Loader with the boat on
// the bunks. The Suburban faces LEFT and the rig travels RIGHT, so the trailer
// leads — which is how you actually back one in.
//
// wetLine: local y the river has climbed to on the rig, or null for dry land.
// reversing: paints the reverse lights.
// ---------------------------------------------------------------------------
RR.LaunchScene.drawRig = function (ctx, C, carryingBoat, wetLine, reversing) {
    var BODY = '#B9BEC4', BODY_HI = '#D3D7DB', BODY_LO = '#8E949B';
    var GLASS = '#20262C', CHROME = '#E2E6EA', TRIM = '#15181B';
    var TIRE = '#141518', RIM = '#26292E', RIM_LIP = '#3C4148';
    var GALV = '#9AA0A6', GALV_HI = '#C2C7CC';
    var ALLOY = '#C9CCD1', ALLOY_DK = '#9BA1A8';

    function wheel(cx, cy, r) {
        ctx.fillStyle = TIRE;
        ctx.beginPath(); ctx.arc(cx, cy, r, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = RIM;
        ctx.beginPath(); ctx.arc(cx, cy, r * 0.60, 0, Math.PI * 2); ctx.fill();
        ctx.strokeStyle = RIM_LIP; ctx.lineWidth = Math.max(1, r * 0.10);
        ctx.beginPath(); ctx.arc(cx, cy, r * 0.60, 0, Math.PI * 2); ctx.stroke();
        var sp;
        for (sp = 0; sp < 6; sp++) {
            var a = sp * Math.PI / 3;
            ctx.beginPath();
            ctx.moveTo(cx + Math.cos(a) * r * 0.18, cy + Math.sin(a) * r * 0.18);
            ctx.lineTo(cx + Math.cos(a) * r * 0.52, cy + Math.sin(a) * r * 0.52);
            ctx.stroke();
        }
        ctx.fillStyle = '#585E66';
        ctx.beginPath(); ctx.arc(cx, cy, r * 0.16, 0, Math.PI * 2); ctx.fill();
    }

    // ground shadow
    ctx.fillStyle = 'rgba(0,0,0,0.20)';
    ctx.beginPath(); ctx.ellipse(-24, 5, 172, 10, 0, 0, Math.PI * 2); ctx.fill();

    // ---------------- trailer: single axle, galvanised -----------------
    ctx.strokeStyle = GALV; ctx.lineWidth = 4; ctx.lineCap = 'round';
    ctx.beginPath(); ctx.moveTo(-6, -32); ctx.lineTo(36, -38); ctx.stroke();   // tongue
    ctx.fillStyle = GALV;
    ctx.fillRect(32, -40, 104, 5);                                             // main rail
    ctx.fillStyle = GALV_HI;
    ctx.fillRect(38, -48, 94, 4);                                              // bunk board
    ctx.fillStyle = GALV;
    ctx.fillRect(16, -38, 4, 20);                                              // jack post
    ctx.fillRect(11, -20, 14, 4);                                              // jack foot
    ctx.fillRect(70, -34, 30, 4);                                              // fender
    ctx.fillStyle = '#8E1616'; ctx.fillRect(133, -45, 5, 7);                   // taillight
    ctx.strokeStyle = GALV; ctx.lineWidth = 3;                                 // rear guide pole
    ctx.beginPath(); ctx.moveTo(126, -40); ctx.lineTo(126, -84); ctx.stroke();
    wheel(84, -14, 14);

    // ---------------- boat on the bunks ----------------
    // Bow points LEFT, at the tow vehicle; outboard hangs off the transom at
    // the right, which is the end that goes in first when you back down.
    if (carryingBoat) {
        ctx.fillStyle = ALLOY;
        ctx.beginPath();
        ctx.moveTo(30, -66);            // sheer runs ahead of the chine
        ctx.lineTo(130, -66);           // sheer, aft to the transom
        ctx.lineTo(130, -50);           // transom
        ctx.lineTo(44, -50);            // chine
        ctx.closePath(); ctx.fill();
        ctx.fillStyle = ALLOY_DK;       // the raked flat bow plate
        ctx.beginPath();
        ctx.moveTo(30, -66); ctx.lineTo(44, -50);
        ctx.lineTo(40, -50); ctx.lineTo(27, -64);
        ctx.closePath(); ctx.fill();
        ctx.fillStyle = C.WB_BLUE; ctx.fillRect(46, -62, 78, 2);   // accent stripe
        ctx.fillStyle = GLASS;                                     // 2-panel windshield, well forward
        ctx.beginPath();
        ctx.moveTo(48, -66); ctx.lineTo(66, -66);
        ctx.lineTo(62, -78); ctx.lineTo(52, -78);
        ctx.closePath(); ctx.fill();
        ctx.strokeStyle = ALLOY; ctx.lineWidth = 1.4;
        ctx.beginPath(); ctx.moveTo(57, -66); ctx.lineTo(57, -78); ctx.stroke();
        ctx.strokeStyle = '#B9BEC4'; ctx.lineWidth = 1.6;          // grab rail
        ctx.beginPath(); ctx.moveTo(72, -68); ctx.lineTo(122, -68); ctx.stroke();
        ctx.fillStyle = TRIM;                                      // outboard on the transom
        ctx.fillRect(130, -68, 13, 16);
        ctx.fillRect(133, -52, 6, 14);
        ctx.fillStyle = '#FFD800';                                  // school-bus-yellow intake foot
        ctx.fillRect(132, -40, 9, 5);
    }

    // ---------------- Suburban ----------------
    ctx.fillStyle = BODY;
    ctx.beginPath();
    ctx.moveTo(-176, -42);
    ctx.lineTo(-178, -58);          // front face
    ctx.lineTo(-171, -64);          // hood front
    ctx.lineTo(-138, -68);          // hood
    ctx.lineTo(-124, -92);          // windscreen
    ctx.lineTo(-116, -96);          // roof front
    ctx.lineTo(-24, -96);           // long roof, three rows
    ctx.lineTo(-16, -90);           // rear pillar
    ctx.lineTo(-12, -62);           // tailgate glass
    ctx.lineTo(-10, -44);           // rear bumper
    ctx.lineTo(-30, -46);
    ctx.lineTo(-54, -46);           // rear arch
    ctx.lineTo(-56, -33);
    ctx.lineTo(-128, -33);          // rocker
    ctx.lineTo(-130, -46);          // front arch
    ctx.lineTo(-168, -46);
    ctx.closePath(); ctx.fill();

    ctx.fillStyle = BODY_HI;                                                   // beltline highlight
    ctx.fillRect(-172, -60, 156, 3);
    ctx.fillStyle = BODY_LO;                                                   // lower shading
    ctx.fillRect(-128, -40, 72, 7);
    ctx.fillStyle = TRIM;                                                      // running board
    ctx.fillRect(-130, -33, 76, 4);

    ctx.fillStyle = GLASS;                                                     // greenhouse
    ctx.beginPath();
    ctx.moveTo(-132, -68); ctx.lineTo(-121, -92);
    ctx.lineTo(-26, -92); ctx.lineTo(-19, -68);
    ctx.closePath(); ctx.fill();
    ctx.fillStyle = BODY;                                                      // door pillars
    ctx.fillRect(-104, -91, 4, 23);
    ctx.fillRect(-76, -91, 4, 23);
    ctx.fillRect(-48, -91, 4, 23);
    ctx.strokeStyle = CHROME; ctx.lineWidth = 1.4;                             // chrome window surround
    ctx.beginPath();
    ctx.moveTo(-132, -68); ctx.lineTo(-121, -92);
    ctx.lineTo(-26, -92); ctx.lineTo(-19, -68);
    ctx.stroke();

    ctx.fillStyle = TRIM;                                                      // roof rails
    ctx.fillRect(-118, -99, 96, 3);
    ctx.fillStyle = '#1C1F23';                                                 // black Thule roof box
    ctx.beginPath();
    ctx.moveTo(-106, -99); ctx.lineTo(-98, -113);
    ctx.lineTo(-46, -113); ctx.lineTo(-38, -99);
    ctx.closePath(); ctx.fill();
    ctx.fillStyle = '#2A2E33';
    ctx.fillRect(-100, -108, 48, 2);

    ctx.fillStyle = TRIM;                                                      // front bumper
    ctx.fillRect(-182, -50, 10, 12);
    ctx.fillStyle = CHROME; ctx.fillRect(-181, -44, 8, 3);                     // chrome lower trim
    ctx.fillStyle = '#F5F1DC'; ctx.fillRect(-176, -60, 9, 4);                  // LED headlight
    ctx.fillStyle = TRIM; ctx.fillRect(-178, -56, 6, 7);                       // black mesh grille
    ctx.fillStyle = '#8E1616'; ctx.fillRect(-14, -62, 4, 10);                  // tail light
    if (reversing) { ctx.fillStyle = '#FFF6E0'; ctx.fillRect(-14, -54, 4, 4); }
    ctx.fillStyle = TRIM; ctx.fillRect(-132, -84, 8, 5);                       // mirror
    ctx.strokeStyle = BODY_LO; ctx.lineWidth = 1;                              // door shuts
    var dx;
    for (dx = 0; dx < 3; dx++) {
        ctx.beginPath();
        ctx.moveTo(-102 + dx * 28, -68); ctx.lineTo(-102 + dx * 28, -40);
        ctx.stroke();
    }

    wheel(-148, -21, 21);
    wheel(-36, -21, 21);

    // ---------------- the river coming up the rig ----------------
    if (wetLine !== null && wetLine !== undefined && wetLine < 0) {
        // Faded at both ends so it tints the rig rather than laying a hard
        // rectangle over the river behind it.
        ctx.save();
        var band = ctx.createLinearGradient(-210, 0, 170, 0);
        band.addColorStop(0.00, 'rgba(58,104,120,0)');
        band.addColorStop(0.14, 'rgba(58,104,120,0.5)');
        band.addColorStop(0.82, 'rgba(58,104,120,0.5)');
        band.addColorStop(1.00, 'rgba(58,104,120,0)');
        ctx.fillStyle = band;
        ctx.fillRect(-210, wetLine, 380, Math.max(0, 14 - wetLine));

        var line = ctx.createLinearGradient(-210, 0, 170, 0);
        line.addColorStop(0.00, 'rgba(230,244,248,0)');
        line.addColorStop(0.16, 'rgba(230,244,248,0.7)');
        line.addColorStop(0.80, 'rgba(230,244,248,0.7)');
        line.addColorStop(1.00, 'rgba(230,244,248,0)');
        ctx.strokeStyle = line;
        ctx.lineWidth = 2;
        ctx.beginPath();
        var wx;
        for (wx = -210; wx <= 170; wx += 16) {
            var wy = wetLine + Math.sin(wx * 0.09) * 1.6;
            if (wx === -210) ctx.moveTo(wx, wy); else ctx.lineTo(wx, wy);
        }
        ctx.stroke();
        ctx.restore();
    }
};

RR.RiverScene = {
    time: 0,
    riverAmbience: null,

    enter: function () {
        this.time = 0;
        this.finished = false;
        this.crashHandled = false;

        // DON'T REBUILD WHAT LAUNCHSCENE JUST BUILT.
        //
        // buildScene ran twice on every attempt -- LaunchScene.enter and then
        // here -- and 94% of a build is _createTreeInstances, measured at
        // 1525 ms of a 1624 ms build. The second one was pure waste: the level,
        // the difficulty and the hull are all identical across the handoff, and
        // RR.River.generate is deterministic for that triple, so the scene
        // already standing is byte-for-byte the scene this would rebuild.
        //
        // The signature covers everything the scene is a function of, so the
        // other way in here -- LevelCompleteScene going to the next river --
        // still rebuilds, and so does a difficulty or boat change.
        // resetNearMisses below clears the per-run flags (obstacle strikes and
        // caught salmon) that a reused course would otherwise carry in, which
        // is the only state the skipped generate() would have reset.
        var reuse = RR.Renderer3D._builtSig === RR.Renderer3D.sceneSignature();
        if (!reuse) RR.River.generate(RR.Progress.level);
        RR.Boat.reset();
        RR.Scoring.reset();
        RR.Scoring.score = RR.Progress.carriedScore;
        RR.Collision.resetNearMisses();
        if (!reuse) RR.Renderer3D.buildScene();
        RR.Renderer3D._camPos = null;
        RR.Renderer3D._camYaw = null;
        // LaunchScene hides the boat until it slides off the trailer. Skip the
        // intro early and it never gets shown again -- so unhide it here.
        if (RR.Renderer3D.boatGroup) RR.Renderer3D.boatGroup.visible = true;
        if (RR.Renderer3D.wakeGroup) RR.Renderer3D.wakeGroup.visible = true;
        RR.Audio.playMusic('music_gameplay');
        this.riverAmbience = RR.Audio.playLoop('ambience', RR.Config.AMBIENCE_MIX);
        RR.Audio.engineStart();
    },

    exit: function () {
        RR.Audio.stopMusic();
        RR.Audio.stopSound(this.riverAmbience);
        RR.Audio.engineStop();
        this.riverAmbience = null;
        if (this._crashTimer) { clearTimeout(this._crashTimer); this._crashTimer = null; }
        // The map is cached per level, but the COURSE also changes with
        // difficulty (widthMult), so a same-river restart at a new difficulty
        // was drawing the previous course. Dropping it here is the simplest
        // correct answer.
        this._map = null;
    },

    update: function (dt) {
        this.time += dt;
        var boat = RR.Boat;
        if (RR.Scoring.salmonFlash > 0) RR.Scoring.salmonFlash -= dt;
        if (RR.Scoring.shortcutFlash > 0) RR.Scoring.shortcutFlash -= dt;

        if (RR.Input.justPressed('Escape')) {
            RR.Engine.pushOverlay(RR.PauseScene);
            return;
        }
        if (RR.Input.justPressed('KeyM')) {
            RR.Audio.toggleMute();
        }

        boat.update(dt);
        RR.Audio.setEngine(boat.crashed ? 0 : boat.throttle,
            boat.crashed ? 0 : boat.speed / Math.max(1, boat.getMaxSpeed()));
        RR.Collision.checkAll(boat);
        RR.Scoring.update(dt, boat);

        // Guard, or this fires a setTimeout AND a localStorage write on every
        // frame the boat sits crashed -- about 72 of each over the 1.2 s delay,
        // and every queued timer re-entered CrashScene and reset its 0.5 s
        // input gate, so Enter stayed dead for ~1.7 s instead of 0.5 s.
        if (boat.crashed || boat.grounded) {
            if (!this.crashHandled) {
                this.crashHandled = true;
                RR.Scoring.saveHighScore();
                // A crash ends the run, so this is where the final score is
                // known -- LevelComplete carries on to the next river. Offer
                // name entry only if the score actually makes the top ten;
                // prompting after every crash would just be nagging.
                var finalScore = RR.Scoring.getScore();
                var finalDist = boat.distanceTraveled;
                this._crashTimer = setTimeout(function () {
                    // The player can leave RiverScene inside this 1.2 s -- ESC
                    // is checked before the crash branch, so you can pause a
                    // dead boat and quit to the menu. Without this guard the
                    // timer then yanked whatever scene you had reached into the
                    // crash screen a second later.
                    if (RR.Engine.scene !== RR.RiverScene) return;
                    var nextScene = RR.Progress.boardThen(finalScore, finalDist, RR.CrashScene);
                    // A crash ends the run; the next one signs in fresh.
                    RR.Progress.runName = null;
                    RR.Engine.changeScene(nextScene);
                }, 1200);
            }
            return;
        }

        // Through the gate at the head of navigation -- level cleared.
        if (!this.finished && RR.River.finishZ && boat.z >= RR.River.finishZ) {
            this.finished = true;
            RR.Scoring.addRouteBonus();   // ROUTE_BONUS, for running the gate
            RR.Scoring.saveHighScore();
            RR.Progress.carriedScore = RR.Scoring.score;
            // Making the finish line is the best run there is -- it gets the
            // top-ten board too (Tyler, 2026-10-26: "if you make it to the
            // finish line you don't get to type in top score").
            RR.Engine.changeScene(RR.Progress.boardThen(
                RR.Scoring.getScore(), boat.distanceTraveled, RR.LevelCompleteScene));
            return;
        }
    },

    render3D: function (dt) {
        RR.Renderer3D.update(dt, RR.Engine.totalTime);
        RR.Renderer3D.render();
    },

    render: function (ctx) {
        var C = RR.Config;
        var W = C.CANVAS_WIDTH;
        var H = C.CANVAS_HEIGHT;
        this.drawHUD(ctx, W, H);
        this.drawRiverIntro(ctx, W, H);
    },

    drawRiverIntro: function (ctx, W, H) {
        if (this.time >= 3.4 || !RR.River.profile) return;
        var p = RR.River.profile;
        var fade = this.time < 0.45 ? this.time / 0.45 :
            (this.time > 2.75 ? Math.max(0, (3.4 - this.time) / 0.65) : 1);
        ctx.save();
        ctx.globalAlpha = fade;
        ctx.fillStyle = 'rgba(8,18,24,0.82)';
        RR.UI.pill(ctx, W * 0.25, H * 0.31, W * 0.50, H * 0.25, 8);
        ctx.fill();
        ctx.fillStyle = RR.Config.WB_BLUE;
        ctx.fillRect(W * 0.25, H * 0.31, 6, H * 0.25);
        RR.UI.label(ctx, 'LEVEL ' + RR.Progress.level + ' · WORLD TOUR ' + RR.River.tour,
            W / 2, H * 0.355, 13, 'rgba(223,227,230,0.65)', 600);
        RR.UI.headline(ctx, p.name, W / 2, H * 0.42, 42,
            RR.Config.WB_WHITE, RR.Config.WB_BLUE);
        RR.UI.label(ctx, p.location, W / 2, H * 0.475, 15, RR.Config.WB_BLUE, 700);
        RR.UI.label(ctx, p.tagline, W / 2, H * 0.525, 11,
            'rgba(223,227,230,0.72)', 600);
        ctx.restore();
    },

    drawHUD: function (ctx, W, H) {
        var C = RR.Config;
        var boat = RR.Boat;
        var scoring = RR.Scoring;

        var hudGrad = ctx.createLinearGradient(0, 0, 0, 48);
        hudGrad.addColorStop(0, 'rgba(0,0,0,0.75)');
        hudGrad.addColorStop(1, 'rgba(0,0,0,0.25)');
        ctx.fillStyle = hudGrad;
        ctx.fillRect(0, 0, W, 48);
        ctx.fillStyle = 'rgba(255,215,0,0.3)';
        ctx.fillRect(0, 47, W, 1);

        ctx.textAlign = 'left';
        ctx.textBaseline = 'middle';

        ctx.save();
        ctx.shadowColor = 'rgba(0,0,0,0.5)';
        ctx.shadowBlur = 4;
        ctx.fillStyle = C.UI_GOLD;
        ctx.font = '600 14px ' + C.FONT_UI;
        ctx.fillText('SCORE', 15, 14);
        ctx.fillStyle = '#FFF';
        ctx.font = '600 26px ' + C.FONT_UI;
        ctx.fillText(String(scoring.getScore()), 15, 36);
        ctx.restore();

        if (scoring.speedMultiplier > 1.05) {
            ctx.fillStyle = C.UI_ACCENT;
            ctx.font = '600 22px ' + C.FONT_UI;
            ctx.fillText('x' + scoring.speedMultiplier.toFixed(1), 200, 26);
        }

        ctx.textAlign = 'right';
        var model = boat.getModel();
        var speedPct = Math.floor((boat.speed / boat.getMaxSpeed()) * 100);

        ctx.save();
        ctx.shadowColor = 'rgba(0,0,0,0.5)';
        ctx.shadowBlur = 4;
        ctx.fillStyle = C.UI_GOLD;
        ctx.font = '600 14px ' + C.FONT_UI;
        ctx.fillText('SPEED', W - 15, 14);
        ctx.fillStyle = speedPct > 80 ? C.UI_ACCENT : '#FFF';
        ctx.font = '600 30px ' + C.FONT_UI;
        ctx.fillText(speedPct + '%', W - 15, 36);
        ctx.restore();

        var gaugeX = W - 150;
        var gaugeW = 110;
        ctx.fillStyle = 'rgba(0,0,0,0.4)';
        ctx.fillRect(gaugeX, 42, gaugeW, 4);
        var pct = speedPct / 100;
        var gaugeColor;
        if (pct < 0.5) gaugeColor = C.UI_GREEN;
        else if (pct < 0.8) gaugeColor = C.UI_GOLD;
        else gaugeColor = C.UI_ACCENT;
        ctx.fillStyle = gaugeColor;
        ctx.fillRect(gaugeX, 42, gaugeW * pct, 4);

        ctx.textAlign = 'left';
        ctx.fillStyle = 'rgba(255,255,255,0.58)';
        ctx.font = '600 11px ' + C.FONT_UI;
        ctx.fillText(model.model + ' · ' + RR.Difficulty.getSelected().label, 300, 17);
        ctx.fillStyle = C.WB_BLUE;
        ctx.fillText(model.maxJetHp + ' MAX JET HP', 300, 34);

        // Hull pips.
        //
        // This used to be gated on maxHits > 1, on the reasoning that a
        // one-strike boat has nothing to show. That stopped being true when
        // damage went fractional: on HARD every boat but the Rogue has ONE
        // strike, a log or a canyon scrape costs half of it, and the player
        // was left carrying invisible damage on a HUD identical to full health.
        // One part-width pip reads that fine.
        var maxHits = boat.maxHits ? boat.maxHits() : 1;
        if (maxHits >= 1) {
            var left = boat.hitsLeft();
            var pipX = 448, pipY = 11, pipW = 15, pipH = 11, gap = 4;
            ctx.textAlign = 'left';
            ctx.fillStyle = 'rgba(255,255,255,0.50)';
            ctx.font = '600 10px ' + C.FONT_UI;
            ctx.fillText('HULL', pipX, 34);
            // left can be fractional now -- a log costs half a strike -- so a
            // partly-damaged pip is drawn as a part-width pip rather than
            // silently rounding and telling the player nothing.
            for (var hp = 0; hp < maxHits; hp++) {
                var frac = Math.max(0, Math.min(1, left - hp));
                var px = pipX + hp * (pipW + gap);
                ctx.fillStyle = 'rgba(255,255,255,0.13)';
                ctx.fillRect(px, pipY, pipW, pipH);
                if (frac > 0) {
                    ctx.fillStyle = (left <= 1) ? C.UI_ACCENT : C.UI_GREEN;
                    ctx.fillRect(px, pipY, pipW * frac, pipH);
                }
            }
        }

        ctx.textAlign = 'center';
        var dist = Math.floor(boat.distanceTraveled / C.SEGMENT_LENGTH);
        var riverProfile = RR.River.profile;
        ctx.fillStyle = C.WB_BLUE;
        ctx.font = '700 11px ' + C.FONT_UI;
        ctx.fillText(riverProfile ? riverProfile.name : 'RIVER', W / 2, 14);

        ctx.fillStyle = '#BBB';
        ctx.font = '500 13px ' + C.FONT_UI;
        ctx.fillText(dist + 'm', W / 2, 35);

        // --- CURRENT ---------------------------------------------------------
        // Big marching chevrons pointing the way the river is shoving you.
        // This used to be 13px of text nobody noticed, which was daft: the
        // current is the main thing pushing you off your line, so it is now the
        // loudest thing on the HUD. The chevrons grow, speed up and shift from
        // amber to red with the strength of the push, and a lit crest runs
        // along them in the push direction so it reads instantly.
        // The same filtered flow the hull feels, so the arrows never pop
        // ahead of (or harder than) the push you actually get.
        var current = (boat._curL !== null && boat._curL !== undefined)
            ? { lateral: boat._curL }
            : RR.River.getCurrentAtPosition(boat.z, boat.lateral);
        var curMag = Math.abs(current.lateral);
        if (curMag > 0.05) {
            var dir = current.lateral > 0 ? 1 : -1;
            var t = this.time;
            var strength = Math.min(1, curMag / 0.40);
            var count = 4 + Math.round(strength * 2);          // 4 - 6 chevrons
            var chScale = C.CURRENT_CHEVRON_SCALE;
            var chW = (26 + strength * 20) * chScale;          // 26 - 46 px at 1.0
            var chH = (42 + strength * 34) * chScale;          // 42 - 76 px at 1.0
            var gapX = chW * 1.30;
            // Dropped from 0.19 to 0.27 when these went diagonal. Marching
            // down-and-across gives the strip real vertical extent, and at
            // 0.19 the leading chevron ran off the top of the frame and
            // through the score row.
            var cy = H * 0.27;
            // DIAGONAL, not left-and-right. Tyler's arrows: down-right and
            // down-left. You run upstream, so the water comes AT you and off
            // to one side -- pointing these straight across said the river was
            // shoving you sideways only, which is not what the hull feels and
            // not what the physics does now (see CURRENT_DIAGONAL).
            //
            // 38 degrees, not 45: the strip has to stay inside the top third
            // of the HUD. At 6 chevrons and the widest spacing the run is
            // about +/-150px along the diagonal, which is +/-92px of vertical
            // -- comfortably clear of the mini map and the score row.
            // Canvas +y is DOWN, so +38 deg is down-right and 142 deg is
            // down-left. The strip marches along that same unit vector, so the
            // chevrons and the line they sit on always agree.
            var SLANT = 38 * Math.PI / 180;
            var theta = dir > 0 ? SLANT : Math.PI - SLANT;
            var ux = Math.cos(theta), uy = Math.sin(theta);
            // Half the strip's run along the diagonal, so the label can sit
            // clear of the LAST chevron rather than in the middle of them.
            var halfRun = (count - 1) / 2 * gapX;
            // A hard push makes the whole strip jitter -- cheap, and it reads.
            var shake = strength * strength * 2.2;
            var ox = Math.sin(t * 34) * shake;

            ctx.save();
            ctx.lineJoin = 'round';
            ctx.lineCap = 'round';
            for (var ci = 0; ci < count; ci++) {
                // Travelling crest: index 0 is the trailing chevron, so the
                // light runs the same way the water is pushing.
                var crest = Math.sin(t * (4 + strength * 4) - ci * 0.85);
                var lit = 0.30 + 0.70 * Math.max(0, crest);
                var idx = ci - (count - 1) / 2;
                var cx = W / 2 + idx * gapX * ux + ox;
                var chy = cy + idx * gapX * uy;

                var g = Math.floor(190 - strength * 150);      // amber -> red
                ctx.strokeStyle = 'rgba(255,' + g + ',60,' + (0.22 + lit * 0.78) + ')';
                ctx.lineWidth = 5 + strength * 4;
                ctx.shadowColor = 'rgba(255,' + g + ',60,' + (lit * 0.85) + ')';
                ctx.shadowBlur = 10 + lit * 20 + strength * 10;

                ctx.save();
                ctx.translate(cx, chy);
                ctx.rotate(theta);
                ctx.beginPath();
                ctx.moveTo(-chW / 2, -chH / 2);
                ctx.lineTo(chW / 2, 0);
                ctx.lineTo(-chW / 2, chH / 2);
                ctx.stroke();
                ctx.restore();
            }
            ctx.restore();

            var flash = 0.62 + 0.38 * Math.sin(t * 7);
            RR.UI.label(ctx, strength > 0.66 ? 'HARD CURRENT' : 'CURRENT',
                W / 2, cy + halfRun * uy + chH / 2 + 22, 15 + strength * 5,
                'rgba(255,' + Math.floor(190 - strength * 150) + ',60,' + flash + ')', 700);
            ctx.textAlign = 'center';
        }

        this.drawSalmonBonus(ctx, W, H);
        this.drawShortcutBonus(ctx, W, H);
        this.drawMiniMap(ctx, W, H, boat);

        if (boat.jumpCooldown > 0) {
            var cdPct = boat.jumpCooldown / C.JUMP_COOLDOWN;
            ctx.fillStyle = 'rgba(0,0,0,0.6)';
            ctx.fillRect(W / 2 - 50, H - 30, 100, 14);
            ctx.strokeStyle = 'rgba(255,255,255,0.2)';
            ctx.lineWidth = 1;
            ctx.strokeRect(W / 2 - 50, H - 30, 100, 14);
            ctx.fillStyle = C.WB_BLUE;
            ctx.fillRect(W / 2 - 49, H - 29, 98 * (1 - cdPct), 12);
            ctx.fillStyle = '#999';
            ctx.font = '600 10px ' + C.FONT_UI;
            ctx.fillText('JUMP', W / 2, H - 17);
        } else {
            ctx.fillStyle = C.UI_GREEN;
            ctx.font = '600 11px ' + C.FONT_UI;
            ctx.fillText('JUMP READY', W / 2, H - 17);
        }

        if (boat.inShallow > 0) {
            var groundLimit = C.SHALLOW_GROUND_TIME * model.groundTimeMult;
            var groundRemaining = Math.max(0, groundLimit - boat.shallowTimer);
            var warnAlpha = 0.5 + Math.sin(this.time * 8) * 0.3;
            ctx.save();
            ctx.shadowColor = 'rgba(255,60,0,0.6)';
            ctx.shadowBlur = 12;
            ctx.fillStyle = 'rgba(255,80,40,' + warnAlpha + ')';
            ctx.font = '600 26px ' + C.FONT_UI;
            ctx.fillText('SHALLOW WATER!', W / 2, H * 0.88);
            ctx.font = '700 13px ' + C.FONT_UI;
            ctx.fillText(groundRemaining.toFixed(1) + 's TO GROUNDING', W / 2, H * 0.915);
            ctx.restore();
            var groundPct = Math.min(1, boat.shallowTimer / groundLimit);
            ctx.fillStyle = 'rgba(0,0,0,0.5)';
            ctx.fillRect(W / 2 - 70, H * 0.93, 140, 8);
            ctx.fillStyle = 'rgba(255,' + Math.floor(80 - groundPct * 80) + ',0,0.8)';
            ctx.fillRect(W / 2 - 69, H * 0.93 + 1, 138 * groundPct, 6);
        }

        // Impact banner. boat.hitFlash is set by takeHit and decays, so this
        // only shows for a survivable strike -- a fatal one goes to CrashScene.
        if (boat.hitFlash > 0 && !boat.crashed) {
            var hitAlpha = Math.min(1, boat.hitFlash / 0.9);
            var remain = boat.hitsLeft();
            ctx.textAlign = 'center';
            ctx.save();
            ctx.globalAlpha = hitAlpha;
            ctx.shadowColor = 'rgba(255,60,0,0.75)';
            ctx.shadowBlur = 16;
            ctx.fillStyle = C.UI_ACCENT;
            ctx.font = '700 30px ' + C.FONT_UI;
            ctx.fillText('HULL STRIKE!', W / 2, H * 0.30);
            // remain is fractional now, so an equality test against 1 could
            // never fire once a log or a wall scrape had landed -- the player
            // on half a hull got a calm white "0.5 HITS LEFT" instead of a
            // warning. Compare with <=, and never print the raw float.
            ctx.fillStyle = remain <= 1 ? C.UI_ACCENT : '#FFF';
            ctx.font = '600 16px ' + C.FONT_UI;
            var hullMsg;
            if (remain <= 0.5) hullMsg = 'HALF A HULL LEFT — SHE WON\'T TAKE ANOTHER';
            else if (remain <= 1) hullMsg = 'LAST ONE — SHE WON\'T TAKE ANOTHER';
            else hullMsg = (Math.round(remain * 2) / 2) + ' HITS LEFT';
            ctx.fillText(hullMsg, W / 2, H * 0.345);
            ctx.restore();
        }

        if (boat.bearWarning) {
            var bearPulse = 0.62 + Math.sin(this.time * 9) * 0.28;
            ctx.textAlign = 'center';
            ctx.save();
            ctx.shadowColor = 'rgba(255,70,20,0.8)';
            ctx.shadowBlur = 14;
            ctx.fillStyle = 'rgba(255,105,35,' + bearPulse + ')';
            ctx.font = '700 23px ' + C.FONT_UI;
            ctx.fillText('BEAR ON THE BANK — MOVE OFF!', W / 2, H * 0.78);
            ctx.restore();
        }

        if (RR.Audio.muted) {
            ctx.textAlign = 'right';
            ctx.fillStyle = '#555';
            ctx.font = '400 12px ' + C.FONT_UI;
            ctx.fillText('MUTED [M]', W - 10, H - 8);
        }

        var seg = RR.River.getSegmentAtZ(boat.z);
        if (seg.marker && boat.speed < boat.getMaxSpeed() * 0.3 && Math.abs(boat.lateral - seg.marker.x) < 0.3) {
            var label = seg.marker.type === 'fishing' ? 'FISHING' : 'HUNTING';
            ctx.textAlign = 'center';
            ctx.fillStyle = 'rgba(0,0,0,0.75)';
            ctx.fillRect(W / 2 - 180, H * 0.44, 360, 64);
            ctx.strokeStyle = 'rgba(255,215,0,0.3)';
            ctx.strokeRect(W / 2 - 180, H * 0.44, 360, 64);
            ctx.fillStyle = C.UI_GOLD;
            ctx.font = '600 20px ' + C.FONT_UI;
            ctx.fillText(label + ' SPOT — COMING SOON', W / 2, H * 0.47);
            ctx.fillStyle = '#BBB';
            ctx.font = '400 14px ' + C.FONT_UI;
            ctx.fillText('Slow down here in a future update to try it!', W / 2, H * 0.51);
        }
    }
};

// --- SECRET SHORTCUT -----------------------------------------------------------
RR.RiverScene.drawShortcutBonus = function (ctx, W, H) {
    var S = RR.Scoring;
    if (!S.shortcutFlash || S.shortcutFlash <= 0) return;
    var C = RR.Config;
    var life = Math.min(1, S.shortcutFlash / 0.6);
    var blink = 0.6 + 0.4 * Math.abs(Math.sin(this.time * 7));
    ctx.save();
    ctx.globalAlpha = life * blink;
    RR.UI.headline(ctx, 'SECRET SHORTCUT!', W / 2, H * 0.40, 40, C.UI_GOLD || '#F2C14E', C.WB_BLUE);
    RR.UI.label(ctx, '+' + C.SHORTCUT_BONUS.toLocaleString() + ' · FAST WATER', W / 2, H * 0.47, 16, C.WB_WHITE, 600);
    ctx.restore();
};

// --- SALMON BONUS ------------------------------------------------------------
// A fish that lands in the boat is worth 1000, and it should feel like it.
// A flashing salmon in the top-left corner for a couple of seconds.
RR.RiverScene.drawSalmonBonus = function (ctx, W, H) {
    var S = RR.Scoring;
    if (!S.salmonFlash || S.salmonFlash <= 0) return;
    var C = RR.Config;
    var life = Math.min(1, S.salmonFlash / 2.6);
    var t = this.time;
    var blink = 0.45 + 0.55 * Math.abs(Math.sin(t * 9));
    var pop = 1 + Math.max(0, (S.salmonFlash - 2.25)) * 2.4;   // brief scale-up on catch
    var x = 96, y = H * 0.30;

    ctx.save();
    ctx.translate(x, y);
    ctx.scale(pop, pop);
    ctx.globalAlpha = Math.min(1, life * 2) * blink;

    // fish body
    ctx.fillStyle = '#C94B28';
    ctx.beginPath();
    ctx.moveTo(-30, 0);
    ctx.quadraticCurveTo(-6, -17, 22, 0);
    ctx.quadraticCurveTo(-6, 17, -30, 0);
    ctx.fill();
    // tail
    ctx.beginPath();
    ctx.moveTo(-30, 0); ctx.lineTo(-45, -12); ctx.lineTo(-45, 12);
    ctx.closePath();
    ctx.fill();
    // belly + eye
    ctx.fillStyle = '#E8A06C';
    ctx.beginPath();
    ctx.moveTo(-24, 3); ctx.quadraticCurveTo(-4, 13, 18, 2);
    ctx.quadraticCurveTo(-4, 9, -24, 3);
    ctx.fill();
    ctx.fillStyle = '#1A1A1A';
    ctx.beginPath(); ctx.arc(12, -3, 2.4, 0, Math.PI * 2); ctx.fill();
    ctx.restore();

    ctx.save();
    ctx.globalAlpha = Math.min(1, life * 2) * blink;
    ctx.textAlign = 'center';
    RR.UI.label(ctx, 'SALMON BONUS', x, y + 38, 14, C.UI_GOLD, 700);
    RR.UI.label(ctx, '+' + C.SALMON_POINTS, x, y + 60, 20, C.WB_WHITE, 700);
    if (S.salmonCaught > 1) {
        RR.UI.label(ctx, S.salmonCaught + ' CAUGHT', x, y + 80, 11,
            'rgba(223,227,230,0.75)', 600);
    }
    ctx.restore();
    ctx.textAlign = 'center';
};

// --- MINI MAP ----------------------------------------------------------------
// The whole river in the lower-right corner with the boat on it, so the player
// can see how far through the run they are and what the channel is doing next.
// The centre line is sampled once per level from the same getWorldPos() the
// renderer draws with, then cached -- it is ~90 samples and must not be redone
// every frame.
RR.RiverScene.buildMapPath = function () {
    var R3 = RR.Renderer3D, C = RR.Config;
    var segs = RR.River.segments;
    if (!segs || !segs.length || !R3.getWorldPos) return null;
    // TRACE THE RACED COURSE, NOT THE WHOLE PATH.
    //
    // This used to run to segs.length - 1 (1799) while the boat's progress was
    // normalised on the finish GATE (1719). Two things fell out of that, and
    // only one of them had been noticed:
    //   * the gold dot sat at 1799, past where the boat stops; and
    //   * every boat position was a lie. frac is 0..1 over the gate, then
    //     stretched across the full 91-point path, so at the halfway sign
    //     (859) the arrow was drawn at 899 -- consistently ~4.6% downstream
    //     of the boat for the entire run.
    // Ending the path at the gate fixes both without any index arithmetic,
    // which is what the reverted attempt tried to do and threw on.
    var last = Math.min(segs.length - 1, RR.River.finishSegment || (segs.length - 1));
    var N = 90, pts = [], i, wp;
    for (i = 0; i <= N; i++) {
        wp = R3.getWorldPos((last * i / N) * C.SEGMENT_LENGTH, 0);
        pts.push({ x: wp.x, z: wp.z });
    }
    var minX = Infinity, maxX = -Infinity, minZ = Infinity, maxZ = -Infinity;
    for (i = 0; i < pts.length; i++) {
        if (pts[i].x < minX) minX = pts[i].x;
        if (pts[i].x > maxX) maxX = pts[i].x;
        if (pts[i].z < minZ) minZ = pts[i].z;
        if (pts[i].z > maxZ) maxZ = pts[i].z;
    }
    return { pts: pts, minX: minX, maxX: maxX, minZ: minZ, maxZ: maxZ,
             level: RR.Progress.level, gate: last,
             difficulty: RR.Difficulty ? RR.Difficulty.selectedIndex : 0 };
};

RR.RiverScene.drawMiniMap = function (ctx, W, H, boat) {
    var C = RR.Config;
    // Level AND difficulty: widthMult changes the course, so a same-river
    // restart at a new difficulty must redraw. RiverScene.exit drops the cache
    // as well; this is the belt to that pair of braces.
    if (!this._map || this._map.level !== RR.Progress.level ||
            this._map.difficulty !== (RR.Difficulty ? RR.Difficulty.selectedIndex : 0)) {
        this._map = this.buildMapPath();
    }
    var m = this._map;
    if (!m) return;

    // Tall and narrow: a river is long and thin, and a wide box wasted the
    // corner. 96 x 208 instead of 132 x 176.
    var bw = 96, bh = 208, pad = 10;
    var bx = W - bw - 16, by = H - bh - 16;

    ctx.save();
    ctx.fillStyle = 'rgba(8,14,20,0.62)';
    RR.UI.pill(ctx, bx, by, bw, bh, 8);
    ctx.fill();
    ctx.strokeStyle = 'rgba(223,227,230,0.22)';
    ctx.lineWidth = 1;
    RR.UI.pill(ctx, bx, by, bw, bh, 8);
    ctx.stroke();

    // Fit the course into the box.
    //
    // The river is far longer than it is wide, so fitting BOTH axes to scale
    // squeezes it into a hairline. The long axis is fitted to the box height
    // and the cross-river wander is scaled up separately -- it is a progress
    // map, not a survey.
    //
    // START AT THE TOP, FINISH AT THE BOTTOM: the boat marker runs DOWN the box
    // and the gold finish dot sits at the bottom. Tyler's call, and it matches
    // the way you read a river running away from you down the screen.
    var spanX = Math.max(1, m.maxX - m.minX), spanZ = Math.max(1, m.maxZ - m.minZ);
    var scZ = (bh - pad * 2 - 14) / spanZ;
    var scX = Math.min((bw - pad * 2) / spanX, scZ * 7);
    var ox = bx + bw / 2 - ((m.minX + m.maxX) / 2) * scX;
    var oy = by + pad + 8;
    var P = function (p) { return { x: ox + p.x * scX, y: oy + (p.z - m.minZ) * scZ }; };

    var i, p;
    ctx.beginPath();
    for (i = 0; i < m.pts.length; i++) {
        p = P(m.pts[i]);
        if (i === 0) ctx.moveTo(p.x, p.y); else ctx.lineTo(p.x, p.y);
    }
    ctx.strokeStyle = 'rgba(90,160,180,0.55)';
    ctx.lineWidth = 5; ctx.lineCap = 'round'; ctx.lineJoin = 'round';
    ctx.stroke();
    ctx.strokeStyle = C.WB_BLUE;
    ctx.lineWidth = 2;
    ctx.stroke();

    // start (top) and finish (bottom, gold)
    var st = P(m.pts[0]);
    ctx.fillStyle = 'rgba(223,227,230,0.55)';
    ctx.fillRect(st.x - 2.5, st.y - 2.5, 5, 5);
    // The last point of the path IS the finish gate now -- see buildMapPath.
    // No index arithmetic, which is what the earlier attempt threw on.
    var fin = P(m.pts[m.pts.length - 1]);
    ctx.fillStyle = C.UI_GOLD;
    ctx.fillRect(fin.x - 3.5, fin.y - 3.5, 7, 7);

    // the boat
    // Normalise on the finish GATE, not the last segment. The course runs to
    // 1799 but the gate is at 1719, so the percentage stopped at 96% and the
    // boat arrow halted short of the gold dot -- the map told the player they
    // had not finished at the exact moment the level ended.
    // m.gate is the same segment the path was traced to, so frac maps
    // one-for-one onto the drawn line.
    var last = m.gate || RR.River.finishSegment || (RR.River.segments.length - 1);
    var frac = Math.max(0, Math.min(1, (boat.z / C.SEGMENT_LENGTH) / last));
    var fi = frac * (m.pts.length - 1);
    var i0 = Math.floor(fi), i1 = Math.min(m.pts.length - 1, i0 + 1), ft = fi - i0;
    var bp = P({ x: m.pts[i0].x + (m.pts[i1].x - m.pts[i0].x) * ft,
                 z: m.pts[i0].z + (m.pts[i1].z - m.pts[i0].z) * ft });
    var ang = Math.atan2(P(m.pts[i1]).y - P(m.pts[i0]).y, P(m.pts[i1]).x - P(m.pts[i0]).x);

    ctx.save();
    ctx.translate(bp.x, bp.y);
    ctx.rotate(ang);
    ctx.translate(0, boat.lateral * 3.5);          // which side of the channel
    ctx.fillStyle = C.WB_WHITE;
    ctx.strokeStyle = 'rgba(0,0,0,0.55)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(6, 0); ctx.lineTo(-4, -3.4); ctx.lineTo(-2, 0); ctx.lineTo(-4, 3.4);
    ctx.closePath();
    ctx.fill(); ctx.stroke();
    ctx.restore();

    ctx.textAlign = 'center';
    RR.UI.label(ctx, Math.round(frac * 100) + '%', bx + bw / 2, by + bh - 6, 10,
        'rgba(223,227,230,0.7)', 700);
    ctx.restore();
    ctx.textAlign = 'center';
};

RR.CrashScene = {
    time: 0,
    selected: 0,
    hot: -1,
    _actions: null,
    labels: ['RETRY', 'MAIN MENU', 'RIP ANOTHER RIVER', 'RIP A DIFFERENT BOAT'],

    enter: function () {
        this.time = 0;
        this.selected = 0;
        this.hot = -1;
    },

    exit: function () { RR.UI.cursor(false); },

    actionZones: function () {
        var W = RR.Config.CANVAS_WIDTH, H = RR.Config.CANVAS_HEIGHT;
        var w = 280, h = 44, gapX = 18, gapY = 10;
        var left = W / 2 - gapX / 2 - w;
        var right = W / 2 + gapX / 2;
        var top = H * 0.77;
        return [
            { x: left,  y: top,            w: w, h: h },
            { x: right, y: top,            w: w, h: h },
            { x: left,  y: top + h + gapY, w: w, h: h },
            { x: right, y: top + h + gapY, w: w, h: h }
        ];
    },

    hitAction: function (zones, x, y) {
        var i, z;
        for (i = 0; i < zones.length; i++) {
            z = zones[i];
            if (x >= z.x && x <= z.x + z.w && y >= z.y && y <= z.y + z.h) return i;
        }
        return -1;
    },

    activate: function (index) {
        switch (index) {
            case 0:
                RR.Engine.changeScene(RR.LaunchScene);
                break;
            case 1:
                RR.Engine.changeScene(RR.MenuScene);
                break;
            case 2:
                RR.Engine.changeScene(RR.RiverSelectScene);
                break;
            case 3:
                RR.Engine.changeScene(RR.BoatSelectScene);
                break;
        }
    },

    update: function (dt) {
        this.time += dt;
        var Input = RR.Input;
        var zones = this.actionZones();
        this._actions = zones;
        var over = Input.inside ? this.hitAction(zones, Input.mouseX, Input.mouseY) : -1;
        this.hot = over;
        if (Input.moved && over !== -1) this.selected = over;
        RR.UI.cursor(over !== -1);

        if (this.time < 0.5) return;

        if (Input.justPressed('KeyA') || Input.justPressed('ArrowLeft') ||
                Input.justPressed('KeyD') || Input.justPressed('ArrowRight')) {
            this.selected += this.selected % 2 === 0 ? 1 : -1;
        }
        if (Input.justPressed('KeyW') || Input.justPressed('ArrowUp') ||
                Input.justPressed('KeyS') || Input.justPressed('ArrowDown')) {
            this.selected = (this.selected + 2) % 4;
        }
        if (Input.justPressed('KeyM')) RR.Audio.toggleMute();
        if (Input.justPressed('Escape')) {
            this.activate(1);
            return;
        }
        if (Input.justPressed('Enter') || Input.justPressed('Space')) {
            this.activate(this.selected);
            return;
        }
        if (Input.clicked && over !== -1) {
            Input.clicked = false;
            this.selected = over;
            this.activate(over);
        }
    },

    render: function (ctx) {
        var W = RR.Config.CANVAS_WIDTH;
        var H = RR.Config.CANVAS_HEIGHT;
        var C = RR.Config;
        var boat = RR.Boat;
        var scoring = RR.Scoring;
        var UI = RR.UI;
        var actions = this._actions || this.actionZones();

        var bgGrad = ctx.createLinearGradient(0, 0, 0, H);
        bgGrad.addColorStop(0, 'rgba(10,14,24,0.92)');
        bgGrad.addColorStop(1, 'rgba(20,24,40,0.92)');
        ctx.fillStyle = bgGrad;
        ctx.fillRect(0, 0, W, H);

        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';

        ctx.save();
        ctx.shadowColor = 'rgba(255,68,68,0.5)';
        ctx.shadowBlur = 18;
        ctx.restore();
        RR.UI.headline(ctx, boat.grounded ? 'GROUNDED!' : 'CRASHED!', W / 2, H * 0.10, 54, C.UI_ACCENT, C.WB_BLUE);

        ctx.font = '400 17px ' + C.FONT_UI;
        ctx.fillStyle = 'rgba(223,227,230,0.6)';
        ctx.fillText(boat.crashType, W / 2, H * 0.18);

        ctx.strokeStyle = 'rgba(255,215,0,0.15)';
        ctx.lineWidth = 1;
        ctx.strokeRect(W * 0.18, H * 0.24, W * 0.64, H * 0.52);

        var stats = [
            ['FINAL SCORE', scoring.getScore()],
            ['HIGH SCORE', scoring.highScore],
            ['DISTANCE', Math.floor(boat.distanceTraveled / C.SEGMENT_LENGTH) + ' m'],
            ['BEST DISTANCE', Math.floor(scoring.bestDistance / C.SEGMENT_LENGTH) + ' m'],
            ['BOAT', boat.getModel().model],
            ['TOP SPEED', Math.floor((boat.maxSpeed / (C.MAX_SPEED * boat.getModel().speedMult)) * 100) + '%'],
            ['JUMPS', boat.jumpCount],
            ['NEAR MISSES', boat.nearMisses],
            ['OBSTACLES CLEARED', boat.obstaclesCleared]
        ];

        var startY = H * 0.30;
        for (var i = 0; i < stats.length; i++) {
            var y = startY + i * 34;
            var isHighlight = (i === 0 || i === 1);

            if (isHighlight) {
                ctx.fillStyle = 'rgba(255,215,0,0.06)';
                ctx.fillRect(W * 0.19, y - 14, W * 0.62, 28);
            }

            ctx.textAlign = 'left';
            ctx.fillStyle = isHighlight ? C.UI_GOLD : '#999';
            ctx.font = (isHighlight ? '600 ' : '400 ') + '16px ' + C.FONT_UI;
            ctx.fillText(stats[i][0], W * 0.25, y);
            ctx.textAlign = 'right';
            ctx.fillStyle = isHighlight ? C.UI_GOLD : C.UI_TEXT;
            ctx.font = (isHighlight ? '600 ' : '400 ') + '18px ' + C.FONT_UI;
            ctx.fillText(String(stats[i][1]), W * 0.75, y);
        }

        if (scoring.getScore() >= scoring.highScore && scoring.getScore() > 0) {
            ctx.textAlign = 'center';
            ctx.save();
            ctx.shadowColor = 'rgba(255,215,0,0.5)';
            ctx.shadowBlur = 12;
            ctx.fillStyle = C.UI_GOLD;
            ctx.font = '600 26px ' + C.FONT_UI;
            var flash = Math.sin(this.time * 4) > 0;
            if (flash) ctx.fillText('NEW HIGH SCORE!', W / 2, H * 0.735);
            ctx.restore();
        }

        var i, z, active;
        for (i = 0; i < actions.length; i++) {
            z = actions[i];
            active = i === this.selected;
            ctx.fillStyle = active ? C.WB_BLUE :
                (i === this.hot ? 'rgba(27,117,187,0.22)' : 'rgba(8,14,20,0.88)');
            RR.UI.pill(ctx, z.x, z.y, z.w, z.h, 6);
            ctx.fill();
            ctx.strokeStyle = active ? C.WB_WHITE : 'rgba(223,227,230,0.24)';
            ctx.lineWidth = active ? 2 : 1;
            RR.UI.pill(ctx, z.x, z.y, z.w, z.h, 6);
            ctx.stroke();
            UI.label(ctx, this.labels[i], z.x + z.w / 2, z.y + z.h / 2, 13,
                active ? C.WB_WHITE : 'rgba(223,227,230,0.72)', active ? 700 : 600);
        }

        UI.label(ctx, 'ARROWS TO CHOOSE · ENTER TO CONFIRM · ESC FOR MAIN MENU',
            W / 2, H * 0.96, 10, 'rgba(223,227,230,0.42)', 500);
    }
};

RR.PauseScene = {
    enter: function () { RR.Audio.engineIdle(); },

    update: function (dt) {
        if (RR.Input.justPressed('Escape') || RR.Input.justPressed('Enter')) {
            RR.Engine.popOverlay();
        }
        if (RR.Input.justPressed('KeyQ')) {
            RR.Engine.popOverlay();
            RR.Engine.changeScene(RR.MenuScene);
        }
        if (RR.Input.justPressed('KeyM')) {
            RR.Audio.toggleMute();
        }
    },

    render: function (ctx) {
        var W = RR.Config.CANVAS_WIDTH;
        var H = RR.Config.CANVAS_HEIGHT;
        var C = RR.Config;

        ctx.fillStyle = 'rgba(0,0,0,0.75)';
        ctx.fillRect(0, 0, W, H);

        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';

        ctx.save();
        ctx.shadowColor = 'rgba(255,215,0,0.3)';
        ctx.shadowBlur = 10;
        ctx.restore();
        RR.UI.headline(ctx, 'PAUSED', W / 2, H * 0.32, 46, C.WB_WHITE, C.WB_BLUE);

        RR.UI.label(ctx, 'ESC / ENTER — RESUME', W / 2, H * 0.48, 16, 'rgba(223,227,230,0.85)', 500);
        RR.UI.label(ctx, 'Q — QUIT TO MENU', W / 2, H * 0.55, 16, 'rgba(223,227,230,0.62)', 500);
        RR.UI.label(ctx, 'M — TOGGLE SOUND (' + (RR.Audio.muted ? 'OFF' : 'ON') + ')', W / 2, H * 0.62, 16, 'rgba(223,227,230,0.62)', 500);
    }
};

RR.LevelCompleteScene = {
    time: 0,

    enter: function () {
        this.time = 0;
        RR.Audio.stopMusic();
        RR.Audio.play('horn', 0.8);
    },

    update: function (dt) {
        this.time += dt;
        if (this.time < 0.6) return;
        if (RR.Input.justPressed('Enter') || RR.Input.justPressed('Space') || RR.Input.clicked) {
            RR.Input.clicked = false;
            RR.Progress.level++;
            RR.Engine.changeScene(RR.RiverScene);
        }
        if (RR.Input.justPressed('Escape')) {
            RR.Progress.reset();
            RR.Engine.changeScene(RR.MenuScene);
        }
    },

    render: function (ctx) {
        var W = RR.Config.CANVAS_WIDTH;
        var H = RR.Config.CANVAS_HEIGHT;
        var C = RR.Config;
        var UI = RR.UI;
        var nextLevel = RR.Progress.level + 1;
        var currentRiver = RR.River.profile || RR.RiverLevels.get(RR.Progress.level);
        var nextRiver = RR.RiverLevels.get(nextLevel);

        UI.backdrop(ctx, W, H);
        UI.topRule(ctx, W);

        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';

        UI.headline(ctx, currentRiver.name + ' CLEARED', W / 2, H * 0.20, 46, C.WB_WHITE, C.WB_BLUE);
        UI.label(ctx, 'LEVEL ' + RR.Progress.level + ' · ' + RR.Difficulty.getSelected().label + ' · ' + currentRiver.location,
            W / 2, H * 0.29, 14, C.WB_BLUE, 600);

        var rows = [
            ['SCORE', String(RR.Scoring.getScore())],
            ['DISTANCE', Math.round(RR.Boat.distanceTraveled / RR.Config.SEGMENT_LENGTH) + ' m'],
            ['BOAT', RR.Boat.getModel().model],
            // Undamaged ceiling: getMaxSpeed() drops 18% once the Rogue is
            // damaged, so a damaged run could report over 100%.
            ['TOP SPEED', Math.round(100 * RR.Boat.maxSpeed /
                (RR.Config.MAX_SPEED * RR.Boat.getModel().speedMult)) + '%'],
            ['NEAR MISSES', String(RR.Boat.nearMisses)]
        ];
        var i, ry;
        for (i = 0; i < rows.length; i++) {
            ry = H * 0.42 + i * 34;
            ctx.fillStyle = i % 2 === 0 ? 'rgba(223,227,230,0.05)' : 'rgba(223,227,230,0.02)';
            ctx.fillRect(W * 0.30, ry - 14, W * 0.40, 28);
            ctx.fillStyle = C.WB_BLUE;
            ctx.fillRect(W * 0.30, ry - 14, 3, 28);
            UI.label(ctx, rows[i][0], W * 0.33, ry, 13, 'rgba(223,227,230,0.6)', 500, 'left');
            UI.label(ctx, rows[i][1], W * 0.67, ry, 15, C.WB_WHITE, 600, 'right');
        }

        UI.headline(ctx, 'NEXT: ' + nextRiver.name, W / 2, H * 0.66, 26, C.WB_BLUE, null);
        UI.label(ctx, nextRiver.location + ' · ' + nextRiver.tagline, W / 2, H * 0.72, 11, 'rgba(223,227,230,0.55)', 500);

        if (this.time > 0.6) {
            var flash = (Math.sin(this.time * 3) + 1) * 0.5;
            ctx.globalAlpha = 0.55 + flash * 0.45;
            UI.label(ctx, 'PRESS ENTER FOR LEVEL ' + nextLevel, W / 2, H * 0.85, 17, C.WB_WHITE, 600);
            ctx.globalAlpha = 1;
        }
        UI.label(ctx, 'ESC — BACK TO MENU', W / 2, H * 0.92, 12, 'rgba(223,227,230,0.4)', 500);
    }
};
