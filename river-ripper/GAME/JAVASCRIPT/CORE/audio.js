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
        ['keydown', 'pointerdown', 'mousedown', 'touchstart'].forEach(function (ev) {
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
        if (this.unlocked) return;
        this.unlocked = true;
        var self = this;
        Object.keys(this.sounds).forEach(function (name) {
            var el = self.sounds[name];
            if (el._wanted) {
                // Something asked for this before the gesture and was refused.
                el.play().catch(function () {});
                return;
            }
            el.muted = true;
            var p = el.play();
            var settle = function () {
                // A real request may have arrived while the bless was in
                // flight -- the first ENTER both unlocks and starts the run.
                if (!el._wanted) el.pause();
                el.muted = false;
            };
            if (p && p.then) p.then(settle, settle); else settle();
        });
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

    playLoop: function (name, vol) {
        if (this.muted) return null;
        var el = this.sounds[name];
        if (!el) return null;
        this._playElement(el, (vol !== undefined ? vol : 1.0) * this.volume, true);
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
        if (this.muted) return;
        var el = this.sounds[name];
        if (!el) return;
        this.currentMusic = el;
        this._playElement(el, this.volume * (RR.Config.MUSIC_MIX !== undefined ? RR.Config.MUSIC_MIX : 0.38), true);
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
        if (this.master) {
            this.master.gain.setTargetAtTime(this.muted ? 0 : this.volume, this.ctx.currentTime, 0.02);
        }
        var i;
        if (this.muted) {
            if (this.currentMusic) this.currentMusic.pause();
            for (i = 0; i < this.activeSounds.length; i++) this.activeSounds[i].pause();
        } else {
            if (this.currentMusic) this.currentMusic.play().catch(function () {});
            for (i = 0; i < this.activeSounds.length; i++) this.activeSounds[i].play().catch(function () {});
        }
        return this.muted;
    }
};
