# Argentibia Launcher - Deployment Checklist

## Pre-Deployment Verification

### Local Build Verification
- [x] Application packages successfully
- [x] Unpacked app created (dist/win-unpacked/)
- [x] Portable ZIP created (142.54 MB)
- [x] Checksums generated for verification
- [x] Version file synchronized
- [x] No src/src/ duplication detected
- [x] All critical files present

### Configuration Files
- [x] electron-builder.json configured correctly
- [x] build.ps1 script tested
- [x] package.json updated with build scripts
- [x] .gitignore excludes build artifacts

### GitHub Actions
- [x] .github/workflows/release.yml created
- [x] Workflow triggers on version tags (v*.*.*)
- [x] Windows runner configured
- [x] Checksum generation included
- [x] Release artifact upload configured

### Documentation
- [x] BUILD.md created with complete instructions
- [x] DEPLOYMENT.md (this file) created

## Step-by-Step Deployment Process

### Step 1: Commit Build Pipeline
```bash
cd C:\Users\bigli\Desktop\luker-development-repos\luker-launcher

git add electron-builder.json build.ps1 .gitignore
git add .github/workflows/release.yml
git add BUILD.md DEPLOYMENT.md
git add package.json

git commit -m "Add automated build pipeline with electron-builder"
```

### Step 2: Push to Main Branch
```bash
git push origin main
```

### Step 3: Create Version Tag
```bash
# Bump version (choose one):
npm version patch    # 1.0.0 → 1.0.1 (patch fix)
npm version minor    # 1.0.0 → 1.1.0 (new feature)
npm version major    # 1.0.0 → 2.0.0 (breaking change)

# This automatically:
# - Updates package.json version
# - Creates git commit
# - Creates git tag (v1.0.1)
```

### Step 4: Push Tag to GitHub
```bash
git push origin --tags
```

### Step 5: Monitor GitHub Actions
1. Go to repository → Actions tab
2. Observe "Build and Release" workflow
3. Expected duration: 8-12 minutes
4. Workflow will:
   - Install dependencies
   - Build application
   - Generate checksums
   - Create GitHub Release
   - Upload artifacts

### Step 6: Verify Release
1. Go to repository → Releases page
2. Confirm v1.0.1 release created
3. Verify artifacts:
   - ArgentibiaLauncher-1.0.1-x64.exe
   - ArgentibiaLauncher-1.0.1-x64.zip
   - checksums.txt

## Release Checklist

Before publishing release to users:

### Artifact Verification
- [ ] Download installer from GitHub Release
- [ ] Verify file sizes (exe: 145-150 MB, zip: 140-145 MB)
- [ ] Verify checksums match checksums.txt

### Functional Testing
- [ ] Extract portable ZIP
- [ ] Launch ArgentibiaLauncher.exe from ZIP
- [ ] Window displays correctly
- [ ] No errors in console
- [ ] Game client updates work correctly

### Post-Release
- [ ] Update website/downloads page
- [ ] Update release announcements
- [ ] Monitor for user issues
- [ ] Keep GitHub Releases page current

## Troubleshooting

### Workflow Not Triggered
**Issue**: Pushed tag but workflow didn't start

**Solution**:
1. Verify tag format: v1.0.0 (not 1.0.0)
2. Check workflow file: `.github/workflows/release.yml`
3. Verify file is in correct directory: `.github/workflows/`
4. Check git push command: `git push origin --tags`

### Build Fails in GitHub Actions
**Common causes**:
- Node.js version mismatch (should be 20.x)
- npm cache issues (cleared automatically with caching)
- Electron download timeout (rare, retry workflow)

**Check logs**:
1. Go to Actions tab
2. Click failed workflow run
3. Expand "Build application" step
4. View full error message

### Release Not Created
**Issue**: Build succeeded but no release on Releases page

**Check**:
1. Verify build status: "Build application" step completed
2. Verify "Create Release" step succeeded
3. Check repository has GITHUB_TOKEN permission

## Rollback Procedure

If release needs to be pulled:

```bash
# Delete remote tag
git push origin :refs/tags/v1.0.1

# Delete local tag
git tag -d v1.0.1

# Delete GitHub Release
# (Via GitHub UI: Releases → Delete)
```

Then:
```bash
# Create patch release if needed
npm version patch
git push origin main --tags
```

## Distribution

### For Users

**Option 1: Installer (Recommended)**
- File: ArgentibiaLauncher-1.0.1-x64.exe
- Size: ~145 MB
- Installation: Automatic to %LOCALAPPDATA%\Programs\ArgentibiaLauncher
- Shortcuts: Start Menu + Desktop
- Uninstall: Via Programs and Features

**Option 2: Portable**
- File: ArgentibiaLauncher-1.0.1-x64.zip
- Size: ~142 MB
- Installation: Extract anywhere
- Execution: Run ArgentibiaLauncher.exe
- Portability: Can run from USB drive

### Verification
Users can verify authenticity:
```powershell
# Get file hash
$file = "ArgentibiaLauncher-1.0.1-x64.zip"
(Get-FileHash -Path $file -Algorithm SHA256).Hash

# Compare with checksums.txt from release
```

## Version Numbering (Semantic Versioning)

```
v1.0.1
├─ Major (1): Large breaking changes
├─ Minor (0): New features, backwards compatible
└─ Patch (1): Bug fixes only
```

Examples:
- v1.0.1: Bug fix (use `npm version patch`)
- v1.1.0: New feature (use `npm version minor`)
- v2.0.0: Breaking changes (use `npm version major`)

## Future Enhancements

### Code Signing
Implement in the future to eliminate SmartScreen warnings:
1. Obtain code signing certificate (~$300-500/year)
2. Add certificate to GitHub Secrets
3. Update workflow to use certificate
4. Update electron-builder.json signing config

### Auto-Update
Enable in-app updates:
1. Install `electron-updater`
2. Configure update channel (GitHub Releases)
3. Implement update UI in src/renderer.js
4. Test update flow

### Multiple Platforms
Expand to macOS and Linux:
1. Add build targets to electron-builder.json
2. Create platform-specific workflows in GitHub Actions
3. Test on each platform
4. Publish to respective app stores

## Support & Maintenance

### Monitoring Releases
- Check GitHub Issues for user reports
- Monitor release downloads statistics
- Track user feedback
- Plan updates based on feedback

### Regular Updates
- Security patches: Release as patch version (npm version patch)
- Features: Release as minor version (npm version minor)
- Major updates: Release as major version (npm version major)

### Communication
Keep users informed:
- Release notes in GitHub Releases (auto-generated)
- Update websites/documentation
- Announce major releases
- Provide migration guides for major versions

## Contacts & Resources

- Repository: https://github.com/[USERNAME]/luker-launcher
- Issues: https://github.com/[USERNAME]/luker-launcher/issues
- Releases: https://github.com/[USERNAME]/luker-launcher/releases
- Documentation: See BUILD.md
- Electron-builder: https://www.electron.build/

## Sign-Off

- [ ] All tests passed
- [ ] Documentation reviewed
- [ ] Release notes prepared
- [ ] Users notified
- [ ] Deployment complete

---

**Last Updated**: 2026-01-31
**Version**: 1.0.0
**Status**: Ready for production deployment
