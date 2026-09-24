# DRAVIO Emulator Test Evidence - 20260921-101519

Device: emulator-5554 | SDK=36 | model=sdk_gphone64_x86_64 | abi=x86_64
Package: com.dravio.app | Metro: :8081 | API: http://127.0.0.1:8080/v1/health

## Results

| Step | Status | Detail |
|---|---|---|
| Tooling: adb | PASS | C:\Users\Admin\AppData\Local\Android\Sdk\platform-tools\adb.exe |
| Tooling: emulator | PASS | C:\Users\Admin\AppData\Local\Android\Sdk\emulator\emulator.exe |
| ANDROID_HOME | PASS | C:\Users\Admin\AppData\Local\Android\Sdk |
| JAVA_HOME | PASS | C:\Users\Admin\AppData\Local\Programs\jdk-21.0.12.1+1 |
| Mobile app dir | PASS | C:\Users\Admin\Desktop\DRAVIO\apps\mobile-app |
| node_modules | PASS | npm install required |
| API: Local backend 127.0.0.1:8080 | DOWN | unreachable: Unable to connect to the remote server |
| API: Prod API | DOWN | unreachable: Unable to connect to the remote server |
| Metro :8081 | PASS | expo start not detected |
| Emulator boot | PASS | device=emulator-5554 |
| Device online | PASS | emulator-5554 SDK=36 model=sdk_gphone64_x86_64 abi=x86_64 |
| Emulator: gateway 10.0.2.2 | PASS | PING 10.0.2.2 (10.0.2.2) 56(84) bytes of data. 64 bytes from 10.0.2.2: icmp_seq=1 ttl=255 time=2.50 ms  --- 10.0.2.2 ping statistics --- 1 packets transmitted, 1 received, 0% packet loss, time 0ms rtt min/avg/max/mdev = 2.503/2.503/2.503/0.000 ms |
| Emulator: API 10.0.2.2:8080 | NOT VERIFIED | curl unavailable in guest (/system/bin/sh: curl: inaccessible or not found) |
| App pre-installed (skip build) | PASS | package com.dravio.app |
| App launched | FAIL |  |
| Initial screen render | PASS | text: C:\Users\Admin |
| Initial screen error-state check | INFO | error signals:  |
| Tab 1 render | PASS | text: Digital Wellbeing isn't responding | Close app | Wait |
| Tab 2 render | PASS | text: Digital Wellbeing isn't responding | Close app | Wait |
| Tab 3 render | PASS | text: Digital Wellbeing isn't responding | Close app | Wait |
| Tab 4 render | PASS | text: Digital Wellbeing isn't responding | Close app | Wait |
| Tab 5 render | PASS | text: Digital Wellbeing isn't responding | Close app | Wait |
| logcat crash scan | PASS | signals: ; see logcat-full.log |
| meminfo | INFO |  TOTAL PSS: 240961 TOTAL RSS: 359584 TOTAL SWAP PSS: 194 |
| Screenshots captured | INFO | 6 PNGs in C:\Users\Admin\Desktop\DRAVIO\docs\testing\emulator-evidence-20260921-101519 |

## Artifacts

- Screenshots: home-initial.png tab1.png tab2.png tab3.png tab4.png tab5.png 
- UI dumps: home-initial.xml tab1.xml tab2.xml tab3.xml tab4.xml tab5.xml 
- Log: logcat-full.log, meminfo.txt, gradle-build.log

