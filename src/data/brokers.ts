// Curated list of common MT5 brokers and their known server names.
//
// This is intentionally a static reference list, not a live API call — MetaApi
// does not expose a public broker/server directory endpoint. Broker/server
// matching only happens by typing the exact name or via automatic detection
// on connection attempt. "Other / not listed" always falls back to manual
// entry, and even within a known broker you can type a custom server, so no
// broker is ever actually blocked by this list being incomplete.
export interface Broker {
  name: string;
  servers: string[];
}

export const BROKERS: Broker[] = [
  { name: 'Exness', servers: ['Exness-MT5Trial', 'Exness-MT5Trial16', 'Exness-MT5Real', 'Exness-MT5Real2', 'Exness-MT5Real3'] },
  { name: 'IC Markets', servers: ['ICMarketsSC-Live01', 'ICMarketsSC-Live02', 'ICMarketsSC-Demo'] },
  { name: 'Pepperstone', servers: ['Pepperstone-Live01', 'Pepperstone-Live02', 'Pepperstone-Demo'] },
  { name: 'FTMO', servers: ['FTMO-Server', 'FTMO-Server2', 'FTMO-Server3', 'FTMO-Demo', 'FTMO-Demo2'] },
  { name: 'XM', servers: ['XM-Real 1', 'XM-Real 2', 'XM-Real 24', 'XM-Demo 3'] },
  { name: 'FXTM', servers: ['FXTM-Real', 'FXTM-ECN', 'FXTM-Demo'] },
  { name: 'OctaFX', servers: ['OctaFX-Real', 'OctaFX-Demo'] },
  { name: 'Alpari', servers: ['Alpari-MT5', 'Alpari-Demo'] },
  { name: 'Tickmill', servers: ['Tickmill-Live', 'Tickmill-Demo'] },
  { name: 'Vantage', servers: ['VantageInternational-Live', 'VantageInternational-Demo'] },
  { name: 'HFM (HotForex)', servers: ['HFMarketsGlobal-Real', 'HFMarketsGlobal-Demo'] },
  { name: 'FBS', servers: ['FBS-Real', 'FBS-Real-2', 'FBS-Demo'] },
  { name: 'FxPro', servers: ['FxPro-MT5', 'FxPro-MT5 Demo'] },
  { name: 'Admirals (Admiral Markets)', servers: ['Admirals-Live', 'Admirals-Demo'] },
  { name: 'Deriv', servers: ['Deriv-Server', 'Deriv-Demo'] },
  { name: 'RoboForex', servers: ['RoboForex-Pro', 'RoboForex-ECN', 'RoboForex-Demo'] },
  { name: 'MyForexFunds', servers: ['MyForexFunds-Server'] },
  { name: 'The5ers', servers: ['The5ers-Server'] },
  { name: 'Fusion Markets', servers: ['FusionMarkets-Live', 'FusionMarkets-Demo'] },
  { name: 'BlackBull Markets', servers: ['BlackBull-Live', 'BlackBull-Demo'] },
  { name: 'Eightcap', servers: ['Eightcap-Live', 'Eightcap-Demo'] },
  { name: 'Axi', servers: ['Axi-US02-Live', 'Axi-Demo'] },
  { name: 'Global Prime', servers: ['GlobalPrime-Live', 'GlobalPrime-Demo'] },
  { name: 'ThinkMarkets', servers: ['ThinkMarkets-Live', 'ThinkMarkets-Demo'] },
  { name: 'IG', servers: ['IG-Live', 'IG-Demo'] },
  { name: 'Swissquote', servers: ['Swissquote-Live', 'Swissquote-Demo'] },
  { name: 'Dukascopy', servers: ['Dukascopy-Live', 'Dukascopy-Demo'] },
  { name: 'AvaTrade', servers: ['AvaTrade-Live', 'AvaTrade-Demo'] },
  { name: 'Forex.com (StoneX)', servers: ['FOREXcom-Live', 'FOREXcom-Demo'] },
  { name: 'OANDA', servers: ['OANDA-Live', 'OANDA-Demo'] },
  { name: 'CMC Markets', servers: ['CMCMarkets-Live', 'CMCMarkets-Demo'] },
  { name: 'Darwinex', servers: ['Darwinex-Live', 'Darwinex-Demo'] },
  { name: 'Blueberry Markets', servers: ['BlueberryMarkets-Live', 'BlueberryMarkets-Demo'] },
  { name: 'GO Markets', servers: ['GOMarkets-Live', 'GOMarkets-Demo'] },
  { name: 'Land FX', servers: ['LandFX-Live', 'LandFX-Demo'] },
  { name: 'Windsor Brokers', servers: ['Windsor-Live', 'Windsor-Demo'] },
  { name: 'JustMarkets', servers: ['JustMarkets-Live', 'JustMarkets-Demo'] },
  { name: 'InstaForex', servers: ['InstaForex-Server', 'InstaForex-Demo'] },
  { name: 'MyFundedFX', servers: ['MyFundedFX-Server'] },
  { name: 'FundedNext', servers: ['FundedNext-Server'] },
  { name: 'The Funded Trader', servers: ['TheFundedTrader-Server'] },
  { name: 'Alpha Capital Group', servers: ['AlphaCapital-Server'] },
  { name: 'E8 Markets', servers: ['E8Markets-Server'] },
];

export const OTHER_BROKER = 'Other / not listed';
