// Starter broker/server list. Once the connect-mt5-list-servers edge function
// is deployed (pulling live from MetaApi's provisioning API), this static
// list should be replaced by a live fetch — this file is the fallback/seed.
export interface Broker {
  name: string
  servers: string[]
}

export const BROKERS: Broker[] = [
  {
    name: 'Exness Technologies Ltd',
    servers: [
      'Exness-MT5Trial16',
      'Exness-MT5Trial6',
      'Exness-MT5Real',
      'Exness-MT5Real2',
      'Exness-MT5Real3',
    ],
  },
  {
    name: 'IC Markets',
    servers: ['ICMarkets-Demo', 'ICMarkets-Live01', 'ICMarkets-Live02'],
  },
  {
    name: 'Pepperstone',
    servers: ['Pepperstone-Demo', 'Pepperstone-Live01', 'Pepperstone-Live02'],
  },
  {
    name: 'FTMO',
    servers: ['FTMO-Demo', 'FTMO-Server', 'FTMO-Server2'],
  },
  {
    name: 'XM Global',
    servers: ['XMGlobal-MT5', 'XMGlobal-MT5 2', 'XMGlobal-MT5 3'],
  },
]
