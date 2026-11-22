# ALTITUDE — 3D Trivia

A no-build Three.js r128 trivia website built from the uploaded procedural ALTITUDE aircraft scene.

## Run
Because the browser loads Three.js from a CDN, run the folder through a local web server.

### Windows PowerShell
```powershell
cd .\altitude-trivia
python -m http.server 8000
```
Then open http://localhost:8000

## Structure
- `index.html` — page structure
- `styles.css` — cinematic UI
- `scene.js` — adapted procedural Three.js aircraft/airport/sky scene from the supplied paste
- `app.js` — trivia categories, questions, scoring, navigation and telemetry

## Notes
- No build step.
- Three.js is loaded from jsDelivr.
- The original scene is kept procedural; no external 3D assets are required.
- Quiz data is currently local/static so it is easy to replace with an API later.
