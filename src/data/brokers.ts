// Curated list of common MT5 brokers and their known server names.
// This is a static reference list (not a live API), since there is no public
// MetaApi "broker directory" endpoint — server names are broker-assigned and
// vary by region/account type. "Other / not listed" always falls back to
// manual entry so no broker is ever actually blocked.
export interface Broker {
  name: string;
  servers: string[];
}

export const BROKERS: Broker[] = [
  { name: 'Exness', servers: ['Exness-MT5Trial', 'Exness-MT5Trial16', 'Exness-MT5Real', 'Exness-MT5Real2', 'Exness-MT5Real3'] },
  { name: 'IC Markets', servers: ['ICMarketsSC-Live01', 'ICMarketsSC-Live02', 'ICMarketsSC-Demo'] },
  { name: 'Pepperstone', servers: ['Pepperstone-Live01', 'Pepperstone-Live02', 'Pepperstone-Demo'] },
  { name: 'FTMO', servers: ['FTMO-Server', 'FTMO-Server2', 'FTMO-Demo'] },
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
];

export const OTHER_BROKER = 'Other / not listed';
