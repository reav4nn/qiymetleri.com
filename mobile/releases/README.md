# Android release

- File: `qiymetleri-1.0.1-arm64-v8a.apk`
- Package: `com.qiymetleri.app`
- Version: `1.0.1` (`versionCode` 2)
- Android: minimum SDK 24, target SDK 36
- ABI: ARM64 (`arm64-v8a`)
- SHA-256: `38138EA1BE05BF0657B88288A0E2E3E74D6FC276A1A719C8069B4E77D648EEB4`

This is a standalone, v2-signed internal release APK. The local build uses the
Android debug certificate and is intended for direct installation and QA, not
Play Store submission. The EAS `production` profile creates the store AAB with
managed release credentials after authenticating an Expo account. The APK includes
`assets/index.android.bundle`, so Expo Go and Metro are not required. The
catalogue and fallback product data are bundled; current remote images and live
API refreshes still require internet access. When live data is partial or
unavailable, the app identifies saved data and displays the snapshot date.
