# 소스 아카이브 사용 안내

이 저장소를 클론하면 [KT 테이블 TV 패널 소스](upstream/kt-table-tv/panel)와 원본 라이선스가 함께 내려옵니다.

```sh
git clone https://github.com/recrack/homelab-devices.git
cd homelab-devices
```

| 보존한 소스 | 원본 | 라이선스 | 버전 기록 |
| --- | --- | --- | --- |
| KT 테이블 TV 웹 패널, 서버, PC 설정 | [dasjjl-svg/KT_TABLE_TV](https://github.com/dasjjl-svg/KT_TABLE_TV) | [MIT](upstream/kt-table-tv/LICENSE) · [제3자 고지](upstream/kt-table-tv/THIRD_PARTY_NOTICES.md) | [UPSTREAM.json](upstream/kt-table-tv/UPSTREAM.json) |

## KT 테이블 TV 패널을 PC에서 실행

Linux, macOS 또는 WSL 2에서 Node.js 22.12 이상을 사용합니다. Home Assistant 주소, 패널을 실행하는 PC와 CT1105-SB의 사설 IPv4 주소, Home Assistant 영역 이름 두 개를 준비하세요.

1. 저장소 루트에서 원본 설정 도구를 실행합니다. 안내에 따라 주소와 영역 이름을 입력합니다. 장면은 생략할 수 있으며, 설정과 기기 키는 로컬 `runtime/`에 저장됩니다.

   ```sh
   cd upstream/kt-table-tv
   node scripts/setup.mjs
   ```

2. 웹 패널을 빌드하고 서버를 시작합니다.

   ```sh
   cd panel
   npm ci
   npm run build
   npm start
   ```

3. 같은 PC에서 `http://localhost:4173`을 열고 Home Assistant에 연결합니다.

CT1105-SB에 Android 패널을 설치하거나 레거시 서버를 연결할 때는 원본 프로젝트의 기기 설치·복구 절차를 사용하세요. [원본 설치 안내](https://github.com/dasjjl-svg/KT_TABLE_TV/tree/main/docs)

## 원본 업데이트와 라이선스

- `./sync.sh --check`는 원본을 확인하고 기존 사본과 비교합니다. `./sync.sh`는 검증을 통과한 사본을 현재 작업 트리에 가져옵니다.
- [Sync archived device sources](https://github.com/recrack/homelab-devices/actions/workflows/sync.yml)는 매일 오전 6시 43분(KST)에 실행됩니다. 승인한 원본 경로에 변경이 있으면 아카이브만 바꾸는 PR을 열고, 검증한 커밋을 병합합니다.
- 원본 커밋과 라이선스·제3자 고지 SHA-256은 각 사본의 `UPSTREAM.json`에 기록합니다. 동기화는 보존한 파일을 실행하거나 의존성을 설치하지 않습니다.
- 라이선스 또는 제3자 고지가 바뀌면 직전 사본을 유지합니다. 새 커밋의 배포 조건을 확인하고 `scripts/sync_kt_panel.py`의 승인 해시를 갱신한 뒤 다시 실행합니다.
- 아카이브에 새 프로젝트를 추가할 때는 그 버전의 재배포 조건, 포함할 소스 경로, 제3자 고지를 먼저 확인합니다. 카탈로그에 공개 링크가 있더라도 아카이브 등록은 별도입니다. [GitHub 라이선스 안내](https://docs.github.com/en/repositories/managing-your-repositorys-settings-and-features/customizing-your-repository/licensing-a-repository)
