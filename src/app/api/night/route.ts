// 배포에서는 Workers 진입점이 Next.js보다 먼저 받는다(CPU 절약). 이 라우트는 next dev용
export const dynamic = "force-dynamic";
export { nightGET as GET } from "@/lib/night-api";
