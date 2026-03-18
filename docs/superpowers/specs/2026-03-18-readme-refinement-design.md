# README Refinement Design

## Goal

Rewrite both `README.md` (English) and `README_CN.md` (Chinese) to be user-first, highlighting the npx one-liner quick start and npm package availability.

## Target Audience

General users who want to quickly try and use EasyPaper.

## Structure (both languages)

1. **Header** — Language toggle link, title, badges (npm version, license, Node.js), one-line description, screenshot placeholder
2. **Quick Start** — `npx @lvxintao/easypaper` one-liner, prerequisites as a note
3. **Features** — 7 bullet points (same as current, minor formatting tweaks)
4. **Installation** — 3 options: npx (no install), global npm install, from source
5. **Configuration** — Table of env vars, note about Settings page, `.env` file locations
6. **Usage** — 4-step workflow
7. **CLI Options** — Port, help, version flags; data directory note
8. **Tech Stack** — 4 items
9. **License** — MIT

## Key Changes from Current README

- Add npm/license/node badges
- Add screenshot placeholder (`docs/images/screenshot.png`)
- Promote `npx` as the primary quick start method
- Add multiple installation options (npx, global, source)
- Add configuration table format
- Add CLI options section
- Note `~/.easypaper/` data directory for npm installs

## Out of Scope

- Adding actual screenshots (user will provide later)
- CONTRIBUTING.md or developer docs
- Changelog
