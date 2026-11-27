# Npay Connect

Npay Connect는 결제·리뷰·매장 운영용 Android 단말기입니다. 기기 정보를 확인할 때는 Npay connect 1과 Face 파생 모델을 구분하고, 정확한 SoC 모델은 확인 전까지 미상으로 둡니다.

## 기기 식별

국립전파연구원 인증 내역에는 모델명 `Npay connect 1`, 파생 모델 `Npay connect Face 1`, 제조사 하나시스, 제조국 중국으로 등록돼 있습니다. 인증일은 2025-08-28입니다.

## 공개 하드웨어 사양

아래 수치는 [21포스 제품 안내](https://www.21pos.co.kr/naver-connect/)에 공개된 사양입니다. 전파 인증 자료에는 상세 부품 목록이 없습니다.

| 항목 | 공개 사양 |
|---|---|
| 운영체제 | Android 15 |
| 프로세서 | 2× Cortex-A75 최대 2.0GHz + 6× Cortex-A55 최대 1.8GHz |
| 메모리·저장공간 | DDR 4GB, eMMC 32GB |
| 화면 | 8인치 TFT, 1280×800, 멀티터치 |
| 카메라·센서 | 5MP 컬러 카메라, 4MP 흑백 카메라, IR LED, 조도 센서 |
| 무선·결제 | Wi-Fi, Bluetooth, RFID, MSR, IC, NFC |
| 포트 | USB-C, RJ-9 시리얼, RJ-45 이더넷 |
| 전원·소리 | DC 12V 2.5A, 2W 스피커(95dB), 내장 버저 |
| 백업 전지 | CR2032 |

### 마이크

공개 사양표에는 스피커와 버저는 있지만 마이크 항목이 없습니다. 확인한 도구 문서도 마이크 녹음이나 입력 경로를 실기기에서 검증했다고 밝히지 않습니다. 따라서 **마이크가 있는지와 Android 앱에서 입력 장치로 쓸 수 있는지는 미확인**으로 기록합니다.

## 관련 프로젝트와 도구

| 프로젝트 | 용도 | 확인 범위 |
|---|---|---|
| [naver-connect-tool](https://github.com/pigeon-brain/naver-connect-tool) | Windows용 백업, 부트로더 언락, LineageOS 설치, ADB 앱 설치 도구 | README는 MT6768/MT6769 계열을 대상으로 명시합니다. 실제 기기의 SoC가 이 중 무엇인지는 공개 사양에서 확인하지 못했습니다. OS 설치는 사용자 데이터를 지우며 플래시 기록을 수행합니다. |
| [naver-connect-diagnostics](https://github.com/pigeon-brain/naver-connect-diagnostics) | Android 진단 앱과 선택형 루트 하드웨어 브리지 | 작성자 README 기준 카메라, RGB LED, IC 카드 상태를 시험했습니다. MSR 물리 스와이프는 미검증이고 결제 NFC RF 조사는 진행 중입니다. 공개 APK의 실제 기기 설치도 미검증입니다. |

커뮤니티의 [루팅·GSI 실험 글](https://gall.dcinside.com/mgallery/board/view/?id=sff&no=1738011)은 한 사용자의 여분 기기 결과입니다. 일반 기기에서 같은 결과가 보장된다는 근거로 보지 않습니다.

## 사용 범위 주의

네이버페이 커넥트 이용약관 개정 안내에는 제공된 단말기와 소프트웨어를 임의로 분해·개조·양도하거나 소스코드 추출을 시도하지 말라는 조항이 있습니다. 실제 사용 중인 가맹점 단말기는 계약과 권한을 확인하기 전 개조하지 않습니다. 실험한다면 서비스에 등록되지 않은 본인 소유 기기에서 진행합니다.

## 출처

- [국립전파연구원 인증 정보](https://www.rra.go.kr/ko/license/A_b_popup_keyno.do?key_no=R-R-Npay-NPC0108)
- [21포스 Npay Connect 제품 안내 및 사양](https://www.21pos.co.kr/naver-connect/)
- [네이버페이 커넥트 서비스 이용약관 개정 안내](https://guide.pay.naver.com/Npay-connect-_10-20-29a6e3d1c00b8118b0a9cd8fb4925712)
- [naver-connect-tool](https://github.com/pigeon-brain/naver-connect-tool) · [naver-connect-diagnostics](https://github.com/pigeon-brain/naver-connect-diagnostics)
- [SFF 갤러리의 루팅 실험 글](https://gall.dcinside.com/mgallery/board/view/?id=sff&no=1738011)
