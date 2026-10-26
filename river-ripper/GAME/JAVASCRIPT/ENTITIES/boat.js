window.RR = window.RR || {};

RR.Boat = {
    z: 0,
    lateral: 0,
    speed: 0,
    jumpVelocity: 0,
    jumpHeight: 0,
    jumpCooldown: 0,
    inShallow: 0,
    shallowTimer: 0,
    grounded: false,
    crashed: false,
    crashType: '',
    screenY: 0,
    tilt: 0,
    headingOffset: 0,
    travelHeadingOffset: 0,
    steeringLoad: 0,
    throttle: 0,
    bearWarning: false,
    hits: 0,
    hitFlash: 0,
    hitCooldown: 0,
    wakeIntensity: 0,
    distanceTraveled: 0,
    maxSpeed: 0,
    jumpCount: 0,
    obstaclesCleared: 0,
    nearMisses: 0,

    reset: function () {
        this.z = 0;
        this.lateral = 0;
        this.speed = 0;
        this.jumpVelocity = 0;
        this.jumpHeight = 0;
        this.jumpCooldown = 0;
        this.inShallow = 0;
        this.shallowTimer = 0;
        this.grounded = false;
        this.crashed = false;
        this.crashType = '';
        this.screenY = RR.Config.BOAT_BASE_Y;
        this.tilt = 0;
        this.headingOffset = 0;
        this.travelHeadingOffset = 0;
        this.steeringLoad = 0;
        this._curS = null;
        this.tookShortcut = false;
        this._curL = null;
        this.throttle = 0;
        this.bearWarning = false;
        this.hits = 0;
        this.hitFlash = 0;
        this.hitCooldown = 0;
        this.wakeIntensity = 0;
        this.distanceTraveled = 0;
        this.maxSpeed = 0;
        this.jumpCount = 0;
        this.obstaclesCleared = 0;
        this.nearMisses = 0;
    },

    update: function (dt) {
        if (this.crashed || this.grounded) return;
        var C = RR.Config;
        var Input = RR.Input;
        var River = RR.River;
        var model = this.getModel();

        // What the hull FEELS is the river's flow low-passed over ~0.7 s. A
        // boat has mass; water changing under it shows up as a lean, not a
        // shove. This and the smoothed field in river.js together are the
        // fix for "currents ... really jolt you around" (2026-10-26).
        var rawCurrent = River.getCurrentAtPosition(this.z, this.lateral);
        var cf = 1 - Math.exp(-dt / 0.7);
        if (this._curS === undefined || this._curS === null) {
            this._curS = rawCurrent.strength;
            this._curL = rawCurrent.lateral;
        }
        this._curS += (rawCurrent.strength - this._curS) * cf;
        this._curL += (rawCurrent.lateral - this._curL) * cf;
        var current = { strength: this._curS, lateral: this._curL };
        var shallowAmount = River.isShallowAt(this.z, this.lateral);
        this.inShallow = shallowAmount;

        var oldSpeed = this.speed;
        var onThrottle = Input.isDown('KeyW') || Input.isDown('ArrowUp');
        var throttleTarget = onThrottle ? 1 : 0;
        var throttleRate = onThrottle ? 3.6 : 5.0;
        this.throttle += (throttleTarget - this.throttle) * Math.min(1, throttleRate * dt);

        if (onThrottle) {
            var accel = C.ACCELERATION * model.accelerationMult * (0.38 + this.throttle * 0.62);
            if (shallowAmount > 0) accel *= (1 - shallowAmount * 0.7);
            this.speed += accel * dt;
        } else if (Input.isDown('KeyS') || Input.isDown('ArrowDown')) {
            this.speed -= C.BRAKING * model.brakingMult * dt;
        } else {
            // A wide, heavy hull carries farther when the throttle closes.
            this.speed -= (C.NATURAL_DECEL / Math.sqrt(model.massMult)) * dt;
        }

        var modelMaxSpeed = this.getMaxSpeed();
        var effectiveMax = modelMaxSpeed;
        if (shallowAmount > 0) {
            effectiveMax *= (1 - shallowAmount * 0.6);
            this.speed -= shallowAmount * model.shallowDragMult * C.SHALLOW_DRAG_MULT * C.NATURAL_DECEL * dt;
        }

        if (this.speed > effectiveMax) this.speed = effectiveMax;
        if (this.speed < 0) this.speed = 0;

        var steerMult = 1.0;
        var speedRatio = this.speed / modelMaxSpeed;
        if (speedRatio > 0.7) steerMult = C.HIGH_SPEED_STEER_MULT + (1 - C.HIGH_SPEED_STEER_MULT) * (1 - (speedRatio - 0.7) / 0.3);
        if (shallowAmount > 0) steerMult *= C.SHALLOW_STEER_MULT;
        if (this.jumpHeight > 0) steerMult *= 0.3;

        // ONE AXIS, ONE HEADING. This is deliberately as simple as it can be.
        //
        // A/D and the arrow keys are aliases, they set a bow angle, and THE
        // BOAT GOES WHERE THE BOW POINTS. There is no separate course angle and
        // no slip. Two earlier models kept a bow angle and a travel angle as
        // independent values -- first with different influences per key, then
        // with the bow leading the course by BOW_LEAD under a slip cap -- and
        // both let the hull sit at an angle to its own path, which is the
        // "boat drives forwards sideways" this game kept coming back to.
        // The reference clips have exactly one heading. So does this now.
        var steerInput = 0;
        if (Input.isDown('KeyA') || Input.isDown('ArrowLeft')) steerInput -= 1;
        if (Input.isDown('KeyD') || Input.isDown('ArrowRight')) steerInput += 1;
        // Phone stick (CORE/touch.js): analog, -1..1, same single bow axis.
        if (RR.Touch && RR.Touch.steering) steerInput = RR.Touch.steer;

        // A jet boat needs thrust to point. A little authority remains at idle,
        // but the usable angle grows with speed.
        var steerAuthority = C.MIN_STEER_AUTHORITY +
            (1 - C.MIN_STEER_AUTHORITY) * speedRatio;
        var modelSteerAngle = C.MAX_BOW_ANGLE * model.steerMult;
        var oldHeadingOffset = this.headingOffset;

        var targetHeading = steerInput * modelSteerAngle * steerAuthority * steerMult;
        var steerResponse = C.STEER_RESPONSE;
        if (steerInput === 0) steerResponse = C.STEER_RELEASE;
        else if (this.headingOffset * steerInput < 0) steerResponse = C.STEER_REVERSE_RESPONSE;
        steerResponse *= model.steerResponseMult;

        this.headingOffset = targetHeading +
            (oldHeadingOffset - targetHeading) * Math.exp(-steerResponse * dt);
        if (steerInput === 0 && Math.abs(this.headingOffset) < 0.001) this.headingOffset = 0;

        // The course IS the heading. Kept as its own field only because the
        // wake mesh and the HUD read it; it is never allowed to differ.
        this.travelHeadingOffset = this.headingOffset;
        var oldTravelHeadingOffset = oldHeadingOffset;

        // Resolve the boat's forward thrust along its actual bow heading. The
        // midpoint values keep motion stable across different frame rates.
        var moveSpeed = (oldSpeed + this.speed) * 0.5;
        var moveHeading = (oldTravelHeadingOffset + this.travelHeadingOffset) * 0.5;
        var massResistance = Math.pow(model.massMult, 0.28);
        // Cross-flow always arrives with an upstream component, so the current
        // is a single diagonal vector at the hull rather than two independent
        // pushes. See CURRENT_DIAGONAL in config.js.
        var diagonalPush = Math.abs(current.lateral) * C.CURRENT_DIAGONAL;
        var currentPushBack = (current.strength + diagonalPush) *
            C.MAX_SPEED * C.BASE_CURRENT_STRENGTH / massResistance;
        var forwardThroughWater = moveSpeed * Math.cos(moveHeading);
        var forwardOverGround = forwardThroughWater - currentPushBack;

        // A strong current or a hard skid can stall forward progress, but the
        // game never runs the boat and camera backwards. Once the throttle is
        // spooled and the hull has steerage, retain a tiny crawl so the player
        // can recover instead of feeling glued to the current.
        var minProgress = 0;
        if (onThrottle && this.throttle > 0.18 && speedRatio > 0.08) {
            minProgress = modelMaxSpeed * C.MIN_THROTTLE_PROGRESS * this.throttle;
        }
        forwardOverGround = Math.max(minProgress, forwardOverGround, 0);
        var netForward = forwardOverGround * dt;
        // The canyon's secret tunnel: fast water, and a shorter way round.
        if (River.inShortcutLane(this.z, this.lateral)) {
            netForward *= C.SHORTCUT_GAIN;
            if (!this.tookShortcut) {
                this.tookShortcut = true;
                if (RR.Scoring.addShortcutBonus) RR.Scoring.addShortcutBonus();
            }
        }
        this.z += netForward;
        if (this.z < 0) this.z = 0;
        this.distanceTraveled = this.z;
        if (this.speed > this.maxSpeed) this.maxSpeed = this.speed;

        // Convert physical cross-river travel back to the normalized channel
        // coordinate used by obstacles, islands and the renderer.
        var seg = River.getSegmentAtZ(this.z);
        var riverHalfWidth = Math.max(1, seg.width * C.BASE_RIVER_HALF_WIDTH);
        var crossRiverSpeed = moveSpeed * Math.sin(moveHeading);
        this.lateral += crossRiverSpeed / riverHalfWidth * dt;

        this.lateral += current.lateral * C.MAX_LATERAL_CURRENT / massResistance * dt * (1 - speedRatio * 0.3);

        // Beam consumes actual channel room; the 106-inch Sportster cannot use
        // the same bank-hugging line as the 80-inch Alaskan LT.
        var edgeLimit = C.BOAT_EDGE_LIMIT - Math.max(0, model.beamScale - 1) * 0.22 +
            Math.max(0, 1 - model.beamScale) * 0.04;
        // THE EDGE IS A HARD STOP, ALWAYS. The hull is clamped here and cannot
        // pass it, which is why the boat can never drive into a canyon wall and
        // vanish -- the walls sit out at lateral 1.16+, the boat stops at ~0.78,
        // and the two never meet in geometry. What follows only decides whether
        // touching that stop costs you anything.
        var onEdge = false;
        if (this.lateral < -edgeLimit) {
            this.lateral = -edgeLimit;
            if (this.headingOffset < 0) this.headingOffset = 0;
            onEdge = true;
        }
        // The right edge opens up through the canyon shortcut (river.js).
        var edgeRight = Math.max(edgeLimit,
            River.shortcutOuter(this.z) - Math.max(0, model.beamScale - 1) * 0.22);
        if (this.lateral > edgeRight) {
            // Past the tunnel exit the limit eases back in; follow it at a
            // bounded rate rather than teleporting the hull.
            var over = this.lateral - edgeRight;
            this.lateral = over > 0.05 ? this.lateral - Math.min(over, 1.6 * dt) : edgeRight;
            if (this.headingOffset > 0) this.headingOffset = 0;
            onEdge = true;
        }

        // On a canyon river the bank IS rock, so grinding it costs half a hull
        // strike -- the same as a floating log. takeHit's own 1.1 s cooldown
        // does the rate limiting, so holding the boat against the wall bleeds
        // you steadily rather than draining the hull in a single frame.
        //
        // Only on canyon profiles: scraping a Skyqualmie gravel bar should not
        // cost the same as putting the hull into basalt.
        // jumpHeight <= 0: airborne steering is cut to 30% (see steerMult
        // above), so a wall strike taken mid-jump is one you had no way to
        // avoid. Every other hazard already exempts a jumping boat.
        //
        // The speed gate uses the UNDAMAGED top speed on purpose. getMaxSpeed()
        // drops 18% once the Rogue is damaged, so gating on it meant a crippled
        // boat started grinding at speeds a healthy one was immune at.
        //
        // And the return matters: without it update() carries on running on a
        // boat that just died, which let the crash reason be overwritten by a
        // grounding and let a jump launch on the fatal frame.
        if (onEdge && this.jumpHeight <= 0 &&
                RR.River.profile && RR.River.profile.canyon &&
                this.speed > C.MAX_SPEED * model.speedMult * 0.16) {
            if (this.takeHit('Ground the hull on the canyon wall!', C.LOG_STRIKE)) return;
        }

        // Start washing outward course angle away before the hard stop. This
        // prevents a boat from remaining pinned against the same bank after
        // the player releases the turn.
        // Per side: the right-hand limit opens up through the canyon shortcut,
        // and the wash must not stop you turning into its mouth.
        var sideLimit = this.lateral < 0 ? edgeLimit : edgeRight;
        var edgeStart = sideLimit * 0.84;
        var edgeAmount = Math.max(0, (Math.abs(this.lateral) - edgeStart) /
            Math.max(0.001, sideLimit - edgeStart));
        var outward = this.lateral < 0 ? -1 : 1;
        if (edgeAmount > 0 && this.headingOffset * outward > 0) {
            this.headingOffset *= Math.exp(-C.EDGE_STEER_RECOVERY * edgeAmount * dt);
        }

        // Slip is structurally zero now; kept so steeringLoad reads the same.
        var slipAngle = 0;
        this.steeringLoad = Math.max(-1, Math.min(1,
            this.travelHeadingOffset / Math.max(0.001, modelSteerAngle) +
            slipAngle / Math.max(0.001, modelSteerAngle) * 0.45));
        this.travelHeadingOffset = this.headingOffset;

        var tiltTarget = this.steeringLoad * 0.18 * speedRatio;
        var tiltBlend = 1 - Math.exp(-C.STEER_TILT_RESPONSE * dt);
        this.tilt += (tiltTarget - this.tilt) * tiltBlend;

        if (this.jumpCooldown > 0) this.jumpCooldown -= dt;
        if (this.hitCooldown > 0) this.hitCooldown -= dt;
        if (this.hitFlash > 0) this.hitFlash -= dt;

        if (Input.justPressed('Space') && this.jumpHeight === 0 && this.jumpCooldown <= 0 && !this.nearMarker()) {
            this.jumpVelocity = C.JUMP_VELOCITY;
            this.jumpCooldown = C.JUMP_COOLDOWN;
            this.jumpCount++;
            RR.Audio.play('splash', 0.6);
        }

        if (this.jumpHeight > 0 || this.jumpVelocity > 0) {
            this.jumpHeight += this.jumpVelocity * dt;
            this.jumpVelocity -= C.GRAVITY * dt;
            if (this.jumpHeight <= 0) {
                this.jumpHeight = 0;
                this.jumpVelocity = 0;
                if (shallowAmount > 0.5) {
                    this.crash('Bad landing in shallow water!');
                    return;
                }
            }
        }

        if (shallowAmount > 0.3) {
            this.shallowTimer += dt;
            if (this.shallowTimer >= C.SHALLOW_GROUND_TIME * model.groundTimeMult) {
                this.grounded = true;
                this.crash('Grounded in shallow water!');
                return;
            }
        } else {
            this.shallowTimer = Math.max(0, this.shallowTimer - dt * 2);
        }

        var netSpeed = Math.max(0, this.speed * Math.cos(this.travelHeadingOffset) - currentPushBack);
        var targetY = C.BOAT_BASE_Y - (netSpeed / modelMaxSpeed) * C.BOAT_Y_RANGE;
        this.screenY += (targetY - this.screenY) * 3 * dt;

        this.wakeIntensity = speedRatio;
    },

    nearMarker: function () {
        var seg = RR.River.getSegmentAtZ(this.z);
        if (seg.marker && this.speed < this.getMaxSpeed() * 0.3) {
            if (Math.abs(this.lateral - seg.marker.x) < 0.3) return true;
        }
        return false;
    },

    getModel: function () {
        return RR.BoatCatalog ? RR.BoatCatalog.getSelected() : {
            speedMult: 1, accelerationMult: 1, brakingMult: 1,
            steerMult: 1, steerResponseMult: 1, massMult: 1,
            beamScale: 1, lengthScale: 1, shallowDragMult: 1,
            groundTimeMult: 1, model: "18' ALASKAN"
        };
    },

    getMaxSpeed: function () {
        return RR.Config.MAX_SPEED * this.getModel().speedMult * this.damageSpeedMult();
    },

    // Hull strikes the selected boat can absorb before a run ends. 1 for every
    // model except the HDPE-armoured Rogue.
    maxHits: function () {
        // Hull strikes come from the DIFFICULTY now, not the boat, so the same
        // hull is tougher on EASY than on HARD. The Rogue keeps its armoured
        // character by always getting one more than everyone else.
        var d = RR.Difficulty && RR.Difficulty.getSelected ? RR.Difficulty.getSelected() : null;
        var model = this.getModel();
        var isRogue = RR.BoatCatalog && RR.BoatCatalog.trait(model, 'logo') === 'rogue';
        if (d && d.hullStrikes) {
            return isRogue ? (d.rogueStrikes || d.hullStrikes + 1) : d.hullStrikes;
        }
        return RR.BoatCatalog ? RR.BoatCatalog.trait(model, 'hitPoints') : 1;
    },

    hitsLeft: function () {
        return Math.max(0, this.maxHits() - this.hits);
    },

    // On its LAST life the hull is damaged and the boat is slower. A 1-hit
    // boat never reaches this state -- it crashes on the strike instead.
    isDamaged: function () {
        return this.maxHits() > 1 && this.hits >= this.maxHits() - 1;
    },

    damageSpeedMult: function () {
        if (!this.isDamaged()) return 1;
        return RR.BoatCatalog ? RR.BoatCatalog.trait(this.getModel(), 'damageSpeed') : 1;
    },

    // A survivable obstacle strike. Returns true if the run ended.
    //
    // The cooldown matters: the boat is still inside the obstacle's hit box
    // for several frames after contact, so without it a single rock would
    // burn all three lives in about a fifth of a second.
    // amount defaults to a full strike. A floating log costs C.LOG_STRIKE
    // (half), so on MEDIUM's two strikes it takes four logs to end a run but
    // only two solid hits -- hitting timber still matters, it just is not the
    // same as putting the hull on a rock.
    takeHit: function (reason, amount) {
        if (this.crashed || this.grounded) return true;
        if (this.hitCooldown > 0) return false;

        this.hits += (amount === undefined ? 1 : amount);
        this.hitCooldown = 1.1;
        this.hitFlash = 0.9;

        if (this.hits >= this.maxHits() - 1e-6) {
            this.crash(reason);
            return true;
        }

        // Survived. Scrub speed off hard so a strike is still punishing, and
        // re-clamp: dropping onto the last life lowers the ceiling too.
        this.speed *= 0.45;
        var cap = this.getMaxSpeed();
        if (this.speed > cap) this.speed = cap;
        RR.Audio.play('crash', 0.5);
        return false;
    },

    crash: function (reason) {
        this.crashed = true;
        this.crashType = reason || 'Crashed!';
        this.speed = 0;
        RR.Audio.play('crash');
    },

    draw: function () {
        // 3D rendering handled by RR.Renderer3D
    }
};
