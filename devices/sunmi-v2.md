# SUNMI V2 — 연구 후보

SUNMI V2는 내장 영수증 프린터와 카드 결제 장치를 포함한 휴대형 Android POS입니다. 제조사는 이 제품을 단종 모델로 표시합니다. 공개된 Magisk/TWRP 자료는 있지만 모델 세대와 펌웨어에 따라 호환되지 않을 수 있어 검증 완료 기기로 분류하지 않습니다.

## 공개 사양

| 항목 | 사양 |
|---|---|
| OS | SUNMI OS, Android 7.1 기반 |
| CPU | Cortex-A53 쿼드코어, 구성에 따라 1.3GHz 또는 1.5GHz |
| 메모리·저장공간 | 1GB RAM + 8GB 또는 선택 사양 2GB + 16GB |
| 화면 | 5.45인치 IPS, 1440×720 |
| 프린터 | 58mm 감열식, 최대 70mm/s |
| 카메라 | 5MP 자동초점·플래시, 1D/2D 스캔 지원 |
| 무선 | Wi-Fi 2.4/5GHz, Bluetooth, 2G/3G/4G, GPS |
| 배터리·연결 | 2580mAh, USB-C OTG |

제품 사양은 [SUNMI V2 공식 사양서](https://file.cdn.sunmi.com/newebsite/downloads/specs/en/v2.pdf)와 [제품 페이지](https://www.sunmi.com/eu/v2/)를 따릅니다. 인증 모델은 T5930이며, 저장공간·RAM·CPU는 옵션에 따라 다릅니다.

## 루팅 자료와 한계

[dafish7/Sunmi-v2-Firmware-](https://github.com/dafish7/Sunmi-v2-Firmware-)는 특정 V2 기기에서 Magisk 루트와 TWRP를 설치한 작성자 보고를 제공합니다. 저장소는 gen1과 gen2 기기의 펌웨어가 서로 호환되지 않는다고 알리고, 일부 파일을 외부 사이트에서 받도록 안내합니다. 이 카탈로그에서 파일이나 설치 절차를 재배포하지 않습니다.

[관련 Android Root 토론](https://www.reddit.com/r/androidroot/comments/zqgpig/sunmi_v2_devices/)에는 다른 사용자의 설치 실패와 변형 모델 문제가 함께 보입니다. 확인한 자료에서는 Home Assistant로 전환한 실기기 사례나 지원 모델을 망라한 호환 목록을 찾지 못했습니다.

## 상태

**후보 · 호환성 미확인.** 표기만 SUNMI V2인 기기 전체에 루트 방법을 적용하지 않습니다. 정확한 하드웨어 세대와 펌웨어를 확인하고, 개인 소유의 여분 단말기 외에는 실험하지 않습니다. 원본 저장소 README에서 라이선스 조건을 확인하지 못했습니다.

## 출처

- [SUNMI V2 공식 사양서](https://file.cdn.sunmi.com/newebsite/downloads/specs/en/v2.pdf)
- [SUNMI V2 제품 페이지 및 단종 안내](https://www.sunmi.com/eu/v2/)
- [Magisk/TWRP 작성자 저장소](https://github.com/dafish7/Sunmi-v2-Firmware-)
- [SUNMI V2 루팅 커뮤니티 토론](https://www.reddit.com/r/androidroot/comments/zqgpig/sunmi_v2_devices/)
