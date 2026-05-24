# Golem — Release Process

---

## Versioning (X.Y.Z)

| Part | Bump when |
|---|---|
| **X — Major** | DB schema incompatibility, data migration required, complete reimagining |
| **Y — Minor** | Any user-visible new capability ships |
| **Z — Patch** | Bug fix, visual tweak, copy change — no new capability |

Rules:
- Never bump patch after a minor in the same release — the minor covers it
- The leading `0` (0.Y.Z) means pre-1.0/beta. Bump to `1.0.0` when recommending without caveats

**Version lives in two places:** `package.json` → `"version"` and `src/components/SettingsView.jsx` → version string in the About card.

---

## Release Checklist

Always follow this order:

1. Finish all feature work on a branch/worktree
2. Merge the branch into `main` (via PR or local merge) — never release from a feature branch
3. Run `/build` on `main` after the merge is confirmed

The `/build` skill handles:
- Version bump in `package.json` AND `src/components/SettingsView.jsx`
- CHANGELOG entry
- `npm run build`
- Commit + annotated tag
- Push to GitHub
- GitHub release with installer + blockmap + `latest.yml`

Verify all three release assets are present after publishing:

```bash
gh api repos/rcadden/golem/releases/tags/vX.Y.Z --jq '.assets[].name'
```

---

## Build Commands

| Command | Action |
|---|---|
| `npm run dev` | Vite dev server + Electron with HMR |
| `npm run pack` | Unpacked dir only — fast sanity check, no installer |
| `npm run build` | NSIS installer, no folder open |
| `npm run release` | Build + open dist-electron folder |

---

## Asset Naming

electron-builder writes `latest.yml` with dash-separated names (`Golem-Setup-X.Y.Z.exe`), but GitHub normalizes uploaded names to dots. Before uploading:

1. Update `dist-electron/latest.yml` to use `Golem.Setup.X.Y.Z.exe`
2. Use `#targetName` in `gh release upload` to control the final asset name

---

## Auto-Update Feed

Golem uses `electron-updater` with GitHub Releases as the update feed. Installed copies check for updates on launch and every 4 hours. For the feed to work, each release must include:

- `Golem.Setup.X.Y.Z.exe` — the installer
- `Golem.Setup.X.Y.Z.exe.blockmap` — for delta updates
- `latest.yml` — the feed manifest
