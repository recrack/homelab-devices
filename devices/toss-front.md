# Toss Front

토스 프론트는 세대별로 보드와 복구 도구가 다릅니다. 먼저 본체 라벨을 확인하고 해당 세대 문서만 참조합니다.

## 세대별 식별

| 라벨·세대 | 칩셋 | 현재 정리된 소프트웨어·도구 | 상태 |
|---|---|---|---|
| PLF00WH · 1세대 | 미상 | 검증된 설치 경로 없음 | 라벨만 확인됐고 칩셋·복구 방법은 미확인 |
| PLF02WH · 1.5세대 | Rockchip RK3399 | LineageOS 18.1 GSI, Windows용 RKDevTool | [공개 설치 가이드](https://github.com/FLOVER124/toss-front-plf02wh-lineageos-guide)에 PLF02WH 실기기 기록이 있음 |
| PLF20WH / PLF20BK · 2세대 | Qualcomm QCM4325 | Android 15 GSI, [TillKit](https://github.com/YuruDeveloper/tillkit), [bkerler/edl](https://github.com/bkerler/edl) | EDL 기반 도구와 수동 CLI 경로를 별도 관리 |

토스플레이스의 2세대 공개 사양은 7인치 1280×800 터치 LCD, RAM 3GB, 저장공간 32GB, 2W 스피커와 5MP 카메라 2개입니다. 화이트는 `PLF20WH`, 블랙은 `PLF20BK`로 식별합니다. [토스플레이스 제품 안내](https://toss.oopy.io/2c6714bb-fde7-81db-91df-fe45f7cf808f) · [국립전파연구원 인증](https://www.rra.go.kr/ko/license/A_b_popup_keyno.do?key_no=R-R-Tp0-PLF20WH)

1.5세대의 공개 빌더는 [kyseong00/toss-front-lineageos-builder](https://github.com/kyseong00/toss-front-lineageos-builder), 절차 문서는 [FLOVER124/toss-front-plf02wh-lineageos-guide](https://github.com/FLOVER124/toss-front-plf02wh-lineageos-guide)에서 확인할 수 있습니다. 2세대의 커뮤니티 자료는 [언락·GSI 안내](https://gall.dcinside.com/mgallery/board/view/?id=sff&no=1722612), [분해·EDL 진입 안내](https://gall.dcinside.com/mgallery/board/view/?id=sff&no=1750496)를 참조합니다.

## Home Assistant 활용 사례

- 모두의 스마트홈 작성자는 토스 프론트 1.5세대에 집 구조와 Home Assistant 기기를 표시하는 HTML 대시보드를 띄웠다고 보고했습니다. [1.5세대 대시보드 구동 후기](https://cafe.naver.com/stsmarthome/119146)
- 다른 작성자는 토스 프론트에 Immich 사진을 띄우고, 두 번 탭하면 Home Assistant 대시보드로 전환되게 구성했습니다. 글에 기기 세대는 나와 있지 않습니다. 이 구성에 사용한 Immich Frame Controller는 Home Assistant 애드온이나 Docker로 실행하며 액자별 화면 주소를 제공합니다. [전자액자 활용 후기](https://cafe.naver.com/stsmarthome/119950) · [Immich Frame Controller 소스](https://github.com/hyungyunlim/immich-ha-sa) · [한국어 안내](https://immich-frame.junlim.org/ko/)

## 프론트 1.5의 USB-C 허브와 마이크

`PLF02WH`의 USB-C 전원 포트에서 USB 허브를 인식하거나 외장 USB 마이크로 녹음한 실기기 사례는 찾지 못했습니다. 공식 안내는 C타입 전원 연결을 설명합니다. 바닥의 5핀 microUSB를 PC에 연결한 기록은 있으며, 해당 포트의 OTG 호스트 동작은 미확인입니다. [토스플레이스 연결 안내](https://guide.tossplace.com/install/connect-overview) · [1.5세대 실기기 연결 기록](https://github.com/FLOVER124/toss-front-plf02wh-lineageos-guide/blob/main/README.md)

호환성을 확인할 때는 전원을 통과시키는 허브와 기기 정격(12V 2.5A)을 충족하는 전원을 사용합니다. 정상 부팅 후 같은 허브에 USB 마우스를 연결해 포인터가 뜨는지 확인합니다. 마우스가 동작하면 Android가 해당 연결에서 USB 호스트로 동작한 것입니다. 이후 USB Audio Class 1 호환 마이크로 녹음해 실제 입력을 확인합니다. 부팅이나 마우스 인식에 실패하면 해당 허브와 전원 조합의 결과로 기록합니다. [세대별 전원 사양 보고](https://gall.dcinside.com/mgallery/board/view/?id=sunmitechnology&no=21) · [AOSP USB 오디오 조건](https://source.android.com/docs/core/audio/usb#host-mode)

### 바닥 5핀 포트에 OTG 젠더 연결

USB-C로 기본 전원을 공급하면서 바닥 5핀 microUSB에 OTG 젠더를 꽂아 USB 마이크로 녹음한 `PLF02WH` 사례는 찾지 못했습니다. 5핀으로 유선 ADB가 연결될 때는 PC가 USB 호스트입니다. 마이크를 연결할 때는 프론트가 호스트가 되어야 하며, 해당 포트의 역할 전환은 보드 배선과 펌웨어 지원에 달려 있습니다. [USB-IF OTG 규격](https://www.usb.org/sites/default/files/otgeh_compliance_plan_1_2.pdf) · [Android USB 호스트 안내](https://developer.android.com/develop/connectivity/usb)

이 조합을 확인하려면 USB-C에 기본 전원을 연결한 상태에서 바닥 포트의 PC 케이블을 빼고 microUSB 수 → USB-A 암 OTG 젠더에 유선 마우스를 꽂습니다. 마우스 포인터가 움직이면 그 상태에서 UAC1 호환 마이크로 바꿔 실제 녹음과 재생을 확인합니다. [AOSP USB 오디오 조건](https://source.android.com/docs/core/audio/usb#host-mode)

## 프론트 2의 Spotify와 USB 마이크

한 SFF 작성자는 커스텀 LineageOS에서 Spotify가 Play 스토어 검색에 나오지 않았지만, APK를 따로 설치하자 실행됐다고 보고했습니다. Android가 마이크 기능을 보고하도록 빌드를 수정한 뒤에는 Play 스토어 검색에 나왔고, 외장 USB 무선 마이크로 녹음도 했습니다. 순정 펌웨어에서의 Spotify 노출과 USB 마이크 동작은 미확인입니다. [SFF 실사용 보고](https://m.dcinside.com/board/sff/1741473)

Google Play는 앱이 요구하는 기능을 기기가 지원한다고 보고하는지 확인합니다. `RECORD_AUDIO` 권한은 앱에서 마이크를 선택 기능으로 명시하지 않으면 `android.hardware.microphone` 요구로 해석될 수 있습니다. 이 규칙은 후기의 검색 결과를 설명할 수 있습니다. 해당 Spotify 빌드의 매니페스트와 필터 조건은 별도로 확인하지 않았습니다. [Android 개발자 문서](https://developer.android.com/guide/topics/manifest/uses-feature-element#permissions)

외장 마이크는 USB-C 전원 포트에 연결한 허브로 사용했습니다. 작성자 환경에서는 디버그용 microUSB 케이블을 빼야 허브와 기기 내장 이더넷이 동작했습니다. ADB도 쓸 경우에는 케이블을 빼기 전에 무선 ADB로 전환하라고 안내합니다. [SFF 연결 조건](https://m.dcinside.com/board/sff/1741473)

## 저장소

- [TillKit](https://github.com/YuruDeveloper/tillkit) — 2세대 EDL용 Rust 도구, GPL-3.0
- [bkerler/edl](https://github.com/bkerler/edl) — EDL 수동 작업용 공개 CLI
- [rkdeveloptool](https://github.com/rockchip-linux/rkdeveloptool) — Rockchip 기기용 공개 CLI

## 확인 주의

- PLF02WH와 2세대는 칩셋, 진입 방식, 파티션 구조가 다릅니다. 도구·주소·이미지를 서로 섞지 않습니다.
- 플래싱이나 EDL 작업 전에 데이터를 백업하고 기기 모델과 이미지의 지원 범위를 확인합니다.
- 위 결과는 특정 라벨과 커뮤니티 실험을 기준으로 정리했습니다. 모든 기기와 펌웨어에서의 호환성을 뜻하지 않습니다.

## 출처

- [1.5세대 LineageOS 빌더](https://github.com/kyseong00/toss-front-lineageos-builder) · [설치 가이드](https://github.com/FLOVER124/toss-front-plf02wh-lineageos-guide)
- [TillKit](https://github.com/YuruDeveloper/tillkit) · [bkerler/edl](https://github.com/bkerler/edl) · [rkdeveloptool](https://github.com/rockchip-linux/rkdeveloptool)
- [SFF 1.5세대 안내글](https://gall.dcinside.com/mgallery/board/view/?id=sff&no=1728606) · [SFF 2세대 언락·GSI 안내](https://gall.dcinside.com/mgallery/board/view/?id=sff&no=1722612) · [SFF 분해·EDL 안내](https://gall.dcinside.com/mgallery/board/view/?id=sff&no=1750496)
