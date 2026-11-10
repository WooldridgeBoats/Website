window.RR = window.RR || {};

RR.Scoring = {
    score: 0,
    lastSegment: 0,
    speedMultiplier: 1.0,
    speedMultTimer: 0,
    highScore: 0,
    bestDistance: 0,

    reset: function () {
        this.finished = false;
        this.elapsed = 0;
        this.finishTimeBonus = 0;
        this.lineMultiplier = 1;
        this.rampFlash = 0;
        this.logJumpFlash = 0;
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
        if (this.finished || boat.crashed || boat.grounded) return;
        this.elapsed += dt;
        this.rampFlash = Math.max(0, this.rampFlash - dt);
        var C = RR.Config;
        this.lineMultiplier = this.getLineMultiplier(boat);
        var currentSeg = Math.floor(boat.z / C.SEGMENT_LENGTH);

        if (currentSeg > this.lastSegment) {
            var gained = currentSeg - this.lastSegment;
            this.score += gained * C.DISTANCE_POINTS * this.speedMultiplier * this.lineMultiplier;
            this.lastSegment = currentSeg;
        }

        // Reward the driver for running each hull near its own limit; the LT
        // should not lose its multiplier merely because its real-world power
        // ceiling is lower than the Alaskan XL's.


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

    // Reward forward progress only: idling or reversing cannot farm a zone.
    // The multiplier follows the actual boat position, not just its river.
    getLineMultiplier: function (boat) {
        if (boat.jumpHeight > 0) return 1;
        var seg = RR.River.getSegmentAtZ(boat.z), isl = seg && seg.island;
        if (!seg) return 1;
        if (isl && isl.narrowSide) {
            var half = RR.River.islandHalf(isl, boat.z / RR.Config.SEGMENT_LENGTH);
            var side = boat.lateral < isl.position ? -1 : 1;
            if (half > 0.06 && side === isl.narrowSide && Math.abs(boat.lateral - isl.position) > half)
                return 2;
        }
        if (Math.abs(boat.lateral) < 0.82 && (seg.width < 0.85 || (seg.width < 1.15 && Math.abs(seg.curve) > 1.4))) return 1.5;
        return 1;
    },

    finishRiver: function (boat) {
        if (this.finished) return;
        this.finished = true;
        // Par is scaled to the selected hull's undamaged speed, so heavier
        // models have a fair target. Pausing/menu time never enters elapsed.
        var speed = RR.Config.MAX_SPEED * boat.getModel().speedMult;
        var par = RR.River.finishZ / Math.max(1, speed * 0.70);
        var fraction = Math.max(0, Math.min(1, (par - this.elapsed) / (par * 0.5)));
        this.finishTimeBonus = Math.round(RR.Config.FINISH_TIME_BONUS_MAX * fraction);
        this.score += RR.Config.ROUTE_BONUS + this.finishTimeBonus;
    },

    addRampBonus: function () {
        if (this.finished) return;
        this.score += RR.Config.RAMP_POINTS;
        this.rampFlash = 2.5;
    },

    addJumpBonus: function () {
        if (this.finished) return;
        this.score += RR.Config.JUMP_POINTS;
        this.logJumpFlash = 2.0;
    },

    addNearMiss: function () {
        if (this.finished) return;
        this.score += RR.Config.NEAR_MISS_POINTS;
    },

    // A salmon that lands in the boat. Flat rate, not multiplied -- it is luck,
    // not driving, and multiplying it would dwarf everything else on the run.
    addSalmonBonus: function () {
        if (this.finished) return;
        this.score += RR.Config.SALMON_POINTS;
        this.salmonCaught = (this.salmonCaught || 0) + 1;
        this.salmonFlash = 2.6;              // seconds of on-screen celebration
    },

    addShortcutBonus: function () {
        if (this.finished) return;
        this.score += RR.Config.SHORTCUT_BONUS;
        this.shortcutFlash = 3.0;
    },

    addRouteBonus: function () {
        if (this.finished) return;
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
