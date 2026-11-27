# homelab-devices

스마트 결제 단말기와 홈 패널처럼 전용 목적으로 판매된 기기 중, 홈랩에서 앱·대시보드·다른 운영체제로 재활용할 수 있는 제품을 모아 둡니다.

**조사 갱신일: 2026-11-27** · 비공개 저장소 · 기존 코드 저장소를 포크하거나 복사하지 않고, 기기 사양과 관련 프로젝트를 연결합니다.

## 기기 목록

| 기기 | 식별 정보 | 공개된 사양 | 관련 프로젝트 | 정리 |
|---|---|---|---|---|
| Npay Connect | Npay connect 1 / Npay connect Face 1 | Android 15, 8인치 화면, 4GB RAM, 32GB eMMC | [homelab-naver-connect](https://github.com/recrack/homelab-naver-connect), [naver-connect-tool](https://github.com/pigeon-brain/naver-connect-tool), [naver-connect-diagnostics](https://github.com/pigeon-brain/naver-connect-diagnostics) | [기기 문서](devices/naver-connect.md) |
| Toss Front | 1세대 PLF00WH, 1.5세대 PLF02WH, 2세대 | 1.5세대 RK3399, 2세대 QCM4325 | [homelab-tossfront](https://github.com/recrack/homelab-tossfront), [TillKit](https://github.com/YuruDeveloper/tillkit), [bkerler/edl](https://github.com/bkerler/edl) | [기기 문서](devices/toss-front.md) |
| KT 기가지니 테이블 TV 더 블랙 | CT1105-SB | Hi3798CV200, 11.6인치 FHD, Android 5.1.1 | [KT_TABLE_TV](https://github.com/dasjjl-svg/KT_TABLE_TV) | [기기 문서](devices/kt-table-tv.md) |

## 기록 기준

- 제조사·인증기관 사양, 프로젝트 README, 커뮤니티의 실기기 보고를 구분해 적습니다.
- 커뮤니티 글의 실험 결과는 작성자 보고로 표시합니다. 별도 재현을 하지 않은 내용은 확인된 일반 사양처럼 쓰지 않습니다.
- 관련 도구는 기능과 검증 범위를 요약하고 원본 저장소로 연결합니다. 이 저장소에는 도구 코드, 펌웨어, APK, 기기 덤프를 복사하지 않습니다.
- 특정 세대나 모델에 한정된 결과를 다른 기기에도 적용할 수 있다고 가정하지 않습니다.

## 다음으로 볼 문서

- [Npay Connect](devices/naver-connect.md): 하드웨어 사양, 마이크 확인 상태, 공개된 도구
- [Toss Front](devices/toss-front.md): 세대별 라벨·칩셋·도구 구분
- [KT 기가지니 테이블 TV](devices/kt-table-tv.md): CT1105-SB 사양과 Home Assistant 패널 프로젝트
