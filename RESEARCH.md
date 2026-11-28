# 주간 기기 리서치

[Weekly device research](https://github.com/recrack/homelab-devices/actions/workflows/research.yml)는 월요일 오전 10시 17분(KST)에 실행됩니다. **Run workflow**에서 수동 실행할 수도 있습니다. 기본값인 미리보기에서는 이슈와 PR 생성 없이 수집·분석 결과를 확인할 수 있습니다.

## 수집 범위

| 출처 | 검색 범위 |
| --- | --- |
| GitHub | 기기명으로 최근 14일 안에 생성된 공개 저장소를 검색하고, 등록된 원본 프로젝트의 릴리스를 확인합니다. |
| DC SFF | 공개 갤러리에서 기기명으로 검색한 뒤 최근 14일 안에 올라온 글을 확인합니다. |
| 네이버 카페 | NAVER API HUB의 공개 카페글 검색에서 기기별 최신 결과를 받습니다. API 응답에는 게시일이 없어, 기존 링크와 중복되지 않는 검색 결과를 새 후보로 기록합니다. |
| [모두의 스마트홈](https://cafe.naver.com/stsmarthome) | 같은 기기명으로 이 카페의 공개 글을 별도로 찾습니다. 검색 결과의 카페 주소를 확인하고 일반 검색에 나온 동일 글과 합칩니다. |

최근 14일을 확인해 주간 실행이 지연됐을 때도 겹치는 기간을 다시 확인합니다. 문서와 이전 자동 이슈에 있는 URL은 제외하고, DC 모바일·데스크톱 링크처럼 주소만 다른 같은 글을 한 건으로 처리합니다. 새 후보가 있으면 제목과 원문 주소를 이슈에 올립니다. 출처별 성공·실패는 Actions 실행 요약에 표시됩니다.

네이버 카페와 모두의 스마트홈을 수집하려면 [NAVER API HUB](https://api.ncloud-docs.com/docs/naver-api-hub-search-cafearticle)에서 검색용 Client ID와 Client Secret을 발급받아 [저장소의 Actions Secrets](https://github.com/recrack/homelab-devices/settings/secrets/actions)에 **NAVER_API_HUB_CLIENT_ID**와 **NAVER_API_HUB_CLIENT_SECRET**으로 등록하세요. 키가 없는 실행에서는 GitHub와 DC SFF를 수집합니다.

## 이슈에서 초안 PR까지

1. Copilot은 모델 작업 내부에서 제목과 제한된 원문을 읽고, 정확한 기기·프로젝트와 확인된 동작 또는 릴리스 변경점을 고릅니다.
2. 스크립트는 모델이 인용한 문장이 실제로 수집한 원문에 존재하는지 확인합니다. 통과한 항목의 요약과 출처를 `research/verified/issue-<번호>.md`에 기록하는 초안 PR을 엽니다.
3. PR에서 출처와 기기 모델, OS 버전, 검증 범위를 확인한 뒤 병합합니다. 실기기에서 검증한 내용은 검증자와 환경을 함께 남깁니다.

모델은 기존 자료를 검토합니다. 실기기에서 동작을 재현하는 단계는 사람이 수행합니다. GitHub Actions 표준 러너의 실행 시간과 Copilot AI 크레딧은 별도로 계산됩니다. 분석 세션의 [AI 크레딧 상한](https://docs.github.com/en/copilot/how-tos/copilot-cli/use-copilot-cli/set-session-limit)은 30으로 설정되어 있습니다.

자동 생성 PR은 요약, 검증 근거, 병합 영향을 표시합니다. [Matt Pocock PR 스킬](https://github.com/mattpocock/skills/blob/main/skills/engineering/pr/SKILL.md)

Actions에서 PR을 생성하려면 저장소 **Settings → Actions → General → Workflow permissions**에서 **Allow GitHub Actions to create and approve pull requests**를 허용해야 합니다. 리서치 워크플로는 초안 PR을 열고, 소스 동기화 워크플로는 아카이브 PR을 병합합니다. [GitHub Actions 권한 안내](https://docs.github.com/en/repositories/managing-your-repositorys-settings-and-features/enabling-features-for-your-repository/managing-github-actions-settings-for-a-repository#preventing-github-actions-from-creating-or-approving-pull-requests)
