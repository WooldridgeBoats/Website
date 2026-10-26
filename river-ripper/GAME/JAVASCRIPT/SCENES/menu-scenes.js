window.RR = window.RR || {};

// ---------------------------------------------------------------------------
// RR.UI -- shared drawing helpers for the house style.
//
// Everything here mirrors dev.wooldridgeboats.com: Rockwell slab for display
// type, Inter for UI, uppercase and letter-spaced for anything small, and the
// brand blue #1B75BB for accents. Canvas has no letter-spacing of its own that
// we can rely on, so tracked text is laid out a glyph at a time.
// ---------------------------------------------------------------------------
RR.UI = {
    // Centred (or left-aligned) text with real letter-spacing.
    tracked: function (ctx, text, x, y, tracking, align) {
        var i, ch, total = 0;
        var widths = [];
        for (i = 0; i < text.length; i++) {
            widths[i] = ctx.measureText(text[i]).width;
            total += widths[i];
        }
        total += tracking * Math.max(0, text.length - 1);

        var cx = x;
        if (align === 'center' || align === undefined) cx = x - total / 2;
        else if (align === 'right') cx = x - total;

        var prevAlign = ctx.textAlign;
        ctx.textAlign = 'left';
        for (i = 0; i < text.length; i++) {
            ch = text[i];
            ctx.fillText(ch, cx, y);
            cx += widths[i] + tracking;
        }
        ctx.textAlign = prevAlign;
        return total;
    },

    trackedWidth: function (ctx, text, tracking) {
        var i, total = 0;
        for (i = 0; i < text.length; i++) total += ctx.measureText(text[i]).width;
        return total + tracking * Math.max(0, text.length - 1);
    },

    // Rounded rectangle -- the shape of the site's BUILD & PRICE button.
    pill: function (ctx, x, y, w, h, r) {
        ctx.beginPath();
        ctx.moveTo(x + r, y);
        ctx.lineTo(x + w - r, y);
        ctx.quadraticCurveTo(x + w, y, x + w, y + r);
        ctx.lineTo(x + w, y + h - r);
        ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
        ctx.lineTo(x + r, y + h);
        ctx.quadraticCurveTo(x, y + h, x, y + h - r);
        ctx.lineTo(x, y + r);
        ctx.quadraticCurveTo(x, y, x + r, y);
        ctx.closePath();
    },

    // A slab headline flanked by thin rules -- the site's "NOT FOR PRACTICE"
    // treatment, on a dark ground instead of white.
    headline: function (ctx, text, cx, y, size, color, ruleColor) {
        var C = RR.Config;
        var track = size * 0.045;
        ctx.font = 'bold ' + size + 'px ' + C.FONT_DISPLAY;
        var w = this.trackedWidth(ctx, text, track);

        ctx.save();
        ctx.shadowColor = 'rgba(0,0,0,0.85)';
        ctx.shadowBlur = size * 0.22;
        ctx.shadowOffsetY = 2;
        ctx.fillStyle = color;
        this.tracked(ctx, text, cx, y, track, 'center');
        ctx.restore();

        if (ruleColor) {
            var gap = size * 0.55;
            var ruleLen = size * 1.9;
            var ry = y;
            ctx.strokeStyle = ruleColor;
            ctx.lineWidth = Math.max(2, size * 0.055);
            ctx.beginPath();
            ctx.moveTo(cx - w / 2 - gap - ruleLen, ry);
            ctx.lineTo(cx - w / 2 - gap, ry);
            ctx.moveTo(cx + w / 2 + gap, ry);
            ctx.lineTo(cx + w / 2 + gap + ruleLen, ry);
            ctx.stroke();
        }
    },

    // Small uppercase Inter, the way the site sets nav links and buttons.
    label: function (ctx, text, x, y, size, color, weight, align) {
        var C = RR.Config;
        ctx.font = (weight || 500) + ' ' + size + 'px ' + C.FONT_UI;
        ctx.fillStyle = color;
        return this.tracked(ctx, text, x, y, size * 0.09, align || 'center');
    },

    // The thin brand-blue keyline the site runs across the top of every page.
    topRule: function (ctx, W) {
        ctx.fillStyle = RR.Config.WB_BLUE;
        ctx.fillRect(0, 0, W, 4);
    },

    // The Wooldridge shop at Silver Lake -- the real building, yellow boat on
    // the roof and all -- sat well back behind a heavy scrim so the type still
    // carries. Falls back to the flat gradient until the photo has decoded.
    _shop: null,
    _riverRun: null,
    loadBackdrop: function () {
        if (this._shop) return;
        var img = new Image();
        img.src = 'GAME/ASSETS/UI/BOAT-SHOP.jpg';
        this._shop = img;
    },

    loadRiverRun: function () {
        if (this._riverRun) return;
        var img = new Image();
        // Aerial Wooldridge testing on the actual braided river, used here as
        // product context rather than decoration. This is a downsized runtime
        // copy of ARCHIVES/REFERENCES/RIVER/BOAT-TESTING/BOAT-TESTING-2.png -- kept
        // inside GAME/ so the game has no dependency outside its own folder.
        // Do not swap it for a generic stock image.
        img.src = 'GAME/ASSETS/UI/BOAT-TESTING.jpg';
        this._riverRun = img;
    },

    // Each boat's own hero photo, copied from the dev website's model page
    // (LOCAL-WEBSITE/assets/photos/<model>/hero-*.jpg) at 1200px into
    // GAME/ASSETS/UI/BOATS/. Before 2026-10-26 every boat showed the same
    // aerial testing shot, which read as "the photo is missing" for the boat
    // you picked. Falls back to that testing shot until the photo decodes.
    _boatPhotos: {},
    boatPhoto: function (model) {
        var id = model && model.id;
        if (!id) return null;
        var img = this._boatPhotos[id];
        if (!img) {
            img = new Image();
            img.src = 'GAME/ASSETS/UI/BOATS/BOAT-' + id.toUpperCase() + '.jpg';
            this._boatPhotos[id] = img;
        }
        return img;
    },

    drawCover: function (ctx, img, x, y, w, h) {
        if (!img || !img.complete || !img.naturalWidth) return false;
        var scale = Math.max(w / img.naturalWidth, h / img.naturalHeight);
        var sw = w / scale, sh = h / scale;
        var sx = (img.naturalWidth - sw) * 0.5;
        var sy = (img.naturalHeight - sh) * 0.5;
        ctx.drawImage(img, sx, sy, sw, sh, x, y, w, h);
        return true;
    },

    // Pointer feedback. #gameCanvas is pointer-events:none and #glCanvas sits
    // under it, so the cursor is set on the document rather than on either
    // canvas. Scenes that use it must clear it in exit().
    cursor: function (on) {
        document.body.style.cursor = on ? 'pointer' : '';
    },

    backdrop: function (ctx, W, H) {
        var C = RR.Config;

        var g = ctx.createLinearGradient(0, 0, 0, H);
        g.addColorStop(0, C.WB_DEEP);
        g.addColorStop(0.45, '#122130');
        g.addColorStop(1, '#0A1016');
        ctx.fillStyle = g;
        ctx.fillRect(0, 0, W, H);

        this.loadBackdrop();
        var img = this._shop;
        if (img && img.complete && img.naturalWidth) {
            // cover-fit, anchored a touch high so the roof boat stays in frame
            var scale = Math.max(W / img.naturalWidth, H / img.naturalHeight);
            var dw = img.naturalWidth * scale, dh = img.naturalHeight * scale;
            ctx.save();
            if ('filter' in ctx) ctx.filter = 'grayscale(45%) contrast(1.06)';
            ctx.globalAlpha = 0.5;
            ctx.drawImage(img, (W - dw) / 2, (H - dh) * 0.36, dw, dh);
            ctx.restore();

            // scrim: darkest at the edges, so the middle of the frame reads
            var scrim = ctx.createLinearGradient(0, 0, 0, H);
            scrim.addColorStop(0.00, 'rgba(13,20,26,0.86)');
            scrim.addColorStop(0.38, 'rgba(13,20,26,0.62)');
            scrim.addColorStop(1.00, 'rgba(10,16,22,0.93)');
            ctx.fillStyle = scrim;
            ctx.fillRect(0, 0, W, H);

            // a breath of house blue over the top
            ctx.fillStyle = 'rgba(27,117,187,0.07)';
            ctx.fillRect(0, 0, W, H);
        }
    }
};

RR.TitleScene = {
    time: 0,
    waterOffset: 0,

    enter: function () {
        this.time = 0;
        this.waterOffset = 0;
    },

    update: function (dt) {
        this.time += dt;
        this.waterOffset += dt * 40;
        if (RR.Input.justPressed('Enter') || RR.Input.justPressed('Space') || RR.Input.clicked) {
            RR.Input.clicked = false;
            RR.Engine.changeScene(RR.MenuScene);
        }
    },

    render: function (ctx) {
        var W = RR.Config.CANVAS_WIDTH;
        var H = RR.Config.CANVAS_HEIGHT;
        var C = RR.Config;
        var UI = RR.UI;
        var t = this.time;

        UI.backdrop(ctx, W, H);

        var mtGrad = ctx.createLinearGradient(0, H * 0.3, 0, H * 0.5);
        mtGrad.addColorStop(0, 'rgba(40,55,75,0.6)');
        mtGrad.addColorStop(1, 'rgba(20,30,40,0)');
        ctx.fillStyle = mtGrad;
        ctx.beginPath();
        ctx.moveTo(0, H * 0.48);
        ctx.lineTo(W * 0.1, H * 0.38); ctx.lineTo(W * 0.25, H * 0.43);
        ctx.lineTo(W * 0.4, H * 0.35); ctx.lineTo(W * 0.55, H * 0.42);
        ctx.lineTo(W * 0.7, H * 0.36); ctx.lineTo(W * 0.85, H * 0.40);
        ctx.lineTo(W, H * 0.37); ctx.lineTo(W, H * 0.50);
        ctx.lineTo(0, H * 0.50);
        ctx.fill();

        var waterY = H * 0.52;
        var i, y, alpha;
        for (i = 0; i < 35; i++) {
            y = waterY + i * 5;
            alpha = 0.08 + Math.sin((this.waterOffset + i * 12) * 0.025) * 0.04;
            var depth = i / 35;
            var r = Math.floor(22 + depth * 8);
            var g = Math.floor(48 + depth * 6 - Math.sin(this.waterOffset * 0.01 + i * 0.3) * 8);
            var b = Math.floor(58 + depth * 10);
            ctx.fillStyle = 'rgba(' + r + ',' + g + ',' + b + ',' + (alpha + 0.2) + ')';
            ctx.fillRect(0, y, W, 5);
        }

        for (i = 0; i < 10; i++) {
            var streakX = ((this.waterOffset * 1.5 + i * 110) % (W + 120)) - 60;
            var streakY = waterY + 15 + i * 15;
            ctx.strokeStyle = 'rgba(27,117,187,0.22)';
            ctx.lineWidth = 0.8;
            ctx.beginPath();
            ctx.moveTo(streakX, streakY);
            ctx.quadraticCurveTo(streakX + 20, streakY + Math.sin(t + i) * 2, streakX + 45, streakY + 1);
            ctx.stroke();
        }

        UI.topRule(ctx, W);

        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';

        var titleY = H * 0.24;
        var bounce = Math.sin(t * 2) * 2;

        UI.headline(ctx, 'RIVER RIPPER', W / 2, titleY + bounce, 78, C.WB_WHITE, C.WB_BLUE);
        UI.label(ctx, 'WELDED ALUMINUM JET BOATS · SINCE 1915', W / 2, titleY + 62, 15, C.WB_BLUE, 600);

        var flashAlpha = (Math.sin(t * 3) + 1) * 0.5;
        ctx.globalAlpha = 0.55 + flashAlpha * 0.45;
        UI.label(ctx, (RR.Touch && RR.Touch.phoneClass()) ? 'TAP TO START' : 'PRESS ENTER TO START', W / 2, H * 0.78, 19, C.WB_WHITE, 600);
        ctx.globalAlpha = 1;

        UI.label(ctx, 'SIX REAL WOOLDRIDGE MODELS · HOME WATER + ' +
            (RR.RiverLevels.profiles.length - 1) + ' WORLD RIVERS',
            W / 2, H * 0.89, 12, 'rgba(223,227,230,0.45)', 500);
    }
};

RR.MenuScene = {
    options: ['START RIVER RUN', 'CHOOSE BOAT', 'RIVER', 'DIFFICULTY', 'HOW TO PLAY', 'HIGH SCORES', 'SETTINGS'],
    selected: 0,
    time: 0,
    hot: -1,            // row under the pointer, -1 for none
    _rows: null,

    ROW_TOP: 0.31,
    ROW_SPACING: 46,
    ROW_SIZE: 21,
    ROW_PAD_X: 34,
    ROW_PAD_Y: 15,

    enter: function () {
        this.selected = 0;
        this.time = 0;
        this.hot = -1;
        RR.Audio.playMusic('music_menu');
    },

    exit: function () { RR.UI.cursor(false); },

    // ---- layout -----------------------------------------------------------
    // One layout pass, shared by the hit test and the draw, so the box you can
    // click is always exactly the box you can see. The old hit test compared Y
    // alone against a hand-tuned spacing and ignored X entirely, so a click
    // level with a row but way off to the side still fired it.
    layout: function (ctx) {
        var W = RR.Config.CANVAS_WIDTH, H = RR.Config.CANVAS_HEIGHT;
        var size = this.ROW_SIZE;
        var ph = size + this.ROW_PAD_Y * 2;
        var rows = [], i, label, pw;

        ctx.font = '600 ' + size + 'px ' + RR.Config.FONT_UI;
        for (i = 0; i < this.options.length; i++) {
            label = this.optionLabel(i);
            pw = RR.UI.trackedWidth(ctx, label, size * 0.09) + this.ROW_PAD_X * 2;
            // h is the drawn pill; hh is the hit band. The pill is 51px tall
            // but the rows sit 46px apart, so hit-testing the pill itself
            // would overlap its neighbour by 5px and the seam would select
            // two rows -- the exact bug the old +/-25 hit test had.
            rows.push({
                label: label,
                cy: H * this.ROW_TOP + i * this.ROW_SPACING,
                x: W / 2 - pw / 2,
                y: H * this.ROW_TOP + i * this.ROW_SPACING - ph / 2,
                w: pw,
                h: ph,
                hy: H * this.ROW_TOP + i * this.ROW_SPACING - this.ROW_SPACING / 2,
                hh: this.ROW_SPACING
            });
        }
        this._rows = rows;
        return rows;
    },

    hit: function (rows, x, y) {
        var i, r;
        for (i = 0; i < rows.length; i++) {
            r = rows[i];
            if (x >= r.x && x <= r.x + r.w && y >= r.hy && y < r.hy + r.hh) return i;
        }
        return -1;
    },

    // The x-range of one word inside a row. RR.UI.tracked lays glyphs out one
    // at a time with uniform tracking, so measuring the prefix gives the exact
    // position of any word -- which is how the three DIFFICULTY words and the
    // two RIVER arrows become real targets. They used to be the fixed screen
    // fractions 0.43 and 0.57, which did not line up with the drawn text at
    // all: clicking EASY frequently set MEDIUM, and both arrows cycled forward.
    wordHit: function (ctx, row, word, x) {
        var a = row.label.indexOf(word);
        if (a < 0) return false;
        var size = this.ROW_SIZE, track = size * 0.09, i;
        ctx.font = '600 ' + size + 'px ' + RR.Config.FONT_UI;
        var x0 = RR.Config.CANVAS_WIDTH / 2 - RR.UI.trackedWidth(ctx, row.label, track) / 2;
        for (i = 0; i < a; i++) x0 += ctx.measureText(row.label[i]).width + track;
        var x1 = x0;
        for (i = a; i < a + word.length; i++) x1 += ctx.measureText(row.label[i]).width + track;
        return x >= x0 - 10 && x <= x1 - track + 10;
    },

    // ---- input ------------------------------------------------------------
    update: function (dt) {
        this.time += dt;
        var Input = RR.Input;
        var ctx = RR.Engine.ctx;
        var rows = this.layout(ctx);

        // The highlight follows the pointer, but only on frames where the
        // pointer actually moved -- otherwise a cursor left resting over a row
        // would yank the selection back every time you used the arrow keys.
        var over = Input.inside ? this.hit(rows, Input.mouseX, Input.mouseY) : -1;
        this.hot = over;
        if (Input.moved && over !== -1) this.selected = over;
        RR.UI.cursor(over !== -1);

        if (Input.justPressed('KeyW') || Input.justPressed('ArrowUp')) {
            this.selected = (this.selected - 1 + this.options.length) % this.options.length;
        }
        if (Input.justPressed('KeyS') || Input.justPressed('ArrowDown')) {
            this.selected = (this.selected + 1) % this.options.length;
        }
        if (this.selected === 2 && (Input.justPressed('KeyA') || Input.justPressed('ArrowLeft'))) {
            RR.RiverLevels.select(RR.RiverLevels.selectedIndex - 1);
        }
        if (this.selected === 2 && (Input.justPressed('KeyD') || Input.justPressed('ArrowRight'))) {
            RR.RiverLevels.select(RR.RiverLevels.selectedIndex + 1);
        }
        if (this.selected === 3 && (Input.justPressed('KeyA') || Input.justPressed('ArrowLeft'))) {
            RR.Difficulty.select(RR.Difficulty.selectedIndex - 1);
        }
        if (this.selected === 3 && (Input.justPressed('KeyD') || Input.justPressed('ArrowRight'))) {
            RR.Difficulty.select(RR.Difficulty.selectedIndex + 1);
        }
        if (Input.justPressed('KeyM')) {
            RR.Audio.toggleMute();
        }
        // Back out to the title card. Every other screen answers ESC; the main
        // menu used to swallow it, which reads as the key not working.
        if (Input.justPressed('Escape')) {
            RR.Engine.changeScene(RR.TitleScene);
            return;
        }
        if (Input.justPressed('Enter') || Input.justPressed('Space')) {
            this.selectOption();
            return;
        }
        if (Input.clicked && over !== -1) {
            Input.clicked = false;
            this.selected = over;
            this.activate(ctx, rows[over], over, Input.mouseX);
        }
    },

    // A click carries a position, so a row can act on WHICH part of it was
    // hit. Keyboard ENTER has no position and goes straight to selectOption().
    activate: function (ctx, row, index, x) {
        if (index === 2) {
            if (this.wordHit(ctx, row, '◀', x)) { RR.RiverLevels.select(RR.RiverLevels.selectedIndex - 1); return; }
            RR.RiverLevels.select(RR.RiverLevels.selectedIndex + 1);
            return;
        }
        if (index === 3) {
            if (this.wordHit(ctx, row, 'EASY', x)) { RR.Difficulty.select(0); return; }
            if (this.wordHit(ctx, row, 'MEDIUM', x)) { RR.Difficulty.select(1); return; }
            if (this.wordHit(ctx, row, 'HARD', x)) { RR.Difficulty.select(2); return; }
            RR.Difficulty.select(RR.Difficulty.selectedIndex + 1);
            return;
        }
        this.selectOption();
    },

    selectOption: function () {
        switch (this.selected) {
            case 0:
                RR.Audio.stopMusic();
                RR.Progress.reset();      // start at the river selected on this screen
                RR.Engine.changeScene(RR.LaunchScene);
                break;
            case 1:
                RR.Engine.changeScene(RR.BoatSelectScene);
                break;
            case 2:
                RR.RiverLevels.select(RR.RiverLevels.selectedIndex + 1);
                break;
            case 3:
                RR.Difficulty.select(RR.Difficulty.selectedIndex + 1);
                break;
            case 4:
                RR.Engine.changeScene(RR.HowToPlayScene);
                break;
            case 5:
                RR.Engine.changeScene(RR.HighScoresScene);
                break;
            case 6:
                RR.Audio.toggleMute();
                break;
        }
    },

    optionLabel: function (index) {
        if (index === 2) return 'RIVER · ◀  [ ' + RR.RiverLevels.getSelected().name + ' ]  ▶';
        if (index !== 3) return this.options[index];
        var active = RR.Difficulty.getSelected().label;
        return 'DIFFICULTY · ' + (active === 'EASY' ? '[ EASY ]' : 'EASY') + ' / ' +
            (active === 'MEDIUM' ? '[ MEDIUM ]' : 'MEDIUM') + ' / ' +
            (active === 'HARD' ? '[ HARD ]' : 'HARD');
    },

    render: function (ctx) {
        var W = RR.Config.CANVAS_WIDTH;
        var H = RR.Config.CANVAS_HEIGHT;
        var C = RR.Config;
        var UI = RR.UI;
        var t = this.time;

        UI.backdrop(ctx, W, H);

        ctx.fillStyle = 'rgba(27,117,187,0.04)';
        var wi;
        for (wi = 0; wi < 8; wi++) {
            var wy = H * 0.6 + wi * 20 + Math.sin(t * 0.5 + wi * 0.4) * 4;
            ctx.fillRect(0, wy, W, 8);
        }

        UI.topRule(ctx, W);

        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';

        UI.headline(ctx, 'RIVER RIPPER', W / 2, H * 0.13, 50, C.WB_WHITE, C.WB_BLUE);
        UI.label(ctx, 'WOOLDRIDGE BOATS · SEATTLE, WASHINGTON', W / 2, H * 0.20, 12, C.WB_BLUE, 600);

        var rows = this._rows || this.layout(ctx);
        var i, r, isSelected;
        for (i = 0; i < rows.length; i++) {
            r = rows[i];
            isSelected = (i === this.selected);

            if (isSelected) {
                // The site's primary button: solid brand blue, white uppercase
                // Inter, generous tracking, softly rounded.
                var pulse = 0.9 + Math.sin(t * 4) * 0.1;
                ctx.save();
                ctx.shadowColor = 'rgba(27,117,187,0.55)';
                ctx.shadowBlur = 18;
                ctx.globalAlpha = pulse;
                ctx.fillStyle = C.WB_BLUE;
                UI.pill(ctx, r.x, r.y, r.w, r.h, 6);
                ctx.fill();
                ctx.restore();

                UI.label(ctx, r.label, W / 2, r.cy, this.ROW_SIZE, C.WB_WHITE, 600);
            } else {
                // A row under the pointer but not selected -- only possible
                // when the cursor is resting and the keyboard has moved on --
                // still gets a faint plate so the mouse target is legible.
                if (i === this.hot) {
                    ctx.save();
                    ctx.fillStyle = 'rgba(27,117,187,0.16)';
                    UI.pill(ctx, r.x, r.y, r.w, r.h, 6);
                    ctx.fill();
                    ctx.restore();
                }
                UI.label(ctx, r.label, W / 2, r.cy, 19,
                    i === this.hot ? 'rgba(223,227,230,0.85)' : 'rgba(223,227,230,0.55)', 500);
            }
        }

        var selectedBoat = RR.BoatCatalog.getSelected();
        var selectedRiver = RR.RiverLevels.getSelected();
        UI.label(ctx, 'SELECTED · ' + selectedBoat.model + ' ' + selectedBoat.variant, W / 2, H * 0.77, 13, C.WB_BLUE, 600);
        UI.label(ctx, 'START ON ' + selectedRiver.name + ' · ' + RR.RiverLevels.profiles.length + ' DISTINCT RIVERS', W / 2, H * 0.805, 11, 'rgba(223,227,230,0.50)', 600);
        UI.label(ctx, '← → CHANGES RIVER OR DIFFICULTY WHEN HIGHLIGHTED', W / 2, H * 0.84, 10, 'rgba(223,227,230,0.32)', 500);
        UI.label(ctx, '[M] TOGGLE SOUND · ' + (RR.Audio.muted ? 'OFF' : 'ON'), W / 2, H * 0.875, 12, 'rgba(223,227,230,0.38)', 500);

        RR.Scoring.loadHighScore();
        if (RR.Scoring.highScore > 0) {
            UI.label(ctx, 'HIGH SCORE · ' + RR.Scoring.highScore, W / 2, H * 0.92, 14, C.WB_BLUE, 600);
        }
    }
};

RR.BoatSelectScene = {
    time: 0,
    hot: null,          // 'prev' | 'next' | 'select' | null
    _zones: null,

    enter: function () {
        this.time = 0;
        this.hot = null;
        if (!RR.Audio.currentMusic) RR.Audio.playMusic('music_menu');
        RR.UI.loadRiverRun();
        RR.BoatCatalog.models.forEach(function (m) { RR.UI.boatPhoto(m); });
    },

    exit: function () { RR.UI.cursor(false); },

    // Real, drawn click targets. The old zones were "left 30% of the screen =
    // previous, right 30% = next, and the whole 40% in the middle confirms and
    // leaves" -- so a click anywhere on the boat photo bounced you back to the
    // menu, which is the single most surprising thing on this screen.
    zones: function () {
        var W = RR.Config.CANVAS_WIDTH, H = RR.Config.CANVAS_HEIGHT;
        var py = 132, ph = 470;
        return {
            prev:   { x: 8,      y: H * 0.51 - 46, w: 92, h: 92 },
            next:   { x: W - 100, y: H * 0.51 - 46, w: 92, h: 92 },
            select: { x: W * 0.58, y: py + ph - 105, w: W * 0.32, h: 72 }
        };
    },

    inZone: function (z, x, y) {
        return x >= z.x && x <= z.x + z.w && y >= z.y && y <= z.y + z.h;
    },

    update: function (dt) {
        this.time += dt;
        var Input = RR.Input;
        var z = this.zones();
        this._zones = z;

        this.hot = null;
        if (Input.inside) {
            if (this.inZone(z.prev, Input.mouseX, Input.mouseY)) this.hot = 'prev';
            else if (this.inZone(z.next, Input.mouseX, Input.mouseY)) this.hot = 'next';
            else if (this.inZone(z.select, Input.mouseX, Input.mouseY)) this.hot = 'select';
        }
        RR.UI.cursor(this.hot !== null);

        if (Input.justPressed('KeyA') || Input.justPressed('ArrowLeft') || Input.justPressed('KeyW') || Input.justPressed('ArrowUp')) {
            RR.BoatCatalog.select(RR.BoatCatalog.selectedIndex - 1);
        }
        if (Input.justPressed('KeyD') || Input.justPressed('ArrowRight') || Input.justPressed('KeyS') || Input.justPressed('ArrowDown')) {
            RR.BoatCatalog.select(RR.BoatCatalog.selectedIndex + 1);
        }
        if (Input.justPressed('Escape')) {
            RR.Engine.changeScene(RR.MenuScene);
            return;
        }
        if (Input.justPressed('Enter') || Input.justPressed('Space')) {
            RR.Engine.changeScene(RR.RiverSelectScene);
            return;
        }
        if (Input.clicked && this.hot) {
            Input.clicked = false;
            if (this.hot === 'prev') RR.BoatCatalog.select(RR.BoatCatalog.selectedIndex - 1);
            else if (this.hot === 'next') RR.BoatCatalog.select(RR.BoatCatalog.selectedIndex + 1);
            else RR.Engine.changeScene(RR.RiverSelectScene);
        }
    },

    statBar: function (ctx, label, value, x, y, w) {
        var C = RR.Config;
        RR.UI.label(ctx, label, x, y, 12, 'rgba(223,227,230,0.65)', 500, 'left');
        var bx = x + 145;
        ctx.fillStyle = 'rgba(223,227,230,0.12)';
        ctx.fillRect(bx, y - 5, w, 10);
        for (var i = 0; i < 5; i++) {
            ctx.fillStyle = i < value ? C.WB_BLUE : 'rgba(223,227,230,0.08)';
            ctx.fillRect(bx + i * (w / 5), y - 5, w / 5 - 3, 10);
        }
    },

    render: function (ctx) {
        var W = RR.Config.CANVAS_WIDTH, H = RR.Config.CANVAS_HEIGHT;
        var C = RR.Config, UI = RR.UI;
        var model = RR.BoatCatalog.getSelected();
        var z = this._zones || this.zones();
        UI.backdrop(ctx, W, H);
        UI.topRule(ctx, W);
        ctx.textBaseline = 'middle';
        UI.headline(ctx, 'CHOOSE YOUR WOOLDRIDGE', W / 2, H * 0.09, 38, C.WB_WHITE, C.WB_BLUE);
        UI.label(ctx, 'STEP 1 OF 2 · PICK A BOAT, THEN SELECT YOUR RIVER', W / 2, H * 0.15, 12, C.WB_BLUE, 600);

        var px = 55, py = 132, pw = W - 110, ph = 470;
        ctx.fillStyle = 'rgba(8,14,20,0.92)';
        ctx.fillRect(px, py, pw, ph);
        ctx.strokeStyle = 'rgba(223,227,230,0.18)';
        ctx.strokeRect(px + 0.5, py + 0.5, pw - 1, ph - 1);

        ctx.save();
        ctx.beginPath(); ctx.rect(W * 0.51, py, W * 0.445, ph); ctx.clip();
        if (!UI.drawCover(ctx, UI.boatPhoto(model), W * 0.51, py, W * 0.445, ph)) {
            UI.drawCover(ctx, UI._riverRun, W * 0.51, py, W * 0.445, ph);
        }
        // Narrow feather only -- the old 0.51-0.74 scrim hid the bow of
        // every boat photo.
        var photoScrim = ctx.createLinearGradient(W * 0.51, 0, W * 0.57, 0);
        photoScrim.addColorStop(0, 'rgba(8,14,20,0.9)');
        photoScrim.addColorStop(1, 'rgba(8,14,20,0)');
        ctx.fillStyle = photoScrim; ctx.fillRect(W * 0.51, py, W * 0.445, ph);
        ctx.restore();

        UI.label(ctx, (RR.BoatCatalog.selectedIndex + 1) + ' / ' + RR.BoatCatalog.models.length, 92, 166, 12, C.WB_BLUE, 600, 'left');
        ctx.font = 'bold 34px ' + C.FONT_DISPLAY;
        ctx.fillStyle = C.WB_WHITE; ctx.textAlign = 'left';
        ctx.fillText(model.model, 92, 212);
        UI.label(ctx, model.variant, 92, 246, 12, 'rgba(223,227,230,0.55)', 600, 'left');

        ctx.font = '400 14px ' + C.FONT_UI;
        ctx.fillStyle = 'rgba(223,227,230,0.72)';
        ctx.textAlign = 'left';
        var words = model.character.split(' '), line = '', lines = [], maxWidth = 470;
        for (var wi = 0; wi < words.length; wi++) {
            var test = line + words[wi] + ' ';
            if (ctx.measureText(test).width > maxWidth && line) { lines.push(line); line = words[wi] + ' '; }
            else line = test;
        }
        lines.push(line);
        for (wi = 0; wi < lines.length; wi++) ctx.fillText(lines[wi], 92, 282 + wi * 20);

        // The website's published figures (BOAT-LINEUP.js specRows).
        var specs = RR.BoatCatalog.specRows(model);
        for (var si = 0; si < specs.length; si++) {
            var sy = 338 + si * 29;
            UI.label(ctx, specs[si][0], 92, sy, 11, 'rgba(223,227,230,0.48)', 500, 'left');
            UI.label(ctx, specs[si][1], 330, sy, 13, C.WB_WHITE, 600, 'right');
        }
        if (RR.BoatCatalog.webSpecs) {
            UI.label(ctx, 'SPECS FROM WOOLDRIDGEBOATS.COM', 92, 338 + specs.length * 29 - 4, 9,
                'rgba(27,117,187,0.85)', 600, 'left');
        }

        this.statBar(ctx, 'POWER', model.power, 382, 352, 175);
        this.statBar(ctx, 'SIZE', model.size, 382, 397, 175);
        this.statBar(ctx, 'MANEUVER', model.maneuver, 382, 442, 175);

        // The confirm button, now an actual button you can see and hit.
        ctx.fillStyle = this.hot === 'select' ? 'rgba(27,117,187,0.90)' : 'rgba(8,14,20,0.78)';
        UI.pill(ctx, z.select.x, z.select.y, z.select.w, z.select.h, 6);
        ctx.fill();
        ctx.strokeStyle = this.hot === 'select' ? C.WB_BLUE : 'rgba(223,227,230,0.22)';
        ctx.lineWidth = 2;
        UI.pill(ctx, z.select.x, z.select.y, z.select.w, z.select.h, 6);
        ctx.stroke();
        UI.label(ctx, 'REAL RIVER TESTING · PROJECT REFERENCE FOOTAGE', W * 0.74, z.select.y + 27, 10, C.WB_WHITE, 600);
        UI.label(ctx, 'SELECT RIVER  ·  ENTER', W * 0.74, z.select.y + 53, 12,
            this.hot === 'select' ? C.WB_WHITE : C.WB_BLUE, 600);

        var pulse = 0.55 + Math.sin(this.time * 3) * 0.18;
        UI.label(ctx, '‹', z.prev.x + z.prev.w / 2, z.prev.y + z.prev.h / 2, 44,
            'rgba(255,255,255,' + (this.hot === 'prev' ? 1 : pulse) + ')', 400);
        UI.label(ctx, '›', z.next.x + z.next.w / 2, z.next.y + z.next.h / 2, 44,
            'rgba(255,255,255,' + (this.hot === 'next' ? 1 : pulse) + ')', 400);
        UI.label(ctx, 'USE THE ARROWS TO CHOOSE YOUR BOAT · SELECT RIVER WHEN READY · ESC TO RETURN', W / 2, H * 0.91, 10, 'rgba(223,227,230,0.46)', 500);
    }
};

// ---------------------------------------------------------------------------
// RIVER SELECT -- step two of the guided start flow.
//
// The main menu still exposes river and difficulty for quick changes, but the
// boat picker now leads here instead of dropping a player back at the menu with
// no obvious next step. Pick a river, then the single primary action is PLAY.
// ---------------------------------------------------------------------------
RR.RiverSelectScene = {
    time: 0,
    hot: null,          // 'prev' | 'next' | 'play' | null
    _zones: null,

    enter: function () {
        this.time = 0;
        this.hot = null;
        if (!RR.Audio.currentMusic) RR.Audio.playMusic('music_menu');
    },

    exit: function () { RR.UI.cursor(false); },

    zones: function () {
        var W = RR.Config.CANVAS_WIDTH, H = RR.Config.CANVAS_HEIGHT;
        return {
            prev: { x: 92, y: H * 0.43 - 48, w: 96, h: 96 },
            next: { x: W - 188, y: H * 0.43 - 48, w: 96, h: 96 },
            play: { x: W / 2 - 210, y: H * 0.69, w: 420, h: 68 }
        };
    },

    inZone: function (z, x, y) {
        return x >= z.x && x <= z.x + z.w && y >= z.y && y <= z.y + z.h;
    },

    startRun: function () {
        RR.Audio.stopMusic();
        RR.Progress.reset();
        RR.Engine.changeScene(RR.LaunchScene);
    },

    update: function (dt) {
        this.time += dt;
        var Input = RR.Input;
        var z = this.zones();
        this._zones = z;

        this.hot = null;
        if (Input.inside) {
            if (this.inZone(z.prev, Input.mouseX, Input.mouseY)) this.hot = 'prev';
            else if (this.inZone(z.next, Input.mouseX, Input.mouseY)) this.hot = 'next';
            else if (this.inZone(z.play, Input.mouseX, Input.mouseY)) this.hot = 'play';
        }
        RR.UI.cursor(this.hot !== null);

        if (Input.justPressed('KeyA') || Input.justPressed('ArrowLeft') ||
                Input.justPressed('KeyW') || Input.justPressed('ArrowUp')) {
            RR.RiverLevels.select(RR.RiverLevels.selectedIndex - 1);
        }
        if (Input.justPressed('KeyD') || Input.justPressed('ArrowRight') ||
                Input.justPressed('KeyS') || Input.justPressed('ArrowDown')) {
            RR.RiverLevels.select(RR.RiverLevels.selectedIndex + 1);
        }
        if (Input.justPressed('Escape')) {
            RR.Engine.changeScene(RR.BoatSelectScene);
            return;
        }
        if (Input.justPressed('Enter') || Input.justPressed('Space')) {
            this.startRun();
            return;
        }
        if (Input.clicked && this.hot) {
            Input.clicked = false;
            if (this.hot === 'prev') RR.RiverLevels.select(RR.RiverLevels.selectedIndex - 1);
            else if (this.hot === 'next') RR.RiverLevels.select(RR.RiverLevels.selectedIndex + 1);
            else this.startRun();
        }
    },

    render: function (ctx) {
        var W = RR.Config.CANVAS_WIDTH, H = RR.Config.CANVAS_HEIGHT;
        var C = RR.Config, UI = RR.UI;
        var river = RR.RiverLevels.getSelected();
        var boat = RR.BoatCatalog.getSelected();
        var difficulty = RR.Difficulty.getSelected();
        var z = this._zones || this.zones();

        UI.backdrop(ctx, W, H);
        UI.topRule(ctx, W);
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';

        UI.headline(ctx, 'SELECT YOUR RIVER', W / 2, H * 0.105, 42, C.WB_WHITE, C.WB_BLUE);
        UI.label(ctx, 'STEP 2 OF 2 · CHOOSE YOUR WATER, THEN PLAY', W / 2, H * 0.175, 12, C.WB_BLUE, 600);

        var px = 90, py = 150, pw = W - 180, ph = 315;
        ctx.fillStyle = 'rgba(8,14,20,0.90)';
        ctx.fillRect(px, py, pw, ph);
        ctx.strokeStyle = 'rgba(223,227,230,0.18)';
        ctx.strokeRect(px + 0.5, py + 0.5, pw - 1, ph - 1);

        UI.label(ctx, (RR.RiverLevels.selectedIndex + 1) + ' / ' + RR.RiverLevels.profiles.length,
            W / 2, H * 0.255, 12, C.WB_BLUE, 600);
        UI.headline(ctx, river.name, W / 2, H * 0.35, 44, C.WB_WHITE, C.WB_BLUE);
        UI.label(ctx, river.location, W / 2, H * 0.43, 14, C.WB_BLUE, 600);
        UI.label(ctx, river.tagline, W / 2, H * 0.50, 12, 'rgba(223,227,230,0.68)', 500);

        var pulse = 0.58 + Math.sin(this.time * 3) * 0.18;
        UI.label(ctx, '‹', z.prev.x + z.prev.w / 2, z.prev.y + z.prev.h / 2, 54,
            'rgba(255,255,255,' + (this.hot === 'prev' ? 1 : pulse) + ')', 400);
        UI.label(ctx, '›', z.next.x + z.next.w / 2, z.next.y + z.next.h / 2, 54,
            'rgba(255,255,255,' + (this.hot === 'next' ? 1 : pulse) + ')', 400);

        UI.label(ctx, 'YOUR BOAT · ' + boat.model + ' ' + boat.variant,
            W / 2, H * 0.585, 13, C.WB_WHITE, 600);
        UI.label(ctx, 'DIFFICULTY · ' + difficulty.label,
            W / 2, H * 0.625, 11, 'rgba(223,227,230,0.48)', 600);

        ctx.fillStyle = this.hot === 'play' ? 'rgba(27,117,187,0.92)' : C.WB_BLUE;
        UI.pill(ctx, z.play.x, z.play.y, z.play.w, z.play.h, 7);
        ctx.fill();
        if (this.hot === 'play') {
            ctx.save();
            ctx.shadowColor = 'rgba(27,117,187,0.65)';
            ctx.shadowBlur = 18;
            ctx.strokeStyle = C.WB_WHITE;
            ctx.lineWidth = 2;
            UI.pill(ctx, z.play.x, z.play.y, z.play.w, z.play.h, 7);
            ctx.stroke();
            ctx.restore();
        }
        UI.label(ctx, 'PLAY  ·  ENTER', W / 2, z.play.y + z.play.h / 2, 18, C.WB_WHITE, 700);
        UI.label(ctx, '← → TO CHOOSE · ESC TO CHANGE BOAT',
            W / 2, H * 0.91, 11, 'rgba(223,227,230,0.46)', 500);
    }
};

// ---------------------------------------------------------------------------
// NAME ENTRY -- shown when a finished run makes the top ten, and only then.
//
// Two fields: first name, then last name (a full last name since 2026-10-26 --
// Tyler; it was a single initial). ENTER moves on and finally saves;
// ESC skips the whole thing and drops straight to the crash screen with the
// score unrecorded. Skipping must always work, from either field -- a player
// who does not want to be on the board should never be trapped here.
// ---------------------------------------------------------------------------
RR.NameEntryScene = {
    first: '',
    initial: '',
    field: 0,          // 0 = first name, 1 = last name (stored as `initial`)
    time: 0,
    score: 0,
    rank: 0,
    distance: 0,

    // RiverScene hands the run in before switching to this scene.
    prime: function (score, distance, next) {
        this.next = next || RR.CrashScene;
        this.score = Math.floor(score);
        this.distance = distance || 0;
        this.rank = RR.Scores.rankFor(this.score);
        this.first = '';
        this.initial = '';
        this.field = 0;
    },

    enter: function () { this.time = 0; },

    // PHONES (CORE/touch.js calls this from inside the tap, which is the only
    // moment an iPhone lets a page open its keyboard). Tapping a name box
    // opens the keyboard on that field; the on-screen buttons stand in for
    // ENTER and ESC. Returns true when it used the tap.
    touchTap: function (x, y) {
        var W = RR.Config.CANVAS_WIDTH, H = RR.Config.CANVAS_HEIGHT;
        var fw = W * 0.34, fx = W / 2 - fw / 2;
        var by = H * 0.80;
        if (y > by - 28 && y < by + 28) {
            if (x > W / 2 + 20 && x < W / 2 + 240) { RR.Input.latch.Enter = true; RR.Touch.openKeyboard(); return true; }
            if (x > W / 2 - 240 && x < W / 2 - 20) { RR.Input.latch.Escape = true; return true; }
        }
        if (x > fx && x < fx + fw) {
            if (Math.abs(y - H * 0.42) < 30) { this.field = 0; }
            else if (Math.abs(y - H * 0.62) < 30 && RR.Scores.cleanName(this.first)) { this.field = 1; }
        }
        RR.Touch.openKeyboard();
        return true;
    },

    finish: function (save) {
        if (save && RR.Scores.cleanName(this.first)) {
            var run = 'r' + Date.now().toString(36) + Math.floor(Math.random() * 1e6).toString(36);
            RR.Scores.add(this.first, this.initial, this.score, this.distance, run);
            if (this.next === RR.LevelCompleteScene) {
                RR.Progress.runName = { first: this.first, initial: this.initial, run: run };
            }
        }
        RR.Engine.changeScene(this.next || RR.CrashScene);
    },

    update: function (dt) {
        this.time += dt;

        // ESC always skips, from either field.
        if (RR.Input.justPressed('Escape')) { this.finish(false); return; }

        var typed = RR.Input.typed, i, ch;
        for (i = 0; i < typed.length; i++) {
            ch = typed[i];
            if (ch === '\b') {
                // Backspace on an empty last name steps back to the first.
                if (this.field === 1 && !this.initial) this.field = 0;
                else if (this.field === 1) this.initial = this.initial.slice(0, -1);
                else this.first = this.first.slice(0, -1);
                continue;
            }
            if (this.field === 0) {
                // Letters and spaces, capped so the board layout holds.
                if (/[A-Za-z ]/.test(ch) && this.first.length < 12) {
                    this.first += ch.toUpperCase();
                }
            } else if (/[A-Za-z' -]/.test(ch) && this.initial.length < 14) {
                this.initial += ch.toUpperCase();
            }
        }

        if (RR.Input.justPressed('Enter')) {
            if (this.field === 0) {
                // Nothing typed yet? ENTER on an empty name skips too.
                if (!RR.Scores.cleanName(this.first)) { this.finish(false); return; }
                this.field = 1;
            } else {
                this.finish(true);
            }
        }
    },

    render: function (ctx) {
        var W = RR.Config.CANVAS_WIDTH, H = RR.Config.CANVAS_HEIGHT;
        var C = RR.Config, UI = RR.UI;
        UI.backdrop(ctx, W, H);
        UI.topRule(ctx, W);
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';

        UI.headline(ctx, 'TOP TEN RUN', W / 2, H * 0.13, 44, C.UI_GOLD, C.WB_BLUE);
        UI.label(ctx, 'YOU PLACED #' + this.rank + ' WITH ' + this.score.toLocaleString(),
            W / 2, H * 0.205, 15, C.WB_WHITE, 600);
        UI.label(ctx, RR.BoatCatalog.getSelected().model + ' · ' +
            (RR.River.profile ? RR.River.profile.name : '') + ' · ' +
            RR.Difficulty.getSelected().label,
            W / 2, H * 0.25, 11, 'rgba(223,227,230,0.5)', 600);

        var caret = (Math.floor(this.time * 2) % 2) === 0;

        // FIRST NAME
        var fy = H * 0.42;
        UI.label(ctx, 'FIRST NAME', W / 2, fy - 44, 12,
            this.field === 0 ? C.WB_BLUE : 'rgba(223,227,230,0.4)', 600);
        var fw = W * 0.34, fx = W / 2 - fw / 2;
        ctx.fillStyle = this.field === 0 ? 'rgba(27,117,187,0.16)' : 'rgba(223,227,230,0.05)';
        UI.pill(ctx, fx, fy - 26, fw, 52, 6); ctx.fill();
        ctx.strokeStyle = this.field === 0 ? C.WB_BLUE : 'rgba(223,227,230,0.16)';
        ctx.lineWidth = 2;
        UI.pill(ctx, fx, fy - 26, fw, 52, 6); ctx.stroke();
        UI.label(ctx, (this.first || (this.field === 0 ? '' : '—')) +
            (this.field === 0 && caret ? '_' : ''), W / 2, fy, 26, C.WB_WHITE, 600);

        // LAST NAME
        var iy = H * 0.62;
        UI.label(ctx, 'LAST NAME', W / 2, iy - 44, 12,
            this.field === 1 ? C.WB_BLUE : 'rgba(223,227,230,0.4)', 600);
        var iw = fw, ix = W / 2 - iw / 2;
        ctx.fillStyle = this.field === 1 ? 'rgba(27,117,187,0.16)' : 'rgba(223,227,230,0.05)';
        UI.pill(ctx, ix, iy - 26, iw, 52, 6); ctx.fill();
        ctx.strokeStyle = this.field === 1 ? C.WB_BLUE : 'rgba(223,227,230,0.16)';
        ctx.lineWidth = 2;
        UI.pill(ctx, ix, iy - 26, iw, 52, 6); ctx.stroke();
        UI.label(ctx, this.initial + (this.field === 1 && caret ? '_' : ''),
            W / 2, iy, 26, C.WB_WHITE, 600);

        if (RR.Touch && RR.Touch.active) {
            // Phone: tap a box to type; buttons for NEXT/SAVE and SKIP.
            var by = H * 0.80;
            var tbtn = function (cx, label, primary) {
                ctx.fillStyle = primary ? 'rgba(27,117,187,0.9)' : 'rgba(223,227,230,0.08)';
                UI.pill(ctx, cx - 110, by - 26, 220, 52, 6); ctx.fill();
                ctx.strokeStyle = primary ? C.WB_BLUE : 'rgba(223,227,230,0.25)'; ctx.lineWidth = 2;
                UI.pill(ctx, cx - 110, by - 26, 220, 52, 6); ctx.stroke();
                UI.label(ctx, label, cx, by, 16, C.WB_WHITE, 700);
            };
            tbtn(W / 2 - 130, 'SKIP', false);
            tbtn(W / 2 + 130, this.field === 0 ? 'NEXT \u203A' : 'SAVE', true);
            UI.label(ctx, 'TAP A BOX TO TYPE', W / 2, H * 0.30, 12, 'rgba(223,227,230,0.55)', 600);
        } else {
            UI.label(ctx, this.field === 0 ? 'TYPE YOUR FIRST NAME · ENTER TO CONTINUE'
                                           : 'TYPE YOUR LAST NAME · ENTER TO SAVE',
                W / 2, H * 0.79, 13, C.WB_WHITE, 600);
            UI.label(ctx, 'ESC — SKIP AND CARRY ON WITHOUT SAVING', W / 2, H * 0.845, 12,
                'rgba(223,227,230,0.45)', 500);
        }
    }
};

RR.HighScoresScene = {
    enter: function () { RR.Scoring.loadHighScore(); RR.Scores.refresh(); RR.Scores.load(); },

    update: function (dt) {
        if (RR.Input.justPressed('Escape') || RR.Input.justPressed('Enter') ||
                RR.Input.justPressed('Space') || RR.Input.clicked) {
            RR.Input.clicked = false;
            RR.Engine.changeScene(RR.MenuScene);
        }
    },

    render: function (ctx) {
        var W = RR.Config.CANVAS_WIDTH, H = RR.Config.CANVAS_HEIGHT;
        var C = RR.Config, UI = RR.UI, S = RR.Scoring;
        UI.backdrop(ctx, W, H);
        UI.topRule(ctx, W);
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        UI.headline(ctx, 'HIGH SCORES', W / 2, H * 0.14, 42, C.WB_WHITE, C.WB_BLUE);

        var list = RR.Scores.load();     // re-read each frame: the shared board lands async
        var x0 = W * 0.13, x1 = W * 0.87, rowH = 40, top = H * 0.235;

        // Column header
        UI.label(ctx, '#', x0 + 18, top, 11, 'rgba(223,227,230,0.4)', 600, 'left');
        UI.label(ctx, 'NAME', x0 + 62, top, 11, 'rgba(223,227,230,0.4)', 600, 'left');
        UI.label(ctx, 'BOAT · RIVER', W * 0.44, top, 11, 'rgba(223,227,230,0.4)', 600, 'left');
        UI.label(ctx, 'SCORE', x1 - 18, top, 11, 'rgba(223,227,230,0.4)', 600, 'right');

        if (!list.length) {
            UI.label(ctx, 'NO RUNS ON THE BOARD YET', W / 2, H * 0.46, 16,
                'rgba(223,227,230,0.45)', 600);
            UI.label(ctx, 'FINISH A RUN AND YOU CAN PUT YOUR NAME UP HERE', W / 2, H * 0.52, 12,
                'rgba(223,227,230,0.32)', 500);
        }

        var i, ry, e;
        for (i = 0; i < list.length; i++) {
            e = list[i];
            ry = top + 26 + i * rowH;
            ctx.fillStyle = i % 2 === 0 ? 'rgba(223,227,230,0.06)' : 'rgba(223,227,230,0.02)';
            ctx.fillRect(x0, ry - 16, x1 - x0, 32);
            ctx.fillStyle = i === 0 ? C.UI_GOLD : C.WB_BLUE;
            ctx.fillRect(x0, ry - 16, 3, 32);

            UI.label(ctx, String(i + 1), x0 + 18, ry, 13,
                i === 0 ? C.UI_GOLD : 'rgba(223,227,230,0.55)', 600, 'left');
            // Full names can run long: shrink the type to fit the column
            // rather than run into BOAT · RIVER.
            var nm = RR.Scores.display(e), nfs = 14;
            var nAvail = W * 0.44 - (x0 + 62) - 14;
            ctx.font = '600 ' + nfs + 'px ' + C.FONT_UI;
            // (+ the 0.09em tracking UI.label adds per letter)
            while (nfs > 10 && ctx.measureText(nm).width + nm.length * nfs * 0.09 > nAvail) {
                nfs--;
                ctx.font = '600 ' + nfs + 'px ' + C.FONT_UI;
            }
            UI.label(ctx, nm, x0 + 62, ry, nfs,
                i === 0 ? C.UI_GOLD : C.WB_WHITE, 600, 'left');

            ctx.font = '400 11px ' + C.FONT_UI;
            ctx.fillStyle = 'rgba(223,227,230,0.45)';
            ctx.textAlign = 'left';
            ctx.fillText((e.boat || '—') + '  ·  ' + (e.river || '—'), W * 0.44, ry);
            ctx.textAlign = 'center';

            UI.label(ctx, e.score.toLocaleString(), x1 - 18, ry, 15,
                i === 0 ? C.UI_GOLD : C.WB_WHITE, 600, 'right');
        }

        UI.label(ctx, RR.Scores.online ? 'TOP TEN · EVERYONE WHO PLAYS AT WOOLDRIDGEBOATS.COM'
                                       : 'TOP TEN ONLY · SAVED IN THIS BROWSER', W / 2, H * 0.845, 11,
            'rgba(223,227,230,0.38)', 500);
        UI.label(ctx, 'PRESS ENTER OR ESC TO RETURN', W / 2, H * 0.90, 12,
            'rgba(223,227,230,0.4)', 500);
    }
};

RR.HowToPlayScene = {
    enter: function () {},

    update: function (dt) {
        // A click has to be consumed here as well as on the keyboard screens.
        // While this scene ignored RR.Input.clicked the flag simply sat there,
        // and pressing ESC back to the menu started a river run on the first
        // frame -- the click you made on this screen arriving on the next one.
        if (RR.Input.justPressed('Escape') || RR.Input.justPressed('Enter') ||
                RR.Input.justPressed('Space') || RR.Input.clicked) {
            RR.Input.clicked = false;
            RR.Engine.changeScene(RR.MenuScene);
        }
    },

    render: function (ctx) {
        var W = RR.Config.CANVAS_WIDTH;
        var H = RR.Config.CANVAS_HEIGHT;
        var C = RR.Config;
        var UI = RR.UI;

        UI.backdrop(ctx, W, H);
        UI.topRule(ctx, W);

        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';

        UI.headline(ctx, 'HOW TO PLAY', W / 2, H * 0.10, 38, C.WB_WHITE, C.WB_BLUE);

        // ARROWS FIRST (Tyler, 2026-10-26: easier for most people). W A S D
        // are exact aliases -- same keys in boat.js -- so they're listed as
        // the alternative. Phones get their own list.
        var touch = RR.Touch && RR.Touch.active;
        var controls = touch ? [
            ['LEFT THUMB', 'Touch the left side and slide — the boat steers where you slide'],
            ['THROTTLE', 'Runs by itself — you just steer'],
            ['BRAKE', 'Hold to slow down'],
            ['JUMP', 'Jump logs and rocks'],
            ['II', 'Pause the game'],
            ['✕', 'Leave full screen and go back to the website']
        ] : [
            ['↑   (or W)', 'Throttle — more speed gives you more steering'],
            ['← →   (or A D)', 'Steer the boat'],
            ['↓   (or S)', 'Slow down / brake'],
            ['SPACE', 'Jump logs and rocks'],
            ['ESC', 'Pause the game'],
            ['M', 'Sound on / off']
        ];

        var startY = H * 0.21;
        var i;
        for (i = 0; i < controls.length; i++) {
            var cy = startY + i * 36;

            ctx.fillStyle = i % 2 === 0 ? 'rgba(223,227,230,0.05)' : 'rgba(223,227,230,0.02)';
            ctx.fillRect(W * 0.12, cy - 14, W * 0.76, 28);
            ctx.fillStyle = C.WB_BLUE;
            ctx.fillRect(W * 0.12, cy - 14, 3, 28);

            UI.label(ctx, controls[i][0], W * 0.15, cy, 14, C.WB_BLUE, 600, 'left');

            ctx.font = '400 15px ' + C.FONT_UI;
            ctx.fillStyle = 'rgba(223,227,230,0.78)';
            ctx.textAlign = 'left';
            ctx.fillText(controls[i][1], W * 0.40, cy);
            ctx.textAlign = 'center';
        }

        var tipY = H * 0.60;
        var chosen = RR.BoatCatalog.getSelected();
        var difficulty = RR.Difficulty.getSelected();
        var tips = [
            'Your selected ' + chosen.model + ' carries its own power, mass, beam and steering response.',
            difficulty.label + ': ' + difficulty.description,
            'Read the water — darker is deeper, lighter is shallow danger.',
            'Hold ↑ and steer with ← → — the boat goes where the bow points.',
            'The wake follows the boat’s real path. A little hull angle in a hard turn is normal planing skid.',
            'The current sets you toward the outside of a bend and splits around islands — steer early.',
            'Larger boats carry momentum but lose bank room and rotate more slowly.',
            'Jump logs with SPACE (or the JUMP button) but watch the cooldown timer.',
            'Shallow water slows you down. Stay too long and you ground out.',
            'Salmon are harmless. Bears are not—leave room beside an occupied bank.'
        ];

        ctx.font = 'bold 19px ' + C.FONT_DISPLAY;
        ctx.fillStyle = C.WB_BLUE;
        UI.tracked(ctx, 'TIPS', W * 0.15, tipY, 1.2, 'left');

        ctx.textAlign = 'left';
        for (i = 0; i < tips.length; i++) {
            ctx.font = '400 14px ' + C.FONT_UI;
            ctx.fillStyle = 'rgba(223,227,230,0.62)';
            ctx.fillText('· ' + tips[i], W * 0.15, tipY + 28 + i * 21);
        }
        ctx.textAlign = 'center';

        UI.label(ctx, 'PRESS ENTER OR ESC TO RETURN', W / 2, H * 0.95, 12, 'rgba(223,227,230,0.4)', 500);
    }
};
