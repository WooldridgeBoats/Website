window.RR = window.RR || {};

RR.Scoring = {
    score: 0,
    lastSegment: 0,
    speedMultiplier: 1.0,
    speedMultTimer: 0,
    highScore: 0,
    bestDistance: 0,

    reset: function () {
        this.salmonCaught = 0;
        this.salmonFlash = 0;
        this.shortcutFlash = 0;
        this.score = 0;
        this.lastSegment = 0;
        this.speedMultiplier = 1.0;
        this.speedMultTimer = 0;
        this.claimedBraids = {};
        this.lastBraidId = -1;
        this.lastBraidSide = 0;
        this.channelBonuses = 0;
        this.loadHighScore();
    },

    update: function (dt, boat) {
        var C = RR.Config;
        var currentSeg = Math.floor(boat.z / C.SEGMENT_LENGTH);

        if (currentSeg > this.lastSegment) {
            var gained = currentSeg - this.lastSegment;
            this.score += gained * C.DISTANCE_POINTS * this.speedMultiplier;
            this.lastSegment = currentSeg;
        }

        // Reward the driver for running each hull near its own limit; the LT
        // should not lose its multiplier merely because its real-world power
        // ceiling is lower than the Alaskan XL's.
        this.noteChannel(boat);

        var speedRatio = boat.speed / (boat.getMaxSpeed ? boat.getMaxSpeed() : C.MAX_SPEED);
        if (speedRatio >= C.SPEED_MULT_THRESHOLD) {
            this.speedMultTimer += dt;
            if (this.speedMultTimer > 2) {
                this.speedMultiplier = Math.min(3.0, 1.0 + (this.speedMultTimer - 2) * 0.2);
            }
        } else {
            this.speedMultTimer = 0;
            this.speedMultiplier = Math.max(1.0, this.speedMultiplier - dt);
        }
    },

    // CHANNEL_BONUS, finally doing something. Taking the NARROW side of a
    // braid is the risky line, so it pays. Awarded once per braid, on exit,
    // and only if the boat was actually committed to that side.
    noteChannel: function (boat) {
        var seg = RR.River.getSegmentAtZ(boat.z);
        var isl = seg && seg.island;
        if (isl && isl.braidId !== undefined) {
            this.lastBraidId = isl.braidId;
            this.lastBraidSide = (boat.lateral < isl.position) ? -1 : 1;
            this.lastBraidNarrow = isl.narrowSide;
            return;
        }
        // Just left a braid.
        if (this.lastBraidId >= 0) {
            if (this.lastBraidSide === this.lastBraidNarrow &&
                    !this.claimedBraids[this.lastBraidId]) {
                this.claimedBraids[this.lastBraidId] = true;
                this.channelBonuses++;
                this.score += RR.Config.CHANNEL_BONUS * this.speedMultiplier;
            }
            this.lastBraidId = -1;
        }
    },

    addJumpBonus: function () {
        this.score += RR.Config.JUMP_POINTS * this.speedMultiplier;
    },

    addNearMiss: function () {
        this.score += RR.Config.NEAR_MISS_POINTS;
    },

    // A salmon that lands in the boat. Flat rate, not multiplied -- it is luck,
    // not driving, and multiplying it would dwarf everything else on the run.
    addSalmonBonus: function () {
        this.score += RR.Config.SALMON_POINTS;
        this.salmonCaught = (this.salmonCaught || 0) + 1;
        this.salmonFlash = 2.6;              // seconds of on-screen celebration
    },

    addShortcutBonus: function () {
        this.score += RR.Config.SHORTCUT_BONUS;
        this.shortcutFlash = 3.0;
    },

    addRouteBonus: function () {
        this.score += RR.Config.ROUTE_BONUS;
    },

    getScore: function () {
        return Math.floor(this.score);
    },

    saveHighScore: function () {
        var s = this.getScore();
        var d = RR.Boat.distanceTraveled;
        if (s > this.highScore) {
            this.highScore = s;
            try { localStorage.setItem('rr_highscore', String(s)); } catch (e) {}
        }
        if (d > this.bestDistance) {
            this.bestDistance = d;
            try { localStorage.setItem('rr_bestdist', String(Math.floor(d))); } catch (e) {}
        }
    },

    loadHighScore: function () {
        try {
            this.highScore = parseInt(localStorage.getItem('rr_highscore') || '0', 10);
            this.bestDistance = parseInt(localStorage.getItem('rr_bestdist') || '0', 10);
        } catch (e) {
            this.highScore = 0;
            this.bestDistance = 0;
        }
    }
};
