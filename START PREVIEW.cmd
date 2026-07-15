@echo off
title Wooldridge Site Preview Launcher
echo ============================================================
echo   WOOLDRIDGE SITE PREVIEW
echo ------------------------------------------------------------
echo   Starting a local web server for this folder and opening
echo   the site in your browser at:  http://localhost:8410
echo.
echo   View the site there (the PDF viewer, galleries, and video
echo   all work this way - unlike double-clicking the HTML files).
echo ============================================================
echo.

rem Start the bundled Perl server in its own window (serving THIS folder)
start "Wooldridge Preview Server - keep this window open" "C:\Program Files\Git\usr\bin\perl.exe" "%~dp0_build\serve.pl" "%~dp0." 8410

rem Give the server a moment to come up, then open the homepage
ping -n 2 127.0.0.1 >nul
start "" http://localhost:8410/index.html

echo Browser opened.
echo.
echo The server is running in a separate window titled
echo   "Wooldridge Preview Server".
echo Close THAT window when you are done to stop the server.
echo.
echo You can close this window now.
pause
