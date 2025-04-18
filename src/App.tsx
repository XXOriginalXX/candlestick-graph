import React, { useState, useEffect, useRef } from 'react';
import { Search, ChevronDown } from 'lucide-react';
import StockChart from './components/StockChart';
import FinanceChatbot from './components/FinanceChatbot';
import type { StockData, YahooFinanceResponse } from './types';

function App() {
  const [symbol, setSymbol] = useState('SENSEX.BS');  // Changed default to SENSEX
  const [stockData, setStockData] = useState<StockData[]>([]);
  const [currentPrice, setCurrentPrice] = useState<number | null>(null);
  const [previousClose, setPreviousClose] = useState<number | null>(null);
  const [inputSymbol, setInputSymbol] = useState('SENSEX');  // Changed default to SENSEX
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [suggestions, setSuggestions] = useState<any[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [timeRange, setTimeRange] = useState('1mo');
  const [silentRefresh, setSilentRefresh] = useState(false);
  const [showTimeDropdown, setShowTimeDropdown] = useState(false);
  const [isZooming, setIsZooming] = useState(false);
  const [refreshPaused, setRefreshPaused] = useState(false);
  const [fetchRetryCount, setFetchRetryCount] = useState(0);
  const lastFetchRef = useRef<number>(0);
  const timeDropdownRef = useRef<HTMLDivElement>(null);
  const chartContainerRef = useRef<HTMLDivElement>(null);
  const refreshTimerRef = useRef<NodeJS.Timeout | null>(null);
  const chartScrollPositionRef = useRef<number>(0);
  
  // For the chatbot - prepare both line and candle data
  const [lineChartData, setLineChartData] = useState<any[]>([]);
  const [candleChartData, setCandleChartData] = useState<any[]>([]);
  const [chartType, setChartType] = useState<'line' | 'candlestick'>('candlestick');
  
  const ranges = [
    { value: '1d', label: '1 Day' },
    { value: '5d', label: '5 Days' },
    { value: '1mo', label: '1 Month' },
    { value: '3mo', label: '3 Months' },
    { value: '6mo', label: '6 Months' },
    { value: '1y', label: '1 Year' },
    { value: '2y', label: '2 Years' },
    { value: '5y', label: '5 Years' },
  ];

  const intervals: Record<string, string> = {
    '1d': '5m',
    '5d': '15m',
    '1mo': '1d',
    '3mo': '1d',
    '6mo': '1d',
    '1y': '1wk',
    '2y': '1wk',
    '5y': '1mo',
  };

  // Common Indian stock symbols to show initially - Added SENSEX as first option
  const commonIndianStocks = [
    { symbol: 'SENSEX', name: 'S&P BSE SENSEX' },
    { symbol: 'NIFTY', name: 'NIFTY 50' },
    { symbol: 'RELIANCE', name: 'Reliance Industries Ltd' },
    { symbol: 'TCS', name: 'Tata Consultancy Services Ltd' },
    { symbol: 'HDFCBANK', name: 'HDFC Bank Ltd' },
    { symbol: 'INFY', name: 'Infosys Ltd' },
    { symbol: 'SBIN', name: 'State Bank of India' },
    { symbol: 'ICICIBANK', name: 'ICICI Bank Ltd' },
    { symbol: 'BHARTIARTL', name: 'Bharti Airtel Ltd' },
    { symbol: 'HINDUNILVR', name: 'Hindustan Unilever Ltd' },
    { symbol: 'ADANIPORTS', name: 'Adani Ports Ltd' },
    { symbol: 'TATAMOTORS', name: 'Tata Motors Ltd' }
  ];

  const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

  const fetchWithRetry = async (url: string, options: RequestInit, retries = 3, backoff = 1000) => {
    try {
      const response = await fetch(url, options);
      
      if (!response.ok) {
        if (response.status === 429 && retries > 0) {
          await sleep(backoff);
          return fetchWithRetry(url, options, retries - 1, backoff * 2);
        }
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      
      return response;
    } catch (error) {
      if (retries > 0) {
        await sleep(backoff);
        return fetchWithRetry(url, options, retries - 1, backoff * 2);
      }
      throw error;
    }
  };

  // Add an alternate proxy option when the primary fails
  const fetchWithAlternateProxies = async (yahooUrl: string, options: RequestInit) => {
    const proxies = [
      `https://api.allorigins.win/raw?url=${encodeURIComponent(yahooUrl)}`,
      `https://corsproxy.io/?${encodeURIComponent(yahooUrl)}`,
      `https://cors-anywhere.herokuapp.com/${yahooUrl}`
    ];
    
    let lastError;
    
    for (let i = 0; i < proxies.length; i++) {
      try {
        const response = await fetchWithRetry(proxies[i], options);
        return response;
      } catch (error) {
        console.error(`Proxy ${i+1} failed:`, error);
        lastError = error;
        continue;
      }
    }
    
    throw lastError || new Error('All proxies failed');
  };

  const fetchStockData = async (silent = false) => {
    // Don't fetch if user is zooming or refresh is paused
    if (isZooming || refreshPaused) {
      return;
    }
    
    // Don't fetch if we've fetched within the last second (prevents double fetches)
    const now = Date.now();
    if (now - lastFetchRef.current < 1000) {
      return;
    }
    lastFetchRef.current = now;
    
    // Save current scroll position
    if (chartContainerRef.current) {
      chartScrollPositionRef.current = window.scrollY;
    }
    
    try {
      if (!silent) {
        setError(null);
        setIsLoading(true);
      }
      
      let period1, period2;
      const now = Math.floor(Date.now() / 1000);
      
      // Calculate period based on time range
      switch (timeRange) {
        case '1d':
          period1 = now - 24 * 60 * 60;
          period2 = now;
          break;
        case '5d':
          period1 = now - 5 * 24 * 60 * 60;
          period2 = now;
          break;
        case '1mo':
          period1 = now - 30 * 24 * 60 * 60;
          period2 = now;
          break;
        case '3mo':
          period1 = now - 90 * 24 * 60 * 60;
          period2 = now;
          break;
        case '6mo':
          period1 = now - 180 * 24 * 60 * 60;
          period2 = now;
          break;
        case '1y':
          period1 = now - 365 * 24 * 60 * 60;
          period2 = now;
          break;
        case '2y':
          period1 = now - 2 * 365 * 24 * 60 * 60;
          period2 = now;
          break;
        case '5y':
          period1 = now - 5 * 365 * 24 * 60 * 60;
          period2 = now;
          break;
        default:
          period1 = now - 30 * 24 * 60 * 60;
          period2 = now;
      }
      
      const interval = intervals[timeRange] || '1d';
      
      // Handle special case for SENSEX (BSE)
      const actualSymbol = symbol === 'SENSEX.BS' ? '^BSESN' : symbol;
      
      const yahooUrl = `https://query2.finance.yahoo.com/v8/finance/chart/${actualSymbol}?period1=${period1}&period2=${period2}&interval=${interval}`;
      
      console.log('Fetching data from:', yahooUrl);
      
      const response = await fetchWithAlternateProxies(yahooUrl, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
        }
      });
      
      const data: YahooFinanceResponse = await response.json();

      if (!data.chart?.result?.[0]) {
        throw new Error('No data available for this symbol');
      }

      const result = data.chart.result[0];
      const quotes = result.indicators.quote[0];
      
      // Get previous close from meta data
      setPreviousClose(result.meta.previousClose || null);
      setCurrentPrice(result.meta.regularMarketPrice);
      
      const stockData: StockData[] = result.timestamp.map((timestamp, i) => ({
        timestamp,
        open: quotes.open[i],
        high: quotes.high[i],
        low: quotes.low[i],
        close: quotes.close[i],
        volume: quotes.volume[i],
      }));

      setStockData(stockData);
      
      // Prepare data for chatbot in the required format
      const formattedLineData = result.timestamp.map((timestamp, i) => {
        const date = new Date(timestamp * 1000).toLocaleDateString();
        return {
          date,
          price: quotes.close[i]
        };
      });
      
      const formattedCandleData = result.timestamp.map((timestamp, i) => {
        const date = new Date(timestamp * 1000).toLocaleDateString();
        return {
          date,
          open: quotes.open[i],
          high: quotes.high[i],
          low: quotes.low[i],
          close: quotes.close[i]
        };
      });
      
      setLineChartData(formattedLineData);
      setCandleChartData(formattedCandleData); // Fixed the function name here
      
      // Reset fetch retry count on success
      setFetchRetryCount(0);
      
      // Restore scroll position after successful fetch
      if (chartScrollPositionRef.current > 0) {
        setTimeout(() => {
          window.scrollTo(0, chartScrollPositionRef.current);
        }, 0);
      }
    } catch (error) {
      let errorMessage = 'Failed to fetch stock data';
      
      if (error instanceof Error) {
        if (error.message.includes('429')) {
          errorMessage = 'Rate limit exceeded. Please try again in a few minutes.';
        } else if (error.message.includes('No data available')) {
          errorMessage = `No data available for symbol: ${symbol}`;
        } else {
          errorMessage = `Error: ${error.message}`;
        }
      }
      
      console.error('Error fetching stock data:', error);
      
      // If we've tried a few times, show the error
      if (fetchRetryCount >= 3 && !silent) {
        setError(errorMessage);
      } else if (!silent) {
        // Otherwise, increment the count and retry
        setFetchRetryCount(prev => prev + 1);
      }
      
      // Keep existing data if there's an error during silent refresh
      if (!silent) {
        setStockData([]);
        setCurrentPrice(null);
        setPreviousClose(null);
      }
    } finally {
      if (!silent) {
        setIsLoading(false);
      }
    }
  };

  // Enhanced search with debounce and caching
  const recentSearches = useRef<Map<string, any[]>>(new Map());
  const searchTimeout = useRef<NodeJS.Timeout | null>(null);

  const searchSymbol = async (query: string) => {
    // If empty query, show common stocks instead of nothing
    if (!query.trim()) {
      setSuggestions(commonIndianStocks);
      return;
    }

    // If query is just one character, still show some filtered results
    if (query.length === 1) {
      const filteredCommonStocks = commonIndianStocks.filter(stock => 
        stock.symbol.toLowerCase().startsWith(query.toLowerCase()) || 
        stock.name.toLowerCase().includes(query.toLowerCase())
      );
      setSuggestions(filteredCommonStocks.length > 0 ? filteredCommonStocks : commonIndianStocks);
      return;
    }

    // Check cache first
    const lowerQuery = query.toLowerCase();
    if (recentSearches.current.has(lowerQuery)) {
      console.log('Using cached search results');
      setSuggestions(recentSearches.current.get(lowerQuery) || commonIndianStocks);
      return;
    }

    try {
      // Using the Yahoo Finance search API with better parameters for more responsive search
      const yahooUrl = `https://query2.finance.yahoo.com/v1/finance/search?q=${query}&quotesCount=15&newsCount=0&enableFuzzyQuery=true&region=IN`;
      
      const response = await fetchWithAlternateProxies(yahooUrl, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
        }
      });
      
      const data = await response.json();
      
      if (data?.quotes) {
        // Filter for Indian stocks and ensure they are relevant
        const indianStocks = data.quotes
          .filter((quote: any) => {
            // Keep NSE stocks or any stock that has India in the exchange name
            return (quote.quoteType === 'EQUITY' && 
                   (quote.exchange === 'NSI' || 
                    quote.symbol.endsWith('.NS') || 
                    (quote.exchange && quote.exchange.includes('India'))));
          })
          .map((quote: any) => ({
            symbol: quote.symbol.replace('.NS', ''),
            name: quote.shortname || quote.longname || quote.symbol
          }));
        
        const results = indianStocks.length > 0 ? indianStocks : commonIndianStocks;
        setSuggestions(results);
        
        // Cache the result
        recentSearches.current.set(lowerQuery, results);
        
        // Limit cache size to prevent memory issues
        if (recentSearches.current.size > 50) {
          const firstKey = recentSearches.current.keys().next().value;
          recentSearches.current.delete(firstKey);
        }
      }
    } catch (error) {
      console.error('Error fetching suggestions:', error);
      // Fallback to filtered common stocks if search fails
      const filteredCommonStocks = commonIndianStocks.filter(stock => 
        stock.symbol.toLowerCase().includes(lowerQuery) || 
        stock.name.toLowerCase().includes(lowerQuery)
      );
      setSuggestions(filteredCommonStocks.length > 0 ? filteredCommonStocks : commonIndianStocks);
    }
  };

  // Detect zoom/pan interactions with the chart
  useEffect(() => {
    const handleMouseDown = () => {
      setIsZooming(true);
      setRefreshPaused(true);
    };

    const handleMouseUp = () => {
      setIsZooming(false);
      // Resume refreshes after 5 seconds of no interaction
      setTimeout(() => {
        setRefreshPaused(false);
      }, 5000);
    };

    const handleWheel = () => {
      setIsZooming(true);
      setRefreshPaused(true);
      
      // Mark scroll position
      chartScrollPositionRef.current = window.scrollY;
      
      // Resume refreshes after 5 seconds of no wheel events
      if (refreshTimerRef.current) {
        clearTimeout(refreshTimerRef.current);
      }
      
      refreshTimerRef.current = setTimeout(() => {
        setIsZooming(false);
        setRefreshPaused(false);
      }, 5000);
    };

    // Save and restore scroll position on refresh
    const handleScroll = () => {
      if (!isZooming && !refreshPaused) {
        chartScrollPositionRef.current = window.scrollY;
      }
    };

    const chartContainer = chartContainerRef.current;
    if (chartContainer) {
      chartContainer.addEventListener('mousedown', handleMouseDown);
      chartContainer.addEventListener('wheel', handleWheel, { passive: true });
      document.addEventListener('mouseup', handleMouseUp);
      window.addEventListener('scroll', handleScroll);
    }

    return () => {
      if (chartContainer) {
        chartContainer.removeEventListener('mousedown', handleMouseDown);
        chartContainer.removeEventListener('wheel', handleWheel);
      }
      document.removeEventListener('mouseup', handleMouseUp);
      window.removeEventListener('scroll', handleScroll);
      
      if (refreshTimerRef.current) {
        clearTimeout(refreshTimerRef.current);
      }
    };
  }, [isZooming, refreshPaused]);

  // Initial population of suggestions with common stocks
  useEffect(() => {
    setSuggestions(commonIndianStocks);
  }, []);

  // Handle clicks outside the time dropdown
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (timeDropdownRef.current && !timeDropdownRef.current.contains(event.target as Node)) {
        setShowTimeDropdown(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  // Improved search with debounce - reduced to 150ms for faster response
  useEffect(() => {
    if (searchTimeout.current) {
      clearTimeout(searchTimeout.current);
    }
    
    searchTimeout.current = setTimeout(() => {
      searchSymbol(inputSymbol);
    }, 150); // Shorter delay for better responsiveness

    return () => {
      if (searchTimeout.current) {
        clearTimeout(searchTimeout.current);
      }
    };
  }, [inputSymbol]);

  // Initial fetch and setup interval for every 2 seconds - FIXED: increased interval time to reduce blinking
  useEffect(() => {
    fetchStockData();
    setSilentRefresh(true);
    
    const interval = setInterval(() => {
      if (!isZooming && !refreshPaused) {
        fetchStockData(true); // Use silent refresh
      }
    }, 5000); // Changed from 2000ms to 5000ms to reduce blinking
    
    return () => clearInterval(interval);
  }, [symbol, timeRange]);

  // Restore scroll position after component updates
  useEffect(() => {
    if (chartScrollPositionRef.current > 0 && !isZooming) {
      const scrollPosition = chartScrollPositionRef.current;
      setTimeout(() => {
        window.scrollTo(0, scrollPosition);
      }, 10);
    }
  }, [stockData]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    // Special case for SENSEX
    let newSymbol;
    if (inputSymbol.toUpperCase() === 'SENSEX') {
      newSymbol = 'SENSEX.BS';
    } else {
      newSymbol = inputSymbol.toUpperCase().endsWith('.NS') ? 
        inputSymbol.toUpperCase() : 
        inputSymbol.toUpperCase() + '.NS';
    }
    
    if (newSymbol !== symbol) {
      setSymbol(newSymbol);
      setSilentRefresh(false);
    }
    
    setShowSuggestions(false);
  };

  const handleSuggestionClick = (stockSymbol: string) => {
    setInputSymbol(stockSymbol);
    
    // Special case for SENSEX
    let newSymbol;
    if (stockSymbol.toUpperCase() === 'SENSEX') {
      newSymbol = 'SENSEX.BS';
    } else {
      newSymbol = stockSymbol.toUpperCase().endsWith('.NS') ? 
        stockSymbol.toUpperCase() : 
        stockSymbol.toUpperCase() + '.NS';
    }
    
    if (newSymbol !== symbol) {
      setSymbol(newSymbol);
      setSilentRefresh(false);
    }
    
    setShowSuggestions(false);
  };

  const handleTimeRangeChange = (range: string) => {
    setTimeRange(range);
    setShowTimeDropdown(false);
  };

  // Calculate profit/loss
  const calculateProfitLoss = () => {
    if (currentPrice && previousClose) {
      const change = currentPrice - previousClose;
      const percentChange = (change / previousClose) * 100;
      return {
        change,
        percentChange,
        isPositive: change >= 0
      };
    }
    return null;
  };

  const profitLoss = calculateProfitLoss();

  // Find the current selected time range label
  const currentTimeRangeLabel = ranges.find(r => r.value === timeRange)?.label || '1 Month';

  // Get the proper stock display name
  const displaySymbol = symbol.replace('.NS', '').replace('.BS', '');

  return (
    <div className="min-h-screen bg-emerald-50">
      <div className="max-w-7xl mx-auto px-4 py-8">
        <div className="bg-white rounded-lg shadow-lg p-6 border border-emerald-100">
          <div className="mb-6">
            <h1 className="text-2xl font-bold text-emerald-800 mb-4">Indian Stock Market Tracker</h1>
            <form onSubmit={handleSubmit} className="flex gap-2">
              <div className="relative flex-1">
                <input
                  type="text"
                  value={inputSymbol}
                  onChange={(e) => {
                    setInputSymbol(e.target.value);
                    setShowSuggestions(true);
                  }}
                  onFocus={() => setShowSuggestions(true)}
                  placeholder="Search any Indian stock..."
                  className="w-full px-4 py-2 border border-emerald-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
                />
                <Search className="absolute right-3 top-2.5 text-emerald-500" size={20} />
                
                {showSuggestions && suggestions.length > 0 && (
                  <div className="absolute z-20 w-full mt-1 bg-white border border-emerald-200 rounded-md shadow-lg max-h-60 overflow-y-auto">
                    {suggestions.map((stock: any) => (
                      <div
                        key={stock.symbol}
                        className="px-4 py-2 cursor-pointer hover:bg-emerald-50"
                        onClick={() => handleSuggestionClick(stock.symbol)}
                      >
                        <div className="font-medium text-emerald-800">{stock.symbol}</div>
                        <div className="text-sm text-emerald-600">{stock.name}</div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
              <button
                type="submit"
                className="px-6 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 transition-colors"
                disabled={isLoading}
              >
                {isLoading ? 'Loading...' : 'Search'}
              </button>
            </form>
          </div>
          
          <div className="mb-6">
            <div className="relative inline-block text-left" ref={timeDropdownRef}>
              <div>
                <button 
                  type="button" 
                  className="inline-flex justify-between items-center w-40 rounded-md border border-emerald-300 shadow-sm px-4 py-2 bg-white text-sm font-medium text-emerald-700 hover:bg-emerald-50 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  onClick={() => setShowTimeDropdown(!showTimeDropdown)}
                >
                  {currentTimeRangeLabel}
                  <ChevronDown className="ml-2 h-4 w-4" />
                </button>
              </div>

              {showTimeDropdown && (
                <div className="origin-top-left absolute left-0 mt-2 w-40 rounded-md shadow-lg bg-white ring-1 ring-black ring-opacity-5 z-10">
                  <div className="py-1">
                    {ranges.map((range) => (
                      <button
                        key={range.value}
                        onClick={() => handleTimeRangeChange(range.value)}
                        className={`block w-full text-left px-4 py-2 text-sm ${
                          timeRange === range.value
                            ? 'bg-emerald-100 text-emerald-900'
                            : 'text-emerald-700 hover:bg-emerald-50'
                        }`}
                      >
                        {range.label}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
            
            {isZooming && (
              <span className="ml-4 text-sm text-orange-500">
                Automatic updates paused while zooming
              </span>
            )}
          </div>

          {error && (
            <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg text-red-700">
              {error}
              <button 
                onClick={() => {
                  setError(null);
                  setFetchRetryCount(0);
                  fetchStockData();
                }}
                className="ml-4 underline hover:text-red-800"
              >
                Retry
              </button>
            </div>
          )}

          {isLoading && !silentRefresh && (
            <div className="mb-6 p-4 bg-emerald-50 border border-emerald-200 rounded-lg text-emerald-700">
              Loading stock data...
            </div>
          )}

          {currentPrice && !isLoading && (
            <div className="mb-6 p-4 bg-white border border-emerald-200 rounded-lg shadow-sm">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <div className="text-2xl font-bold text-emerald-800">
                    ₹{currentPrice.toFixed(2)}
                  </div>
                  <div className="text-sm text-emerald-600">
                    Last updated: {new Date().toLocaleTimeString()}
                  </div>
                </div>
                
                {profitLoss && (
                  <div className={`flex flex-col items-end ${profitLoss.isPositive ? 'text-green-600' : 'text-red-600'}`}>
                    <div className="text-xl font-semibold">
                      {profitLoss.isPositive ? '+' : ''}
                      ₹{profitLoss.change.toFixed(2)} 
                    </div>
                    <div className="text-lg">
                      ({profitLoss.isPositive ? '+' : ''}
                      {profitLoss.percentChange.toFixed(2)}%)
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {stockData.length > 0 && (
            <div className="border border-emerald-200 rounded-lg p-4 bg-white" ref={chartContainerRef}>
              <StockChart data={stockData} symbol={symbol.replace('.BS', '')} />
            </div>
          )}
        </div>
      </div>
      
      {/* Integrated Finance Chatbot - Fixed so it doesn't blink */}
      <FinanceChatbot
        stockData={lineChartData}
        candleData={candleChartData}
        selectedStock={displaySymbol}
        timeframe={currentTimeRangeLabel}
        chartType={chartType}
      />
    </div>
  );
}

export default App;