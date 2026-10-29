window.RR = window.RR || {};

RR.Renderer3D = {
    scene: null,
    camera: null,
    renderer: null,
    canvas3d: null,

    waterMesh: null,
    waterUniforms: null,
    bankLeftMesh: null,
    bankRightMesh: null,
    groundLeftMesh: null,
    groundRightMesh: null,
    boatGroup: null,
    wakeGroup: null,
    skyDome: null,
    sunLight: null,
    obstacleMeshPool: [],
    treeChunks: [],
    islandMeshPool: [],
    bearMeshPool: [],
    bearZonePool: [],
    salmonMeshPool: [],
    crocMeshPool: [],

    riverPath: [],
    riverNormals: [],
    treeData: [],

    CURVE_FACTOR: 0.01,
    SEG_LEN: 200,
    VISIBLE_SEGS_AHEAD: 120,
    VISIBLE_SEGS_BEHIND: 8,
    // Pulled back again on 2026-09-03, 45.2 -> 64, at Tyler's request: he wants
    // to SEE THE BACK OF THE BOAT with a little water behind it. At 45.2 the
    // transom ran off the bottom edge of the frame -- you got bow and mid-hull
    // and nothing astern. 58 clears the transom but leaves almost no water; 64
    // shows the full transom, the outboard, the prop wash and a clear band of
    // river behind, with the hull still the hero of the frame.
    //
    // HEIGHT IS ALWAYS HALF OF DIST. That 2:1 holds the down-angle at 26
    // degrees; change one without the other and the framing tips, which is a
    // different look, not a zoom. If this needs another nudge, move both.
    CAM_HEIGHT: 32,
    CAM_DIST: 64,
    CAM_SHOULDER: 0,
    CAM_LOOK_AHEAD: 15,
    // Picture slid up this many px (of 720) so the hull sits clear of the
    // JUMP pill. A lens shift: framing angle unchanged. See setViewOffset.
    CAM_SHIFT_UP: 40,
    // How much the aim point leads into a bend. 0 = dead along the chase axis
    // (hull perfectly upright on screen), 0.3 = the old behaviour that made it
    // look permanently crabbed. See the note at the lookAt call.
    CAM_LOOK_BLEND: 0.08,
    // 0 = the camera tracks the CHANNEL only and does not swing with the helm.
    // This is the original dead-astern design and it is the right one. With the
    // heading sign fixed, measured over a piloted run:
    //
    //   follow 1.00 -> hull 0.6 deg mean, but the world spins at 196 deg/s
    //   follow 0.75 -> hull 0.9 deg mean, world 150 deg/s
    //   follow 0.00 -> hull 2.1 deg mean, world 36 deg/s
    //
    // The hull is already essentially straight at 0, and the 14 deg it reaches
    // in a hard turn IS the steering angle -- it should be visible. Following
    // the bow buys a fraction of a degree of hull angle and costs a camera that
    // whips around; that is what made the 62% follow feel disorienting in the
    // 2026-08-31 pass. Leave this at 0 unless Tyler asks otherwise.
    CAM_FOLLOW_BOW: 0.0,
    // 25, not 8. Screen yaw IS (boat yaw - camera yaw), so any lag here shows
    // up as the hull sitting crooked. At 8 fast helm work read 12 deg of hull
    // angle; at 25 it is 5. The easing you see comes from the bow's own
    // STEER_RESPONSE, which is already smoothed.
    CAM_YAW_SMOOTH: 25.0,
    RIVER_SCALE: RR.Config.WORLD_SCALE,
    // Half-width of the sun's shadow box, and how far ahead of the hull it
    // rides. 300 covers the channel (~102 half width) plus the bank timber
    // (out to ~200 beyond the waterline) with 2048 texels across it, which is
    // ~0.29 units per texel -- fine enough for a trunk.
    SHADOW_EXTENT: 300,
    SHADOW_LEAD: 120,
    BANK_WIDTH: 30,
    TREE_SPREAD: 60,

    ready: false,

    init: function () {
        this.canvas3d = document.getElementById('glCanvas');
        if (!this.canvas3d) {
            this.canvas3d = document.createElement('canvas');
            this.canvas3d.id = 'glCanvas';
            this.canvas3d.width = RR.Config.CANVAS_WIDTH;
            this.canvas3d.height = RR.Config.CANVAS_HEIGHT;
            document.body.insertBefore(this.canvas3d, document.body.firstChild);
        }

        // RR.Config.LITE: phones and tablets (set by CORE/touch.js before this
        // runs). No antialiasing, no shadows, pixel ratio 1, fewer and simpler
        // trees -- smooth frame rate and less battery on a phone GPU.
        var LITE = !!RR.Config.LITE;
        this.renderer = new THREE.WebGLRenderer({
            canvas: this.canvas3d,
            antialias: !LITE,
            alpha: false
        });
        // updateStyle=false: without it Three.js writes inline width/height
        // onto glCanvas, which then no longer lines up with the 2D HUD canvas
        // stacked on top of it -- you'd see the 3D scene peeking out above and
        // below every menu and overlay.
        this.renderer.setSize(RR.Config.CANVAS_WIDTH, RR.Config.CANVAS_HEIGHT, false);
        // Sharper 3D on modern displays without doubling the GPU cost.
        this.renderer.setPixelRatio((LITE || RR.Config.MOBILE) ? 1 : Math.min(window.devicePixelRatio || 1, 1.5));
        // ---- SHADOWS ------------------------------------------------------
        // There were NONE in this renderer -- castShadow, receiveShadow and
        // shadowMap did not appear once in 3,954 lines. A Godot spike on
        // 2026-09-03 made that obvious: the single biggest "this is real"
        // difference in its frames was tree shadows lying across the gravel,
        // and that is a feature three.js has always had here.
        //
        // Affordable only because the trees are instanced now: the shadow pass
        // re-renders every caster, which at ~2,000 per-tree draw calls would
        // have doubled a frame that was already the bottleneck.
        //
        // index.html?shadows=0 turns them off, for an honest A/B and as an
        // escape hatch on slower hardware.
        RR.Config.SHADOWS = !LITE;
        try {
            if (/[?&]shadows=0\b/.test(window.location.search)) RR.Config.SHADOWS = false;
        } catch (e) {}
        this.renderer.shadowMap.enabled = RR.Config.SHADOWS;
        this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;

        this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
        // COLOUR SPACE. The bundled three.js is r150, which has no
        // outputColorSpace property at all -- it uses outputEncoding. Setting
        // the newer field was a silent no-op, so the ACES-tone-mapped image was
        // written to the framebuffer without the sRGB transfer and the whole
        // game rendered dark and muddy compared with the palette it was authored
        // against. Feature-test the PROPERTY, not the constant, so this keeps
        // working if three.js is ever upgraded.
        if ('outputColorSpace' in this.renderer && THREE.SRGBColorSpace !== undefined) {
            this.renderer.outputColorSpace = THREE.SRGBColorSpace;
        } else if (THREE.sRGBEncoding !== undefined) {
            this.renderer.outputEncoding = THREE.sRGBEncoding;
        }

        // ---- COLOUR MANAGEMENT: ON ------------------------------------------
        //
        // Tyler's call, 2026-09-03, made after driving both versions.
        //
        // r150 ships THREE.ColorManagement.enabled = false, which hands every
        // authored hex to the shader AS IF IT WERE ALREADY LINEAR. #BC8D72
        // went in as (0.737,0.553,0.447) instead of (0.511,0.272,0.170) --
        // about 45% too bright in red with the channel separation crushed.
        // That was the milky, washed-out look across the whole game, and the
        // white hallway where the Grand Canyon should have been.
        //
        // This only works because both custom shaders now close their main()
        // through _closeFrag, which puts the water and the sky dome in the
        // pipeline for the first time. Before that they wrote raw to the
        // framebuffer, so decoding their input without encoding their output
        // sent the Colorado near black -- see the long note on _closeFrag.
        // Two shader lines instead of re-grading 182 palette hexes.
        //
        // Everything that had to move with it:
        //   - the canyon strata drop their local convertSRGBToLinear, which is
        //     a SECOND decode now (_createCanyonWalls);
        //   - the water uniforms go through THREE.Color like everything else,
        //     instead of the raw hold the preview flag used;
        //   - canvas textures declare sRGB (_tagTexturesSRGB);
        //   - toneMappingExposure came DOWN from 1.1 to 0.85, measured, not
        //     guessed. Driving known hexes through the (unlit) sky shader and
        //     reading the pixel back: at 1.1 every mid-tone was LIFTED
        //     (#808080 -> #949494, #bc8d72 -> #cca588) and light blues went
        //     grey, so the corrected palette arrived paler than the broken one.
        //     At 0.85 the same path renders the authored palette as itself
        //     (#808080 -> #818181, #bc8d72 -> #bc9275, #4a8ac4 -> #458cbe)
        //     while darks deepen and gain saturation -- which is the whole
        //     point of the change. Exposure had to move with the switch
        //     because ACES divides it by 0.6 internally, so 1.1 was really a
        //     1.83x multiplier sitting on top of a now-correct albedo;
        //   - the water shader's three hard-coded GLSL literals were decoded
        //     by hand (WATER_LITERALS); no colour switch can reach a vec3.
        //
        // index.html?cm=0 restores the genuine old look for comparison. It is
        // a real restore, not a hybrid: the shader includes, the texture tags,
        // the canyon compensation, the exposure and the water literals all
        // follow the flag.
        RR.Config.COLOR_MANAGED = true;
        try {
            if (/[?&]cm=0\b/.test(window.location.search)) RR.Config.COLOR_MANAGED = false;
        } catch (e) {}
        if (THREE.ColorManagement) {
            // .enabled is the r150 API. Setting .legacyMode as well was
            // harmless but this build warns about it on every single load
            // ("legacyMode=false renamed to enabled=true in r150"), which is
            // noise in a console that has to stay readable for diagnosis.
            THREE.ColorManagement.enabled = RR.Config.COLOR_MANAGED;
        }
        // Exposure follows the flag -- see the note above.
        this.renderer.toneMappingExposure = RR.Config.COLOR_MANAGED ? 0.85 : 1.1;

        this.scene = new THREE.Scene();
        this.scene.fog = new THREE.FogExp2(0x9ABBA8, 0.0015);

        this.camera = new THREE.PerspectiveCamera(58, 1280 / 720, 1, 4000);
        // LENS SHIFT, not a re-aim (Tyler, 2026-10-28: "move the boat a touch
        // higher" so the JUMP pill clears the stern). Slides the picture up
        // CAM_SHIFT_UP px of the 720 frame; the chase angle, the 2:1 framing
        // and the upright-hull aim below are all untouched. The water
        // reflections copy this projection, so they shift with it.
        this.camera.setViewOffset(1280, 720, 0, this.CAM_SHIFT_UP, 1280, 720);
        this.camera.position.set(0, this.CAM_HEIGHT, -this.CAM_DIST);
        this.camera.lookAt(0, 5, this.CAM_LOOK_AHEAD);

        this._createLights();
        this._createSky();
        this._createMountains();
        this._createBoat();
        this._createWake();

        this.ready = true;
    },

    buildRiverPath: function () {
        var segs = RR.River.segments;
        var S = this.RIVER_SCALE;
        var heading = 0;
        var px = 0, pz = 0;
        this.riverPath = [];
        this.riverNormals = [];

        for (var i = 0; i < segs.length; i++) {
            heading += segs[i].curve * this.CURVE_FACTOR;
            var dx = Math.sin(heading) * this.SEG_LEN * S;
            var dz = Math.cos(heading) * this.SEG_LEN * S;
            this.riverPath.push({
                x: px, z: pz,
                heading: heading,
                width: segs[i].width * RR.Config.BASE_RIVER_HALF_WIDTH * S * 2,
                seg: segs[i]
            });
            var nx = -Math.cos(heading);
            var nz = Math.sin(heading);
            this.riverNormals.push({ x: nx, z: nz });
            px += dx;
            pz += dz;
        }
        this.riverPath.push({ x: px, z: pz, heading: heading, width: this.riverPath[this.riverPath.length - 1].width, seg: segs[segs.length - 1] });
        this.riverNormals.push(this.riverNormals[this.riverNormals.length - 1]);
    },

    // Finish gate: two posts on the banks with a banner across, dropped in
    // where the river has pinched down near the head of navigation.
    // Race banner: checkered flag top and bottom with FINISH across the
    // middle. Drawn once and cached -- it is the same on every river.
    //
    // Aspect matters here. The banner plane is span x 9 world units and span
    // is ~55, so the texture is drawn at roughly that ratio (1024x168) or the
    // squares come out as rectangles and the wordmark stretches.
    _makeFinishTexture: function () {
        if (this._finishTex) return this._finishTex;

        var W = 1024, H = 168;
        var c = document.createElement('canvas');
        c.width = W; c.height = H;
        var x = c.getContext('2d');

        x.fillStyle = RR.Config.WB_BLUE;
        x.fillRect(0, 0, W, H);

        // Checkered bands top and bottom. sq is chosen so the band is exactly
        // two squares deep and the row count divides W evenly.
        var sq = 21, cols = Math.round(W / sq);
        sq = W / cols;
        var band = sq * 2, row, col;
        for (row = 0; row < 2; row++) {
            for (col = 0; col < cols; col++) {
                x.fillStyle = ((row + col) % 2 === 0) ? '#FFFFFF' : '#15181B';
                x.fillRect(col * sq, row * sq, sq, sq);                 // top
                x.fillRect(col * sq, H - band + row * sq, sq, sq);      // bottom
            }
        }

        // FINISH, white, tracked out across the middle.
        var mid = H / 2;
        x.textAlign = 'center';
        x.textBaseline = 'middle';
        x.font = 'bold 62px ' + RR.Config.FONT_DISPLAY;
        var text = 'FINISH', track = 14, i, ch;
        var widths = [], total = 0;
        for (i = 0; i < text.length; i++) { widths[i] = x.measureText(text[i]).width; total += widths[i]; }
        total += track * (text.length - 1);
        var cx = W / 2 - total / 2;
        x.shadowColor = 'rgba(0,0,0,0.55)';
        x.shadowBlur = 8;
        x.fillStyle = '#FFFFFF';
        for (i = 0; i < text.length; i++) {
            ch = text[i];
            x.fillText(ch, cx + widths[i] / 2, mid + 2);
            cx += widths[i] + track;
        }

        var t = new THREE.CanvasTexture(c);
        if (THREE.SRGBColorSpace !== undefined) t.colorSpace = THREE.SRGBColorSpace;
        else if (THREE.sRGBEncoding !== undefined) t.encoding = THREE.sRGBEncoding;
        t.anisotropy = 4;
        t._rrShared = true;          // memoized -- see _disposeGroup
        this._finishTex = t;
        return t;
    },

    // A weathered board with red paint on it. Hand-lettered look: the text is
    // drawn twice with a small offset so the edges are ragged rather than
    // crisp vector type, which is what sells it as painted rather than printed.
    _makeSignTexture: function (text) {
        this._signTex = this._signTex || {};
        if (this._signTex[text]) return this._signTex[text];

        var W = 512, H = 160;
        var c = document.createElement('canvas');
        c.width = W; c.height = H;
        var x = c.getContext('2d');

        // Weathered cedar
        x.fillStyle = '#8A6F4E';
        x.fillRect(0, 0, W, H);
        var i, y;
        for (i = 0; i < 90; i++) {
            y = Math.random() * H;
            x.strokeStyle = 'rgba(60,42,26,' + (0.05 + Math.random() * 0.13) + ')';
            x.lineWidth = 0.6 + Math.random() * 2.2;
            x.beginPath();
            x.moveTo(0, y);
            x.bezierCurveTo(W * 0.33, y + (Math.random() - 0.5) * 7,
                            W * 0.66, y + (Math.random() - 0.5) * 7, W, y);
            x.stroke();
        }
        // Board edges, darker where it has weathered
        x.strokeStyle = 'rgba(48,33,20,0.55)';
        x.lineWidth = 7;
        x.strokeRect(3.5, 3.5, W - 7, H - 7);

        // Red paint, twice with a jitter so the edge is not machine-clean
        var size = text.length > 12 ? 52 : 62;
        x.textAlign = 'center';
        x.textBaseline = 'middle';
        x.font = 'bold ' + size + 'px ' + RR.Config.FONT_DISPLAY;
        x.fillStyle = 'rgba(150,26,20,0.92)';
        x.fillText(text, W / 2 + 1.5, H / 2 + 2);
        x.fillStyle = '#C4241C';
        x.fillText(text, W / 2, H / 2);

        var t = new THREE.CanvasTexture(c);
        if (THREE.SRGBColorSpace !== undefined) t.colorSpace = THREE.SRGBColorSpace;
        else if (THREE.sRGBEncoding !== undefined) t.encoding = THREE.sRGBEncoding;
        t.anisotropy = 4;
        t._rrShared = true;          // memoized -- see _disposeGroup
        this._signTex[text] = t;
        return t;
    },

    // Checkpoint signs nailed to a big tree on the bank. Half way, then almost
    // there. Both face downstream, at the boat -- like the finish banner, the
    // back of a plane shows its texture mirrored, so the +PI matters.
    _createCheckpointSigns: function () {
        if (this.checkpointSigns) {
            this._disposeGroup(this.checkpointSigns);
            this.scene.remove(this.checkpointSigns);
            this.checkpointSigns = null;
        }
        if (!RR.River.finishSegment) return;

        var g = new THREE.Group();
        var SEG = RR.Config.SEGMENT_LENGTH;
        var barkMat = new THREE.MeshStandardMaterial({ color: 0x4A3A2A, roughness: 0.92 });
        var canopyMat = new THREE.MeshStandardMaterial({ color: 0x35502A, roughness: 0.95 });
        var self = this;

        var marks = [
            { at: 0.50, text: 'HALF WAY THERE', side: -1 },
            { at: 0.90, text: 'ALMOST THERE',   side:  1 }
        ];

        marks.forEach(function (m) {
            var segIdx = Math.floor(RR.River.finishSegment * m.at);
            // Close in to the waterline. Further out and the sign sits behind
            // the bank timber where you never see it.
            var p = self.getWorldPos(segIdx * SEG, m.side * 1.05);
            var ahead = self.getWorldPos((segIdx + 6) * SEG, m.side * 1.05);
            var facing = Math.atan2(ahead.x - p.x, ahead.z - p.z);

            // DELIBERATELY OVERSIZED. This is a landmark, not scenery -- it
            // has to read as "the halfway tree" from mid-channel at speed, so
            // it is roughly three times the trunk and twice the height of the
            // bank timber around it. Do not "fix" it to match the other trees.
            var trunkH = 52;
            var trunk = new THREE.Mesh(
                new THREE.CylinderGeometry(4.2, 6.5, trunkH, 10), barkMat);
            trunk.position.set(p.x, trunkH * 0.5, p.z);
            g.add(trunk);

            var canopy = new THREE.Mesh(new THREE.SphereGeometry(21, 10, 7), canopyMat);
            canopy.position.set(p.x, trunkH + 7, p.z);
            canopy.scale.set(1, 0.80, 1);
            g.add(canopy);
            var canopy2 = new THREE.Mesh(new THREE.SphereGeometry(15, 9, 6), canopyMat);
            canopy2.position.set(p.x + 9, trunkH - 6, p.z + 5);
            canopy2.scale.set(1, 0.78, 1);
            g.add(canopy2);

            // The board, nailed on facing downstream at eye level from a boat.
            // Sized to read from mid-channel at speed, which is the only
            // place and pace anyone will ever see it from.
            var boardW = 46, boardH = boardW * (160 / 512);
            var board = new THREE.Mesh(
                new THREE.PlaneGeometry(boardW, boardH),
                new THREE.MeshBasicMaterial({
                    map: self._makeSignTexture(m.text),
                    side: THREE.DoubleSide
                }));
            // Stand it just off the trunk on the river side.
            var off = 6.4;
            board.position.set(p.x, 17, p.z);
            board.rotation.y = facing + Math.PI;
            board.translateZ(off);
            g.add(board);

            // Two nail heads, because a board with no fixings reads as floating.
            var nailMat = new THREE.MeshStandardMaterial({ color: 0x2A2A28, roughness: 0.6 });
            [-boardW * 0.36, boardW * 0.36].forEach(function (nx) {
                var nail = new THREE.Mesh(new THREE.SphereGeometry(0.62, 6, 5), nailMat);
                nail.position.copy(board.position);
                nail.translateX(0);
                nail.position.x += Math.cos(facing) * nx;
                nail.position.z += -Math.sin(facing) * nx;
                nail.position.y = 17 + boardH * 0.30;
                g.add(nail);
            });
        });

        this.checkpointSigns = g;
        this.scene.add(g);
    },

    // Grand Canyon walls, Colorado only. Stacked blocks rather than a smooth
    // cliff, which suits the game's blocky art and reads as bedded strata --
    // that layering IS the Grand Canyon, a plain wall does not look like it.
    //
    // Built every 11 segments per bank at 3 blocks each. That is ~1400 meshes
    // over the whole course, in the same range as the Nile's palms. Going
    // denser will cost frames for no visual gain: the blocks are big.
    // ------------------------------------------------------------------
    // RIVER LANDMARKS -- what makes each real river that river.
    //
    // Researched per stop rather than invented; sources are listed against each
    // profile in RIVER-LEVELS.js. Everything here is DECORATION: it is all
    // placed beyond lateral 1.0, outside the navigable channel, carries no
    // collision, and no gameplay value reads from it. That is deliberate --
    // Tyler asked for scene setting "without messing up any game play".
    // ------------------------------------------------------------------
    // Free a group's GPU resources before dropping it.
    //
    // buildScene runs TWICE per attempt (LaunchScene.enter then
    // RiverScene.enter) and every scenery group used to be scene.remove()'d
    // without disposing, so each run orphaned the previous run's geometry and
    // materials on the GPU. Touring the eight rivers twice leaked every palm,
    // temple, karst tower, castle and hippo built along the way.
    _disposeGroup: function (obj) {
        if (!obj) return;
        obj.traverse(function (o) {
            // _rrShared now also guards GEOMETRY and MATERIALS, not just the
            // memoized canvas textures below. The instanced tree chunks all
            // point at one canopy quad, one trunk cylinder and one set of eight
            // materials, so freeing them per chunk would free the exact objects
            // the next 44 chunks are still drawing with. _createTreeInstances
            // owns them and disposes them once, in _disposeTreeChunks.
            if (o.geometry && o.geometry.dispose && !o.geometry._rrShared) o.geometry.dispose();
            var m = o.material;
            if (!m) return;
            (Array.isArray(m) ? m : [m]).forEach(function (mm) {
                if (!mm || mm._rrShared) return;
                // NEVER free a MEMOIZED texture. Four canvas textures in this
                // file are built once and handed back from a cache forever:
                // the finish banner (_finishTex), the two checkpoint sign
                // boards (_signTex), the tree line (_treeLineTex) and the
                // canopy (_canopyTex). buildScene runs twice per attempt, so
                // disposing them here freed the exact object the very next
                // builder was about to reuse. THREE happens to re-upload from
                // the still-live canvas on the next render, which is why the
                // signs did not visibly break -- but it is a free GPU
                // round-trip per build and one refactor away from blank
                // boards. Anything tagged _rrShared is owned by its cache.
                if (mm.map && mm.map.dispose && mm.map.isCanvasTexture &&
                        !mm.map._rrShared) mm.map.dispose();
                if (mm.dispose) mm.dispose();
            });
        });
    },

    _createLandmarks: function () {
        if (this.landmarks) {
            this._disposeGroup(this.landmarks);
            this.scene.remove(this.landmarks);
            this.landmarks = null;
        }
        var prof = RR.River.profile;
        if (!prof) return;
        var g = new THREE.Group();
        var SEG = this.SEG_LEN;
        var self = this;
        var segCount = RR.River.segments.length;
        function rnd(i, k) {
            return Math.abs(Math.sin(i * 12.9898 + k * 78.233) * 43758.5453) % 1;
        }

        // --- WATERFALL on the horizon --------------------------------------
        // Snoqualmie Falls (268 ft, semicircular andesite cliff) for the home
        // water; Victoria Falls for the Zambezi, where the river drops into the
        // Batoka Gorge and throws mist hundreds of metres up.
        if (prof.waterfall) {
            var wf = prof.waterfall;
            var rockMat = new THREE.MeshStandardMaterial({ color: wf.rock || 0x5A5750, roughness: 0.97 });
            var waterMat = new THREE.MeshStandardMaterial({
                color: 0xE8F2F6, roughness: 0.35, transparent: true, opacity: 0.92 });
            var mistMat = new THREE.MeshBasicMaterial({
                color: 0xF2F7FA, transparent: true, opacity: 0.30, depthWrite: false });
            var fg = new THREE.Group();
            // the cliff the falls come over
            var cliff = new THREE.Mesh(new THREE.CylinderGeometry(wf.width, wf.width * 1.15, wf.height, 20, 1, true,
                                        Math.PI * 0.15, Math.PI * 0.7), rockMat);
            cliff.position.y = wf.height * 0.5;
            fg.add(cliff);
            // the sheet of water
            var sheet = new THREE.Mesh(new THREE.PlaneGeometry(wf.width * 1.25, wf.height * 0.96), waterMat);
            sheet.position.set(0, wf.height * 0.48, wf.width * 0.92);
            fg.add(sheet);
            // mist at the base
            for (var mi = 0; mi < 5; mi++) {
                var mist = new THREE.Mesh(
                    new THREE.PlaneGeometry(wf.width * (1.3 + mi * 0.22), wf.height * (0.30 + mi * 0.12)), mistMat);
                mist.position.set((rnd(mi, 3) - 0.5) * wf.width * 0.5,
                                  wf.height * (0.12 + mi * 0.06), wf.width * (1.0 + mi * 0.10));
                fg.add(mist);
            }
            fg.position.set(wf.x, 0, 0);
            fg.userData.horizon = true;      // re-parked ahead of the boat each frame
            fg.userData.oz = wf.z;
            fg.userData.ox0 = wf.x;
            g.add(fg);
            this._waterfallGroup = fg;
        } else { this._waterfallGroup = null; }

        // --- LIMESTONE KARST, Mekong ---------------------------------------
        // Nong Khiaw and the Nam Ou: sheer limestone towers straight out of the
        // water, forested on top.
        if (prof.karst) {
            var karstMat = new THREE.MeshStandardMaterial({ color: 0x8A8A80, roughness: 0.96 });
            var karstTop = new THREE.MeshStandardMaterial({ color: 0x46603A, roughness: 0.92 });
            for (var ki = 120; ki < segCount - 100; ki += 70) {
                for (var kside = -1; kside <= 1; kside += 2) {
                    if (rnd(ki, kside + 5) < 0.42) continue;
                    var klat = kside * (1.5 + rnd(ki, 7) * 0.9);
                    var kwp = this.getWorldPos(ki * SEG, klat);
                    var kh = 90 + rnd(ki, 9) * 130;
                    var kr = 18 + rnd(ki, 11) * 22;
                    var tower = new THREE.Mesh(new THREE.CylinderGeometry(kr * 0.55, kr, kh, 7), karstMat);
                    tower.position.set(kwp.x, kh * 0.5, kwp.z);
                    tower.rotation.y = rnd(ki, 13) * 3;
                    g.add(tower);
                    var cap = new THREE.Mesh(new THREE.SphereGeometry(kr * 0.62, 7, 5), karstTop);
                    cap.position.set(kwp.x, kh + kr * 0.16, kwp.z);
                    cap.scale.y = 0.5;
                    g.add(cap);
                }
            }
        }

        // --- STILT VILLAGES, Mekong ----------------------------------------
        if (prof.stiltVillages) {
            var hutMat = new THREE.MeshStandardMaterial({ color: 0xA98D63, roughness: 0.95 });
            var roofMat = new THREE.MeshStandardMaterial({ color: 0x7A5230, roughness: 0.95 });
            var poleMat = new THREE.MeshStandardMaterial({ color: 0x6B5638, roughness: 0.96 });
            for (var vi = 200; vi < segCount - 120; vi += 240) {
                var vside = rnd(vi, 17) < 0.5 ? -1 : 1;
                for (var hut = 0; hut < 4; hut++) {
                    var hlat = vside * (1.08 + rnd(vi, 19 + hut) * 0.22);
                    var hwp = this.getWorldPos((vi + hut * 9) * SEG, hlat);
                    var hy = 7 + rnd(vi, 29 + hut) * 3;
                    for (var pl = 0; pl < 4; pl++) {
                        var pole = new THREE.Mesh(new THREE.CylinderGeometry(0.5, 0.5, hy, 5), poleMat);
                        pole.position.set(hwp.x + (pl % 2 ? 3.4 : -3.4), hy * 0.5, hwp.z + (pl < 2 ? 3.0 : -3.0));
                        g.add(pole);
                    }
                    var body = new THREE.Mesh(new THREE.BoxGeometry(9, 5.5, 8), hutMat);
                    body.position.set(hwp.x, hy + 2.6, hwp.z);
                    body.rotation.y = hwp.heading;
                    g.add(body);
                    var roof = new THREE.Mesh(new THREE.ConeGeometry(7.6, 4.4, 4), roofMat);
                    roof.position.set(hwp.x, hy + 7.2, hwp.z);
                    roof.rotation.y = hwp.heading + Math.PI / 4;
                    g.add(roof);
                }
            }
        }

        // --- CASTLES AND VINEYARD TERRACES, Rhine --------------------------
        // Over 40 medieval castles in 65 km, the highest concentration on
        // earth, on clifftops above terraced Riesling vineyards.
        if (prof.castles) {
            var stone = new THREE.MeshStandardMaterial({ color: 0x9A9086, roughness: 0.95 });
            var slate = new THREE.MeshStandardMaterial({ color: 0x4A4A52, roughness: 0.9 });
            var vine  = new THREE.MeshStandardMaterial({ color: 0x6C7F42, roughness: 0.92 });
            for (var ci2 = 150; ci2 < segCount - 120; ci2 += 165) {
                var cside = rnd(ci2, 31) < 0.5 ? -1 : 1;
                var cwp = this.getWorldPos(ci2 * SEG, cside * 1.95);
                var baseY = 96 + rnd(ci2, 33) * 60;
                // keep -- a squat hall with corner towers
                var keep = new THREE.Mesh(new THREE.BoxGeometry(20, 20, 15), stone);
                keep.position.set(cwp.x, baseY + 10, cwp.z);
                keep.rotation.y = cwp.heading;
                g.add(keep);
                for (var tw = 0; tw < 3; tw++) {
                    var th = 26 + rnd(ci2, 41 + tw) * 16;
                    var tower2 = new THREE.Mesh(new THREE.CylinderGeometry(4.4, 5.0, th, 8), stone);
                    tower2.position.set(cwp.x + (tw - 1) * 13, baseY + th * 0.5, cwp.z + (tw === 1 ? -8 : 6));
                    g.add(tower2);
                    var spire = new THREE.Mesh(new THREE.ConeGeometry(5.6, 11, 8), slate);
                    spire.position.set(tower2.position.x, baseY + th + 5.5, tower2.position.z);
                    g.add(spire);
                }
                // vineyard terraces stepping down toward the water
                for (var tr = 0; tr < 7; tr++) {
                    // Start at 1.30, not 1.12: a 70-unit slab beginning at 1.12
                    // hung over water the hull reaches on HARD, where the
                    // channel is narrowest.
                    var tlat = cside * (1.30 + tr * 0.11);
                    var twp = this.getWorldPos((ci2 + tr * 2) * SEG, tlat);
                    var ter = new THREE.Mesh(new THREE.BoxGeometry(46, 2.2, 15), vine);
                    ter.position.set(twp.x, baseY * (tr + 1) / 8, twp.z);
                    ter.rotation.y = twp.heading;
                    g.add(ter);
                }
            }
        }

        // --- RIVERBOATS, Amazon --------------------------------------------
        if (prof.riverboats) {
            var hullMat = new THREE.MeshStandardMaterial({ color: 0xC9C3B4, roughness: 0.9 });
            var deckMat = new THREE.MeshStandardMaterial({ color: 0x2E6E86, roughness: 0.88 });
            for (var ri = 230; ri < segCount - 150; ri += 300) {
                var rside = rnd(ri, 53) < 0.5 ? -1 : 1;
                var rwp = this.getWorldPos(ri * SEG, rside * 1.02);
                var boatHull = new THREE.Mesh(new THREE.BoxGeometry(11, 4.5, 34), hullMat);
                boatHull.position.set(rwp.x, 2.0, rwp.z);
                boatHull.rotation.y = rwp.heading;
                g.add(boatHull);
                for (var dk = 0; dk < 2; dk++) {
                    var deck = new THREE.Mesh(new THREE.BoxGeometry(10, 4.0, 26 - dk * 6), dk ? hullMat : deckMat);
                    deck.position.set(rwp.x, 6.4 + dk * 4.2, rwp.z);
                    deck.rotation.y = rwp.heading;
                    g.add(deck);
                }
            }
        }

        // --- HIPPOS, Zambezi ------------------------------------------------
        // "hippos wallowing in shallow bays" -- they sit in the margins, not
        // the channel, and like everything here they are decoration only.
        if (prof.hippos) {
            var hipMat = new THREE.MeshStandardMaterial({ color: 0x6E5A58, roughness: 0.9 });
            for (var hi2 = 160; hi2 < segCount - 120; hi2 += Math.max(40, Math.floor(segCount / prof.hippos))) {
                var hside = rnd(hi2, 61) < 0.5 ? -1 : 1;
                var hwp2 = this.getWorldPos(hi2 * SEG, hside * (0.90 + rnd(hi2, 63) * 0.16));
                var pod = 1 + Math.floor(rnd(hi2, 67) * 3);
                // Pod offsets rotated into the CHANNEL frame. Laid out in world
                // X they drifted into the navigable channel wherever the river
                // happened to run north-south -- measured at lateral 0.785 on
                // the Zambezi against a hull that reaches 0.842 on HARD.
                var hca = Math.cos(hwp2.heading), hsa = Math.sin(hwp2.heading);
                for (var hp = 0; hp < pod; hp++) {
                    var along = rnd(hi2, 71 + hp) * 9;
                    // Outward-only. Rotating the pod into the channel frame
                    // fixed the north-south drift but left the inboard member
                    // of a 3-hippo pod 7.5 units INSIDE the base lateral --
                    // measured at 0.80 against a hull that reaches 0.842 on
                    // HARD. Every member now steps toward its own bank.
                    var across = -hside * hp * 7.5;
                    var back = new THREE.Mesh(new THREE.SphereGeometry(3.1, 8, 6), hipMat);
                    back.position.set(hwp2.x + hca * across + hsa * along, -0.6,
                                      hwp2.z - hsa * across + hca * along);
                    back.scale.set(1.5, 0.62, 1.0);
                    g.add(back);
                    var head = new THREE.Mesh(new THREE.SphereGeometry(1.7, 7, 6), hipMat);
                    head.position.set(back.position.x + hsa * 4.6, 0.1, back.position.z + hca * 4.6);
                    head.scale.set(1.2, 0.7, 1.0);
                    g.add(head);
                }
            }
        }

        // --- REGIONAL WILDLIFE -------------------------------------------
        // A handful of the animal you would actually see from a boat on that
        // river. Same rule as everything else in here: bank or margin only,
        // beyond the navigable channel, no collision, no gameplay effect.
        if (prof.fauna) {
            var fa = prof.fauna;
            var faunaMat = {};
            function fmat(c, rough) {
                if (!faunaMat[c]) faunaMat[c] = new THREE.MeshStandardMaterial(
                    { color: c, roughness: rough === undefined ? 0.9 : rough });
                return faunaMat[c];
            }
            // body + head, the shape most four-legged animals reduce to at this
            // distance; wings for the perched birds; a back for the swimmers.
            function beast(x, z, head, opt) {
                var b = new THREE.Group();
                var body = new THREE.Mesh(new THREE.SphereGeometry(1, 8, 6), fmat(opt.body));
                body.scale.set(opt.len, opt.tall, opt.wide);
                body.position.y = opt.tall * 0.95;
                b.add(body);
                if (head) {
                    var hd = new THREE.Mesh(new THREE.SphereGeometry(1, 7, 6), fmat(opt.head || opt.body));
                    hd.scale.setScalar(opt.tall * 0.55);
                    hd.position.set(opt.len * 0.85, opt.tall * (opt.headUp || 1.35), 0);
                    b.add(hd);
                }
                if (opt.legs) {
                    for (var lg = 0; lg < 4; lg++) {
                        var leg = new THREE.Mesh(
                            new THREE.CylinderGeometry(opt.tall * 0.13, opt.tall * 0.13, opt.tall * 0.95, 5),
                            fmat(opt.body));
                        leg.position.set(opt.len * (lg < 2 ? 0.5 : -0.5), opt.tall * 0.45,
                                         opt.wide * (lg % 2 ? 0.55 : -0.55));
                        b.add(leg);
                    }
                }
                b.position.set(x, opt.y || 0, z);
                return b;
            }
            // count is a COUNT, not a divisor. Dividing the whole segment span
            // by it and then walking only 140..segCount-110 placed about two
            // fewer animals than the profile asked for on every river.
            var faLo = 140, faHi = segCount - 110;
            var faN = Math.max(1, fa.count || 14);
            var fi, fside, fwp;
            var spacing = Math.max(45, Math.floor((faHi - faLo) / Math.max(1, faN - 1)));
            for (fi = faLo; fi <= faHi; fi += spacing) {
                fside = rnd(fi, 83) < 0.5 ? -1 : 1;
                var inWater = fa.inWater && rnd(fi, 87) < 0.35;
                // 0.86 put a dolphin's CENTRE outside the hull's 0.842 reach
                // but not its body: the body sphere is scaled to len (3.6 for
                // the dolphin) and yawed at random, so it reached lateral 0.80
                // and swam through the hull. 0.94 clears the widest of them
                // with the boat pinned on the edge stop.
                var flat = inWater ? fside * (0.94 + rnd(fi, 89) * 0.10)
                                   : fside * (1.10 + rnd(fi, 91) * 0.30);
                fwp = this.getWorldPos(fi * SEG, flat);
                var kind = fa.kind;
                var grp;
                if (kind === 'eagle') {
                    // perched on a bleached snag over the water
                    // Standing dead timber over the water. This was a
                    // hard-coded pale grey-tan (0xA79C88) that no palette edit
                    // could reach, and with 16 of them on the home water they
                    // were most of why Tyler saw grey poles in the river.
                    var snagCol = (prof.colors && prof.colors.wood) || 0x895129;
                    var snag = new THREE.Mesh(new THREE.CylinderGeometry(0.5, 0.9, 16, 6), fmat(snagCol, 0.96));
                    snag.position.set(fwp.x, 8, fwp.z);
                    snag.rotation.z = (rnd(fi, 93) - 0.5) * 0.3;
                    g.add(snag);
                    grp = beast(fwp.x, fwp.z, true,
                        { body: 0x4A3A2A, head: 0xF2F0EA, len: 1.5, tall: 1.5, wide: 1.1, y: 15.4 });
                } else if (kind === 'dolphin') {
                    // a pink river dolphin's back breaking the surface
                    grp = beast(fwp.x, fwp.z, false,
                        { body: 0xD9A0AA, len: 3.6, tall: 1.0, wide: 1.3, y: -0.5 });
                    var fin = new THREE.Mesh(new THREE.ConeGeometry(0.9, 2.2, 5), fmat(0xD9A0AA));
                    fin.position.set(fwp.x, 1.5, fwp.z);
                    g.add(fin);
                } else if (kind === 'swan') {
                    grp = beast(fwp.x, fwp.z, true,
                        { body: 0xF4F4F0, head: 0xF4F4F0, len: 2.0, tall: 1.2, wide: 1.4,
                          y: -0.3, headUp: 2.6 });
                } else if (kind === 'elephant') {
                    grp = beast(fwp.x, fwp.z, true,
                        { body: 0x8A8078, len: 6.4, tall: 5.2, wide: 3.4, legs: true });
                    var trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.5, 0.9, 6.5, 6), fmat(0x8A8078));
                    trunk.position.set(fwp.x + 6.2, 5.0, fwp.z);
                    g.add(trunk);
                } else if (kind === 'buffalo') {
                    grp = beast(fwp.x, fwp.z, true,
                        { body: 0x4E4A46, len: 4.6, tall: 3.2, wide: 2.4, legs: true });
                } else if (kind === 'bighorn') {
                    grp = beast(fwp.x, fwp.z, true,
                        { body: 0x9C8467, len: 3.0, tall: 2.6, wide: 1.6, legs: true });
                    for (var hn = 0; hn < 2; hn++) {
                        var horn = new THREE.Mesh(new THREE.TorusGeometry(1.0, 0.28, 5, 8, Math.PI * 1.3),
                                                  fmat(0x6E5B41));
                        horn.position.set(fwp.x + 2.6, 4.2, fwp.z + (hn ? 0.8 : -0.8));
                        horn.rotation.y = Math.PI / 2;
                        g.add(horn);
                    }
                } else {   // capybara and anything else four-legged and small
                    grp = beast(fwp.x, fwp.z, true,
                        { body: 0x8A6A46, len: 2.4, tall: 1.7, wide: 1.4, legs: true });
                }
                grp.rotation.y = fwp.heading + (rnd(fi, 97) - 0.5) * 1.2;
                g.add(grp);
            }
        }

        this.landmarks = g;
        this.scene.add(g);
    },

    _createCanyonWalls: function () {
        if (this.canyonWalls) {
            this._disposeGroup(this.canyonWalls);
            this.scene.remove(this.canyonWalls);
            this.canyonWalls = null;
        }
        var prof = RR.River.profile;
        if (!prof) return;
        if (!prof.canyon) {
            if (RR.River.shortcut) {
                var branch=new THREE.Group();
                var gravel=new THREE.MeshStandardMaterial({color:prof.colors.bank,roughness:0.95});
                this._buildShortcut(branch,[gravel,gravel,gravel,gravel],RR.River.shortcut);
                this.scene.add(branch);this.canyonWalls=branch;
            }
            return;
        }

        var g = new THREE.Group();
        var SEG = this.SEG_LEN;
        // Lit face, mid bed, shade -- sampled off the reference photos.
        // Grand Canyon reds by default; Hellgate's grey basalt, the Batoka's
        // near-black basalt and the Rhine's slate override it per profile.
        // THESE ARE MEASURED PHOTO COLOURS, AND THEY MUST BE LINEARISED.
        //
        // THREE.ColorManagement.enabled is FALSE in this build, so an authored
        // hex is handed to the shader AS IF IT WERE ALREADY LINEAR. #BC8D72
        // goes in as (0.737, 0.553, 0.447) instead of (0.511, 0.272, 0.170) --
        // about 45% too bright in red and with the channel separation crushed.
        // On a mid-tone warm rock that is catastrophic: the near wall measured
        // #e8e1d8 at saturation 0.069 against a target of #cc9382 at 0.363.
        // It was the "pale beige wash" -- a white hallway where the Grand
        // Canyon should be. Dimming the lights does not fix it (exposure 0.60
        // with lights at 0.70 only reached saturation 0.161 and went muddy);
        // the albedo has to carry the right linear value.
        //
        // convertSRGBToLinear does exactly the decode the renderer is skipping,
        // so the numbers above stay the measured photo values and render as
        // themselves: after this the same wall reads #bf8f6a at 0.445.
        //
        // THAT IS NO LONGER THE SHIPPING PATH. ColorManagement is ON as of
        // 2026-09-03, so the renderer performs this decode itself and doing it
        // here as well converts TWICE and takes the rock too dark -- which is
        // exactly what the first preview comparison showed. The branch below
        // survives only to keep ?cm=0 an honest restore of the old look; in
        // the shipping build `managed` is true and the strata are the measured
        // photo colours, untouched.
        var managed = RR.Config.COLOR_MANAGED;
        var strata = (prof.canyonStrata ||
                      [0xC48D65, 0xBC8D72, 0xA07257, 0x8A5F49, 0x6F3D33, 0x634346])
            .map(function (c) {
                var col = new THREE.Color(c);
                if (!managed) col.convertSRGBToLinear();
                return new THREE.MeshStandardMaterial({ color: col, roughness: 0.96 });
            });

        var step = 11, i, side;
        var sc = RR.River.shortcut;
        for (i = 0; i < RR.River.segments.length - step; i += step) {
            for (side = -1; side <= 1; side += 2) {
                // The shortcut builds its own right-hand rock (below).
                if (sc && side > 0 && i + step > sc.start - 1 && i < sc.end + sc.exit + 1) continue;
                var n1 = Math.abs(Math.sin(i * 12.9898 + side * 7.3) * 43758.5453) % 1;
                var n2 = Math.abs(Math.sin(i * 78.233 + side * 2.1) * 43758.5453) % 1;
                // The boat clamps at lateral ~0.74-0.78, so a face at 1.16 sat
                // roughly 29 hull lengths off the water the player can actually
                // reach -- you took a wall strike with open river still visible
                // between you and the rock. Brought in to 0.92 so the contact
                // reads. Verified afterwards that nothing overhangs navigable
                // water: fire a ray straight up from the surface across the
                // channel, it must return zero hits.
                var lat = side * (0.92 + n1 * 0.10);
                var a = this.getWorldPos(i * SEG, lat);
                var b = this.getWorldPos((i + step) * SEG, lat);
                var mx = (a.x + b.x) / 2, mz = (a.z + b.z) / 2;
                // Step the beds OUT along the same normal getWorldPos uses for
                // lateral. (cos facing, -sin facing) is the NEGATIVE of that
                // normal, so every bed used to march inward over the channel
                // instead of battering away from it -- see the 2026-09-02
                // entry. Measured before the fix on the Colorado at HARD:
                // rock at boat height across 99.8% of lateral 0.75-0.92 with
                // the hull clamped at 0.78, and a rock ceiling over 76% of
                // mid-channel.
                var nrm = this.riverNormals[Math.min(i + (step >> 1),
                                                     this.riverNormals.length - 1)];

                // A slab is a STRAIGHT chord across 11 segments (and 25% longer
                // than the chord at that), so on the inside of a bend it cuts
                // inboard of the arc it is meant to line. Measure that sagitta
                // against the real curve and push the whole stack out by it,
                // rather than moving every wall on every river out by the worst
                // case -- which is how they ended up 29 hull lengths away and
                // had to be brought back in.
                var sag = 0, ti, tp, cp, dev;
                for (ti = -0.125; ti <= 1.126; ti += 0.125) {
                    tp = this.getWorldPos((i + ti * step) * SEG, lat);
                    cp = { x: a.x + (b.x - a.x) * ti, z: a.z + (b.z - a.z) * ti };
                    dev = (tp.x - cp.x) * nrm.x * side + (tp.z - cp.z) * nrm.z * side;
                    if (dev > sag) sag = dev;
                }
                var len = Math.sqrt((b.x - a.x) * (b.x - a.x) + (b.z - a.z) * (b.z - a.z)) * 1.25;
                var facing = Math.atan2(b.x - a.x, b.z - a.z);

                // Three beds, each stepped back from the one below so the wall
                // batters outward the way a real canyon does.
                var y = 0, k;
                for (k = 0; k < 3; k++) {
                    // Tall enough to fill the frame from a boat. The whole
                    // point of the Grand Canyon is that you cannot see out of
                    // it; short walls just read as red hills.
                    var h = 105 + n2 * 70 + k * 45;
                    var w = 30 + n1 * 20 + k * 26;
                    var block = new THREE.Mesh(
                        new THREE.BoxGeometry(w, h, len),
                        strata[(k * 2 + Math.floor(n1 * 3)) % strata.length]);
                    var out = w * 0.42 + k * 9 + sag;
                    block.position.set(
                        mx + nrm.x * side * out,
                        y + h * 0.5 - 10,
                        mz + nrm.z * side * out);
                    block.rotation.y = facing;
                    g.add(block);
                    y += h * 0.82;
                }
            }
        }
        if (sc) this._buildShortcut(g, strata, sc);
        this.canyonWalls = g;
        this.scene.add(g);
    },

    // THE SECRET TUNNEL (river.js, RR.River.shortcut). Everything here is
    // rock or water; the rules (divider is fatal, lane is fast) live in
    // river.js / boat.js / collision.js and use the same lateral numbers.
    //
    //   - outer wall at lateral 1.74, converging back to the normal canyon
    //     face over the exit ramp;
    //   - a closing wall across the lane's downstream end, so you enter from
    //     the side through the mouth, through the gap Tyler spotted;
    //   - the divider between the mouths (lateral 0.84-1.06);
    //   - a rock roof over the lane between the mouths -- the tunnel -- whose
    //     shadow darkens the water inside;
    //   - a strip of water for the lane itself.
    _shortcutWallLat: function (sf, sc) {
        if (sf <= sc.end) return 1.74;
        var f = Math.min(1, (sf - sc.end) / sc.exit);
        return 1.74 + (0.97 - 1.74) * f;
    },

    _buildShortcut: function (g, strata, sc) {
        var SEG = this.SEG_LEN, self = this;
        function slab(s0, s1, lat0, lat1, y0, h, matIdx) {
            // A box whose length runs s0 -> s1 along the river, centred on
            // lat0 -> lat1 at its two ends, reaching from y0 up h.
            var a = self.getWorldPos(s0 * SEG, lat0);
            var b = self.getWorldPos(s1 * SEG, lat1);
            var len = Math.sqrt((b.x - a.x) * (b.x - a.x) + (b.z - a.z) * (b.z - a.z)) * 1.12;
            return { a: a, b: b, len: len, y0: y0, h: h, m: strata[matIdx % strata.length] };
        }
        function add(sl, width) {
            var mesh = new THREE.Mesh(new THREE.BoxGeometry(width, sl.h, sl.len), sl.m);
            mesh.position.set((sl.a.x + sl.b.x) / 2, sl.y0 + sl.h / 2, (sl.a.z + sl.b.z) / 2);
            mesh.rotation.y = Math.atan2(sl.b.x - sl.a.x, sl.b.z - sl.a.z);
            g.add(mesh);
            return mesh;
        }
        var s0, k = 0, STEP = 4;
        var hw = function (sf) { return self.getWorldPos(sf * SEG, 0).halfW; };

        if (sc.open) this._buildOpenShortcutBanks(g,sc);
        else {
        // Outer wall, start -> end of exit ramp, stacked like the canyon.
        for (s0 = sc.start - 2; s0 < sc.end + sc.exit + 2; s0 += STEP, k++) {
            var l0 = this._shortcutWallLat(s0, sc), l1 = this._shortcutWallLat(s0 + STEP, sc);
            var w = 34 + (k % 3) * 8;
            // Push the slab out by half its width so its FACE sits on lat.
            var off = (w * 0.5) / Math.max(1, hw(s0));
            add(slab(s0, s0 + STEP, l0 + off, l1 + off, -10, sc.open ? 12 : 150 + (k % 4) * 18, k), w);
            if (!sc.open) add(slab(s0, s0 + STEP, l0 + off * 2.2, l1 + off * 2.2, 110, 120, k + 2), w * 1.3);
        }

        // Closing wall across the lane's downstream end (lane runs 1.0-1.74).
        var cA = this.getWorldPos(sc.start * SEG, 0.96);
        var cB = this.getWorldPos(sc.start * SEG, 1.80);
        var cl = new THREE.Mesh(new THREE.BoxGeometry(
            Math.sqrt((cB.x - cA.x) * (cB.x - cA.x) + (cB.z - cA.z) * (cB.z - cA.z)), 150, 16), strata[1]);
        cl.position.set((cA.x + cB.x) / 2, 65, (cA.z + cB.z) / 2);
        cl.rotation.y = Math.atan2(cB.x - cA.x, cB.z - cA.z) - Math.PI / 2;
        // Set back half a block downstream so its face is at sc.start.
        var hd = cA.heading;
        cl.position.x -= Math.sin(hd) * 8;
        cl.position.z -= Math.cos(hd) * 8;
        if (!sc.open) g.add(cl);
        else {cl.geometry.dispose();}

        // Divider between the mouths, and the roof over the lane.
        for (s0 = sc.start + sc.mouth, k = 0; s0 < sc.end - sc.mouth; s0 += STEP, k++) {
            var s1 = Math.min(s0 + STEP, sc.end - sc.mouth);
            var mid = (sc.divIn + sc.divOut) / 2;
            var dw = (sc.divOut - sc.divIn) * hw(s0);
            add(slab(s0, s1, mid, mid, -10, sc.open ? 12 : 130 + (k % 3) * 20, k + 1), dw);
            // Roof: from the divider's crest out past the outer wall.
            var rw = (1.86 - sc.divIn) * hw(s0);
            if (!sc.open) { var rm = add(slab(s0, s1, (sc.divIn + 1.86) / 2, (sc.divIn + 1.86) / 2, 34, 14 + (k % 2) * 4, k + 3), rw);
            rm.userData.roof = true; }
        }

        }
        // Water for the lane: lateral 0.95 -> the outer wall.
        var rows = [];
        for (s0 = sc.start - 1; s0 <= sc.end + sc.exit + 1; s0 += 1) rows.push(s0);
        var pos = new Float32Array((rows.length - 1) * 6 * 3), uv = new Float32Array((rows.length - 1) * 6 * 2);
        var shal = new Float32Array((rows.length - 1) * 6 * 2);
        var vi = 0, ui = 0, ri;
        for (ri = 0; ri < rows.length - 1; ri++) {
            var sa = rows[ri], sb = rows[ri + 1];
            var pA0 = this.getWorldPos(sa * SEG, 0.95), pA1 = this.getWorldPos(sa * SEG, this._shortcutWallLat(sa, sc) + 0.05);
            var pB0 = this.getWorldPos(sb * SEG, 0.95), pB1 = this.getWorldPos(sb * SEG, this._shortcutWallLat(sb, sc) + 0.05);
            var quad = [[pA0, 0.45], [pA1, 0.0], [pB0, 0.45], [pA1, 0.0], [pB1, 0.0], [pB0, 0.45]];
            for (var q = 0; q < 6; q++) {
                pos[vi++] = quad[q][0].x; pos[vi++] = -0.12; pos[vi++] = quad[q][0].z;
                uv[ui++] = quad[q][1]; uv[ui++] = sa / RR.River.segments.length;
            }
        }
        var wg = new THREE.BufferGeometry();
        wg.setAttribute('position', new THREE.BufferAttribute(pos, 3));
        wg.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
        wg.setAttribute('aShallow', new THREE.BufferAttribute(shal, 2));
        wg.computeVertexNormals();
        if (this.waterMesh) {
            // Shares the river's own material; never freed with the canyon.
            this.waterMesh.material._rrShared = true;
            var lane = new THREE.Mesh(wg, this.waterMesh.material);
            lane.name = 'shortcutWater';
            g.add(lane);
        }
    },

    _buildOpenShortcutBanks: function(group,sc) {
        var self=this,SEG=this.SEG_LEN;
        function ribbon(start,end,rowsFn) {
            var pos=[],colors=[],indices=[];
            for(var i=start;i<=end;i++) {
                var row=rowsFn(i);
                for(var k=0;k<row.length;k++) {
                    var wp=self.getWorldPos(i*SEG,row[k][0]);pos.push(wp.x,row[k][1],wp.z);
                    var col=new THREE.Color(row[k][2]);colors.push(col.r,col.g,col.b);
                }
                if(i>start){var base=(i-start)*row.length;
                    for(var j=0;j<row.length-1;j++){var a=base+j,b=a-row.length;indices.push(a,b,a+1,b,b+1,a+1);}}
            }
            var geo=new THREE.BufferGeometry();geo.setAttribute('position',new THREE.Float32BufferAttribute(pos,3));geo.setAttribute('color',new THREE.Float32BufferAttribute(colors,3));geo.setIndex(indices);geo.computeVertexNormals();
            group.add(new THREE.Mesh(geo,new THREE.MeshStandardMaterial({vertexColors:true,roughness:0.95,side:THREE.DoubleSide})));
        }
        var mid=(sc.divIn+sc.divOut)/2;
        ribbon(sc.start+sc.mouth,sc.end-sc.mouth,function(i){var h=RR.River.shortcutDividerHalf(i);return [[mid-h,-0.4,0x777568],[mid-h*.6,1.2,0x8c8976],[mid,1.9,0x667151],[mid+h*.6,1.2,0x8c8976],[mid+h,-0.4,0x777568]];});
        ribbon(sc.start-2,sc.end+sc.exit+2,function(i){var edge=self._shortcutWallLat(i,sc);return [[edge,-.4,0x777568],[edge+.12,1.4,0x8b8976],[edge+.4,3.2,0x667151],[edge+1.2,2.8,0x586a46]];});
        var bark=new THREE.MeshStandardMaterial({color:0x4b4134,roughness:1});
        var leaf=new THREE.MeshStandardMaterial({color:0x3e663c,roughness:1});
        for(var i=sc.start;i<sc.end+sc.exit;i+=9){
            var wp=this.getWorldPos(i*SEG,this._shortcutWallLat(i,sc)+.48);
            var tree=new THREE.Group();tree.position.set(wp.x,2.7,wp.z);
            var trunk=new THREE.Mesh(new THREE.CylinderGeometry(.65,1,16,6),bark);trunk.position.y=8;tree.add(trunk);
            for(var j=0;j<3;j++){var crown=new THREE.Mesh(new THREE.ConeGeometry(6-j,13,8),leaf);crown.position.y=15+j*6;tree.add(crown);}
            group.add(tree);
        }
    },

    // Palms, Nile only. Bare leaning trunk with a crown of drooping fronds --
    // nothing like the rounded alder blobs the other rivers use, which is the
    // whole point. Built once along the course rather than pooled: at one
    // every 34 segments per bank that is ~170 palms, which is well under what
    // the bank timber already puts in the scene.
    _createPalms: function () {
        if (this.palms) {
            this._disposeGroup(this.palms);
            this.scene.remove(this.palms);
            this.palms = null;
        }
        var prof = RR.River.profile;
        if (!prof || !prof.palms) return;

        var g = new THREE.Group();
        var SEG = this.SEG_LEN;
        var trunkMat = new THREE.MeshStandardMaterial({ color: 0x7A6242, roughness: 0.95 });
        var frondMat = new THREE.MeshStandardMaterial({
            color: 0x4C7A3C, roughness: 0.9, side: THREE.DoubleSide });
        var frondDark = new THREE.MeshStandardMaterial({
            color: 0x33582C, roughness: 0.9, side: THREE.DoubleSide });

        // Every 11 segments per side instead of every 34, and a second row set
        // further back. The Nile photos are dense stands of palm along both
        // banks, not the scattering of individual trees this used to draw.
        var step = 11, i, side, f, row;
        for (i = 60; i < RR.River.segments.length - 60; i += step) {
            for (side = -1; side <= 1; side += 2) {
              for (row = 0; row < 2; row++) {
                // Deterministic jitter so a bank is not a fencepost line.
                var n1 = Math.abs(Math.sin(i * 12.9898 + side * 4.1 + row * 9.7) * 43758.5453) % 1;
                var n2 = Math.abs(Math.sin(i * 78.233 + side * 1.7 + row * 3.3) * 43758.5453) % 1;
                if (n1 < (row ? 0.42 : 0.18)) continue;        // gaps; back row thinner
                var lat = side * (1.06 + n2 * 0.30 + row * 0.34);
                var wp = this.getWorldPos((i + Math.floor(n2 * step)) * SEG, lat);
                var h = 15 + n1 * 13;

                var trunk = new THREE.Mesh(
                    new THREE.CylinderGeometry(0.42, 0.78, h, 6), trunkMat);
                trunk.position.set(wp.x, h * 0.5, wp.z);
                // Palms lean toward the light, i.e. out over the water.
                trunk.rotation.z = -side * (0.06 + n2 * 0.10);
                g.add(trunk);

                var crownY = h - 0.5;
                var crownX = wp.x - side * h * (0.06 + n2 * 0.10) * 0.5;
                for (f = 0; f < 7; f++) {
                    var a = (f / 7) * Math.PI * 2 + n1 * 2;
                    var frond = new THREE.Mesh(
                        new THREE.ConeGeometry(1.0, 7.2, 4), f % 2 ? frondMat : frondDark);
                    frond.position.set(
                        crownX + Math.cos(a) * 2.7, crownY + 1.1, wp.z + Math.sin(a) * 2.7);
                    frond.rotation.z = Math.cos(a) * 1.15;
                    frond.rotation.x = -Math.sin(a) * 1.15;
                    frond.scale.set(0.55, 1, 0.34);            // flattened blade
                    g.add(frond);
                }
                // Coconut cluster
                var nut = new THREE.Mesh(new THREE.SphereGeometry(0.55, 6, 5), trunkMat);
                nut.position.set(crownX, crownY + 0.3, wp.z);
                g.add(nut);
              }
            }
        }
        this.palms = g;
        this.scene.add(g);
    },

    // Buildings on the Nile bank -- Nile only.
    //
    // Straight off ARCHIVES/REFERENCES/RIVER/NILE RIVER-*.png: the Luxor
    // colonnade (a double row of stout sandstone columns under an architrave),
    // low flat-roofed mud-brick blocks, and the odd obelisk. Unlike the
    // pyramids these are placed at REAL river positions on the bank, so you
    // pass them rather than watching them sit on the horizon.
    _createDesertBuildings: function () {
        if (this.desertBuildings) {
            this._disposeGroup(this.desertBuildings);
            this.scene.remove(this.desertBuildings);
            this.desertBuildings = null;
        }
        var prof = RR.River.profile;
        if (!prof || !prof.pyramids) return;      // same flag that marks Egypt

        var g = new THREE.Group();
        var SEG = this.SEG_LEN;
        var sand  = new THREE.MeshStandardMaterial({ color: 0xC9A97A, roughness: 0.95 });
        var shade = new THREE.MeshStandardMaterial({ color: 0xAD8B60, roughness: 0.95 });
        var mud   = new THREE.MeshStandardMaterial({ color: 0xBE9A72, roughness: 0.98 });
        var colGeo = new THREE.CylinderGeometry(2.6, 3.0, 22, 10);

        function rnd(i, k) {
            return Math.abs(Math.sin(i * 12.9898 + k * 78.233) * 43758.5453) % 1;
        }

        var i, side, j, seg = RR.River.segments.length;
        for (i = 140; i < seg - 120; i += 190) {
            side = rnd(i, 1) < 0.5 ? -1 : 1;
            var kind = rnd(i, 2);
            var lat = side * (1.55 + rnd(i, 3) * 0.45);
            var wp = this.getWorldPos(i * SEG, lat);
            var head = wp.heading;

            if (kind < 0.42) {
                // COLONNADE: two rows of columns carrying an architrave.
                var cols = 5 + Math.floor(rnd(i, 4) * 4);
                for (j = 0; j < cols; j++) {
                    for (var rowc = 0; rowc < 2; rowc++) {
                        var along = (j - (cols - 1) / 2) * 9;
                        var across = (rowc - 0.5) * 13;
                        var c1 = new THREE.Mesh(colGeo, rowc ? shade : sand);
                        c1.position.set(
                            wp.x + Math.cos(head) * across + Math.sin(head) * along,
                            11,
                            wp.z - Math.sin(head) * across + Math.cos(head) * along);
                        g.add(c1);
                    }
                }
                var lintel = new THREE.Mesh(new THREE.BoxGeometry(cols * 9 + 6, 3.4, 17), sand);
                lintel.position.set(wp.x, 23.6, wp.z);
                lintel.rotation.y = head;
                g.add(lintel);
            } else if (kind < 0.78) {
                // MUD-BRICK BLOCKS: a little riverside village.
                var n = 3 + Math.floor(rnd(i, 5) * 4);
                for (j = 0; j < n; j++) {
                    var w = 9 + rnd(i, 6 + j) * 12;
                    var hgt = 7 + rnd(i, 20 + j) * 9;
                    var b = new THREE.Mesh(new THREE.BoxGeometry(w, hgt, w * 0.8), j % 2 ? mud : sand);
                    var offA = (j - n / 2) * 16 + rnd(i, 30 + j) * 8;
                    var offB = rnd(i, 40 + j) * 22;
                    b.position.set(wp.x + Math.sin(head) * offA + Math.cos(head) * offB,
                                   hgt * 0.5,
                                   wp.z + Math.cos(head) * offA - Math.sin(head) * offB);
                    b.rotation.y = head + (rnd(i, 50 + j) - 0.5) * 0.4;
                    g.add(b);
                }
            } else {
                // OBELISK on a plinth.
                var plinth = new THREE.Mesh(new THREE.BoxGeometry(9, 4, 9), shade);
                plinth.position.set(wp.x, 2, wp.z);
                plinth.rotation.y = head;
                g.add(plinth);
                var shaft = new THREE.Mesh(new THREE.CylinderGeometry(1.5, 2.9, 34, 4), sand);
                shaft.position.set(wp.x, 21, wp.z);
                shaft.rotation.y = head + Math.PI / 4;
                g.add(shaft);
                var cap = new THREE.Mesh(new THREE.ConeGeometry(2.0, 4.4, 4), sand);
                cap.position.set(wp.x, 40, wp.z);
                cap.rotation.y = head + Math.PI / 4;
                g.add(cap);
            }
        }
        this.desertBuildings = g;
        this.scene.add(g);
    },

    // Pyramids, Nile only. Parked well back beyond the bank so they read as
    // horizon landmarks rather than obstacles, and re-parked ahead of the boat
    // each frame like the mountain backdrop -- otherwise you drive past them
    // in ten seconds and Egypt is behind you for the rest of the run.
    _createPyramids: function () {
        if (this.pyramids) {
            this._disposeGroup(this.pyramids);
            this.scene.remove(this.pyramids);
            this.pyramids = null;
        }
        var p = RR.River.profile;
        if (!p || !p.pyramids) return;

        var g = new THREE.Group();
        var stoneMat = new THREE.MeshStandardMaterial({ color: 0xCBAE79, roughness: 0.95 });
        var shadeMat = new THREE.MeshStandardMaterial({ color: 0xA98C5C, roughness: 0.95 });
        // 4-sided cones are pyramids. Three of them, Giza-ish: two big, one small.
        // Well off the port bow, not straddling the channel. The small one used
        // to sit at x = -20, which is dead ahead of a boat running the middle,
        // and all three crowded the view of the river you are trying to read.
        // Pushed out to -1150..-700 and set further back so they read as
        // landmarks on the horizon instead of obstacles in the way.
        var spec = [
            { r: 150, h: 190, x: -1150, z: 900, mat: stoneMat },
            { r: 122, h: 155, x:  -880, z: 1030, mat: shadeMat },
            { r: 74,  h: 92,  x:  -700, z: 860, mat: stoneMat }
        ];
        spec.forEach(function (sp) {
            var m = new THREE.Mesh(new THREE.ConeGeometry(sp.r, sp.h, 4), sp.mat);
            m.position.set(sp.x, sp.h * 0.5 - 12, sp.z);
            m.rotation.y = Math.PI / 4;      // face a flat, not an edge
            g.add(m);
        });
        this.pyramids = g;
        this.scene.add(g);
    },

    // Crocodiles: long low body, snout, ridged back, tail. Pooled like the
    // bears and salmon rather than rebuilt per frame.
    _allocateCrocPool: function () {
        var i;
        for (i = 0; i < this.crocMeshPool.length; i++) {
            this._disposeGroup(this.crocMeshPool[i]);
            this.scene.remove(this.crocMeshPool[i]);
        }
        this.crocMeshPool = [];
        var count = (RR.River.crocs || []).length;
        if (!count) return;

        var hideMat = new THREE.MeshStandardMaterial({ color: 0x4A5636, roughness: 0.92 });
        var dark = new THREE.MeshStandardMaterial({ color: 0x333D26, roughness: 0.9 });
        var eyeMat = new THREE.MeshStandardMaterial({
            color: 0xE8C766, roughness: 0.4, emissive: 0x6A5218, emissiveIntensity: 0.5 });

        for (i = 0; i < count; i++) {
            var root = new THREE.Group();
            var body = new THREE.Mesh(new THREE.BoxGeometry(2.1, 1.15, 7.4), hideMat);
            body.position.y = 0.55; root.add(body);
            var head = new THREE.Mesh(new THREE.BoxGeometry(1.35, 0.82, 2.6), hideMat);
            head.position.set(0, 0.48, 4.7); root.add(head);
            var snout = new THREE.Mesh(new THREE.BoxGeometry(0.78, 0.5, 1.7), hideMat);
            snout.position.set(0, 0.36, 6.6); root.add(snout);
            var tail = new THREE.Mesh(new THREE.BoxGeometry(1.15, 0.72, 4.6), hideMat);
            tail.position.set(0, 0.45, -5.4); root.add(tail);
            var tip = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.4, 2.6), hideMat);
            tip.position.set(0, 0.42, -8.6); root.add(tip);
            // ridged back
            var k;
            for (k = 0; k < 5; k++) {
                var ridge = new THREE.Mesh(new THREE.ConeGeometry(0.34, 0.62, 4), dark);
                ridge.position.set(0, 1.25, 2.6 - k * 1.7);
                root.add(ridge);
            }
            var e;
            for (e = 0; e < 2; e++) {
                var eye = new THREE.Mesh(new THREE.SphereGeometry(0.2, 6, 5), eyeMat);
                eye.position.set(e ? 0.42 : -0.42, 0.95, 4.4);
                root.add(eye);
            }
            root.visible = false;
            this.scene.add(root);
            this.crocMeshPool.push(root);
        }
    },

    _updateCrocs: function (boat, time) {
        var crocs = RR.River.crocs || [];
        var pool = this.crocMeshPool, S = this.RIVER_SCALE, SEG = this.SEG_LEN;
        var i, c, mesh, wp, ahead, facing;
        for (i = 0; i < pool.length; i++) pool[i].visible = false;
        for (i = 0; i < crocs.length && i < pool.length; i++) {
            c = crocs[i];
            var dSeg = c.segment - Math.floor(boat.z / SEG);
            if (dSeg < -this.VISIBLE_SEGS_BEHIND || dSeg > this.VISIBLE_SEGS_AHEAD) continue;
            mesh = pool[i];
            wp = this.getWorldPos(c.segment * SEG, c.x);
            ahead = this.getWorldPos((c.segment + 4) * SEG, c.x);
            facing = Math.atan2(ahead.x - wp.x, ahead.z - wp.z);
            // In the water they sit almost awash; on the bank they lie clear.
            mesh.position.set(wp.x, c.inWater ? -0.35 : 2.6, wp.z);
            mesh.rotation.y = facing + (c.inWater ? Math.PI : Math.PI * 0.5 * c.side);
            // 3.4x, not 1.25. Tyler had never seen one: a literal crocodile is
            // unreadable beside a river this wide, exactly as the bears were
            // before they went to 3.2. The ones hauled out on the bank also sit
            // higher so they clear the bank line instead of being buried in it.
            mesh.scale.setScalar(c.size * 3.4);
            // Idle tail sway, and a slow drift for the ones in the water.
            mesh.rotation.z = Math.sin(time * 1.2 + c.phase) * 0.05;
            if (c.inWater) mesh.position.y += Math.sin(time * 0.9 + c.phase) * 0.12;
            mesh.visible = true;
        }
    },

    _createFinishGate: function () {
        if (this.finishGate) {
            this._disposeGroup(this.finishGate);
            this.scene.remove(this.finishGate);
            this.finishGate = null;
        }
        this._finishBanner = null;
        if (!RR.River.finishZ) return;

        var g = new THREE.Group();
        var postMat = new THREE.MeshStandardMaterial({ color: 0x23282D, roughness: 0.7 });
        var bannerMat = new THREE.MeshBasicMaterial({
            map: this._makeFinishTexture(),
            side: THREE.DoubleSide, transparent: true, opacity: 0.97
        });

        var L = this.getWorldPos(RR.River.finishZ, -1.15);
        var R = this.getWorldPos(RR.River.finishZ, 1.15);
        var postH = 26;

        var i, p;
        for (i = 0; i < 2; i++) {
            p = i === 0 ? L : R;
            var post = new THREE.Mesh(new THREE.CylinderGeometry(1.1, 1.4, postH, 8), postMat);
            post.position.set(p.x, postH * 0.5, p.z);
            g.add(post);
        }

        var dx = R.x - L.x, dz = R.z - L.z;
        var span = Math.sqrt(dx * dx + dz * dz);
        // Segmented so it can be waved. 30 across is enough for a smooth
        // travelling wave without the vertex loop showing up in a frame.
        var banner = new THREE.Mesh(new THREE.PlaneGeometry(span, 9, 30, 4), bannerMat);
        banner.position.set((L.x + R.x) / 2, postH - 5.5, (L.z + R.z) / 2);
        // + PI so the plane's FRONT face points downstream, at the boat. The
        // material is DoubleSide so the banner is solid either way, but the
        // back face shows the texture mirrored -- without this, FINISH reads
        // backwards on the approach, which is the only way you ever see it.
        banner.rotation.y = Math.atan2(dx, dz) + Math.PI / 2 + Math.PI;
        g.add(banner);

        // Keep the flat geometry so each frame displaces from the original
        // rather than compounding its own output into a runaway.
        this._finishBanner = banner;
        this._finishBannerBase = new Float32Array(
            banner.geometry.getAttribute('position').array);
        this._finishSpan = span;

        this.finishGate = g;
        this.scene.add(g);
    },

    // What the built scene is a function of. Everything buildScene draws comes
    // from the level, the difficulty (widthMult reshapes the whole course) and
    // the selected hull. Nothing else. RR.River.generate is deterministic for a
    // given level+difficulty, so an identical signature means the scene already
    // standing IS the scene we would rebuild.
    sceneSignature: function () {
        var model = RR.Boat && RR.Boat.getModel ? RR.Boat.getModel() : null;
        return [RR.Progress ? RR.Progress.level : RR.River.level,
                RR.Difficulty ? RR.Difficulty.selectedIndex : 0,
                model ? (model.id || model.model) : '-'].join('|');
    },

    buildScene: function () {
        this.buildRiverPath();
        this._createWaterMesh();
        this._createBankMeshes();
        this._generateTrees();
        this._createTreeInstances();
        this._allocateObstaclePool();
        this._createIslandMeshes();
        this._allocateWildlifePools();
        this._allocateBearZonePool();
        this._applyRiverProfile();
        this._createFinishGate();
        this._createCheckpointSigns();
        this._createPyramids();
        this._createDesertBuildings();
        this._createPalms();
        this._createCanyonWalls();
        this._createLandmarks();
        this._allocateCrocPool();
        this._applyBoatModel();
        if (RR.Ramps) RR.Ramps.buildMeshes(this);
        this._tagTexturesSRGB();
        this._applyShadowFlags();
        this._camYaw = null;   // re-seed the chase camera on the new course
        this._builtSig = this.sceneSignature();
    },

    // Under ?cm=1 every canvas texture must declare sRGB or it is read as
    // linear and comes out washed. Harmless when the flag is off.
    _tagTexturesSRGB: function () {
        if (!RR.Config.COLOR_MANAGED || THREE.SRGBColorSpace === undefined) return 0;
        var n = 0;
        this.scene.traverse(function (o) {
            if (!o.isMesh || !o.material) return;
            var mats = Array.isArray(o.material) ? o.material : [o.material];
            mats.forEach(function (m) {
                if (m && m.map && m.map.colorSpace !== THREE.SRGBColorSpace) {
                    m.map.colorSpace = THREE.SRGBColorSpace;
                    // Only poke needsUpdate once the image actually exists. The
                    // canopy and decal PNGs load async, and marking an empty
                    // texture for upload logs "Texture marked for update but no
                    // image data found" -- nine lines of noise per build in a
                    // console that has to stay readable. THREE uploads them
                    // when they arrive regardless; the colorSpace set above is
                    // what matters and it sticks.
                    if (m.map.image) m.map.needsUpdate = true;
                    n++;
                }
            });
        });
        return n;
    },

    _applyRiverProfile: function () {
        var p = RR.River.profile;
        if (!p || !p.colors) return;
        var c = p.colors;

        if (this.scene && this.scene.fog) this.scene.fog.color.setHex(c.fog);
        if (this.waterUniforms) {
            this.waterUniforms.uDeepColor.value.setHex(c.deep);
            this.waterUniforms.uMidColor.value.setHex(c.mid);
            this.waterUniforms.uShallowColor.value.setHex(c.shallow);
            this.waterUniforms.uReflectColor.value.setHex(c.reflect);
            this.waterUniforms.uSkyColor.value.setHex(c.skyWater);
            if (this.waterUniforms.uGravelColor) {
                this.waterUniforms.uGravelColor.value.setHex(c.bank).multiplyScalar(0.62);
            }
        }
        if (this.skyDome && this.skyDome.material && this.skyDome.material.uniforms) {
            this.skyDome.material.uniforms.topColor.value.setHex(c.skyTop);
            this.skyDome.material.uniforms.midColor.value.setHex(c.skyMid);
            this.skyDome.material.uniforms.bottomColor.value.setHex(c.skyBottom);
        }
        // PNW-style timber does not belong behind the Grand Canyon or Nile.
        if (this._treeLineMesh) this._treeLineMesh.visible = !(p.canyon || p.palms);
        // Nor do mountains belong INSIDE it. Deep in the canyon the distant
        // range drew through the gap between the walls as a flat dark-blue
        // block hanging mid-sky -- the "blocky sky in the back" (Tyler,
        // 2026-10-26). From the bottom of the Grand Canyon you see sky, not a
        // range, so a canyon river hides the whole backdrop.
        if (this._backdrop) {
            for (var bdi = 0; bdi < this._backdrop.length; bdi++) {
                var bm = this._backdrop[bdi].mesh;
                if (bm === this._treeLineMesh) continue;
                bm.visible = !p.canyon;
            }
        }
        if (this.bankLeftMesh) this.bankLeftMesh.material.color.setHex(c.bank);
        if (this.bankRightMesh) this.bankRightMesh.material.color.setHex(c.bank);
        if (this.groundLeftMesh) this.groundLeftMesh.material.color.setHex(c.ground);
        if (this.groundRightMesh) this.groundRightMesh.material.color.setHex(c.ground);
    },

    getWorldPos: function (segZ, lateral) {
        var S = this.RIVER_SCALE;
        var idx = Math.floor(segZ / this.SEG_LEN);
        if (idx < 0) idx = 0;
        if (idx >= this.riverPath.length - 1) idx = this.riverPath.length - 2;
        var t = (segZ / this.SEG_LEN - idx);
        t = Math.max(0, Math.min(1, t));

        var p0 = this.riverPath[idx];
        var p1 = this.riverPath[idx + 1];
        var cx = p0.x + (p1.x - p0.x) * t;
        var cz = p0.z + (p1.z - p0.z) * t;
        var n = this.riverNormals[idx];
        var halfW = p0.width * 0.5;
        var wx = cx + n.x * lateral * halfW;
        var wz = cz + n.z * lateral * halfW;
        var h = p0.heading + (p1.heading - p0.heading) * t;
        return { x: wx, y: 0, z: wz, heading: h, halfW: halfW };
    },

    _createLights: function () {
        // Warmer and a touch dimmer ambient, with a stronger warm key below --
        // a sunny day has contrast, not flat fill.
        //
        // THE INTENSITIES FOLLOW COLOUR MANAGEMENT, and they have to.
        // Light() runs its colour through new Color(), so switching the decode
        // on dimmed the LIGHTS as well as the albedo -- albedo and lighting
        // darkened together and the scene went further down than the ~45% the
        // albedo alone accounts for. Measured luminance each light's own colour
        // keeps after the decode:
        //
        //   ambient  0x93A2B0   0.561      hemi sky     0x87CEEB   0.731
        //   sun      0xFFF1D2   0.937      hemi ground  0x3A5A30   0.268
        //
        // So each intensity is divided by its own loss. That is the whole rule:
        // it undoes exactly what the decode did to the light and leaves the
        // BALANCE Tyler already signed off on alone. A single uniform gain was
        // tried and rejected -- it lands about the same brightness but makes
        // the sun 1.6x stronger relative to the fill, and it measured slightly
        // less saturated on the frame (0.158 against 0.161 on the Skyqualmie).
        //
        // The one thing intensity cannot fix is the hemisphere GROUND colour,
        // which lost 73% and shares its intensity with the sky colour. That is
        // a bounce-light term, and shadowed undersides sit a little lower than
        // they used to because of it. Left alone deliberately: it was never
        // justified at the old strength, and it is part of why the frame reads
        // with more depth now.
        var mg = RR.Config.COLOR_MANAGED;
        var ambient = new THREE.AmbientLight(0x93A2B0, mg ? 0.93 : 0.52);
        this.scene.add(ambient);

        var hemi = new THREE.HemisphereLight(0x87CEEB, 0x3A5A30, mg ? 0.68 : 0.50);
        this.scene.add(hemi);

        this.sunLight = new THREE.DirectionalLight(0xFFF1D2, mg ? 1.65 : 1.55);
        this.sunLight.position.set(200, 400, 300);
        this.scene.add(this.sunLight);

        // A directional light shadows an ORTHOGRAPHIC box, and this river is
        // 18,000 drawn units long -- one static box covering it would give
        // metre-wide texels. So the box is small and rides with the boat, and
        // the light rides with it: SHADOW_LEAD ahead of the hull, on the same
        // yaw axis the chase camera aims down. Everything past it is fog.
        this._sunTarget = new THREE.Object3D();
        this.scene.add(this._sunTarget);
        this.sunLight.target = this._sunTarget;
        if (RR.Config.SHADOWS) {
            this.sunLight.castShadow = true;
            var sh = this.sunLight.shadow;
            sh.mapSize.set(RR.Config.MOBILE ? 1024 : 2048, RR.Config.MOBILE ? 1024 : 2048);
            var E = this.SHADOW_EXTENT;
            sh.camera.left = -E;
            sh.camera.right = E;
            sh.camera.top = E;
            sh.camera.bottom = -E;
            sh.camera.near = 120;
            sh.camera.far = 1500;
            // Thin alpha-tested quads acne badly. normalBias pushes the sample
            // along the surface normal, which suits foliage far better than a
            // large depth bias -- a big bias peter-pans the trunks off the bank.
            sh.bias = -0.0007;
            sh.normalBias = 0.9;
            sh.camera.updateProjectionMatrix();
        }
    },

    // Cast/receive flags, applied in one pass rather than at thirty creation
    // sites. The two ShaderMaterials -- water and sky dome -- are skipped: they
    // are hand-written GLSL with no shadow chunks included, so asking them to
    // receive would silently do nothing.
    _applyShadowFlags: function () {
        if (!RR.Config.SHADOWS) return 0;
        var n = 0, sky = this.skyDome, water = this.waterMesh;
        this.scene.traverse(function (o) {
            if (!o.isMesh) return;
            if (o === sky || o === water) return;
            var m = o.material;
            if (m && (Array.isArray(m) ? m[0] : m) && (Array.isArray(m) ? m[0] : m).isShaderMaterial) return;
            o.castShadow = true;
            o.receiveShadow = true;
            n++;
        });
        // THE HULL CASTS BUT DOES NOT RECEIVE. The shadow box is 600 units
        // across at 2048 texels -- about 0.29 units per texel -- which is fine
        // for a bank and a tree trunk and far too coarse for a boat deck. Self
        // shadowing at that ratio produced a regular diagonal cross-hatch of
        // acne right across the deck plate, the most-looked-at surface in the
        // game. Raising the bias enough to kill it detached the tree shadows
        // from their trunks instead, so: the hull is lit by sun and ambient the
        // way it always was, and it still throws a shadow onto the bank.
        if (this.boatGroup) {
            this.boatGroup.traverse(function (o) { if (o.isMesh) o.receiveShadow = false; });
        }
        if (this.wakeGroup) {
            this.wakeGroup.traverse(function (o) {
                if (o.isMesh) { o.receiveShadow = false; o.castShadow = false; }
            });
        }
        return n;
    },

    // Close a custom fragment shader's main().
    //
    // A ShaderMaterial gets the ACES tone map from the tonemapping_fragment
    // chunk and the sRGB encode from encodings_fragment. Include neither and
    // it calls NEITHER -- which is what the water and the sky dome did for the
    // whole life of this project. They wrote RAW to the framebuffer while
    // every MeshStandardMaterial in the scene was tone mapped and encoded, and
    // toneMappingExposure did nothing to them at all.
    //
    // Their input was never decoded AND their output was never encoded, so the
    // two errors cancelled -- they were the only two surfaces in the game
    // rendering at roughly their authored hex. THAT is why an earlier attempt
    // at THREE.ColorManagement.enabled = true sent the Colorado's water near
    // black: it began decoding the input while the output stayed raw.
    //
    // r150 injects tonemapping_pars_fragment, the generated toneMapping() and
    // linearToOutputTexel() into the prefix of every ShaderMaterial (not
    // RawShaderMaterial), so the functions these chunks call are already
    // declared. Both chunks operate on gl_FragColor, so they go AFTER it is
    // assigned -- pass in a shader body that ends at that assignment, with no
    // closing brace and no trailing comma.
    //
    // Left out under ?cm=0 deliberately: that flag has to restore the genuine
    // pre-colour-management look, not a hybrid that decodes nothing and
    // encodes anyway.
    //
    // toneMap=false gives a shader the sRGB encode WITHOUT the ACES curve, and
    // the sky dome is called that way. Measured on the Skyqualmie at exposure
    // 0.85, sky patch, saturation:
    //
    //   authored raw (the old build)      #99bfe4   0.329
    //   tone mapped + encoded            #a7bed1   0.201   <- lost the blue
    //   encoded only                     #9bc0e4   0.320   <- authored, kept
    //
    // ACES exists to compress scene radiance that runs past 1.0. The dome is a
    // hand-authored LDR gradient with nothing above 1.0 in it, so the curve has
    // nothing to compress and only crushes the blue out of it -- the corrected
    // sky arrived PALER than the broken one, which is the opposite of the point.
    // The water does the reverse and keeps the curve: its specular and glint
    // terms are additive and do exceed 1.0, and tone mapped it measures more
    // saturated than either the old build or an encode-only version
    // (Skyqualmie near water 0.195, against 0.182 old and 0.144 encode-only;
    // Nile 0.643 against 0.637 and 0.488). Measured, not assumed, both ways.
    _closeFrag: function (lines, toneMap) {
        if (RR.Config.COLOR_MANAGED) {
            if (toneMap !== false) lines = lines.concat(['  #include <tonemapping_fragment>']);
            lines = lines.concat(['  #include <encodings_fragment>']);
        }
        return lines.concat(['}']).join('\n');
    },

    // THE WATER SHADER'S THREE HARD-CODED COLOURS.
    //
    // Two of them are ADDITIVE, so no colour switch and no THREE.Color
    // conversion can reach them -- they are compiled straight into the
    // fragment shader as numbers. They were authored by eye as DISPLAY values
    // under the uncorrected pipeline, which is why colour management needed
    // them decoded by hand, once, here. Named rather than buried in the shader
    // string so the next water pass can find them, and so they can be swept
    // from the console without an edit (set one, buildScene, look).
    //
    //   foam   0.78,0.87,0.84  ->  0.5705,0.7293,0.6739
    //   glint  0.30,0.38,0.36  ->  0.0732,0.1193,0.1065
    //   spec   1.00,0.95,0.85  ->  1.0000,0.8900,0.6921
    //
    // The *_AMT numbers are UNCHANGED, and that is a measurement, not an
    // oversight. The worry going in was that additive highlights on a base
    // colour management had darkened would stop reading as highlights. Tested
    // both literal sets through the managed pipeline on the Skyqualmie: near
    // water base 0.323 either way, peak 0.553 decoded against 0.564
    // undecoded. About 1% -- the decode is a units fix, not a look change, and
    // there was nothing to trim. Under ?cm=0 the display set is compiled in
    // instead, so the old look is reproduced exactly.
    WATER_LITERALS: {
        display: { foam: [0.7800, 0.8700, 0.8400], glint: [0.3000, 0.3800, 0.3600], spec: [1.0000, 0.9500, 0.8500] },
        linear:  { foam: [0.5705, 0.7293, 0.6739], glint: [0.0732, 0.1193, 0.1065], spec: [1.0000, 0.8900, 0.6921] }
    },
    WATER_FOAM_AMT: 0.52,
    WATER_GLINT_AMT: 1.00,
    WATER_SPEC_AMT: 0.40,

    // GLSL vec3 literal from one of the sets above, picked by the flag.
    _waterVec: function (key) {
        var set = RR.Config.COLOR_MANAGED ? this.WATER_LITERALS.linear : this.WATER_LITERALS.display;
        return 'vec3(' + set[key].map(function (v) { return v.toFixed(4); }).join(', ') + ')';
    },

    _createSky: function () {
        var skyGeo = new THREE.SphereGeometry(3000, 32, 16);
        var skyMat = new THREE.ShaderMaterial({
            side: THREE.BackSide,
            depthWrite: false,
            uniforms: {
                topColor: { value: new THREE.Color(0x4A8AC4) },
                midColor: { value: new THREE.Color(0x7EB4D8) },
                bottomColor: { value: new THREE.Color(0xD0DCE8) },
                offset: { value: 20 },
                exponent: { value: 0.4 }
            },
            vertexShader: [
                'varying vec3 vWorldPosition;',
                'void main() {',
                '  vec4 worldPosition = modelMatrix * vec4(position, 1.0);',
                '  vWorldPosition = worldPosition.xyz;',
                '  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);',
                '}'
            ].join('\n'),
            fragmentShader: this._closeFrag([
                'uniform vec3 topColor;',
                'uniform vec3 midColor;',
                'uniform vec3 bottomColor;',
                'uniform float offset;',
                'uniform float exponent;',
                'varying vec3 vWorldPosition;',
                'void main() {',
                '  float h = normalize(vWorldPosition + offset).y;',
                '  float t = max(0.0, h);',
                '  vec3 col = mix(bottomColor, midColor, smoothstep(0.0, 0.15, t));',
                '  col = mix(col, topColor, smoothstep(0.15, 0.6, t));',
                '  gl_FragColor = vec4(col, 1.0);'
            ], false)
        });
        this.skyDome = new THREE.Mesh(skyGeo, skyMat);

        // The dome is transparent with depthWrite off, and three.js sorts

        // transparent objects by DISTANCE TO THEIR ORIGIN. The dome is re-parked

        // on the camera every frame, so its origin is ~0 units away and it sorted

        // as the NEAREST transparent object -- drawn last, painting over every

        // cloud inside it. The clouds were rendering perfectly and being covered:

        // with depthTest off one of them put 84,660 pixels on screen. renderOrder

        // -1 forces the sky to the back where it belongs.

        this.skyDome.renderOrder = -1;
        this.scene.add(this.skyDome);

        this._createClouds();
    },

    _createClouds: function () {
        var cloudTex = this._makeCloudTexture();
        var cloudMat = new THREE.MeshBasicMaterial({
            map: cloudTex, transparent: true, opacity: 0.9,
            depthWrite: false, side: THREE.DoubleSide
        });
        this._cloudPlanes = [];
        // Eleven, not five. The reference photos are roughly two-thirds cloud
        // by area -- broken cumulus over blue, not a clear day and not
        // overcast -- and five thin planes could not carry that. Spread across
        // both sides and a wider depth range so the sky has some structure to
        // it as the boat moves. These are re-parked relative to the camera
        // every frame (see update), so the spacing here is an OFFSET from the
        // boat, not a fixed world position.
        // Seven planes, not thirteen. The photos measure 64% cloud, but Tyler
        // wants the level to feel SUNNY -- "too many clouds" -- so this is
        // deliberately short of the measurement: broken fair-weather cloud over
        // a deeper blue, not the two-thirds cover the camera happened to catch.
        // Measure cover by rendering with the clouds hidden and differencing
        // the two frames; 8% is invisible, 34% read as overcast, this sits
        // between.
        //
        // They are re-parked relative to the camera every frame, so x/y/z here
        // are OFFSETS from the boat, not fixed world positions.
        var positions = [
            { x: -700, y: 300, z: 1250, sx: 520, sy: 140 },
            { x:  340, y: 345, z: 1650, sx: 600, sy: 165 },
            { x:  820, y: 320, z: 1450, sx: 430, sy: 120 },
            { x: -560, y: 330, z: 1900, sx: 560, sy: 150 },
            { x:   90, y: 380, z: 2200, sx: 660, sy: 180 },
            { x: -380, y: 370, z: 2450, sx: 580, sy: 155 },
            { x:  900, y: 305, z: 2600, sx: 520, sy: 140 }
        ];
        for (var i = 0; i < positions.length; i++) {
            var p = positions[i];
            var plane = new THREE.Mesh(new THREE.PlaneGeometry(p.sx, p.sy), cloudMat.clone());
            plane.position.set(p.x, p.y, p.z);
            plane.material.opacity = 0.62 + Math.random() * 0.22;
            this.scene.add(plane);
            this._cloudPlanes.push(plane);
        }
    },

    _makeCloudTexture: function () {
        var c = document.createElement('canvas');
        c.width = 256; c.height = 64;
        var ctx = c.getContext('2d');
        var grad = ctx.createRadialGradient(128, 32, 10, 128, 32, 120);
        grad.addColorStop(0, 'rgba(255,255,255,0.9)');
        grad.addColorStop(0.4, 'rgba(240,245,250,0.6)');
        grad.addColorStop(0.7, 'rgba(220,230,240,0.2)');
        grad.addColorStop(1, 'rgba(200,220,230,0)');
        ctx.fillStyle = grad;
        ctx.fillRect(0, 0, 256, 64);
        var grad2 = ctx.createRadialGradient(90, 28, 5, 90, 28, 70);
        grad2.addColorStop(0, 'rgba(255,255,255,0.7)');
        grad2.addColorStop(1, 'rgba(255,255,255,0)');
        ctx.fillStyle = grad2;
        ctx.fillRect(0, 0, 256, 64);
        var tex = new THREE.CanvasTexture(c);
        return tex;
    },

    // ---------------------------------------------------------------------
    // Bank textures, colour-matched to ARCHIVES/REFERENCES/RIVER/SHORELINES/.
    //
    // The old ones were flat 2px noise over a single fill, which is most of
    // why the banks read as "computer game". Real PNW cutbanks are a dark
    // umber wall with an undercut shadow at the water, horizontal silt
    // bedding, cobble poking out, and a pale straw grass fringe on top -- so
    // that's what these build, in several octaves rather than one.
    // ---------------------------------------------------------------------
    _fbmFill: function (ctx, w, h, base, octaves) {
        var img = ctx.createImageData(w, h);
        var d = img.data;
        var seedA = Math.random() * 100, seedB = Math.random() * 100;
        var x, y, i, n, o, amp, freq, v;
        for (y = 0; y < h; y++) {
            for (x = 0; x < w; x++) {
                n = 0; amp = 1; freq = 0.045;
                for (o = 0; o < octaves; o++) {
                    n += amp * (Math.sin(x * freq + seedA + o * 1.7) *
                                Math.cos(y * freq * 1.31 + seedB + o * 2.3));
                    amp *= 0.52; freq *= 2.17;
                }
                v = n * 0.5 + (Math.random() - 0.5) * 0.5;   // grain on top
                i = (y * w + x) * 4;
                d[i]     = Math.max(0, Math.min(255, base[0] + v * base[3]));
                d[i + 1] = Math.max(0, Math.min(255, base[1] + v * base[4]));
                d[i + 2] = Math.max(0, Math.min(255, base[2] + v * base[5]));
                d[i + 3] = 255;
            }
        }
        ctx.putImageData(img, 0, 0);
    },

    // IMPORTANT: the bank mesh maps u (texture X) to cross-bank distance --
    // u=0 is the waterline, u=1 is the top of the cut -- and v (texture Y)
    // runs along the river. So the cut's layering is built along X here, and
    // the silt bedding, which is horizontal in the world, is drawn as
    // vertical strokes in the canvas.
    _makeEarthTexture: function () {
        var c = document.createElement('canvas');
        c.width = 256; c.height = 256;
        var ctx = c.getContext('2d');

        // dark umber body, mottled
        this._fbmFill(ctx, 256, 256, [58, 46, 34, 26, 22, 16], 4);

        // silt bedding: lines of constant height, i.e. constant x
        var i, x;
        for (i = 0; i < 26; i++) {
            x = 30 + Math.random() * 190;
            ctx.strokeStyle = 'rgba(' + (78 + Math.random() * 34 | 0) + ',' +
                              (64 + Math.random() * 26 | 0) + ',48,' + (0.10 + Math.random() * 0.16) + ')';
            ctx.lineWidth = 0.6 + Math.random() * 2.4;
            ctx.beginPath();
            ctx.moveTo(x, 0);
            ctx.bezierCurveTo(x + (Math.random() - 0.5) * 7, 85,
                              x + (Math.random() - 0.5) * 7, 170, x, 256);
            ctx.stroke();
        }

        // cobble and roots in the face
        for (i = 0; i < 90; i++) {
            var cx = 24 + Math.random() * 200, cy = Math.random() * 256;
            var rr = 1.2 + Math.random() * 3.4;
            var lum = 96 + Math.random() * 54;
            ctx.fillStyle = 'rgba(' + (lum | 0) + ',' + (lum * 0.93 | 0) + ',' + (lum * 0.8 | 0) + ',0.5)';
            ctx.beginPath(); ctx.ellipse(cx, cy, rr * 0.72, rr, Math.random() * 3, 0, Math.PI * 2); ctx.fill();
            ctx.fillStyle = 'rgba(18,13,8,0.35)';
            ctx.beginPath(); ctx.ellipse(cx - rr * 0.5, cy, rr * 0.34, rr * 0.85, 0, 0, Math.PI * 2); ctx.fill();
        }

        // undercut shadow at the waterline (u near 0, so canvas x near 0)
        var shade = ctx.createLinearGradient(0, 0, 54, 0);
        shade.addColorStop(0, 'rgba(10,8,6,0.82)');
        shade.addColorStop(1, 'rgba(10,8,6,0)');
        ctx.fillStyle = shade;
        ctx.fillRect(0, 0, 54, 256);

        // damp cobble along the water's edge
        for (i = 0; i < 60; i++) {
            var gx = 2 + Math.random() * 26, gy = Math.random() * 256;
            var gl = 84 + Math.random() * 46;
            ctx.fillStyle = 'rgba(' + (gl | 0) + ',' + (gl * 0.97 | 0) + ',' + (gl * 0.9 | 0) + ',0.5)';
            ctx.beginPath(); ctx.ellipse(gx, gy, 1.1 + Math.random() * 1.7, 1.4 + Math.random() * 2.6, 0, 0, Math.PI * 2); ctx.fill();
        }

        // pale straw fringe spilling over the top of the cut (u near 1)
        var fringe = ctx.createLinearGradient(256, 0, 214, 0);
        fringe.addColorStop(0, 'rgba(150,142,92,0.94)');
        fringe.addColorStop(1, 'rgba(150,142,92,0)');
        ctx.fillStyle = fringe;
        ctx.fillRect(214, 0, 42, 256);
        for (i = 0; i < 200; i++) {
            var by = Math.random() * 256;
            var bl = 12 + Math.random() * 24;
            ctx.strokeStyle = 'rgba(' + (128 + Math.random() * 58 | 0) + ',' +
                              (122 + Math.random() * 52 | 0) + ',' + (66 + Math.random() * 34 | 0) + ',0.6)';
            ctx.lineWidth = 0.7;
            ctx.beginPath();
            ctx.moveTo(256, by);
            ctx.quadraticCurveTo(256 - bl * 0.6, by + (Math.random() - 0.5) * 5,
                                 256 - bl, by + (Math.random() - 0.5) * 9);
            ctx.stroke();
        }

        var tex = new THREE.CanvasTexture(c);
        tex.wrapS = THREE.RepeatWrapping;
        tex.wrapT = THREE.RepeatWrapping;
        return tex;
    },

    // The flat behind the cut: straw grass going to low willow scrub, the pale
    // yellow-green of the reference shots rather than a saturated forest green.
    _makeGrassTexture: function () {
        var c = document.createElement('canvas');
        c.width = 256; c.height = 256;
        var ctx = c.getContext('2d');

        this._fbmFill(ctx, 256, 256, [116, 128, 74, 30, 32, 22], 4);

        var i;
        // straw patches
        for (i = 0; i < 34; i++) {
            var px = Math.random() * 256, py = Math.random() * 256;
            var pr = 10 + Math.random() * 42;
            var g = ctx.createRadialGradient(px, py, 1, px, py, pr);
            g.addColorStop(0, 'rgba(176,166,108,' + (0.16 + Math.random() * 0.24) + ')');
            g.addColorStop(1, 'rgba(176,166,108,0)');
            ctx.fillStyle = g;
            ctx.beginPath(); ctx.arc(px, py, pr, 0, Math.PI * 2); ctx.fill();
        }
        // darker scrub clumps
        for (i = 0; i < 26; i++) {
            var sx = Math.random() * 256, sy = Math.random() * 256;
            var sr = 8 + Math.random() * 26;
            var g2 = ctx.createRadialGradient(sx, sy, 1, sx, sy, sr);
            g2.addColorStop(0, 'rgba(58,84,44,' + (0.22 + Math.random() * 0.26) + ')');
            g2.addColorStop(1, 'rgba(58,84,44,0)');
            ctx.fillStyle = g2;
            ctx.beginPath(); ctx.arc(sx, sy, sr, 0, Math.PI * 2); ctx.fill();
        }
        // blades
        for (i = 0; i < 340; i++) {
            var bx = Math.random() * 256, by = Math.random() * 256;
            ctx.strokeStyle = 'rgba(' + (96 + Math.random() * 76 | 0) + ',' +
                              (112 + Math.random() * 68 | 0) + ',' + (58 + Math.random() * 40 | 0) + ',0.42)';
            ctx.lineWidth = 0.6;
            ctx.beginPath();
            ctx.moveTo(bx, by);
            ctx.lineTo(bx + (Math.random() - 0.5) * 3, by - 2 - Math.random() * 5);
            ctx.stroke();
        }

        var tex = new THREE.CanvasTexture(c);
        tex.wrapS = THREE.RepeatWrapping;
        tex.wrapT = THREE.RepeatWrapping;
        return tex;
    },

    _createMountains: function () {
        // These are flat backdrop planes. The river now genuinely wanders, so
        // they can't just sit at the world origin -- update() parks them on the
        // horizon ahead of the camera every frame. Keep their offsets here.
        this._backdrop = [];
        var layers = [
            { color: 0xA9BAC4, y: 60, z: 2500, scaleY: 180, opacity: 0.8, snow: true },
            { color: 0x8AA0A7, y: 30, z: 1800, scaleY: 140, opacity: 0.9, snow: false },
            { color: 0x6F8989, y: 0, z: 1200, scaleY: 100, opacity: 1.0, snow: false }
        ];

        for (var li = 0; li < layers.length; li++) {
            var L = layers[li];
            var shape = new THREE.Shape();
            var W = 6000;
            shape.moveTo(-W, -180);
            var peaks = 160;
            for (var p = 0; p <= peaks; p++) {
                var px = -W + (p / peaks) * W * 2;
                var py = (Math.sin(p * 0.15 + li * 2.3) * 0.5 + 0.5) * L.scaleY;
                py += Math.sin(p * 0.37 + li) * L.scaleY * 0.15 + Math.sin(p * 1.43) * L.scaleY * 0.025;
                if (p === 0 || p === peaks) py *= 0.5;
                shape.lineTo(px, py);
            }
            shape.lineTo(W, -180);
            shape.lineTo(-W, -180);

            var geo = new THREE.ShapeGeometry(shape);
            var mat = new THREE.MeshBasicMaterial({
                color: L.color, transparent: L.opacity < 1, opacity: L.opacity,
                side: THREE.DoubleSide, depthWrite: true, fog: false
            });
            var mesh = new THREE.Mesh(geo, mat);
            mesh.position.set(0, L.y, L.z);
            mesh.renderOrder = -10 + li;
            this.scene.add(mesh);
            this._backdrop.push({ mesh: mesh, y: L.y, dist: L.z });


        }

        var treeLineGeo = new THREE.PlaneGeometry(6000, 170);
        var treeLineMat = new THREE.MeshBasicMaterial({
            map: this._makeTreeLineTexture(), color: 0xFFFFFF,
            transparent: true, opacity: 0.78, alphaTest: 0.04,
            side: THREE.DoubleSide, fog: true
        });
        var treeLineMesh = new THREE.Mesh(treeLineGeo, treeLineMat);
        treeLineMesh.position.set(0, 82, 1100);
        treeLineMesh.renderOrder = -5;
        this.scene.add(treeLineMesh);
        this._treeLineMesh = treeLineMesh;
        this._backdrop.push({ mesh: treeLineMesh, y: 82, dist: 1100 });
    },

    // Layered transparent foliage replaces the former flat green rectangle.
    // Nearby 3D trees retain the sharp detail and parallax.
    _makeTreeLineTexture: function () {
        if (this._treeLineTex) return this._treeLineTex;
        var c = document.createElement('canvas');
        c.width = 2048; c.height = 256;
        var x = c.getContext('2d');
        function rand(n) {
            var v = Math.sin(n * 12.9898 + 4.17) * 43758.5453;
            return v - Math.floor(v);
        }
        for (var layer = 0; layer < 3; layer++) {
            var baseY = 248 - layer * 8;
            var count = 82 + layer * 26;
            x.fillStyle = layer === 0 ? 'rgba(34,57,37,0.52)' :
                (layer === 1 ? 'rgba(43,73,43,0.70)' : 'rgba(54,88,48,0.88)');
            for (var i = 0; i < count; i++) {
                var px = (i / (count - 1)) * 2070 - 11;
                var r = rand(i + layer * 311);
                var h = 48 + r * 94 - layer * 8;
                var w = 18 + rand(i * 3 + layer * 97) * 34;
                if (rand(i * 7 + layer * 41) > 0.83) {
                    x.beginPath(); x.moveTo(px, baseY - h);
                    x.lineTo(px - w * 0.72, baseY);
                    x.lineTo(px + w * 0.72, baseY);
                    x.closePath(); x.fill();
                } else {
                    x.beginPath();
                    x.ellipse(px, baseY - h * 0.56, w, h * 0.48,
                        (rand(i * 11) - 0.5) * 0.18, 0, Math.PI * 2);
                    x.fill();
                }
            }
        }
        var bank = x.createLinearGradient(0, 205, 0, 256);
        bank.addColorStop(0, 'rgba(45,72,39,0)');
        bank.addColorStop(0.45, 'rgba(39,65,35,0.88)');
        bank.addColorStop(1, 'rgba(22,39,25,0.98)');
        x.fillStyle = bank; x.fillRect(0, 205, 2048, 51);
        this._treeLineTex = new THREE.CanvasTexture(c);
        this._treeLineTex.wrapS = THREE.RepeatWrapping;
        this._treeLineTex.repeat.set(2, 1);
        this._treeLineTex._rrShared = true;   // memoized -- see _disposeGroup
        return this._treeLineTex;
    },

    _createWaterMesh: function () {
        if (this.waterMesh) {
            this.scene.remove(this.waterMesh);
            this.waterMesh.geometry.dispose();
            this.waterMesh.material.dispose();
        }

        // Water extends behind the starting boat and chase camera. Without
        // this apron, the lower screen shows the pale scene background at z=0.
        var first = this.riverPath[0];
        var path = [{x:first.x-Math.sin(first.heading)*400,
            z:first.z-Math.cos(first.heading)*400,width:first.width,seg:first.seg}].concat(this.riverPath);
        var normals = [this.riverNormals[0]].concat(this.riverNormals);
        var total = path.length - 1;
        var verts = new Float32Array(total * 6 * 3);
        var uvs = new Float32Array(total * 6 * 2);
        var vi = 0, ui = 0;

        for (var i = 0; i < total; i++) {
            var p0 = path[i], p1 = path[i + 1];
            var n0 = normals[i], n1 = normals[i + 1];
            var hw0 = p0.width * 0.5, hw1 = p1.width * 0.5;

            var lx0 = p0.x + n0.x * hw0, lz0 = p0.z + n0.z * hw0;
            var rx0 = p0.x - n0.x * hw0, rz0 = p0.z - n0.z * hw0;
            var lx1 = p1.x + n1.x * hw1, lz1 = p1.z + n1.z * hw1;
            var rx1 = p1.x - n1.x * hw1, rz1 = p1.z - n1.z * hw1;

            var v0 = i / total, v1 = (i + 1) / total;

            verts[vi++] = lx0; verts[vi++] = -0.1; verts[vi++] = lz0;
            verts[vi++] = rx0; verts[vi++] = -0.1; verts[vi++] = rz0;
            verts[vi++] = lx1; verts[vi++] = -0.1; verts[vi++] = lz1;
            verts[vi++] = rx0; verts[vi++] = -0.1; verts[vi++] = rz0;
            verts[vi++] = rx1; verts[vi++] = -0.1; verts[vi++] = rz1;
            verts[vi++] = lx1; verts[vi++] = -0.1; verts[vi++] = lz1;

            uvs[ui++] = 0; uvs[ui++] = v0;
            uvs[ui++] = 1; uvs[ui++] = v0;
            uvs[ui++] = 0; uvs[ui++] = v1;
            uvs[ui++] = 1; uvs[ui++] = v0;
            uvs[ui++] = 1; uvs[ui++] = v1;
            uvs[ui++] = 0; uvs[ui++] = v1;
        }

        // SHALLOWS YOU CAN SEE (2026-10-26). Tyler: "if water is going to be
        // shallow make it look different and shallow." The shallows were
        // gameplay only -- they slow and steer you badly outside |lateral|
        // 0.3 -- and drawn as ordinary water. Each vertex now carries the
        // shallow depth of its segment on each side (x = left bank, y =
        // right), feathered over a few segments so it fades in, and the
        // shader shows gravel through clear water with broken riffles.
        var shRaw = [];
        for (i = 0; i < path.length; i++) {
            var sg = path[i].seg;
            shRaw.push([sg ? (sg.shallowLeft || 0) : 0, sg ? (sg.shallowRight || 0) : 0]);
        }
        var shF = [];
        for (i = 0; i < path.length; i++) {
            var aL = 0, aR = 0, cnt = 0;
            for (var k = -4; k <= 4; k++) {
                var q = Math.max(0, Math.min(path.length - 1, i + k));
                aL += shRaw[q][0]; aR += shRaw[q][1]; cnt++;
            }
            shF.push([aL / cnt, aR / cnt]);
        }
        var shal = new Float32Array(total * 6 * 2), si2 = 0;
        for (i = 0; i < total; i++) {
            var order = [i, i, i + 1, i, i + 1, i + 1];
            for (var oi = 0; oi < 6; oi++) {
                shal[si2++] = shF[order[oi]][0];
                shal[si2++] = shF[order[oi]][1];
            }
        }

        var geo = new THREE.BufferGeometry();
        geo.setAttribute('position', new THREE.BufferAttribute(verts, 3));
        geo.setAttribute('uv', new THREE.BufferAttribute(uvs, 2));
        geo.setAttribute('aShallow', new THREE.BufferAttribute(shal, 2));
        geo.computeVertexNormals();

        var bankCol = (RR.River.profile && RR.River.profile.colors && RR.River.profile.colors.bank) || 0xA09070;
        this.waterUniforms = {
            uGravelColor: { value: new THREE.Color(bankCol).multiplyScalar(0.62) },
            uChop: { value: 1 },
            uSediment: { value: 0.1 },
            uFogDensity: { value: 0.0015 },
            uReflection: { value: null },
            uReflectionMatrix: { value: new THREE.Matrix4() },
            uReflectionStrength: { value: 0 },
            uFogColor: { value: this.scene.fog.color },
            uTime: { value: 0 },
            uDeepColor: { value: new THREE.Color(0x1E4540) },
            uMidColor: { value: new THREE.Color(0x2A5E52) },
            uShallowColor: { value: new THREE.Color(0x4A7868) },
            uReflectColor: { value: new THREE.Color(0x6A9A88) },
            uSkyColor: { value: new THREE.Color(0xA0C0B0) },
            uSunDir: { value: new THREE.Vector3(0.3, 0.8, 0.5).normalize() },
            uCamPos: { value: new THREE.Vector3() }
        };

        var mat = new THREE.ShaderMaterial({
            uniforms: this.waterUniforms,
            vertexShader: [
                'attribute vec2 aShallow;',
                'varying vec2 vUv;',
                'varying vec2 vShallow;',
                'varying vec3 vWorldPos;',
                'varying vec3 vNormal;',
                'void main() {',
                '  vUv = uv;',
                '  vShallow = aShallow;',
                '  vec4 wp = modelMatrix * vec4(position, 1.0);',
                '  vWorldPos = wp.xyz;',
                '  vNormal = normalize(normalMatrix * normal);',
                '  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);',
                '}'
            ].join('\n'),
            fragmentShader: this._closeFrag([
                'uniform float uTime;',
                'uniform vec3 uDeepColor;',
                'uniform vec3 uMidColor;',
                'uniform vec3 uShallowColor;',
                'uniform vec3 uReflectColor;',
                'uniform vec3 uSkyColor;',
                'uniform vec3 uSunDir;',
                'uniform vec3 uCamPos;',
                'uniform vec3 uGravelColor;',
                'uniform float uChop;',
                'uniform float uSediment;',
                'uniform float uFogDensity;',
                'uniform sampler2D uReflection;',
                'uniform mat4 uReflectionMatrix;',
                'uniform float uReflectionStrength;',
                'uniform vec3 uFogColor;',
                'varying vec2 vUv;',
                'varying vec2 vShallow;',
                'varying vec3 vWorldPos;',
                'varying vec3 vNormal;',
                '',
                'float hash(vec2 p) {',
                '  return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453);',
                '}',
                'float noise(vec2 p) {',
                '  vec2 i = floor(p);',
                '  vec2 f = fract(p);',
                '  f = f * f * (3.0 - 2.0 * f);',
                '  float a = hash(i);',
                '  float b = hash(i + vec2(1.0, 0.0));',
                '  float c = hash(i + vec2(0.0, 1.0));',
                '  float d = hash(i + vec2(1.0, 1.0));',
                '  return mix(mix(a, b, f.x), mix(c, d, f.x), f.y);',
                '}',
                'float fbm(vec2 p) {',
                '  float v = 0.0;',
                '  float a = 0.5;',
                '  for (int i = 0; i < 4; i++) {',
                '    v += a * noise(p);',
                '    p *= 2.1;',
                '    a *= 0.5;',
                '  }',
                '  return v;',
                '}',
                '',
                'void main() {',
                '  vec2 flowUV = vWorldPos.xz * 0.08;',
                '  flowUV.y += uTime * 0.15;',
                '  float ripple = fbm(flowUV * 3.0 + uTime * 0.3);',
                '  float ripple2 = fbm(flowUV * 6.0 - uTime * 0.2);',
                '  float wave = ripple * 0.6 + ripple2 * 0.4;',
                '',
                // Analytic wave slopes: long wind ripples crossed by short chop.
                '  float a = dot(vWorldPos.xz, vec2(0.28, 0.19)) + uTime * 1.9;',
                '  float b = dot(vWorldPos.xz, vec2(-0.48, 0.32)) + uTime * 2.7;',
                '  float c = dot(vWorldPos.xz, vec2(1.16, 0.57)) - uTime * 3.8;',
                '  float dist = length(uCamPos - vWorldPos);',
                '  float detail = 1.0 - smoothstep(80.0, 650.0, dist);',
                '  vec2 slope = vec2(0.28,0.19)*cos(a)*0.24 + vec2(-0.48,0.32)*cos(b)*0.12;',
                '  slope += vec2(1.16,0.57)*cos(c)*0.038*detail;',
                '  slope *= uChop;',
                '  vec3 perturbNormal = normalize(vec3(-slope.x, 1.0, -slope.y));',
                '  vec3 viewDir = normalize(uCamPos - vWorldPos);',
                '  float fresnel = pow(1.0 - max(dot(viewDir, perturbNormal), 0.0), 3.0);',
                '  fresnel = mix(0.1, 0.9, fresnel);',
                '',
                '  float depth = vUv.x;',
                '  float edgeDist = min(depth, 1.0 - depth) * 2.0;',
                '  vec3 waterCol = mix(uShallowColor, uDeepColor, smoothstep(0.0, 0.5, edgeDist));',
                '  waterCol = mix(waterCol, uMidColor, wave * 0.3);',
                '',
                '  vec3 reflCol = mix(uReflectColor, uSkyColor, fresnel);',
                '  vec4 projected = uReflectionMatrix * vec4(vWorldPos, 1.0);',
                '  vec2 reflectionUV = projected.xy / max(projected.w, 0.001);',
                '  reflectionUV += slope * (0.018 * detail + 0.002);',
                '  vec3 reflected = texture2D(uReflection, clamp(reflectionUV, 0.002, 0.998)).rgb;',
                '  reflCol = mix(reflCol, reflected, uReflectionStrength);',
                '  vec3 col = mix(waterCol, reflCol, (0.12 + fresnel * 0.72) * (1.0 - 0.62*uSediment));',
                '',
                '  float streaks = smoothstep(0.48, 0.52, noise(flowUV * vec2(1.0, 8.0) + uTime * 0.4));',
                '  col = mix(col, uReflectColor, streaks * 0.055);',
                '',
                '  float edgeNoise = fbm(flowUV * vec2(1.8, 5.5) - uTime * 0.22);',
                '  float edgeFoam = (1.0 - smoothstep(0.0, 0.11, edgeDist)) *',
                '                   smoothstep(0.35, 0.72, edgeNoise);',
                '  col = mix(col, ' + this._waterVec('foam') + ', edgeFoam * ' + this.WATER_FOAM_AMT.toFixed(3) + ');',
                '  float glint = pow(max(0.0, wave - 0.68), 2.0) * (0.2 + fresnel);',
                '  col += ' + this._waterVec('glint') + ' * glint * ' + this.WATER_GLINT_AMT.toFixed(3) + ';',
                '',
                '  float spec = pow(max(dot(reflect(-uSunDir, perturbNormal), viewDir), 0.0), 64.0);',
                '  col += ' + this._waterVec('spec') + ' * spec * ' + this.WATER_SPEC_AMT.toFixed(3) + ';',
                '',
                '',
                // Shallows: uv.x 0 is lateral +1 (right), 1 is lateral -1.
                '  float lat = 1.0 - 2.0 * vUv.x;',
                '  float shDepth = lat < 0.0 ? vShallow.x : vShallow.y;',
                '  float sh = clamp(shDepth, 0.0, 1.0) * smoothstep(0.22, 0.42, abs(lat));',
                '  if (sh > 0.001) {',
                '    float peb = noise(vWorldPos.xz * 0.55) * 0.6 + noise(vWorldPos.xz * 1.7) * 0.4;',
                '    vec3 bed = uGravelColor * (0.72 + 0.6 * peb);',
                '    col = mix(col, bed, sh * 0.62);',
                '    float riff = noise(flowUV * vec2(5.0, 16.0) + vec2(0.0, uTime * 1.6));',
                '    riff = smoothstep(0.62, 0.78, riff) * (0.6 + 0.4 * noise(flowUV * 2.0 - uTime));',
                '    col = mix(col, ' + this._waterVec('foam') + ', riff * sh * 0.55);',
                '  }',
                '  float haze = 1.0 - exp(-uFogDensity * uFogDensity * dist * dist);',
                '  col = mix(col, uFogColor, haze);',
                '  gl_FragColor = vec4(col, 1.0);'
            ]),
            transparent: false,
            side: THREE.DoubleSide
        });

        this.waterMesh = new THREE.Mesh(geo, mat);
        this.scene.add(this.waterMesh);
    },

    // Rolling ground behind the banks. Both the ground mesh and the tree
    // planting read from this, so the trees stay rooted in the hillside
    // instead of floating over it. Clamped at 0 so some stretches stay flat.
    _hillAt: function (i, side) {
        var h = Math.sin(i * 0.0115 + side * 2.3) * 11 +
                Math.sin(i * 0.0037 + side * 0.7) * 19 +
                Math.sin(i * 0.0310 + side * 4.1) * 4.5;
        return Math.max(0, h + 8);
    },

    _createBankMeshes: function () {
        // Geometry alone is not enough: this builder makes FOUR fresh canvas
        // textures every time (earth and grass, one pair per bank), and only
        // the geometry was being freed. Measured at +4 textures per rebuild,
        // 20 per tour of five rivers, growing without limit.
        this._disposeGroup(this.bankLeftMesh);
        this._disposeGroup(this.bankRightMesh);
        this._disposeGroup(this.groundLeftMesh);
        this._disposeGroup(this.groundRightMesh);
        if (this.bankLeftMesh) this.scene.remove(this.bankLeftMesh);
        if (this.bankRightMesh) this.scene.remove(this.bankRightMesh);
        if (this.groundLeftMesh) this.scene.remove(this.groundLeftMesh);
        if (this.groundRightMesh) this.scene.remove(this.groundRightMesh);

        var earthTex = this._makeEarthTexture();
        earthTex.repeat.set(1, 60);   // u spans the cut once: waterline -> top
        var grassTex = this._makeGrassTexture();
        grassTex.repeat.set(3, 60);

        var earthMat = new THREE.MeshStandardMaterial({
            map: earthTex, roughness: 0.92, metalness: 0.0, side: THREE.DoubleSide
        });
        var grassMat = new THREE.MeshStandardMaterial({
            map: grassTex, roughness: 0.88, metalness: 0.0, side: THREE.DoubleSide
        });

        var path = this.riverPath;
        var normals = this.riverNormals;
        var total = path.length - 1;
        var BW = this.BANK_WIDTH;
        var bankH = 3.5;

        // ---- SMOOTH, LOFTED SHORE -----------------------------------------
        //
        // Was: ONE quad laterally for the bank (waterline out to +9 units) and
        // ONE for the ground (+9 out to +90), both non-indexed -- so
        // computeVertexNormals had no shared vertices to average and gave every
        // triangle a flat face normal. Two lateral quads and flat shading
        // across a hundred units of shoreline is most of what reads as
        // "blocky", and a real cross-section is what the Godot spike's smoother
        // bank was actually doing differently.
        //
        // Now each side is an INDEXED grid: rings across the shore, columns
        // along the river. Indexed is the whole point -- shared vertices let
        // computeVertexNormals average across the lateral seams, so the cut
        // rounds over its lip and the bank top curves into the hillside instead
        // of folding at a hard crease.
        //
        // THE UV CONVENTION IS UNCHANGED AND MUST STAY THAT WAY: u runs ACROSS
        // the shore (u=0 at the waterline), v runs along the river. That is why
        // _makeEarthTexture builds its layering along X and the maps repeat
        // (n, 60). Get it backwards and the detail smears -- see Part 3.
        var ease = function (t) { return t * t * (3 - 2 * t); };
        var self2 = this;

        function loft(side, R, offOf, yOf) {
            var cols = total + 1;
            var pos = new Float32Array(cols * R * 3);
            var uvs = new Float32Array(cols * R * 2);
            var idx = new Uint32Array(total * (R - 1) * 6);
            var i, r, k = 0;
            for (i = 0; i < cols; i++) {
                var p = path[i], n = normals[i];
                var hw = p.width * 0.5;
                for (r = 0; r < R; r++) {
                    var f = r / (R - 1);
                    var o = i * R + r;
                    var off = offOf(f);
                    pos[o * 3]     = p.x + side * n.x * (hw + off);
                    pos[o * 3 + 1] = yOf(i, side > 0 ? 0 : 1, f);
                    pos[o * 3 + 2] = p.z + side * n.z * (hw + off);
                    uvs[o * 2]     = f;
                    uvs[o * 2 + 1] = i / total;
                }
            }
            for (i = 0; i < total; i++) {
                for (r = 0; r < R - 1; r++) {
                    var a = i * R + r, b = a + 1, c = a + R, d = c + 1;
                    idx[k++] = a; idx[k++] = b; idx[k++] = c;
                    idx[k++] = b; idx[k++] = d; idx[k++] = c;
                }
            }
            var g = new THREE.BufferGeometry();
            g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
            g.setAttribute('uv', new THREE.BufferAttribute(uvs, 2));
            g.setIndex(new THREE.BufferAttribute(idx, 1));
            g.computeVertexNormals();
            // Winding sets which way the normals point, the two sides wind
            // opposite ways, and a bank lit from underneath renders black.
            // Rather than reason it out per side: measure it and flip.
            var na = g.getAttribute('normal').array, sumY = 0, q;
            for (q = 1; q < na.length; q += 3) sumY += na[q];
            if (sumY < 0) {
                var ia = g.index.array;
                for (q = 0; q < ia.length; q += 3) {
                    var tmp = ia[q]; ia[q] = ia[q + 2]; ia[q + 2] = tmp;
                }
                g.index.needsUpdate = true;
                g.computeVertexNormals();
            }
            return g;
        }

        // The cut: waterline up to the bank top, eased so it rounds the lip.
        var BANK_OUT = BW * 0.3;
        function bankOff(f) { return BANK_OUT * f; }
        // Through the canyon shortcut the +lateral bank and ground drop under
        // the water so the tunnel lane is open (see _buildShortcut).
        var scR = RR.River.shortcut;
        function inTunnel(i, sideIdx, off) {
            if (!scR || sideIdx !== 0 || i < scR.start - 2 || i > scR.end + scR.exit + 2) return false;
            var hw = path[i].width * 0.5;
            var lat = 1 + off / Math.max(1, hw);
            return lat < self2._shortcutWallLat(i, scR) + 0.4;
        }
        function bankY(i, sideIdx, f) {
            if (inTunnel(i, sideIdx, BANK_OUT * f)) return -4;
            return -0.1 + 3.6 * ease(f);
        }

        // The hillside: bank top out into the timber. Reaches BW * 4 rather
        // than the old BW * 3 -- _generateTrees plants out to roughly +102 and
        // the ground stopped at +90, so the outermost row of trees was standing
        // past the edge of the terrain.
        var GROUND_OUT = BW * 4;
        function groundOff(f) { return BANK_OUT + (GROUND_OUT - BANK_OUT) * f; }
        function groundY(i, sideIdx, f) {
            if (inTunnel(i, sideIdx, groundOff(f))) return -4;
            return bankH + (self2._hillAt(i, sideIdx) - 0.3) * ease(f);
        }

        this.bankLeftMesh   = new THREE.Mesh(loft(1, 5, bankOff, bankY), earthMat);
        this.bankRightMesh  = new THREE.Mesh(loft(-1, 5, bankOff, bankY), earthMat.clone());
        this.bankRightMesh.material.map = this._makeEarthTexture();
        this.bankRightMesh.material.map.repeat.set(2, 60);
        this.groundLeftMesh  = new THREE.Mesh(loft(1, 7, groundOff, groundY), grassMat);
        this.groundRightMesh = new THREE.Mesh(loft(-1, 7, groundOff, groundY), grassMat.clone());
        this.groundRightMesh.material.map = this._makeGrassTexture();
        this.groundRightMesh.material.map.repeat.set(3, 60);

        this.scene.add(this.bankLeftMesh);
        this.scene.add(this.bankRightMesh);
        this.scene.add(this.groundLeftMesh);
        this.scene.add(this.groundRightMesh);
    },

    _generateTrees: function () {
        this.treeData = [];
        // A desert river has no alder wall. Skip the standard bank timber
        // entirely where the profile plants palms instead -- otherwise the
        // palms are lost inside a hedge of round green trees and the Nile
        // looks like Washington with pyramids behind it.
        var prof = RR.River.profile;
        if (prof && prof.palms) return;

        var path = this.riverPath;
        var normals = this.riverNormals;

        var inner = this.BANK_WIDTH * 0.3;
        var outer = this.BANK_WIDTH * 3;
        var bankTop = 3.5;
        var self = this;

        // TREE SIZE, 2026-10-26 (Tyler: "make these trees way bigger,
        // different sizes, different color"). The hull is ~33 drawn units for
        // a 20' boat, so 1 unit is about 0.6 ft. The old 5-19 unit trees were
        // 3-11 ft -- shrubs next to the boat. A riverbank alder or cottonwood
        // is 40-90 ft. These run 26-72 units with the odd giant past 100; the
        // front row (willow and young alder at the waterline) stays smaller
        // so the bank still steps up.
        //
        // Conifers are back as a minority: fir and cedar stand behind the
        // alder wall on the northern rivers. Tropical and desert rivers get
        // none.
        var CONIFER_MIX = { skyqualmie: 0.28, rogue: 0.42, rhine: 0.30, colorado: 0.18 };
        var conMix = (prof && CONIFER_MIX[prof.id] !== undefined) ? CONIFER_MIX[prof.id] : 0;

        // Where the river pinches down near the head of navigation, the
        // timber crowds right in on the water and the trees get big.
        var scT = RR.River.shortcut;
        function plant(i, p, n, side, spread, narrow, row) {
            if (scT && side === 0 && i > scT.start - 4 && i < scT.end + scT.exit + 4) return;
            var sgn = side === 0 ? 1 : -1;
            var outFrac = Math.max(0, Math.min(1, (spread - inner) / (outer - inner)));
            var lean = narrow * 0.55;                       // pulled toward the channel
            var d = p.width * 0.5 + spread * (1 - lean);
            var h = 26 + Math.pow(Math.random(), 1.4) * 46;          // 26-72
            if (Math.random() < 0.10) h += 20 + Math.random() * 25;  // the odd giant
            if (row === 0) h *= 0.62;                                 // waterline scrub
            h *= 1 + narrow * 0.4;
            var conifer = row > 0 && Math.random() < conMix;
            if (conifer) h *= 1.15;
            d += h * 0.16;            // crown clears the waterline instead of hanging over the lane
            self.treeData.push({
                x: p.x + sgn * n.x * d + (Math.random() - 0.5) * 6,
                z: p.z + sgn * n.z * d + (Math.random() - 0.5) * 6,
                y: bankTop + self._hillAt(i, side) * outFrac,
                h: h,
                type: conifer ? 0 : 1,
                w: 0.8 + Math.random() * 0.45,                // crown width
                shade: Math.floor(Math.random() * 8),
                jit: Math.random()                            // per-tree colour jitter
            });
        }

        for (var i = 0; i < path.length - 1; i++) {
            var p = path[i];
            var n = normals[i];
            var narrow = (p.seg && p.seg.narrowness) ? p.seg.narrowness : 0;
            // treeMult finally reaches the planting. It was read nowhere, so
            // every river grew the same wall of timber and the Grand Canyon got
            // a full PNW alder forest -- the only thing that actually differed
            // between profiles was the foliage tint. The Skyqualmie is 1.45,
            // the Nile 0.30, and now you can see it.
            var density = (RR.River.profile && RR.River.profile.treeMult) || 1;
            var rows = Math.max(1, Math.round((5 + narrow * 3) * Math.min(1.5, density)));

            for (var row = 0; row < rows; row++) {
                var spread = this.BANK_WIDTH * 0.2 + row * this.TREE_SPREAD * 0.25 + Math.random() * 6;
                // Big crowns overlap, so far fewer trees make the same wall.
                var pChance = Math.min(0.6, 0.36 * Math.min(1.35, density)) * (RR.Config.LITE ? 0.55 : 1);
                if (Math.random() < pChance) plant(i, p, n, 0, spread, narrow, row);
                if (Math.random() < pChance) plant(i, p, n, 1, spread, narrow, row);
            }
        }

        // ---- TIMBER ON THE GRAVEL BARS ------------------------------------
        //
        // Tyler, 2026-09-03, after a run: the islands "just came out of nowhere
        // and I ran into them". Measured on the first Skyqualmie braid, boat at
        // 179 drawn units/sec:
        //
        //   1000 units out (5.6 s)    184 px    0.02% of frame
        //    500 units out (2.8 s)  1,047 px    0.11%
        //    250 units out (1.4 s)  3,633 px    0.39%
        //
        // It only becomes appreciable inside about 1.5 seconds, and
        // centre-to-bank steering alone takes 1.2. So it is not a fog problem
        // or a draw-distance problem -- VISIBLE_SEGS_AHEAD is 120, i.e. 1,200
        // drawn units. The island is simply FLAT: its crest stands about 6
        // units above the water, which is ~9 screen pixels at 500 units.
        //
        // A tree is 5-19 units. Timber on the bar is the cheapest thing in the
        // game that triples the silhouette, and every gravel bar in
        // ARCHIVES/REFERENCES/RIVER carries scrub and cottonwood anyway. These
        // go into treeData, so they are instanced, culled and shadowed with
        // everything else for free.
        //
        // Heights are deliberately shorter than bank timber -- a bar grows
        // willow and young cottonwood, not a mature alder wall -- and they are
        // seated on the ellipse of the green mound so nothing floats.
        var IH = RR.Config.ISLAND_HEIGHT;
        // _noIslandTimber is a MEASUREMENT hook, not a feature: build once with
        // and once without to diff what the timber actually contributes.
        //
        // Since 2026-10-26 the timber follows each island's LOOK (see
        // _createIslandMeshes): a wooded island is planted every couple of
        // segments, a meadow sparsely, a gravel bar with only the odd willow.
        // Trees stand inside the mound (|u| < 0.55) and sit on the same
        // cross-section the mesh is built from, so nothing floats.
        var runs = this._noIslandTimber ? [] : this._islandRuns();
        var SEGL = RR.Config.SEGMENT_LENGTH;
        for (var rr = 0; rr < runs.length; rr++) {
            var run = runs[rr], look = this._ISLAND_LOOK[run.vibe];
            var len = run.end - run.start;
            for (var ii = run.start; ii <= run.end; ii += look.trees) {
                var isl = path[ii] && path[ii].seg && path[ii].seg.island;
                if (!isl) continue;
                var tt = (ii - run.start) / Math.max(1, len);
                if (tt < 0.08 || tt > 0.92) continue;          // bare tips
                var half = RR.River.islandHalf({ width: isl.width, t: tt }, ii);
                var perSeg = run.vibe === 'wooded' ? 1 + (Math.random() < 0.6 ? 1 : 0) : 1;
                for (var q = 0; q < perSeg; q++) {
                    var u = (Math.random() - 0.5) * 1.1;
                    var wp = this.getWorldPos((ii + Math.random()) * SEGL, isl.position + u * half);
                    var yTop = this._islandProfileY(u) * IH * look.h;
                    var hh = run.vibe === 'gravel' ? 8 + Math.random() * 8 :
                             run.vibe === 'grassy' ? 12 + Math.random() * 14 :
                             16 + Math.random() * 18 + (Math.random() < 0.25 ? 9 : 0);
                    self.treeData.push({
                        x: wp.x, z: wp.z, y: yTop - 0.3,
                        h: hh, type: 1,
                        w: 0.7 + Math.random() * 0.25,
                        shade: Math.floor(Math.random() * 8),
                        jit: Math.random()
                    });
                }
            }
        }
    },

    // Free the previous build's chunks and the resources they share.
    _disposeTreeChunks: function () {
        var i;
        for (i = 0; i < this.treeChunks.length; i++) {
            var ck0 = this.treeChunks[i];
            this._disposeGroup(ck0.group);
            this.scene.remove(ck0.group);
        }
        this.treeChunks = [];
        var sh = this._treeShared;
        if (sh) {
            for (i = 0; i < sh.geos.length; i++) if (sh.geos[i]) sh.geos[i].dispose();
            for (i = 0; i < sh.mats.length; i++) if (sh.mats[i]) sh.mats[i].dispose();
            this._treeShared = null;
        }
    },

    // SOLID CROWNS, 2026-10-26.
    //
    // Tyler, playing in Safari: "Trees have trunks but are missing all of
    // their leaves" -- and the only tree WITH a top was the HALF WAY THERE
    // sign tree. That tree's crown is plain sphere geometry; every other tree
    // was a trunk plus alpha-tested photo cut-out quads (CANOPY-1..4.png).
    // Safari drew the trunks and discarded every quad. So the crowns are now
    // geometry, like the sign tree that already worked for him: no alpha
    // texture, no alphaTest, nothing a browser can drop.
    //
    // It also answers "way bigger, different sizes, different color":
    //   - deciduous trees get two or three lumpy blobs, conifers two cones;
    //   - every instance carries its own colour (instanceColor), pulled from
    //     the river's foliage palette and then jittered in hue and lightness;
    //   - a baked vertex gradient darkens the underside of every crown, which
    //     is most of what makes a blob read as a lit tree.
    //
    // Still instanced in chunks of CHUNK trees, still one Group per chunk
    // whose .visible is the cull test (see _updateVisibleObjects).
    _createTreeInstances: function () {
        this._disposeTreeChunks();

        var profileColors = RR.River.profile && RR.River.profile.colors;
        var decidColors = profileColors && profileColors.foliage ? profileColors.foliage :
            [0x6E8C48, 0x7E9A50, 0x8CA855, 0x99B45F, 0xA8C06B, 0x86A24F, 0x93AE5C, 0x7A9449];
        var coniferColors = [0x2B4A2C, 0x375B36, 0x30502F, 0x40633A, 0x264229];

        // ---- shared geometry -------------------------------------------------
        // Lumpy blob: a sphere pushed in and out by a smooth hash of each
        // vertex's direction. Seam vertices share a position, so they share a
        // displacement and the mesh stays closed.
        function lump(x, y, z) {
            return 1 + 0.16 * Math.sin(x * 5.1 + y * 2.3) * Math.cos(z * 4.7 - x * 1.9)
                     + 0.08 * Math.sin(y * 9.0 + z * 6.3);
        }
        function shadeByHeight(geo, lo, hi) {
            var pos = geo.attributes.position, n = pos.count, col = new Float32Array(n * 3);
            geo.computeBoundingBox();
            var y0 = geo.boundingBox.min.y, y1 = geo.boundingBox.max.y;
            for (var v = 0; v < n; v++) {
                var t = (pos.getY(v) - y0) / Math.max(1e-6, y1 - y0);
                var k = lo + (hi - lo) * Math.pow(t, 0.8);
                col[v * 3] = col[v * 3 + 1] = col[v * 3 + 2] = k;
            }
            geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
        }
        var blobGeo = RR.Config.LITE ? new THREE.SphereGeometry(1, 8, 6) : new THREE.SphereGeometry(1, 12, 9);
        (function () {
            var pos = blobGeo.attributes.position;
            for (var v = 0; v < pos.count; v++) {
                var x = pos.getX(v), y = pos.getY(v), z = pos.getZ(v);
                var k = lump(x, y, z);
                pos.setXYZ(v, x * k, y * k * 0.92, z * k);
            }
            blobGeo.computeVertexNormals();
            shadeByHeight(blobGeo, 0.55, 1.08);
        })();

        // Cone with its base at y = 0 and apex at y = 1.
        var coneGeo = new THREE.ConeGeometry(1, 1, RR.Config.LITE ? 8 : 12, RR.Config.LITE ? 2 : 18);
        if (!RR.Config.LITE) {
            var cp = coneGeo.attributes.position;
            for (var cv = 0; cv < cp.count; cv++) {
                var cy = cp.getY(cv), cx = cp.getX(cv), cz = cp.getZ(cv);
                var branch = 0.76 + 0.24 * Math.cos((cy + 0.5) * Math.PI * 12);
                var irregular = 1 + 0.12 * Math.sin(Math.atan2(cz,cx)*7 + cy*19);
                cp.setXYZ(cv, cx*branch*irregular, cy, cz*branch*irregular);
            }
            coneGeo.computeVertexNormals();
        }
        coneGeo.translate(0, 0.5, 0);
        shadeByHeight(coneGeo, 0.6, 1.05);

        var trunkGeo = new THREE.CylinderGeometry(0.62, 1, 1, 6);
        trunkGeo.translate(0, 0.5, 0);

        var crownMat = new THREE.MeshStandardMaterial({
            color: 0xffffff, vertexColors: true, roughness: 0.9, metalness: 0
        });
        var trunkMat = new THREE.MeshStandardMaterial({
            color: profileColors ? profileColors.wood : 0x6B6355, roughness: 0.95
        });

        // ---- per-tree colour --------------------------------------------------
        var tmpCol = new THREE.Color(), hsl = { h: 0, s: 0, l: 0 };
        function treeColor(td, k, conifer) {
            var pal = conifer ? coniferColors : decidColors;
            tmpCol.setHex(pal[(td.shade + k) % pal.length]);
            tmpCol.getHSL(hsl);
            var j = td.jit === undefined ? 0.5 : td.jit;
            // Hue +-0.035 and lightness +-0.07, so neighbours never match.
            // About 1 deciduous tree in 9 turns the paler yellow-green of a
            // cottonwood or big-leaf maple catching light.
            var h = hsl.h + (j - 0.5) * 0.07 + k * 0.006;
            var l = hsl.l * (0.86 + j * 0.28) * (1 - k * 0.04);
            var sat = hsl.s;
            if (!conifer && j > 0.89) { h -= 0.035; l *= 1.18; sat *= 1.08; }
            tmpCol.setHSL(h, Math.min(1, sat), Math.min(0.9, l));
            return tmpCol;
        }

        // ---- count instances per chunk ---------------------------------------
        var CHUNK = 400;
        var nTrees = this.treeData.length;
        var nChunks = Math.max(1, Math.ceil(nTrees / CHUNK));
        var ci, i;
        var cnt = [];
        for (ci = 0; ci < nChunks; ci++) cnt.push({ blob: 0, cone: 0, trunk: 0 });
        for (i = 0; i < nTrees; i++) {
            var t0 = this.treeData[i], c0 = cnt[(i / CHUNK) | 0];
            c0.trunk++;
            if (t0.type === 0) c0.cone += 2;
            else c0.blob += (t0.h > 40 ? 3 : 2);
        }

        var chunks = [];
        for (ci = 0; ci < nChunks; ci++) {
            var g = new THREE.Group();
            g.visible = false;
            var ck = {
                group: g, blobs: null, cones: null, trunks: null,
                bn: 0, cn: 0, tn: 0,
                minX: Infinity, maxX: -Infinity, minZ: Infinity, maxZ: -Infinity
            };
            // Frustum culling OFF: an r150 InstancedMesh takes its bounding
            // sphere from the source geometry, not the instances, so the chunk
            // would pop out as soon as the origin left the frustum. The
            // per-chunk distance test is the cull.
            if (cnt[ci].blob) {
                ck.blobs = new THREE.InstancedMesh(blobGeo, crownMat, cnt[ci].blob);
                ck.blobs.frustumCulled = false;
                g.add(ck.blobs);
            }
            if (cnt[ci].cone) {
                ck.cones = new THREE.InstancedMesh(coneGeo, crownMat, cnt[ci].cone);
                ck.cones.frustumCulled = false;
                g.add(ck.cones);
            }
            ck.trunks = new THREE.InstancedMesh(trunkGeo, trunkMat, Math.max(1, cnt[ci].trunk));
            ck.trunks.frustumCulled = false;
            g.add(ck.trunks);
            this.scene.add(g);
            chunks.push(ck);
        }

        var dummy = new THREE.Object3D();
        function put(mesh, slot, x, y, z, yaw, sx, sy, sz, col) {
            dummy.position.set(x, y, z);
            dummy.rotation.set(0, yaw, 0);
            dummy.scale.set(sx, sy, sz);
            dummy.updateMatrix();
            mesh.setMatrixAt(slot, dummy.matrix);
            if (col) mesh.setColorAt(slot, col);
        }

        for (i = 0; i < nTrees; i++) {
            var td = this.treeData[i];
            var c = chunks[(i / CHUNK) | 0];
            var baseY = (td.y !== undefined ? td.y : 2.5) - 0.5;
            var h = td.h, w = td.w || 1;
            var spin = i * 1.37;
            var sx = Math.sin(spin), cz = Math.cos(spin);
            if (td.x < c.minX) c.minX = td.x;
            if (td.x > c.maxX) c.maxX = td.x;
            if (td.z < c.minZ) c.minZ = td.z;
            if (td.z > c.maxZ) c.maxZ = td.z;

            if (td.type === 0) {
                // Fir / cedar: a trunk most of the way up, two stacked cones.
                var r0 = h * 0.2 * w;
                put(c.trunks, c.tn++, td.x, baseY, td.z, spin, h * 0.022, h * 0.55, h * 0.022);
                put(c.cones, c.cn++, td.x, baseY + h * 0.10, td.z, spin,
                    r0, h * 0.62, r0, treeColor(td, 0, true));
                put(c.cones, c.cn++, td.x, baseY + h * 0.42, td.z, spin + 0.4,
                    r0 * 0.72, h * 0.58, r0 * 0.72, treeColor(td, 1, true));
            } else {
                // Alder / cottonwood: trunk into a main crown, a lower side
                // lobe, and on the bigger trees a high lobe that breaks the
                // silhouette.
                var R = h * 0.27 * w;
                put(c.trunks, c.tn++, td.x, baseY, td.z, spin, h * 0.03, h * 0.62, h * 0.03);
                put(c.blobs, c.bn++, td.x, baseY + h * 0.66, td.z, spin,
                    R, h * 0.25, R, treeColor(td, 0, false));
                put(c.blobs, c.bn++, td.x + sx * R * 0.55, baseY + h * 0.50, td.z + cz * R * 0.55, spin + 1.1,
                    R * 0.72, h * 0.19, R * 0.72, treeColor(td, 1, false));
                if (h > 40) {
                    put(c.blobs, c.bn++, td.x - cz * R * 0.35, baseY + h * 0.84, td.z + sx * R * 0.35, spin + 2.3,
                        R * 0.58, h * 0.17, R * 0.58, treeColor(td, 2, false));
                }
            }
        }

        for (ci = 0; ci < nChunks; ci++) {
            var ck2 = chunks[ci];
            // A chunk with no trees (the Nile plants palms instead) has no
            // bounds; drop it rather than leave NaN in the cull path.
            if (!ck2.tn) {
                this.scene.remove(ck2.group);
                this._disposeGroup(ck2.group);
                continue;
            }
            ck2.trunks.instanceMatrix.needsUpdate = true;
            if (ck2.blobs) {
                ck2.blobs.instanceMatrix.needsUpdate = true;
                if (ck2.blobs.instanceColor) ck2.blobs.instanceColor.needsUpdate = true;
            }
            if (ck2.cones) {
                ck2.cones.instanceMatrix.needsUpdate = true;
                if (ck2.cones.instanceColor) ck2.cones.instanceColor.needsUpdate = true;
            }
            ck2.cx = (ck2.minX + ck2.maxX) * 0.5;
            ck2.cz = (ck2.minZ + ck2.maxZ) * 0.5;
            // + the tallest crown's reach, so an edge tree is never clipped
            // by the chunk's own flat footprint.
            ck2.r = 0.5 * Math.sqrt((ck2.maxX - ck2.minX) * (ck2.maxX - ck2.minX) +
                                    (ck2.maxZ - ck2.minZ) * (ck2.maxZ - ck2.minZ)) + 60;
            this.treeChunks.push(ck2);
        }

        // Owned here, freed once in _disposeTreeChunks -- never per chunk.
        blobGeo._rrShared = coneGeo._rrShared = trunkGeo._rrShared = true;
        crownMat._rrShared = trunkMat._rrShared = true;
        this._treeShared = { geos: [blobGeo, coneGeo, trunkGeo], mats: [crownMat, trunkMat] };
    },

    _allocateObstaclePool: function () {
        for (var i = 0; i < this.obstacleMeshPool.length; i++) {
            this._disposeGroup(this.obstacleMeshPool[i]);
            this.scene.remove(this.obstacleMeshPool[i]);
        }
        this.obstacleMeshPool = [];

        var profileColors = RR.River.profile && RR.River.profile.colors;
        var rockColor = profileColors ? profileColors.rock : 0x5A5A58;
        var woodColor = profileColors ? profileColors.wood : 0x6A5A40;
        var rockGeo = new THREE.SphereGeometry(1, 6, 5);
        var rockMat = new THREE.MeshStandardMaterial({ color: rockColor, roughness: 0.95, metalness: 0.05 });
        var logGeo = new THREE.CylinderGeometry(0.3, 0.35, 3, 6);
        var logMat = new THREE.MeshStandardMaterial({ color: woodColor, roughness: 0.9 });
        var snagTrunkGeo = new THREE.CylinderGeometry(0.22, 0.36, 3.8, 6);
        var snagBranchGeo = new THREE.CylinderGeometry(0.08, 0.14, 1.6, 5);
        var treeObsMat = new THREE.MeshStandardMaterial({ color: woodColor, roughness: 0.96 });

        for (var i = 0; i < 80; i++) {
            var g = new THREE.Group();
            var rock = new THREE.Mesh(rockGeo, rockMat);
            rock.name = 'rock';
            rock.visible = false;
            g.add(rock);

            var log = new THREE.Mesh(logGeo, logMat);
            log.name = 'log';
            log.rotation.z = Math.PI / 2;
            log.visible = false;
            g.add(log);

            // Channel "tree" hazards are now bare broken snags, not little
            // evergreen cones. Keep the object name for collision/render code.
            var tree = new THREE.Group();
            tree.name = 'tree';
            var snagTrunk = new THREE.Mesh(snagTrunkGeo, treeObsMat);
            snagTrunk.position.y = 1.45;
            snagTrunk.rotation.z = 0.08;
            tree.add(snagTrunk);
            var snagLeft = new THREE.Mesh(snagBranchGeo, treeObsMat);
            snagLeft.position.set(-0.45, 2.15, 0);
            snagLeft.rotation.z = -0.92;
            tree.add(snagLeft);
            var snagRight = snagLeft.clone();
            snagRight.position.set(0.38, 2.72, 0.05);
            snagRight.rotation.z = 0.84;
            tree.add(snagRight);
            tree.visible = false;
            g.add(tree);
            var branches = new THREE.Group();branches.name='branches';
            var rootBall = new THREE.Mesh(new THREE.DodecahedronGeometry(0.7,0),treeObsMat);
            rootBall.position.set(0,0.35,0);rootBall.scale.set(1.4,0.8,1);branches.add(rootBall);
            var anchor = new THREE.Mesh(rockGeo,rockMat);anchor.scale.set(1.1,0.6,0.9);anchor.position.set(0.6,0.25,0.4);branches.add(anchor);
            for(var bi=0;bi<9;bi++){
                var branch=new THREE.Mesh(bi<3?snagTrunkGeo:snagBranchGeo,treeObsMat);
                var ang=bi*2.399;
                branch.position.set(Math.cos(ang)*0.7,0.45+(bi%3)*0.18,Math.sin(ang)*0.7);
                branch.rotation.set(0.9+bi*0.17,ang,1.05+bi*0.08);
                branch.scale.set(0.65,bi<3?0.7:1.2,0.65);branches.add(branch);
            }
            branches.visible=false;g.add(branches);

            g.visible = false;
            g.userData.active = false;
            this.scene.add(g);
            this.obstacleMeshPool.push(g);
        }
    },

    // ---- ISLANDS, ONE SMOOTH MESH EACH (2026-10-26) ------------------------
    //
    // Were: a pool of three cylinders per 200-unit segment, re-parked every
    // frame, butted end to end -- a staircase of facets down every shoreline,
    // and a pool too small for the draw window, which is why an island could
    // appear out of nowhere. Now each island is built ONCE per river as a
    // single lofted surface that follows the channel, using the exact shape
    // RR.River.islandHalf gives the collision.
    //
    // Tyler: "Islands need to be some variety of sizes, colors, vibes." Each
    // island gets one of three looks, chosen deterministically so a river is
    // the same every run:
    //   wooded  -- tall green mound, full of cottonwood
    //   grassy  -- lower pale-green meadow, a few trees
    //   gravel  -- a bare, low gravel bar with the odd willow
    // Width varies with the river's own island data; height and colour vary
    // with the look and a slow ripple along the length.

    // Consecutive island segments that belong to one island.
    _islandRuns: function () {
        var S = RR.River.segments, runs = [], i = 0, n = S.length;
        while (i < n) {
            if (!S[i].island) { i++; continue; }
            var a = i, isl = S[i].island;
            while (i + 1 < n && S[i + 1].island &&
                   S[i + 1].island.position === isl.position &&
                   S[i + 1].island.braidId === isl.braidId) i++;
            runs.push({ start: a, end: i, vibe: this._islandVibe(a) });
            i++;
        }
        return runs;
    },

    _islandVibe: function (start) {
        var prof = RR.River.profile || {};
        var h = Math.abs(Math.sin(start * 12.9898 + (prof.courseOffset || 0) * 78.233) * 43758.5453) % 1;
        // Desert and canyon rivers grow nothing much on a bar.
        if (prof.palms || prof.canyon) return h < 0.7 ? 'gravel' : 'grassy';
        return h < 0.40 ? 'wooded' : (h < 0.70 ? 'gravel' : 'grassy');
    },

    _ISLAND_LOOK: {
        wooded: { h: 1.00, trees: 2 },
        grassy: { h: 0.72, trees: 6 },
        gravel: { h: 0.42, trees: 12 }
    },

    // Cross-section height (fraction of ISLAND_HEIGHT) at u, where |u| = 1 is
    // the collision edge. Beyond it is the wet apron sloping under water.
    _islandProfileY: function (u) {
        var a = Math.abs(u);
        if (a >= 1.3) return -0.30;
        if (a >= 1.0) return -0.30 + (1.3 - a) / 0.3 * 0.34;          // apron
        if (a >= 0.78) return 0.04 + (1.0 - a) / 0.22 * 0.22;          // beach
        var k = 1 - a / 0.78;                                           // mound
        return 0.26 + 0.74 * Math.sqrt(k * (2 - k));
    },

    _createIslandMeshes: function () {
        var i, m;
        if (this._islandMeshes) {
            for (i = 0; i < this._islandMeshes.length; i++) {
                m = this._islandMeshes[i];
                this.scene.remove(m);
                m.geometry.dispose();
            }
        }
        if (this._islandMat) this._islandMat.dispose();
        this._islandMeshes = [];
        this.islandMeshPool = [];          // the old per-frame pool, retired

        var C = RR.Config, River = RR.River, S = River.segments;
        var IH = C.ISLAND_HEIGHT;
        var pc = (RR.River.profile && RR.River.profile.colors) || {};
        var bank = new THREE.Color(pc.bank !== undefined ? pc.bank : 0xA09070);
        var wet = bank.clone().multiplyScalar(0.55);
        var dry = bank.clone().multiplyScalar(1.04);
        var fol = pc.foliage || [0x2E6B2E];
        var green = new THREE.Color(fol[0]).lerp(new THREE.Color(fol[Math.min(2, fol.length - 1)]), 0.3);
        var meadow = new THREE.Color(fol[Math.min(4, fol.length - 1)]).lerp(new THREE.Color(0xC8C27A), 0.35);
        var tops = {
            wooded: green,
            grassy: meadow,
            gravel: dry.clone().lerp(new THREE.Color(0xD8D2C4), 0.15)
        };

        this._islandMat = new THREE.MeshStandardMaterial({
            vertexColors: true, roughness: 0.95, metalness: 0
        });

        // u stations across the island, symmetric.
        var U = [-1.3, -1.12, -1.0, -0.88, -0.78, -0.6, -0.36, -0.12, 0.12, 0.36, 0.6, 0.78, 0.88, 1.0, 1.12, 1.3];
        var NU = U.length;
        var runs = this._islandRuns();
        var col = new THREE.Color();
        var SEGL = C.SEGMENT_LENGTH;

        for (var r = 0; r < runs.length; r++) {
            var run = runs[r], look = this._ISLAND_LOOK[run.vibe];
            var isl0 = S[run.start].island;
            var len = run.end - run.start;
            var STEP = 0.5;
            var rows = [];
            for (var sf = run.start - 1.5; sf <= run.end + 1.5 + 1e-6; sf += STEP) {
                rows.push(sf);
            }
            var nr = rows.length;
            var pos = new Float32Array(nr * NU * 3);
            var cols = new Float32Array(nr * NU * 3);
            var top = tops[run.vibe];
            for (var ri = 0; ri < nr; ri++) {
                var sfr = rows[ri];
                var tt = (sfr - run.start) / Math.max(1, len);
                var half = River.islandHalf({ width: isl0.width, t: tt }, sfr);
                // Past the tips the bar sinks away under the water.
                var sink = 1;
                if (tt < 0) sink = Math.max(0, 1 + tt * len / 1.5);
                if (tt > 1) sink = Math.max(0, 1 - (tt - 1) * len / 1.5);
                half *= 0.4 + 0.6 * sink;
                // A slow ripple along the length so the crest is not a ruler.
                var ripple = 0.85 + 0.15 * Math.sin(sfr * 0.21 + run.start) +
                             0.08 * Math.sin(sfr * 0.57 + 2.1);
                for (var ui = 0; ui < NU; ui++) {
                    var u = U[ui];
                    var lat = isl0.position + u * half;
                    var wp = this.getWorldPos(sfr * SEGL, lat);
                    var py = this._islandProfileY(u);
                    var hgt = py > 0 ? py * IH * look.h * ripple : py * IH;
                    hgt = hgt * sink + (-0.3 * IH) * (1 - sink);
                    var o = (ri * NU + ui) * 3;
                    pos[o] = wp.x; pos[o + 1] = hgt + 0.1; pos[o + 2] = wp.z;

                    var a = Math.abs(u);
                    if (a >= 1.0) col.copy(wet);
                    else if (a >= 0.78) col.copy(dry);
                    else col.copy(top);
                    // Mottle, so the surface is not one flat swatch.
                    var mot = 0.9 + 0.2 * (0.5 + 0.5 * Math.sin(sfr * 1.7 + u * 5.3) *
                                            Math.cos(sfr * 0.63 - u * 3.1));
                    col.multiplyScalar(mot);
                    cols[o] = col.r; cols[o + 1] = col.g; cols[o + 2] = col.b;
                }
            }
            var idx = [];
            for (ri = 0; ri < nr - 1; ri++) {
                for (ui = 0; ui < NU - 1; ui++) {
                    var p00 = ri * NU + ui, p01 = p00 + 1, p10 = p00 + NU, p11 = p10 + 1;
                    idx.push(p00, p10, p01, p01, p10, p11);
                }
            }
            var geo = new THREE.BufferGeometry();
            geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
            geo.setAttribute('color', new THREE.BufferAttribute(cols, 3));
            geo.setIndex(idx);
            geo.computeVertexNormals();
            geo.computeBoundingSphere();
            var mesh = new THREE.Mesh(geo, this._islandMat);
            mesh.name = 'island';
            // Winding depends on the river's handedness; draw both sides so a
            // flipped loft can never vanish.
            this._islandMat.side = THREE.DoubleSide;
            this.scene.add(mesh);
            this._islandMeshes.push(mesh);
        }
    },

    // A flat, pulsing disc on the water marking exactly where a bear can reach.
    // It is deliberately the SAME size as the real hit zone in collision.js --
    // what you can see is what can get you. Its own pool, not a child of the
    // bear group, because that group is lookAt()-rotated every frame and a
    // flat disc parented to it would tip on its side.
    _allocateBearZonePool: function () {
        var i;
        for (i = 0; i < this.bearZonePool.length; i++) {
            this._disposeGroup(this.bearZonePool[i]);
            this.scene.remove(this.bearZonePool[i]);
        }
        this.bearZonePool = [];
        var zoneGeo = new THREE.CircleGeometry(1, 26);
        for (i = 0; i < 10; i++) {
            var z = new THREE.Mesh(zoneGeo, new THREE.MeshBasicMaterial({
                color: 0xFF3322, transparent: true, opacity: 0.0,
                depthWrite: false, side: THREE.DoubleSide
            }));
            z.rotation.x = -Math.PI / 2;
            z.renderOrder = 1;
            z.visible = false;
            this.scene.add(z);
            this.bearZonePool.push(z);
        }
    },

    _allocateWildlifePools: function () {
        var i;
        for (i = 0; i < this.bearMeshPool.length; i++) {
            this._disposeGroup(this.bearMeshPool[i]);
            this.scene.remove(this.bearMeshPool[i]);
        }
        for (i = 0; i < this.salmonMeshPool.length; i++) {
            this._disposeGroup(this.salmonMeshPool[i]);
            this.scene.remove(this.salmonMeshPool[i]);
        }
        this.bearMeshPool = [];
        this.salmonMeshPool = [];

        // Bears use softly faceted anatomy instead of a billboard: heavy
        // shoulders, haunches, muzzle, ears, raised forelegs and pale claws.
        // A gravel ellipse roots each one on the kind of beach shown throughout
        // ARCHIVES/REFERENCES/RIVER/GRAVEL-AND-SANDBARS/.
        var fur = new THREE.MeshStandardMaterial({ color: 0x33271F, roughness: 0.98 });
        var furDark = new THREE.MeshStandardMaterial({ color: 0x1C1713, roughness: 1 });
        var muzzleMat = new THREE.MeshStandardMaterial({ color: 0x8B7055, roughness: 0.92 });
        var mouthMat = new THREE.MeshStandardMaterial({ color: 0x7C1717, roughness: 0.8 });
        var toothMat = new THREE.MeshStandardMaterial({ color: 0xF2E9D6, roughness: 0.65 });
        var eyeMat = new THREE.MeshBasicMaterial({ color: 0xFFB11B });
        var gravelMat = new THREE.MeshStandardMaterial({ color: 0xA6977C, roughness: 1, side: THREE.DoubleSide });
        var sphere = new THREE.SphereGeometry(1, 9, 7);
        var limbGeo = new THREE.CylinderGeometry(0.22, 0.34, 2.1, 7);
        var clawGeo = new THREE.ConeGeometry(0.08, 0.42, 5);

        function bearLimb(x, y, z, rotZ) {
            var limb = new THREE.Mesh(limbGeo, furDark);
            limb.position.set(x, y, z);
            limb.rotation.z = rotZ;
            return limb;
        }

        for (i = 0; i < 14; i++) {
            var bg = new THREE.Group();
            var beach = new THREE.Mesh(new THREE.CircleGeometry(4.8, 18), gravelMat);
            beach.rotation.x = -Math.PI / 2;
            beach.scale.set(1.7, 1, 0.62);
            beach.position.y = 0.02;
            bg.add(beach);

            var torso = new THREE.Mesh(sphere, fur);
            torso.scale.set(0.95, 1.35, 0.72);
            torso.position.y = 2.05;
            bg.add(torso);

            var shoulders = new THREE.Mesh(sphere, furDark);
            shoulders.scale.set(1.15, 0.70, 0.78);
            shoulders.position.set(0, 2.80, 0.08);
            bg.add(shoulders);

            var haunches = new THREE.Mesh(sphere, fur);
            haunches.scale.set(1.05, 0.78, 0.82);
            haunches.position.set(0, 1.28, -0.28);
            bg.add(haunches);

            var head = new THREE.Group();
            head.position.set(0, 3.78, 0.18);
            var skull = new THREE.Mesh(sphere, furDark);
            skull.scale.set(0.68, 0.70, 0.62);
            head.add(skull);
            var muzzle = new THREE.Mesh(sphere, muzzleMat);
            muzzle.scale.set(0.46, 0.31, 0.48);
            muzzle.position.set(0, -0.12, 0.53);
            head.add(muzzle);
            var mouth = new THREE.Mesh(new THREE.BoxGeometry(0.55, 0.16, 0.46), mouthMat);
            mouth.position.set(0, -0.31, 0.66);
            head.add(mouth);
            var earL = new THREE.Mesh(sphere, furDark);
            earL.scale.set(0.22, 0.24, 0.15); earL.position.set(-0.45, 0.48, 0); head.add(earL);
            var earR = earL.clone(); earR.position.x = 0.45; head.add(earR);
            var eyeL = new THREE.Mesh(new THREE.SphereGeometry(0.06, 6, 5), eyeMat);
            eyeL.position.set(-0.22, 0.12, 0.57); head.add(eyeL);
            var eyeR = eyeL.clone(); eyeR.position.x = 0.22; head.add(eyeR);
            for (var bt = -1; bt <= 1; bt += 2) {
                var tooth = new THREE.Mesh(new THREE.ConeGeometry(0.055, 0.25, 5), toothMat);
                tooth.position.set(bt * 0.17, -0.30, 0.92);
                tooth.rotation.x = Math.PI;
                head.add(tooth);
            }
            bg.add(head);

            var armL = bearLimb(-0.92, 2.65, 0.20, -0.72);
            var armR = bearLimb(0.92, 2.65, 0.20, 0.72);
            bg.add(armL); bg.add(armR);
            bg.add(bearLimb(-0.52, 0.70, -0.10, -0.10));
            bg.add(bearLimb(0.52, 0.70, -0.10, 0.10));

            for (var side = -1; side <= 1; side += 2) {
                for (var ci = 0; ci < 3; ci++) {
                    var claw = new THREE.Mesh(clawGeo, toothMat);
                    claw.position.set(side * (1.46 + ci * 0.07), 2.05 + ci * 0.08, 0.28);
                    claw.rotation.z = side * -1.15;
                    bg.add(claw);
                }
            }

            bg.userData.torso = torso;
            bg.userData.head = head;
            bg.userData.armL = armL;
            bg.userData.armR = armR;
            bg.visible = false;
            this.scene.add(bg);
            this.bearMeshPool.push(bg);
        }

        // Salmon are separate from their ripple root so the fish can arc and
        // pitch while the entry/exit ring remains flat on the moving water.
        var salmonMat = new THREE.MeshStandardMaterial({ color: 0xC94B28, roughness: 0.58, metalness: 0.08 });
        var salmonLight = new THREE.MeshStandardMaterial({ color: 0xE8A06C, roughness: 0.64 });
        var salmonDark = new THREE.MeshStandardMaterial({ color: 0x4A403B, roughness: 0.75 });
        var salmonBodyGeo = new THREE.SphereGeometry(1, 10, 7);
        for (i = 0; i < 24; i++) {
            var root = new THREE.Group();
            var fish = new THREE.Group();
            var body = new THREE.Mesh(salmonBodyGeo, salmonMat);
            body.scale.set(0.42, 0.48, 1.30);
            fish.add(body);
            var belly = new THREE.Mesh(salmonBodyGeo, salmonLight);
            belly.scale.set(0.34, 0.18, 1.04);
            belly.position.y = -0.34;
            fish.add(belly);

            var tailGeo = new THREE.BufferGeometry();
            tailGeo.setAttribute('position', new THREE.BufferAttribute(new Float32Array([
                0, 0, -1.05,  -0.72, 0.62, -1.75,  -0.72, -0.62, -1.75,
                0, 0, -1.05,   0.72, 0.62, -1.75,   0.72, -0.62, -1.75
            ]), 3));
            tailGeo.computeVertexNormals();
            fish.add(new THREE.Mesh(tailGeo, salmonMat));
            var dorsal = new THREE.Mesh(new THREE.ConeGeometry(0.25, 0.70, 5), salmonDark);
            dorsal.position.set(0, 0.48, -0.12);
            dorsal.rotation.x = Math.PI / 2;
            fish.add(dorsal);
            var fishEyeL = new THREE.Mesh(new THREE.SphereGeometry(0.055, 6, 5), eyeMat);
            fishEyeL.position.set(-0.34, 0.10, 0.91); fish.add(fishEyeL);
            var fishEyeR = fishEyeL.clone(); fishEyeR.position.x = 0.34; fish.add(fishEyeR);
            root.add(fish);

            var rippleMat = new THREE.MeshBasicMaterial({ color: 0xE8F6FA, transparent: true, opacity: 0, side: THREE.DoubleSide, depthWrite: false });
            var ripple = new THREE.Mesh(new THREE.RingGeometry(0.55, 0.88, 20), rippleMat);
            ripple.rotation.x = -Math.PI / 2;
            ripple.position.y = 0.13;
            root.add(ripple);
            root.userData.fish = fish;
            root.userData.ripple = ripple;
            root.visible = false;
            this.scene.add(root);
            this.salmonMeshPool.push(root);
        }
    },

    // Everything that makes one hull look different from another. Called on
    // every buildScene, so it must only ever toggle and retint -- never build.
    _applyBoatModel: function () {
        if (!this.boatGroup || !RR.BoatCatalog) return;
        var C = RR.BoatCatalog;
        var model = C.getSelected();

        this.boatGroup.scale.set(3 * model.beamScale, 3 * (model.heightScale || 1), 3 * model.lengthScale);

        // Deck layout: exactly one rig visible. An unknown layout falls back
        // to the Alaskan's windshield rig.
        var layout = C.trait(model, 'layout');
        if (this._boatRigs) {
            var rigKey = this._boatRigs[layout] ? layout : 'windshield';
            for (var rk in this._boatRigs) this._boatRigs[rk].visible = (rk === rigKey);
        }
        if (this._motorMat) this._motorMat.color.setHex(model.motor !== undefined ? model.motor : 0x191A1F);

        // A loaded CAD hull takes over the whole boat except the outboard.
        var cadOn = null;
        if (this._cadRigs) {
            for (var cid in this._cadRigs) {
                var cg = this._cadRigs[cid];
                if (!cg) continue;
                cg.visible = (cid === model.id);
                if (cg.visible) cadOn = cg;
            }
        }
        if (this._baseHull) this._baseHull.visible = !cadOn;
        if (cadOn && this._boatRigs) {
            // keepRig: true keeps the model's whole deck rig on the CAD hull;
            // a string keeps only the rig pieces tagged with it (Skagit:
            // 'arch' -- the tube arch and stern rails, not a second
            // windshield on top of the CAD one).
            var keep = model.cad && model.cad.keepRig;
            for (var rk2 in this._boatRigs) {
                var rg = this._boatRigs[rk2];
                rg.visible = !!keep && rk2 === layout;
                // cad.rigFit: the deck rig is built for the stretched hand
                // hull, but the CAD hull is not stretched and narrows to its
                // own bow -- the Sportster's consoles poked out through the
                // sides (2026-10-28). Squeeze/shift that model's rig to fit.
                var fit = rg.visible && model.cad.rigFit;
                rg.scale.x = fit && fit.x ? fit.x : 1;
                rg.position.z = fit && fit.z ? fit.z : 0;
                rg.children.forEach(function (o) {
                    if (o.userData.band) o.visible = false;          // hand-hull paint
                    else o.visible = (typeof keep === 'string') ? !!o.userData[keep] : true;
                });
            }
        } else if (this._boatRigs) {
            for (var rk3 in this._boatRigs) {
                this._boatRigs[rk3].scale.x = 1; this._boatRigs[rk3].position.z = 0;
                this._boatRigs[rk3].children.forEach(function (o) { o.visible = true; });
            }
        }

        // Paint. Absent overrides fall back to the standard aluminium, so a
        // model that says nothing looks exactly as it always did.
        var M = this._boatMats;
        if (M) {
            M.hull.color.setHex(model.hull !== undefined ? model.hull : 0xC9CCD1);
            M.cap.color.setHex(model.cap  !== undefined ? model.cap  : 0xE8EAEE);
            M.deck.color.setHex(model.deck !== undefined ? model.deck : 0xB4B8BE);
            M.sole.color.setHex(model.sole !== undefined ? model.sole : 0xA2A7AD);
        }

        // Decal. Each rig already carries the correct per-side artwork, so
        // this only picks which rig is on -- no texture swapping.
        var logo = C.trait(model, 'logo');
        if (this._logoRigs) {
            this._logoRigs.std.visible   = (logo !== 'rogue' && logo !== 'white');
            this._logoRigs.rogue.visible = (logo === 'rogue');
            this._logoRigs.white.visible = (logo === 'white');
            if (cadOn) {
                // The CAD group carries its own decals, fitted to its skin.
                this._logoRigs.std.visible = this._logoRigs.rogue.visible = this._logoRigs.white.visible = false;
            }
        }
    },

    // ---- REAL CAD HULLS (2026-10-26) ---------------------------------------
    //
    // Wooldridge's own engineering models, from the COMMON drive
    // (/Volumes/Data/COMMON/ENGINEERING). A model in BOAT-LINEUP.js with a
    // `cad` block loads its mesh here and replaces the hand-built hull for
    // that boat only. Binary STL, Z-up, inches, bow toward +Y -- the format
    // Inventor/Rhino export by default. Parsed by hand (no loader needed),
    // painted per triangle by where it sits on the boat, and scaled so the
    // CAD hull runs exactly transom -5 -> bow +5 in boat units like every
    // other hull, so the wake, camera, hit boxes and outboard all still line
    // up. Until the file arrives (or if it never does) the boat shows its
    // hand-built rig, so nothing can go missing.
    //
    // cad: { url, paint: { side, bottom, deck, cap, upper, interior } }
    _loadCadBoats: function () {
        var self = this;
        this._cadRigs = this._cadRigs || {};
        var models = (RR.BoatCatalog && RR.BoatCatalog.models) || [];
        models.forEach(function (m) {
            if (!m.cad || self._cadRigs[m.id]) return;
            self._cadRigs[m.id] = null;                 // loading
            fetch(m.cad.url).then(function (r) {
                if (!r.ok) throw new Error(r.status);
                return r.arrayBuffer();
            }).then(function (buf) {
                var grp = self._buildCadBoat(m, buf);
                grp.visible = false;
                self.boatGroup.add(grp);
                self._cadRigs[m.id] = grp;
                if (self._applyShadowFlags && RR.Config.SHADOWS) {
                    grp.traverse(function (o) { if (o.isMesh) { o.castShadow = true; o.receiveShadow = false; } });
                }
                self._applyBoatModel();
            }).catch(function () { delete self._cadRigs[m.id]; });
        });
    },

    _buildCadBoat: function (model, buf) {
        var dv = new DataView(buf);
        var n = dv.getUint32(80, true);
        // Every plate in these files is a thin SOLID -- an outer face and an
        // inner face -- and the triangle winding is not consistent, but the
        // normal stored with each triangle is. So paint is decided by the
        // stored normal: a face pointing AWAY from the centreline is skin,
        // one pointing in is the inside of the boat.
        var src = new Float32Array(n * 9), nrm = new Float32Array(n * 3), i, k;
        for (i = 0; i < n; i++) {
            var o = 84 + i * 50;
            for (k = 0; k < 3; k++) nrm[i * 3 + k] = dv.getFloat32(o + k * 4, true);
            for (k = 0; k < 9; k++) src[i * 9 + k] = dv.getFloat32(o + 12 + k * 4, true);
        }
        // Bounds.
        var mn = [1e9, 1e9, 1e9], mx = [-1e9, -1e9, -1e9];
        for (i = 0; i < n * 3; i++) {
            for (k = 0; k < 3; k++) {
                var v = src[i * 3 + k];
                if (v < mn[k]) mn[k] = v;
                if (v > mx[k]) mx[k] = v;
            }
        }
        // Half-beam along the length, from every vertex, in 6" bins --
        // the outer skin is whatever reaches the widest point at that station.
        var BIN = 6, nb = Math.ceil((mx[1] - mn[1]) / BIN) + 1;
        var hw = new Float32Array(nb), sheer = new Float32Array(nb), bi;
        for (i = 0; i < nb; i++) sheer[i] = -1e9;
        for (i = 0; i < n * 3; i++) {
            bi = Math.floor((src[i * 3 + 1] - mn[1]) / BIN);
            var ax = Math.abs(src[i * 3]);
            if (ax > hw[bi]) hw[bi] = ax;
        }
        // Fill empty bins from their neighbours (long CAD triangles skip some).
        for (i = 1; i < nb; i++) if (!hw[i]) hw[i] = hw[i - 1];
        for (i = nb - 2; i >= 0; i--) if (!hw[i]) hw[i] = hw[i + 1];
        // A coarse CAD mesh (the Sportster's is 472 triangles) leaves stations
        // where the only vertices in a bin are down at the keel, which read
        // as a narrow hull and buried the logo inside the wall. Take the
        // widest point within +-18" instead.
        var hwRaw = hw.slice ? hw.slice() : Float32Array.from(hw);
        for (i = 0; i < nb; i++) {
            var wmax = 0;
            for (var wj = Math.max(0, i - 3); wj <= Math.min(nb - 1, i + 3); wj++) wmax = Math.max(wmax, hwRaw[wj]);
            hw[i] = wmax;
        }
        function hwAt(y) { return hw[Math.max(0, Math.min(nb - 1, Math.floor((y - mn[1]) / BIN)))]; }
        // Sheer height: highest point of the OUTWARD-facing skin at each station.
        for (i = 0; i < n; i++) {
            var fx = nrm[i * 3], fcx = (src[i * 9] + src[i * 9 + 3] + src[i * 9 + 6]) / 3;
            if (Math.abs(fx) < 0.5 || fx * fcx <= 0) continue;
            for (k = 0; k < 3; k++) {
                var vy = src[i * 9 + k * 3 + 1], vz = src[i * 9 + k * 3 + 2];
                bi = Math.floor((vy - mn[1]) / BIN);
                if (Math.abs(src[i * 9 + k * 3]) > hw[bi] * 0.85 && vz > sheer[bi]) sheer[bi] = vz;
            }
        }
        for (i = 1; i < nb; i++) if (sheer[i] < -1e8) sheer[i] = sheer[i - 1];
        // The per-station maximum is fooled amidships by windshield side
        // glass (it faces outward too), so the sheer LINE is taken from the
        // aft and forward thirds only and run straight between them.
        var aftS = -1e9, fwdS = -1e9, third = Math.floor(nb / 3);
        for (i = 0; i < third; i++) aftS = Math.max(aftS, sheer[i]);
        for (i = nb - third; i < nb; i++) fwdS = Math.max(fwdS, sheer[i]);
        for (i = 0; i < nb; i++) sheer[i] = aftS + (fwdS - aftS) * i / Math.max(1, nb - 1);
        var hullDepth = mx[2] - mn[2];

        var P = model.cad.paint || {};
        var C = function (h, d) { return new THREE.Color(h !== undefined ? h : d); };
        var cSide = C(P.side, 0xC9CCD1), cBottom = C(P.bottom, 0xC9CCD1),
            cDeck = C(P.deck, 0x8E949B), cCap = C(P.cap, 0xE3E6EA),
            cUpper = C(P.upper, 0x34373C), cIn = C(P.interior, 0xB4B8BE);
        // Optional bright band along the top of the topsides (Sportster):
        // band = fraction of the side height (chine 0 -> sheer 1) it starts at.
        var cBand = P.band !== undefined ? C(P.bandColor, 0xDCDFE3) : null;
        var chineZ = mn[2] + (P.chine !== undefined ? P.chine : 0.22) * (34);   // inches above keel

        var col = new Float32Array(n * 9);
        for (i = 0; i < n; i++) {
            var fnx = nrm[i * 3], fny = nrm[i * 3 + 1], fnz = nrm[i * 3 + 2];
            var cx = (src[i * 9] + src[i * 9 + 3] + src[i * 9 + 6]) / 3,
                cy = (src[i * 9 + 1] + src[i * 9 + 4] + src[i * 9 + 7]) / 3,
                cz = (src[i * 9 + 2] + src[i * 9 + 5] + src[i * 9 + 8]) / 3;
            var sb = Math.floor((cy - mn[1]) / BIN), sh = sheer[Math.max(0, Math.min(nb - 1, sb))];
            var nearSkin = Math.abs(cx) > hwAt(cy) * 0.78;
            var outward = fnx * cx > 0 && Math.abs(fnx) > 0.3;
            var pick;
            if (fnz < -0.5) pick = cBottom;                                     // running surface / undersides
            else if (outward && nearSkin && cz < sh + 1.0) {                   // the topsides
                pick = cz < chineZ ? cBottom : cSide;
                if (cBand && cz > chineZ && (cz - chineZ) / Math.max(1, sh - chineZ) > P.band) pick = cBand;
            }
            else if (cz > sh + 2.0) pick = cUpper;                              // windshield frame, console, rails
            else if (fnz > 0.5 && nearSkin && cz > sh - 4.0) pick = cCap;       // gunwale cap
            else if (fnz > 0.5) pick = cDeck;                                   // floors, decks, seat tops
            else if (fny < -0.6 && cy < mn[1] + 6) pick = cSide;                // transom face
            else pick = cIn;                                                    // inside walls
            for (k = 0; k < 3; k++) {
                var pk = pick;
                // With a sheer band (Sportster) topside paint is decided PER
                // VERTEX, so the band follows the hull instead of zig-zagging
                // along its big CAD triangles. Dense meshes (the XL) keep
                // per-face paint and a crisp chine line.
                if (cBand && P.bandMode !== 'face' && (pick === cSide || pick === cBand || (pick === cBottom && outward && nearSkin && fnz >= -0.5))) {
                    var vz = src[i * 9 + k * 3 + 2];
                    pk = vz < chineZ ? cBottom : cSide;
                    if (cBand && vz > chineZ && (vz - chineZ) / Math.max(1, sh - chineZ) > P.band) pk = cBand;
                }
                col[i * 9 + k * 3] = pk.r; col[i * 9 + k * 3 + 1] = pk.g; col[i * 9 + k * 3 + 2] = pk.b;
            }
        }

        // RAISED LETTERING (2026-10-28). The XL export carries faint raised
        // "wooldridgeboats.com Est. 1915" lettering on its topsides. Paint is
        // decided per triangle, and the hull's big triangles sit their centre
        // below a sheer band's line while the letters' tiny ones sit above
        // it -- so on the black Skagit the letters came out white and read as
        // a second, broken logo. Tiny triangles on the skin now copy the paint
        // of the big skin triangle they sit on (a 1-inch grid per side).
        if (cBand) {
            var grid = {}, triA = new Float32Array(n);
            var cell = function (sx, y, z) { return sx + ':' + Math.floor(y) + ':' + Math.floor(z); };
            for (i = 0; i < n; i++) {
                var ax = src[i*9+3]-src[i*9], ay = src[i*9+4]-src[i*9+1], az = src[i*9+5]-src[i*9+2];
                var bx = src[i*9+6]-src[i*9], by = src[i*9+7]-src[i*9+1], bz = src[i*9+8]-src[i*9+2];
                var crx = ay*bz-az*by, cry = az*bx-ax*bz, crz = ax*by-ay*bx;
                triA[i] = 0.5 * Math.sqrt(crx*crx + cry*cry + crz*crz);
            }
            for (i = 0; i < n; i++) {
                if (triA[i] < 6) continue;
                var gx = (src[i*9] + src[i*9+3] + src[i*9+6]) / 3;
                if (!(nrm[i*3] * gx > 0 && Math.abs(nrm[i*3]) > 0.3)) continue;
                var sx = gx > 0 ? 1 : -1;
                // fill every 1" cell the triangle covers in the (y, z) plane
                var y0 = Math.min(src[i*9+1], src[i*9+4], src[i*9+7]), y1g = Math.max(src[i*9+1], src[i*9+4], src[i*9+7]);
                var z0 = Math.min(src[i*9+2], src[i*9+5], src[i*9+8]), z1 = Math.max(src[i*9+2], src[i*9+5], src[i*9+8]);
                if ((y1g - y0) * (z1 - z0) > 4000) continue;
                var Ay = src[i*9+1], Az = src[i*9+2], By = src[i*9+4], Bz = src[i*9+5], Cy = src[i*9+7], Cz = src[i*9+8];
                var den = (By - Ay) * (Cz - Az) - (Cy - Ay) * (Bz - Az);
                if (Math.abs(den) < 1e-6) continue;
                for (var yy = Math.floor(y0); yy <= y1g; yy++) {
                    for (var zz = Math.floor(z0); zz <= z1; zz++) {
                        var py = yy + 0.5, pz = zz + 0.5;
                        var w1 = ((py - Ay) * (Cz - Az) - (Cy - Ay) * (pz - Az)) / den;
                        var w2 = ((By - Ay) * (pz - Az) - (py - Ay) * (Bz - Az)) / den;
                        if (w1 < -0.05 || w2 < -0.05 || w1 + w2 > 1.05) continue;
                        // each vertex may carry its own paint: blend like the GPU would
                        var w0 = 1 - w1 - w2, o = i * 9;
                        grid[cell(sx, yy, zz)] = [
                            col[o]*w0 + col[o+3]*w1 + col[o+6]*w2,
                            col[o+1]*w0 + col[o+4]*w1 + col[o+7]*w2,
                            col[o+2]*w0 + col[o+5]*w1 + col[o+8]*w2];
                    }
                }
            }
            for (i = 0; i < n; i++) {
                if (triA[i] >= 6) continue;
                var tx = (src[i*9] + src[i*9+3] + src[i*9+6]) / 3,
                    ty = (src[i*9+1] + src[i*9+4] + src[i*9+7]) / 3,
                    tz = (src[i*9+2] + src[i*9+5] + src[i*9+8]) / 3;
                if (Math.abs(tx) < hwAt(ty) * 0.78 || tz < chineZ) continue;
                var gc = grid[cell(tx > 0 ? 1 : -1, ty, tz)];
                if (!gc) continue;
                for (k = 0; k < 3; k++) { col[i*9+k*3] = gc[0]; col[i*9+k*3+1] = gc[1]; col[i*9+k*3+2] = gc[2]; }
            }
        }

        // CAD (x, y, z) inches -> boat (x, y, z): y up, +z forward, transom at
        // -5, bottom at 0. Starboard is local -x in this game, CAD +x is
        // starboard in Inventor's default -- mirror x.
        var L = mx[1] - mn[1];
        var u = 10 / L;
        var pos = new Float32Array(n * 9);
        for (i = 0; i < n * 3; i++) {
            pos[i * 3]     = -src[i * 3] * u;
            pos[i * 3 + 1] = (src[i * 3 + 2] - mn[2]) * u;
            pos[i * 3 + 2] = (src[i * 3 + 1] - mn[1]) * u - 5;
        }
        // Mirroring flips winding; swap two verts per triangle back.
        for (i = 0; i < n; i++) {
            for (k = 0; k < 3; k++) {
                var t = pos[i * 9 + 3 + k]; pos[i * 9 + 3 + k] = pos[i * 9 + 6 + k]; pos[i * 9 + 6 + k] = t;
                t = col[i * 9 + 3 + k]; col[i * 9 + 3 + k] = col[i * 9 + 6 + k]; col[i * 9 + 6 + k] = t;
            }
        }
        var nor = new Float32Array(n * 9);
        for (i = 0; i < n; i++) {
            for (k = 0; k < 3; k++) {
                nor[i * 9 + k * 3]     = -nrm[i * 3];
                nor[i * 9 + k * 3 + 1] =  nrm[i * 3 + 2];
                nor[i * 9 + k * 3 + 2] =  nrm[i * 3 + 1];
            }
        }
        var geo = new THREE.BufferGeometry();
        geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
        geo.setAttribute('normal', new THREE.BufferAttribute(nor, 3));
        geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
        geo.computeBoundingSphere();
        var mat = new THREE.MeshStandardMaterial({
            vertexColors: true, roughness: 0.32, metalness: 0.72, side: THREE.DoubleSide
        });

        // THE LOGO IS PAINTED INTO THE HULL (2026-10-26). It used to be a flat
        // decal quad stood off the widest point of the hull; on a curved,
        // flared CAD skin most of it hung in the air -- Tyler: "it looked like
        // a logo next to the boat ... painted on the side please." Now the
        // hull's own shader paints it: any fragment of OUTWARD-facing skin
        // whose boat-local (z, y) falls inside the logo rectangle takes the
        // logo's colour, so it follows every curve like the paint does. Inner
        // faces point inboard and never get it, so it can't show through.
        // The rectangle is ~21% of the hull length on the aft quarter (Tyler's
        // measured 19-27%), hung just under the sheer.
        var dec = this._decals && this._decals.white;
        if (dec && dec.port) {
            var dW = 2.8, dH = dW / dec.arPort;
            var za = -4.6, zf = za + dW;
            var shA = (sheer[Math.min(nb - 1, Math.floor(((za + 5) / u) / BIN))] - mn[2]) * u;
            var y1 = shA - 0.2, y0d = y1 - dH;
            // Short topsides (the Sportster): the lower line used to run off
            // the chine onto the bottom. Shrink to fit 88% of the paintable
            // side, keeping the aft end where it is (2026-10-28).
            // The paintable side ends where the skin turns under (the logo
            // only paints faces whose normal points well outboard), so find
            // the lowest such face under the logo's span on this hull.
            var yA = (za + 5) / u + mn[1], yF = (za + 5 + dW) / u + mn[1], lowZ = 1e9;
            for (i = 0; i < n; i++) {
                var fx = nrm[i * 3], fzN = nrm[i * 3 + 2];
                var qx = (src[i * 9] + src[i * 9 + 3] + src[i * 9 + 6]) / 3,
                    qy = (src[i * 9 + 1] + src[i * 9 + 4] + src[i * 9 + 7]) / 3;
                if (qy < yA || qy > yF || fx * qx <= 0 || Math.abs(fx) < 0.55 || fzN < -0.35) continue;
                if (Math.abs(qx) < hwAt(qy) * 0.78) continue;
                for (k = 0; k < 3; k++) lowZ = Math.min(lowZ, src[i * 9 + k * 3 + 2]);
            }
            var chineY = lowZ < 1e8 ? (lowZ - mn[2]) * u : (chineZ - mn[2]) * u;
            var room = (y1 - chineY) * 0.9;
            if (room > 0.2 && dH > room) {
                dW *= room / dH; dH = room;
                zf = za + dW; y0d = y1 - dH;
            }
            var logoU = {
                uLogo: { value: dec.port },
                uLogoStbd: { value: dec.stbd || dec.port },
                uLogoRect: { value: new THREE.Vector4(za, zf, y0d, y1) }
            };
            mat.onBeforeCompile = function (sh) {
                sh.uniforms.uLogo = logoU.uLogo;
                sh.uniforms.uLogoStbd=logoU.uLogoStbd;
                sh.uniforms.uLogoRect = logoU.uLogoRect;
                sh.vertexShader = sh.vertexShader
                    .replace('#include <common>',
                        '#include <common>\nvarying vec3 vLogoPos;\nvarying vec3 vLogoNrm;')
                    .replace('#include <begin_vertex>',
                        '#include <begin_vertex>\nvLogoPos = position;\nvLogoNrm = normal;');
                sh.fragmentShader = sh.fragmentShader
                    .replace('#include <common>',
                        '#include <common>\nuniform sampler2D uLogo;\nuniform sampler2D uLogoStbd;\nuniform vec4 uLogoRect;\n' +
                        'varying vec3 vLogoPos;\nvarying vec3 vLogoNrm;')
                    .replace('#include <color_fragment>', [
                        '#include <color_fragment>',
                        '{',
                        '  float lgSide = vLogoPos.x >= 0.0 ? 1.0 : -1.0;',
                        '  vec3 lgN = normalize(vLogoNrm);',
                        '  if (lgN.x * lgSide > 0.3) {',
                        // u = 0 at the viewer's left on both sides: from +x the
                        // bow (+z) is on the left, from -x it is on the right.
                        '    float lgU = (vLogoPos.z - uLogoRect.x) / (uLogoRect.y - uLogoRect.x);',
                        '    if (lgSide > 0.0) lgU = 1.0 - lgU;',
                        '    float lgV = (vLogoPos.y - uLogoRect.z) / (uLogoRect.w - uLogoRect.z);',
                        '    if (lgU > 0.0 && lgU < 1.0 && lgV > 0.0 && lgV < 1.0) {',
                        '      vec4 lg = lgSide > 0.0 ? texture2D(uLogo,vec2(lgU,lgV)) : texture2D(uLogoStbd,vec2(lgU,lgV));',
                        '      diffuseColor.rgb = mix(diffuseColor.rgb, lg.rgb, lg.a);',
                        '    }',
                        '  }',
                        '}'
                    ].join('\n'));
            };
            mat.customProgramCacheKey = function () { return 'cadLogo'; };
        }

        var grp = new THREE.Group();
        grp.name = 'cad:' + model.id;
        grp.add(new THREE.Mesh(geo, mat));

        // Real proportions: undo the boat group's per-model beam/height
        // stretch so the CAD hull keeps the shape it was drawn with, scaled
        // only by length. _applyBoatModel sets boatGroup to
        // (3 bs, 3 hs, 3 ls); this makes the CAD group uniform at 3 ls.
        var bs = model.beamScale || 1, hs = model.heightScale || 1, ls = model.lengthScale || 1;
        grp.scale.set(ls / bs, ls / hs, 1);

        grp.userData.transomHalf = hw[0] * u;
        return grp;
    },

    _createBoat: function () {
        this.boatGroup = new THREE.Group();

        // Deck furniture that differs per model. Both rigs are built once and
        // _applyBoatModel() shows exactly one. Building both up front keeps
        // _createBoat a single call at init -- changing boats must never
        // rebuild geometry mid-run.
        var windshieldRig = new THREE.Group(); windshieldRig.name = 'windshieldRig';
        var consoleRig    = new THREE.Group(); consoleRig.name    = 'consoleRig';
        this.boatGroup.add(windshieldRig);
        this.boatGroup.add(consoleRig);

        var hullMat = new THREE.MeshStandardMaterial({
            color: 0xC9CCD1, roughness: 0.34, metalness: 0.72, side: THREE.DoubleSide
        });
        var capMat = new THREE.MeshStandardMaterial({
            color: 0xE8EAEE, roughness: 0.24, metalness: 0.80, side: THREE.DoubleSide
        });
        // Diamond/tread plate reads as a lighter, flatter gray from above.
        var deckMat = new THREE.MeshStandardMaterial({
            color: 0xB4B8BE, roughness: 0.48, metalness: 0.68, side: THREE.DoubleSide
        });
        var soleMat = new THREE.MeshStandardMaterial({
            color: 0xA2A7AD, roughness: 0.52, metalness: 0.62, side: THREE.DoubleSide
        });
        var glassMat = new THREE.MeshPhysicalMaterial({
            color: 0x1A3A44, roughness: 0.05, metalness: 0.15,
            transparent: true, opacity: 0.42, clearcoat: 1, clearcoatRoughness: 0.06, envMapIntensity: 1.1, side: THREE.DoubleSide
        });
        var frameMat = new THREE.MeshStandardMaterial({
            color: 0x222428, roughness: 0.55, metalness: 0.22
        });
        var vinylMat = new THREE.MeshStandardMaterial({
            color: 0x14151A, roughness: 0.85, metalness: 0.05
        });
        var motorMat = new THREE.MeshPhysicalMaterial({
            clearcoat: 1, clearcoatRoughness: 0.13,
            color: 0x191A1F, roughness: 0.22, metalness: 0.35
        });
        var intakeFootMat = new THREE.MeshStandardMaterial({
            color: 0xFFD800, roughness: 0.48, metalness: 0.22,
            // Hold the school-bus yellow under the river's green water tint.
            emissive: 0x8A6100, emissiveIntensity: 0.55
        });

        // Object-space tread survives the hand-built quads without UV seams.
        [deckMat, soleMat].forEach(function(mat) {
            mat.onBeforeCompile=function(shader) {
                shader.vertexShader='varying vec3 vTreadPos;\n'+shader.vertexShader;
                shader.vertexShader=shader.vertexShader.replace('#include <begin_vertex>','#include <begin_vertex>\nvTreadPos=position;');
                shader.fragmentShader='varying vec3 vTreadPos;\n'+shader.fragmentShader;
                shader.fragmentShader=shader.fragmentShader.replace('#include <roughnessmap_fragment>', `#include <roughnessmap_fragment>
                    vec2 tp=vTreadPos.xz*8.0;
                    vec2 cell=floor(tp);vec2 q=fract(tp)-0.5;
                    float parity=mod(cell.x+cell.y,2.0)*2.0-1.0;
                    vec2 diagonal=vec2(q.x+parity*q.y,q.x-parity*q.y)*0.7071;
                    float aa=max(fwidth(tp.x),fwidth(tp.y));
                    float tread=(1.0-smoothstep(0.07,0.07+aa,abs(diagonal.x)))*(1.0-smoothstep(0.30,0.30+aa,abs(diagonal.y)));
                    float fade=1.0-smoothstep(0.45,1.2,aa);
                    diffuseColor.rgb*=1.0+fade*(tread*0.36-0.07);
                    roughnessFactor=clamp(roughnessFactor-fade*tread*0.14,0.12,1.0);
                `);
            };
            mat.customProgramCacheKey=function(){return 'wooldridge-tread-v1';};
        });
        var self = this;
        // quad/box/tube append here. Reassign to route a block into a rig.
        var addTo = this.boatGroup;

        function quad(x0,y0,z0, x1,y1,z1, x2,y2,z2, x3,y3,z3, mat) {
            var g = new THREE.BufferGeometry();
            g.setAttribute('position', new THREE.BufferAttribute(new Float32Array([
                x0,y0,z0, x1,y1,z1, x2,y2,z2,
                x0,y0,z0, x2,y2,z2, x3,y3,z3
            ]), 3));
            g.computeVertexNormals();
            var m = new THREE.Mesh(g, mat);
            addTo.add(m);
            return m;
        }

        function box(w, h, d, x, y, z, mat) {
            var m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
            m.position.set(x, y, z);
            addTo.add(m);
            return m;
        }

        function softBox(w,h,d,x,y,z,r,mat) {
            var g=new THREE.BoxGeometry(w,h,d,4,4,4),p=g.attributes.position,n=g.attributes.normal;
            for(var j=0;j<p.count;j++) {
                var v=new THREE.Vector3().fromBufferAttribute(p,j);
                var core=new THREE.Vector3(Math.max(-w/2+r,Math.min(w/2-r,v.x)),Math.max(-h/2+r,Math.min(h/2-r,v.y)),Math.max(-d/2+r,Math.min(d/2-r,v.z)));
                var normal=v.clone().sub(core).normalize();v.copy(core).addScaledVector(normal,r);
                p.setXYZ(j,v.x,v.y,v.z);n.setXYZ(j,normal.x,normal.y,normal.z);
            }
            var mesh=new THREE.Mesh(g,mat);mesh.position.set(x,y,z);addTo.add(mesh);return mesh;
        }

        function tube(x0,y0,z0, x1,y1,z1, r, mat) {
            var dx = x1-x0, dy = y1-y0, dz = z1-z0;
            var len = Math.sqrt(dx*dx + dy*dy + dz*dz);
            var m = new THREE.Mesh(new THREE.CylinderGeometry(r, r, len, 8), mat);
            m.position.set((x0+x1)/2, (y0+y1)/2, (z0+z1)/2);
            m.quaternion.setFromUnitVectors(
                new THREE.Vector3(0, 1, 0),
                new THREE.Vector3(dx, dy, dz).normalize()
            );
            addTo.add(m);
            return m;
        }

        // ---------------------------------------------------------------
        // HULL STATIONS -- [ zBottom, zTop, halfWidth, bottomY, gunwaleY ]
        //
        // +z is forward. Transom -5.0, bow gunwale tip +5.0.
        // halfWidth walks 2.00 -> 1.10 in even steps: a straight-line
        // plan-view taper, exactly as the drone shot shows. No pinch.
        // Last station: bottom stops at 4.15, top runs to 5.00. That
        // 0.85 of forward rake IS the flat shovel bow.
        // ---------------------------------------------------------------
        var S = [
            [-5.00, -5.00, 2.00, 0.00, 1.05],
            [-2.50, -2.50, 1.97, 0.00, 1.07],
            [ 0.00,  0.00, 1.86, 0.00, 1.11],
            [ 2.00,  2.10, 1.66, 0.05, 1.19],
            [ 3.30,  3.55, 1.40, 0.24, 1.27],
            [ 4.15,  5.00, 1.10, 0.64, 1.34]
        ];

        var ZB = 0, ZT = 1, HW = 2, BY = 3, GY = 4;
        var i, a, b;

        function hwAt(z) {
            var k;
            for (k = 0; k < S.length - 1; k++) {
                if (z <= S[k + 1][ZB]) {
                    var t = (z - S[k][ZB]) / (S[k + 1][ZB] - S[k][ZB]);
                    return S[k][HW] + t * (S[k + 1][HW] - S[k][HW]);
                }
            }
            return S[S.length - 1][HW];
        }

        // Bottom panel + both side panels, station to station.
        for (i = 0; i < S.length - 1; i++) {
            a = S[i]; b = S[i + 1];

            quad(-a[HW],a[BY],a[ZB],  a[HW],a[BY],a[ZB],
                  b[HW],b[BY],b[ZB], -b[HW],b[BY],b[ZB], hullMat);

            quad(-a[HW],a[BY],a[ZB], -b[HW],b[BY],b[ZB],
                 -b[HW],b[GY],b[ZT], -a[HW],a[GY],a[ZT], hullMat);

            quad( a[HW],a[BY],a[ZB],  a[HW],a[GY],a[ZT],
                  b[HW],b[GY],b[ZT],  b[HW],b[BY],b[ZB], hullMat);
        }

        // Transom.
        a = S[0];
        quad(-a[HW],a[BY],a[ZB], -a[HW],a[GY],a[ZT],
              a[HW],a[GY],a[ZT],  a[HW],a[BY],a[ZB], hullMat);

        // THE FLAT BOW PLATE -- forward-raked. This is the whole point.
        b = S[S.length - 1];
        quad(-b[HW],b[BY],b[ZB],  b[HW],b[BY],b[ZB],
              b[HW],b[GY],b[ZT], -b[HW],b[GY],b[ZT], hullMat);

        // Gunwale cap strip down both sheer lines.
        var cw = 0.11;
        for (i = 0; i < S.length - 1; i++) {
            a = S[i]; b = S[i + 1];
            quad(-(a[HW]+cw),a[GY]+0.03,a[ZT], -a[HW],a[GY],a[ZT],
                 -b[HW],b[GY],b[ZT], -(b[HW]+cw),b[GY]+0.03,b[ZT], capMat);
            quad( a[HW],a[GY],a[ZT],  (a[HW]+cw),a[GY]+0.03,a[ZT],
                  (b[HW]+cw),b[GY]+0.03,b[ZT],  b[HW],b[GY],b[ZT], capMat);
        }
        // Cap across the head of the bow plate.
        quad(-(b[HW]+cw),b[GY]+0.03,b[ZT],  (b[HW]+cw),b[GY]+0.03,b[ZT],
              b[HW],b[GY],b[ZT], -b[HW],b[GY],b[ZT], capMat);
        // Cap across the transom.
        a = S[0];
        quad(-(a[HW]+cw),a[GY]+0.03,a[ZT],  (a[HW]+cw),a[GY]+0.03,a[ZT],
              a[HW],a[GY],a[ZT], -a[HW],a[GY],a[ZT], capMat);

        // ---------------------------------------------------------------
        // COCKPIT SOLE -- the camera looks down into the boat, so it
        // needs a real floor rather than the inside of the hull bottom.
        // ---------------------------------------------------------------
        var soleY = 0.30;
        var soleZ = [-4.62, -2.50, 0.00, 2.00, 3.30, 3.70];
        var inset = 0.13;
        for (i = 0; i < soleZ.length - 1; i++) {
            var z0 = soleZ[i], z1 = soleZ[i + 1];
            var w0 = hwAt(z0) - inset, w1 = hwAt(z1) - inset;
            quad(-w0,soleY,z0,  w0,soleY,z0,
                  w1,soleY,z1, -w1,soleY,z1, soleMat);
        }

        // Raised bow deck -- short, just forward of the windshield.
        var bdY = 0.94;
        var bdW0 = hwAt(3.72) - 0.10, bdW1 = hwAt(4.15) - 0.10;
        quad(-bdW0,bdY,3.72,  bdW0,bdY,3.72,
              bdW1,bdY,4.15, -bdW1,bdY,4.15, deckMat);
        quad(-bdW1,bdY,4.15,  bdW1,bdY,4.15,
              b[HW]*0.82,b[GY]-0.04,4.80, -b[HW]*0.82,b[GY]-0.04,4.80, deckMat);
        // Riser face from sole up to the bow deck.
        quad(-bdW0,soleY,3.72,  bdW0,soleY,3.72,
              bdW0,bdY,3.72, -bdW0,bdY,3.72, deckMat);

        // ---------------------------------------------------------------
        // WINDSHIELD RIG -- 2 panels, raked back, well forward. Never 3.
        // From here to the end of the seats belongs to the windshield boats
        // and is hidden entirely on the Rogue.
        // ---------------------------------------------------------------
        // Aft splashwell, floor access panels and longitudinal side shelves.
        // These break up the empty floor using the Alaskan interior reference.
        box(3.64,0.08,0.62,0,0.67,-4.56,deckMat);
        box(3.64,0.32,0.055,0,0.47,-4.22,hullMat);
        [-1,1].forEach(function(side){
            box(0.16,0.06,5.4,side*1.70,0.70,-1.2,deckMat);
            for(var rib=-3.5;rib<2;rib+=1.5)box(0.045,0.42,0.045,side*(hwAt(rib)-0.08),0.56,rib,capMat);
        });
        [-2.9,-1.4].forEach(function(z){
            var w=1.15,d=0.58,y=soleY+0.008;
            tube(-w,y,z-d,w,y,z-d,0.009,frameMat);tube(-w,y,z+d,w,y,z+d,0.009,frameMat);
            tube(-w,y,z-d,-w,y,z+d,0.009,frameMat);tube(w,y,z-d,w,y,z+d,0.009,frameMat);
            box(0.17,0.022,0.065,0,y+0.01,z+d-0.09,frameMat);
        });
        addTo = windshieldRig;

        var wz = 3.66, wHalf = 1.22, wh = 0.86, rake = 0.30;
        var wby = 1.26;
        var wTopY = wby + wh * Math.cos(rake);
        var wTopZ = wz - wh * Math.sin(rake);

        quad(-wHalf,wby,wz, -0.05,wby,wz,
             -0.05,wTopY,wTopZ, -wHalf,wTopY,wTopZ, glassMat);
        quad( 0.05,wby,wz,   wHalf,wby,wz,
              wHalf,wTopY,wTopZ, 0.05,wTopY,wTopZ, glassMat);

        // Side glass running aft along the gunwale, widening with the hull.
        var sgZ = 1.70, sgW = hwAt(sgZ) - 0.06, sgY = 1.20;
        quad(-wHalf,wby,wz, -wHalf,wTopY,wTopZ,
             -sgW,sgY+0.52,sgZ, -sgW,sgY,sgZ, glassMat);
        quad( wHalf,wby,wz,  sgW,sgY,sgZ,
              sgW,sgY+0.52,sgZ,  wHalf,wTopY,wTopZ, glassMat);

        // Frame posts: center + two outboard.
        var postH = wh + 0.09;
        function post(px) {
            var p = new THREE.Mesh(new THREE.BoxGeometry(0.055, postH, 0.07), frameMat);
            p.position.set(px, wby + postH * 0.5 * Math.cos(rake),
                           wz - postH * 0.5 * Math.sin(rake));
            p.rotation.x = -rake;
            addTo.add(p);
        }
        post(0);
        post(-wHalf);
        post(wHalf);

        // Head rail across the top of the windshield.
        tube(-wHalf - 0.05, wTopY, wTopZ, wHalf + 0.05, wTopY, wTopZ, 0.045, capMat);

        // ---------------------------------------------------------------
        // SIDE GRAB RAILS -- windshield boats only. The Rogue runs a clean
        // gunwale line (Tyler's call, and ROGUE-1 backs it), so these stay on
        // windshieldRig rather than the hull.
        // ---------------------------------------------------------------
        function sideRail(sx) {
            var zA = 3.55, zB2 = -1.20;
            var xA = sx * (hwAt(zA) + 0.04), xB = sx * (hwAt(zB2) + 0.04);
            var yTop = 1.62;
            tube(xA, yTop, zA, xB, yTop, zB2, 0.038, capMat);
            tube(xA, yTop, zA, sx * (hwAt(zA) + 0.02), 1.27, zA, 0.034, capMat);
            tube(xB, yTop, zB2, sx * (hwAt(zB2) + 0.02), 1.12, zB2, 0.034, capMat);
            var zM = 1.2;
            tube(sx * (hwAt(zM) + 0.04), yTop, zM,
                 sx * (hwAt(zM) + 0.02), 1.18, zM, 0.034, capMat);
        }
        sideRail(-1);
        sideRail(1);

        // ---------------------------------------------------------------
        // HELM -- console to STARBOARD, just aft of the windshield.
        // +z is forward, so starboard is -x. (It was on +x = port.)
        // ---------------------------------------------------------------
        box(0.74, 0.60, 0.86,  -0.86, soleY + 0.30, 2.92, deckMat);
        box(0.60, 0.05, 0.30,  -0.86, soleY + 0.62, 2.68, frameMat);
        var wheel = new THREE.Mesh(new THREE.TorusGeometry(0.20, 0.035, 6, 12), frameMat);
        wheel.position.set(-0.86, soleY + 0.78, 2.62);
        wheel.rotation.x = 1.10;
        addTo.add(wheel);

        // ---------------------------------------------------------------
        // SEATS -- two rows, as in the photo.
        // ---------------------------------------------------------------
        function seat(sx, sz) {
            box(0.12, 0.34, 0.12, sx, soleY + 0.17, sz, frameMat);
            softBox(0.60,0.16,0.60,sx,soleY+0.41,sz,0.055,vinylMat);
            softBox(0.60,0.56,0.17,sx,soleY+0.72,sz-0.23,0.065,vinylMat);
            // Padded side bolsters and raised center insert catch soft highlights.
            [-1,1].forEach(function(side){softBox(0.09,0.21,0.52,sx+side*0.255,soleY+0.49,sz,0.04,vinylMat);});
            softBox(0.38,0.34,0.035,sx,soleY+0.74,sz-0.128,0.015,frameMat);
        }
        seat(-0.80, 1.62);
        seat( 0.86, 1.62);
        seat(-0.80, 0.30);
        seat( 0.86, 0.30);

        // ---------------------------------------------------------------
        // CENTRE CONSOLE RIG -- the Rogue, from ARCHIVES/REFERENCES/BOAT/ROGUE-1..4:
        // no windshield, no seats, open tread-plate deck, one standing console
        // on the centreline.
        //
        // Console position was MEASURED off all four photos, not guessed, as a
        // fraction of hull length forward of the transom: 32.5% (ROGUE-1 side
        // elevation), 38% (ROGUE-2 aerial), 39.6% (ROGUE-3 stern quarter),
        // 32.5% (ROGUE-4 bow quarter). Mean 35.7%, which on a hull running
        // -5.00 to +5.00 puts it at z = -1.43 -- well AFT of amidships. That
        // is correct for a river sled: it keeps weight back and the bow light.
        // Do not "fix" it to z = 0 because the name says centre console.
        // Centre means the CENTRELINE (x = 0), not mid-length.
        // ---------------------------------------------------------------
        addTo = consoleRig;

        var ccZ = -1.43, ccH = 1.02, ccY = soleY;
        box(0.66, ccH,  0.74,  0, ccY + ccH * 0.5,  ccZ, frameMat);          // console body
        box(0.74, 0.07, 0.82,  0, ccY + ccH + 0.03, ccZ, deckMat);           // capped top
        box(0.50, 0.04, 0.26,  0, ccY + ccH + 0.09, ccZ + 0.20, frameMat);   // dash
        tube(-0.24, ccY + ccH + 0.06, ccZ + 0.34,
              0.24, ccY + ccH + 0.06, ccZ + 0.34, 0.032, capMat);            // grab bar

        var ccWheel = new THREE.Mesh(new THREE.TorusGeometry(0.19, 0.033, 6, 12), frameMat);
        ccWheel.position.set(0, ccY + ccH + 0.22, ccZ + 0.16);
        ccWheel.rotation.x = 1.15;
        addTo.add(ccWheel);

        function helmDetail(rig,x,y,z) {
            addTo=rig;
            var dash=softBox(0.48,0.19,0.035,x,y,z,0.015,frameMat);
            [-0.13,0.13].forEach(function(dx){
                var dial=new THREE.Mesh(new THREE.CircleGeometry(0.065,20),vinylMat);dial.position.set(x+dx,y,z-0.023);dial.rotation.y=Math.PI;addTo.add(dial);
                var rim=new THREE.Mesh(new THREE.TorusGeometry(0.069,0.009,6,20),capMat);rim.position.copy(dial.position);addTo.add(rim);
                tube(x+dx,y,z-0.027,x+dx+0.025,y+0.037,z-0.027,0.006,capMat);
            });
        }
        helmDetail(windshieldRig,-0.86,soleY+0.70,2.66);
        helmDetail(consoleRig,0,ccY+ccH-0.12,ccZ-0.385);
        addTo=consoleRig;

        // Raised bow storage box -- wears the wordmark in ROGUE-2 and ROGUE-3.
        box(1.30, 0.30, 0.80, 0, soleY + 0.15, 2.55, deckMat);

        // ---------------------------------------------------------------
        // FOUR MORE DECK RIGS, 2026-10-26. Until now every boat except the
        // Rogue wore the 18' Alaskan's windshield rig and silver paint, so the
        // LT, XL, Skagit and Sportster looked identical. Tyler: "I would like
        // each boat model to actually have a different look ... if these boats
        // don't look very close to the models I have on our website this won't
        // work." Built from the model pages on dev.wooldridgeboats.com
        // (LOCAL-WEBSITE/assets/photos/<model>/). The Alaskan (windshieldRig)
        // and the Rogue (consoleRig) are NOT touched -- Tyler: those "took so
        // long to get to look like they do and they look fine".
        //
        // Each rig carries its own hull PAINT as overlay bands just outboard of
        // the plating (0.012 out, inside the decals at 0.03), so the shared
        // hull material stays the Alaskan's silver and nothing is rebuilt when
        // you change boats -- _applyBoatModel only toggles which rig shows.
        //
        //   lt          16' Alaskan LT  -- low open sled, charcoal topsides,
        //                                  small centre console, two buckets
        //   walkthrough 20' Alaskan XL  -- royal-blue topsides, framed
        //                                  walk-through windshield, stern rails
        //   skagit      20' Skagit      -- black topsides under a bright alloy
        //                                  sheer band, framed windshield with a
        //                                  tube arch over it, stern rails
        //   cabin       21' Sportster   -- black/alloy two-tone, a tall almond
        //                                  enclosed cabin with a black roof
        // ---------------------------------------------------------------
        var ltRig    = new THREE.Group(); ltRig.name    = 'ltRig';
        var xlRig    = new THREE.Group(); xlRig.name    = 'xlRig';
        var skRig    = new THREE.Group(); skRig.name    = 'skagitRig';
        var cabRig   = new THREE.Group(); cabRig.name   = 'cabinRig';
        [ltRig, xlRig, skRig, cabRig].forEach(function (r) { r.visible = false; self.boatGroup.add(r); });

        function paint(hex, rough, metal) {
            return new THREE.MeshStandardMaterial({
                color: hex, roughness: rough === undefined ? 0.38 : rough,
                metalness: metal === undefined ? 0.25 : metal, side: THREE.DoubleSide
            });
        }
        var stainless = paint(0xDADDE2, 0.22, 0.65);
        var charcoal  = paint(0x34373C, 0.55, 0.20);
        var darkSole  = paint(0x3A3E44, 0.85, 0.10);

        // A paint band on both hull sides between fractions f0..f1 of the way
        // from chine (0) to gunwale (1), plus the matching band on the transom.
        function band(rig, mat, f0, f1) {
            addTo = rig;
            var k, sgn, A, B;
            function P(st, f, s) {
                return [s * (st[HW] + 0.012), st[BY] + (st[GY] - st[BY]) * f,
                        st[ZB] + (st[ZT] - st[ZB]) * f];
            }
            for (k = 0; k < S.length - 1; k++) {
                A = S[k]; B = S[k + 1];
                for (sgn = -1; sgn <= 1; sgn += 2) {
                    var a0 = P(A, f0, sgn), a1 = P(A, f1, sgn), b0 = P(B, f0, sgn), b1 = P(B, f1, sgn);
                    quad(a0[0],a0[1],a0[2], b0[0],b0[1],b0[2], b1[0],b1[1],b1[2], a1[0],a1[1],a1[2], mat)
                        .userData.band = true;
                }
            }
            A = S[0];
            var y0 = A[BY] + (A[GY] - A[BY]) * f0, y1 = A[BY] + (A[GY] - A[BY]) * f1;
            quad(-A[HW], y0, A[ZB] - 0.012,  A[HW], y0, A[ZB] - 0.012,
                  A[HW], y1, A[ZB] - 0.012, -A[HW], y1, A[ZB] - 0.012, mat).userData.band = true;
        }

        // Dark sole for the boats whose cockpit floor is charcoal in the
        // photos, laid just above the shared sole.
        function sole(rig, mat) {
            addTo = rig;
            for (var k = 0; k < soleZ.length - 1; k++) {
                var z0 = soleZ[k], z1 = soleZ[k + 1];
                var w0 = hwAt(z0) - inset, w1 = hwAt(z1) - inset;
                quad(-w0,soleY + 0.01,z0,  w0,soleY + 0.01,z0,
                      w1,soleY + 0.01,z1, -w1,soleY + 0.01,z1, mat);
            }
        }

        // Stainless stern rails along both aft gunwales, on stanchions.
        function sternRails(rig, zFwd) {
            addTo = rig;
            for (var sx = -1; sx <= 1; sx += 2) {
                var zA = zFwd, zB = -4.70, yR = 1.48;
                var xA = sx * (hwAt(zA) + 0.02), xB = sx * (hwAt(zB) + 0.02);
                tube(xA, yR, zA, xB, yR, zB, 0.032, stainless);
                for (var zs = zA; zs >= zB - 0.01; zs -= (zA - zB) / 3) {
                    var xs = sx * (hwAt(zs) + 0.02);
                    tube(xs, 1.08, zs, xs, yR, zs, 0.026, stainless);
                }
            }
            // ...and across the transom, either side of the motor.
            tube(-1.85, 1.48, -4.70, -0.62, 1.48, -4.70, 0.032, stainless);
            tube( 0.62, 1.48, -4.70,  1.85, 1.48, -4.70, 0.032, stainless);
        }

        function bucket(sx, sz, yBase) {
            box(0.10, 0.30, 0.10, sx, yBase + 0.15, sz, frameMat);
            box(0.50, 0.13, 0.50, sx, yBase + 0.37, sz, vinylMat);
            box(0.50, 0.46, 0.12, sx, yBase + 0.66, sz - 0.20, vinylMat);
        }

        // A framed two-panel windshield (Tyler's rule: two panels, never
        // three) with side glass, built from a few numbers so the XL and the
        // Skagit can share it while looking different.
        function framedShield(rig, o) {
            addTo = rig;
            var gz = o.z, hx = o.half, gh = o.h, rk = o.rake, gy = 1.24;
            var tY = gy + gh * Math.cos(rk), tZ = gz - gh * Math.sin(rk);
            var gap = o.gap;
            quad(-hx,gy,gz, -gap,gy,gz, -gap,tY,tZ, -hx,tY,tZ, glassMat);
            quad( gap,gy,gz,  hx,gy,gz,   hx,tY,tZ,  gap,tY,tZ, glassMat);
            var sz2 = o.sideZ, sw = hwAt(sz2) - 0.04;
            quad(-hx,gy,gz, -hx,tY,tZ, -sw,gy + o.sideH,sz2, -sw,gy,sz2, glassMat);
            quad( hx,gy,gz,  sw,gy,sz2,  sw,gy + o.sideH,sz2,  hx,tY,tZ, glassMat);
            var fr = o.frame, r = o.frameR;
            // Outline every pane: bottom, top, both uprights, side-glass top.
            tube(-hx, gy, gz, -gap, gy, gz, r, fr);  tube(gap, gy, gz, hx, gy, gz, r, fr);
            tube(-hx, tY, tZ, -gap, tY, tZ, r, fr);  tube(gap, tY, tZ, hx, tY, tZ, r, fr);
            tube(-hx, gy, gz, -hx, tY, tZ, r, fr);   tube(hx, gy, gz, hx, tY, tZ, r, fr);
            tube(-gap, gy, gz, -gap, tY, tZ, r, fr); tube(gap, gy, gz, gap, tY, tZ, r, fr);
            tube(-hx, tY, tZ, -sw, gy + o.sideH, sz2, r, fr);
            tube( hx, tY, tZ,  sw, gy + o.sideH, sz2, r, fr);
            tube(-sw, gy, sz2, -sw, gy + o.sideH, sz2, r, fr);
            tube( sw, gy, sz2,  sw, gy + o.sideH, sz2, r, fr);
            // Dash under each half of the glass.
            box(hx - gap - 0.12, 0.62, 0.62, -(hx + gap) / 2, soleY + 0.31, gz - 0.42, o.dash);
            box(hx - gap - 0.12, 0.62, 0.62,  (hx + gap) / 2, soleY + 0.31, gz - 0.42, o.dash);
            var wh2 = new THREE.Mesh(new THREE.TorusGeometry(0.19, 0.034, 6, 12), frameMat);
            wh2.position.set(-(hx + gap) / 2, soleY + 0.82, gz - 0.80);
            wh2.rotation.x = 1.10;
            addTo.add(wh2);
            return { topY: tY, topZ: tZ };
        }

        // ---- 16' ALASKAN LT ---------------------------------------------
        band(ltRig, paint(0x2F3236, 0.5, 0.2), 0.10, 0.80);
        addTo = ltRig;
        var ltZ = -0.85;
        box(0.62, 0.86, 0.62, 0, soleY + 0.43, ltZ, capMat);                  // alloy console
        box(0.66, 0.05, 0.66, 0, soleY + 0.88, ltZ, frameMat);                // top
        box(0.48, 0.05, 0.22, 0, soleY + 0.93, ltZ + 0.12, frameMat);         // dash
        quad(-0.28, soleY + 0.92, ltZ + 0.30, 0.28, soleY + 0.92, ltZ + 0.30,
              0.24, soleY + 1.28, ltZ + 0.16, -0.24, soleY + 1.28, ltZ + 0.16, glassMat); // little screen
        var ltWheel = new THREE.Mesh(new THREE.TorusGeometry(0.17, 0.03, 6, 12), frameMat);
        ltWheel.position.set(0, soleY + 1.04, ltZ - 0.30);
        ltWheel.rotation.x = 1.15;
        addTo.add(ltWheel);
        tube(-0.36, soleY + 0.95, ltZ - 0.36, -0.36, soleY + 0.95, ltZ + 0.34, 0.03, stainless);
        tube( 0.36, soleY + 0.95, ltZ - 0.36,  0.36, soleY + 0.95, ltZ + 0.34, 0.03, stainless);
        bucket(0, ltZ - 1.05, soleY);                                          // helm seat
        bucket(0.78, ltZ + 1.30, soleY);                                       // passenger, port
        box(1.10, 0.36, 0.56, 0, soleY + 0.18, 2.70, capMat);                  // bow cooler/box

        // ---- 20' ALASKAN XL ---------------------------------------------
        band(xlRig, paint(0x2148B8, 0.34, 0.30), 0.12, 0.88);
        sole(xlRig, darkSole);
        framedShield(xlRig, { z: 3.30, half: 1.36, h: 1.04, rake: 0.26, gap: 0.20,
                              sideZ: 1.30, sideH: 0.66, frame: charcoal, frameR: 0.045, dash: paint(0x2148B8, 0.4, 0.2) });
        addTo = xlRig;
        bucket(-0.78, 1.70, soleY); bucket(0.78, 1.70, soleY);
        box(2.6, 0.40, 0.55, 0, soleY + 0.20, -3.40, vinylMat);                // rear bench
        box(2.6, 0.45, 0.12, 0, soleY + 0.62, -3.66, vinylMat);
        sternRails(xlRig, -1.40);

        // ---- 20' SKAGIT -------------------------------------------------
        band(skRig, paint(0x16171B, 0.45, 0.20), 0.08, 0.66);
        band(skRig, paint(0xE3E6EA, 0.24, 0.55), 0.66, 0.96);
        var sk = framedShield(skRig, { z: 3.20, half: 1.30, h: 0.96, rake: 0.32, gap: 0.16,
                                       sideZ: 1.55, sideH: 0.56, frame: stainless, frameR: 0.04, dash: deckMat });
        addTo = skRig;
        var skArch0 = skRig.children.length;
        // Tube arch over the windshield: up from the side-glass corners, a
        // crossbar, and stays back down to the gunwale.
        // Tagged userData.arch, as are the stern rails below: on the CAD hull
        // (cad.keepRig 'arch') only those pieces are kept.
        var arY = 2.62, arZ = 1.70;
        for (var asx = -1; asx <= 1; asx += 2) {
            var ax = asx * (hwAt(1.55) - 0.10);
            tube(ax, 1.80, 1.55, ax * 0.92, arY, arZ, 0.04, stainless);
            tube(ax * 0.92, arY, arZ, ax * 0.85, arY, sk.topZ + 0.10, 0.04, stainless);
            tube(ax, 1.25, 0.40, ax * 0.92, arY, arZ, 0.034, stainless);
        }
        tube(-hwAt(1.55) * 0.83, arY, arZ, hwAt(1.55) * 0.83, arY, arZ, 0.04, stainless);
        tube(-hwAt(1.55) * 0.77, arY, sk.topZ + 0.10, hwAt(1.55) * 0.77, arY, sk.topZ + 0.10, 0.04, stainless);
        for (var ska = skArch0; ska < skRig.children.length; ska++) skRig.children[ska].userData.arch = true;
        bucket(-0.80, 1.55, soleY); bucket(0.80, 1.55, soleY);
        box(2.4, 0.38, 0.50, 0, soleY + 0.19, -3.30, vinylMat);
        var skRail0 = skRig.children.length;
        sternRails(skRig, -1.10);
        for (ska = skRail0; ska < skRig.children.length; ska++) skRig.children[ska].userData.arch = true;

        // ---- 21' SPORTSTER ----------------------------------------------
        band(cabRig, paint(0x141518, 0.42, 0.22), 0.06, 0.74);
        band(cabRig, paint(0xDCDFE3, 0.26, 0.5), 0.74, 0.96);
        addTo = cabRig;
        var almond = paint(0xE6E1D3, 0.45, 0.12);
        var roofMat = paint(0x1B1C20, 0.6, 0.1);
        var cz0 = 0.10, cz1 = 3.45, cy0 = 1.18, cy1 = 2.62;
        var cw0 = hwAt(cz0) - 0.10, cw1 = hwAt(cz1) - 0.16;
        // Cabin sides (almond lower, dark glass upper) and back.
        for (var csx = -1; csx <= 1; csx += 2) {
            quad(csx*cw0,cy0,cz0, csx*cw1,cy0,cz1, csx*cw1,cy0+0.55,cz1, csx*cw0,cy0+0.55,cz0, almond);
            quad(csx*cw0,cy0+0.55,cz0, csx*cw1,cy0+0.55,cz1, csx*cw1*0.96,cy1-0.12,cz1-0.30, csx*cw0*0.97,cy1-0.12,cz0, glassMat);
            tube(csx*cw0*0.97, cy0+0.55, cz0, csx*cw0*0.97, cy1-0.10, cz0, 0.05, almond);       // aft post
            tube(csx*cw1, cy0+0.55, cz1, csx*cw1*0.96, cy1-0.10, cz1-0.30, 0.05, almond);        // fwd post
            tube(csx*cw0*0.97, cy0+0.55, (cz0+cz1)/2, csx*cw1*0.98, cy1-0.10, (cz0+cz1)/2 - 0.1, 0.04, almond);
        }
        // Raked front glass, two panes.
        quad(-cw1,cy0+0.55,cz1, -0.05,cy0+0.55,cz1, -0.05,cy1-0.12,cz1-0.30, -cw1*0.96,cy1-0.12,cz1-0.30, glassMat);
        quad( 0.05,cy0+0.55,cz1,  cw1,cy0+0.55,cz1,  cw1*0.96,cy1-0.12,cz1-0.30,  0.05,cy1-0.12,cz1-0.30, glassMat);
        quad(-cw1,cy0,cz1, cw1,cy0,cz1, cw1,cy0+0.55,cz1, -cw1,cy0+0.55,cz1, almond);
        tube(0, cy0+0.55, cz1, 0, cy1-0.10, cz1-0.30, 0.045, almond);
        // Back wall: almond with a big dark rear window and a door.
        quad(-cw0,cy0,cz0, cw0,cy0,cz0, cw0,cy0+0.55,cz0, -cw0,cy0+0.55,cz0, almond);
        quad(-cw0*0.97,cy0+0.55,cz0, -0.40,cy0+0.55,cz0, -0.40,cy1-0.12,cz0, -cw0*0.97,cy1-0.12,cz0, glassMat);
        quad( 0.40,cy0+0.55,cz0,  cw0*0.97,cy0+0.55,cz0,  cw0*0.97,cy1-0.12,cz0,  0.40,cy1-0.12,cz0, glassMat);
        box(0.78, cy1 - cy0 - 0.12, 0.05, 0, (cy0 + cy1 - 0.12) / 2, cz0 - 0.02, almond);      // door
        box(0.60, 0.70, 0.02, 0, cy0 + 0.95, cz0 - 0.05, glassMat);                          // door glass
        // Roof: dark, overhanging a touch, flat.
        box(cw0 * 2 + 0.24, 0.12, cz1 - cz0 + 0.10, 0, cy1, (cz0 + cz1) / 2 - 0.12, roofMat);
        // Cockpit: low motor well bench and a pair of jump seats.
        box(2.6, 0.38, 0.50, 0, soleY + 0.19, -3.40, vinylMat);
        sternRails(cabRig, -2.20);

        // ---- 21' SPORTSTER TILLER: open cockpit, Grant at the stern tiller --
        // Ported from Codex's Grant prototype (2026-10-28). Red plaid flannel,
        // black Wooldridge cap, brown pants; a stylized stand-in, not a likeness.
        var tillerRig=new THREE.Group();tillerRig.name='tillerRig';tillerRig.visible=false;this.boatGroup.add(tillerRig);
        band(tillerRig,paint(0x16191d,0.30,0.35),0.08,0.88);
        addTo=tillerRig;
        [1.6,0.1].forEach(function(z){seat(-0.85,z);seat(0.85,z);});
        // Grant stands on the STARBOARD side and steers with his LEFT hand --
        // how he really runs a tiller (Tyler, 2026-10-28). Boat's right is -x.
        var driver=new THREE.Group();driver.name='GrantDriver';driver.position.set(-0.65,soleY,-3.65);tillerRig.add(driver);
        var hoodie=paint(0xffffff,0.92,0),pants=paint(0x594b42,0.95,0),skin=paint(0xc89476,0.78,0),hair=paint(0x30271f,0.95,0);
        // Red plaid flannel from Grant's river references; no sports jersey.
        var plaid=document.createElement('canvas');plaid.width=256;plaid.height=256;
        var pc=plaid.getContext('2d');pc.fillStyle='#b92736';pc.fillRect(0,0,256,256);
        for(var ps=0;ps<256;ps+=64){
            pc.fillStyle='rgba(22,36,63,0.68)';pc.fillRect(ps,0,23,256);pc.fillRect(0,ps,256,23);
            pc.fillStyle='rgba(32,132,122,0.60)';pc.fillRect(ps+34,0,12,256);pc.fillRect(0,ps+34,256,12);
            pc.fillStyle='rgba(231,192,167,0.35)';pc.fillRect(ps+28,0,2,256);pc.fillRect(0,ps+28,256,2);
        }
        var plaidTex=new THREE.CanvasTexture(plaid);plaidTex.encoding=THREE.sRGBEncoding;
        hoodie.map=plaidTex;
        addTo=driver;
        softBox(0.62,0.84,0.36,0,1.38,0,0.12,hoodie);
        softBox(0.5,0.23,0.33,0,0.91,0,0.07,pants);
        [-1,1].forEach(function(side){tube(side*0.17,0.91,0,side*0.2,0.46,0.06,0.105,pants);tube(side*0.2,0.46,0.06,side*0.24,0.08,0.03,0.085,pants);softBox(0.19,0.14,0.32,side*0.24,0.06,0.15,0.04,frameMat);});
        var head=new THREE.Mesh(new THREE.SphereGeometry(0.23,16,12),skin);head.position.set(0,1.99,0);head.scale.set(0.82,1.12,0.9);driver.add(head);
        var beard=new THREE.Mesh(new THREE.SphereGeometry(0.21,12,8),hair);beard.position.set(0,1.85,0.07);beard.scale.set(0.82,0.7,0.82);driver.add(beard);
        var hairTop=new THREE.Mesh(new THREE.SphereGeometry(0.235,16,8,0,Math.PI*2,0,Math.PI/2),hair);hairTop.position.set(0,2.08,-0.02);hairTop.scale.y=0.65;driver.add(hairTop);
        // Left arm (+x) reaches back to the tiller; right arm hangs relaxed.
        tube(0.30,1.65,0,0.45,1.26,-0.16,0.085,hoodie);tube(0.45,1.26,-0.16,0.58,1.08,-0.58,0.065,hoodie);
        tube(-0.30,1.65,0,-0.36,1.26,0.08,0.085,hoodie);tube(-0.36,1.26,0.08,-0.35,1.04,0.15,0.065,skin);
        var grantCapMat=paint(0x101114,0.94,0);
        var cap=new THREE.Mesh(new THREE.SphereGeometry(0.25,20,12,0,Math.PI*2,0,Math.PI/2),grantCapMat);
        cap.position.set(0,2.08,-0.015);cap.scale.set(1,0.78,1);driver.add(cap);
        var brim=new THREE.Mesh(new THREE.SphereGeometry(1,20,8),grantCapMat);
        brim.position.set(0,2.085,0.20);brim.scale.set(0.27,0.025,0.23);driver.add(brim);
        var patch=document.createElement('canvas');patch.width=512;patch.height=192;
        var hc=patch.getContext('2d');hc.fillStyle='#111216';hc.fillRect(0,0,512,192);
        hc.strokeStyle='#eeeeee';hc.lineWidth=8;hc.strokeRect(10,10,492,172);
        hc.fillStyle='#f5f5f5';hc.textAlign='center';hc.font='bold 66px Arial';hc.fillText('Wooldridge',256,86);
        hc.font='bold 43px Arial';hc.fillText('BOATS · 1915',256,145);
        var patchTex=new THREE.CanvasTexture(patch);patchTex.encoding=THREE.sRGBEncoding;
        var capPatch=new THREE.Mesh(new THREE.PlaneGeometry(0.30,0.115),new THREE.MeshStandardMaterial({map:patchTex,roughness:0.9}));
        capPatch.position.set(0,2.17,0.218);driver.add(capPatch);
        addTo=tillerRig;
        tube(0,0.95,-5.2,-0.08,1.38,-4.20,0.055,frameMat);tube(-0.08,1.38,-4.20,-0.08,1.38,-4.0,0.065,vinylMat);
        this._tillerDriver=driver;

        // Everything built straight onto boatGroup so far is the hand-built
        // HULL (plating, cap, sole, bow deck). Gather it into one group so a
        // boat with a real CAD hull can hide it in one go. The rigs are
        // already their own groups and stay where they are.
        var baseHull = new THREE.Group(); baseHull.name = 'baseHull';
        this.boatGroup.children.slice().forEach(function (ch) {
            if (ch.isMesh) baseHull.add(ch);
        });
        this.boatGroup.add(baseHull);
        this._baseHull = baseHull;

        addTo = this.boatGroup;

        // ---------------------------------------------------------------
        // OUTBOARD -- boxy cowl, hung on the transom.
        // ---------------------------------------------------------------
        var motorRig = new THREE.Group();
        motorRig.position.set(0, 0, -5.14);
        this.boatGroup.add(motorRig);
        this._motorRig = motorRig;
        addTo = motorRig;
        var mz = -5.64;
        box(0.74, 0.56, 0.42,  0, 0.88, -5.14, motorMat);   // transom bracket
        // Sculpted outboard cowl: rounded rectangular sections, tapered crown.
        var rings=[[0.70,0.40,0.38],[0.80,0.49,0.45],[1.34,0.54,0.49],[1.70,0.48,0.43],[1.88,0.32,0.30],[1.93,0.04,0.04]];
        var cp=[],ci=[],steps=32;
        rings.forEach(function(r){for(var j=0;j<steps;j++){var a=j/steps*Math.PI*2,c=Math.cos(a),sn=Math.sin(a);cp.push(Math.sign(c)*Math.pow(Math.abs(c),0.68)*r[1],r[0],mz+Math.sign(sn)*Math.pow(Math.abs(sn),0.68)*r[2]);}});
        for(var ri=0;ri<rings.length-1;ri++)for(var cj=0;cj<steps;cj++){var a=ri*steps+cj,b=ri*steps+(cj+1)%steps;ci.push(a,a+steps,b,b,a+steps,b+steps);}
        var cowlGeo=new THREE.BufferGeometry();cowlGeo.setAttribute('position',new THREE.Float32BufferAttribute(cp,3));cowlGeo.setIndex(ci);cowlGeo.computeVertexNormals();
        var cowl=new THREE.Mesh(cowlGeo,motorMat);addTo.add(cowl);
        softBox(0.80,0.065,0.86,0,0.81,mz,0.025,frameMat);
        // Rear air intake and subtle bright trim, visible from the chase camera.
        softBox(0.51,0.12,0.035,0,1.61,mz-0.442,0.015,frameMat);
        for(var vent=0;vent<4;vent++)box(0.42,0.012,0.018,0,1.57+vent*0.025,mz-0.466,capMat);
        softBox(0.57,0.035,0.025,0,1.02,mz-0.477,0.01,capMat);
        box(0.44, 1.22, 0.48,  0, 0.16, mz,    motorMat);   // midsection
        box(0.34, 0.44, 1.18,  0, -0.54, mz + 0.08, intakeFootMat);  // yellow intake foot
        box(0.09, 0.33, 0.53,  0, -0.88, mz + 0.03, intakeFootMat);  // yellow skeg

        motorRig.children.forEach(function (o) { o.position.z += 5.14; });
        addTo = this.boatGroup;

        // ---------------------------------------------------------------
        // WB FULL LOGO -- where the real boats actually carry it: a badge on
        // the AFT QUARTER of each hull side, just forward of the transom and
        // high in the side panel. See ARCHIVES/REFERENCES/BOAT/EXTERIOR-1.JPG and
        // ON RIVER-EXTERIOR-2/4.JPG -- on every one of them the wordmark is a
        // small aft decal, roughly a sixth of the hull length, not a
        // full-length wrap.
        //
        // It used to run from the transom to past midships on a flat plane at
        // a fixed x, which left it hanging in the air forward of amidships
        // where the topsides taper in. lgXa/lgXf read hwAt() so the decal now
        // sits on the plating the whole way.
        //
        // Starboard is local -x (verified by projecting a boat-local point
        // through the chase camera). The UVs are flipped per side so the
        // wordmark reads left-to-right for whoever is looking at it, rather
        // than coming out mirrored on one side.
        // ---------------------------------------------------------------
        // ---------------------------------------------------------------
        // DECALS. Every source Tyler supplies is a TWO-UP SHEET: the same
        // lockup twice, top and bottom, mirrored so the WB mark sits at the
        // correct end for each side of the boat. His convention:
        //
        //     TOP of the sheet    -> LEFT  (port, +x)
        //     BOTTOM of the sheet -> RIGHT (starboard, -x)
        //
        // These were split and cropped to each variant's own alpha bbox --
        // WB-WINGS.png and the WIZARCO ROGUE pdf both went through the same
        // routine. Mapping a whole sheet onto one quad puts BOTH lockups on
        // the same panel, which is exactly the bug this replaced: it looked
        // like the far side showing through the hull, and it was not.
        //
        // Splitting also recovered the real lockup proportion. The two-up
        // sheet reads ~2.8:1, but a single lockup is 3.91:1 (standard) and
        // 5.83:1 (Rogue) -- which is what the delivery photos measure.
        // ---------------------------------------------------------------
        // SAFARI-PROOF DECALS (2026-10-26). Safari dropped the alpha-mapped
        // photo crowns on the trees, and the decals are the same kind of
        // asset -- transparent PNGs carrying a camera colour profile and EXIF.
        // Tyler wasn't sure the logos showed for him at all. So the PNG is
        // drawn into a plain canvas first (which throws away the embedded
        // profile and metadata) and uploaded from there without mipmaps
        // (no sRGB mip generation, the other Safari suspect). The decal is
        // seen at one size from the chase camera, so mips buy nothing.
        function loadDecal(file, lightText) {
            var cv = document.createElement('canvas');
            cv.width = 4; cv.height = 4;
            var t = new THREE.CanvasTexture(cv);
            if (THREE.SRGBColorSpace !== undefined) t.colorSpace = THREE.SRGBColorSpace;
            else if (THREE.sRGBEncoding !== undefined) t.encoding = THREE.sRGBEncoding;
            t.generateMipmaps = false;
            t.minFilter = THREE.LinearFilter;
            t.magFilter = THREE.LinearFilter;
            var img = new Image();
            img.onload = function () {
                cv.width = img.naturalWidth; cv.height = img.naturalHeight;
                var x = cv.getContext('2d');
                x.clearRect(0, 0, cv.width, cv.height);
                x.drawImage(img, 0, 0);
                // Preserve the supplied wing shapes and blue. Only the dark
                // wordmark changes to white on dark painted hulls.
                if(lightText){var pixels=x.getImageData(0,0,cv.width,cv.height),d=pixels.data;
                    for(var pi=0;pi<d.length;pi+=4){if(d[pi+3] && Math.max(d[pi],d[pi+1],d[pi+2])<100)d[pi]=d[pi+1]=d[pi+2]=245;}
                    x.putImageData(pixels,0,0);
                }
                t.needsUpdate = true;
            };
            img.src = file;
            return t;
        }
        var V = '?v=20260901g';
        this._decals = {
            std:   { port: loadDecal('GAME/ASSETS/BOAT/WB-LOGO-PORT.png' + V),
                     stbd: loadDecal('GAME/ASSETS/BOAT/WB-LOGO-STBD.png' + V),
                     arPort: 1600 / 409, arStbd: 1600 / 406 },
            rogue: { port: loadDecal('GAME/ASSETS/BOAT/WB-ROGUE-PORT.png' + V),
                     stbd: loadDecal('GAME/ASSETS/BOAT/WB-ROGUE-STBD.png' + V),
                     arPort: 1598 / 274, arStbd: 1556 / 273 },
            // Blue wing with white lettering for dark and blue hulls.
            // Separate port/starboard artwork keeps the text readable.
            white: { port: loadDecal('GAME/ASSETS/BOAT/WB-LOGO-PORT.png' + V, true),
                     stbd: loadDecal('GAME/ASSETS/BOAT/WB-LOGO-STBD.png' + V, true),
                     arPort: 1600 / 409, arStbd: 1600 / 406 }
        };
        this._boatMats = {
            hull: hullMat, cap: capMat, deck: deckMat, sole: soleMat
        };
        this._boatRigs = { windshield: windshieldRig, console: consoleRig,
                           lt: ltRig, walkthrough: xlRig, skagit: skRig, cabin: cabRig, tiller: tillerRig };
        this._motorMat = motorMat;

        function logoQuad(group, tex, pts) {
            var g = new THREE.BufferGeometry();
            g.setAttribute('position', new THREE.BufferAttribute(new Float32Array([
                pts[0][0], pts[0][1], pts[0][2],
                pts[1][0], pts[1][1], pts[1][2],
                pts[2][0], pts[2][1], pts[2][2],
                pts[0][0], pts[0][1], pts[0][2],
                pts[2][0], pts[2][1], pts[2][2],
                pts[3][0], pts[3][1], pts[3][2]
            ]), 3));
            // pts order is bottom-left, bottom-right, top-right, top-left as
            // the text reads, so u=0 lands at the viewer's left on BOTH sides.
            g.setAttribute('uv', new THREE.BufferAttribute(new Float32Array([
                0, 0,  1, 0,  1, 1,
                0, 0,  1, 1,  0, 1
            ]), 2));
            g.computeVertexNormals();
            // FrontSide only -- each quad's winding faces outboard, so the far
            // side is back-face culled and cannot bleed through the hull.
            var m = new THREE.Mesh(g, new THREE.MeshBasicMaterial({
                map: tex, transparent: true, side: THREE.FrontSide,
                depthWrite: false, polygonOffset: true,
                polygonOffsetFactor: -4, polygonOffsetUnits: -4
            }));
            m.renderOrder = 2;
            group.add(m);
            return m;
        }

        // Aft badge. Placement measured off the delivery photos, not guessed:
        // the decal runs 19-27% of hull length and starts about 3% of hull
        // length forward of the transom. WIDTH is the matched proportion;
        // height falls out of each variant's own aspect ratio, so the artwork
        // is never stretched to fit.
        //
        // Starboard is local -x, verified by projecting a boat-local point
        // through the chase camera.
        function decalSide(group, tex, aspect, sign, width) {
            var za=-4.74,zf=za+width,h=width/aspect,y1=0.99,y0=y1-h;
            tex.anisotropy=self.renderer.capabilities.getMaxAnisotropy();
            var cuts=[za];S.forEach(function(st){if(st[0]>za&&st[0]<zf)cuts.push(st[0]);});cuts.push(zf);
            for(var j=0;j<cuts.length-1;j++) {
                var a=cuts[j],b=cuts[j+1],xa=(hwAt(a)+0.012)*sign,xb=(hwAt(b)+0.012)*sign;
                var mesh=logoQuad(group,tex,sign<0?[[xa,y0,a],[xb,y0,b],[xb,y1,b],[xa,y1,a]]:[[xb,y0,b],[xa,y0,a],[xa,y1,a],[xb,y1,b]]);
                var u0=(a-za)/width,u1=(b-za)/width;
                if(sign>0){var temp=u0;u0=1-u1;u1=1-temp;}
                mesh.geometry.setAttribute('uv',new THREE.Float32BufferAttribute([u0,0,u1,0,u1,1,u0,0,u1,1,u0,1],2));
            }
        }

        var logoStdRig   = new THREE.Group(); logoStdRig.name   = 'logoStdRig';
        var logoRogueRig = new THREE.Group(); logoRogueRig.name = 'logoRogueRig';
        this.boatGroup.add(logoStdRig);
        this.boatGroup.add(logoRogueRig);
        var logoWhiteRig = new THREE.Group(); logoWhiteRig.name = 'logoWhiteRig';
        this.boatGroup.add(logoWhiteRig);
        this._logoRigs = { std: logoStdRig, rogue: logoRogueRig, white: logoWhiteRig };

        // DECAL SIZE -- this is the "make the branding louder" knob the
        // 2026-09-01 changelog refers to (it was called lgH then). The badge
        // was at 1.96, the very bottom of the 19-27% of hull length the
        // delivery photos measure, and from the dead-astern chase camera that
        // came to almost nothing: 0 pixels below 10 degrees of bow angle and
        // only ~2,300 of 921,600 even at 30. Tyler reported the logos as
        // simply gone. Taken to the top of the measured range instead.
        //
        // Height is NOT set here -- it falls out of each variant's own aspect
        // ratio in decalSide(), so the standard 3.91:1 lockup and the Rogue's
        // much longer 5.83:1 WIZARCO lockup both stay unstretched.
        var DW = 2.90;                                // 27% of a 10-unit hull
        decalSide(logoStdRig,   this._decals.std.port,   this._decals.std.arPort,   1, DW);
        decalSide(logoStdRig,   this._decals.std.stbd,   this._decals.std.arStbd,  -1, DW);
        decalSide(logoRogueRig, this._decals.rogue.port, this._decals.rogue.arPort, 1, DW);
        decalSide(logoRogueRig, this._decals.rogue.stbd, this._decals.rogue.arStbd,-1, DW);
        decalSide(logoWhiteRig, this._decals.white.port, this._decals.white.arPort, 1, DW * 0.92);
        decalSide(logoWhiteRig, this._decals.white.stbd, this._decals.white.arStbd,-1, DW * 0.92);

        // NOTHING GOES ON THE TRANSOM OR THE OUTBOARD. Tyler's call, and the
        // reference photos back it: the transom is bare aluminium and the cowl
        // belongs to the engine maker. A full-width transom slab, a cowl copy
        // and a small transom badge all existed here and all are gone -- do
        // not reintroduce them to "help" the dead-astern chase camera see the
        // branding. The hull sides are the only place the logo goes.

        this.boatGroup.scale.set(3, 3, 3);
        if (this.scene) this.scene.add(this.boatGroup);
        this._loadCadBoats();
    },

    // A soft feathered streak, so the wake has no hard edges. The old wake
    // was two flat rectangles, which read on screen as two white lines.
    _makeWakeTexture: function () {
        var c = document.createElement('canvas');
        c.width = 64; c.height = 256;
        var g = c.getContext('2d');
        g.clearRect(0, 0, 64, 256);

        var row, t, alpha, grad;
        for (row = 0; row < 256; row++) {
            t = row / 255;                       // 0 at the transom, 1 at the tail
            // Strong just behind the boat, gone by the far end.
            alpha = Math.pow(1 - t, 1.5) * 0.9;
            // Feather the long edges so it blends into the river.
            grad = g.createLinearGradient(0, 0, 64, 0);
            grad.addColorStop(0.00, 'rgba(255,255,255,0)');
            grad.addColorStop(0.30, 'rgba(255,255,255,' + (alpha * 0.75) + ')');
            grad.addColorStop(0.50, 'rgba(255,255,255,' + alpha + ')');
            grad.addColorStop(0.70, 'rgba(255,255,255,' + (alpha * 0.75) + ')');
            grad.addColorStop(1.00, 'rgba(255,255,255,0)');
            g.fillStyle = grad;
            g.fillRect(0, row, 64, 1);
        }
        var tex = new THREE.CanvasTexture(c);
        tex.needsUpdate = true;
        return tex;
    },

    // Soft round blob for the churn boiling off the transom.
    _makeChurnTexture: function () {
        var c = document.createElement('canvas');
        c.width = 128; c.height = 128;
        var g = c.getContext('2d');
        var rg = g.createRadialGradient(64, 64, 4, 64, 64, 62);
        rg.addColorStop(0.0, 'rgba(255,255,255,0.85)');
        rg.addColorStop(0.4, 'rgba(235,245,250,0.45)');
        rg.addColorStop(1.0, 'rgba(220,238,246,0)');
        g.fillStyle = rg;
        g.fillRect(0, 0, 128, 128);
        var tex = new THREE.CanvasTexture(c);
        tex.needsUpdate = true;
        return tex;
    },

    _createWake: function () {
        this.wakeGroup = new THREE.Group();

        var wakeTex = this._makeWakeTexture();

        // Each arm of the V is a trapezoid: tight at the transom, spreading
        // out behind, laid flat on the water and angled outward like a real
        // wake rather than running dead straight back.
        function armGeometry(sign) {
            var nearHalf = 0.5, farHalf = 3.4;   // spread
            var zNear = -5.5, zFar = -34;        // length aft
            var xNear = sign * 2.0, xFar = sign * 9.5;

            var g = new THREE.BufferGeometry();
            g.setAttribute('position', new THREE.BufferAttribute(new Float32Array([
                xNear - nearHalf, 0, zNear,
                xNear + nearHalf, 0, zNear,
                xFar  + farHalf,  0, zFar,
                xNear - nearHalf, 0, zNear,
                xFar  + farHalf,  0, zFar,
                xFar  - farHalf,  0, zFar
            ]), 3));
            g.setAttribute('uv', new THREE.BufferAttribute(new Float32Array([
                0, 0,  1, 0,  1, 1,
                0, 0,  1, 1,  0, 1
            ]), 2));
            g.computeVertexNormals();
            return g;
        }

        var i, arm;
        for (i = 0; i < 2; i++) {
            var sign = i === 0 ? -1 : 1;
            arm = new THREE.Mesh(armGeometry(sign), new THREE.MeshBasicMaterial({
                map: wakeTex, color: 0xEAF4F8, transparent: true, opacity: 0,
                side: THREE.DoubleSide, depthWrite: false
            }));
            arm.position.y = 0.10;
            arm.renderOrder = 3;
            arm.name = i === 0 ? 'wakeL' : 'wakeR';
            this.wakeGroup.add(arm);
        }

        // Prop wash boiling straight off the transom.
        var churnTex = this._makeChurnTexture();
        var churn = new THREE.Mesh(
            new THREE.PlaneGeometry(4.4, 13),
            new THREE.MeshBasicMaterial({
                map: churnTex, transparent: true, opacity: 0,
                depthWrite: false, side: THREE.DoubleSide
            })
        );
        churn.rotation.x = -Math.PI / 2;
        churn.position.set(0, 0.12, -11.5);
        churn.renderOrder = 4;
        churn.name = 'churn';
        this.wakeGroup.add(churn);

        var sprayMat = new THREE.MeshBasicMaterial({
            map: churnTex, color: 0xEFF8FF, transparent: true,
            opacity: 0, depthWrite: false
        });
        var sprayGeo = new THREE.PlaneGeometry(2.2, 2.2);

        for (i = 0; i < 6; i++) {
            var spray = new THREE.Mesh(sprayGeo, sprayMat.clone());
            spray.position.set((i % 2 === 0 ? -1 : 1) * (1.9 + (i % 3) * 0.45),
                               0.4, -6.2 - i * 1.1);
            spray.renderOrder = 5;
            spray.name = 'spray' + i;
            this.wakeGroup.add(spray);
        }

        this.scene.add(this.wakeGroup);
    },

    update: function (dt, time) {
        if (RR.Ramps) RR.Ramps.animate(time || 0);
        if (!this.ready) return;
        var boat = RR.Boat;
        var C = RR.Config;
        var S = this.RIVER_SCALE;
        var model = boat.getModel ? boat.getModel() : { beamScale: 1, lengthScale: 1 };

        if (this.waterUniforms) {
            this.waterUniforms.uTime.value = time;
            this.waterUniforms.uCamPos.value.copy(this.camera.position);
        }

        var wp = this.getWorldPos(boat.z, boat.lateral);
        var boatHeading = wp.heading;

        if (this.boatGroup) {
            this.boatGroup.scale.set(3 * model.beamScale, 3 * (model.heightScale || 1), 3 * model.lengthScale);
            this.boatGroup.position.set(wp.x, boat.jumpHeight * S + (boat.rampHeight || 0) + 0.2, wp.z);
            // Positive lateral is screen-right, along (-cos(h), sin(h)).
            // Three.js positive yaw turns +Z toward +X, the opposite direction.
            // Keep river yaw positive, but subtract the simulation's helm angle.
            this.boatGroup.rotation.y = boatHeading - boat.headingOffset;
            this.boatGroup.rotation.z = boat.tilt * 0.5;

            var pitchTarget = -(boat.speed / boat.getMaxSpeed()) * 0.08;
            var planing = Math.min(1, boat.speed / boat.getMaxSpeed());
            this.boatGroup.rotation.x = pitchTarget + (boat.rampPitch || 0) + Math.sin(time * 5.2) * 0.006 * planing;
            this.boatGroup.position.y += Math.sin(time * 4.3) * 0.055 * planing;
            // The jet pushes the stern opposite the bow turn.
            if (this._motorRig) this._motorRig.rotation.y = (boat.helm || 0) * 0.32;
        }

        var lookAhead = this.getWorldPos(boat.z + this.CAM_LOOK_AHEAD * this.SEG_LEN * S, boat.lateral * 0.3);

        // Keep the camera locked directly astern.
        //
        // This used to lerp the camera's WORLD POSITION toward a point behind
        // the boat. On a hard bend the position lagged so far that the camera
        // ended up alongside or ahead of the boat -- which is what made her
        // look like she was running backwards with the motor out front. Smooth
        // the camera's ANGLE around the boat instead: it still eases, but it
        // can never swing round to the front.
        // Keep the chase camera directly behind the channel. Following the
        // steering angle and offsetting the camera made A/D feel disconnected
        // from the screen. Terminal course drift is corrected in river.js, so
        // a conventional astern view remains stable all the way to the gate.
        // The channel-relative chase view leaves the bow's turn visible.
        // If bow-follow is enabled later, use the same sign as the hull.
        var targetCamYaw = wp.heading - boat.headingOffset * this.CAM_FOLLOW_BOW;
        if (this._camYaw === undefined || this._camYaw === null) this._camYaw = targetCamYaw;
        var dYaw = targetCamYaw - this._camYaw;
        while (dYaw > Math.PI) dYaw -= Math.PI * 2;
        while (dYaw < -Math.PI) dYaw += Math.PI * 2;
        // The camera must track the bow almost exactly. Any lag here shows up
        // directly as the hull sitting crooked on screen, because screen yaw IS
        // (boat yaw - camera yaw). At the old 8.0 the camera fell behind hard
        // enough that fast helm work read as 76 degrees of hull angle. The
        // easing you actually see comes from the BOW's own response
        // (STEER_RESPONSE), which is already smoothed -- it does not need to be
        // smoothed a second time here.
        this._camYaw += dYaw * Math.min(1, this.CAM_YAW_SMOOTH * dt);

        var targetCamY = this.CAM_HEIGHT + boat.jumpHeight * S * 0.3;
        var camX = wp.x - Math.sin(this._camYaw) * this.CAM_DIST +
            Math.cos(this._camYaw) * this.CAM_SHOULDER;
        var camZ = wp.z - Math.cos(this._camYaw) * this.CAM_DIST -
            Math.sin(this._camYaw) * this.CAM_SHOULDER;

        if (!this._camPos) {
            this._camPos = { x: camX, y: targetCamY, z: camZ };
        }
        this._camPos.x = camX;
        this._camPos.z = camZ;
        this._camPos.y += (targetCamY - this._camPos.y) * Math.min(1, 4.0 * dt);

        this.camera.position.set(this._camPos.x, this._camPos.y, this._camPos.z);
        if (this.waterUniforms) this.waterUniforms.uCamPos.value.copy(this.camera.position);
        // AIM ALONG THE CAMERA'S OWN YAW AXIS -- the same axis the camera is
        // positioned on -- so the hull sits pointing UP the screen.
        //
        // This used to look at wp * 0.7 + lookAhead * 0.3, a point 30% of the
        // way toward the channel 15 segments up the river. On a bend that
        // target swings out to the side, which rotates the whole view and
        // therefore rotates the boat in it. Measured over a run: the hull read
        // up to 16.3 degrees off vertical on screen while the physics crab was
        // 0.0 and the camera-angle lag only 2.6 -- so roughly 14 degrees of
        // "the boat looks sideways" was coming from the aim point alone, and no
        // amount of steering tuning could have fixed it.
        //
        // CAM_LOOK_BLEND keeps a little of the old lead so a bend still opens
        // up ahead of you. Push it back toward 0.3 and the hull starts to look
        // crabbed again; that trade is the whole point of this line.
        var aimDist = this.CAM_LOOK_AHEAD * this.SEG_LEN * S;
        var axisX = wp.x + Math.sin(this._camYaw) * aimDist;
        var axisZ = wp.z + Math.cos(this._camYaw) * aimDist;
        var blend = this.CAM_LOOK_BLEND;
        this.camera.lookAt(
            axisX * (1 - blend) + lookAhead.x * blend,
            0.5,
            axisZ * (1 - blend) + lookAhead.z * blend
        );

        // Ride the shadow box with the boat, and SNAP IT TO THE SHADOW MAP'S
        // OWN TEXEL GRID. Without the snap the box slides by a fraction of a
        // texel every frame and every shadow edge crawls and shimmers as you
        // drive -- the classic moving-directional-light artefact, and worst on
        // exactly the thin trunks this river is full of. Quantising the box
        // centre to whole texels makes the shadow sit still in world space and
        // move in steps you cannot see.
        if (this.sunLight && this.sunLight.castShadow) {
            var sx = wp.x + Math.sin(this._camYaw) * this.SHADOW_LEAD;
            var sz = wp.z + Math.cos(this._camYaw) * this.SHADOW_LEAD;
            var texel = (this.SHADOW_EXTENT * 2) / this.sunLight.shadow.mapSize.x;
            sx = Math.round(sx / texel) * texel;
            sz = Math.round(sz / texel) * texel;
            this._sunTarget.position.set(sx, 0, sz);
            this._sunTarget.updateMatrixWorld();
            // 700 units back along the authored (200,400,300) sun bearing, so
            // the shadow camera's near/far stay tight around the box.
            this.sunLight.position.set(sx + 260, 520, sz + 390);
        }

        if (this.skyDome) {
            this.skyDome.position.set(this._camPos.x, 0, this._camPos.z);
        }

        // Keep the mountain backdrop sitting on the horizon straight ahead,
        // whichever way the river has bent round to.
        if (this._backdrop) {
            if (!this._camDir) this._camDir = new THREE.Vector3();
            this.camera.getWorldDirection(this._camDir);
            this._camDir.y = 0;
            if (this._camDir.lengthSq() > 0.0001) {
                this._camDir.normalize();
                var byaw = Math.atan2(this._camDir.x, this._camDir.z);
                for (var bi = 0; bi < this._backdrop.length; bi++) {
                    var B = this._backdrop[bi];
                    B.mesh.position.set(
                        this._camPos.x + this._camDir.x * B.dist,
                        B.y,
                        this._camPos.z + this._camDir.z * B.dist
                    );
                    B.mesh.rotation.y = byaw;
                }
            }
        }
        if (this._cloudPlanes) {
            // DRIFT THE OFFSET, NOT THE POSITION.
            //
            // This used to do `position.x += dt * 2` and then, four lines
            // later, `position.set(camPos.x + userData.ox, ...)` with ox
            // captured once on the first frame -- so the drift was computed
            // and thrown away on every single frame. The clouds sat pinned to
            // the camera for the whole run. Tyler spotted it by playing:
            // "the clouds did not move".
            //
            // The re-park itself is right and has to stay: the clouds are
            // OFFSETS from the boat, not world positions, or you drive past
            // them in the first half minute and the sky empties out.
            // AND ROTATE THE OFFSETS WITH THE HEADING, exactly like the
            // mountain backdrop above.
            //
            // Tyler: "the clouds on one line actually moved with the boat, it
            // was very difficult on the eyes." Both halves of that were real.
            // The offsets used to be applied along the WORLD axes while the
            // clouds were pinned to the camera position -- so they had no
            // parallax to earn their keep, AND every bend in the river swung
            // the whole cloud bank sideways across the sky while the world
            // turned the other way. That fight between the two is what makes
            // it hard to look at.
            //
            // The mountains have solved this since the backdrop fix: park
            // along the camera's own forward/right basis, so distant things
            // sit still ahead of you through a bend. Clouds now do the same,
            // and the drift below is the only motion left in them.
            var drift = (RR.Config.CLOUD_DRIFT !== undefined ? RR.Config.CLOUD_DRIFT : 9) * dt;
            var cyaw = (this._camDir && this._camDir.lengthSq() > 0.0001)
                ? Math.atan2(this._camDir.x, this._camDir.z) : 0;
            var ccos = Math.cos(cyaw), csin = Math.sin(cyaw);
            // THE CLOUDS COME TO YOU. Tyler, 2026-10-26: "top clouds don't
            // move they should move with the river." Pinned at a fixed offset
            // they stayed glued to the screen however fast you ran. Now the
            // forward offset shrinks by a share of the distance the camera
            // actually travelled, so the sky slides overhead as you drive --
            // slower than the banks (parallax), which is how distant cloud
            // looks from a fast boat. A cloud that passes overhead is sent
            // back to the far end of the sky, out of frame.
            var fwd = 0;
            if (this._cloudLastCam) {
                var mdx = this._camPos.x - this._cloudLastCam.x;
                var mdz = this._camPos.z - this._cloudLastCam.z;
                fwd = mdx * csin + mdz * ccos;
                if (!(fwd > -50 && fwd < 50)) fwd = 0;     // a rebuild or reset jump
            } else {
                this._cloudLastCam = new THREE.Vector3();
            }
            this._cloudLastCam.set(this._camPos.x, 0, this._camPos.z);
            var CLOUD_PARALLAX = RR.Config.CLOUD_PARALLAX !== undefined ? RR.Config.CLOUD_PARALLAX : 0.55;
            for (var ci = 0; ci < this._cloudPlanes.length; ci++) {
                var cp = this._cloudPlanes[ci];
                if (cp.userData.ox === undefined) {
                    cp.userData.ox = cp.position.x;
                    cp.userData.oy = cp.position.y;
                    cp.userData.oz = cp.position.z;
                }
                cp.userData.ox += drift;
                cp.userData.oz -= fwd * CLOUD_PARALLAX + drift * 0.6;
                if (cp.userData.oz < 250) {
                    cp.userData.oz += 2500;
                    cp.userData.ox = (Math.random() - 0.5) * 2000;
                }
                // Recycle a cloud that has drifted well clear of the frame.
                // +/-2800 is outside the view at every depth these sit at, so
                // nothing ever pops on screen. Nothing reaches it inside a
                // single run; this is for a long session.
                if (cp.userData.ox > 2800) cp.userData.ox -= 5600;
                else if (cp.userData.ox < -2800) cp.userData.ox += 5600;
                // right = (cos, -sin), forward = (sin, cos)
                cp.position.set(
                    this._camPos.x + cp.userData.ox * ccos + cp.userData.oz * csin,
                    cp.userData.oy,
                    this._camPos.z - cp.userData.ox * csin + cp.userData.oz * ccos
                );
                cp.lookAt(this.camera.position);
            }
        }

        this._updateWake(boat, time);
        this._updateVisibleObjects(boat);
        this._updateWildlife(boat, time);
        this._updateFinishBanner(time);
        this._updateCrocs(boat, time);
        // Keep the pyramids on the horizon ahead, the same way the mountain
        // backdrop is re-parked -- they are scenery, not something you pass.
        if (this._waterfallGroup && this._camPos) {
            // Held on the horizon ahead of the boat, the way the mountains and
            // pyramids are -- you never reach it, you just run toward it.
            //
            // ON THE RIVER'S AXIS, NOT THE WORLD'S. This offset used to be
            // added straight to the camera in world x/z, so as the course
            // curved the falls swung to an arbitrary compass bearing and could
            // end up abeam or astern. The river's downstream direction is
            // (sin h, cos h) and its lateral normal is (-cos h, sin h) -- the
            // same convention as the hull, the wake and the bear discs -- so
            // rotating the offset into that frame keeps the falls where the
            // channel is pointing. oz is now "this far down the channel" and
            // ox0 "this far to the side", which is what the two numbers always
            // read as. The group is yawed to match so the cliff faces upstream
            // at the boat instead of at world +Z.
            //
            // +PI, and it matters. The group is built facing local +Z -- the
            // water sheet sits at z = +0.92*width and the mist planes beyond
            // it, IN FRONT of the cliff -- so its good side is +Z and it has
            // to be seen from further downstream looking back. The falls are
            // parked ahead of the boat, so yawing it to the bare river heading
            // points its back at you: the semicircular cliff shell renders as
            // a thin grey column with the sheet hidden behind it, which is
            // exactly what the first version of this did. Turn it round.
            var wfh = (this._camYaw || 0) + Math.PI;
            var h = this._camYaw || 0;
            var ws = Math.sin(h), wc = Math.cos(h);
            var wax = this._waterfallGroup.userData.ox0;
            var waz = this._waterfallGroup.userData.oz;
            this._waterfallGroup.position.set(
                this._camPos.x + waz * ws - wax * wc,
                0,
                this._camPos.z + waz * wc + wax * ws);
            this._waterfallGroup.rotation.y = wfh;
        }
        if (this.pyramids && this._camPos) {
            this.pyramids.position.set(this._camPos.x, 0, this._camPos.z);
        }
    },

    // The finish banner waving. Displacement is along the plane's local Z,
    // which is its normal, and is multiplied by sin(pi*u) so both ends stay
    // pinned to the posts -- a banner is tied at the corners, it does not flap
    // free. Two frequencies beat against each other so it never looks like a
    // single clean sine.
    _updateFinishBanner: function (time) {
        var banner = this._finishBanner;
        if (!banner) return;
        var pos = banner.geometry.getAttribute('position');
        var base = this._finishBannerBase;
        var span = this._finishSpan || 1;
        var half = span / 2;
        var i, bx, by, u, tie, w;
        for (i = 0; i < pos.count; i++) {
            bx = base[i * 3];
            by = base[i * 3 + 1];
            u = (bx + half) / span;                       // 0..1 across the span
            tie = Math.sin(Math.PI * u);                  // 0 at both posts
            w = Math.sin(u * 9.0 + time * 3.1) * 1.55 +
                Math.sin(u * 17.0 - time * 2.3) * 0.55;
            pos.setZ(i, w * tie);
            // A little vertical sag and lift so it does not look like a
            // corrugated sheet sliding sideways.
            pos.setY(i, by + Math.sin(u * 6.0 + time * 2.4) * 0.42 * tie);
        }
        pos.needsUpdate = true;
        // MeshBasicMaterial ignores normals, so recomputing them every frame
        // would be pure cost.
    },

    _updateWake: function (boat, time) {
        if (!this.wakeGroup) return;
        var speedRatio = boat.speed / boat.getMaxSpeed();
        var model = boat.getModel ? boat.getModel() : { beamScale: 1 };

        this.wakeGroup.position.copy(this.boatGroup.position);
        // Wake follows actual travel, not just where the bow points.
        var wp = this.getWorldPos(boat.z, boat.lateral);
        // Same sign fix as the hull -- the wake has to lie along the same axis.
        this.wakeGroup.rotation.y = wp.heading - (boat.travelHeadingOffset || 0);
        var slip = Math.min(1, Math.abs((boat.headingOffset || 0) -
            (boat.travelHeadingOffset || 0)) / 0.42);

        var names = ['wakeL', 'wakeR'], i, arm;
        for (i = 0; i < names.length; i++) {
            arm = this.wakeGroup.getObjectByName(names[i]);
            if (!arm) continue;
            arm.material.opacity = Math.min(0.68, speedRatio * (0.76 + slip * 0.24));
            // Slower boat = a shorter, tighter wake.
            arm.scale.set((0.55 + speedRatio * 0.45 + slip * 0.16) * model.beamScale,
                1, 0.4 + speedRatio * 0.6);
        }

        var churn = this.wakeGroup.getObjectByName('churn');
        if (churn) {
            churn.material.opacity = Math.min(0.6, speedRatio * 0.85);
            churn.scale.set(0.7 + speedRatio * 0.4, 0.5 + speedRatio * 0.7, 1);
        }

        for (i = 0; i < 6; i++) {
            var spray = this.wakeGroup.getObjectByName('spray' + i);
            if (!spray) continue;
            spray.material.opacity = speedRatio > 0.28 ?
                Math.min(0.62, (speedRatio - 0.28) * 0.62 + slip * speedRatio * 0.22) : 0;
            spray.position.y = 0.4 + Math.sin(time * 6 + i * 1.5) * speedRatio * 0.9;
            spray.scale.setScalar(0.6 + speedRatio * 0.8);
            spray.lookAt(this.camera.position);
        }

        this.wakeGroup.visible = speedRatio > 0.03 && boat.jumpHeight < 25 && (boat.rampHeight || 0) < 2;
    },

    _updateVisibleObjects: function (boat) {
        var C = RR.Config;
        var baseIdx = Math.floor(boat.z / C.SEGMENT_LENGTH);
        var startSeg = Math.max(0, baseIdx - this.VISIBLE_SEGS_BEHIND);
        var endSeg = Math.min(RR.River.segments.length - 1, baseIdx + this.VISIBLE_SEGS_AHEAD);

        var obsIdx = 0;

        for (var i = 0; i < this.obstacleMeshPool.length; i++) {
            this.obstacleMeshPool[i].visible = false;
            this.obstacleMeshPool[i].userData.active = false;
        }

        var segmentOrder=[];
        for(var scan=startSeg;scan<=endSeg;scan++)segmentOrder.push(scan);
        segmentOrder.sort(function(a,b){return Math.abs(a-baseIdx)-Math.abs(b-baseIdx);});
        for (var order=0;order<segmentOrder.length;order++) {
            var si=segmentOrder[order];
            var seg = RR.River.segments[si];
            if (!seg) continue;

            for (var oi = 0; oi < seg.obstacles.length; oi++) {
                if (obsIdx >= this.obstacleMeshPool.length) break;
                var obs = seg.obstacles[oi];
                var wp = this.getWorldPos(si * C.SEGMENT_LENGTH, obs.x);
                var pool = this.obstacleMeshPool[obsIdx];

                pool.position.set(wp.x, 0.3, wp.z);
                pool.rotation.y=wp.heading;
                pool.visible = true;
                pool.userData.active = true;

                var rock = pool.getObjectByName('rock');
                var log = pool.getObjectByName('log');
                var tree = pool.getObjectByName('tree');
                var branches = pool.getObjectByName('branches');
                branches.visible = false;
                rock.visible = false;
                log.visible = false;
                tree.visible = false;

                var s = obs.size * 2;
                if (obs.type === 'rock') {
                    // Rocks used to draw at obs.size * 2 -- about a tenth of the
                    // boat's beam -- while collision.js treats them as roughly
                    // obs.size * 0.2 in lateral units, which works out five
                    // times larger. You were crashing into boulders you could
                    // barely see. ROCK_SCALE makes the mesh match the hit box,
                    // so what's drawn is what you hit, and you spot it early.
                    var rs = obs.size * C.ROCK_SCALE;
                    rock.visible = true;
                    rock.scale.set(rs, rs * 0.62, rs);
                } else if (obs.type === 'log' || obs.type === 'log_jump') {
                    // Logs are never fatal -- you jump them or bump over them --
                    // so they're drawn big enough to read as a real deadhead
                    // well before you reach one.
                    // The mesh is a cylinder lying along its local Y (it's
                    // rotated Z by 90 deg to lie across the river), so Y is
                    // LENGTH and X/Z are the radius. The old scale grew the
                    // radius and left the length alone, which is why logs came
                    // out as barrels. Long and thin is what a deadhead is.
                    var ls = obs.size * C.LOG_SCALE;
                    log.visible = true;
                    log.scale.set(ls * 0.9, ls * 1.35, ls * 0.9);
                } else if (obs.type === 'tree') {
                    // Snags standing in the river are the hazard players spot
                    // latest, and their hit box was already bigger than the
                    // mesh. Scaled up so what you can see matches what you hit,
                    // and stretched vertically so it breaks the waterline
                    // clearly from a long way off.
                    var tsz = obs.size * C.TREE_OBSTACLE_SCALE;
                    tree.visible = !obs.cluster;
                    branches.visible = !!obs.cluster;
                    tree.scale.set(tsz * 0.78, tsz * 1.30, tsz * 0.78);
                    branches.scale.set(tsz,tsz,tsz);
                    branches.rotation.y=si*1.37+oi;
                    pool.position.y = obs.cluster ? 0.15 : 1;
                }
                obsIdx++;
            }

            // (Islands are static meshes since 2026-10-26 -- _createIslandMeshes.)
        }

        // Trees cull by CHUNK now. Same 800-unit radius and the same
        // dz > -100 behind-the-camera test as the per-tree version, applied to
        // the chunk's bounding circle -- so a chunk shows if ANY of its trees
        // would have. That draws a few extra trees at a chunk boundary and
        // costs ~45 tests a frame instead of 25,000.
        for (var ti = 0; ti < this.treeChunks.length; ti++) {
            var ck = this.treeChunks[ti];
            var dxc = ck.cx - this.camera.position.x;
            var dzc = ck.cz - this.camera.position.z;
            var near = Math.sqrt(dxc * dxc + dzc * dzc) - ck.r;
            ck.group.visible = (near < 1000) && (ck.maxZ - this.camera.position.z > -100);
        }
    },

    _updateWildlife: function (boat, time) {
        if (!this.bearMeshPool || !this.salmonMeshPool) return;
        time = time || 0;
        var C = RR.Config;
        var baseIdx = Math.floor(boat.z / C.SEGMENT_LENGTH);
        var startSeg = Math.max(0, baseIdx - this.VISIBLE_SEGS_BEHIND);
        var endSeg = Math.min(RR.River.segments.length - 1, baseIdx + this.VISIBLE_SEGS_AHEAD);
        var i, data, mesh, wp, water, dz, threat;

        for (i = 0; i < this.bearMeshPool.length; i++) this.bearMeshPool[i].visible = false;
        for (i = 0; i < this.salmonMeshPool.length; i++) this.salmonMeshPool[i].visible = false;

        var bearIdx = 0;
        var bears = RR.River.bears || [];
        for (i = 0; i < bears.length && bearIdx < this.bearMeshPool.length; i++) {
            data = bears[i];
            if (data.segment < startSeg || data.segment > endSeg) continue;
            mesh = this.bearMeshPool[bearIdx++];
            dz = Math.abs(boat.z - data.segment * C.SEGMENT_LENGTH) / C.SEGMENT_LENGTH;
            threat = Math.max(0, 1 - dz / 5);
            if (boat.lateral * data.side < 0.35) threat *= 0.25;
            wp = this.getWorldPos(data.segment * C.SEGMENT_LENGTH, data.side * (1.055 - threat * 0.055));
            water = this.getWorldPos(data.segment * C.SEGMENT_LENGTH, data.side * 0.38);
            mesh.position.set(wp.x, 3.40, wp.z);
            // Scene units make a literal six-foot bear unreadable beside the
            // very broad river mesh. Two-times presentation scale preserves
            // its proportions while making the warning animal legible early.
            mesh.scale.setScalar(data.size * C.BEAR_SCALE * (1 + threat * 0.06));
            mesh.lookAt(water.x, 3.40, water.z);
            mesh.userData.torso.rotation.z = Math.sin(time * 3.2 + data.phase) * 0.06;
            mesh.userData.head.rotation.y = Math.sin(time * 4.1 + data.phase) * (0.12 + threat * 0.18);
            mesh.userData.head.rotation.x = -0.08 - threat * 0.22;
            var swipe = Math.sin(time * (4.8 + threat * 3) + data.phase);
            mesh.userData.armL.rotation.z = -0.72 - Math.max(0, swipe) * (0.35 + threat * 0.55);
            mesh.userData.armR.rotation.z = 0.72 + Math.max(0, -swipe) * (0.35 + threat * 0.55);
            mesh.visible = true;
        }

        // Mark every visible bear's reach on the water. The ellipse matches the
        // collision test exactly: beyond BEAR_DANGER_LATERAL on the bear's side
        // and within HULL_HALF_LENGTH + BEAR_REACH fore and aft.
        var zi, zone;
        for (zi = 0; zi < this.bearZonePool.length; zi++) this.bearZonePool[zi].visible = false;
        var zoneIdx = 0;
        var bmodel = boat.getModel ? boat.getModel() : { lengthScale: 1 };
        var reachZ = C.HULL_HALF_LENGTH * (bmodel.lengthScale || 1) + C.BEAR_REACH;
        for (i = 0; i < bears.length && zoneIdx < this.bearZonePool.length; i++) {
            data = bears[i];
            if (data.segment < startSeg || data.segment > endSeg) continue;
            zone = this.bearZonePool[zoneIdx++];
            var mid = (C.BEAR_DANGER_LATERAL + 1.0) * 0.5;
            var zwp = this.getWorldPos(data.segment * C.SEGMENT_LENGTH, data.side * mid);
            var halfLat = (1.0 - C.BEAR_DANGER_LATERAL) * 0.5 * zwp.halfW;
            zone.position.set(zwp.x, 0.35, zwp.z);
            zone.rotation.z = zwp.heading;
            zone.scale.set(halfLat, reachZ, 1);
            dz = Math.abs(boat.z - data.segment * C.SEGMENT_LENGTH) / C.SEGMENT_LENGTH;
            var near = Math.max(0, 1 - dz / C.BEAR_WARNING_SEGMENTS);
            var onSide = boat.lateral * data.side;
            var closing = Math.max(0, Math.min(1, (onSide - 0.25) / 0.47));
            // Always faintly visible so the line to avoid is readable early;
            // it flares and pulses hard once you actually commit to that bank.
            var pulse = 0.5 + 0.5 * Math.sin(time * (5 + closing * 6));
            zone.material.opacity = 0.10 + near * (0.14 + closing * 0.44 * pulse);
            zone.visible = near > 0.02;
        }

        var salmonIdx = 0;
        var salmon = RR.River.salmon || [];
        for (i = 0; i < salmon.length && salmonIdx < this.salmonMeshPool.length; i++) {
            data = salmon[i];
            if (data.segment < startSeg || data.segment > endSeg) continue;
            var cycle = (time + data.phase) % data.period;
            var jumpDuration = 1.35;
            if (cycle >= jumpDuration) continue;
            var p = cycle / jumpDuration;
            mesh = this.salmonMeshPool[salmonIdx++];
            wp = this.getWorldPos((data.segment + (p - 0.5) * 0.62) * C.SEGMENT_LENGTH, data.x);
            mesh.position.set(wp.x, 0.06, wp.z);
            // Fish hold generally upstream but quarter across the current, so
            // their full salmon profile reads instead of every jump being a
            // tail-on silhouette from the chase camera.
            mesh.rotation.y = wp.heading + (data.x < 0 ? -0.55 : 0.55);
            // As with the bank wildlife, a modest presentation scale keeps a
            // real salmon readable against a river hundreds of scene-units wide.
            mesh.scale.setScalar(data.size * 2.0);
            var fish = mesh.userData.fish;
            var height = Math.sin(Math.PI * p) * 5.2;
            fish.position.y = height;
            fish.rotation.x = (0.5 - p) * 1.20;
            fish.rotation.z = Math.sin(p * Math.PI * 2) * 0.16;
            var splash = Math.max(0, 1 - Math.min(p, 1 - p) / 0.18);
            var ripple = mesh.userData.ripple;
            ripple.material.opacity = splash * 0.62;
            ripple.scale.setScalar(0.8 + (1 - splash) * 2.2);
            mesh.visible = true;
        }
    },

    render: function () {
        if (!this.ready) return;
        this.renderer.render(this.scene, this.camera);
    },

    dispose: function () {
        if (this.renderer) {
            this.renderer.dispose();
        }
        this.ready = false;
    }
};
