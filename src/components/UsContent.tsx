import { AD_SLOTS, AdSlot } from "./AdSlot";
import { CaptureArea } from "./CaptureArea";
import { ArkTrades, RecentMoves } from "./Investors";
import { MarketContent } from "./MarketPage";
import { UsBoard } from "./UsBoard";
import { UsSectors } from "./UsSectors";
import { US_ENABLED } from "@/lib/sectors";

/** 미장 본문. 첫 화면과 /us가 같이 쓴다 */
export function UsContent() {
  return (
    <>
      <h1 className="page-title">미국 증시 흐름</h1>
      <CaptureArea name="us" title="미국 증시 흐름" url="https://kosnas.com/us" foot="해외 무기한선물·SEC 공시로 만든 참고용 자료입니다">
        <RecentMoves limit={8} more />
        <ArkTrades limit={8} />
        <p className="lead no-capture">
          미국 정규장(뉴욕 09:30~16:00, 한국 시각 22:30~05:00 · 표준시 기간에는 23:30~06:00) 동안 S&P 500과 나스닥 100이 전일 종가보다 얼마나 오르내렸는지
          실시간으로 보여줍니다.
        </p>
        <UsBoard />
      </CaptureArea>
      {!US_ENABLED && <UsSectors />}
      {!US_ENABLED && <AdSlot slot={AD_SLOTS.board} />}
      <section className="card seo-text">
        <h2 className="card-title">어떻게 보나요</h2>
        <p>
          두 선은 S&P 500과 나스닥 100을 따라가는 무기한선물 가격을 미국 직전 거래일 16:00(뉴욕) 가격과 비교한 등락률입니다. 정규장 시간에는 무기한선물이 지수와
          거의 같이 움직이므로 지수가 지금 얼마나 올랐는지 가늠하는 데 쓸 수 있습니다. 가로축은 한국 시각이고, 미국 서머타임이 끝나면 개장이 한 시간 늦어집니다.
        </p>
        <p>
          한국 대형주 ETF(EWY)와 삼성전자·SK하이닉스, 원/달러 같은 한국 관련 시세와 밤사이 코스피200 수준은 대시보드 화면에서 함께 볼 수 있습니다. 미국 장이
          한국 대형주를 어떻게 보고 있는지, 다음 날 국내 장이 어느 쪽으로 출발할지 짐작하는 데 도움이 됩니다.
        </p>
        <h2 className="card-title">유의할 점</h2>
        <p>
          이 값은 지수 사업자의 공식 지수 시세가 아니라 해외에서 거래되는 무기한선물 가격으로 계산한 참고값이며, 실제 지수와 조금씩 다를 수 있습니다. 미국
          휴장일은 따로 표시하지 않습니다. 원천 시세는 Hyperliquid의 trade.xyz 시장(공개 API)이며, 특정 종목이나 선물의 매수·매도를 권하지 않습니다.
        </p>
      </section>
      {US_ENABLED && <MarketContent market="us" />}
    </>
  );
}
