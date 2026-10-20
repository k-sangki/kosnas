import { defineCloudflareConfig } from "@opennextjs/cloudflare";
import staticAssetsIncrementalCache from "@opennextjs/cloudflare/overrides/incremental-cache/static-assets-incremental-cache";

// 빌드 때 만든 정적 페이지만 쓰고, 예보는 Workers 엣지 캐시(src/lib/cache.ts)로 캐싱한다.
// R2를 쓰지 않으므로 Cloudflare에서 R2 활성화(결제 수단 등록)가 필요 없다.
export default defineCloudflareConfig({
  incrementalCache: staticAssetsIncrementalCache,
});
