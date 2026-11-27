# 티오더 주문 태블릿

티오더는 식당에서 고객이 메뉴를 보고 주문하는 테이블오더 서비스입니다. 태블릿 뒷면 라벨의 모델명과 인증번호로 사양을 구분합니다. [티오더 제품 안내](https://www.torder.com/tableOrder)

## 기기 식별

| 표기 | 인증 기록 | 근거 |
|---|---|---|
| `T2N` | 티오더가 주문 태블릿으로 FCC에 등록한 모델 `2BTKVT2N` | [FCC 인증 기록](https://fccid.io/2BTKVT2N) |
| `torder pad`, `torderpad` | `U10PRO`의 파생 모델. 전파 인증번호 `R-C-T0C-U10PRO` | [국립전파연구원 인증 기록](https://www.rra.go.kr/ko/license/A_b_popup_keyno.do?key_no=R-C-T0C-U10PRO) |
| `torder-pad`, `torder_pad` | `R10D`의 파생 모델. 전파 인증번호 `R-C-T0C-R10D` | [국립전파연구원 인증 기록](https://www.rra.go.kr/ko/license/A_b_popup_keyno.do?key_no=R-C-T0C-R10D) |

비슷한 제품명이 두 국내 인증에 쓰입니다. 인증번호까지 대조해 기기를 식별하고, `torder pad` 계열의 Android 버전과 메모리는 기기별로 확인합니다.

## T2N 공개 사양

아래 값은 FCC ID `2BTKVT2N`으로 제출된 주문 태블릿 설명서 기준입니다. [FCC 제출 설명서](https://fccid.io/2BTKVT2N/User-Manual/Users-Manual-9117353) · [설명서 본문](https://device.report/manual/21007049)

| 항목 | 사양 |
|---|---|
| 운영체제 | Android. 버전 미기재 |
| SoC | UNISOC T610, 8코어 |
| 메모리·저장공간 | RAM 4GB, 저장공간 32GB |
| 화면 | 10.1인치 IPS 터치스크린, 1920×1200 |
| 무선 | Wi-Fi 2.4/5GHz, Bluetooth 5.0 |
| 포트·전원 | USB-C 2개(충전용 1개, 데이터용 1개), 9V 2A 어댑터 |

## 홈랩 활용 상태

**조사 후보.** 해당 모델을 Home Assistant 패널로 전환한 사례나 전용 공개 도구는 찾지 못했습니다. 설명서에는 일반 Android 설정 화면이 나오지만, 매장에 공급된 펌웨어에서 일반 앱과 브라우저를 실행할 수 있는지는 실기기 확인이 필요합니다. [T2N 설명서 본문](https://device.report/manual/21007049)
