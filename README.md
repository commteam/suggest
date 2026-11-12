# 2026 SUGGESTION AWARDS — 사내 제안제도 수행 우수자 발표

> **배포 (3줄 요약)**
> 1. Vercel 또는 Netlify에서 이 GitHub 저장소를 가져오면 됩니다. 빌드 명령 `npm run build`, 출력 폴더 `dist`, SPA 라우팅은 `vercel.json`/`netlify.toml`에 이미 들어 있습니다.
> 2. 배포 설정의 환경 변수에 `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`를 넣고 다시 배포합니다. 비워 두면 데모 모드로 뜹니다.
> 3. 배포된 주소의 `/admin`에서 로그인한 뒤 **연출 설정 → 접속 코드**를 정하면 공개 사이트가 열립니다.

영화제 시상식처럼 연출한 사내 제안제도 우수자 발표 사이트입니다.
닫힌 블루 벨벳 커튼이 열리는 오프닝, 금색 액자가 걸린 명예의 전당, 사람별 상세 화면(AS-IS → 추진 내용 → TO-BE → 진행 소감)으로 구성됩니다. 관리자 페이지에서 사진과 내용을 직접 고칠 수 있습니다.

- React + Vite + TypeScript + Tailwind v4 + shadcn/ui(Radix) + React Router
- Framer Motion, HTML Canvas(스포트라이트, 색종이), Web Audio API(효과음 합성)
- Supabase(Postgres, Auth, Storage, Realtime)

---

## ✅ 직접 해야 할 일 체크리스트

> **🔑 접속 코드 정하는 방법 (가장 먼저 기억해 둘 것)**
> 공개 사이트는 **접속 코드를 정하기 전까지 "발표 준비 중"으로 잠겨 있습니다.**
> 아래 1~6단계를 마친 뒤 `https://배포주소/admin` 에 관리자 계정으로 로그인합니다.
> **연출 설정** 메뉴 맨 위 **접속 코드** 칸에 6자 이상의 코드를 두 번 입력하고 **코드 저장**을 누르면 됩니다.
> 코드는 bcrypt 해시로만 저장되고, 같은 곳에서 언제든 바꿀 수 있습니다. 바꾸면 이미 접속한 관람자도 새 코드를 다시 입력해야 합니다.

순서대로 진행하세요.

- [ ] **1. Supabase 프로젝트 만들기**
      [supabase.com](https://supabase.com) → New project. 지역은 Northeast Asia (Seoul)을 권장합니다.
- [ ] **2. 마이그레이션 실행** (SQL Editor에 파일 내용을 붙여 넣고 Run. **반드시 번호 순서대로**)
  1. `supabase/migrations/20260101000001_roles.sql`
  2. `supabase/migrations/20260101000002_winners.sql`
  3. `supabase/migrations/20260101000003_site_settings.sql`
  4. `supabase/migrations/20260101000004_public_api.sql`
  5. `supabase/migrations/20260101000005_presentation.sql`
  6. `supabase/migrations/20260101000006_storage.sql`
  7. `supabase/migrations/20260101000007_restore_awards.sql`
  8. (선택) `supabase/seed.sql`: 가상 인물 5명 예시 데이터
  - Supabase CLI를 쓴다면 `supabase link --project-ref <ref>` 다음 `supabase db push` 한 번으로 1~7이 실행됩니다.
  - 모든 파일은 다시 실행해도 안전합니다(멱등).
- [ ] **3. 관리자 계정 만들기**
      Authentication → Users → **Add user** → 이메일과 비밀번호 입력, *Auto Confirm User* 체크
      (권장) Authentication → Sign In / Providers → Email에서 **Allow new users to sign up** 끄기
- [ ] **4. 관리자 지정 SQL** (SQL Editor에서 한 줄, 이메일만 바꿔서 실행)
  ```sql
  insert into public.user_roles (user_id, role) select id, 'admin' from auth.users where email = 'admin@company.com' on conflict do nothing;
  ```
  관리자를 해제하려면 다음을 실행합니다.
  ```sql
  delete from public.user_roles where role = 'admin' and user_id = (select id from auth.users where email = 'admin@company.com');
  ```
- [ ] **5. 환경 변수 입력**
      Project Settings → API에서 **Project URL**과 **anon public** 키를 복사합니다.
      - 로컬 개발: `.env.example`을 `.env.local`로 복사해 값을 채웁니다(커밋되지 않음).
      - 배포: Vercel/Netlify 환경 변수에 같은 이름으로 넣습니다.
      - ⚠️ `service_role` 키는 절대 넣지 마세요. 브라우저에는 anon 키만 씁니다.
- [ ] **6. 배포** (아래 「배포」 참고) → 배포 주소의 `/admin` 접속
- [ ] **7. 접속 코드 설정**: `/admin` → 연출 설정 → 접속 코드 (위 🔑 참고)
- [ ] **8. 내용 입력**: 우수자 관리에서 사진과 내용을 입력하고 공개 여부를 정합니다. 연출 설정에서 행사 제목, 오프닝 문구, 포인트 컬러, (선택) 팡파르·배경음 mp3를 정합니다.
- [ ] **9. 리허설**: 발표 모드에서 **전체 비공개**를 한 다음, 다른 기기에서 공개 사이트를 열어 둡니다. **다음 사람 공개**를 누르면 그 기기에서 스포트라이트 → 플래시 → 사진 → 팡파르 순서로 연출되는지 확인합니다.

---

## 실행 방법

```bash
npm install
```

```bash
npm run dev
```

http://localhost:5173 에서 공개 화면을, http://localhost:5173/admin 에서 관리자 화면을 볼 수 있습니다.

| 명령 | 설명 |
|---|---|
| `npm run dev` | 개발 서버 |
| `npm run build` | 타입 검사 + 프로덕션 빌드(`dist/`) |
| `npm run lint` | ESLint |
| `npm test` | Vitest 단위 테스트(오프닝 타임라인, 텍스트 파서, 복원 검증, 공개 전 마스킹 등) |
| `npm run e2e` | 데모 모드 전체 흐름 Playwright 검사(먼저 `npx vite preview --port 4173` 실행) |
| `npm run test:db` | 로컬 PostgreSQL에서 마이그레이션·RLS 보안 테스트(`PGUSER=postgres`) |

### 데모 모드 vs Supabase 모드

| | 데모 모드 | Supabase 모드 |
|---|---|---|
| 조건 | 환경 변수 없음 | `VITE_SUPABASE_URL` + `VITE_SUPABASE_ANON_KEY` |
| 저장 위치 | 이 브라우저의 localStorage(사진은 data URL) | Postgres + Storage |
| 관리자 로그인 | 비밀번호 `demo1234` | Supabase Auth 이메일 로그인 + `user_roles` |
| 접속 코드 게이트 | 꺼짐(바로 입장) | 켜짐(코드 전에는 "준비 중") |
| 발표 모드 전파 | 같은 브라우저의 다른 탭(BroadcastChannel) | 모든 브라우저(Realtime) |
| 표시 | 상단에 "데모 모드" 배지 | 없음 |

두 모드는 같은 UI를 씁니다(`src/lib/data/DataProvider.ts` 인터페이스). `.env.local`만 채우면 그대로 전환됩니다.

## 환경 변수

| 이름 | 설명 |
|---|---|
| `VITE_SUPABASE_URL` | Supabase Project URL (`https://xxxx.supabase.co`) |
| `VITE_SUPABASE_ANON_KEY` | Supabase anon public 키 |

비밀 값은 코드에 넣지 않습니다. `.env*.local`은 `.gitignore`에 들어 있습니다.

## 배포

### Vercel
1. Vercel → Add New → Project → 이 저장소를 Import합니다(Framework: Vite 자동 인식).
2. Settings → Environment Variables에 `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`를 추가합니다.
3. Deploy합니다. 환경 변수를 바꾼 뒤에는 **Redeploy**해야 반영됩니다. Vite는 빌드할 때 값을 넣기 때문입니다.

### Netlify
1. Add new site → Import from Git → 이 저장소를 고릅니다. 빌드 설정은 `netlify.toml`에서 자동으로 읽습니다.
2. Site configuration → Environment variables에 위 두 값을 추가합니다.
3. Deploys → Trigger deploy를 누릅니다.

SPA 라우팅(`/admin` 새로고침)은 `vercel.json`과 `netlify.toml`의 rewrite 설정으로 처리됩니다.

## 보안 설계

- **공개 전 데이터 차단**: `winners`와 `site_settings` 테이블은 관리자만 직접 읽을 수 있습니다. 공개 화면은 `get_public_awards(code)` 함수로만 읽고, 이 함수는 다음 규칙을 따릅니다.
  - 접속 코드가 틀리면 아무것도 돌려주지 않습니다.
  - 공개 전(`is_revealed=false`)인 사람은 `id`, 순서, 이름, 소속만 돌려줍니다. 사진 URL, 직급, 제안 내용은 응답 JSON에 아예 없어서 개발자도구로도 볼 수 없습니다.
- **접속 코드**: 서버에서 검증합니다. `access_code_hash`(bcrypt)는 공개 함수가 내보내지 않고, 컬럼 단위 권한으로 관리자도 직접 읽거나 쓸 수 없습니다. 바꿀 때는 `set_access_code()`를 씁니다.
- **관리자 판별**: `user_roles` 테이블과 `has_role()`/`is_admin()`(SECURITY DEFINER, `search_path` 고정)으로만 판별합니다. `user_roles`는 클라이언트가 쓸 수 없습니다.
- **Storage**: 버킷 읽기는 공개 URL로만 가능하고 쓰기는 관리자만 할 수 있습니다. 이미지는 5MB, 오디오는 10MB로 제한하고 MIME 형식도 제한합니다. 익명 사용자의 목록 조회 정책은 일부러 만들지 않았습니다. 목록이 열리면 공개 전 사진의 파일명을 알아낼 수 있기 때문입니다. 파일명은 UUID입니다.
- **Realtime**: `presentation_events`에는 이벤트 종류와 `winner_id`만 담습니다. 신호를 받은 클라이언트는 다시 코드를 붙여 RPC로 읽습니다.
- **복원**: `restore_awards(payload)`는 SECURITY INVOKER로 동작하고 관리자만, `authenticated` 역할에만 실행 권한이 있습니다. 모든 검증을 삭제 전에 하고, 한 트랜잭션으로 처리해서 실패하면 원래대로 돌아갑니다.

`supabase/tests/10_security_test.sql`이 위 내용을 실제 Postgres에서 검증합니다(`npm run test:db`).

## 폴더 구조

```
src/
  components/
    intro/        Intro, Curtains, SpotlightCanvas, Confetti, GoldDots, IntroControls, introConfig.ts(타이밍 상수)
    gallery/      Gallery, Frame, Nameplate, Silhouette, WallBackdrop
    detail/       DetailOverlay, WinnerDetail, StoryBlock, StoryText, DevelopingPhoto, Pager
    gate/         AccessGate
    presentation/ RevealSpotlight
    ui/           shadcn 스타일 기본 컴포넌트
  hooks/          useIntroTimeline, useAwards, useAdminSession …
  lib/
    data/         DataProvider, MockProvider, SupabaseProvider, mask, backup, seedData
    intro/        timeline.ts (오프닝 상태 기계 + 스케줄러)
    audio/        SoundEngine (Web Audio 합성)
    text/         parseStory (줄바꿈·불릿 파서)
  pages/          PublicPage, admin/*
supabase/
  migrations/     스키마·RLS·함수 (번호 순서대로 실행)
  seed.sql        예시 데이터
  tests/          로컬 Postgres 보안 테스트
scripts/          e2e.mjs, e2e-supabase.mjs, screenshots.mjs, test-db.sh
```

## 사용 팁

- 오프닝 타이밍은 `src/components/intro/introConfig.ts` 한 파일에서 바꿉니다.
- 색은 `src/styles/tokens.css`의 CSS 변수로 관리합니다. 포인트 컬러(`--c-accent`)는 관리자 설정에서 바꿀 수 있고, 실버 프리셋은 `#cfd8e6`입니다.
- 제안 내용에서 줄바꿈은 그대로 보이고, `- `로 시작하는 줄은 글머리표로 바뀝니다. HTML은 해석하지 않습니다.
- 관람자가 한 번 열어 본 액자는 그 브라우저에서 계속 공개 상태로 보입니다(localStorage).
- 효과음은 사용자가 클릭한 뒤에만 재생됩니다. 관리자가 팡파르 mp3를 올리면 합성음 대신 그 파일을 씁니다.
