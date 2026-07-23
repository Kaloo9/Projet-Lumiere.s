# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project context

**Lumi** (repo `Projet-Lumiere.s`) is a personal webapp that aggregates movie showtimes from 6 Lyon cinemas onto a single page, so the user doesn't have to check each cinema's site by hand (particularly useful for spotting re-releases of old films).

**This is the user's first web project and first contact with JavaScript.** They are a beginner in web dev — explain concepts simply with concrete examples before coding, and guide step by step rather than writing everything at once. They work on Windows, in VS Code, using PowerShell as the terminal.

Three living docs in `docs/` are updated as the project progresses and hold more detail than this file:
- `docs/fiche-etat-du-projet.md` — condensed, self-sufficient project status snapshot (stack, data formats, what's done, next steps)
- `docs/fiche-methode.md` — step-by-step setup log with exact commands run so far
- `docs/fiche-roadmap.md` — Phase 1 / Phase 2 checklist and undecided items
- `docs/fiche-definitions.md` — glossary of terms explained to the user along the way

Check these for the current state before assuming something is or isn't built yet.

## Commands

```powershell
# Activate the venv (PowerShell blocks script execution by default — run this every new terminal session before activate)
Set-ExecutionPolicy -Scope Process -ExecutionPolicy Bypass
venv\Scripts\activate

# Run the dev server
python app.py
# -> http://127.0.0.1:5000  (index at "/", JSON data at "/api/seances")

# After adding a new dependency
pip install <package>
pip freeze > requirements.txt
```

There is no test suite, linter, or build step in this project yet.

## Architecture

- Single Flask server (`app.py`) serves both the API and the frontend — no separate frontend build/server.
- `CINEMAS` dict in `app.py` maps display names to Allociné cinema IDs. `/api/seances` loops over it and, per cinema, combines two sources into one dict grouped **by film title** (not by cinema): `get_seances_detaillees()` (a custom function, see below) for showtimes, and `api.get_movies(id, date)` for the poster URL (`urlPoster`). Result shape: `{ "Film title": { "poster": url, "seances": { "Cinema name": [showtime, ...] } } }`.
- `get_seances_detaillees()` in `app.py` reimplements `allocineAPI.get_showtime()`'s internal pagination/dedup logic by calling the library's private helpers directly (`api._get_json_request`, `URLs.showtime_url`), because the public `get_showtime()` discards the `projection` and `experience` fields (screening format — standard/IMAX/4DX) that this app needs. This is a deliberate trade-off: relying on underscore-prefixed "private" library internals is more fragile to library updates than using its public API.
- Frontend is vanilla HTML/CSS/JS (deliberate — this is the user's JS learning ground, guide new concepts step by step in chat rather than editing their files directly — see workflow note below). `templates/index.html` is the static shell. `static/script.js` fetches `/api/seances`, renders a grid of films (poster + title) via `document.getElementById("seances").innerHTML`, and wires a click listener per film (`document.querySelectorAll(".film")` + `addEventListener`) that toggles a hidden per-cinema showtimes list (`style.display`), each showtime annotated with VF/VO (from `diffusionVersion`) and projection format (from `projection`/`experience`). `static/style.css` is still empty — next planned step.
- Data source: the `allocine-seances` PyPI package (`allocineAPI.allocineAPI`, from GitHub `lefevre-dev/AllocineAPI`), an unofficial wrapper around Allociné's internal GraphQL API. Despite the package name suggesting JS, it's a Python library. Its data is live — showtime listings can change between two requests (e.g. a session becomes unbookable and disappears); don't assume a missing entry is a code bug without comparing raw JSON across two points in time first.
- `explore.py` is a throwaway sandbox script used to explore the `allocineAPI` library interactively (finding cinema IDs, inspecting raw response shapes via the library's private request helpers) — not part of the app itself, frequently rewritten in place.

### Known limitation

`/api/seances` only returns today's showtimes. Extending it to multiple days (via the library's `day_shift` parameter) is an open TODO — see roadmap doc.

## Working with this user

This user is a true beginner (first web project, first JS). When introducing new code for them to learn: explain concepts before/while coding, paste code in the chat response (with light inline comments) rather than editing their files directly, and keep new-concept count per turn low — check understanding before stacking more. Keep `docs/fiche-*.md` updated (in their existing style/language — French, dated "✅ validée le JJ/MM/AAAA" entries) whenever a step is completed, a concept is newly explained, or something notable is learned; each of the four docs has a distinct role (definitions = glossary, méthode = chronological build log with exact code, roadmap = Phase 1/2 checklist, état-du-projet = condensed resumable snapshot) — see their own text for details.

## Git workflow

Standard save procedure used throughout this project (nothing project-specific beyond this):
```powershell
git add .
git commit -m "Description"
git push
```
