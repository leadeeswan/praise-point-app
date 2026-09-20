# 칭찬정원 🌱

부모가 아이의 착한 일에 포인트를 주고, 아이가 모은 포인트로 우리 가족 선물을 구매하는 한국어 반응형 앱입니다.

## 실행

Node.js 22 이상을 사용합니다.

```sh
npm ci
cp .env.example .env.local
# .env.local에 Supabase 프로젝트 URL과 공개 키 입력
npm run dev
```

브라우저에서 http://127.0.0.1:5173 을 엽니다. **체험 정원 둘러보기**는 실제 계정 없이 사용할 수 있습니다. 체험 데이터는 해당 브라우저에만 저장되며 실서비스 데이터와 분리됩니다. 체험 중 **아이로 보기 / 부모로 보기**로 지급 → 구매 → 전달 완료 흐름을 확인할 수 있습니다.

## 기능

- 부모: 이메일 회원가입·로그인, 아이 등록(아이디·이름·나이·인증번호), 칭찬포인트 지급, 상품 등록, 구매 상품 전달 완료
- 아이: 아이디·인증번호 로그인, 보유 포인트와 칭찬 기록 조회, 상품 구매, 구매 내역 조회
- 모바일·데스크톱 반응형 화면, 잔액 부족 안내, 중복 제출 방지
- Supabase Auth, PostgreSQL RLS 가족 격리, 거래 원장, 원자적 구매 차감
- GitHub Pages 자동 배포

## Supabase 설정

프로젝트: `https://fcocaepkerctaamelmnk.supabase.co`

1. SQL Editor에서 `supabase/migrations/`의 SQL 파일을 파일명 순서대로 각각 **한 번** 실행합니다. 기존 테이블이 없는 새 프로젝트 기준입니다.
2. Edge Functions에 `create-child`를 배포합니다. Dashboard의 에디터에 `supabase/functions/create-child/index.ts` 내용을 붙여 넣거나 CLI를 사용합니다.

```sh
npx supabase login
npx supabase link --project-ref fcocaepkerctaamelmnk
npx supabase functions deploy create-child --no-verify-jwt
```

함수의 JWT 게이트웨이 검증은 꺼두고 함수 내부 `auth.getUser()`로 토큰을 검증합니다. 함수는 다시 DB의 부모 역할을 확인합니다. `SUPABASE_SERVICE_ROLE_KEY`는 Supabase Edge Function 서버에 자동 제공되는 값을 사용하며 브라우저나 GitHub 저장소에 넣지 않습니다.

3. Authentication → URL Configuration에 최종 GitHub Pages 주소를 Site URL 및 Redirect URL로 추가합니다. 개발용으로 `http://127.0.0.1:5173/`도 Redirect URL에 추가합니다.
4. 이메일 가입 확인을 사용하는 경우 메일의 확인 링크를 눌러 가입을 마칩니다. 공개 서비스에서는 필요에 따라 SMTP를 설정합니다.
5. 아이 인증번호는 숫자 6~12자리입니다. Supabase Auth의 최소 비밀번호 길이는 6으로 설정해야 하며, 숫자 외 문자 필수 정책을 켜면 아이 등록이 실패합니다. 부모의 앱 회원가입 화면은 8자 이상을 요구합니다.

아이의 아이디는 내부적으로 `<아이디>@children.praise.invalid` 형태의 Supabase Auth 계정에 매핑되며 이메일 주소는 아이에게 필요하지 않습니다. 아이디는 서비스 전체에서 유일해야 합니다. 인증번호는 Supabase Auth에서 해시 처리하며 별도 테이블에 저장하지 않습니다. 아이 역할과 가족 연결은 관리자만 수정할 수 있는 `app_metadata`와 인증 트리거를 사용합니다. Auth는 계정 INSERT 이후 같은 트랜잭션에서 관리자 메타데이터를 저장하므로, 프로필 트리거는 트랜잭션 종료 시 최종 데이터를 읽습니다.

## GitHub Pages 배포

1. 이 폴더를 GitHub public 저장소의 `main` 브랜치에 올립니다.
2. Settings → Pages → Source를 **GitHub Actions**로 설정합니다.
3. 현재 프로젝트의 URL과 공개 키는 배포 워크플로 기본값으로 설정되어 있습니다. 다른 Supabase 프로젝트로 변경할 때는 Settings → Secrets and variables → Actions → **Variables**에 아래 변수를 추가해 덮어씁니다.

| 변수 | 값 |
| --- | --- |
| `VITE_SUPABASE_URL` | `https://fcocaepkerctaamelmnk.supabase.co` |
| `VITE_SUPABASE_ANON_KEY` | 프로젝트의 공개 anon 또는 publishable 키 |

4. `main`에 push하거나 Actions → Deploy to GitHub Pages → Run workflow를 실행합니다.
5. 배포 URL을 Supabase의 Site URL / Redirect URLs에 등록합니다.

`base: './'`로 설정되어 `/저장소이름/` 하위 경로에서 동작합니다. 웹 서버 없이 정적 파일만 호스팅합니다. 공개 키는 브라우저 빌드에 포함되는 정상적인 값이며, 데이터 접근 보호는 RLS와 서버 함수에서 수행합니다. Supabase 무료 플랜의 사용량·일시중지 정책은 프로젝트 대시보드에서 확인하세요.

## 검증

```sh
npm test
npm run build
```

테스트는 PGlite의 실제 PostgreSQL 엔진에 SQL 마이그레이션을 적용하여 RLS, 가족 경계, 권한 상승 방지, 직접 잔액 수정 차단, 구매 차감과 원장 일치, 잔액 부족, 전달 완료 권한을 검증합니다. Supabase Auth 네트워크 로그인과 Edge Functions 배포는 별도로 실제 프로젝트에서 확인해야 합니다. 구매 함수는 아이 행을 잠가 동시 요청의 초과 지출을 막습니다. 여러 번 의도적으로 구매하면 각각 별도 구매로 처리됩니다.

## 현재 범위

상품은 부모가 직접 전달하는 보상이며 실제 결제·배송은 하지 않습니다. 인증번호 재설정, 아이·상품 수정/삭제, 구매 취소·환불, 이메일 비밀번호 재설정 화면은 아직 포함하지 않습니다. 칭찬·구매 기록은 최근 100건을 보여줍니다. 다른 기기의 변경 사항은 화면을 새로고침하면 반영됩니다.

## 공식 참고 문서

- [Supabase RLS](https://supabase.com/docs/guides/database/postgres/row-level-security)
- [Supabase 관리자 계정 생성](https://supabase.com/docs/reference/javascript/auth-admin-createuser)
- [Supabase Edge Functions 인증](https://supabase.com/docs/guides/functions/auth)
- [GitHub Pages Actions 배포](https://docs.github.com/en/pages/getting-started-with-github-pages/using-custom-workflows-with-github-pages)
