# Supabase 설정 (선택사항)

결과를 저장하고 싶을 때만 설정하세요.

## 1. 프로젝트 생성
1. [Supabase](https://supabase.com) 접속
2. "New Project" 클릭
3. Settings → API에서 URL과 키 복사

## 2. 환경 변수 추가
.env.local 파일에 추가:
```env
NEXT_PUBLIC_SUPABASE_URL=your-url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-key
```

## 3. 테스트
```bash
npm run dev
```

더 자세한 설정은 나중에 필요할 때 진행하세요.
