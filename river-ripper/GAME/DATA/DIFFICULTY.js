window.RR = window.RR || {};

// hullStrikes / rogueStrikes are how many obstacle hits the hull survives --
// 1 means the run ends on the first one. The Rogue is the armoured boat and
// always gets one more than the rest of the lineup, at every difficulty.
RR.Difficulty = {
    selectedIndex: 1,
    presets: [
        {
            id: 'easy', label: 'EASY',
            description: 'Broad channels, gentler current and sparse debris.',
            widthMult: 1.65, curveMult: 0.82, currentMult: 0.72,
            authoredKeep: 0.45, treeChance: 0.025, hazardChance: 0.006,
            hullStrikes: 3, rogueStrikes: 4
        },
        {
            id: 'medium', label: 'MEDIUM',
            description: 'Wide real-river lines with meaningful current and debris.',
            widthMult: 1.38, curveMult: 1.00, currentMult: 1.00,
            authoredKeep: 0.75, treeChance: 0.075, hazardChance: 0.014,
            hullStrikes: 2, rogueStrikes: 3
        },
        {
            id: 'hard', label: 'HARD',
            description: 'Tight water, full debris fields and aggressive current.',
            widthMult: 1.06, curveMult: 1.18, currentMult: 1.35,
            authoredKeep: 1.00, treeChance: 0.16, hazardChance: 0.028,
            hullStrikes: 1, rogueStrikes: 2
        }
    ],

    getSelected: function () {
        return this.presets[this.selectedIndex] || this.presets[1];
    },

    select: function (index) {
        this.selectedIndex = (index + this.presets.length) % this.presets.length;
        try { localStorage.setItem('rr_difficulty', String(this.selectedIndex)); } catch (e) {}
        return this.getSelected();
    },

    load: function () {
        try {
            var saved = parseInt(localStorage.getItem('rr_difficulty'), 10);
            if (isFinite(saved) && saved >= 0 && saved < this.presets.length) this.selectedIndex = saved;
        } catch (e) {}
    }
};

RR.Difficulty.load();
