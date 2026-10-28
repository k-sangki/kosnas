import { AD_SLOTS, AdSlot } from "./AdSlot";
import { CaptureArea } from "./CaptureArea";
import { Fold } from "./Fold";
import { ArkTrades, RecentMoves } from "./Investors";
import { InvestorList, SectorFlows } from "./Investors13F";
import { MarketContent } from "./MarketPage";
import { UsBoard } from "./UsBoard";
import { UsSectors } from "./UsSectors";
import { US_ENABLED } from "@/lib/sectors";

/** 미장 본문. 첫 화면과 /us가 같이 쓴다 */
export function UsContent() {
  return (
    <>
      <h1 className="page-title">미국증시 실시간 흐름</h1>
      <CaptureArea
        name="us-investors"
        heading="유명 투자자 최근 30일 매매"
        title="유명 투자자 최근 30일 매매"
        url="https://kosnas.com/us"
        foot="SEC 공시·ARK 공개 보유 내역으로 정리한 참고 자료입니다"
      >
        <RecentMoves />
        <ArkTrades />
      </CaptureArea>
      <p className="lead">
        미국 정규장(뉴욕 09:30~16:00, 한국 시각 22:30~05:00 · 표준시 기간에는 23:30~06:00) 동안 S&P 500과 나스닥 100이 전일 종가보다 얼마나 오르내렸는지
        실시간으로 보여줍니다.
      </p>
      <UsBoard />
      {!US_ENABLED && <UsSectors />}
      <InvestorList />
      <SectorFlows />
      {!US_ENABLED && <AdSlot slot={AD_SLOTS.board} />}
      <section className="card seo-text">
        <Fold title="어떻게 보나요">
          <p>
            두 선은 S&P 500과 나스닥 100을 따라가는 무기한선물 가격을 미국 직전 거래일 16:00(뉴욕) 가격과 비교한 등락률입니다. 정규장 시간에는 무기한선물이
            지수와 거의 같이 움직이므로 지수가 지금 얼마나 올랐는지 가늠하는 데 쓸 수 있습니다. 가로축은 한국 시각이고, 미국 서머타임이 끝나면 개장이 한 시간
            늦어집니다.
          </p>
          <p>
            한국 대형주 ETF(EWY)와 삼성전자·SK하이닉스, 원/달러 같은 한국 관련 시세와 밤사이 코스피200 수준은 대시보드 화면에서 함께 볼 수 있습니다. 미국 장이
            한국 대형주를 어떻게 보고 있는지, 다음 날 국내 장이 어느 쪽으로 출발할지 짐작하는 데 도움이 됩니다.
          </p>
        </Fold>
        <Fold title="미국증시 개장시간과 휴장일">
          <p>
            뉴욕증권거래소·나스닥 정규장은 뉴욕 시각 09:30~16:00입니다. 한국 시각으로는 서머타임 기간(3월 둘째 일요일~11월 첫째 일요일)에 22:30~다음 날 05:00, 그
            밖에는 23:30~06:00입니다. 2026년은 11월 1일에 서머타임이 끝나 11월 2일(월) 밤부터 23:30에 열리고, 2027년은 3월 14일부터 다시 22:30입니다. 정규장
            앞뒤의 프리마켓(뉴욕 04:00~09:30)과 애프터마켓(16:00~20:00)은 한국 시각으로 서머타임 기간 17:00~22:30, 05:00~09:00이고 그 밖에는 한 시간씩
            늦습니다.
          </p>
          <p>
            남은 2026년 휴장일은 추수감사절 11월 26일(목)과 성탄절 12월 25일(금)이고, 11월 27일과 12월 24일은 뉴욕 13:00에 일찍 닫습니다. 2027년 휴장일은 1월
            1일(새해), 1월 18일(마틴 루서 킹 데이), 2월 15일(대통령의 날), 3월 26일(성금요일), 5월 31일(현충일), 6월 18일(노예해방기념일 대체), 7월 5일(독립기념일
            대체), 9월 6일(노동절), 11월 25일(추수감사절), 12월 24일(성탄절 대체)입니다. 날짜는 미국 현지 기준이라 한국 시각으로는 그날 밤 장이 열리지 않고,
            거래소 사정으로 바뀔 수 있으니 거래소 공지를 함께 확인하세요.
          </p>
        </Fold>
        <Fold title="유의할 점">
          <p>
            이 값은 지수 사업자의 공식 지수 시세가 아니라 해외에서 거래되는 무기한선물 가격으로 계산한 참고값이며, 실제 지수와 조금씩 다를 수 있습니다. 미국
            휴장일은 따로 표시하지 않습니다. 원천 시세는 Hyperliquid의 trade.xyz 시장(공개 API)이며, 특정 종목이나 선물의 매수·매도를 권하지 않습니다.
          </p>
        </Fold>
      </section>
      {US_ENABLED && <MarketContent market="us" />}
    </>
  );
}
