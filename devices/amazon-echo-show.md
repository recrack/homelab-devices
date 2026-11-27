# Amazon Echo Show

Echo Show는 화면과 마이크·스피커를 갖춘 Amazon 스마트 디스플레이입니다. Echo Show 5/8의 일부 세대에는 Home Assistant용 Kiosk Satellite를 포함한 별도 LineageOS 이미지가 공개돼 있습니다.

## 대상 모델

| 모델 | 프로젝트 코드명 | 식별 모델 | 홈랩 지원 |
|---|---|---|---|
| Echo Show 5 1세대 | `checkers` | H23K37 | LineageOS 18.1 Kiosk Satellite 이미지 |
| Echo Show 5 2세대 | `cronos` | C76N8S | LineageOS 18.1 Kiosk Satellite 이미지 |
| Echo Show 8 1세대 | `crown` | C7H6N3 | LineageOS 18.1 Kiosk Satellite 이미지 |
| Echo Show 8 2세대 (2021) | `athena` | A8H3N2 | LineageOS 18.1 이미지 및 별도의 Athena 앱 실험 |

Echo Show 8 2세대의 주요 사양은 8인치 1280×800 HD 터치 화면, 13MP 카메라, 듀얼 스테레오 스피커, 듀얼밴드 Wi-Fi와 Bluetooth입니다. 이 모델은 MediaTek MT8183 기반이며, 커뮤니티 포트는 Android 11(LineageOS 18.1)을 대상으로 합니다.

## 관련 프로젝트

### LineageOS Kiosk Satellite Edition

[lineageos-echo-kiosk-satellite](https://github.com/jxlarrea/lineageos-echo-kiosk-satellite)는 위 Echo Show 5/8 모델별로 LineageOS 18.1 이미지를 제공합니다. 이미지에 Home Assistant 키오스크 앱 [Kiosk Satellite](https://github.com/jxlarrea/kiosk-satellite)를 결합합니다. Show 8 2세대 이미지는 첫 부팅 뒤 앱을 설치하고 Home Assistant에 연결합니다.

이 경로는 모델별 부트로더 잠금 해제와 TWRP가 필요합니다. 잠금 해제 가능 펌웨어는 세대마다 다르며, 프로젝트는 최신 Fire OS 업데이트가 잠금 해제 경로를 막을 수 있다고 경고합니다. 설치는 사용자 데이터를 지웁니다. 정확한 제품 코드와 현재 Fire OS에 맞는 원본 문서를 확인해야 합니다.

Kiosk Satellite는 Android 기기에서 HA 대시보드·음성 위성 기능을 제공합니다. upstream 라이선스는 개인·비상업 사용 조건이며, 수정된 앱 재배포에는 별도 제한이 있습니다.

### Athena

[gerrit117/Athena](https://github.com/gerrit117/Athena)는 Echo Show 8 2세대 전용 Home Assistant 디스플레이 앱입니다. 저장소는 특정 하드웨어·Fire OS 조합에서 시험한 초기 실험판이라고 명시하고, 음성은 별도 `echo-dot-assist` 프로젝트와 연결합니다. 여러 Fire OS 버전에 적용된다고 가정하지 않습니다.

### Echo Show 15 연구 상태

[hoya-runtime-root](https://github.com/BookCatKid/hoya-runtime-root)는 Echo Show 15의 런타임 루트 연구 프리뷰입니다. 작성자는 한 대에서만 시험했고 커널 패닉 및 기타 위험을 명시합니다. LineageOS 설치나 안정적인 재활용 경로로 분류하지 않습니다.

## 아키텍처

```mermaid
flowchart LR
  Echo[Echo Show 5/8]
  LOS[LineageOS 18.1]
  KS[Kiosk Satellite]
  HA[(Home Assistant)]
  Echo --> LOS --> KS <--> HA
```

## 출처

- [Kiosk Satellite Echo 이미지와 모델 목록](https://github.com/jxlarrea/lineageos-echo-kiosk-satellite)
- [기종별 잠금 해제·설치 문서](https://github.com/jxlarrea/lineageos-echo-kiosk-satellite/tree/main/docs)
- [Kiosk Satellite 앱](https://github.com/jxlarrea/kiosk-satellite)
- [Athena](https://github.com/gerrit117/Athena)
- [Echo Show 15 런타임 루트 연구](https://github.com/BookCatKid/hoya-runtime-root)
- [Amazon Echo Show 8 2세대 제품 발표](https://press.aboutamazon.com/in/2021/8/amazon-introduces-upgraded-echo-show-8-2nd-gen)
- [Amazon의 A8H3N2 안전·무선 사양](https://digprjsurvey.amazon.co.jp/csad/help/node/G3MTWF65FDGW8E6H)
- [Amazon 개발자 문서의 Echo Show 화면 해상도](https://developer.amazon.com/docs/video-skills-multimodal-devices/getdisplayableitemsmetadata)
- [Echo Show 8용 MT8183 커널 소스](https://github.com/jxlarrea/android_kernel_amazon_mt8183)
