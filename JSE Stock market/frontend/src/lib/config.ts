import { FeeProfileKey, JseSector } from "@/types/market";

export interface JseAssetMetadata {
  name: string;
  sector: JseSector;
  twin: string;
  offshore: string | null;
  offshore_ccy: string | null;
  stt_exempt: boolean;
  is_top40: boolean;
  refPriceZar: number; // Real-world JSE reference price in Rands (R ZAR) for sanity validation
}

export const JSE_UNIVERSE_MAP: Record<string, JseAssetMetadata> = {
  // 1. TENCENT / GLOBAL TECH PROXIES (TECH_TENCENT)
  "NPN.JO": {
    name: "Naspers Ltd",
    sector: "TECH_TENCENT",
    twin: "PRX.JO",
    offshore: "0700.HK",
    offshore_ccy: "HKD",
    stt_exempt: false,
    is_top40: true,
    refPriceZar: 4185.0,
  },
  "PRX.JO": {
    name: "Prosus N.V.",
    sector: "TECH_TENCENT",
    twin: "NPN.JO",
    offshore: "PRX.AS",
    offshore_ccy: "EUR",
    stt_exempt: false,
    is_top40: true,
    refPriceZar: 768.5,
  },

  // 2. DUAL-LISTED GLOBAL & RAND-HEDGE GIANTS (RAND_HEDGE)
  "CFR.JO": {
    name: "Compagnie Financière Richemont",
    sector: "RAND_HEDGE",
    twin: "BTI.JO",
    offshore: "CFR.SW",
    offshore_ccy: "CHF",
    stt_exempt: false,
    is_top40: true,
    refPriceZar: 2895.0,
  },
  "BTI.JO": {
    name: "British American Tobacco",
    sector: "RAND_HEDGE",
    twin: "ANH.JO",
    offshore: "BTI",
    offshore_ccy: "USD",
    stt_exempt: false,
    is_top40: true,
    refPriceZar: 672.4,
  },
  "ANH.JO": {
    name: "Anheuser-Busch InBev",
    sector: "RAND_HEDGE",
    twin: "BTI.JO",
    offshore: "BUD",
    offshore_ccy: "USD",
    stt_exempt: false,
    is_top40: true,
    refPriceZar: 1125.0,
  },
  "BID.JO": {
    name: "Bid Corporation (Bidcorp)",
    sector: "RAND_HEDGE",
    twin: "BVT.JO",
    offshore: null,
    offshore_ccy: null,
    stt_exempt: false,
    is_top40: true,
    refPriceZar: 452.8,
  },
  "MNP.JO": {
    name: "Mondi plc",
    sector: "RAND_HEDGE",
    twin: "SAP.JO",
    offshore: "MNDI.L",
    offshore_ccy: "GBp",
    stt_exempt: false,
    is_top40: true,
    refPriceZar: 318.5,
  },

  // 3. GOLD & PGM PRECIOUS METAL MINERS (PRECIOUS_MINER)
  "GFI.JO": {
    name: "Gold Fields Ltd",
    sector: "PRECIOUS_MINER",
    twin: "ANG.JO",
    offshore: "GFI",
    offshore_ccy: "USD",
    stt_exempt: false,
    is_top40: true,
    refPriceZar: 342.6,
  },
  "ANG.JO": {
    name: "AngloGold Ashanti",
    sector: "PRECIOUS_MINER",
    twin: "GFI.JO",
    offshore: "AU",
    offshore_ccy: "USD",
    stt_exempt: false,
    is_top40: true,
    refPriceZar: 538.2,
  },
  "HAR.JO": {
    name: "Harmony Gold Mining",
    sector: "PRECIOUS_MINER",
    twin: "GFI.JO",
    offshore: "HMY",
    offshore_ccy: "USD",
    stt_exempt: false,
    is_top40: true,
    refPriceZar: 214.5,
  },
  "IMP.JO": {
    name: "Impala Platinum (Implats)",
    sector: "PRECIOUS_MINER",
    twin: "SSW.JO",
    offshore: null,
    offshore_ccy: null,
    stt_exempt: false,
    is_top40: true,
    refPriceZar: 108.4,
  },
  "SSW.JO": {
    name: "Sibanye-Stillwater",
    sector: "PRECIOUS_MINER",
    twin: "IMP.JO",
    offshore: "SBSW",
    offshore_ccy: "USD",
    stt_exempt: false,
    is_top40: true,
    refPriceZar: 21.85,
  },
  "VAL.JO": {
    name: "Valterra Platinum (Amplats)",
    sector: "PRECIOUS_MINER",
    twin: "IMP.JO",
    offshore: null,
    offshore_ccy: null,
    stt_exempt: false,
    is_top40: true,
    refPriceZar: 645.0,
  },
  "NPH.JO": {
    name: "Northam Platinum",
    sector: "PRECIOUS_MINER",
    twin: "IMP.JO",
    offshore: null,
    offshore_ccy: null,
    stt_exempt: false,
    is_top40: true,
    refPriceZar: 129.6,
  },

  // 4. DIVERSIFIED MINERS, COMMODITIES & ENERGY (COMMODITY_MINER)
  "BHG.JO": {
    name: "BHP Group Ltd",
    sector: "COMMODITY_MINER",
    twin: "AGL.JO",
    offshore: "BHP",
    offshore_ccy: "USD",
    stt_exempt: false,
    is_top40: true,
    refPriceZar: 512.0,
  },
  "AGL.JO": {
    name: "Anglo American plc",
    sector: "COMMODITY_MINER",
    twin: "BHG.JO",
    offshore: "AAL.L",
    offshore_ccy: "GBp",
    stt_exempt: false,
    is_top40: true,
    refPriceZar: 564.5,
  },
  "GLN.JO": {
    name: "Glencore plc",
    sector: "COMMODITY_MINER",
    twin: "AGL.JO",
    offshore: "GLEN.L",
    offshore_ccy: "GBp",
    stt_exempt: false,
    is_top40: true,
    refPriceZar: 94.2,
  },
  "KIO.JO": {
    name: "Kumba Iron Ore",
    sector: "COMMODITY_MINER",
    twin: "EXX.JO",
    offshore: null,
    offshore_ccy: null,
    stt_exempt: false,
    is_top40: false,
    refPriceZar: 368.0,
  },
  "EXX.JO": {
    name: "Exxaro Resources",
    sector: "COMMODITY_MINER",
    twin: "KIO.JO",
    offshore: null,
    offshore_ccy: null,
    stt_exempt: false,
    is_top40: true,
    refPriceZar: 174.5,
  },
  "SOL.JO": {
    name: "Sasol Ltd",
    sector: "COMMODITY_MINER",
    twin: "EXX.JO",
    offshore: "SSL",
    offshore_ccy: "USD",
    stt_exempt: false,
    is_top40: true,
    refPriceZar: 98.4,
  },
  "SAP.JO": {
    name: "Sappi Ltd",
    sector: "COMMODITY_MINER",
    twin: "MNP.JO",
    offshore: null,
    offshore_ccy: null,
    stt_exempt: false,
    is_top40: false,
    refPriceZar: 49.8,
  },

  // 5. SA BANKS, INSURERS & FINANCIALS (SA_INC_FIN)
  "FSR.JO": {
    name: "FirstRand Ltd",
    sector: "SA_INC_FIN",
    twin: "SBK.JO",
    offshore: null,
    offshore_ccy: null,
    stt_exempt: false,
    is_top40: true,
    refPriceZar: 78.6,
  },
  "SBK.JO": {
    name: "Standard Bank Group",
    sector: "SA_INC_FIN",
    twin: "FSR.JO",
    offshore: null,
    offshore_ccy: null,
    stt_exempt: false,
    is_top40: true,
    refPriceZar: 242.5,
  },
  "CPI.JO": {
    name: "Capitec Bank Holdings",
    sector: "SA_INC_FIN",
    twin: "FSR.JO",
    offshore: null,
    offshore_ccy: null,
    stt_exempt: false,
    is_top40: true,
    refPriceZar: 3145.0,
  },
  "ABG.JO": {
    name: "Absa Group Ltd",
    sector: "SA_INC_FIN",
    twin: "NED.JO",
    offshore: null,
    offshore_ccy: null,
    stt_exempt: false,
    is_top40: true,
    refPriceZar: 178.4,
  },
  "NED.JO": {
    name: "Nedbank Group",
    sector: "SA_INC_FIN",
    twin: "ABG.JO",
    offshore: null,
    offshore_ccy: null,
    stt_exempt: false,
    is_top40: true,
    refPriceZar: 294.2,
  },
  "INL.JO": {
    name: "Investec Ltd",
    sector: "SA_INC_FIN",
    twin: "INP.JO",
    offshore: "INVP.L",
    offshore_ccy: "GBp",
    stt_exempt: false,
    is_top40: true,
    refPriceZar: 136.8,
  },
  "INP.JO": {
    name: "Investec plc",
    sector: "SA_INC_FIN",
    twin: "INL.JO",
    offshore: "INVP.L",
    offshore_ccy: "GBp",
    stt_exempt: false,
    is_top40: true,
    refPriceZar: 138.1,
  },
  "SLM.JO": {
    name: "Sanlam Ltd",
    sector: "SA_INC_FIN",
    twin: "DSY.JO",
    offshore: null,
    offshore_ccy: null,
    stt_exempt: false,
    is_top40: true,
    refPriceZar: 88.9,
  },
  "DSY.JO": {
    name: "Discovery Ltd",
    sector: "SA_INC_FIN",
    twin: "SLM.JO",
    offshore: null,
    offshore_ccy: null,
    stt_exempt: false,
    is_top40: true,
    refPriceZar: 194.5,
  },
  "OUT.JO": {
    name: "OUTsurance Group",
    sector: "SA_INC_FIN",
    twin: "DSY.JO",
    offshore: null,
    offshore_ccy: null,
    stt_exempt: false,
    is_top40: true,
    refPriceZar: 64.2,
  },
  "REM.JO": {
    name: "Remgro Ltd",
    sector: "SA_INC_FIN",
    twin: "FSR.JO",
    offshore: null,
    offshore_ccy: null,
    stt_exempt: false,
    is_top40: true,
    refPriceZar: 156.4,
  },

  // 6. SA RETAILERS, HEALTHCARE, TELCOS & INDUSTRIALS (SA_INC_RETAIL)
  "SHP.JO": {
    name: "Shoprite Holdings",
    sector: "SA_INC_RETAIL",
    twin: "CLS.JO",
    offshore: null,
    offshore_ccy: null,
    stt_exempt: false,
    is_top40: true,
    refPriceZar: 298.5,
  },
  "MRP.JO": {
    name: "Mr Price Group",
    sector: "SA_INC_RETAIL",
    twin: "TFG.JO",
    offshore: null,
    offshore_ccy: null,
    stt_exempt: false,
    is_top40: true,
    refPriceZar: 268.0,
  },
  "TFG.JO": {
    name: "The Foschini Group",
    sector: "SA_INC_RETAIL",
    twin: "MRP.JO",
    offshore: null,
    offshore_ccy: null,
    stt_exempt: false,
    is_top40: false,
    refPriceZar: 162.4,
  },
  "WHL.JO": {
    name: "Woolworths Holdings",
    sector: "SA_INC_RETAIL",
    twin: "SHP.JO",
    offshore: null,
    offshore_ccy: null,
    stt_exempt: false,
    is_top40: true,
    refPriceZar: 63.8,
  },
  "CLS.JO": {
    name: "Clicks Group Ltd",
    sector: "SA_INC_RETAIL",
    twin: "SHP.JO",
    offshore: null,
    offshore_ccy: null,
    stt_exempt: false,
    is_top40: true,
    refPriceZar: 382.0,
  },
  "BVT.JO": {
    name: "Bidvest Group",
    sector: "SA_INC_RETAIL",
    twin: "BID.JO",
    offshore: null,
    offshore_ccy: null,
    stt_exempt: false,
    is_top40: true,
    refPriceZar: 278.5,
  },
  "MTN.JO": {
    name: "MTN Group Ltd",
    sector: "SA_INC_RETAIL",
    twin: "VOD.JO",
    offshore: null,
    offshore_ccy: null,
    stt_exempt: false,
    is_top40: true,
    refPriceZar: 112.4,
  },
  "VOD.JO": {
    name: "Vodacom Group",
    sector: "SA_INC_RETAIL",
    twin: "MTN.JO",
    offshore: null,
    offshore_ccy: null,
    stt_exempt: false,
    is_top40: true,
    refPriceZar: 118.6,
  },
  "APN.JO": {
    name: "Aspen Pharmacare",
    sector: "SA_INC_RETAIL",
    twin: "CLS.JO",
    offshore: null,
    offshore_ccy: null,
    stt_exempt: false,
    is_top40: true,
    refPriceZar: 174.2,
  },

  // 7. JSE LIQUID ETFs — 0% STT EXEMPT & TFSA ELIGIBLE (JSE_ETF_TFSA)
  "STX40.JO": {
    name: "Satrix 40 ETF (JSE Top 40)",
    sector: "JSE_ETF_TFSA",
    twin: "SYG500.JO",
    offshore: null,
    offshore_ccy: null,
    stt_exempt: true,
    is_top40: true,
    refPriceZar: 82.45,
  },
  "SYG500.JO": {
    name: "Sygnia Itrix S&P 500 ETF",
    sector: "JSE_ETF_TFSA",
    twin: "STXNDQ.JO",
    offshore: "SPY",
    offshore_ccy: "USD",
    stt_exempt: true,
    is_top40: true,
    refPriceZar: 106.8,
  },
  "STXNDQ.JO": {
    name: "Satrix NASDAQ 100 ETF",
    sector: "JSE_ETF_TFSA",
    twin: "SYG500.JO",
    offshore: "QQQ",
    offshore_ccy: "USD",
    stt_exempt: true,
    is_top40: true,
    refPriceZar: 212.4,
  },
  "GLD.JO": {
    name: "NewGold Bullion ETF",
    sector: "JSE_ETF_TFSA",
    twin: "GFI.JO",
    offshore: "GLD",
    offshore_ccy: "USD",
    stt_exempt: true,
    is_top40: true,
    refPriceZar: 486.5,
  },
  "CSP500.JO": {
    name: "10X CoreShares S&P 500 ETF",
    sector: "JSE_ETF_TFSA",
    twin: "SYG500.JO",
    offshore: "SPY",
    offshore_ccy: "USD",
    stt_exempt: true,
    is_top40: true,
    refPriceZar: 102.4,
  },
  "STXDIV.JO": {
    name: "Satrix DIVI Plus ETF",
    sector: "JSE_ETF_TFSA",
    twin: "STX40.JO",
    offshore: null,
    offshore_ccy: null,
    stt_exempt: true,
    is_top40: true,
    refPriceZar: 2.91,
  },
};

// Standard all-in EasyEquities ZAR equity fee estimates (mirrors backend/config.py).
export const JSE_BUY_FEE_PCT = 0.65;          // Buy fee: 0.65% (0.25% brokerage + 15% VAT + 0.075% STRATE settlement + 0.25% STT tax + levies)
export const JSE_SELL_FEE_PCT = 0.38;         // Sell fee: 0.38% (0.25% brokerage + 15% VAT + 0.075% STRATE settlement + levies — no STT on sells)
export const JSE_EQUITY_FRICTION_PCT = 0.65;  // Buy fee: 0.65% (0.25% brokerage + 15% VAT + 0.075% STRATE settlement + 0.25% STT tax + levies)
export const JSE_ETF_FRICTION_PCT = 0.38;     // Sell fee: 0.38% (0.25% brokerage + 15% VAT + 0.075% STRATE settlement + levies — no STT on sells)

export interface FeeProfileSpec {
  key: FeeProfileKey;
  label: string;
  brokeragePerLegPct: number;
  vatOnBrokeragePct: number;
  sttBuyOrdinaryPct: number;
  strateIplPerLegPct: number;
  halfSpreadTop40Pct: number;
  halfSpreadMidCapPct: number;
  roundTripTop40OrdinaryPct: number;
  roundTripMidCapOrdinaryPct: number;
  roundTripSttExemptEtfPct: number;
}

export const JSE_FEE_PROFILES: Record<FeeProfileKey, FeeProfileSpec> = {
  EASYEQUITIES_ZAR: {
    key: "EASYEQUITIES_ZAR",
    label: `EasyEquities ZAR (${JSE_EQUITY_FRICTION_PCT.toFixed(2)}% Equity / ${JSE_ETF_FRICTION_PCT.toFixed(2)}% ETF)`,
    brokeragePerLegPct: 0.25,
    vatOnBrokeragePct: 0.0375,
    sttBuyOrdinaryPct: 0.25,
    strateIplPerLegPct: 0.075,
    halfSpreadTop40Pct: 0.05,
    halfSpreadMidCapPct: 0.12,
    roundTripTop40OrdinaryPct: JSE_EQUITY_FRICTION_PCT,
    roundTripMidCapOrdinaryPct: JSE_EQUITY_FRICTION_PCT,
    roundTripSttExemptEtfPct: JSE_ETF_FRICTION_PCT,
  },
  EASYEQUITIES_TFSA: {
    key: "EASYEQUITIES_TFSA",
    label: `EasyEquities TFSA (0% STT on ETFs, STT still applies to shares, 0% CGT)`,
    brokeragePerLegPct: 0.25,
    vatOnBrokeragePct: 0.0375,
    sttBuyOrdinaryPct: 0.25,
    strateIplPerLegPct: 0.075,
    halfSpreadTop40Pct: 0.05,
    halfSpreadMidCapPct: 0.10,
    roundTripTop40OrdinaryPct: JSE_EQUITY_FRICTION_PCT,
    roundTripMidCapOrdinaryPct: JSE_EQUITY_FRICTION_PCT,
    roundTripSttExemptEtfPct: JSE_ETF_FRICTION_PCT,
  },
  INSTITUTIONAL_DMA_ZAR: {
    key: "INSTITUTIONAL_DMA_ZAR",
    label: "Institutional DMA (0.08% Leg)",
    brokeragePerLegPct: 0.08,
    vatOnBrokeragePct: 0.012,
    sttBuyOrdinaryPct: 0.25,
    strateIplPerLegPct: 0.008,
    halfSpreadTop40Pct: 0.06,
    halfSpreadMidCapPct: 0.10,
    roundTripTop40OrdinaryPct: 0.59,
    roundTripMidCapOrdinaryPct: 0.67,
    roundTripSttExemptEtfPct: 0.34,
  },
};

export function getRoundTripFrictionPct(
  ticker: string,
  feeProfile: FeeProfileKey
): number {
  const meta = JSE_UNIVERSE_MAP[ticker];
  const profile = JSE_FEE_PROFILES[feeProfile] || JSE_FEE_PROFILES.EASYEQUITIES_ZAR;
  if (meta?.stt_exempt) {
    return profile.roundTripSttExemptEtfPct;
  }
  if (meta?.is_top40 === false) {
    return profile.roundTripMidCapOrdinaryPct;
  }
  return profile.roundTripTop40OrdinaryPct;
}
