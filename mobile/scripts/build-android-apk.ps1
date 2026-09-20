param(
  [ValidateSet("arm64-v8a")]
  [string]$Architecture = "arm64-v8a"
)

$ErrorActionPreference = "Stop"

$mobileRoot = [IO.Path]::GetFullPath((Join-Path $PSScriptRoot ".."))
$repositoryRoot = [IO.Directory]::GetParent($mobileRoot).FullName
$appConfig = Get-Content -Raw -LiteralPath (Join-Path $mobileRoot "app.json") | ConvertFrom-Json
$appVersion = $appConfig.expo.version
$defaultToolRoot = Join-Path $env:USERPROFILE ".cache\qiymetleri-android-build"
$javaHome = if ($env:JAVA_HOME) { $env:JAVA_HOME } else { Join-Path $defaultToolRoot "jdk17\jdk-17.0.20+8" }
$androidHome = if ($env:ANDROID_HOME) { $env:ANDROID_HOME } else { Join-Path $defaultToolRoot "android-sdk" }
$shortRoot = Join-Path $env:SystemDrive "qv2"

if (-not (Test-Path -LiteralPath (Join-Path $javaHome "bin\java.exe"))) {
  throw "JDK 17 was not found. Set JAVA_HOME before running this command."
}

if (-not (Test-Path -LiteralPath (Join-Path $androidHome "platform-tools"))) {
  throw "Android SDK was not found. Set ANDROID_HOME before running this command."
}

if (Test-Path -LiteralPath $shortRoot) {
  $existingRoot = Get-Item -LiteralPath $shortRoot
  $junctionTarget = @($existingRoot.Target)[0]
  if ($existingRoot.LinkType -ne "Junction" -or
      [IO.Path]::GetFullPath($junctionTarget) -ne [IO.Path]::GetFullPath($repositoryRoot)) {
    throw "$shortRoot already exists and does not point to $repositoryRoot."
  }
} else {
  New-Item -ItemType Junction -Path $shortRoot -Target $repositoryRoot | Out-Null
}

$env:JAVA_HOME = $javaHome
$env:ANDROID_HOME = $androidHome
$env:ANDROID_SDK_ROOT = $androidHome
$env:NODE_ENV = "production"
$env:Path = "$javaHome\bin;$androidHome\platform-tools;$env:Path"

$shortMobileRoot = Join-Path $shortRoot "mobile"
Push-Location $shortMobileRoot
try {
  & (Join-Path $shortMobileRoot "scripts\clean-native-build-cache.ps1")
  & npx expo prebuild --platform android --clean --no-install
  if ($LASTEXITCODE -ne 0) { throw "Expo prebuild failed." }

  & (Join-Path $shortMobileRoot "android\gradlew.bat") -p (Join-Path $shortMobileRoot "android") `
    :app:assembleRelease "-PreactNativeArchitectures=$Architecture" --no-daemon --console=plain --max-workers=2
  if ($LASTEXITCODE -ne 0) { throw "Gradle release build failed." }
} finally {
  Pop-Location
}

$sourceApk = Join-Path $shortMobileRoot "android\app\build\outputs\apk\release\app-release.apk"
$releaseRoot = Join-Path $mobileRoot "releases"
$releaseApk = Join-Path $releaseRoot "qiymetleri-$appVersion-$Architecture.apk"

New-Item -ItemType Directory -Path $releaseRoot -Force | Out-Null
Copy-Item -LiteralPath $sourceApk -Destination $releaseApk -Force
$hash = (Get-FileHash -Algorithm SHA256 -LiteralPath $releaseApk).Hash
Set-Content -LiteralPath "$releaseApk.sha256" -Value "$hash  $([IO.Path]::GetFileName($releaseApk))"

$buildTools = Get-ChildItem -LiteralPath (Join-Path $androidHome "build-tools") -Directory |
  Sort-Object Name -Descending |
  Select-Object -First 1
if (-not $buildTools) { throw "Android build tools were not found." }

$apkSigner = Join-Path $buildTools.FullName "apksigner.bat"
$aapt = Join-Path $buildTools.FullName "aapt.exe"
& $apkSigner verify --verbose $releaseApk
if ($LASTEXITCODE -ne 0) { throw "APK signature verification failed." }

$apkEntries = & $aapt list $releaseApk
if ($LASTEXITCODE -ne 0 -or $apkEntries -notcontains "assets/index.android.bundle") {
  throw "APK does not contain the standalone Android JavaScript bundle."
}

Write-Output "APK: $releaseApk"
Write-Output "SHA256: $hash"
