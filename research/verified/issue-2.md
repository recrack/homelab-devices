# 기기 리서치 #2

[수집 이슈](https://github.com/recrack/homelab-devices/issues/2)의 출처를 모델이 검토했습니다.

## LineageOS Kiosk Satellite Edition – Echo Dot (3세대, 2018, D9N29T)

- 확인 내용 · 릴리스 2026.11.3은 음성 캡처 소스를 원시 마이크로 녹음하도록 바꿨다고 릴리스 노트가 밝힌다.
- 근거 범위 · 2019·2020년형 C78MP8(crumpet)은 하드웨어가 달라 언락과 이미지 모두 동작하지 않는다고 명시됨. 개발자 릴리스 노트이며 독립 검증은 아님.
- 출처 · GitHub 릴리스 <https://github.com/jxlarrea/lineageos-echo-kiosk-satellite/releases/tag/donut-2026.11.3>

## LineageOS Kiosk Satellite Edition – Echo Dot (2세대)

- 확인 내용 · 릴리스 2026.11.5는 음성 캡처 소스를 원시 마이크로 녹음하도록 바꿨고 그 외 변경은 없다고 릴리스 노트가 밝힌다.
- 근거 범위 · Kiosk Satellite 2026.11.1 이상 필요하고, 전용 전원 어댑터를 쓰지 않으면 TWRP가 시작되지 않을 수 있다고 함. 개발자 자체 설명.
- 출처 · GitHub 릴리스 <https://github.com/jxlarrea/lineageos-echo-kiosk-satellite/releases/tag/biscuit-2026.11.5>

## Citaq H10-3 Android 10 (crux4000/citaq-h10-android10) v1.1

- 확인 내용 · 릴리스 노트에 따르면 v1.1은 3대의 단말에 설치되었고, 블루투스·4G 모뎀(LTE 등록, SMS)·ES8316 사운드·AP6255 Wi-Fi 지원과 온도 센서 수정이 추가되었다.
- 근거 범위 · Citaq V8은 실험적이며 아직 미검증. 모바일 데이터는 옵트인. 개발자 자체 보고이며 독립 검증 아님.
- 출처 · GitHub 릴리스 <https://github.com/crux4000/citaq-h10-android10/releases/tag/v1.1.0>
