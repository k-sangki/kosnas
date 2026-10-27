/** 고정 조건 페이지용 종목 목록(서버에서만). 섹터 자료에 실린 기본 필터 통과 종목을 쓴다 */
import { sectorData } from "./sectors";
import type { ScreenStock } from "./screens";

export function krScreenStocks(): ScreenStock[] {
  return sectorData("kr").sectors.flatMap((sec) =>
    sec.stocks.map((s) => ({
      code: s.code,
      name: s.name,
      market: s.market ?? "",
      sector: sec.id,
      ind: s.ind ?? null,
      rs: s.rs,
      close: s.close ?? 0,
      chg: s.chg ?? null,
      r: s.r ?? {},
      fromHigh: s.fromHigh ?? null,
      above50: s.above50 ?? false,
      capEok: null,
      base: true,
    })),
  );
}

/** 섹터 id → 이름 */
export function krSectorNames(): [string, string][] {
  return sectorData("kr").sectors.map((s) => [s.id, s.name]);
}
