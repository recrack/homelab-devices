# Citaq H10-3 Android POS

Citaq H10-3은 화면, 영수증 프린터, USB 포트가 한 본체에 들어간 Android POS입니다. 공개 프로젝트가 이 단말기를 Android 10으로 올리고 Home Assistant 키오스크로 활용한 사례를 제공합니다.

## 하드웨어 사양

| 항목 | 사양 |
|---|---|
| 모델·보드 | Citaq H10-3, CTE-RK3368-V1.0 |
| SoC | Rockchip RK3368, 8× Cortex-A53 |
| GPU | PowerVR G6110 |
| 메모리·저장공간 | RAM 2GB, eMMC 16GB |
| 화면 | 10인치 터치스크린, 1024×768 LVDS |
| 프린터 | 내장 80mm 영수증 프린터 |
| 연결 | Wi-Fi, Bluetooth, Ethernet, 3× USB; 일부 구성에 4G 모뎀 |
| 순정 소프트웨어 | Android 5.1.1, Linux 3.10 계열 |

보드와 무선·오디오 부품은 같은 외관에서도 다를 수 있습니다. 프로젝트의 대상은 `CTE-RK3368-V1.0` 보드, 16GB eMMC, `userdebug` 순정 빌드입니다. H10 이름이 붙은 다른 제품과 동일한 기기로 보지 않습니다.

## 공개 재활용 프로젝트

[Crux4000/citaq-h10-android10](https://github.com/Crux4000/citaq-h10-android10)은 PX5 Android 10 포트를 H10-3에 맞춰 Android 10, Linux 4.19.111, PowerVR GPU 가속 환경으로 구성합니다. 공개 README에는 터치, Wi-Fi, Bluetooth, 이더넷, 사운드, 밝기, 프린터, LED, USB와 Google Play 동작이 열거돼 있습니다.

[Home Assistant 안내](https://github.com/Crux4000/citaq-h10-android10/blob/main/docs/HOME-ASSISTANT.md)는 Companion 앱을 키오스크로 실행하고, ADB를 통해 화면 밝기·볼륨·LED를 제어하는 구성을 설명합니다. HA 패키지는 프린터로 텍스트·QR·이미지를 출력하는 기능도 제공합니다.

프로젝트의 [기기 보고 목록](https://github.com/Crux4000/citaq-h10-android10/blob/main/docs/DEVICES.md)에는 H10-3 여러 대에서 설치가 보고돼 있습니다. 다만 빌드와 부품 구성은 서로 달라질 수 있고, Citaq V8은 같은 보드를 쓰더라도 포트 상태가 미검증입니다.

## 사용 전 확인

- 이 포트는 eMMC에 기록합니다. 프로젝트는 전체 백업과 별도 복구 안내를 제공합니다.
- 정확한 보드, eMMC 용량, `userdebug` 빌드, 파티션 위치가 맞아야 합니다. 프로젝트의 검사 조건이 다르면 진행하지 않습니다.
- 설치 가이드는 케이스 개방과 내부 USB 연결을 요구합니다. 세부 조작은 원본 [INSTALL](https://github.com/Crux4000/citaq-h10-android10/blob/main/docs/INSTALL.md)과 [RECOVERY](https://github.com/Crux4000/citaq-h10-android10/blob/main/docs/RECOVERY.md)를 따릅니다.
- upstream 프로젝트 라이선스는 GPL-3.0-or-later이며, 이 카탈로그는 소스나 이미지를 복사하지 않습니다.

## 출처

- [Citaq Android 10 포트](https://github.com/Crux4000/citaq-h10-android10)
- [설치·복구 안내](https://github.com/Crux4000/citaq-h10-android10/tree/main/docs)
- [Home Assistant 연동 문서](https://github.com/Crux4000/citaq-h10-android10/blob/main/docs/HOME-ASSISTANT.md)
- [작성자의 Home Assistant 커뮤니티 사례](https://www.reddit.com/r/homeassistant/comments/1xyewbh/got_a_free_exmenulog_pos_terminal_made_it_an_ha/)
