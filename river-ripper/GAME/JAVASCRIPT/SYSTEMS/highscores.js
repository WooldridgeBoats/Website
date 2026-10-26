window.RR = window.RR || {};

// ---------------------------------------------------------------------------
// RR.Scores -- the top ten board.
//
// Ten entries, sorted high to low. Anything that falls past tenth is dropped on
// insert, so the list never grows. Persisted in localStorage as 'rr_top10'.
//
// The board is the ONLY reason the name-entry screen exists: a run is offered
// name entry if and only if it qualifies. Prompting on every crash for a
// 200-point run would be nagging, and a leaderboard nobody makes is not one.
//
// Storage is per-browser, same as rr_highscore. There is no server.
// ---------------------------------------------------------------------------
RR.Scores = {
    KEY: 'rr_top10',
    MAX: 10,
    // Floor for name entry. Without it, an empty board accepts anything and
    // crashing off the line prompts you to sign the leaderboard, which is
    // silly. 500 is about 50 m of river -- a short run, but a run.
    MIN: 500,
    list: [],

    load: function () {
        this.list = [];
        try {
            var raw = localStorage.getItem(this.KEY);
            if (!raw) return this.list;
            var parsed = JSON.parse(raw);
            if (Object.prototype.toString.call(parsed) !== '[object Array]') return this.list;
            var i, e;
            for (i = 0; i < parsed.length; i++) {
                e = parsed[i];
                // Defend against a hand-edited or half-written entry rather
                // than letting one bad row blank the whole board.
                if (!e || typeof e.score !== 'number' || !isFinite(e.score)) continue;
                this.list.push({
                    name: String(e.name || '').slice(0, 12),
                    initial: String(e.initial || '').slice(0, 1),
                    score: Math.floor(e.score),
                    distance: Math.floor(e.distance || 0),
                    boat: String(e.boat || ''),
                    river: String(e.river || ''),
                    difficulty: String(e.difficulty || ''),
                    date: String(e.date || ''),
                    run: String(e.run || '')
                });
            }
            this._sort();
        } catch (err) {
            this.list = [];
        }
        return this.list;
    },

    save: function () {
        try { localStorage.setItem(this.KEY, JSON.stringify(this.list)); } catch (err) {}
    },

    _sort: function () {
        this.list.sort(function (a, b) { return b.score - a.score; });
        if (this.list.length > this.MAX) this.list.length = this.MAX;
    },

    // Would this score make the board? Ties do NOT qualify -- you have to beat
    // tenth place, not match it, or a repeated identical run keeps prompting.
    qualifies: function (score) {
        if (!isFinite(score) || score < this.MIN) return false;
        this.load();
        if (this.list.length < this.MAX) return true;
        return score > this.list[this.list.length - 1].score;
    },

    // Where this score would land, 1-based. Only meaningful if it qualifies.
    rankFor: function (score) {
        this.load();
        var i;
        for (i = 0; i < this.list.length; i++) {
            if (score > this.list[i].score) return i + 1;
        }
        return Math.min(this.list.length + 1, this.MAX);
    },

    // run: optional tag for one continuous run. A run that clears a river
    // and keeps going is already on the board from the finish line, so a
    // later qualifying score for the same run UPDATES that row instead of
    // adding a second one.
    add: function (name, initial, score, distance, run) {
        this.load();
        var d = new Date();
        var i;
        if (run) {
            for (i = 0; i < this.list.length; i++) {
                if (this.list[i].run === run) {
                    if (score > this.list[i].score) {
                        this.list[i].score = Math.floor(score);
                        this.list[i].distance = Math.floor(distance || 0);
                        this.list[i].river = RR.River && RR.River.profile ? RR.River.profile.name : '';
                        this._sort();
                        this.save();
                    }
                    return this.list;
                }
            }
        }
        this.list.push({
            run: run || '',
            name: this.cleanName(name),
            initial: this.cleanInitial(initial),
            score: Math.floor(score),
            distance: Math.floor(distance || 0),
            boat: RR.BoatCatalog ? RR.BoatCatalog.getSelected().model : '',
            river: RR.River && RR.River.profile ? RR.River.profile.name : '',
            difficulty: RR.Difficulty ? RR.Difficulty.getSelected().label : '',
            date: (d.getMonth() + 1) + '/' + d.getDate() + '/' + String(d.getFullYear()).slice(2)
        });
        this._sort();          // truncates to MAX, dropping anything past tenth
        this.save();
        return this.list;
    },

    // Letters and single spaces only, uppercase. Keeps a pasted or mistyped
    // entry from breaking the board layout.
    cleanName: function (s) {
        return String(s || '')
            .toUpperCase()
            .replace(/[^A-Z ]/g, '')
            .replace(/\s+/g, ' ')
            .replace(/^ /, '')
            .slice(0, 12);
    },

    cleanInitial: function (s) {
        return String(s || '').toUpperCase().replace(/[^A-Z]/g, '').slice(0, 1);
    },

    // "TYLER L." for the board, or "TYLER" if they gave no initial.
    display: function (entry) {
        if (!entry) return '';
        var n = entry.name || 'RIPPER';
        return entry.initial ? n + ' ' + entry.initial + '.' : n;
    },

    clear: function () {
        this.list = [];
        try { localStorage.removeItem(this.KEY); } catch (err) {}
    }
};

RR.Scores.load();
