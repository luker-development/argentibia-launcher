# Argentibia Launcher - Build Guide

## Overview

This document describes the automated build and release process for the Argentibia Launcher.

## Build Requirements

- Node.js 20.x or later
- npm 10.x or later
- Windows 10/11 (for local builds)
- PowerShell 5.0+ (for running build scripts)

## Local Build

### Quick Build

```powershell
# Build with clean (remove previous dist)
.\build.ps1 -Clean

# Build without reinstalling dependencies (faster)
.\build.ps1 -SkipInstall

# Build with code signing disabled (if permissions issues)
.\build.ps1 -NoSign

# Full clean build
.\build.ps1 -Clean -NoSign
```

### Build Outputs

After running `build.ps1`, artifacts are created in the `dist/` directory:

```
dist/
├── ArgentibiaLauncher-1.0.0-x64.exe       NSIS installer
├── ArgentibiaLauncher-1.0.0-x64.zip       Portable ZIP
├── checksums.txt                           SHA256 hashes
├── win-unpacked/                           Unpacked application
└── builder-debug.yml                       Build metadata
```

### File Sizes (Approximate)

- NSIS Installer (.exe): 145-150 MB
- Portable ZIP (.zip): 140-145 MB
- Unpacked (win-unpacked/): 340 MB

## Automated Releases (GitHub Actions)

### Release Process

1. **Create a version tag**:
   ```bash
   npm version patch      # Bumps version: 1.0.0 -> 1.0.1
   npm version minor      # Bumps version: 1.0.0 -> 1.1.0
   npm version major      # Bumps version: 1.0.0 -> 2.0.0
   ```

2. **Push to GitHub**:
   ```bash
   git push origin main
   git push origin --tags
   ```

3. **GitHub Actions automatically**:
   - Triggers on tag push (v1.0.1, v1.1.0, etc.)
   - Builds application on Windows runner
   - Creates GitHub Release with artifacts
   - Generates SHA256 checksums

### Workflow Features

The `.github/workflows/release.yml` workflow:
- Uses Windows Latest runner (Windows Server 2022)
- Node.js 20.x with npm caching
- Disables code signing (CSC_IDENTITY_AUTO_DISCOVERY=false)
- Syncs version.txt automatically
- Generates checksums for security verification
- Creates GitHub Release with release notes
- Uploads artifacts as GitHub Release assets

## Version Management

### Version Files Synced Automatically

- `package.json` - NPM version
- `updater/version.txt` - Game client version

When you run `npm version`, both files are kept in sync by the build process.

### Release Notes

GitHub Actions generates release notes automatically based on:
- Commit messages
- Pull requests
- Issues closed

You can edit release notes on the GitHub Releases page after creation.

## Troubleshooting

### Build Fails Locally

**Issue**: "Node.js not found"
```powershell
# Install Node.js 20+ from https://nodejs.org/
# Then restart PowerShell
```

**Issue**: "Build failed" or code signing errors
```powershell
# Use -NoSign flag
.\build.ps1 -Clean -NoSign
```

**Issue**: "dist directory locked"
```powershell
# Close any Explorer windows showing dist/
# Close any running ArgentibiaLauncher.exe instances
.\build.ps1 -Clean
```

### GitHub Actions Build Fails

**Common causes**:
- Tag format incorrect (must be v1.0.0, not 1.0.0)
- Code signing environment not set (handled by workflow)
- Workflow file syntax errors (check `.github/workflows/release.yml`)

**Debug**:
1. Go to repository → Actions tab
2. Click failed workflow run
3. Expand "Build application" step to see full output

## Artifact Verification

### Verify Checksums

After downloading artifacts from GitHub Release:

```powershell
# Windows (PowerShell)
$file = "ArgentibiaLauncher-1.0.0-x64.zip"
$hash = (Get-FileHash -Path $file -Algorithm SHA256).Hash
Write-Host "SHA256: $hash"

# Then compare with checksums.txt from release
```

```bash
# Linux/macOS (bash)
sha256sum ArgentibiaLauncher-1.0.0-x64.zip
```

## Next Steps

### Code Signing (Optional)

To sign installers and avoid SmartScreen warnings:

1. Obtain a code signing certificate ($100-500/year)
2. Add certificate to GitHub Secrets
3. Update `.github/workflows/release.yml` to use certificate
4. Update `electron-builder.json` signing configuration

### Auto-Update (Optional)

To enable in-app updates:

1. Install `electron-updater` package
2. Configure update server or GitHub Releases
3. Update `src/renderer.js` update checker logic
4. Test auto-update flow

### Multi-Architecture Support (Optional)

To build for ARM64 Windows:

1. Update `electron-builder.json`:
   - Add `"arm64"` to `win` target architectures
2. Update `package.json` build scripts:
   - Add `"build:arm64": "electron-builder --win --arm64"`

## Configuration Files

### electron-builder.json

Main build configuration:
- App metadata (id, name, version)
- Build targets (NSIS, ZIP)
- Icon paths
- NSIS installer settings

### build.ps1

PowerShell build script:
- Environment validation
- Dependency installation
- Version synchronization
- Electron-builder invocation
- Checksum generation

### .github/workflows/release.yml

GitHub Actions CI/CD pipeline:
- Triggered on version tags
- Builds on Windows runner
- Creates GitHub Release
- Uploads artifacts

## Security Notes

- Checksums are generated and provided for verification
- Code signing can be enabled to improve trust signals
- No credentials are stored in git (use GitHub Secrets)
- Unpacked application excluded from version control (.gitignore)

## Support

For issues or questions:
1. Check this BUILD.md file
2. Check GitHub Issues
3. Review GitHub Actions workflow logs
4. Consult electron-builder documentation
