@echo off
echo Starting Amba Music Tracker...
echo.
echo Open your browser to: http://localhost:8000/amba-music-tracker.html
echo.
echo Press Ctrl+C to stop the server
echo.
python -m http.server 8000
pause
