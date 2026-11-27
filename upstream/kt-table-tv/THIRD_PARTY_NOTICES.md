# 외부 소프트웨어

이 저장소의 프로젝트 코드에는 루트의 MIT 라이선스를 적용합니다. 제품명과 상표는 각 소유자에게 속하며 KT·가온미디어·Home Assistant의 공식 배포물이 아닙니다.

다음 항목은 별도로 설치하거나 내려받습니다. 해당 프로젝트의 라이선스와 사용 조건을 따릅니다.

- [React](https://github.com/facebook/react): MIT. 패널 UI의 의존성.
- [Vite](https://github.com/vitejs/vite): MIT. 프런트엔드 빌드 도구.
- [Node.js](https://nodejs.org/): 자체 배포 라이선스 및 포함된 의존성 라이선스.
- [Android SDK / NDK](https://developer.android.com/studio): Google 배포 도구. SDK 라이선스는 설치자가 확인하고 동의합니다.
- [AOSP Android 5.1.1 build target security 자료](https://android.googlesource.com/platform/build/+/android-5.1.1_r38/target/product/security/): Android 빌드 호환성 확인에 사용하는 공개 테스트 서명 자료. 설치 도우미에서 원본과 해시를 검증해 별도로 받습니다. 공개 테스트 키는 개인 인증 수단이 아닙니다. 원격 업데이트 승인에는 설치자별로 새로 만드는 별도 서명키와 토큰을 사용합니다.
- [Home Assistant](https://www.home-assistant.io/): 별도의 서버·통합 소프트웨어. 이 저장소에 HA OS 이미지를 넣지 않습니다.
- [SonoffLAN](https://github.com/AlexxIT/SonoffLAN): 선택적인 별도 커스텀 통합. 소스나 계정 데이터를 이 저장소에 재배포하지 않습니다.

KT APK, 제조사 라이브러리, eMMC/SPI 펌웨어 이미지, 기기별 인증 저장소, 개인용 APK는 포함하지 않습니다. 재사용하는 기기의 순정 시스템과 외부 소프트웨어에 대한 권리는 이 라이선스가 부여하지 않습니다.

Windows 실행 경로는 [Microsoft WSL2](https://learn.microsoft.com/windows/wsl/)를 사용합니다. Linux 자동 실행은 선택적으로 systemd 사용자 서비스를 사용하며, 이 저장소는 WSL 또는 systemd 자체를 배포하지 않습니다.
