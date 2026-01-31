# Quick Start Guide - Argentibia Launcher Build Pipeline

## For Developers

### Build Locally
```powershell
cd C:\Users\bigli\Desktop\luker-development-repos\luker-launcher
.\build.ps1 -Clean
```

Output: `dist/ArgentibiaLauncher-1.0.0-x64.zip` (142 MB)

### Make a Release
```bash
# 1. Commit code
git add .
git commit -m "Add new feature"

# 2. Bump version
npm version patch    # 1.0.0 → 1.0.1

# 3. Push
git push origin main
git push origin --tags

# GitHub Actions builds automatically (8-12 minutes)
```

### Check Release Status
1. Go to: https://github.com/[USERNAME]/luker-launcher/actions
2. Watch workflow run
3. Download artifacts from Releases tab when done

---

## File Locations

| File | Purpose |
|------|---------|
| `build.ps1` | Build script (run locally) |
| `electron-builder.json` | Build configuration |
| `BUILD.md` | Full build guide |
| `DEPLOYMENT.md` | Release guide |
| `package.json` | Project metadata |
| `.github/workflows/release.yml` | CI/CD workflow |

---

## Build Artifacts

| File | Size | Use |
|------|------|-----|
| `.zip` | 142 MB | Portable version |
| `.exe` | 145 MB | Installer (when available) |
| `checksums.txt` | ~1 KB | Verification |

---

## Common Commands

```powershell
# Local build
.\build.ps1 -Clean

# Build without reinstalling npm packages (faster)
.\build.ps1 -SkipInstall

# Build without code signing
.\build.ps1 -NoSign

# Release
npm version patch && git push origin main --tags
```

---

## Troubleshooting

**Build fails?**
- Try: `.\build.ps1 -Clean -NoSign`

**GitHub Actions not running?**
- Check tag format: v1.0.1 (not 1.0.1)
- Check workflow file exists: `.github/workflows/release.yml`

**More help?**
- See BUILD.md for detailed guide
- See DEPLOYMENT.md for release procedures

---

## Version Numbers

```
npm version patch     # 1.0.0 → 1.0.1 (bug fix)
npm version minor     # 1.0.0 → 1.1.0 (new feature)
npm version major     # 1.0.0 → 2.0.0 (breaking change)
```

---

## One-Minute Release

```bash
npm version patch && git push origin main --tags
# Wait 8-12 minutes...
# Download from GitHub Releases
```

That's it! GitHub Actions builds everything automatically.

---

**For more details, see BUILD.md or DEPLOYMENT.md**
