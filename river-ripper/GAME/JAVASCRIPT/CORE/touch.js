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
//           throttle    : ON by itself (arcade style); BRAKE holds it off
//           right thumb : JUMP and BRAKE buttons, PAUSE up top
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
    brake: false,
    _steerId: null, _steerX0: 0, _steerY0: 0, _steerX: 0, _steerY: 0,
    _brakeId: null, _jumpId: null,
    _taps: {},
    _drove: false,
    _input: null,
    _box: null,

    // Canvas-space layout of the river buttons (the game draws at 1280x720).
    JUMP:  { x: 1148, y: 560, r: 78 },
    BRAKE: { x: 978,  y: 618, r: 58 },
    PAUSE: { x: 1224, y: 124, r: 34 },
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
                if (this._hit(p, this.JUMP)) { RR.Input.latch.Space = true; this._jumpId = t.identifier; continue; }
                if (this._hit(p, this.BRAKE)) { this.brake = true; this._brakeId = t.identifier; continue; }
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
        for (i = 0; i < e.changedTouches.length; i++) {
            t = e.changedTouches[i];
            if (t.identifier === this._steerId) {
                this._steerId = null; this.steering = false; this.steer = 0;
            }
            if (t.identifier === this._brakeId) { this._brakeId = null; this.brake = false; }
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
            RR.Input.keys.KeyW = !this.brake;
            RR.Input.keys.KeyS = this.brake;
            this._drove = true;
        } else if (this._drove) {
            RR.Input.keys.KeyW = false;
            RR.Input.keys.KeyS = false;
            this._drove = false;
            this.brake = false; this._brakeId = null;
            this.steering = false; this.steer = 0; this._steerId = null;
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
            '.rr-x { display: none; position: absolute; left: 10px; top: 10px; z-index: 10002; width: 44px; height: 44px;',
            '  border-radius: 22px; border: 0; background: rgba(8,14,20,0.6); color: #fff; font: 600 22px/44px Inter, Arial, sans-serif; }',
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
        x.textContent = '✕';
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
        document.documentElement.classList.remove('rr-playing');
        try {
            if (document.fullscreenElement && document.exitFullscreen) document.exitFullscreen().catch(function () {});
            else if (document.webkitFullscreenElement && document.webkitExitFullscreen) document.webkitExitFullscreen();
        } catch (e) {}
        if (this._riverLive()) RR.Engine.pushOverlay(RR.PauseScene);
    },

    // ---- the river HUD -----------------------------------------------------
    drawHUD: function (ctx) {
        if (!this.active || !this._riverLive()) return;
        var boat = RR.Boat;
        ctx.save();
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';

        // Stick
        if (this.steering) {
            ctx.strokeStyle = 'rgba(223,227,230,0.45)';
            ctx.lineWidth = 3;
            ctx.beginPath(); ctx.arc(this._steerX0, this._steerY0, this.STICK_RANGE, 0, Math.PI * 2); ctx.stroke();
            ctx.fillStyle = 'rgba(27,117,187,0.55)';
            ctx.beginPath();
            ctx.arc(this._steerX0 + this.steer * this.STICK_RANGE, this._steerY0, 40, 0, Math.PI * 2);
            ctx.fill();
        } else {
            ctx.fillStyle = 'rgba(223,227,230,0.30)';
            ctx.font = '600 15px ' + RR.Config.FONT_UI;
            ctx.fillText('◀  SLIDE TO STEER  ▶', 250, 600);
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
        btn(this.BRAKE, 'BRAKE', this.brake, false);

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
