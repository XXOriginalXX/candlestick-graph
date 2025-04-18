export interface StockData {
  timestamp: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

export interface YahooFinanceResponse {
  chart: {
    result: [{
      meta: {
        regularMarketPrice: number;
        symbol: string;
        regularMarketTime: number;
        previousClose?: number; // Added previousClose for P/L calculation
      };
      timestamp: number[];
      indicators: {
        quote: [{
          open: number[];
          high: number[];
          low: number[];
          close: number[];
          volume: number[];
        }];
      };
    }];
  };
}