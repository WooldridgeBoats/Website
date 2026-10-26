window.RR = window.RR || {};

(function () {
    RR.Scoring.loadHighScore();
    RR.Engine.init();
    RR.Engine.changeScene(RR.TitleScene);

    // Tell the Mac app's local server the game is still open. It shuts itself
    // down a few minutes after the last ping (GAME/serve-nocache.py
    // --idle-exit), which is what lets the launcher skip its Quit dialog.
    // Only on the local server -- hosted on a website there is nobody to tell.
    var h = window.location.hostname;
    if (h === '127.0.0.1' || h === 'localhost') {
        var ping = function () {
            try { fetch('/__alive?t=' + Date.now(), { cache: 'no-store' }).catch(function () {}); } catch (e) {}
        };
        ping();
        setInterval(ping, 15000);
    }
})();
