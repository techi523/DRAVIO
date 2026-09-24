# =============================================================================
# DRAVIO Emulator Test Harness
# -----------------------------------------------------------------------------
# Extensive end-to-end smoke + UI testing of the DRAVIO mobile app on a local
# Android emulator. Everything observed is recorded to a Markdown evidence
# report and a machine-readable JSON result file. Nothing is fabricated:
# unreachable backends, pending builds, and missing packages are reported as
# BLOCKED / NOT VERIFIED.
#
# Usage (PowerShell 5.1):
#   powershell -ExecutionPolicy Bypass -File .\emulator-test-harness.ps1
#   powershell -ExecutionPolicy Bypass -File .\emulator-test-harness.ps1 -SkipBuild
#
# Requires: adb, Android SDK, JAVA_HOME -> compatible JDK for the Gradle build.
# =============================================================================

param(
    [string]$AvdName = "dravio-test",
    [string]$PackageName = "com.dravio.app",
    [string]$Activity = "com.dravio.app/.MainActivity",
    [int]$MetroPort = 8081,
    [string]$ApiHost = "10.0.2.2",      # emulator gateway to host
    [int]$ApiPort = 8080,
    [string]$ApiProd = "https://api.dravio.app/v1/health",
    [switch]$SkipBuild,                  # do not run the Gradle build / install
    [switch]$KeepRunning                 # leave emulator + metro running at the end
)

$ErrorActionPreference = "Continue"
$ProgressPreference = "SilentlyContinue"

# ---------------------------------------------------------------------------
# Locate tools
# ---------------------------------------------------------------------------
$sdkRoot = if ($env:ANDROID_HOME) { $env:ANDROID_HOME }
           elseif ($env:ANDROID_SDK_ROOT) { $env:ANDROID_SDK_ROOT }
           else { "C:\Users\Admin\AppData\Local\Android\Sdk" }

$adb = $null
foreach ($cand in @((Join-Path $sdkRoot "platform-tools\adb.exe"), "adb")) {
    $found = Get-Command $cand -ErrorAction SilentlyContinue
    if ($found) { $adb = $cand; break }
    if ($cand -like "*adb.exe" -and (Test-Path -LiteralPath $cand)) { $adb = $cand; break }
}
if (-not $adb) { throw "adb not found. Set ANDROID_HOME or install platform-tools." }

$emulator = $null
foreach ($cand in @((Join-Path $sdkRoot "emulator\emulator.exe"), "emulator")) {
    if ($cand -like "*emulator.exe" -and (Test-Path -LiteralPath $cand)) { $emulator = $cand; break }
    $f = Get-Command $cand -ErrorAction SilentlyContinue
    if ($f) { $emulator = $cand; break }
}

$mobile = Join-Path (Split-Path $PSScriptRoot -Parent -ErrorAction SilentlyContinue) "mobile-app"
if (-not (Test-Path -LiteralPath $mobile)) { $mobile = "C:\Users\Admin\Desktop\DRAVIO\apps\mobile-app" }

# Locate a usable JDK for the Gradle build. Gradlew refuses to run without
# JAVA_HOME or java on PATH, so the harness must supply one.
function Resolve-JavaHome {
    $gp = Join-Path $mobile "android\gradle.properties"
    if (Test-Path -LiteralPath $gp) {
        $j = [regex]::Match((Get-Content -LiteralPath $gp -Raw), "(?im)^org\.gradle\.java\.home\s*=\s*(.+)\s*$")
        if ($j.Success) {
            $p = $j.Groups[1].Value.Trim()
            if (Test-Path -LiteralPath (Join-Path $p "bin\java.exe")) { return $p }
        }
    }
    foreach ($p in @("C:\Program Files\Android\Android Studio\jbr", (Join-Path $sdkRoot "..\jbr"))) {
        if (Test-Path -LiteralPath (Join-Path $p "bin\java.exe")) { return $p }
    }
    $cands = @()
    $cands += Get-ChildItem "C:\Program Files\Eclipse Adoptium" -Directory -ErrorAction SilentlyContinue |
        ForEach-Object { $_.FullName }
    if ($env:USERPROFILE) {
        $cands += Get-ChildItem (Join-Path $env:USERPROFILE ".jdks") -Directory -ErrorAction SilentlyContinue |
            ForEach-Object { $_.FullName }
    }
    foreach ($c in $cands) { if (Test-Path -LiteralPath (Join-Path $c "bin\java.exe")) { return $c } }
    return $null
}

# ---------------------------------------------------------------------------
# Output / results plumbing
# ---------------------------------------------------------------------------
$ts = Get-Date -Format "yyyyMMdd-HHmmss"
$outDir = Join-Path $PSScriptRoot "emulator-evidence-$ts"
$null = New-Item -ItemType Directory -Force -Path $outDir
$logFile = Join-Path $outDir "harness.log"

function Log([string]$Level, [string]$Msg) {
    $line = "[$Level] $Msg"
    Add-Content -LiteralPath $logFile -Value $line
    Write-Host $line
}

$script:results = @()
$script:activeSerial = $null

function Record([string]$Step, [string]$Status, [string]$Detail) {
    $script:results += [pscustomobject]@{ Step = $Step; Status = $Status; Detail = $Detail }
    Log $Status "$Step - $Detail"
}

function Invoke-Adb {
    param([string[]]$A, [switch]$Silent)
    $out = & $adb @A 2>&1
    $out | ForEach-Object { "$_" }
}

function Shot([string]$Name) {
    if (-not $activeSerial) { return }
    $null = & $adb -s $activeSerial shell screencap -p /sdcard/dravio_shot.png 2>&1
    $null = & $adb -s $activeSerial pull /sdcard/dravio_shot.png (Join-Path $outDir "$Name.png") 2>&1
}

function UiDump([string]$Name, [int]$Retries = 4, [int]$RetryMs = 5000) {
    if (-not $activeSerial) { return }
    for ($attempt = 0; $attempt -le $Retries; $attempt++) {
        $null = & $adb -s $activeSerial shell uiautomator dump /sdcard/dravio_ui.xml 2>&1
        $null = & $adb -s $activeSerial pull /sdcard/dravio_ui.xml (Join-Path $outDir "$Name.xml") 2>&1
        $path = Join-Path $outDir "$Name.xml"
        if (Test-Path -LiteralPath $path) {
            $text = Get-Content -LiteralPath $path -Raw -ErrorAction SilentlyContinue
            if ($text) {
                $nodes = [regex]::Matches($text, 'text="([^"]+)"') | ForEach-Object { $_.Groups[1].Value } |
                    Where-Object { $_.Trim().Length -gt 0 } | Select-Object -Unique
                if ($nodes) { return ($nodes -join " | ") }
            }
        }
        if ($attempt -lt $Retries) { WaitMs $RetryMs }
    }
    return ""
}

function Tap([double]$FracX, [double]$FracY) {
    if (-not $activeSerial) { return }
    $size = (Invoke-Adb -A @("-s", $activeSerial, "shell", "wm", "size") -Silent) | Select-String "(\d+)x(\d+)"
    if ($size) {
        $m = [regex]::Match($size.Line, "(\d+)x(\d+)")
        $w = [int]$m.Groups[1].Value; $h = [int]$m.Groups[2].Value
        $x = [int]($w * $FracX); $y = [int]($h * $FracY)
        $null = & $adb -s $activeSerial shell "input touchscreen tap $x $y" 2>&1
    }
}

function WaitMs([int]$Ms) { Start-Sleep -Milliseconds $Ms }

# ---------------------------------------------------------------------------
# 1. PREFLIGHT
# ---------------------------------------------------------------------------
Log INFO "=== PREFLIGHT ==="
Record "Tooling: adb" $(if ($adb) { "PASS" } else { "BLOCKED" }) $adb
Record "Tooling: emulator" $(if ($emulator) { "PASS" } else { "BLOCKED" }) "$emulator"
Record "ANDROID_HOME" $(if ($env:ANDROID_HOME -or $env:ANDROID_SDK_ROOT) { "PASS" } else { "WARN" }) "$sdkRoot"
$jdkResolved = Resolve-JavaHome
Record "JAVA_HOME" $(if ($env:JAVA_HOME) { "PASS" } else { "WARN" }) "$env:JAVA_HOME"
if (-not $env:JAVA_HOME -and $jdkResolved) {
    Log INFO "Using resolved JDK for Gradle: $jdkResolved"
    $env:JAVA_HOME = "$jdkResolved"
    Record "JDK resolved" "PASS" $jdkResolved
}
if (-not (Test-Path -LiteralPath $mobile)) {
    Record "Mobile app dir" "BLOCKED" $mobile
    throw "$mobile does not exist."
}
Record "Mobile app dir" "PASS" $mobile
$nmPath = Join-Path $mobile "node_modules"
Record "node_modules" $(if (Test-Path -LiteralPath $nmPath) { "PASS" } else { "BLOCKED" }) $(if (Test-Path -LiteralPath $nmPath) { "present at $nmPath" } else { "npm install required" })

# API probes (host side)
$apiLocal = "http://127.0.0.1:$ApiPort/v1/health"
foreach ($probe in @(@("Local backend 127.0.0.1:$ApiPort", $apiLocal), @("Prod API", $ApiProd))) {
    $nameSrc = $probe[0]; $url = $probe[1]
    try {
        $r = Invoke-WebRequest -Uri $url -Method Head -TimeoutSec 6 -UseBasicParsing -ErrorAction Stop
        Record "API: $nameSrc" "PASS" "HTTP $($r.StatusCode)"
    } catch {
        Record "API: $nameSrc" "DOWN" "unreachable: $($_.Exception.Message)"
    }
}

# Metro probe
$metroUp = $false
$metroDetail = "no listener on :$MetroPort"
try {
    $mconn = Get-NetTCPConnection -LocalPort $MetroPort -State Listen -ErrorAction Stop
    if ($mconn) {
        $metroUp = $true
        $procs = $mconn | Select-Object -ExpandProperty OwningProcess -Unique |
            ForEach-Object { (Get-Process -Id $_ -ErrorAction SilentlyContinue).ProcessName } |
            Where-Object { $_ }
        $metroDetail = "listener on :$MetroPort" + $(if ($procs) { " ($($procs -join ','))" } else { "" })
    }
} catch { }
Record "Metro :$MetroPort" $(if ($metroUp) { "PASS" } else { "DOWN" }) $metroDetail

# ---------------------------------------------------------------------------
# 2. EMULATOR availability (start if needed)
# ---------------------------------------------------------------------------
$deviceList = (Invoke-Adb -A @("devices"))
$activeSerial = $null
foreach ($line in $deviceList) {
    if ("$line" -match "^(\S+)\s+device\b") { $activeSerial = $Matches[1]; break }
}

if (-not $activeSerial -and $emulator) {
    Log INFO "No online device; launching emulator '$AvdName' headless."
    $proc = Start-Process -FilePath $emulator -ArgumentList "-avd", $AvdName, "-no-snapshot", "-no-audio", "-no-boot-anim", "-no-window", "-gpu", "swiftshader_indirect", "-no-metrics" -WindowStyle Hidden -PassThru
    $booted = $false
    for ($i = 0; $i -lt 60; $i++) {
        Start-Sleep -Seconds 10
        $b = & $adb -s emulator-5554 shell getprop sys.boot_completed 2>$null | ForEach-Object { "$_".Trim() }
        if ($b -eq "1") { $booted = $true; $activeSerial = "emulator-5554"; break }
    }
    Record "Emulator boot" $(if ($booted) { "PASS" } else { "BLOCKED" }) "dravio-test boot_completed=$b"
} else {
    Record "Emulator boot" $(if ($activeSerial) { "PASS" } else { "BLOCKED" }) "device=$activeSerial"
}

if (-not $activeSerial) {
    Record "Device online" "BLOCKED" "no adb device available"
    # still write the report skeleton
} else {
    $sdkVer = (Invoke-Adb -A @("-s", $activeSerial, "shell", "getprop", "ro.build.version.sdk")) -join ""
    $model  = (Invoke-Adb -A @("-s", $activeSerial, "shell", "getprop", "ro.product.model")) -join ""
    $abi    = (Invoke-Adb -A @("-s", $activeSerial, "shell", "getprop", "ro.product.cpu.abi")) -join ""
    Record "Device online" "PASS" "$activeSerial SDK=$sdkVer model=$model abi=$abi"

    # In-guest gateway + API reachability
    $gw = (Invoke-Adb -A @("-s", $activeSerial, "shell", "ping", "-c", "1", "-W", "2", "10.0.2.2")) -join "`n"
    Record "Emulator: gateway 10.0.2.2" $(if ($gw -match "1 received") { "PASS" } else { "FAIL" }) ($gw -replace "`n", " ")
    $httpProbe = $null
    try {
        $httpProbe = Invoke-Adb -A @("-s", $activeSerial, "shell", "curl", "-m", "5", "-k", "-s", "-o", "/dev/null", "-w", "%{http_code}", "http://10.0.2.2:$ApiPort/v1/health")
    } catch { }
    $probeCode = ($httpProbe -join "").Trim()
    if ($probeCode -match "^\d+$") {
        Record "Emulator: API 10.0.2.2:$ApiPort" $(if ($probeCode -eq "200") { "PASS" } else { "DOWN" }) "http code: $probeCode"
    } else {
        Record "Emulator: API 10.0.2.2:$ApiPort" "NOT VERIFIED" "curl unavailable in guest ($probeCode)"
    }
}

# ---------------------------------------------------------------------------
# 3. BUILD & INSTALL
# ---------------------------------------------------------------------------
if (-not $SkipBuild -and $activeSerial) {
    Log INFO "=== BUILD & INSTALL (Gradle assembleDebug) ==="
    $env:ANDROID_HOME = $sdkRoot; $env:ANDROID_SDK_ROOT = $sdkRoot
    if (-not $env:JAVA_HOME) {
        $jd = Resolve-JavaHome
        if ($jd) { $env:JAVA_HOME = "$jd" }
    }
    $gradlew = Join-Path $mobile "android\gradlew.bat"
    if (-not (Test-Path -LiteralPath $gradlew)) {
        Record "Prebuild" "BLOCKED" "android/ not generated (run: npx expo prebuild --platform android)"
    } elseif (-not $env:JAVA_HOME) {
        Record "Gradle assembleDebug" "BLOCKED" "JAVA_HOME empty and no JDK found (gradlew aborts: java not on PATH)"
    } else {
        Record "Prebuild" "PASS" "android/ present"
        Log INFO "Running: $gradlew assembleDebug (this may take a long time on first run)"
        $buildLog = Join-Path $outDir "gradle-build.log"
        Push-Location (Join-Path $mobile "android")
        try {
            & $gradlew assembleDebug "-PreactNativeDevServerPort=$MetroPort" "-PreactNativeArchitectures=x86_64" *> $buildLog
            $code = $LASTEXITCODE
        } finally { Pop-Location }
        Record "Gradle assembleDebug" $(if ($code -eq 0) { "PASS" } else { "FAIL" }) "exit=$code log=$buildLog"
        if ($code -eq 0) {
            $apk = Get-ChildItem -Recurse -LiteralPath (Join-Path $mobile "android") -Filter "*.apk" |
                Where-Object { $_.FullName -match "app-debug" } | Select-Object -First 1
            if ($apk) {
                Record "APK found" "PASS" "$($apk.FullName) ($([math]::Round($apk.Length/1MB,1)) MB)"
                $null = & $adb -s $activeSerial install -r $apk.FullName 2>&1
                $installed = (Invoke-Adb -A @("-s", $activeSerial, "shell", "pm", "list", "packages")) -join "`n"
                Record "Install + register" $(if ($installed -match $PackageName) { "PASS" } else { "FAIL" }) "pm sees $PackageName"
            } else {
                Record "APK found" "FAIL" "no app-debug.apk produced"
            }
        }
    }
} elseif (-not $activeSerial) {
    Record "Build+install" "BLOCKED" "no device"
} else {
    $installed = (Invoke-Adb -A @("-s", $activeSerial, "shell", "pm", "list", "packages")) -join "`n"
    Record "App pre-installed (skip build)" $(if ($installed -match $PackageName) { "PASS" } else { "BLOCKED" }) "package $PackageName"
}

# ---------------------------------------------------------------------------
# 4. LAUNCH & METRO
# ---------------------------------------------------------------------------
$metroStarted = $false
if ($activeSerial) {
    Log INFO "=== LAUNCH ==="
    $null = & $adb -s $activeSerial reverse tcp:$MetroPort tcp:$MetroPort 2>&1
    if (-not $metroUp -and -not $SkipBuild) {
        Log INFO "Starting Metro (expo start) in background on :$MetroPort"
        $metro = Start-Process -FilePath "npx.cmd" -ArgumentList "expo", "start", "--port", "$MetroPort", "--no-interactive" -WorkingDirectory $mobile -WindowStyle Hidden -RedirectStandardOutput (Join-Path $outDir "metro.log") -RedirectStandardError (Join-Path $outDir "metro.err.log") -PassThru
        $metroStarted = $true
        Start-Sleep -Seconds 20
    }
    $null = & $adb -s $activeSerial shell am force-stop $PackageName 2>&1
    Start-Sleep -Seconds 2
    $null = & $adb -s $activeSerial logcat -c 2>&1
    $null = & $adb -s $activeSerial shell am start -n $Activity 2>&1
    $launched = ""
    for ($i = 0; $i -lt 20; $i++) {
        Start-Sleep -Seconds 3
        $resumed = ""
        try {
            $resumed = ((Invoke-Adb -A @("-s", $activeSerial, "shell", "dumpsys", "activity", "activities")) |
                Select-String "topResumedActivity=.*com\.dravio|ResumedActivity.*com\.dravio" | Select-Object -First 1).ToString()
        } catch { }
        if ($resumed -match $PackageName) {
            $launched = $resumed
            break
        }
        $launched = ($launched + ($resumed.Trim()))
    }
    Record "App launched" $(if ($launched -match $PackageName) { "PASS" } else { "FAIL" }) $launched
}

# ---------------------------------------------------------------------------
# 5. UI WALKTHROUGH
# ---------------------------------------------------------------------------
function EnsureAppForeground {
    # If the app got backgrounded (e.g. a tap hit gesture-nav), bring it back
    # before continuing so the walkthrough always verifies the app's own UI.
    $resumed = ""
    try {
        $resumed = ((Invoke-Adb -A @("-s", $activeSerial, "shell", "dumpsys", "activity", "activities")) |
            Select-String "topResumedActivity=.*com\.dravio|ResumedActivity.*com\.dravio" | Select-Object -First 1).ToString()
    } catch { }
    if ($resumed -notmatch $PackageName) {
        $null = & $adb -s $activeSerial shell am start -n $Activity 2>&1
        WaitMs 3000
    }
}

function IsLauncherText([string]$T) {
    return ($T -match "Gmail|Photos|YouTube|Phone|Messages|Chrome|nexuslauncher|Recent")
}

function WaitForAppContent([string]$Name, [int]$MaxAttempts = 8) {
    # Dump repeatedly until the app's own UI text is present (not empty, and
    # not the system launcher page), refocusing the app each time. Lets slow
    # cold starts (bundle fetch + JS boot) settle before we judge the screen.
    $ui = ""
    for ($a = 0; $a -lt $MaxAttempts; $a++) {
        EnsureAppForeground
        $ui = UiDump $Name 1 4000
        if ($ui -and -not (IsLauncherText $ui)) { return $ui }
        WaitMs 3000
    }
    return $ui
}

function NavigateTabs {
    param([int]$ScreenW, [int]$ScreenH)
    # 5 bottom tabs, evenly spaced; 0.94 scans above the gesture-nav region so
    # taps reach in-app UI instead of homing out.
    $tabs = @(@(0.1, 0.94), @(0.3, 0.94), @(0.5, 0.94), @(0.7, 0.94), @(0.9, 0.94))
    for ($i = 0; $i -lt $tabs.Count; $i++) {
        EnsureAppForeground
        Tap $tabs[$i][0] $tabs[$i][1]
        Start-Sleep -Seconds 6
        $ui = UiDump "tab$($i+1)"
        Shot "tab$($i+1)"
        Record "Tab $($i+1) render" $(if ($ui) { "PASS" } else { "WARN" }) "text: $($ui.Substring(0, [Math]::Min(220, $ui.Length)))"
    }
}

if ($activeSerial) {
    Log INFO "=== UI WALKTHROUGH ==="
    $initialUi = WaitForAppContent "home-initial"; Shot "home-initial"
    Record "Initial screen render" $(if ($initialUi) { "PASS" } else { "WARN" }) "text: $($initialUi.Substring(0, [Math]::Min(220, $initialUi.Length)))"
    $errWords = @("error", "failed", "unable", "offline", "no connection", "retry", "network")
    $inHome = ($initialUi.ToLower())
    $hit = @($errWords | Where-Object { $inHome.Contains($_) })
    Record "Initial screen error-state check" $(if ($hit.Count) { "PASS" } else { "INFO" }) "error signals: $($hit -join ', ')"
    NavigateTabs

    # Connection attempt signal (only if the app exposes connect UI; we note any
    # success/confirmation and otherwise record what is missing honestly).
    Start-Sleep -Seconds 3
}

# ---------------------------------------------------------------------------
# 6. LOG / MEMORY CAPTURE
# ---------------------------------------------------------------------------
if ($activeSerial) {
    Log INFO "=== LOG / MEMORY ==="
    $lc = & $adb -s $activeSerial logcat -d 2>&1
    $lc | Set-Content -LiteralPath (Join-Path $outDir "logcat-full.log")
    $crash = $lc -join "`n"
    $crashSeen = @()
    if ($crash -match "AndroidRuntime.*FATAL|FATAL EXCEPTION") { $crashSeen += "FATAL-exception" }
    if ($crash -match "ReactNativeJS.*DRAVIO FATAL") { $crashSeen += "DRAVIO-FATAL" }
    if ($crash -match "ReactNativeJS.*TypeError|undefined is not an object") { $crashSeen += "JS-error" }
    Record "logcat crash scan" $(if ($crashSeen.Count -eq 0) { "PASS" } else { "FAIL" }) "signals: $($crashSeen -join ', '); see logcat-full.log"
    $mem = & $adb -s $activeSerial shell dumpsys meminfo $PackageName 2>&1
    $mem | Set-Content -LiteralPath (Join-Path $outDir "meminfo.txt")
    $pss = ($mem | Select-String "TOTAL PSS" | Select-Object -First 1) -replace "\s+", " "
    Record "meminfo" "INFO" "$pss"
    $props = & $adb -s $activeSerial shell dumpsys window displays 2>&1
    $props | Select-String "init=" | Select-Object -First 2 | ForEach-Object { Log INFO "display: $_" }
    Record "Screenshots captured" "INFO" ("$((Get-ChildItem -LiteralPath $outDir -Filter '*.png').Count) PNGs in $outDir")
}

# ---------------------------------------------------------------------------
# 7. REPORT
# ---------------------------------------------------------------------------
Log INFO "=== REPORT ==="
$report = Join-Path $outDir "REPORT.md"
$sb = New-Object System.Text.StringBuilder
$null = $sb.AppendLine("# DRAVIO Emulator Test Evidence - $ts")
$null = $sb.AppendLine("")
$null = $sb.AppendLine("Device: $activeSerial | SDK=$sdkVer | model=$model | abi=$abi")
$null = $sb.AppendLine("Package: $PackageName | Metro: :$MetroPort | API: $apiLocal")
$null = $sb.AppendLine("")
$null = $sb.AppendLine("## Results")
$null = $sb.AppendLine("")
$null = $sb.AppendLine("| Step | Status | Detail |")
$null = $sb.AppendLine("|---|---|---|")
foreach ($r in $results) {
    $null = $sb.AppendLine("| $($r.Step) | $($r.Status) | $($r.Detail) |")
}
$null = $sb.AppendLine("")
$null = $sb.AppendLine("## Artifacts")
$null = $sb.AppendLine("")
$null = $sb.AppendLine("- Screenshots: $(Get-ChildItem -LiteralPath $outDir -Filter '*.png' | Select-Object -ExpandProperty Name) ")
$null = $sb.AppendLine("- UI dumps: $(Get-ChildItem -LiteralPath $outDir -Filter '*.xml' | Select-Object -ExpandProperty Name) ")
$null = $sb.AppendLine("- Log: logcat-full.log, meminfo.txt, gradle-build.log")
Set-Content -LiteralPath $report -Value $sb.ToString() -Encoding UTF8

$json = [pscustomobject]@{
    timestamp = $ts
    device = $activeSerial
    sdk = $sdkVer
    package = $PackageName
    steps = $results
}
($json | ConvertTo-Json -Depth 5) | Set-Content -LiteralPath (Join-Path $outDir "result.json") -Encoding UTF8

Log INFO "Report written to $report"
Log INFO "Complete. All artifacts in $outDir"

if (-not $KeepRunning -and $metroStarted) {
    Stop-Process -Name "node" -Force -ErrorAction SilentlyContinue
}