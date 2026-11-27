# 사용 안내

이 문서는 `homelab-devices`에서 기기와 관련 프로젝트를 찾는 방법을 안내합니다. 펌웨어 설치·복구 절차는 기기와 펌웨어별로 달라지므로 각 원본 프로젝트의 기기별 문서를 사용합니다.

## 시작하기

1. 기기 라벨, 정확한 모델명, 세대, 펌웨어를 확인합니다.
2. [기기 문서](README.md#기기별-핵심-사양)에서 지원 상태와 근거 수준을 확인합니다.
3. 프로젝트 표의 원본 저장소에서 해당 모델·펌웨어의 설치 및 복구 안내를 읽습니다.
4. 서비스 중인 매장 단말이나 다른 사람이 소유한 기기는 실험 대상으로 쓰지 않습니다.
5. 플래시를 쓰는 작업은 원본 안내에 적힌 백업과 복구 조건을 충족할 때만 진행합니다.

## 기기별 진입점

| 기기 | 사용 목적 | 시작할 문서 |
|---|---|---|
| Npay Connect | 기기 리서치, 백업·진단 도구 확인 | [기기 문서](devices/naver-connect.md), [homelab-naver-connect](https://github.com/recrack/homelab-naver-connect), [naver-connect-tool](https://github.com/pigeon-brain/naver-connect-tool), [diagnostics](https://github.com/pigeon-brain/naver-connect-diagnostics) |
| Toss Front | 세대별 Android 실험 도구 확인 | [기기 문서](devices/toss-front.md), [homelab-tossfront](https://github.com/recrack/homelab-tossfront), [TillKit](https://github.com/YuruDeveloper/tillkit) |
| KT Table TV CT1105-SB | 기기를 Home Assistant 패널로 사용 | [기기 문서](devices/kt-table-tv.md), [설치 문서](https://github.com/dasjjl-svg/KT_TABLE_TV/tree/main/docs) |
| Citaq H10-3 | Android 10 키오스크와 프린터·LED 연동 | [기기 문서](devices/citaq-h10-3.md), [INSTALL](https://github.com/Crux4000/citaq-h10-android10/blob/main/docs/INSTALL.md), [RECOVERY](https://github.com/Crux4000/citaq-h10-android10/blob/main/docs/RECOVERY.md), [Home Assistant 안내](https://github.com/Crux4000/citaq-h10-android10/blob/main/docs/HOME-ASSISTANT.md) |
| Echo Show 5/8 | 기종별 LineageOS 이미지와 Kiosk Satellite 사용 | [기기 문서](devices/amazon-echo-show.md), [기종·잠금 해제 문서](https://github.com/jxlarrea/lineageos-echo-kiosk-satellite/tree/main/docs) |
| SUNMI V2 | 연구 후보. 특정 V2 펌웨어에 대한 루트 보고 조사 | [후보 문서](devices/sunmi-v2.md) |
| CashNote Pay | 공개 사양과 재활용 가능성 확인 | [후보 문서](devices/cashnote-pay.md) |
| 티오더 | 모델·인증번호 확인 후 일반 앱 실행 가능 여부 확인 | [후보 문서](devices/torder.md) |

## 기기별 사용 흐름

아래는 각 프로젝트를 시작할 때의 순서입니다. 플래싱 명령, 이미지 주소, 펌웨어별 세부 조건은 링크된 원본 문서에서 확인합니다.

### Npay Connect

1. 인증 라벨에서 모델을 확인하고 일반형과 Face 파생 모델을 구분합니다.
2. [naver-connect-tool](https://github.com/pigeon-brain/naver-connect-tool)의 사전 점검·백업 문서를 읽습니다.
3. 백업 검증과 진단이 목적이면 해당 기능만 사용합니다. OS 설치는 사용자 데이터를 지우고 단말기에 씁니다.
4. 마이크 입력 지원은 공개 자료로 확인되지 않았습니다. 실기기 입력 테스트 전에는 지원된다고 가정하지 않습니다.

### Toss Front

1. 뒷면 라벨을 확인해 PLF00WH, PLF02WH, 2세대 중 어느 기기인지 식별합니다.
2. [세대별 문서](devices/toss-front.md)에서 일치하는 SoC와 도구를 선택합니다.
3. 같은 기기 세대의 백업·진입 절차만 따릅니다. RKDevTool/Rockchip와 EDL/QCOM 절차를 섞지 않습니다.
4. Home Assistant 패널이 목적이면 기기 문서의 [1.5세대 대시보드 사례](devices/toss-front.md#home-assistant-활용-사례)를 참고합니다.

### KT 기가지니 테이블 TV

1. 기기 라벨이 `CT1105-SB`인지 확인합니다.
2. 사용할 서버 PC의 운영체제에 맞춰 [macOS, Linux 또는 Windows WSL2 설치 안내](https://github.com/dasjjl-svg/KT_TABLE_TV/tree/main/docs)를 엽니다.
3. Home Assistant 연결 가이드에서 방·센서·장면을 설정합니다.
4. 다른 KT 테이블 TV 모델은 README에서 호환된다고 보장하지 않으므로 같은 절차를 적용하지 않습니다.

### Citaq H10-3

1. 모델명 외에도 보드 `CTE-RK3368-V1.0`, eMMC 크기, 순정 `userdebug` 빌드를 확인합니다.
2. 설치 전에 upstream [RECOVERY](https://github.com/Crux4000/citaq-h10-android10/blob/main/docs/RECOVERY.md)와 [INSTALL](https://github.com/Crux4000/citaq-h10-android10/blob/main/docs/INSTALL.md)를 읽고 전체 eMMC 백업을 준비합니다.
3. 원본 가이드로 Android 10 포트를 설치한 뒤 [Home Assistant 패키지](https://github.com/Crux4000/citaq-h10-android10/blob/main/docs/HOME-ASSISTANT.md)를 적용합니다.
4. H10-1/H10-2, 유사 외관 POS, Citaq V8은 별도 문서의 지원 상태를 확인합니다.

### Echo Show 5/8

1. 모델명과 코드명(예: A8H3N2 / `athena`)을 확인합니다.
2. Fire OS 버전이 해당 기종의 잠금 해제 문서에서 지원되는지 확인합니다.
3. [해당 세대의 잠금 해제·TWRP·이미지 안내](https://github.com/jxlarrea/lineageos-echo-kiosk-satellite/tree/main/docs)를 따릅니다. 이미지 설치 과정에서 사용자 데이터가 지워집니다.
4. 첫 부팅 후 Kiosk Satellite에서 Home Assistant 주소와 대시보드를 설정합니다.

### 연구 후보

SUNMI V2와 CashNote Pay는 확인된 모델별 재활용 안내가 충분하지 않습니다. [SUNMI V2 문서](devices/sunmi-v2.md)와 [CashNote Pay 문서](devices/cashnote-pay.md)를 조사 시작점으로만 사용하고, 다른 모델의 루트·펌웨어 방법을 적용하지 않습니다.

티오더는 후면 라벨의 모델명과 인증번호를 [기기 식별 표](devices/torder.md#기기-식별)에서 확인합니다. 서비스 해지와 기기 등록 해제 여부는 판매자나 티오더에 확인합니다. 일반 브라우저를 실행할 수 있다면 Home Assistant 대시보드가 열리는지부터 확인합니다.

## Home Assistant 연결

KT Table TV, Citaq, Echo Show는 기기에서 패널 앱을 실행하고 Home Assistant 서버에 연결하는 구조입니다. 인증 토큰과 계정 설정은 기기별 원본 가이드대로 본인 환경에서 생성합니다. 토큰이 들어간 백업·설정 파일은 공개 저장소나 이 카탈로그에 올리지 않습니다.

Npay Connect와 Toss Front 도구의 기능 범위는 각 기기 문서의 공개 프로젝트 설명에서 확인합니다.

## 상태 표기

- **확인된 프로젝트:** 공개 문서에 모델과 기능이 구체적으로 기재돼 있습니다. 이는 모든 동일 제품에서의 성공을 보장하지 않습니다.
- **작성자 보고:** 커뮤니티 작성자가 자신의 기기에서 확인했다고 쓴 내용입니다.
- **후보:** 사양이나 일부 도구만 확인했고, 홈랩 재활용 성공을 일반화할 근거가 부족합니다.
- **미확인:** 사양 또는 실제 기능을 확인할 자료가 없습니다.
