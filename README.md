# 한걸음 AI 개인 과외 선생님 — GitHub 연동 무료 AI 버전

**2026년 11월 기준:** GitHub Models API는 2026-07-30에 종료되었습니다. 대신 프로젝트의 **소스코드 관리만 GitHub**에 맡기고, **Cloudflare Workers + Workers AI**로 웹앱과 AI를 함께 무료 할당량 내에서 실행하도록 구성했습니다.

## 특징

- 기존 한걸음 AI 화면, 과목별 대화, 단계별 풀이/힌트/개념 설명/오답 분석
- AI가 생성한 4지선다 문제 5개 (실제 AI 추론, 정확성은 검증 필요)
- 기본 샘플 문제는 로그인이나 API 없이도 이용 가능
- 정답률, 오답노트, 학습 목표, 노트, 공부 기록(JSON 내보내기)
- **OpenAI API 키, GitHub Models 토큰, 유료 서버 필요 없음**
- AI를 불러오는 서버 코드와 정적 웹앱을 Cloudflare Workers 하나로 배포

## 무료 사용량

Cloudflare Workers AI 무료 플랜은 하루 **10,000 Neurons**를 제공합니다(2026-11 기준). 질문 횟수로 고정 환산할 수 없으며 사용한 모델·토큰 등에 따라 다릅니다. 초과 시 무료 플랜에서 요청이 실패합니다. 무료 플랜에서 과금 없이 계속 쓰려면 Paid 업그레이드를 선택하지 마세요. 별도로 Workers Free는 하루 100,000개 요청 제한이 있습니다. 공식 문서: https://developers.cloudflare.com/workers-ai/platform/pricing/

## 휴대폰으로 GitHub에 올리고 자동 배포하기

### 1. GitHub 리포지토리 준비

1. GitHub(https://github.com/)에서 새 리포지토리 `hangeoreum-ai-tutor`를 만듭니다.
2. 이 ZIP을 **압축 해제**하고 **폴더의 내용물**을 리포지토리 루트에 올립니다. (`wrangler.jsonc`, `package.json`, `public/`, `src/`가 리포지토리 최상단에 보이도록).
3. GitHub 웹사이트로 폴더 업로드가 힘들다면 GitHub 모바일에서 웹 브라우저 '데스크톱 사이트'로 전환하거나 PC를 사용하세요. ZIP 파일 자체만 업로드해서는 자동 배포되지 않습니다.

### 2. Cloudflare에 GitHub 연결

1. https://dash.cloudflare.com/ 에서 무료 계정을 만듭니다.
2. **Workers & Pages → Create application → GitHub**를 선택합니다.
3. 앞서 만든 리포지토리를 연결합니다.
4. Worker 이름은 `hangeoreum-ai-tutor`로 맞춥니다. (wrangler.jsonc의 name과 동일해야 합니다.)
5. 빌드/배포 명령은 **`npx wrangler deploy`**를 지정합니다. 별도 빌드 명령이 필요 없는 구성입니다.
6. 생성한 Worker의 **Bindings** 또는 **Settings**에서 Workers AI 바인딩 `AI`가 연결돼 있는지 확인합니다. `wrangler.jsonc`에 이미 명시돼 있습니다.

### 3. 무단 사용 방지 비밀번호 설정 (필수)

1. Cloudflare Worker 상세 화면 → **Settings → Variables and Secrets** (UI의 명칭이 조금 다를 수 있음).
2. **Type: Secret**, 이름 **`APP_PASSWORD`**, 값은 직접 만든 긴 비밀번호로 입력해 저장/배포합니다. (절대 GitHub 파일에 기록하지 마세요.)
3. `https://hangeoreum-ai-tutor.<내-서브도메인>.workers.dev`를 엽니다. (실제 주소는 대시보드에서 확인).
4. 한걸음 AI **학습 설정 → AI 사용 비밀번호**에 2번 비밀번호를 입력하고 **비밀번호 저장**을 누릅니다.
5. 첫 화면 오른쪽 위 **AI 연결됨** 표시 확인 후 대화와 문제 생성 기능을 사용하세요.

⚠️ AI 호출을 보호하려고 비밀번호를 Cloudflare의 Secret으로 설정하지 않으면 AI 기능이 꺼진 상태로 동작하게 했습니다. 이 비밀번호는 같은 브라우저 탭의 sessionStorage에만 저장됩니다. 앱을 다른 사람에게 공개할 때는 비밀번호를 공유하지 마세요.

### 4. 업데이트

GitHub에 코드를 업데이트하면 연결된 Cloudflare Workers Builds가 자동으로 새 버전을 배포합니다. AI 모델 이름은 `src/worker.js`의 `MODEL` 상수에 있습니다. 현재 모델은 무료 플랜에서 사용 가능한 `@cf/zai-org/glm-4.7-flash`입니다.

## 컴퓨터에서 개발하고 싶다면

```bash
npm install
npm run dev
```

`wrangler` 로그인이 필요하고, 로컬 개발에서도 AI 호출은 Cloudflare 계정의 무료 할당량을 사용합니다.

## 구조

```text
public/index.html       웹앱 화면
public/styles.css       모바일 반응형 디자인
public/app.js           학습 기능 / Cloudflare API 호출
public/questions.js     샘플 문제은행
public/favicon.svg      아이콘
src/worker.js           AI 개인 과외 + 문제 생성 API
wrangler.jsonc          정적 파일 + AI 바인딩 배포 설정
package.json           Wrangler 명령
```

## 개인정보 / 한계

- AI 질문 및 공부 노트는 Cloudflare Workers AI로 전송됩니다. 개인정보를 입력하지 마세요.
- 답변 및 AI 생성 문제에는 오류가 있을 수 있으므로 학습용으로 검산하세요.
- 학습·대화 기록은 사용 중인 브라우저 localStorage에만 보관되며 기기 간 자동 동기화되지 않습니다.
- 서버는 학습 기록용 데이터베이스를 갖추고 있지 않습니다.
- 공용 서비스로 확대하려면 사용자별 인증 및 abuse/rate limit 보호를 추가해야 합니다.
- 이 프로젝트는 코드와 배포 설정까지 준비된 상태이며, 실제 GitHub 업로드 및 Cloudflare 배포·AI 실호출은 사용자의 계정 연결이 필요합니다.

## 출처 (공식)

- GitHub Models 종료: https://github.blog/changelog/2026-07-01-github-models-is-being-fully-retired-on-july-30-2026/
- Workers AI 무료 사용량: https://developers.cloudflare.com/workers-ai/platform/pricing/
- 무료 플랜 지원 모델: https://developers.cloudflare.com/changelog/post/2026-07-28-models-require-workers-paid/
- GitHub와 Workers 연결: https://developers.cloudflare.com/workers/ci-cd/builds/
- Worker 정적 파일 설정: https://developers.cloudflare.com/workers/static-assets/binding/
