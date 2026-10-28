window.RR = window.RR || {};

// Representative Wooldridge river boats, using the published dimensions and
// maximum jet-horsepower figures from wooldridgeboats.com. The physics values
// are deliberately normalized for this river: they translate real differences
// in power-to-weight, beam, length and the builder's handling descriptions into
// a fair game rather than pretending to be an engineering performance model.
// Two fields beyond the physics multipliers drive how a hull looks and how
// much abuse it takes:
//
//   layout      which deck rig the renderer shows: 'windshield' (default, the
//               18' Alaskan), 'console' (Rogue), 'lt', 'walkthrough' (XL),
//               'skagit', 'cabin' (Sportster). All rigs are built once and
//               one is shown -- see _applyBoatModel in renderer3d.
//   heightScale freeboard, relative to the Alaskan (LT 0.86).
//   motor       outboard cowl colour (default black).
//   hull/deck   optional hex overrides. Omit for the standard aluminium.
//   logo        'std' (default), 'rogue', or 'white' (dark/blue hulls). Picks which decal rig is shown.
//               Each rig carries correct per-side artwork already, so this is
//               a rig choice, not a texture swap. 'rogue' is that model's own
//               WIZARCO lockup, which is a different shape (5.8:1 vs 3.9:1)
//               and therefore needs its own quads.
//   hitPoints   obstacle strikes the hull survives. 1 = the old behaviour,
//               crash on first contact.
//   damageSpeed multiplier applied to top speed once the hull is at its LAST
//               life, i.e. after hitPoints-1 strikes.
RR.BoatCatalog = {
    selectedIndex: 2,
    models: [
        {
            id: 'alaskan-lt-16', model: "16' ALASKAN LT", variant: 'CENTER CONSOLE',
            spec: ['lt', '16', 'weightCenterConsole'],
            length: "16'8\"", beam: '80\"', bottom: '60\"', weight: 715, maxJetHp: 90,
            character: 'Light, efficient and exceptionally quick to place in tight water.',
            power: 2, size: 2, maneuver: 5,
            speedMult: 0.84, accelerationMult: 0.86, brakingMult: 1.14,
            steerMult: 1.20, steerResponseMult: 1.18, massMult: 0.68,
            beamScale: 0.91, lengthScale: 0.83, shallowDragMult: 0.76,
            groundTimeMult: 1.24, accent: 0x1B75BB,
            // Low open sled: charcoal topsides, small centre console, grey motor.
            layout: 'lt', logo: 'white', heightScale: 0.86, motor: 0x8D939A,
            // No LT 3D export exists (engineering has it only in Inventor),
            // so this is the REAL 17' Alaskan hull -- same family, 79" beam
            // against the LT's 80" -- from COMMON/ENGINEERING/Wooldridge
            // Boats/17 Alaskan/17 Alaskan Hull.3dm, run at the LT's length.
            // The 'lt' console rig stays on top of it.
            cad: { url: 'GAME/ASSETS/BOAT/MODELS/ALASKAN-LT-16.stl', keepRig: true,
                   paint: { side: 0x2F3236, bottom: 0xC9CCD1, deck: 0xA9AEB4,
                            cap: 0xE3E6EA, upper: 0x6A7078, interior: 0xC4C8CD,
                            band: 0.80, bandColor: 0xDCDFE3, chine: 0.10 } },
            sourceUrl: 'https://www.wooldridgeboats.com/models/alaskan-lt/'
        },
        {
            id: 'rogue-18', model: "18' ROGUE", variant: 'CENTER CONSOLE',
            spec: ['rogue', '18', 'weightCenterConsole'],
            length: "20' W/PODS", beam: '86\"', bottom: '66\"', weight: 1090, maxJetHp: 200,
            character: 'Blacked-out centre-console rocket. Fastest hull in the lineup, and HDPE armour shrugs off strikes that end other boats.',
            power: 5, size: 3, maneuver: 4,
            // THE FAST ONE, deliberately. Tyler's call, and the photos back it:
            // a Yamaha 250 SHO on a light open sled with no windshield to push.
            // It is the outlier on purpose -- do not "balance" it back toward
            // the others. Note this stacks with damageSpeed, so a twice-struck
            // Rogue still runs at 1.24 * 0.82 = 1.02, quick but no longer king.
            speedMult: 1.24, accelerationMult: 1.34, brakingMult: 1.06,
            steerMult: 1.10, steerResponseMult: 1.08, massMult: 0.87,
            beamScale: 0.98, lengthScale: 0.99, shallowDragMult: 0.86,
            groundTimeMult: 1.14, accent: 0x20262B,
            // Built from Tyler's three shop photos: satin black topsides, no
            // windshield at all, standing centre console set aft of amidships,
            // white decal. The HDPE armour is why this one takes three hits.
            // Black right through: topsides, tread-plate sole and the bow box.
            // Only the gunwale cap stays bright, which is the alloy rub rail
            // visible along the sheer in every one of the four photos.
            layout: 'console', logo: 'rogue',
            hull: 0x191B1D, deck: 0x232629, sole: 0x1E2124, cap: 0xC8CDD2,
            hitPoints: 3, damageSpeed: 0.82,
            sourceUrl: 'https://www.wooldridgeboats.com/models/rogue/'
        },
        {
            id: 'alaskan-18', model: "18' ALASKAN", variant: 'WINDSHIELD',
            spec: ['ak', '18', 'weightWindshield'],
            length: "20'1\" W/PODS", beam: '82\"', bottom: '66\"', weight: 1250, maxJetHp: 200,
            character: 'The balanced benchmark: fast, predictable and agile in shallow rivers.',
            power: 4, size: 3, maneuver: 5,
            speedMult: 1.00, accelerationMult: 1.00, brakingMult: 1.00,
            steerMult: 1.00, steerResponseMult: 1.00, massMult: 1.00,
            beamScale: 1.00, lengthScale: 1.00, shallowDragMult: 1.00,
            groundTimeMult: 1.00, accent: 0x1B75BB,
            sourceUrl: 'https://www.wooldridgeboats.com/models/alaskan/'
        },
        {
            id: 'alaskan-xl-20', model: "20' ALASKAN XL", variant: 'WINDSHIELD',
            spec: ['xl', '20', 'weightWindshield'],
            length: "20'9\" W/PODS", beam: '99\"', bottom: '80\"', weight: 1350, maxJetHp: 250,
            character: 'Broad, powerful load-hauler; stable at speed but needs room to rotate.',
            power: 5, size: 4, maneuver: 3,
            speedMult: 1.08, accelerationMult: 1.12, brakingMult: 0.92,
            steerMult: 0.88, steerResponseMult: 0.90, massMult: 1.08,
            beamScale: 1.13, lengthScale: 1.04, shallowDragMult: 1.05,
            groundTimeMult: 0.90, accent: 0x315F7A,
            // Royal-blue topsides, framed walk-through windshield, stern rails.
            layout: 'walkthrough', logo: 'white', motor: 0x8D939A, sole: 0x3A3E44,
            // The REAL hull, from Wooldridge engineering:
            // COMMON/ENGINEERING/Renders for New Web site/AK XL 20_Sportjet.stl.
            // Painted like the website XL (blue topsides, alloy bottom, dark
            // floor). The 'walkthrough' rig above shows until it loads.
            cad: { url: 'GAME/ASSETS/BOAT/MODELS/AK-XL-20.stl',
                   // Interior a shade lighter than the photos' charcoal so the
                   // boat still reads from the chase camera, which looks
                   // straight down into it.
                   paint: { side: 0x2148B8, bottom: 0xC9CCD1, deck: 0x4E545C,
                            cap: 0xE3E6EA, upper: 0x6A7078, interior: 0xB8BCC2 } },
            sourceUrl: 'https://www.wooldridgeboats.com/models/alaskanxl/'
        },
        {
            id: 'skagit-20', model: "20' SKAGIT", variant: 'WINDSHIELD',
            spec: ['skagit', '20', 'weightWindshield'],
            length: "20'10\" W/PODS", beam: '93\"', bottom: '72\"', weight: 1600, maxJetHp: 250,
            character: 'Heavy-duty jet tunnel power with a surprisingly crisp cornering bite.',
            power: 5, size: 4, maneuver: 4,
            speedMult: 1.05, accelerationMult: 0.97, brakingMult: 0.86,
            steerMult: 0.94, steerResponseMult: 0.86, massMult: 1.28,
            beamScale: 1.06, lengthScale: 1.04, shallowDragMult: 1.08,
            groundTimeMult: 0.85, accent: 0x174A68,
            // Black topsides under a bright alloy sheer band, windshield with
            // a stainless tube arch over it, stern rails.
            layout: 'skagit', logo: 'white', motor: 0x8D939A,
            // No Skagit 3D export exists either. The 20' Alaskan XL CAD boat
            // is the same size class with the same walk-through windshield,
            // so it carries the Skagit's black-and-alloy paint here, plus the
            // Skagit rig's stainless tube arch and stern rails ('arch').
            cad: { url: 'GAME/ASSETS/BOAT/MODELS/AK-XL-20.stl', keepRig: 'arch',
                   paint: { side: 0x16171B, bottom: 0xC9CCD1, deck: 0x8E949B,
                            cap: 0xE3E6EA, upper: 0xB8BCC2, interior: 0xC4C8CD,
                            band: 0.62, bandColor: 0xE3E6EA, bandMode: 'face' } },
            sourceUrl: 'https://www.wooldridgeboats.com/models/skagit/'
        },
        {
            id: 'sportster-21', model: "21' SPORTSTER", variant: 'WINDSHIELD',
            spec: ['sportster', '21', 'weightWindshield'],
            length: "21'8\"", beam: '106\"', bottom: '88\"', weight: 1905, maxJetHp: 250,
            character: 'Big, planted and powerful—with real momentum and the widest footprint.',
            power: 5, size: 5, maneuver: 2,
            speedMult: 1.03, accelerationMult: 0.86, brakingMult: 0.78,
            steerMult: 0.75, steerResponseMult: 0.72, massMult: 1.52,
            beamScale: 1.20, lengthScale: 1.08, shallowDragMult: 1.18,
            groundTimeMult: 0.78, accent: 0x4D5359,
            // Black/alloy two-tone hull, tall almond enclosed cabin, dark roof.
            layout: 'walkthrough', logo: 'white', heightScale: 1.06,
            // The REAL 21'6" hull from Wooldridge engineering
            // (COMMON/ENGINEERING/Wooldridge Boats/21' Sportster/21-6 Sporster Hull.3dm,
            // converted to STL with a transom and an inside face). It is a
            // bare hull, so the 'cabin' rig stays on top of it (keepRig).
            // rigFit: the walkthrough consoles are built for the 1.20-beam
            // stretched hull; the CAD hull isn't stretched, so squeeze them in.
            cad: { url: 'GAME/ASSETS/BOAT/MODELS/SPORTSTER-21.stl', keepRig: true,
                   rigFit: { x: 0.80, z: -0.65 },
                   paint: { side: 0x141518, bottom: 0xC9CCD1, deck: 0x9AA0A6,
                            cap: 0xE3E6EA, upper: 0x34373C, interior: 0xC4C8CD,
                            band: 0.72, bandColor: 0xDCDFE3, chine: 0.12 } },
            sourceUrl: 'https://www.wooldridgeboats.com/models/sportster/'
        },
        {
            id: 'sportster-tiller-21', model: "21' SPORTSTER TILLER", variant: 'GRANT AT THE TILLER',
            spec: ['sportster','21','weightOpen'],
            length: "21 ft. 8 in.", beam:'106 in.',bottom:'88 in.',weight:1805,maxJetHp:250,
            character:'Open black-and-silver Sportster, with Grant driving from the stern.',
            power:5,size:5,maneuver:3,speedMult:1.05,accelerationMult:0.94,brakingMult:0.86,
            steerMult:0.84,steerResponseMult:0.82,massMult:1.42,beamScale:1.20,lengthScale:1.08,
            shallowDragMult:1.15,groundTimeMult:0.82,accent:0x83c43a,layout:'tiller',logo:'white',heightScale:1.06,
            cad:{url:'GAME/ASSETS/BOAT/MODELS/SPORTSTER-21.stl',keepRig:true,
                 paint:{side:0x17191d,bottom:0xC9CCD1,deck:0x9AA0A6,cap:0xE3E6EA,upper:0x34373C,interior:0xC4C8CD,band:0.72,bandColor:0xDCDFE3,chine:0.12}},
            sourceUrl:'https://www.wooldridgeboats.com/models/sportster/'
        }
    ],

    // Defaults for models that don't override them.
    defaults: { layout: 'windshield', logo: 'blue', hitPoints: 1, damageSpeed: 1 },

    trait: function (model, key) {
        var v = model ? model[key] : undefined;
        return v === undefined ? this.defaults[key] : v;
    },

    // SPECS COME FROM THE WEBSITE (Tyler, 2026-10-26: "very important that
    // the specs for each boat ... pull specs directly from the website").
    // The site publishes every model's figures in /tools/SPEC_DATA.js
    // (generated from the CANON workbook; the compare page reads it too).
    // That file is loaded here and the CHOOSE BOAT screen shows its numbers,
    // in its wording. `spec` on each model is [model key, length, which
    // weight row]. The length/beam/weight literals above are only the
    // fallback for when no copy of the site can be reached.
    //
    // Same site first (the copy at /river-ripper/); from the Mac app it
    // reaches out to the live site -- www first, so it keeps working after
    // the dev -> www cutover, then dev.
    webSpecs: null,
    specSource: '',
    loadWebsiteSpecs: function () {
        var self = this, urls = [];
        var h = (window.location && window.location.hostname) || '';
        var local = !h || h === 'localhost' || h === '127.0.0.1';
        if (!local) urls.push('/tools/SPEC_DATA.js');
        urls.push('https://www.wooldridgeboats.com/tools/SPEC_DATA.js');
        urls.push('https://dev.wooldridgeboats.com/tools/SPEC_DATA.js');
        function next(i) {
            if (i >= urls.length) return;
            var s = document.createElement('script');
            s.src = urls[i] + '?d=' + new Date().toISOString().slice(0, 10);
            s.onload = function () {
                var got = null;
                try { got = (typeof WB_SPECS !== 'undefined') ? WB_SPECS : null; } catch (e) {}
                if (got && got.ak) { self.webSpecs = got; self.specSource = urls[i]; }
                else next(i + 1);
            };
            s.onerror = function () { next(i + 1); };
            document.head.appendChild(s);
        }
        next(0);
    },

    // The five spec rows for the CHOOSE BOAT screen: the website's figures
    // when they're loaded, the built-in ones otherwise. A figure the website
    // doesn't publish for that boat is replaced by one it does (the Rogue
    // lists no weight, so its fourth row is side height) -- never invented.
    specRows: function (model) {
        var w = this.webSpecs, sp = model.spec, row = null;
        if (w && sp && w[sp[0]] && w[sp[0]][sp[1]]) row = w[sp[0]][sp[1]];
        if (!row) {
            return [['LENGTH', model.length], ['BEAM', model.beam], ['BOTTOM', model.bottom],
                    ['DRY WEIGHT', model.weight.toLocaleString() + ' LB'], ['MAX JET HP', String(model.maxJetHp)]];
        }
        function up(v) { return String(v || '').toUpperCase().replace(/\s*\(.*?\)\s*/g, ' ').trim(); }
        var weight = row[sp[2]] || row.weightWindshield || row.weightOpen || row.weightCenterConsole || row.weight;
        return [
            ['LENGTH', up(row.lengthOverall) || model.length],
            ['BEAM', up(row.beam) || model.beam],
            ['BOTTOM', up(row.bottomWidth) || model.bottom],
            weight ? ['DRY WEIGHT', up(weight)] : ['SIDE HEIGHT', up(row.sideHeight)],
            ['MAX JET HP', up(row.maxJetHP) || String(model.maxJetHp)]
        ];
    },

    getSelected: function () {
        return this.models[this.selectedIndex] || this.models[2];
    },

    select: function (index) {
        this.selectedIndex = (index + this.models.length) % this.models.length;
        try { localStorage.setItem('rr_selected_boat', String(this.selectedIndex)); } catch (e) {}
        return this.getSelected();
    },

    load: function () {
        try {
            var saved = parseInt(localStorage.getItem('rr_selected_boat'), 10);
            if (isFinite(saved) && saved >= 0 && saved < this.models.length) this.selectedIndex = saved;
        } catch (e) {}
    }
};

RR.BoatCatalog.load();
RR.BoatCatalog.loadWebsiteSpecs();
