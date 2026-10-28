window.RR = window.RR || {};

RR.Collision = {
    checkAll: function (boat) {
        if (boat.crashed || boat.grounded) return;
        var River = RR.River;
        var C = RR.Config;
        var model = boat.getModel ? boat.getModel() : { beamScale: 1, massMult: 1 };
        boat.bearWarning = false;

        if (River.isOutOfBounds(boat.z, boat.lateral)) {
            boat.crash('Hit the riverbank!');
            return;
        }

        if (River.hitsShortcutDivider && River.hitsShortcutDivider(boat.z, boat.lateral)) {
            boat.crash(River.shortcut && River.shortcut.open ? 'Ran aground on the side-channel island!' : 'Hit the canyon wall!');
            return;
        }

        if (boat.jumpHeight <= 0 && River.isOnIsland(boat.z, boat.lateral)) {
            boat.crash('Ran aground on an island!');
            return;
        }

        var segIdx = Math.floor(boat.z / C.SEGMENT_LENGTH);
        var checkRange = 4;
        var i, seg, j, obs, dx, hitDist, obsReach, hitLen;
        var previousZ = boat.previousZ === undefined ? boat.z : boat.previousZ;
        for (i = Math.floor(previousZ / C.SEGMENT_LENGTH) - checkRange; i <= segIdx + checkRange; i++) {
            if (i < 0 || i >= River.segments.length) continue;
            seg = River.segments[i];
            for (j = 0; j < seg.obstacles.length; j++) {
                obs = seg.obstacles[j];
                var obsZ = i * C.SEGMENT_LENGTH;
                var crossed = previousZ <= obsZ && boat.z >= obsZ;
                var fraction = crossed ? Math.max(0, Math.min(1, (obsZ - previousZ) / Math.max(0.001, boat.z - previousZ))) : 1;
                var crossX = crossed ? (boat.previousLateral === undefined ? boat.lateral : boat.previousLateral) +
                    (boat.lateral - (boat.previousLateral === undefined ? boat.lateral : boat.previousLateral)) * fraction : boat.lateral;
                dx = Math.abs(crossX - obs.x);
                // Match contact to visible size in world units, including hull beam.
                var halfWidth=seg.width*C.BASE_RIVER_HALF_WIDTH*C.WORLD_SCALE;
                var radius=obs.type==='rock' ? obs.size*C.ROCK_SCALE :
                    (obs.type==='tree' ? obs.size*C.TREE_OBSTACLE_SCALE*(obs.cluster?0.9:0.38) : obs.size*C.LOG_SCALE*2.025);
                hitDist=(radius+5.4*(model.beamScale||1))/Math.max(1,halfWidth);

                // Longitudinal reach: the hull's own half length plus the
                // obstacle's DRAWN radius -- what you can see, not most of a
                // segment. Rocks draw at size * ROCK_SCALE and trees at
                // size * 2, the same numbers renderer3d.js scales the meshes
                // by, so the hit box matches the mesh instead of being 6x
                // longer than it.
                obsReach = obs.type === 'rock' ? radius : obs.size*2;
                hitLen = (C.HULL_HALF_LENGTH * (model.lengthScale || 1)*0.72 + obsReach) / C.WORLD_SCALE;

                if (dx < hitDist) {
                    var dz = Math.abs(boat.z - i * C.SEGMENT_LENGTH);
                    if (dz < hitLen || crossed) {
                        // Logs never end a run. Clear one in the air and it
                        // scores; hit one on the water and you just bump over
                        // it. Only rocks and trees standing in the river are
                        // hard enough to stop you.
                        if (obs.type === 'log' || obs.type === 'log_jump') {
                            var clearHeight = crossed ? (boat.previousJumpHeight || 0) +
                                (boat.jumpHeight - (boat.previousJumpHeight || 0)) * fraction : boat.jumpHeight;
                            if (clearHeight >= C.LOG_CLEAR_HEIGHT) {
                                if (!obs._cleared) {
                                    obs._cleared = true;
                                    RR.Scoring.addJumpBonus();
                                    boat.obstaclesCleared++;
                                }
                            } else if (!obs._bumped) {
                                // A floating deadhead rolls under the hull: it
                                // scrubs momentum AND now costs half a hull
                                // strike. It still cannot end a run on its own
                                // from full health, which is the point -- two
                                // logs equal one rock.
                                // Same ordering rule as _struck above: do not
                                // burn the log if the strike is going to be
                                // swallowed by the cooldown.
                                if (boat.hitCooldown > 0) continue;
                                obs._bumped = true;
                                boat.speed *= Math.max(0.72, 1 - 0.12 / Math.sqrt(model.massMult));
                                if (boat.takeHit('Broke the hull on a deadhead!', C.LOG_STRIKE)) return;
                            }
                            continue;
                        }
                        // Clearing low branch piles is possible with the
                        // stronger jump; standing snags need extra clearance.
                        var clearance = obs.type === 'tree' ? (obs.cluster ? 110 : 280) : obs.size * C.ROCK_SCALE / C.WORLD_SCALE;
                        var heightAtContact=crossed ? (boat.previousJumpHeight||0)+(boat.jumpHeight-(boat.previousJumpHeight||0))*fraction : boat.jumpHeight;
                        if (heightAtContact + (boat.rampHeight||0)/C.WORLD_SCALE > clearance) continue;
                        // Rocks and trees go through takeHit, so an armoured
                        // hull can survive them. _struck stops one obstacle
                        // costing more than one life as the boat rides past.
                        //
                        // The cooldown check MUST come before the flag is set.
                        // takeHit returns early while hitCooldown is running,
                        // so setting _struck first permanently disarmed any
                        // obstacle you happened to touch inside that 1.1 s --
                        // free passage through the next rock every time you
                        // scraped a canyon wall.
                        if (obs._struck) continue;
                        if (boat.hitCooldown > 0) continue;
                        obs._struck = true;
                        var names = { rock: 'Hit a rock!', tree: 'Hit a tree!' };
                        if (boat.takeHit(names[obs.type] || 'Crashed!')) return;
                        continue;
                    }
                } else if (dx < hitDist + 0.15 && dx >= hitDist) {
                    var dzNear = Math.abs(boat.z - i * C.SEGMENT_LENGTH);
                    // A near miss is scored for passing close ALONGSIDE, so
                    // this band is deliberately wider than the hit window --
                    // but tied to it, not to a whole segment.
                    if (dzNear < hitLen * 2.4) {
                        if (!obs._nearMissed) {
                            obs._nearMissed = true;
                            RR.Scoring.addNearMiss();
                            boat.nearMisses++;
                        }
                    }
                }
            }
        }

        this.checkSalmon(boat);

        if (this.checkCrocs(boat)) return;

        // Bears are bank hazards, not animals randomly standing in the river.
        // They telegraph their side well ahead; only an aggressive bank-hugging
        // line puts the boat within reach of a lunge.
        var bears = River.bears || [];
        for (i = 0; i < bears.length; i++) {
            var bear = bears[i];
            var bearZ = bear.segment * C.SEGMENT_LENGTH;
            var bearDz = Math.abs(boat.z - bearZ);
            var sameBank = boat.lateral * bear.side > C.BEAR_DANGER_LATERAL - 0.08;
            if (sameBank && bearDz < C.SEGMENT_LENGTH * C.BEAR_WARNING_SEGMENTS) {
                boat.bearWarning = true;
            }
            if (sameBank && boat.lateral * bear.side > C.BEAR_DANGER_LATERAL &&
                    bearDz < C.HULL_HALF_LENGTH * (model.lengthScale || 1) + C.BEAR_REACH) {
                boat.crash('A charging bear swiped the hull!');
                return;
            }
        }
    },

    // A jumping salmon that comes down over the hull lands IN the boat.
    //
    // The jump arc is re-derived here from exactly the same numbers
    // renderer3d.js._updateWildlife animates it with -- the same
    // RR.Engine.totalTime, the same 1.35 s jump inside each fish's own period,
    // the same 0.62-segment forward travel across the arc. If either side is
    // ever retuned, retune both, or the fish you see and the fish you catch
    // stop being the same fish.
    checkSalmon: function (boat) {
        if (boat.jumpHeight > 0) return;              // airborne yourself: no deck to land on
        var C = RR.Config;
        var t = (RR.Engine && RR.Engine.totalTime) || 0;
        var fish = RR.River.salmon || [];
        var model = boat.getModel ? boat.getModel() : { lengthScale: 1 };
        var halfLen = C.HULL_HALF_LENGTH * (model.lengthScale || 1) / C.WORLD_SCALE;
        var i, f, cycle, p, fz;

        for (i = 0; i < fish.length; i++) {
            f = fish[i];
            if (f._caught) continue;
            cycle = (t + f.phase) % f.period;
            if (cycle >= 1.35) continue;              // not airborne
            p = cycle / 1.35;
            // Only count the airborne middle of the arc. At the very start and
            // end the fish is at the surface, and a fish clipping the waterline
            // beside the hull is not a fish in the boat.
            if (p < 0.12 || p > 0.95) continue;
            if (Math.abs(f.x - boat.lateral) > C.SALMON_CATCH_LATERAL) continue;
            fz = (f.segment + (p - 0.5) * 0.62) * C.SEGMENT_LENGTH;
            var z0=boat.previousZ === undefined ? boat.z : boat.previousZ;
            if (fz < Math.min(z0,boat.z)-halfLen || fz > Math.max(z0,boat.z)+halfLen) continue;

            f._caught = true;
            RR.Scoring.addSalmonBonus();
            if (RR.Audio && RR.Audio.play) RR.Audio.play('splash', 0.5);
        }
    },

    // A crocodile lying in the water is a hazard like a rock; one on the bank
    // behaves like a bear -- it only reaches you if you commit to its side.
    checkCrocs: function (boat) {
        var C = RR.Config, crocs = RR.River.crocs || [];
        var model = boat.getModel ? boat.getModel() : { lengthScale: 1, beamScale: 1 };
        // Same reach every other hazard uses: the hull's own half length plus
        // the animal. The bank branch below used SEGMENT_LENGTH * 0.72 -- 144
        // units -- which is the exact over-long window already fixed for rocks,
        // snags and bears, and it was killing from most of a segment away.
        var reach = C.HULL_HALF_LENGTH * (model.lengthScale || 1) + C.BEAR_REACH;
        var i, c, dz;
        for (i = 0; i < crocs.length; i++) {
            c = crocs[i];
            dz = Math.abs(boat.z - c.segment * C.SEGMENT_LENGTH);
            if (dz > C.SEGMENT_LENGTH * C.BEAR_WARNING_SEGMENTS) continue;
            if (c.inWater) {
                // Lateral sized off the hull's real beam plus the croc rather
                // than a flat 0.16, which was ~2.4x too wide -- it took the
                // hull with two beams of clear water still showing.
                if (dz < C.HULL_HALF_LENGTH * 1.6 + c.size * 6 &&
                        Math.abs(boat.lateral - c.x) < 0.062 * (model.beamScale || 1) + c.size * 0.03) {
                    if (boat.jumpHeight > 0) continue;      // jumped clean over
                    return boat.takeHit('A crocodile took the hull!');
                }
                if (Math.abs(boat.lateral - c.x) < 0.34) boat.bearWarning = true;
            } else {
                if (boat.lateral * c.side > C.BEAR_DANGER_LATERAL - 0.08) boat.bearWarning = true;
                if (boat.lateral * c.side > C.BEAR_DANGER_LATERAL &&
                        dz < reach) {
                    return boat.takeHit('A crocodile lunged off the bank!');
                }
            }
        }
        return false;
    },

    resetNearMisses: function () {
        if (RR.Ramps) RR.Ramps.reset();
        var segs = RR.River.segments;
        var i, j;
        for (i = 0; i < segs.length; i++) {
            for (j = 0; j < segs[i].obstacles.length; j++) {
                segs[i].obstacles[j]._cleared = false;
                segs[i].obstacles[j]._nearMissed = false;
                segs[i].obstacles[j]._bumped = false;
                segs[i].obstacles[j]._struck = false;
            }
        }
        var fish = RR.River.salmon || [];
        for (i = 0; i < fish.length; i++) fish[i]._caught = false;
    }
};
