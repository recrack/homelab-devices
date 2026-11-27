# Toss Front

토스 프론트는 세대별로 보드와 복구 도구가 다릅니다. 먼저 본체 라벨을 확인하고 해당 세대 문서만 참조합니다.

## 세대별 식별

| 라벨·세대 | 칩셋 | 현재 정리된 소프트웨어·도구 | 상태 |
|---|---|---|---|
| PLF00WH · 1세대 | 미상 | 검증된 설치 경로 없음 | 라벨만 확인됐고 칩셋·복구 방법은 미확인 |
| PLF02WH · 1.5세대 | Rockchip RK3399 | LineageOS 18.1 GSI, Windows용 RKDevTool, [FrontKit15](https://github.com/recrack/homelab-tossfront) | 기존 개인 저장소에 세대별 자료와 실행 도구가 정리돼 있음 |
| PLF20WH / PLF20BK · 2세대 | Qualcomm QCM4325 | Android 15 GSI, [TillKit](https://github.com/YuruDeveloper/tillkit), [bkerler/edl](https://github.com/bkerler/edl) | EDL 기반 도구와 수동 CLI 경로를 별도 관리 |

토스플레이스의 2세대 공개 사양은 7인치 1280×800 터치 LCD, RAM 3GB, 저장공간 32GB, 2W 스피커와 5MP 카메라 2개입니다. 화이트는 `PLF20WH`, 블랙은 `PLF20BK`로 식별합니다. [토스플레이스 제품 안내](https://toss.oopy.io/2c6714bb-fde7-81db-91df-fe45f7cf808f) · [국립전파연구원 인증](https://www.rra.go.kr/ko/license/A_b_popup_keyno.do?key_no=R-R-Tp0-PLF20WH)

1.5세대의 공개 빌더는 [kyseong00/toss-front-lineageos-builder](https://github.com/kyseong00/toss-front-lineageos-builder), 절차 문서는 [FLOVER124/toss-front-plf02wh-lineageos-guide](https://github.com/FLOVER124/toss-front-plf02wh-lineageos-guide)에서 확인할 수 있습니다. 2세대의 커뮤니티 자료는 [언락·GSI 안내](https://gall.dcinside.com/mgallery/board/view/?id=sff&no=1722612), [분해·EDL 진입 안내](https://gall.dcinside.com/mgallery/board/view/?id=sff&no=1750496)를 참조합니다.

## Home Assistant 활용 사례

- 모두의 스마트홈 작성자는 토스 프론트 1.5세대에 집 구조와 Home Assistant 기기를 표시하는 HTML 대시보드를 띄웠다고 보고했습니다. [1.5세대 대시보드 구동 후기](https://cafe.naver.com/stsmarthome/119146)
- 다른 작성자는 토스 프론트에 Immich 사진을 띄우고, 두 번 탭하면 Home Assistant 대시보드로 전환되게 구성했습니다. 글에 기기 세대는 나와 있지 않습니다. 이 구성에 사용한 Immich Frame Controller는 Home Assistant 애드온이나 Docker로 실행하며 액자별 화면 주소를 제공합니다. [전자액자 활용 후기](https://cafe.naver.com/stsmarthome/119950) · [Immich Frame Controller 소스](https://github.com/hyungyunlim/immich-ha-sa) · [한국어 안내](https://immich-frame.junlim.org/ko/)

## 프론트 2의 Spotify와 USB 마이크

한 SFF 작성자는 커스텀 LineageOS에서 Spotify가 Play 스토어 검색에 나오지 않았지만, APK를 따로 설치하자 실행됐다고 보고했습니다. Android가 마이크 기능을 보고하도록 빌드를 수정한 뒤에는 Play 스토어 검색에 나왔고, 외장 USB 무선 마이크로 녹음도 했습니다. 순정 펌웨어에서의 Spotify 노출과 USB 마이크 동작은 미확인입니다. [SFF 실사용 보고](https://m.dcinside.com/board/sff/1741473)

Google Play는 앱이 요구하는 기능을 기기가 지원한다고 보고하는지 확인합니다. `RECORD_AUDIO` 권한은 앱에서 마이크를 선택 기능으로 명시하지 않으면 `android.hardware.microphone` 요구로 해석될 수 있습니다. 이 규칙은 후기의 검색 결과를 설명할 수 있습니다. 해당 Spotify 빌드의 매니페스트와 필터 조건은 별도로 확인하지 않았습니다. [Android 개발자 문서](https://developer.android.com/guide/topics/manifest/uses-feature-element#permissions)

외장 마이크는 USB-C 전원 포트에 연결한 허브로 사용했습니다. 작성자 환경에서는 디버그용 microUSB 케이블을 빼야 허브와 기기 내장 이더넷이 동작했습니다. ADB도 쓸 경우에는 케이블을 빼기 전에 무선 ADB로 전환하라고 안내합니다. [SFF 연결 조건](https://m.dcinside.com/board/sff/1741473)

## 저장소

- [homelab-tossfront](https://github.com/recrack/homelab-tossfront) — 세대별 문서, 도구, 실행 체크리스트
- [TillKit](https://github.com/YuruDeveloper/tillkit) — 2세대 EDL용 Rust 도구, GPL-3.0
- [bkerler/edl](https://github.com/bkerler/edl) — EDL 수동 작업용 공개 CLI
- [rkdeveloptool](https://github.com/rockchip-linux/rkdeveloptool) — Rockchip 기기용 공개 CLI

## 확인 주의

- PLF02WH와 2세대는 칩셋, 진입 방식, 파티션 구조가 다릅니다. 도구·주소·이미지를 서로 섞지 않습니다.
- 기존 저장소는 백업 후 진행, 기기별 이미지 확인, 세대 구분을 요구합니다. 플래싱이나 EDL 작업은 기기 상태를 바꿀 수 있습니다.
- 위 결과는 특정 라벨과 커뮤니티 실험을 기준으로 정리했습니다. 모든 기기와 펌웨어에서의 호환성을 뜻하지 않습니다.

## 출처

- [homelab-tossfront](https://github.com/recrack/homelab-tossfront) 저장소의 세대별 문서 및 출처 목록
- [1.5세대 LineageOS 빌더](https://github.com/kyseong00/toss-front-lineageos-builder) · [설치 가이드](https://github.com/FLOVER124/toss-front-plf02wh-lineageos-guide)
- [TillKit](https://github.com/YuruDeveloper/tillkit) · [bkerler/edl](https://github.com/bkerler/edl) · [rkdeveloptool](https://github.com/rockchip-linux/rkdeveloptool)
- [SFF 1.5세대 안내글](https://gall.dcinside.com/mgallery/board/view/?id=sff&no=1728606) · [SFF 2세대 언락·GSI 안내](https://gall.dcinside.com/mgallery/board/view/?id=sff&no=1722612) · [SFF 분해·EDL 안내](https://gall.dcinside.com/mgallery/board/view/?id=sff&no=1750496)
