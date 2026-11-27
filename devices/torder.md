# 티오더 주문 태블릿

티오더는 식당에서 고객이 메뉴를 보고 주문하는 테이블오더 서비스입니다. 태블릿 뒷면 라벨의 모델명과 인증번호로 사양을 구분합니다. [티오더 제품 안내](https://www.torder.com/tableOrder)

## 기기 식별

| 표기 | 인증 기록 | 근거 |
|---|---|---|
| `T2N` | 티오더가 주문 태블릿으로 FCC에 등록한 모델 `2BTKVT2N` | [FCC 인증 기록](https://fccid.io/2BTKVT2N) |
| `torder pad`, `torderpad` | `U10PRO`의 파생 모델. 전파 인증번호 `R-C-T0C-U10PRO` | [국립전파연구원 인증 기록](https://www.rra.go.kr/ko/license/A_b_popup_keyno.do?key_no=R-C-T0C-U10PRO) |
| `torder-pad`, `torder_pad` | `R10D`의 파생 모델. 전파 인증번호 `R-C-T0C-R10D` | [국립전파연구원 인증 기록](https://www.rra.go.kr/ko/license/A_b_popup_keyno.do?key_no=R-C-T0C-R10D) |
| `torder-pad`, `P10HDLITE` | `P10HD`의 파생 모델. 전파 인증번호 `R-C-T0C-P10HD` | [국립전파연구원 인증 기록](https://www.rra.go.kr/ko/license/A_b_popup_keyno.do?key_no=R-C-T0C-P10HD) |

`torder-pad`라는 이름이 `R10D`와 `P10HD` 인증에 모두 나옵니다. 인증번호까지 대조해 기기를 식별하고, Android 버전과 메모리는 기기별로 확인합니다. 중고 매물에도 티오더 단말이 `P10HD`와 `APEX P10HD Lite`로 각각 표기됩니다. [P10HD 매물](https://cafe.naver.com/moopung/186956) · [P10HD Lite 매물](https://cafe.naver.com/joonggonara/1134413521)

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

중고 매물 두 건에서 판매자는 `torder-pad` 4GB/32GB를 일반 태블릿으로 쓸 수 있다고 했고, `torder_pad` 3GB/16GB에서는 Play 스토어로 앱을 설치할 수 있다고 했습니다. 두 설명은 해당 매물에 한정된 판매자 보고입니다. 인증번호·펌웨어와 Home Assistant 동작 여부는 확인하지 못했습니다. [4GB/32GB 매물](https://m.bunjang.co.kr/products/341703803) · [3GB/16GB 매물](https://m.bunjang.co.kr/products/452359171)

## 커뮤니티 조사

- 디벨로이드 댓글에서 일부 사용자가 티오더 단말로 일반 앱을 썼다고 보고했습니다. 한 댓글은 Android 설정에서 기본 홈 앱을 `QuickStep`으로 바꿀 수 있고 초기화하면 티오더 앱이 다시 나타난다고 설명합니다. 댓글에 기기 인증번호나 펌웨어 빌드는 없었습니다. [티오더 태블릿 일반 사용 질문과 댓글](https://cafe.naver.com/develoid/1056040)
- 모두의 스마트홈에는 식당 주문 태블릿을 대시보드로 쓸 수 있는지 묻는 글이 있습니다. 글과 댓글에서 티오더 모델을 특정하거나 Home Assistant 구동을 보여준 사례는 확인하지 못했습니다. [태블릿 형태 오더기기 활용 질문](https://cafe.naver.com/stsmarthome/119158)

링크에서 본문이 열리지 않으면 네이버 검색의 카페 탭에서 게시글 제목을 검색해 결과를 엽니다.
