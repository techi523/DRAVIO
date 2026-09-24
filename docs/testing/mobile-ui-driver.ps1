param(
    [string]$Serial = "emulator-5554",
    [ValidateSet("LoginAttempt", "SignupNavigate", "RegisterAttempt", "RestartPersistence")]
    [string]$Action = "LoginAttempt",
    [string]$Email = "test@dravio.io",
    [string]$Password = "Password123",
    [string]$EvidenceDir = ""
)

$adb = "C:\Users\Admin\AppData\Local\Android\Sdk\platform-tools\adb.exe"
$s = $Serial
if (-not $EvidenceDir) { $EvidenceDir = "C:\Users\Admin\Desktop\DRAVIO\docs\testing\emulator-evidence-" + (Get-Date -Format "yyyyMMdd-HHmmss") }
New-Item -ItemType Directory -Force -Path $EvidenceDir | Out-Null

$keyMap = @{
    'a'=29; 'b'=30; 'c'=31; 'd'=32; 'e'=33; 'f'=34; 'g'=35; 'h'=36; 'i'=37; 'j'=38; 'k'=39; 'l'=40; 'm'=41; 'n'=42; 'o'=43; 'p'=44; 'q'=45; 'r'=46; 's'=47; 't'=48; 'u'=49; 'v'=50; 'w'=51; 'x'=52; 'y'=53; 'z'=54;
    '0'=7; '1'=8; '2'=9; '3'=10; '4'=11; '5'=12; '6'=13; '7'=14; '8'=15; '9'=16;
    '@'=77; '.'=56; '-'=69; '_'=69; '!'=112; '#'=18; ' '=62
}

function Adb([string]$a) { & $adb -s $s shell $a 2>&1 }

function KeyType([string]$str) {
    foreach ($ch in $str.ToCharArray()) {
        $code = $keyMap[[string]$ch]
        if ($code) { Adb "input keyevent $code" | Out-Null; Start-Sleep -Milliseconds 80 }
    }
}

function UiTexts {
    $r = Adb "uiautomator dump /sdcard/_u.xml"
    if ($r -match "dumped") {
        $xml = (Adb "cat /sdcard/_u.xml") -join "`n"
        ([regex]::Matches($xml, 'text="([^"]+)"') | ForEach-Object { $_.Groups[1].Value } | Where-Object { $_.Trim().Length -gt 0 } | Select-Object -Unique) -join " | "
    } else { "(dump failed)" }
}

function Snap([string]$name) {
    Adb "screencap -p /sdcard/_s.png" | Out-Null
    & $adb -s $s pull /sdcard/_s.png (Join-Path $EvidenceDir "$name.png") 2>&1 | Out-Null
    "snap: $name"
}

function FieldTexts {
    Adb "uiautomator dump /sdcard/_u.xml" | Out-Null
    $xml = (Adb "cat /sdcard/_u.xml") -join "`n"
    [regex]::Matches($xml, '<node\b[^>]*class="android.widget.EditText"[^>]*>') | ForEach-Object {
        $t = [regex]::Match($_.Value, 'text="([^"]*)"').Groups[1].Value
        $d = [regex]::Match($_.Value, 'content-desc="([^"]*)"').Groups[1].Value
        "EditText desc='$d' text='$t'"
    }
}

function NodeFor([string]$matchText) {
    Adb "uiautomator dump /sdcard/_u.xml" | Out-Null
    $xml = (Adb "cat /sdcard/_u.xml") -join "`n"
    foreach ($m in [regex]::Matches($xml, '<node\b[^>]*>')) {
        $v = $m.Value
        if ($v -match 'content-desc="([^"]*)"' -and $matches[1] -eq $matchText) {
            $b = [regex]::Match($v, 'bounds="(\[[0-9,]+\]\[[0-9,]+\])"').Groups[1].Value
            if ($b -match '\[(\d+),(\d+)\]\[(\d+),(\d+)\]') {
                $cx = [int]([int]$matches[1] + [int]$matches[3]) / 2
                $cy = [int]([int]$matches[2] + [int]$matches[4]) / 2
                return "$cx,$cy"
            }
        }
    }
    return $null
}

function DismissKeyboard {
    Adb "input keyevent 4" | Out-Null
    Start-Sleep -Milliseconds 500
}

function GetText([string]$layer, [int]$tries = 6) {
    for ($i = 0; $i -lt $tries; $i++) {
        Start-Sleep -Seconds 3
        Adb "uiautomator dump /sdcard/_u.xml" | Out-Null
        $xml = (Adb "cat /sdcard/_u.xml") -join "`n"
        if ($xml -notmatch "No window contains") {
            if ($layer -eq "all") {
                $t = ([regex]::Matches($xml, 'text="([^"]+)"') | ForEach-Object { $_.Groups[1].Value } | Where-Object { $_.Trim().Length -gt 0 } | Select-Object -Unique) -join " | "
                return $t
            } elseif ($layer -eq "edits") {
                return ([regex]::Matches($xml, '<node\b[^>]*class="android.widget.EditText"[^>]*>') | ForEach-Object {
                    $t = [regex]::Match($_.Value, 'text="([^"]*)"').Groups[1].Value
                    "EditText text='$t'"
                }) -join " / "
            }
        }
    }
    return "(dump failed after $tries tries)"
}

function Tap([string]$center) {
    $splat = $center.Split(",")
    Adb "input tap $($splat[0]) $($splat[1])" | Out-Null
}

function ClearField {
    Adb "input keycombination 113 29" | Out-Null
    Start-Sleep -Milliseconds 300
    Adb "input keyevent 67" | Out-Null
    Start-Sleep -Milliseconds 300
}

function FieldFocused([string]$desc) {
    $xml = (Adb "cat /sdcard/_u.xml") -join "`n"
    [regex]::Matches($xml, '<node\b[^>]*class="android.widget.EditText"[^>]*>') | ForEach-Object {
        $v = $_.Value
        if ($v -match 'content-desc="' + [regex]::Escape($desc) + '"' -and $v -match 'focused="true"') { return $true }
    }
    return $false
}

function FillField([string]$desc, [string]$value, [string]$verify) {
    for ($attempt = 1; $attempt -le 3; $attempt++) {
        $c = NodeFor $desc
        if ($c) { Tap $c }
        Start-Sleep -Milliseconds 900
        $c2 = NodeFor $desc
        if ($c2 -and $c2 -ne $c) { Tap $c2; Start-Sleep -Milliseconds 500 }
        ClearField
        $run = ""
        foreach ($ch in $value.ToCharArray()) {
            if ($ch -eq "@" -or $ch -eq ".") {
                if ($run) { Adb "input text $run" | Out-Null; Start-Sleep -Milliseconds 120; $run = "" }
                $code = if ($ch -eq "@") { 77 } else { 56 }
                Adb "input keyevent $code" | Out-Null; Start-Sleep -Milliseconds 80
            } else {
                $run += $ch
            }
        }
        if ($run) { Adb "input text $run" | Out-Null; Start-Sleep -Milliseconds 120 }
        Start-Sleep -Milliseconds 500
        $got = GetText 'edits'
        if ($verify -eq "" -or $got -match $verify) { return "ok(attempt $attempt): $got" }
        Start-Sleep -Seconds 2
    }
    return "FAILED after 3 attempts: $got"
}

if ($Action -eq "LoginAttempt") {
    "=== LOGIN ATTEMPT (expect error: prod API is DOWN) ==="
    Adb "am force-stop com.dravio.app" | Out-Null; Start-Sleep -Seconds 2
    Adb "am start -n com.dravio.app/.MainActivity" | Out-Null
    Start-Sleep -Seconds 12
    Snap "login-0-started"

    "fill email (keycode-driven, dynamic center)"
    "email: " + (FillField "Email address" $Email "test@dravio")
    Snap "login-1-email"

    "fill password"
    "password: " + (FillField "Password" $Password "••••")
    Snap "login-2-password"

    "tap LOG IN"
    DismissKeyboard
    Start-Sleep -Milliseconds 800
    $lc = NodeFor "Log in"
    if (-not $lc) { $lc = "540,1900" }
    Tap $lc
    Start-Sleep -Seconds 9
    Snap "login-3-after-submit"
    "resulting screen: " + (GetText "all")
    "final edits: " + (GetText "edits")
}

if ($Action -eq "SignupNavigate") {
    "=== SIGNUP NAVIGATION ==="
    Adb "am force-stop com.dravio.app" | Out-Null; Start-Sleep -Seconds 2
    Adb "am start -n com.dravio.app/.MainActivity" | Out-Null
    Start-Sleep -Seconds 12
    Snap "signup-0-login"
    $sc = NodeFor "Create a new account"
    if (-not $sc) { $sc = "540,2064" }
    "signup button center: $sc"
    Tap $sc
    Start-Sleep -Seconds 5
    Snap "signup-1-after-tap"
    "resulting screen: " + (GetText "all")
}

function WaitFor([string]$needle, [int]$secs) {
    for ($i = 0; $i -lt [int]($secs / 3); $i++) {
        Start-Sleep -Seconds 3
        if ((GetText "all") -match $needle) { return $true }
    }
    return $false
}

function NodeLeft([string]$desc, [double]$frac) {
    Adb "uiautomator dump /sdcard/_u.xml" | Out-Null
    $xml = (Adb "cat /sdcard/_u.xml") -join "`n"
    foreach ($m in [regex]::Matches($xml, '<node\b[^>]*>')) {
        $v = $m.Value
        if ($v -match 'content-desc="([^"]*)"' -and $matches[1] -eq $desc) {
            $b = [regex]::Match($v, 'bounds="\[(\d+),(\d+)\]\[(\d+),(\d+)\]"')
            if ($b.Success) {
                $x = [int](([int]$b.Groups[1].Value + ([int]$b.Groups[3].Value - [int]$b.Groups[1].Value) * $frac))
                $y = [int](([int]$b.Groups[2].Value + [int]$b.Groups[4].Value) / 2)
                return "$x,$y"
            }
        }
    }
    return $null
}

if ($Action -eq "RegisterAttempt") {
    "=== REGISTRATION ATTEMPT (expect error: prod API is DOWN) ==="
    Adb "am force-stop com.dravio.app" | Out-Null; Start-Sleep -Seconds 2
    Adb "am start -n com.dravio.app/.MainActivity" | Out-Null
    Start-Sleep -Seconds 12

    "navigate to register (poll until present)"
    $sc = NodeFor "Create a new account"
    if (-not $sc) { $sc = "540,2064" }
    Tap $sc
    if (-not (WaitFor "CREATE YOUR ACCOUNT" 30)) {
        Tap $sc; Start-Sleep -Seconds 5
    }
    if (-not (WaitFor "CREATE YOUR ACCOUNT" 30)) { "WARN: register screen not confirmed" }
    Snap "register-0-screen"

    "role: buy data (default buyer)"
    $buy = NodeFor "Buy internet data"
    if ($buy) { Tap $buy; Start-Sleep -Milliseconds 600 }

    "agree to terms (tap checkbox left edge)"
    $agree = NodeLeft "Agree to Terms of Service and Privacy Policy" 0.1
    if ($agree) { Tap $agree; Start-Sleep -Milliseconds 600 }

    "email: " + (FillField "Email address" $Email "test@dravio")
    "password: " + (FillField "Password" $Password "text='[^']{8,}'")
    Snap "register-1-filled"

    "tap CREATE ACCOUNT"
    DismissKeyboard
    Start-Sleep -Milliseconds 800
    $cc = NodeFor "Create account"
    "create button: $cc"
    if ($cc) {
        Tap $cc
        Start-Sleep -Seconds 4
        Snap "register-2a-4s"
        "register screen at +4s: " + (GetText "all")
        Start-Sleep -Seconds 6
        Snap "register-2b-after-submit"
        "resulting screen: " + (GetText "all")
    } else {
        "FAIL: create account button not found; screen: " + (GetText "all")
    }
}

if ($Action -eq "RestartPersistence") {
    "=== APP RESTART PERSISTENCE ==="
    Adb "am force-stop com.dravio.app" | Out-Null
    Start-Sleep -Seconds 2
    Adb "am start -n com.dravio.app/.MainActivity" | Out-Null
    Start-Sleep -Seconds 10
    "pid after restart: " + (Adb "pidof com.dravio.app")
    Snap "restart-0-relaunch"
    "resulting screen: " + (UiTexts)
}