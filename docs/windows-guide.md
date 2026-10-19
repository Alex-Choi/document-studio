# 문서 스튜디오 Windows 실행 안내

2026-10-19 · Windows 10/11 64비트용 첫 데스크톱 버전입니다.

## 실행

`DocumentStudio-1.0.0-win-x64.exe`를 더블클릭합니다. ZIP으로 받았다면 압축을 풀고 실행하세요. 관리자 권한, Node.js, Chrome 설치, 개발 서버, 인터넷 연결은 필요하지 않습니다. 실행 시 포함된 엔진을 임시 폴더에 풀어 앱을 엽니다. 배포 파일에는 코드 서명이 없어 Windows에서 게시자 확인 또는 보안 알림이 표시될 수 있습니다. 회사 PC의 정책이 실행을 막는 경우 관리자에게 확인하세요.

앱 창을 닫으면 종료합니다. 같은 프로그램을 여러 번 열면 기존 창으로 이동하여 저장소 충돌을 방지합니다. 앱을 지우거나 EXE를 다른 폴더로 옮겨도 같은 Windows 사용자 계정의 자료는 별도 저장소에 남습니다.

## 웹에서 작성한 자료 가져오기

기존 HTML에서 **문서 내보내기**로 이미지 포함 JSON을 저장한 뒤 EXE의 **문서 가져오기** 또는 **파일 → JSON 문서 가져오기**에서 선택하세요. 브라우저 저장소는 앱으로 자동 이전되지 않습니다. 가져오기는 같은 ID의 항목을 갱신하고 다른 양식·문서는 유지합니다. 기존 웹 저장 자료를 삭제하지 않습니다.

## 자동 저장·백업·복원

- 앱 데이터: `%APPDATA%\DocumentStudio\library.json`
- 직전 정상 자료: 같은 폴더의 `library.previous.json`
- 저장은 임시 파일 기록·디스크 동기화·교체·재읽기 확인 후 완료로 표시합니다. 앱 종료 직전의 변경도 저장합니다. 쓰기 실패 시 오류를 표시하고 닫기 전에 JSON 내보내기를 사용할 수 있습니다.
- **문서 내보내기**는 양식·문서·초안·도장·이미지·업로드 글꼴을 포함한 JSON을 사용자가 선택한 위치에 저장합니다. 다른 PC로 옮길 때 이 파일을 사용하세요. 한 파일의 한도는 40MB입니다.
- **파일 → 데이터 폴더 열기**로 저장 위치를 확인합니다. 손상된 자료는 자동으로 덮어쓰지 않습니다. 먼저 폴더를 복사해 보관하고 `library.previous.json`을 가져오기로 복원하세요. 직전 자료가 최신 변경 전일 수 있습니다.
- Word·Excel·이미지·PDF는 출력용입니다. 앱에서 구조와 서식을 다시 편집하기 위한 원본은 JSON으로 보관하세요. DOCX/XLSX를 앱 양식으로 다시 가져오는 기능은 아직 없습니다.

## 출력 형식

| 형식 | 용도와 구현 범위 |
| --- | --- |
| PDF | 상단 PDF 출력에서 Windows 파일 저장창으로 직접 저장. 기존 A4 레이아웃, 페이지 분할, 머리글·바닥글·서명·워터마크를 사용하며 텍스트 검색 가능 |
| Word `.docx` | 상단 다른 형식 저장. 문구·입력값·부분 서식·표·합계·이미지·서명 제목 순서 등을 편집 가능한 문서로 변환 |
| Excel `.xlsx` | 문구·입력값·표·셀 서식·이미지를 셀과 시트로 변환. 페이지별 시트. 수량×단가와 합계는 실제 Excel 수식과 계산 결과 포함 |
| PNG / JPG | 편집 격자·손잡이·선택 테두리가 없는 A4 이미지. 약 192dpi, 페이지마다 파일 생성. 여러 페이지는 저장할 폴더를 한 번 선택 |
| JSON | 앱 원본과 이미지·글꼴을 포함한 전체 자료 백업·복원 |

Word·Excel은 편집용 변환이므로 문서 스튜디오와 줄바꿈·페이지 수·셀 배치가 달라질 수 있습니다. 자유 배치 도형·세로 구분선의 정확한 길이, 이미지 자르기, 워터마크·배경, 머리글/바닥글의 첫 페이지 예외와 장식의 정확한 위치는 Office 변환에서 재현하지 않습니다. 정확한 문서 모습은 PDF·PNG·JPG를 사용하세요. 설치 글꼴도 파일을 받는 PC에 따라 대체될 수 있습니다. 업로드 글꼴의 Office 파일 내장 기능은 아직 없습니다.

## 검증 범위

Linux에서 같은 Electron 앱의 실행·파일 저장·재실행 복원·이미지 업로드·JSON 내보내기/가져오기·DOCX/XLSX·PNG/JPG·PDF 생성을 검사했습니다. DOCX/XLSX 내부 XML·이미지와 Excel 수식을 읽어 확인했고, PNG/JPG 디코딩과 PDF 텍스트 검색을 확인했습니다. 저장 권한 오류·손상 자료·이전 백업 보존은 파일 시스템 검사로 확인합니다.

Windows용 EXE를 실제 생성했으며 PE 형식과 포함된 Windows 64비트 런타임·앱 소스를 점검합니다. 현재 검증 머신이 Linux이므로 Windows에서 EXE 더블클릭, SmartScreen 표시, Windows 파일·인쇄 창과 Microsoft Word/Excel에서 직접 열기는 아직 확인하지 못했습니다. 첫 확인 시 빈 문서 저장 → 종료·재실행 → 기존 JSON 가져오기 → 각 형식 저장을 확인하세요.

## 개발·재빌드

Node.js 24 이상에서 저장소 루트에서 실행합니다.

```bash
npm ci
npm exec -- install-electron
npm run desktop
npm run desktop:win
```

`desktop`은 빌드한 편집기를 Electron 창으로 열고, `desktop:win`은 `release/DocumentStudio-1.0.0-win-x64.exe`를 만듭니다. 코드 서명은 구성하지 않았습니다. Electron·NSIS 도구는 공식 배포처에서 검증을 유지해 다운로드합니다. Linux에서 HOME이 읽기 전용이면 다음과 같이 지원되는 캐시 설정을 지정합니다.

```bash
export NODE_USE_ENV_PROXY=1
export XDG_CACHE_HOME=/workspace/.cache
export ELECTRON_BUILDER_CACHE=/workspace/.cache/electron-builder
npm --cache /workspace/.npm-cache ci
npm --cache /workspace/.npm-cache exec -- install-electron
npm run desktop:win
```

검사: `npm run test:desktop-storage`, `npm run test:desktop`. Linux headless 검사의 `--no-sandbox`는 검증 컨테이너 전용이며 Windows 제품에는 적용하지 않습니다. 제품 창은 sandbox·context isolation을 켜고 웹 화면의 Node 접근·외부 탐색을 차단합니다. 화면과 저장·출력 모델은 `src`, OS 파일·창 처리는 `desktop`에 분리되어 있습니다. 렌더러 의존성은 빌드 결과에 포함되므로 개발 의존성으로 관리하며 배포에 별도 node_modules를 넣지 않습니다.
