# winget manifests

Ringfold is published to the [Windows Package Manager](https://github.com/microsoft/winget-pkgs) as
`Kevin-Haus24.Ringfold`:

```powershell
winget install Kevin-Haus24.Ringfold
```

Each folder here holds the manifests submitted for one version.

## Submitting a new version

1. Publish the GitHub release first — the installer URL must be public.
2. Install the official tool once: `winget install Microsoft.WingetCreate`
3. Generate manifests for the new version from the previous ones:

   ```powershell
   wingetcreate update Kevin-Haus24.Ringfold --version X.Y.Z `
     --urls https://github.com/Kevin-Haus24/Ringfold/releases/download/vX.Y.Z/Ringfold-X.Y.Z-setup.exe `
     --out packaging/winget
   ```

4. Check them: `winget validate --manifest packaging/winget/manifests/k/Kevin-Haus24/Ringfold/X.Y.Z`
5. Submit: `wingetcreate submit <folder>` — it signs in to GitHub in the browser and opens a pull
   request to `microsoft/winget-pkgs`. Microsoft's bots test the installer; once merged, the
   version is available to everyone (usually within a day or two).

Notes:

- The installer is the NSIS `setup.exe`; it installs per user (`Scope: user`, `/currentuser`).
- `ProductCode` is the uninstall registry key electron-builder derives from the `appId`; it stays
  the same across versions as long as `appId` in `electron-builder.yml` does not change.
