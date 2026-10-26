window.RR = window.RR || {};

// Level 1 is HOME WATER -- the Skykomish/Snoqualmie confluence this whole game
// was built on. Every other stop is a World River Tour gameplay portrait, not a
// survey-grade replica: a recognizable channel character, current, hazard mix
// and regional palette laid over the same traced geometry.
//
// courseOffset phase-shifts into the 708 traced stations in GAME/DATA/
// RIVER-COURSE.js, spaced 708/8 = 88 apart. THE SKYQUALMIE MUST KEEP
// courseOffset 0 -- that is the actual start of the trace, so level 1 runs the
// real confluence in the real order it was surveyed. Everything else can move.
RR.RiverLevels = {
    selectedIndex: 0,
    profiles: [
        {
            id: 'skyqualmie', name: 'SKYQUALMIE RIVER', location: 'SKYKOMISH & SNOQUALMIE CONFLUENCE, WA',
            tagline: 'HOME WATER · LOG JAMS · GRAVEL BARS · CLEAR GREEN RUNS',
            // Unmodified trace: this is the reference the others are tuned
            // against, so every multiplier is 1.00 by design. Do not "balance"
            // them -- if level 1 needs to be easier, that is what EASY is for.
            widthMult: 1.00, curveMult: 1.00, currentMult: 1.00,
            // Timber, not boulders, and a lot of it. Every photo in
            // REFERENCES/RIVER/ is this river, and they are full of downed
            // cottonwood, root wads and whole log jams lying across the
            // channel. treeMult is high so the banks read as the solid wall of
            // alder they actually are, not a scattering.
            hazardMult: 1.15, treeMult: 1.45, courseOffset: 0,
            waveAmp: 0.008, waveFreq: 0.045, finishNarrow: 0.34,
            obstacleWeights: { rock: 0.20, snag: 0.46 },
            // What actually makes this read as the Skykomish rather than as
            // "a river": big log jams piled in the wide water, and braided
            // channels where an island splits the flow unevenly. Both are the
            // first thing you see in every photo in REFERENCES/RIVER/.
            // Other profiles leave these at 0 and are unaffected.
            logJamChance: 0.32, braidChance: 0.55,
            // A Skykomish salmon run, so the fish are thick on the ground.
            // SNOQUALMIE FALLS on the horizon: 268 ft over a semicircular
            // andesite cliff, the remains of a 20-million-year-old volcano, and
            // the single most recognisable thing in this watershed.
            // en.wikipedia.org/wiki/Snoqualmie_Falls
            waterfall: { height: 235, width: 130, x: -820, z: 2500, rock: 0x5E5A54 },
            // Bald eagles on bleached snags over the water -- the bird you
            // actually see on a Skykomish drift, and they follow the salmon.
            fauna: { kind: 'eagle', count: 16 },
            // Salmon river, and the thickest run in the game -- this is a
            // Skykomish/Snoqualmie confluence.
            bearSpacing: 88, salmonSpacing: 20,
            // SAME GRAPHICS LANGUAGE AS EVERY OTHER STOP -- same saturation,
            // same bright sky, same vibrancy. An earlier pass rendered this in
            // measured overcast greys and it read as a different game, so that
            // was pulled back. Tyler's call: don't make level 1 look different,
            // make it look like THIS RIVER.
            //
            // Identity comes from three things, not from a colour grade:
            //   pale gravel bars    the Skykomish signature, bank is the
            //                       lightest of any profile
            //   bleached driftwood  wood is pale grey, not the brown other
            //                       stops use -- it is sun-bleached deadfall
            //   clear green water   greener and clearer than the Rogue's teal
            // MEASURED OFF THE REFERENCE PHOTOS, 2026-09-02.
            //
            // Tyler: "make this look a lot like the photos -- I want a player to
            // recognise the river if they have driven a boat there." So these
            // are no longer picked by eye. Fourteen photos from
            // ARCHIVES/REFERENCES/RIVER/ were sampled and the pixels bucketed
            // into sky / foliage / dark timber / gravel / water:
            //
            //   sky          BLUE WITH CLOUD, not overcast. The first pass at
            //                this bucketed anything bright and near-neutral as
            //                "sky", which measured the CLOUDS and threw the blue
            //                away -- Tyler spotted it. Re-measured with the two
            //                separated: 35% blue sky, 64% cloud.
            //                  blue    #B7C6D9
            //                  zenith  #ABCCF4  (deepest blue found)
            //                  cloud   #E1E2E4
            //   foliage      #7B8348   olive, not the vivid green used before
            //   dark timber  #333C26
            //   gravel       #8D8C88   NEUTRAL grey, not the tan used before
            //   channel      #434439   dark olive-grey
            //   shallow      #858371
            //
            // The values below sit 62% of the way from the old palette to those
            // measurements (55% for the sky, and the zenith keeps more of its
            // blue). That temper is deliberate: an earlier pass went all the way
            // to flat measured greys and, per the note above, "read as a
            // different game". This keeps the game's own light while putting the
            // river's real colour underneath it.
            //
            // The three identity notes above still hold and are now measured
            // rather than asserted: the bank IS the palest of any profile, the
            // driftwood IS pale grey, and the water IS greener and duller than
            // the Rogue's teal.
            colors: {
                deep: 0x344439, mid: 0x4C5F51, shallow: 0x728471,
                reflect: 0x92A495, skyWater: 0xACBEBE,
                fog: 0xCFDCE6, skyTop: 0x6FA6E0, skyMid: 0xA8C8E6, skyBottom: 0xD2DEE8,
                bank: 0xA6A298, ground: 0x79884A, rock: 0x72726E,
                // WOOD: BROWN, NOT GREY. Tyler's call 2026-09-03, looking at
                // the seg-364 log jam on the screen: "they look Grey to me...
                // make the floating logs and trees in the river brown instead
                // of grey", with a brown palette to pick from (#895129,
                // #E08543, #663C1F, #3D2412).
                //
                // This DELIBERATELY overrides the measured "bleached
                // driftwood, pale grey not brown" identity note above. That
                // note came from sampling the reference photos and it is not
                // wrong about the photos -- but a flat pale grey cylinder on
                // water reads as concrete pipe, not as timber, and the game
                // has to read at a glance from 45 units astern. Do not "fix"
                // this back to the measured grey.
                //
                // 0x895129 is the lead swatch and the one that measured best:
                // the two floating logs in that jam render #82552f and
                // #6c4321, saturation 0.64 and 0.69, against 0.083 and 0.077
                // for the grey. #E08543 renders lighter (#c38f51/#b47e41) if
                // sunnier is wanted, #663C1F darker and wetter -- one line.
                //
                // This key also colours the bank tree trunks and, as of the
                // same change, the eagle perch snags in the water.
                wood: 0x895129,
                foliage: [0x6E8342,0x738B45,0x7A8F4A,0x80984F,0x687D3F,0x869D54,0x708643,0x354829]
            }
        },
        {
            id: 'rogue', name: 'ROGUE RIVER', location: 'OREGON, USA',
            tagline: 'FOREST CANYONS · GRAVEL BARS · TECHNICAL JET WATER',
            widthMult: 1.00, curveMult: 0.94, currentMult: 0.92,
            hazardMult: 0.90, treeMult: 1.00, courseOffset: 88,
            waveAmp: 0.010, waveFreq: 0.055, finishNarrow: 0.34,
            obstacleWeights: { rock: 0.38, snag: 0.28 },
            // HELLGATE CANYON: a 200 ft basalt gorge, the deepest on the
            // Rogue, grey rock walls over clear blue-green water. The jet-boat
            // river -- Hellgate Jetboat Excursions run this stretch daily.
            // blm.gov/programs/national-conservation-lands/oregon-washington/rogue-wsr
            canyon: true,
            canyonRock: 0x6E6A63,
            // Hellgate is grey basalt, not Grand Canyon red.
            canyonStrata: [0x8C8880, 0x7E7A72, 0x6E6A63, 0x5E5B55, 0x514E49, 0x45423E],
            // "eagles, ospreys, and even black bears" on the Rogue.
            fauna: { kind: 'eagle', count: 14 },
            // Wild salmon and steelhead water; Tyler asked for salmon on the
            // north-west rivers and this is one of them.
            bearSpacing: 92, salmonSpacing: 23,
            colors: {
                deep: 0x1E4540, mid: 0x2A5E52, shallow: 0x4A7868,
                reflect: 0x6A9A88, skyWater: 0xA0C0B0,
                fog: 0x9ABBA8, skyTop: 0x4A8AC4, skyMid: 0x7EB4D8, skyBottom: 0xD0DCE8,
                bank: 0xC7B495, ground: 0x83935C, rock: 0x5A5A58, wood: 0x6A5A40,
                foliage: [0x6E8C48,0x7E9A50,0x8CA855,0x99B45F,0xA8C06B,0x86A24F,0x93AE5C,0x7A9449]
            }
        },
        {
            id: 'colorado', name: 'COLORADO RIVER', location: 'GRAND CANYON, USA',
            tagline: 'RED CANYON WALLS · BOULDER RAPIDS · COLD GREEN WATER',
            widthMult: 0.90, curveMult: 1.04, currentMult: 1.18,
            hazardMult: 1.16, treeMult: 0.34, courseOffset: 177,
            waveAmp: 0.015, waveFreq: 0.070, finishNarrow: 0.38,
            obstacleWeights: { rock: 0.64, snag: 0.08 },
            // Salmon at Tyler's request. Worth knowing for later: the Colorado
            // in the Grand Canyon does not actually hold salmon -- it is trout
            // and native humpback chub water -- so this is the one wildlife
            // choice in the game that is a call rather than a fact.
            // Desert bighorn on the ledges -- the animal you see from a raft in
            // the Grand Canyon.
            fauna: { kind: 'bighorn', count: 12 },
            bearSpacing: 180, salmonSpacing: 26,
            // Towering layered walls on both banks. See _createCanyonWalls.
            canyon: true,
            // MEASURED off REFERENCES/RIVER/COLORADO-RIVER-1..4.png: lit rock
            // #CC9382/#C48D65, shaded #6F3D33/#634346, silty water #5F5D6E,
            // bright desert sky #3971CA/#74A2D2.
            colors: {
                deep: 0x3A404E, mid: 0x555A66, shallow: 0x8A8478,
                reflect: 0xA39A88, skyWater: 0xC6C0B0,
                fog: 0xC49A78, skyTop: 0x3971CA, skyMid: 0x74A2D2, skyBottom: 0xDCC6AC,
                bank: 0xBC8D72, ground: 0x8E6248, rock: 0x7A4C3C, wood: 0x69513B,
                foliage: [0x4A5A34,0x556438,0x3E4E2C,0x60703E,0x334028,0x6A7A46]
            }
        },
        {
            id: 'amazon', name: 'AMAZON RIVER', location: 'BRAZIL',
            tagline: 'IMMENSE CHANNEL · MUDDY WATER · ISLANDS AND DRIFTWOOD',
            widthMult: 1.48, curveMult: 0.68, currentMult: 0.78,
            hazardMult: 0.92, treeMult: 1.42, courseOffset: 265,
            waveAmp: 0.008, waveFreq: 0.038, finishNarrow: 0.22,
            obstacleWeights: { rock: 0.12, snag: 0.20 },
            // Double-deck RIVERBOATS tied along the bank. OFF since
            // 2026-10-26: built from three stacked boxes they read as "weird
            // white and blue blocky things on the shore" (Tyler). Bring back
            // only with a real modelled riverboat.
            riverboats: false,
            // Pink river dolphins surfacing in the margins, and capybara on the
            // bank. inWater lets some of them sit in the water rather than on
            // the bank -- still outside the navigable channel.
            fauna: { kind: 'dolphin', count: 18, inWater: true },
            bearSpacing: 210, salmonSpacing: 22,
            colors: {
                deep: 0x4C3E25, mid: 0x6C5731, shallow: 0x9B814D,
                reflect: 0x8C9165, skyWater: 0xC2C9A4,
                fog: 0xA8B99A, skyTop: 0x4389B1, skyMid: 0x83BFC7, skyBottom: 0xD4DEC3,
                bank: 0x8B6841, ground: 0x3F733B, rock: 0x675D4D, wood: 0x493A25,
                foliage: [0x2E7138,0x3F8741,0x4A9647,0x5AA34C,0x347D3E,0x6EAB58,0x26703B,0x559646]
            }
        },
        {
            id: 'zambezi', name: 'ZAMBEZI RIVER', location: 'ZAMBIA & ZIMBABWE',
            tagline: 'POWERFUL CURRENT · BASALT RAPIDS · WIDE AFRICAN SKY',
            widthMult: 1.05, curveMult: 1.02, currentMult: 1.38,
            hazardMult: 1.34, treeMult: 0.72, courseOffset: 354,
            waveAmp: 0.018, waveFreq: 0.080, finishNarrow: 0.40,
            obstacleWeights: { rock: 0.58, snag: 0.14 },
            // VICTORIA FALLS on the horizon, and the BATOKA GORGE it drops
            // into: 100 km of basalt the river has cut up to 350 m below the
            // surrounding plains, with class IV-VI water. Hippos and crocodiles
            // in large numbers along the margins.
            // africageographic.com/stories/victoria-falls-the-smoke-that-thunders
            // siyabona.com/place/Batoka-Gorge.html
            waterfall: { height: 300, width: 240, x: 640, z: 2650, rock: 0x4A443E },
            canyon: true,
            canyonRock: 0x4E4840,
            hippos: 16,
            // "elephants crossing the river, hippos wallowing in shallow bays".
            fauna: { kind: 'elephant', count: 10 },
            canyonStrata: [0x5E574E, 0x534C45, 0x47413B, 0x3C3733, 0x33302C, 0x2B2926],
            bearSpacing: 220, salmonSpacing: 35,
            colors: {
                deep: 0x164A50, mid: 0x256A6A, shallow: 0x5A9182,
                reflect: 0x78A99A, skyWater: 0xB9D2C4,
                fog: 0xB5B69A, skyTop: 0x357FC0, skyMid: 0x78B6D1, skyBottom: 0xE2D1A8,
                bank: 0xA27C52, ground: 0x77814A, rock: 0x464849, wood: 0x60452F,
                foliage: [0x647A3E,0x788D46,0x8D9E51,0x556F38,0x92A25C,0x718746]
            }
        },
        {
            id: 'mekong', name: 'MEKONG RIVER', location: 'LAOS & CAMBODIA',
            tagline: 'BRAIDED CHANNELS · SILT SHOALS · TROPICAL BANKS',
            widthMult: 1.27, curveMult: 0.88, currentMult: 0.96,
            hazardMult: 1.12, treeMult: 1.28, courseOffset: 442,
            waveAmp: 0.012, waveFreq: 0.048, finishNarrow: 0.28,
            obstacleWeights: { rock: 0.24, snag: 0.30 },
            // LIMESTONE KARST towers straight out of the water, forested on
            // top -- Nong Khiaw and the Nam Ou -- and STILT VILLAGES along the
            // bank, the floating-market culture of the lower river.
            // tweetworldtravel.com/more-information/nong-khiaw-travel-guide
            karst: true,
            stiltVillages: true,
            // Water buffalo in the shallows and on the bank -- the Mekong's
            // working animal.
            fauna: { kind: 'buffalo', count: 14, inWater: true },
            bearSpacing: 240, salmonSpacing: 25,
            colors: {
                deep: 0x3C4931, mid: 0x596744, shallow: 0x899064,
                reflect: 0x819A78, skyWater: 0xB9C8B0,
                fog: 0xAAB7A1, skyTop: 0x4B88B0, skyMid: 0x83B4C3, skyBottom: 0xD6D8BC,
                bank: 0x98794E, ground: 0x537B43, rock: 0x686457, wood: 0x574229,
                foliage: [0x3D7E40,0x4B9047,0x5A9A4D,0x689F54,0x39733B,0x78A75C,0x4D8641]
            }
        },
        {
            id: 'rhine', name: 'RHINE GORGE', location: 'GERMANY',
            tagline: 'TIGHT GORGE BENDS · FAST CURRENT · STONE-LINED BANKS',
            widthMult: 0.92, curveMult: 1.12, currentMult: 1.22,
            hazardMult: 1.10, treeMult: 0.66, courseOffset: 531,
            waveAmp: 0.014, waveFreq: 0.062, finishNarrow: 0.36,
            obstacleWeights: { rock: 0.46, snag: 0.15 },
            // Over 40 medieval CASTLES in 65 km -- the highest concentration
            // anywhere on earth -- on slate clifftops above terraced Riesling
            // VINEYARDS. The valley sides rise 400 m above the water.
            // UNESCO Upper Middle Rhine Valley.
            castles: true,
            canyon: true,
            canyonRock: 0x55555E,
            // Slate, the rock the whole gorge and its vineyard terraces are cut
            // from.
            canyonStrata: [0x6E6E78, 0x62626C, 0x565660, 0x4A4A54, 0x404049, 0x36363E],
            // Swans on the water, which is what you actually see on the Rhine.
            fauna: { kind: 'swan', count: 16, inWater: true },
            bearSpacing: 230, salmonSpacing: 32,
            colors: {
                deep: 0x203F4A, mid: 0x315C67, shallow: 0x6D8E91,
                reflect: 0x829EA2, skyWater: 0xB8C6CA,
                fog: 0xAAB6B4, skyTop: 0x567EA5, skyMid: 0x8EADC0, skyBottom: 0xD8D8CE,
                bank: 0x817969, ground: 0x66774F, rock: 0x585A58, wood: 0x5B4934,
                foliage: [0x5D783E,0x6D8747,0x7A9250,0x879D5A,0x526F39,0x738949]
            }
        }
,
        {
            id: 'nile', name: 'THE NILE', location: 'EGYPT',
            tagline: 'PYRAMIDS ON THE HORIZON · CROCODILES · SLOW BROWN WATER',
            widthMult: 1.32, curveMult: 0.72, currentMult: 0.84,
            hazardMult: 0.86, treeMult: 0.30, courseOffset: 619,
            waveAmp: 0.009, waveFreq: 0.042, finishNarrow: 0.24,
            // Dark granite boulders at the waterline, barely any timber. That
            // is what REFERENCES/RIVER/Nile River-3.png shows.
            obstacleWeights: { rock: 0.62, snag: 0.08 },
            bearSpacing: 999999, salmonSpacing: 46,
            // What makes it Egypt rather than "a wide river".
            pyramids: true,
            // 26, not 10. Tyler had never seen one on this level: ten spread
            // over the whole river is one every ~170 segments, which at speed is
            // one every six seconds, and at the old 1.25x draw scale they were
            // too small to register even then. See the scale note in
            // renderer3d._updateCrocs.
            crocodiles: 26,
            palms: true,
            // MEASURED off Tyler's three Nile photos, same method as the
            // Skyqualmie. THE NILE IS BLUE, not green -- water sampled
            // #2F4966 and #284771, sand #C5977F/#C6A67D, granite #3B3934,
            // clear sky #2B8BC0/#5F93CD. A first pass had it green like the
            // other rivers and it read as the wrong continent entirely.
            colors: {
                deep: 0x16375C, mid: 0x255C86, shallow: 0x5E90B4,
                reflect: 0x86B4CE, skyWater: 0xC2D8E6,
                fog: 0xDCC49A, skyTop: 0x2E86C4, skyMid: 0x74AEDA, skyBottom: 0xE4D3AC,
                bank: 0xC9A57C, ground: 0xC29C72, rock: 0x3E3A33, wood: 0x8A7248,
                foliage: [0x3E6B34,0x4C7A3C,0x5A8944,0x33582C,0x669450,0x2E4E28]
            }
        }
    ],

    get: function (level) {
        var n = Math.max(0, (level || 1) - 1);
        return this.profiles[n % this.profiles.length];
    },

    getSelected: function () {
        return this.profiles[this.selectedIndex] || this.profiles[0];
    },

    select: function (index) {
        this.selectedIndex = (index + this.profiles.length) % this.profiles.length;
        try { localStorage.setItem('rr_river', String(this.selectedIndex)); } catch (e) {}
        return this.getSelected();
    },

    load: function () {
        try {
            var saved = parseInt(localStorage.getItem('rr_river'), 10);
            if (isFinite(saved) && saved >= 0 && saved < this.profiles.length) this.selectedIndex = saved;
        } catch (e) {}
    },

    tour: function (level) {
        return Math.floor(Math.max(0, (level || 1) - 1) / this.profiles.length) + 1;
    }
};

RR.RiverLevels.load();
