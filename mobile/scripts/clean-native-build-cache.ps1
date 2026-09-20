$ErrorActionPreference = "Stop"

$projectRoot = [IO.Path]::GetFullPath((Join-Path $PSScriptRoot ".."))
$targets = @(
  "node_modules\react-native-reanimated\android\.cxx",
  "node_modules\react-native-reanimated\android\build",
  "node_modules\react-native-worklets\android\.cxx",
  "node_modules\react-native-worklets\android\build",
  "node_modules\expo-modules-core\android\.cxx",
  "node_modules\expo-modules-core\android\build",
  "android\app\.cxx",
  "android\app\build"
)

foreach ($relativeTarget in $targets) {
  $target = [IO.Path]::GetFullPath((Join-Path $projectRoot $relativeTarget))
  if (-not $target.StartsWith($projectRoot, [StringComparison]::OrdinalIgnoreCase)) {
    throw "Refusing to remove a path outside the mobile project: $target"
  }
  if (Test-Path -LiteralPath $target) {
    Remove-Item -LiteralPath $target -Recurse -Force
  }
}

Write-Output "Native build caches removed."
