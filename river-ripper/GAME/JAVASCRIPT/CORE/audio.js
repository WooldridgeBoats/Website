window.RR = window.RR || {};

// Audio, built so Safari actually plays it.
//
// Safari (the Mac's default browser, which is what RIVER RIPPER.app opens)
// only lets a page start sound from INSIDE a key or click handler. The game
// starts every sound from the frame loop a beat later, so Safari silently
// rejected all of it -- that was "no sounds for game" (2026-10-26). Chrome is
// looser, which is why it never showed up there.
//
// The fix, two halves:
//   - Short effects (horn, crash, splash) and the engine run through one Web
//     Audio context. That context is resumed on the first key/click, and once
//     running it can start sounds from anywhere.
//   - Long tracks (both music beds and the river ambience) stay as <audio>
//     elements -- decoding three minutes of music into memory is ~60 MB each.
//     Each element is "blessed" by a play()/pause() inside that same first
//     gesture, after which Safari allows it to play from the loop.
//
// The engine is synthesised (no engine recording exists in GAME/AUDIO):
// two detuned saws through a low-pass whose pitch and brightness follow the
// throttle, plus filtered noise for water rush that follows boat speed.
RR.Audio = {
    sounds: {},          // name -> <audio> element (long tracks)
    buffers: {},         // name -> AudioBuffer (short effects)
    currentMusic: null,
    activeSounds: [],
    muted: false,
    volume: 0.7,
    ctx: null,
    master: null,
    unlocked: false,
    _engine: null,

    init: function () {
        this.volume = RR.Config.MASTER_VOLUME;

        // TESTING AID: index.html?mute=1 boots the game silent.
        // Mute is not persisted, so a harness that reloads repeatedly would
        // restart the menu music every time without this.
        try {
            if (/[?&]mute=1\b/.test(window.location.search)) this.muted = true;
        } catch (e) {}

        // SOUND STARTS OFF ON THE WEBSITE (Tyler, 2026-10-26). Music that
        // starts by itself on a web page is the classic annoyance, so on the
        // site the game opens muted and the speaker button (engine.js) turns
        // it on. The player's choice is remembered in this browser
        // (rr_sound). The Mac app (localhost) keeps sound on by default --
        // opening the app is already choosing to play.
        if (!this.muted) {
            var pref = null;
            try { pref = localStorage.getItem('rr_sound'); } catch (e) {}
            if (pref === 'off') this.muted = true;
            else if (pref !== 'on') {
                var h = '';
                try { h = window.location.hostname; } catch (e) {}
                if (h && h !== 'localhost' && h !== '127.0.0.1') this.muted = true;
            }
        }

        // Tab or app switched away: pause everything, pick it back up on
        // return (unless muted in the meantime).
        var selfV = this;
        document.addEventListener('visibilitychange', function () {
            selfV._hidden = document.hidden;
            selfV._applyMute();
        });

        var AC = window.AudioContext || window.webkitAudioContext;
        if (AC) {
            try {
                this.ctx = new AC();
                this.master = this.ctx.createGain();
                this.master.gain.value = this.muted ? 0 : this.volume;
                this.master.connect(this.ctx.destination);
            } catch (e) { this.ctx = null; }
        }

        // AAC, not the .wav masters (11 MB instead of 180 MB per launch).
        // Converted with: afconvert -f m4af -d aac -b <rate> in.wav out.m4a
        this.loadBuffer('horn', 'GAME/AUDIO/SFX/AIRHORN-1.m4a');
        this.loadBuffer('crash', 'GAME/AUDIO/SFX/CRASH-SOUND.m4a');
        this.loadBuffer('splash', 'GAME/AUDIO/SFX/WATER-SPLASH-SOUND.m4a');
        this.preload('ambience', 'GAME/AUDIO/SFX/AMBIENCE-FOREST-RIVER-NATURE-1.m4a');
        this.preload('music_gameplay', 'GAME/AUDIO/MUSIC/ES_Where Will We Be - Will Harrison.m4a');
        this.preload('music_menu', 'GAME/AUDIO/MUSIC/ES_Electric Illusion - Glass House.m4a');

        var self = this;
        var unlock = function () { self._unlock(); };
        // PHONES UNLOCK ON THE LIFT, NOT THE TOUCH (2026-10-26). iOS and
        // Android count touchend / pointerup / click as the user's gesture --
        // NOT touchstart -- and touch.js cancels the click a tap would make.
        // Unlocking only on touchstart left phones silent. Listen to all of
        // them; _unlock keeps trying until the music elements really play.
        // On iPhones, mark the page as media playback so the silent switch
        // doesn't mute the game where Safari allows it.
        try { if (navigator.audioSession) navigator.audioSession.type = 'playback'; } catch (e) {}
        ['keydown', 'pointerdown', 'mousedown', 'touchstart', 'touchend', 'pointerup', 'click'].forEach(function (ev) {
            window.addEventListener(ev, unlock, true);
        });
    },

    preload: function (name, path) {
        var audio = new Audio();
        audio.preload = 'auto';
        audio.src = path;
        audio._wanted = false;
        this.sounds[name] = audio;
    },

    loadBuffer: function (name, path) {
        var self = this;
        if (!this.ctx || !window.fetch) {
            this.preload(name, path);
            return;
        }
        fetch(path).then(function (r) { return r.arrayBuffer(); }).then(function (data) {
            // Old Safari only has the callback form of decodeAudioData.
            return new Promise(function (ok, fail) {
                var p = self.ctx.decodeAudioData(data, ok, fail);
                if (p && p.then) p.then(ok, fail);
            });
        }).then(function (buf) {
            self.buffers[name] = buf;
        }).catch(function () {
            self.preload(name, path);
        });
    },

    // Runs inside the first key/click handler -- the one moment Safari allows.
    _unlock: function () {
        if (this.ctx && this.ctx.state !== 'running') {
            try { this.ctx.resume(); } catch (e) {}
        }
        if (this.unlocked || this._unlocking) return;
        this._unlocking = true;
        var self = this, pending = 0, okAll = true;
        var done = function (ok) {
            if (!ok) okAll = false;
            if (--pending > 0) return;
            self._unlocking = false;
            // Only a gesture the browser actually honoured counts; a refused
            // one (a phone's touchstart) leaves us trying on the next.
            if (okAll) self.unlocked = true;
        };
        Object.keys(this.sounds).forEach(function (name) {
            var el = self.sounds[name];
            pending++;
            if (el._wanted && !(self.muted || self._hidden)) {
                // Something asked for this before the gesture and was refused.
                var pw = el.play();
                if (pw && pw.then) pw.then(function () { done(true); }, function () { done(false); });
                else done(true);
                return;
            }
            el.muted = true;
            var p = el.play();
            var settle = function (ok) {
                // A real request may have arrived while the bless was in
                // flight -- the first ENTER both unlocks and starts the run.
                if (!el._wanted || self.muted || self._hidden) el.pause();
                el.muted = false;
                done(ok);
            };
            if (p && p.then) p.then(function () { settle(true); }, function () { settle(false); });
            else settle(true);
        });
        if (!pending) { this._unlocking = false; this.unlocked = true; }
    },

    _playElement: function (el, vol, loop) {
        el._wanted = true;
        el.muted = false;
        el.volume = Math.max(0, Math.min(1, vol));
        el.loop = !!loop;
        try { el.currentTime = 0; } catch (e) {}
        el.play().catch(function () {});
    },

    play: function (name, vol) {
        if (this.muted) return null;
        var v = (vol !== undefined ? vol : 1.0);
        var buf = this.buffers[name];
        if (buf && this.ctx) {
            var src = this.ctx.createBufferSource();
            var g = this.ctx.createGain();
            src.buffer = buf;
            g.gain.value = v;
            src.connect(g);
            g.connect(this.master);
            src.start(0);
            return { _src: src };
        }
        var el = this.sounds[name];
        if (!el) return null;
        var clone = el.cloneNode();
        clone.volume = v * this.volume;
        clone.play().catch(function () {});
        return clone;
    },

    // Muted loops and music are still REGISTERED (just not started), so
    // turning sound on mid-run brings the river and the music back.
    playLoop: function (name, vol) {
        var el = this.sounds[name];
        if (!el) return null;
        el._vol = (vol !== undefined ? vol : 1.0) * this.volume;
        if (!this.muted && !this._hidden) this._playElement(el, el._vol, true);
        else { el._wanted = false; el.volume = el._vol; el.loop = true; }
        this.activeSounds.push(el);
        return el;
    },

    stopSound: function (snd) {
        if (!snd) return;
        if (snd._src) {
            try { snd._src.stop(); } catch (e) {}
            return;
        }
        snd._wanted = false;
        snd.pause();
        try { snd.currentTime = 0; } catch (e) {}
        var i = this.activeSounds.indexOf(snd);
        if (i !== -1) this.activeSounds.splice(i, 1);
    },

    playMusic: function (name) {
        this.stopMusic();
        var el = this.sounds[name];
        if (!el) return;
        this.currentMusic = el;
        el._vol = this.volume * (RR.Config.MUSIC_MIX !== undefined ? RR.Config.MUSIC_MIX : 0.38);
        if (!this.muted && !this._hidden) this._playElement(el, el._vol, true);
        else { el._wanted = false; el.volume = el._vol; el.loop = true; }
    },

    stopMusic: function () {
        if (this.currentMusic) {
            this.currentMusic._wanted = false;
            this.currentMusic.pause();
            try { this.currentMusic.currentTime = 0; } catch (e) {}
            this.currentMusic = null;
        }
    },

    stopAll: function () {
        this.stopMusic();
        var i;
        for (i = 0; i < this.activeSounds.length; i++) {
            this.activeSounds[i]._wanted = false;
            this.activeSounds[i].pause();
        }
        this.activeSounds = [];
        this.engineStop();
    },

    // ---- Engine -----------------------------------------------------------

    engineStart: function () {
        if (!this.ctx || this._engine) return;
        var c = this.ctx;
        var out = c.createGain();
        out.gain.value = 0;
        out.connect(this.master);

        var lp = c.createBiquadFilter();
        lp.type = 'lowpass';
        lp.frequency.value = 380;
        lp.Q.value = 3;
        lp.connect(out);

        var o1 = c.createOscillator();
        var o2 = c.createOscillator();
        o1.type = 'sawtooth';
        o2.type = 'sawtooth';
        o1.frequency.value = 48;
        o2.frequency.value = 48 * 1.012;
        var oscGain = c.createGain();
        oscGain.gain.value = 0.32;
        o1.connect(oscGain);
        o2.connect(oscGain);
        oscGain.connect(lp);

        // Water rush: two seconds of looped white noise, band-passed.
        var len = c.sampleRate * 2;
        var nb = c.createBuffer(1, len, c.sampleRate);
        var d = nb.getChannelData(0);
        for (var i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
        var noise = c.createBufferSource();
        noise.buffer = nb;
        noise.loop = true;
        var bp = c.createBiquadFilter();
        bp.type = 'bandpass';
        bp.frequency.value = 900;
        bp.Q.value = 0.6;
        var rush = c.createGain();
        rush.gain.value = 0;
        noise.connect(bp);
        bp.connect(rush);
        rush.connect(this.master);

        o1.start(0);
        o2.start(0);
        noise.start(0);
        this._engine = { out: out, lp: lp, o1: o1, o2: o2, noise: noise, rush: rush };
        this.setEngine(0, 0);
    },

    // throttle and speed both 0..1. Smoothed with setTargetAtTime so a
    // jumpy input never clicks.
    setEngine: function (throttle, speed) {
        var e = this._engine;
        if (!e) return;
        var t = this.ctx.currentTime;
        var rpm = Math.max(0, Math.min(1, 0.55 * throttle + 0.45 * speed));
        var f = 46 + rpm * 74;                    // idle burble -> high whine
        e.o1.frequency.setTargetAtTime(f, t, 0.12);
        e.o2.frequency.setTargetAtTime(f * 1.012, t, 0.12);
        e.lp.frequency.setTargetAtTime(320 + rpm * 1500, t, 0.12);
        e.out.gain.setTargetAtTime(0.10 + rpm * 0.16, t, 0.10);
        e.rush.gain.setTargetAtTime(Math.max(0, Math.min(1, speed)) * 0.07, t, 0.2);
    },

    // For pause: hush without tearing the graph down.
    engineIdle: function () {
        var e = this._engine;
        if (!e) return;
        var t = this.ctx.currentTime;
        e.out.gain.setTargetAtTime(0.05, t, 0.1);
        e.rush.gain.setTargetAtTime(0, t, 0.1);
    },

    engineStop: function () {
        var e = this._engine;
        if (!e) return;
        this._engine = null;
        var t = this.ctx.currentTime;
        e.out.gain.setTargetAtTime(0, t, 0.05);
        e.rush.gain.setTargetAtTime(0, t, 0.05);
        try {
            e.o1.stop(t + 0.3);
            e.o2.stop(t + 0.3);
            e.noise.stop(t + 0.3);
        } catch (err) {}
    },

    toggleMute: function () {
        this.muted = !this.muted;
        try { localStorage.setItem('rr_sound', this.muted ? 'off' : 'on'); } catch (e) {}
        this._applyMute();
        return this.muted;
    },

    // Silent = muted OR the tab is hidden.
    _applyMute: function () {
        var silent = this.muted || this._hidden, i, el;
        if (this.master && this.ctx) {
            this.master.gain.setTargetAtTime(silent ? 0 : this.volume, this.ctx.currentTime, 0.02);
        }
        var els = this.activeSounds.slice();
        if (this.currentMusic) els.push(this.currentMusic);
        for (i = 0; i < els.length; i++) {
            el = els[i];
            if (silent) { el._wanted = false; el.pause(); }
            else { el._wanted = true; el.muted = false; el.play().catch(function () {}); }
        }
    }
};
