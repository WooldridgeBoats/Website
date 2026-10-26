window.RR = window.RR || {};

RR.Input = {
    keys: {},
    prev: {},
    // Presses that arrived since the last frame. Without this a tap whose
    // keydown AND keyup both land between two frames is lost completely: keys
    // goes true then false again before scene.update() ever looks at it, so
    // justPressed never fires. That's why ENTER sometimes didn't start the
    // game -- and it gets much worse whenever the frame rate drops, because
    // the window for losing a press grows with the frame interval.
    latch: {},
    // Characters typed since the last frame, for the name-entry screen.
    // e.code is physical-key and layout-dependent; e.key is the character the
    // player actually meant. '\b' marks a backspace. Drained in update().
    typed: [],

    // Mouse position in CANVAS space (0..1280, 0..720) -- not page pixels.
    // -1 means the pointer is not over the picture.
    mouseX: -1,
    mouseY: -1,
    inside: false,
    // True only on frames where the pointer actually moved. Menus use it to
    // decide whether the mouse or the keyboard owns the highlight, so resting
    // the cursor over a row does not fight the arrow keys.
    moved: false,
    // An EDGE, cleared every frame in update() exactly like latch. It used to
    // persist until some scene happened to consume it, which is the bug that
    // made the menus feel haunted -- see update().
    clicked: false,

    // --- Held-key repeat, for menus only ---------------------------------
    // A menu that answers a held arrow key exactly once and then sits there
    // reads as a dropped input. After REPEAT_DELAY the held key re-arms the
    // latch every REPEAT_INTERVAL so navigation scrolls the way every other
    // menu on the machine does.
    //
    // Space and Enter are deliberately NOT in this list: repeating them would
    // machine-gun scene changes. Gameplay is unaffected either way -- the boat
    // reads WASD with isDown() and jumps on justPressed('Space').
    REPEATABLE: ['KeyW', 'KeyS', 'KeyA', 'KeyD', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'],
    REPEAT_DELAY: 0.40,
    REPEAT_INTERVAL: 0.09,
    _held: null,
    _heldFor: 0,
    _nextRepeat: 0,

    init: function () {
        var self = this;
        window.addEventListener('keydown', function (e) {
            // e.repeat filters out auto-repeat, so holding a key still only
            // counts as one press -- we do our own repeat, above, and only
            // for the keys that should have it.
            if (!e.repeat) {
                self.latch[e.code] = true;
                if (self.REPEATABLE.indexOf(e.code) !== -1) {
                    self._held = e.code;
                    self._heldFor = 0;
                    self._nextRepeat = self.REPEAT_DELAY;
                }
            }
            self.keys[e.code] = true;
            if (e.key && e.key.length === 1) self.typed.push(e.key);
            else if (e.code === 'Backspace') self.typed.push('\b');
            if (['KeyW', 'KeyA', 'KeyS', 'KeyD', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space', 'Escape', 'Enter', 'Backspace'].indexOf(e.code) !== -1) {
                e.preventDefault();
            }
        });
        window.addEventListener('keyup', function (e) {
            self.keys[e.code] = false;
            if (self._held === e.code) self._held = null;
        });
        // Avoid a stuck throttle or helm if the player tabs away mid-press.
        window.addEventListener('blur', function () {
            self.keys = {};
            self.latch = {};
            self.typed.length = 0;
            self._held = null;
            self.clicked = false;
        });
        document.addEventListener('mousemove', function (e) {
            var p = self.toCanvas(e.clientX, e.clientY);
            self.inside = !!p;
            self.moved = true;
            self.mouseX = p ? p.x : -1;
            self.mouseY = p ? p.y : -1;
        });
        document.addEventListener('mouseleave', function () {
            self.inside = false;
            self.mouseX = -1;
            self.mouseY = -1;
        });
        document.addEventListener('click', function (e) {
            var p = self.toCanvas(e.clientX, e.clientY);
            // A click in the letterbox bars, or anywhere else on the page, is
            // not a click on the game. It used to be scaled into range anyway
            // and could start a river run from the black margin.
            if (!p) return;
            self.mouseX = p.x;
            self.mouseY = p.y;
            self.inside = true;
            self.clicked = true;
        });
    },

    // Page coordinates -> canvas coordinates.
    //
    // The canvas element is `width:100vw; max-height:100vh; aspect-ratio:16/9;
    // object-fit:contain`. In any window WIDER than 16:9 -- which is most
    // browser windows, because the toolbar eats height -- max-height wins, the
    // element box goes wider than 16:9, and the picture is drawn centred
    // inside it with bars either side. Scaling by the element rect alone
    // ignored those bars and threw every click sideways: on a 1400x700 window
    // the error reached 68px at the edges, and on a wide monitor over 200px.
    // That is why menu rows sometimes did the wrong thing, or nothing.
    toCanvas: function (clientX, clientY) {
        var canvas = document.getElementById('glCanvas');
        if (!canvas) return null;
        var rect = canvas.getBoundingClientRect();
        if (!rect.width || !rect.height) return null;

        var cw = RR.Config.CANVAS_WIDTH, ch = RR.Config.CANVAS_HEIGHT;
        var scale = Math.min(rect.width / cw, rect.height / ch);   // == contain
        var offX = rect.left + (rect.width - cw * scale) / 2;
        var offY = rect.top + (rect.height - ch * scale) / 2;

        var x = (clientX - offX) / scale;
        var y = (clientY - offY) / scale;
        if (x < 0 || y < 0 || x > cw || y > ch) return null;
        return { x: x, y: y };
    },

    isDown: function (code) {
        return this.keys[code] || false;
    },

    justPressed: function (code) {
        if (this.latch[code]) return true;
        return (this.keys[code] || false) && !(this.prev[code] || false);
    },

    // Drop every pending edge without touching what is physically held down.
    // Called on any scene or overlay change so the keypress or click that left
    // one screen cannot also act on the next one.
    flushEdges: function () {
        var k;
        this.latch = {};
        this.typed.length = 0;
        this.clicked = false;
        this.moved = false;
        this._held = null;
        this.prev = {};
        for (k in this.keys) this.prev[k] = this.keys[k];
    },

    update: function (dt) {
        var k;
        this.prev = {};
        for (k in this.keys) {
            this.prev[k] = this.keys[k];
        }
        this.latch = {};
        this.typed.length = 0;
        // A click is an edge, the same as a key press. Before this line it
        // persisted until some scene happened to read it, so a click made
        // during a run was still sitting there when the player crashed: the
        // crash screen dismissed itself after its 0.5s gate, the 9.6s launch
        // cinematic skipped on its first frame, and a click on HOW TO PLAY
        // started a river run the moment you pressed ESC back to the menu.
        this.clicked = false;
        this.moved = false;
        this.tickRepeat(dt || 0);
    },

    tickRepeat: function (dt) {
        if (!this._held || !this.keys[this._held]) { this._held = null; return; }
        this._heldFor += dt;
        if (this._heldFor >= this._nextRepeat) {
            this._nextRepeat = this._heldFor + this.REPEAT_INTERVAL;
            // Re-arm the latch so the coming frame reads it as a fresh press.
            this.latch[this._held] = true;
        }
    }
};

RR.Engine = {
    canvas: null,
    ctx: null,
    scene: null,
    overlay: null,
    lastTime: 0,
    running: false,
    totalTime: 0,
    faults: 0,

    // Scenes are full-screen, so a hard cut between two of them is
    // indistinguishable from a dropped frame. A short dip up out of black on
    // arrival is enough to read as a deliberate change.
    FADE: 0.18,
    fade: 0,

    init: function () {
        this.canvas = document.getElementById('gameCanvas');
        this.canvas.width = RR.Config.CANVAS_WIDTH;
        this.canvas.height = RR.Config.CANVAS_HEIGHT;
        this.ctx = this.canvas.getContext('2d');
        this.ctx.imageSmoothingEnabled = true;

        RR.Input.init();
        RR.Audio.init();
        RR.Renderer3D.init();

        this.running = true;
        this.lastTime = performance.now();
        this.totalTime = 0;
        var self = this;
        requestAnimationFrame(function (t) { self.loop(t); });
    },

    changeScene: function (newScene) {
        if (this.scene && this.scene.exit) this.scene.exit();
        this.overlay = null;
        this.scene = newScene;
        RR.Input.flushEdges();
        this.fade = this.FADE;
        if (this.scene && this.scene.enter) this.scene.enter();
    },

    pushOverlay: function (ov) {
        this.overlay = ov;
        RR.Input.flushEdges();
        if (ov && ov.enter) ov.enter();
    },

    popOverlay: function () {
        if (this.overlay && this.overlay.exit) this.overlay.exit();
        this.overlay = null;
        RR.Input.flushEdges();
    },

    loop: function (timestamp) {
        if (!this.running) return;

        var dt = Math.min((timestamp - this.lastTime) / 1000, 0.05);
        this.lastTime = timestamp;
        this.totalTime += dt;

        // One bad frame must never end the game. Everything below used to run
        // inline, ahead of the requestAnimationFrame at the bottom, so any
        // exception stopped the loop for good -- a frozen picture that only a
        // page reload recovered. Unpausing did exactly that, every single time
        // (see step(), overlay branch).
        try {
            this.step(dt);
        } catch (err) {
            this.faults++;
            if (this.faults <= 5 && window.console && console.error) {
                console.error('River Ripper: frame ' + this.faults + ' faulted, continuing.', err);
            }
        }

        RR.Input.update(dt);
        var self = this;
        requestAnimationFrame(function (t) { self.loop(t); });
    },

    step: function (dt) {
        this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);

        var ov = this.overlay;
        if (ov) {
            ov.update(dt);
            if (this.scene) {
                if (this.scene.render3D) {
                    this.scene.render3D(dt);
                }
                this.scene.render(this.ctx);
            }
            // ov.update() may have popped itself -- ESC or ENTER to resume, Q
            // to quit to the menu. Calling render on the popped overlay threw
            // "Cannot read properties of null" and took the loop down with it,
            // so every pause was a one-way trip.
            if (this.overlay === ov) ov.render(this.ctx);
        } else if (this.scene) {
            this.scene.update(dt);
            if (this.scene.render3D) {
                this.scene.render3D(dt);
            }
            this.scene.render(this.ctx);
            // scene.update() may have pushed an overlay (ESC -> pause). Draw
            // it now rather than a frame late, or the pause screen visibly
            // trails the key that asked for it.
            if (this.overlay && this.overlay.render) this.overlay.render(this.ctx);
        }

        this.renderTransition(dt);
    },

    renderTransition: function (dt) {
        if (this.fade <= 0) return;
        this.fade = Math.max(0, this.fade - dt);
        var a = this.fade / this.FADE;
        this.ctx.save();
        this.ctx.globalAlpha = a;
        this.ctx.fillStyle = RR.Config.WB_DEEP;
        this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
        this.ctx.restore();
    }
};
