/**
 * 새 배포(코드·자료) 감지 규칙. 홈 화면에 추가한 앱은 닫지 않으면 옛 화면이 계속 떠 있어서
 * 화면(UpdateWatcher)이 이 규칙으로 새 버전을 확인하고 적용할 때를 고른다.
 */

/** 화면이 보이는 동안 새 버전을 확인하는 간격 */
export const CHECK_EVERY_MS = 10 * 60_000;
/** 앱으로 돌아올 때마다 확인하되 이보다 자주는 묻지 않는다 */
export const MIN_GAP_MS = 30_000;
/** 같은 버전으로 다시 불러왔는데도 여전히 옛 버전이면(배포가 퍼지는 중) 이 시간 동안은 다시 불러오지 않는다 */
export const RETRY_AFTER_MS = 10 * 60_000;

/** 지금 화면 버전과 서버 버전이 다른가. 어느 쪽이든 모르면(개발 서버 등) 다르다고 보지 않는다 */
export function isNewVersion(current: string | null | undefined, latest: string | null | undefined) {
  if (!current || !latest || current === "dev" || latest === "dev") return false;
  return current !== latest;
}

/** 이 버전으로 다시 불러온 지 얼마 안 됐으면 또 불러오지 않는다(새로고침 되풀이 방지) */
export function reloadAllowed(target: string, last: { v: string; at: number } | null, now: number) {
  if (!last || last.v !== target) return true;
  return now - last.at > RETRY_AFTER_MS;
}

/** 확인할 때가 됐는가 */
export function dueForCheck(lastCheck: number, now: number, gap = MIN_GAP_MS) {
  return now - lastCheck >= gap;
}
