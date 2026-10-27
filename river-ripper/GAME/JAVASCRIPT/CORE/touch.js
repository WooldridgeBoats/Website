window.RR = window.RR || {};

// ---------------------------------------------------------------------------
// RR.Touch -- phones and tablets (Tyler, 2026-10-26).
//
// Nothing here does anything until a finger actually touches the game, so a
// computer plays exactly as before. On the first touch:
//
//   RIVER   left thumb  : a floating stick -- touch anywhere on the left side
//                          and slide; the further you slide the harder the bow
//                          turns (analog, fed straight into boat.js)
//           throttle    : ON by itself (arcade style); REVERSE holds it off
//           right thumb : JUMP and REVERSE buttons, PAUSE up top
//           TILT (default on phones, Tyler 2026-10-27): turn the phone
//           like a steering wheel. A thumb on the left side still steers
//           and wins while it's down; the TILT button swaps to THUMB mode.
//           a STEER pad with a thumb sits bottom-left so people see where
//           to put the left thumb; it rocks side to side until they steer
//           (Tyler, 2026-10-27: boats don't have brakes -- it's REVERSE)
//   MENUS   every tap is a click at that spot (the menus already take clicks)
//   NAMES   tapping a name box opens the phone's own keyboard (a hidden
//           <input>, focused inside the tap itself -- iPhones only allow that)
//   SCREEN  the game goes full screen, sideways; an X takes you back to the
//           page; held upright it asks you to turn the phone
//
// It all works through RR.Input: virtual keys (KeyW / KeyS), latched presses
// (Space, Escape, Enter), the click fields, and RR.Input.typed for letters.
//
// LITE GRAPHICS: a phone-class device (no hover, coarse pointer) is flagged
// RR.Config.LITE before the renderer starts, and renderer3d.js plants fewer
// trees, uses simpler crowns, and skips shadows and antialiasing.
// ---------------------------------------------------------------------------
RR.Touch = {
    active: false,          // a touch has happened on this page
    steering: false,        // a thumb is on the stick right now
    steer: 0,               // -1 .. 1
    reverse: false,
    _steerId: null, _steerX0: 0, _steerY0: 0, _steerX: 0, _steerY: 0,
    _reverseId: null, _jumpId: null,
    _taps: {},
    _drove: false,
    _input: null,
    _box: null,

    // Canvas-space layout of the river buttons (the game draws at 1280x720).
    JUMP:  { x: 1148, y: 560, r: 78 },
    REVERSE: { x: 978, y: 618, r: 58 },
    STEER_PAD: { x: 240, y: 570 },
    _steeredThisRun: false, _hintT: 0,
    PAUSE: { x: 1224, y: 124, r: 34 },
    TILT_BTN: { x: 1224, y: 276, r: 34 },
    TILT_LOCK_DEG: 24,      // phone turned this far = full lock
    TILT_DEAD_DEG: 2.5,
    tiltOn: true,           // the player's choice (remembered)
    tilting: false,         // tilt is steering right now
    _tiltOk: false,         // the phone is sending motion readings
    _tiltAsked: false, _tiltRaw: 0, _tiltFlip: 0, _tiltAt: 0,
    STICK_RANGE: 110,

    phoneClass: function () {
        try {
            return window.matchMedia && window.matchMedia('(hover: none) and (pointer: coarse)').matches;
        } catch (e) { return false; }
    },

    init: function () {
        var self = this;
        if (this.phoneClass()) RR.Config.LITE = true;
        var opts = { passive: false };
        document.addEventListener('touchstart', function (e) { self._start(e); }, opts);
        document.addEventListener('touchmove', function (e) { self._move(e); }, opts);
        document.addEventListener('touchend', function (e) { self._end(e); }, opts);
        document.addEventListener('touchcancel', function (e) { self._end(e); }, opts);
        // Turning the phone sideways with the game on screen takes it full
        // screen by itself (Tyler, 2026-10-27). EXIT opts out until the phone
        // goes upright again. (Browsers only allow the REAL full-screen call
        // inside a tap, so Android finishes the job on the first tap.)
        try { if (localStorage.getItem('rr_tilt') === 'off') this.tiltOn = false; } catch (e) {}
        // Listen from the start: Android sends motion without asking; iPhones
        // stay silent until the yes from _askTilt() on the first tap.
        this._listenTilt();
        if (this.phoneClass()) {
            var check = function () { setTimeout(function () { self._autoSideways(); }, 250); };
            window.addEventListener('orientationchange', check);
            window.addEventListener('resize', check);
            check();
        }
    },

    // ---- tilt steering -----------------------------------------------------
    // iPhones only allow motion readings after a yes inside a tap.
    _askTilt: function () {
        if (this._tiltAsked) return;
        this._tiltAsked = true;
        var self = this;
        if (window.DeviceMotionEvent && typeof DeviceMotionEvent.requestPermission === 'function') {
            try {
                DeviceMotionEvent.requestPermission().then(function (r) {
                    if (r === 'granted') self._listenTilt();
                }).catch(function () {});
            } catch (e) {}
        }
    },

    _listenTilt: function () {
        if (this._tiltListening) return;
        this._tiltListening = true;
        var self = this;
        window.addEventListener('devicemotion', function (e) { self._onMotion(e); });
    },

    // Gravity along the phone's long edge = how far it's turned like a wheel,
    // however far back it's leaned. Which way is "right" depends on which way
    // round it's held, and some browsers report gravity upside down -- so the
    // screen-facing reading (z) on the first samples settles the sign.
    _onMotion: function (e) {
        var g = e.accelerationIncludingGravity;
        if (!g || g.y == null || g.z == null) return;
        if (!this._tiltFlip) {
            if (Math.abs(g.z) < 1.5) return;          // held edge-on: wait
            this._tiltFlip = g.z > 0 ? 1 : -1;
        }
        var ang = 0;
        try { ang = (screen.orientation && screen.orientation.angle) || window.orientation || 0; } catch (x) {}
        if (ang < 0) ang += 360;
        var side = ang === 90 ? 1 : (ang === 270 ? -1 : 0);
        if (!side) { this._tiltRaw = 0; return; }     // upright: no tilt steering
        var gy = Math.max(-9.81, Math.min(9.81, g.y * this._tiltFlip * side));
        this._tiltRaw = Math.asin(gy / 9.81) * 180 / Math.PI;
        this._tiltOk = true;
        this._tiltAt = Date.now();
    },

    _tiltSteer: function () {
        var d = this._tiltRaw, dz = this.TILT_DEAD_DEG;
        if (Math.abs(d) < dz) return 0;
        var v = (Math.abs(d) - dz) / (this.TILT_LOCK_DEG - dz);
        return Math.max(-1, Math.min(1, v)) * (d < 0 ? -1 : 1);
    },

    _setTilt: function (on) {
        this.tiltOn = on;
        try { localStorage.setItem('rr_tilt', on ? 'on' : 'off'); } catch (e) {}
        if (on) this._askTilt();
    },

    _optedOut: false,
    _autoSideways: function () {
        var sideways = window.innerWidth > window.innerHeight;
        if (!sideways) { this._optedOut = false; return; }
        if (this._optedOut || document.documentElement.classList.contains('rr-playing')) return;
        var box = this._container();
        if (!box) return;
        var r = box.getBoundingClientRect();
        var shown = Math.min(r.bottom, window.innerHeight) - Math.max(r.top, 0);
        if (shown < r.height * 0.4) return;     // game scrolled away: leave the page alone
        if (!this.active) { this.active = true; this._setupDom(); }
        this._enterPlaying();
    },

    // Page -> canvas coordinates WITHOUT the bounds check, so a thumb that
    // slides off the picture still steers.
    _toCanvas: function (cx, cy) {
        var c = document.getElementById('glCanvas');
        if (!c) return null;
        var r = c.getBoundingClientRect();
        if (!r.width || !r.height) return null;
        var W = RR.Config.CANVAS_WIDTH, H = RR.Config.CANVAS_HEIGHT;
        var s = Math.min(r.width / W, r.height / H);
        return { x: (cx - (r.left + (r.width - W * s) / 2)) / s,
                 y: (cy - (r.top + (r.height - H * s) / 2)) / s };
    },

    _inGame: function (t) {
        var box = this._container();
        return box && (box.contains(t.target) || document.documentElement.classList.contains('rr-playing'));
    },

    _riverLive: function () {
        return RR.Engine && RR.Engine.scene === RR.RiverScene && !RR.Engine.overlay;
    },

    _hit: function (p, b) {
        var dx = p.x - b.x, dy = p.y - b.y;
        return dx * dx + dy * dy <= b.r * b.r * 1.35;
    },

    _start: function (e) {
        var i, t, p;
        for (i = 0; i < e.changedTouches.length; i++) {
            t = e.changedTouches[i];
            if (!this._inGame(t)) continue;
            if (t.target && t.target.getAttribute && t.target.getAttribute('data-rr-ui')) continue;
            e.preventDefault();
            if (!this.active) { this.active = true; this._setupDom(); }
            this._enterPlaying();
            p = this._toCanvas(t.clientX, t.clientY);
            if (!p) continue;

            if (this._riverLive()) {
                if (this._hit(p, this.PAUSE)) { RR.Input.latch.Escape = true; continue; }
                if (this._hit(p, this.TILT_BTN)) { this._setTilt(!this.tiltOn); continue; }
                if (RR.SoundButton && RR.SoundButton.hit(p.x, p.y)) { RR.Audio.toggleMute(); continue; }
                if (this._hit(p, this.JUMP)) { RR.Input.latch.Space = true; this._jumpId = t.identifier; continue; }
                if (this._hit(p, this.REVERSE)) { this.reverse = true; this._reverseId = t.identifier; continue; }
                if (p.x < 760 && this._steerId === null) {
                    this._steerId = t.identifier;
                    this._steerX0 = this._steerX = p.x;
                    this._steerY0 = this._steerY = p.y;
                    this.steering = true;
                    this.steer = 0;
                }
                continue;
            }
            // Menus: remember the tap; it becomes a click if it stays a tap.
            this._taps[t.identifier] = { x: p.x, y: p.y, t: Date.now() };
            RR.Input.mouseX = p.x; RR.Input.mouseY = p.y;
            RR.Input.inside = true; RR.Input.moved = true;
        }
    },

    _move: function (e) {
        var i, t, p;
        for (i = 0; i < e.changedTouches.length; i++) {
            t = e.changedTouches[i];
            if (t.identifier === this._steerId) {
                e.preventDefault();
                p = this._toCanvas(t.clientX, t.clientY);
                if (!p) continue;
                this._steerX = p.x; this._steerY = p.y;
                var v = (p.x - this._steerX0) / this.STICK_RANGE;
                if (Math.abs(v) < 0.08) v = 0;
                this.steer = Math.max(-1, Math.min(1, v));
            } else if (this._taps[t.identifier] || this._inGame(t)) {
                e.preventDefault();
            }
        }
    },

    _end: function (e) {
        var i, t, tap, p;
        if (!this._tiltAsked && this.tiltOn && this._inGame(e.changedTouches[0] || {})) this._askTilt();
        for (i = 0; i < e.changedTouches.length; i++) {
            t = e.changedTouches[i];
            if (t.identifier === this._steerId) {
                this._steerId = null; this.steering = false; this.steer = 0;
            }
            if (t.identifier === this._reverseId) { this._reverseId = null; this.reverse = false; }
            if (t.identifier === this._jumpId) this._jumpId = null;
            tap = this._taps[t.identifier];
            if (!tap) continue;
            delete this._taps[t.identifier];
            e.preventDefault();
            p = this._toCanvas(t.clientX, t.clientY);
            if (!p) continue;
            var dx = p.x - tap.x, dy = p.y - tap.y;
            if (dx * dx + dy * dy > 40 * 40 || Date.now() - tap.t > 900) continue;
            // NAME ENTRY: the keyboard can only be opened from inside the tap.
            if (RR.Engine.scene === RR.NameEntryScene && RR.NameEntryScene.touchTap) {
                if (RR.NameEntryScene.touchTap(p.x, p.y)) continue;
            }
            RR.Input.mouseX = p.x; RR.Input.mouseY = p.y;
            RR.Input.inside = true; RR.Input.moved = true;
            RR.Input.clicked = true;
        }
    },

    // Called by the engine at the top of every frame.
    update: function (dt) {
        if (!this.active) return;
        // Turned upright mid-run: the "turn your phone" card covers the game,
        // so pause rather than let the boat crash unseen.
        if (this._riverLive() && document.documentElement.classList.contains('rr-playing') &&
                window.innerHeight > window.innerWidth) {
            RR.Engine.pushOverlay(RR.PauseScene);
            return;
        }
        if (this._riverLive()) {
            RR.Input.keys.KeyW = !this.reverse;
            RR.Input.keys.KeyS = this.reverse;
            var live = this.tiltOn && this._tiltOk && Date.now() - this._tiltAt < 500;
            this.tilting = live && !this.steering;
            if (this.tilting) {
                // a light smoothing so a shaky hand doesn't twitch the bow
                this.steer += (this._tiltSteer() - this.steer) * Math.min(1, 14 * (dt || 0.016));
                if (Math.abs(this.steer) > 0.25) this._steeredThisRun = true;
            }
            if (this.steering && this.steer !== 0) this._steeredThisRun = true;
            this._hintT += dt || 0;
            this._drove = true;
        } else if (this._drove) {
            RR.Input.keys.KeyW = false;
            RR.Input.keys.KeyS = false;
            this._drove = false;
            this.reverse = false; this._reverseId = null;
            this._steeredThisRun = false; this._hintT = 0;
            this.steering = false; this.steer = 0; this._steerId = null;
            this.tilting = false;
        }
        if (RR.Engine.scene !== RR.NameEntryScene && this._input && document.activeElement === this._input) {
            this._input.blur();
        }
    },

    // ---- the phone keyboard ------------------------------------------------
    openKeyboard: function () {
        var inp = this._input;
        if (!inp) return;
        inp.value = '';
        try { inp.focus(); } catch (e) {}
    },

    _makeInput: function () {
        var inp = document.createElement('input');
        inp.type = 'text';
        inp.setAttribute('autocapitalize', 'characters');
        inp.setAttribute('autocomplete', 'off');
        inp.setAttribute('autocorrect', 'off');
        inp.setAttribute('spellcheck', 'false');
        inp.setAttribute('enterkeyhint', 'next');
        inp.setAttribute('aria-label', 'Name');
        inp.setAttribute('data-rr-ui', '1');
        // 16px or iPhones zoom the page when it gains focus.
        inp.style.cssText = 'position:fixed;left:0;bottom:0;width:1px;height:1px;opacity:0;' +
                            'font-size:16px;border:0;padding:0;z-index:-1;';
        var push = function (ch) { RR.Input.typed.push(ch); };
        inp.addEventListener('keydown', function (e) {
            // Keep these off the window listener, or a hardware keyboard on a
            // tablet would type every letter twice.
            e.stopPropagation();
            if (e.key === 'Enter' || e.keyCode === 13) { e.preventDefault(); RR.Input.latch.Enter = true; }
            else if (e.key === 'Backspace' || e.keyCode === 8) { if (!inp.value) { e.preventDefault(); push('\b'); } }
        });
        inp.addEventListener('beforeinput', function (e) {
            if (e.inputType === 'deleteContentBackward' && !inp.value) push('\b');
        });
        inp.addEventListener('input', function () {
            var v = inp.value, i;
            for (i = 0; i < v.length; i++) push(v.charAt(i));
            inp.value = '';
        });
        document.body.appendChild(inp);
        return inp;
    },

    // ---- full screen, sideways -------------------------------------------
    _container: function () {
        if (this._box) return this._box;
        var c = document.getElementById('glCanvas');
        this._box = c ? c.parentElement : null;
        return this._box;
    },

    _setupDom: function () {
        var box = this._container();
        if (!box) return;
        box.classList.add('rr-touchbox');
        this._input = this._makeInput();

        var css = document.createElement('style');
        css.textContent = [
            '.rr-touchbox { touch-action: none; -webkit-user-select: none; user-select: none; -webkit-touch-callout: none; }',
            'html.rr-playing, html.rr-playing body { overflow: hidden !important; height: 100% !important; }',
            'html.rr-playing .rr-touchbox { position: fixed !important; left: 0; top: 0; right: 0; bottom: 0;',
            '  width: 100vw !important; height: 100vh !important; height: 100dvh !important; max-width: none !important;',
            '  margin: 0 !important; border-radius: 0 !important; aspect-ratio: auto !important; z-index: 10000; background: #05080b; }',
            'html.rr-playing .rr-touchbox canvas { width: 100% !important; height: 100% !important; object-fit: contain; }',
            '.rr-x { display: none; position: absolute; left: max(8px, env(safe-area-inset-left)); top: 8px; z-index: 10002;',
            '  width: 58px; height: 58px; padding: 0; border-radius: 12px; border: 2px solid rgba(255,255,255,0.75);',
            '  background: rgba(8,14,20,0.7); color: #fff; font: 600 22px/1 Inter, Arial, sans-serif; }',
            '.rr-x small { display: block; margin-top: 3px; font: 700 11px/1 Inter, Arial, sans-serif; letter-spacing: .08em; }',
            'html.rr-playing .rr-x { display: block; }',
            '.rr-rotate { display: none; position: absolute; inset: 0; z-index: 10001; background: #05080b; color: #fff;',
            '  align-items: center; justify-content: center; flex-direction: column; gap: 14px; text-align: center;',
            '  font: 600 18px Inter, Arial, sans-serif; letter-spacing: .04em; padding: 24px; }',
            '.rr-rotate span { font-size: 54px; line-height: 1; }',
            '@media (orientation: portrait) { html.rr-playing .rr-rotate { display: flex; } }'
        ].join('\n');
        document.head.appendChild(css);

        var x = document.createElement('button');
        x.className = 'rr-x';
        x.setAttribute('aria-label', 'Leave full screen');
        x.setAttribute('data-rr-ui', '1');
        x.innerHTML = '✕<small>EXIT</small>';
        var self = this;
        x.addEventListener('click', function (e) { e.stopPropagation(); self._exitPlaying(); });
        x.addEventListener('touchend', function (e) { e.preventDefault(); e.stopPropagation(); self._exitPlaying(); });
        box.appendChild(x);

        var rot = document.createElement('div');
        rot.className = 'rr-rotate';
        rot.innerHTML = '<span>↻</span>Turn your phone sideways to play';
        box.appendChild(rot);
    },

    _enterPlaying: function () {
        var root = document.documentElement;
        if (root.classList.contains('rr-playing')) return;
        root.classList.add('rr-playing');
        window.scrollTo(0, 0);
        if (RR.Audio && RR.Audio.setAway) RR.Audio.setAway(false);
        // Real full screen where the browser allows it (Android); the CSS above
        // already fills the screen everywhere else (iPhone Safari has no
        // element full screen).
        var box = this._container();
        try {
            var req = box && (box.requestFullscreen || box.webkitRequestFullscreen);
            if (req) {
                var pr = req.call(box);
                if (pr && pr.then) pr.then(function () {
                    try { screen.orientation.lock('landscape').catch(function () {}); } catch (e) {}
                }).catch(function () {});
            }
        } catch (e) {}
    },

    _exitPlaying: function () {
        this._optedOut = true;
        document.documentElement.classList.remove('rr-playing');
        // Back on the website page: the game's sound waits until they return.
        if (RR.Audio && RR.Audio.setAway) RR.Audio.setAway(true);
        try {
            if (document.fullscreenElement && document.exitFullscreen) document.exitFullscreen().catch(function () {});
            else if (document.webkitFullscreenElement && document.webkitExitFullscreen) document.webkitExitFullscreen();
        } catch (e) {}
        if (this._riverLive()) RR.Engine.pushOverlay(RR.PauseScene);
    },

    // A left thumb seen from above, pressing the knob: tip up, nail on top.
    _drawThumb: function (ctx, x, y) {
        ctx.save();
        ctx.translate(x + 4, y + 6);
        ctx.rotate(0.35);              // a left thumb leans in from the left
        ctx.fillStyle = '#f1c7a3';
        ctx.strokeStyle = 'rgba(60,35,20,0.75)';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(-15, 34);
        ctx.lineTo(-15, -12);
        ctx.arc(0, -12, 15, Math.PI, 0);
        ctx.lineTo(15, 34);
        ctx.fill(); ctx.stroke();
        ctx.fillStyle = '#fbe3d1';     // nail
        ctx.beginPath();
        ctx.ellipse(0, -14, 8.5, 10, 0, 0, Math.PI * 2);
        ctx.fill(); ctx.stroke();
        ctx.strokeStyle = 'rgba(60,35,20,0.45)';  // knuckle crease
        ctx.beginPath(); ctx.moveTo(-10, 12); ctx.quadraticCurveTo(0, 16, 10, 12); ctx.stroke();
        ctx.restore();
    },

    // Tilt mode: a little phone that turns with the boat's steering, so the
    // player sees the game reading the tilt. Says how until they've steered.
    _drawTiltHint: function (ctx) {
        var x = this.STEER_PAD.x, y = this.STEER_PAD.y + 20;
        var demo = !this._steeredThisRun;
        var a = demo ? Math.sin(this._hintT * 2.4) * 0.38 : this.steer * 0.42;
        ctx.save();
        ctx.translate(x, y);
        ctx.rotate(a);
        ctx.fillStyle = 'rgba(8,14,20,0.60)';
        ctx.strokeStyle = 'rgba(255,255,255,0.90)';
        ctx.lineWidth = 3;
        ctx.beginPath();
        if (ctx.roundRect) ctx.roundRect(-62, -32, 124, 64, 12); else ctx.rect(-62, -32, 124, 64);
        ctx.fill(); ctx.stroke();
        ctx.fillStyle = 'rgba(27,117,187,0.70)';
        ctx.fillRect(-50, -22, 100, 44);
        ctx.restore();
        // curved arrows either side
        ctx.strokeStyle = 'rgba(255,255,255,0.75)'; ctx.lineWidth = 3;
        ctx.beginPath(); ctx.arc(x, y, 92, Math.PI * 1.08, Math.PI * 1.32); ctx.stroke();
        ctx.beginPath(); ctx.arc(x, y, 92, Math.PI * 1.68, Math.PI * 1.92); ctx.stroke();
        ctx.fillStyle = '#fff';
        ctx.font = '700 17px ' + RR.Config.FONT_UI;
        if (demo) ctx.fillText('TILT THE PHONE TO STEER', x, y - 112);
    },

    // ---- the river HUD -----------------------------------------------------
    drawHUD: function (ctx) {
        if (!this.active || !this._riverLive()) return;
        var boat = RR.Boat;
        ctx.save();
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';

        // Steering. While a thumb is down the stick follows it; otherwise a
        // STEER pad with a thumb sits bottom-left so a first-timer sees where
        // the left thumb goes. Until they've steered this run the thumb rocks
        // side to side as a little how-to.
        var S = this.STEER_PAD, R = this.STICK_RANGE;
        if (this.tilting) this._drawTiltHint(ctx);
        else {
        var cx, cy, knobX;
        if (this.steering) {
            cx = this._steerX0; cy = this._steerY0;
            knobX = cx + this.steer * R;
        } else {
            cx = S.x; cy = S.y;
            knobX = this._steeredThisRun ? cx : cx + Math.sin(this._hintT * 3.2) * R * 0.55;
        }
        // track
        ctx.fillStyle = 'rgba(8,14,20,0.40)';
        ctx.strokeStyle = 'rgba(223,227,230,0.70)';
        ctx.lineWidth = 3;
        ctx.beginPath(); ctx.arc(cx, cy, R, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
        // left / right arrows
        ctx.fillStyle = 'rgba(255,255,255,0.80)';
        [-1, 1].forEach(function (d) {
            var ax = cx + d * (R - 22);
            ctx.beginPath();
            ctx.moveTo(ax + d * 12, cy);
            ctx.lineTo(ax - d * 6, cy - 14);
            ctx.lineTo(ax - d * 6, cy + 14);
            ctx.closePath(); ctx.fill();
        });
        // knob
        ctx.fillStyle = this.steering ? 'rgba(27,117,187,0.85)' : 'rgba(27,117,187,0.60)';
        ctx.beginPath(); ctx.arc(knobX, cy, 42, 0, Math.PI * 2); ctx.fill();
        ctx.strokeStyle = 'rgba(255,255,255,0.85)'; ctx.lineWidth = 3; ctx.stroke();
        if (!this.steering) this._drawThumb(ctx, knobX, cy);
        // label
        ctx.fillStyle = '#fff';
        ctx.font = '700 17px ' + RR.Config.FONT_UI;
        ctx.fillText(this._steeredThisRun || this.steering ? 'STEER' : 'LEFT THUMB · SLIDE TO STEER',
            cx, cy - R - 16);
        }

        function btn(b, label, on, dim) {
            ctx.fillStyle = on ? 'rgba(27,117,187,0.75)' : (dim ? 'rgba(8,14,20,0.30)' : 'rgba(8,14,20,0.50)');
            ctx.beginPath(); ctx.arc(b.x, b.y, b.r, 0, Math.PI * 2); ctx.fill();
            ctx.strokeStyle = dim ? 'rgba(223,227,230,0.25)' : 'rgba(223,227,230,0.70)';
            ctx.lineWidth = 3; ctx.stroke();
            ctx.fillStyle = dim ? 'rgba(255,255,255,0.45)' : '#fff';
            ctx.font = '700 ' + Math.round(b.r * 0.34) + 'px ' + RR.Config.FONT_UI;
            ctx.fillText(label, b.x, b.y + 1);
        }
        btn(this.JUMP, 'JUMP', this._jumpId !== null, boat && boat.jumpCooldown > 0);
        btn(this.REVERSE, 'REVERSE', this.reverse, false);

        // Tilt / thumb switch
        var T = this.TILT_BTN;
        ctx.fillStyle = this.tiltOn ? 'rgba(27,117,187,0.75)' : 'rgba(8,14,20,0.50)';
        ctx.beginPath(); ctx.arc(T.x, T.y, T.r, 0, Math.PI * 2); ctx.fill();
        ctx.strokeStyle = 'rgba(223,227,230,0.70)'; ctx.lineWidth = 2; ctx.stroke();
        ctx.fillStyle = '#fff';
        ctx.font = '700 12px ' + RR.Config.FONT_UI;
        ctx.fillText(this.tiltOn ? 'TILT' : 'THUMB', T.x, T.y + 1);

        // Pause
        var P = this.PAUSE;
        ctx.fillStyle = 'rgba(8,14,20,0.50)';
        ctx.beginPath(); ctx.arc(P.x, P.y, P.r, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = '#fff';
        ctx.fillRect(P.x - 10, P.y - 12, 7, 24);
        ctx.fillRect(P.x + 3, P.y - 12, 7, 24);
        ctx.restore();
    }
};

RR.Touch.init();
