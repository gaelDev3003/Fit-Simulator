# Fit Simulator

## 개요

Fit Simulator는 사용자가 업로드한 **인물 사진**과 **의류·소품 이미지**를 결합하여 가상 착용 모습을 생성해볼 수 있는 **AI 기반 웹 시뮬레이터**입니다.  

---

## 핵심 기능 요약

* **이미지 업로드 & 미리보기**  
  → 인물/의류 이미지를 업로드하고 결과 미리보기를 확인할 수 있습니다.

* **AI 합성 (옵션)**  
  → `GEMINI_LIVE=true`와 `GEMINI_API_KEY` 설정 시 실제 합성을 실행합니다.  
  → 기본값은 목업 모드로 키 없이도 실행 가능합니다.

* **(선택) 결과 저장/공유**  
  → Supabase 연결 시 결과를 저장하고 공유 링크를 발급할 수 있습니다.

* **Next.js(App Router) 기반 UI**  
  → 직관적인 라우팅과 UI 구조로 누구나 쉽게 확장 가능합니다.

---

## 기술 스택 및 환경

| 범주           | 사용 기술                                                              | 설명                      |
| ------------ | ------------------------------------------------------------------ | ----------------------- |
| **Frontend** | **Next.js 14(App Router)**, **React 18**, **Tailwind CSS**, **TS** | UI/페이지/스타일링             |
| **Backend**  | **Next.js API Routes**                                             | 업로드/합성/다운로드 API         |
| **Database** | **Supabase (선택)**                                                  | 결과 저장 및 공유 기능           |
| **AI 모델**    | **Gemini 2.5 Flash (옵션)**                                          | `GEMINI_LIVE=true` 시 사용 |

---

## 로컬 개발 환경 및 실행 가이드

### 1. 프로젝트 클론 및 설치
```bash
git clone https://github.com/[your-name]/fitsimulator.git
cd fitsimulator
npm install
````

### 2. 환경 변수 설정

`.env.example`을 복사해 `.env` 파일을 만들고 값들을 채워주세요.
예시:

```env
GEMINI_LIVE=false
# GEMINI_API_KEY=<your-gemini-api-key>
NEXT_PUBLIC_SUPABASE_URL=<your-supabase-url>   # (선택)
NEXT_PUBLIC_SUPABASE_ANON_KEY=<your-anon-key> # (선택)
```

### 3. 개발 서버 실행

```bash
npm run dev
```

→ `http://localhost:3000` 에서 확인 가능합니다.

---

## 향후 개발 방향

* 회원별 이미지 생성 이력 조회 (Supabase 기반)
* 업로드 결과 리스트 페이지 제공
* 공유 링크/갤러리 기능 고도화

---

## 라이선스

MIT License
자세한 내용은 [LICENSE](./LICENSE) 파일을 참고하세요.

