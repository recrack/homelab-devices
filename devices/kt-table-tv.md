# KT 기가지니 테이블 TV 더 블랙

이 항목은 [SFF 갤러리 글 1802709](https://gall.dcinside.com/mgallery/board/view/?id=sff&no=1802709)과 [KT_TABLE_TV](https://github.com/dasjjl-svg/KT_TABLE_TV)가 다루는 같은 기기입니다. 글 제목은 “KT 기가지니 홈테이블 1세대로 HA구동하기 + 현재까지 확인된 정보 요약”이며, 별도 제품 항목으로 중복 등록하지 않습니다.

## 기기 식별과 사양

| 항목 | 값 |
|---|---|
| 모델 | CT1105-SB, 기가지니 테이블 TV 더 블랙 |
| SoC | HiSilicon Hi3798CV200, Cortex-A53 4코어, 작성자 보고 최대 1.6GHz |
| 메모리·저장공간 | DDR4-2133 2GB, eMMC 8GB, 부팅용 SPI NOR 4MiB |
| 화면 | 11.6인치, 1920×1080 |
| 오디오 | Harman Kardon 표기, 16W |
| 무선 | QCA6174A 듀얼밴드 Wi-Fi, Bluetooth 4.1, 전용 BLE 보드 |
| 순정 소프트웨어 | Android 5.1.1, Linux 3.18.24 계열 커널 |

세부 보드·메모리·무선 사양은 DC 글 작성자가 역분석과 실기기 확인 결과라고 보고한 값입니다. 이 카탈로그에서 별도로 재현하지 않았습니다. GitHub README도 대상 기기를 CT1105-SB, Android 5.1.1로 한정하고, 다른 KT 모델과 펌웨어 호환은 보장하지 않는다고 밝힙니다.

## 홈랩 활용 프로젝트

[KT_TABLE_TV](https://github.com/dasjjl-svg/KT_TABLE_TV)는 테이블 TV를 Home Assistant용 벽·탁상 대시보드로 활용하는 공개 프로젝트입니다.

웹 패널과 서버 소스의 보존본은 [소스 아카이브 사용 안내](../UPSTREAM.md)에서 확인할 수 있습니다.

- Android 5.1.1용 패널 앱과 서버, 한국어 설치·운영 문서를 제공합니다.
- 온습도·CO₂, 날씨·예보, Home Assistant 장면과 세탁기 상태를 표시합니다.
- 서버는 macOS, Ubuntu x86_64 Linux, Windows 11의 WSL2를 지원합니다. Windows 네이티브 서버와 Linux ARM64 빌드는 지원 범위에 없습니다.
- 공개 README는 앱 자동 실행, 리모컨 복귀, 원격 업데이트 및 복구 기능을 설명합니다.

README에는 기존 개인 설치에서 일부 동작을 확인했다고 적혀 있습니다. 새로운 사용자의 WSL LAN 통신과 새 기기 전체 설치는 현장 검증이 필요하다고도 밝힙니다.

## 별도 OS 구동 실험

같은 SFF 작성자가 홈테이블 TV에서 LineageOS 23.2를 구동했다고 올렸습니다. 게시물 사진에서 부팅 화면과 Android TV 액세서리 검색 화면을 확인했습니다. 기기 라벨, 배포 이미지, 초기 설정 이후의 리모컨·네트워크·오디오 동작은 그 글에서 확인되지 않았습니다. 위 Home Assistant 패널 프로젝트의 문서상 지원 환경은 `CT1105-SB`의 Android 5.1.1입니다. [SFF 구동 보고](https://m.dcinside.com/board/sff/1803888) · [KT_TABLE_TV 지원 범위](https://github.com/dasjjl-svg/KT_TABLE_TV#지원-범위와-검증)

## 출처

- [SFF 갤러리 1802709 원글](https://gall.dcinside.com/mgallery/board/view/?id=sff&no=1802709) — 기기 사양 보고와 프로젝트 소개
- [KT_TABLE_TV README](https://github.com/dasjjl-svg/KT_TABLE_TV) — 프로젝트 기능, 지원 OS, 검증 범위
- [설치 문서](https://github.com/dasjjl-svg/KT_TABLE_TV/tree/main/docs) — macOS·Linux·Windows 설치 안내
