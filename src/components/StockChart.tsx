import { useEffect, useRef, useState } from 'react';
import { createChart, ColorType, IChartApi, MouseEventParams, IPriceLine, SeriesType, LineStyle, LineWidth } from 'lightweight-charts';
import type { StockData } from '../types';

interface StockChartProps {
  data: StockData[];
  symbol: string;
}

const StockChart = ({ data, symbol }: StockChartProps) => {
  const chartContainerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const seriesRef = useRef<any>(null);
  const [indicator, setIndicator] = useState<string>('none');
  const indicatorLinesRef = useRef<IPriceLine[]>([]);

  useEffect(() => {
    if (!chartContainerRef.current) return;

    const handleResize = () => {
      if (chartRef.current && chartContainerRef.current) {
        chartRef.current.applyOptions({
          width: chartContainerRef.current.clientWidth,
          height: 500
        });
      }
    };

    chartRef.current = createChart(chartContainerRef.current, {
      layout: {
        background: { type: ColorType.Solid, color: '#ffffff' },
        textColor: '#333',
      },
      width: chartContainerRef.current.clientWidth,
      height: 500,
      grid: {
        vertLines: { color: '#f0f0f0' },
        horzLines: { color: '#f0f0f0' },
      },
      crosshair: {
        mode: 1, // Cross mode crosshair
      }
    });

    const candlestickSeries = chartRef.current.addCandlestickSeries({
      upColor: '#26a69a',
      downColor: '#ef5350',
      borderVisible: false,
      wickUpColor: '#26a69a',
      wickDownColor: '#ef5350',
    });
    
    seriesRef.current = candlestickSeries;

    candlestickSeries.setData(data.map(item => ({
      time: item.timestamp,
      open: item.open,
      high: item.high,
      low: item.low,
      close: item.close,
    })));

    window.addEventListener('resize', handleResize);

    return () => {
      window.removeEventListener('resize', handleResize);
      if (chartRef.current) {
        chartRef.current.remove();
      }
    };
  }, [data]);

  // Apply indicator when it changes
  useEffect(() => {
    if (!chartRef.current || !seriesRef.current || !data.length) return;
    
    // Clear previous indicator lines
    if (indicatorLinesRef.current.length > 0) {
      indicatorLinesRef.current.forEach(line => {
        try {
          if (line && typeof line.remove === 'function') {
            line.remove();
          }
        } catch (error) {
          console.error('Error removing line:', error);
        }
      });
      indicatorLinesRef.current = [];
    }
    
    // Add selected indicator
    if (indicator === 'none') return;
    
    // Use the stored series reference
    const series = seriesRef.current;
    if (!series) return;
    
    const addIndicator = () => {
      const newLines: IPriceLine[] = [];
      
      switch (indicator) {
        case 'sma20': {
          // Calculate 20-day Simple Moving Average
          const period = 20;
          if (data.length < period) return;
          
          const closes = data.map(d => d.close);
          const smaValues = [];
          
          for (let i = period - 1; i < closes.length; i++) {
            const sum = closes.slice(i - period + 1, i + 1).reduce((a, b) => a + b, 0);
            smaValues.push(sum / period);
          }
          
          const lastSMA = smaValues[smaValues.length - 1];
          try {
            const line = series.createPriceLine({
              price: lastSMA,
              color: '#2196F3',
              lineWidth: 2,
              lineStyle: 2, // Dashed
              title: 'SMA 20',
              axisLabelVisible: true,
            });
            newLines.push(line);
          } catch (error) {
            console.error('Error creating SMA20 line:', error);
          }
          break;
        }
        case 'sma50': {
          // Calculate 50-day Simple Moving Average
          const period = 50;
          if (data.length < period) return;
          
          const closes = data.map(d => d.close);
          const smaValues = [];
          
          for (let i = period - 1; i < closes.length; i++) {
            const sum = closes.slice(i - period + 1, i + 1).reduce((a, b) => a + b, 0);
            smaValues.push(sum / period);
          }
          
          const lastSMA = smaValues[smaValues.length - 1];
          try {
            const line = series.createPriceLine({
              price: lastSMA,
              color: '#9C27B0',
              lineWidth: 2,
              lineStyle: 2, // Dashed
              title: 'SMA 50',
              axisLabelVisible: true,
            });
            newLines.push(line);
          } catch (error) {
            console.error('Error creating SMA50 line:', error);
          }
          break;
        }
        case 'bollinger': {
          // Calculate Bollinger Bands (20-day SMA with 2 standard deviations)
          const period = 20;
          const stdDevMultiplier = 2;
          if (data.length < period) return;
          
          const closes = data.map(d => d.close);
          
          // Calculate SMA
          const sum = closes.slice(-period).reduce((a, b) => a + b, 0);
          const sma = sum / period;
          
          // Calculate Standard Deviation
          const squaredDiffs = closes.slice(-period).map(close => Math.pow(close - sma, 2));
          const variance = squaredDiffs.reduce((a, b) => a + b, 0) / period;
          const stdDev = Math.sqrt(variance);
          
          // Calculate Upper and Lower Bands
          const upperBand = sma + (stdDev * stdDevMultiplier);
          const lowerBand = sma - (stdDev * stdDevMultiplier);
          
          try {
            // Add Upper Band
            const upperLine = series.createPriceLine({
              price: upperBand,
              color: '#FF9800',
              lineWidth: 1,
              lineStyle: 2, // Dashed
              title: 'Upper BB',
              axisLabelVisible: true,
            });
            
            // Add SMA (Middle Band)
            const middleLine = series.createPriceLine({
              price: sma,
              color: '#2196F3',
              lineWidth: 1,
              lineStyle: 2, // Dashed
              title: 'Middle BB',
              axisLabelVisible: true,
            });
            
            // Add Lower Band
            const lowerLine = series.createPriceLine({
              price: lowerBand,
              color: '#FF9800',
              lineWidth: 1,
              lineStyle: 2, // Dashed
              title: 'Lower BB',
              axisLabelVisible: true,
            });
            
            newLines.push(upperLine, middleLine, lowerLine);
          } catch (error) {
            console.error('Error creating Bollinger lines:', error);
          }
          break;
        }
        case 'support': {
          // Simple support level - find the lowest price in recent data
          const recentData = data.slice(-30); // Last 30 data points
          if (recentData.length === 0) return;
          
          const lowestPoint = Math.min(...recentData.map(d => d.low));
          try {
            const line = series.createPriceLine({
              price: lowestPoint,
              color: '#4CAF50',
              lineWidth: 2,
              lineStyle: 0, // Solid
              title: 'Support',
              axisLabelVisible: true,
            });
            newLines.push(line);
          } catch (error) {
            console.error('Error creating support line:', error);
          }
          break;
        }
        case 'resistance': {
          // Simple resistance level - find the highest price in recent data
          const recentData = data.slice(-30); // Last 30 data points
          if (recentData.length === 0) return;
          
          const highestPoint = Math.max(...recentData.map(d => d.high));
          try {
            const line = series.createPriceLine({
              price: highestPoint,
              color: '#F44336',
              lineWidth: 2,
              lineStyle: 0, // Solid
              title: 'Resistance',
              axisLabelVisible: true,
            });
            newLines.push(line);
          } catch (error) {
            console.error('Error creating resistance line:', error);
          }
          break;
        }
        case 'trendline': {
          // Calculate a linear trendline using least squares method
          if (data.length < 2) return;
          
          const recentData = data.slice(-30); // Use last 30 data points for trendline calculation
          const coords = recentData.map((d, i) => ({
            x: i, // Use index as x-coordinate for simplicity
            y: d.close // Use closing price as y-coordinate
          }));
          
          // Calculate the slope and y-intercept of the trendline
          let sumX = 0, sumY = 0, sumXY = 0, sumX2 = 0;
          const n = coords.length;
          
          for (let i = 0; i < n; i++) {
            sumX += coords[i].x;
            sumY += coords[i].y;
            sumXY += coords[i].x * coords[i].y;
            sumX2 += coords[i].x * coords[i].x;
          }
          
          const slope = (n * sumXY - sumX * sumY) / (n * sumX2 - sumX * sumX);
          const yIntercept = (sumY - slope * sumX) / n;
          
          // Calculate start and end points for the trendline
          const startPrice = yIntercept;
          const endPrice = yIntercept + slope * (n - 1);
          
          try {
            // Add starting point of trendline
            const startLine = series.createPriceLine({
              price: startPrice,
              color: '#673AB7',
              lineWidth: 2,
              lineStyle: 0, // Solid
              title: 'Trend Start',
              axisLabelVisible: false,
            });
            
            // Add end point of trendline
            const endLine = series.createPriceLine({
              price: endPrice,
              color: '#673AB7',
              lineWidth: 2,
              lineStyle: 0, // Solid
              title: 'Trend End',
              axisLabelVisible: false,
            });
            
            // Add middle point with label
            const midPrice = (startPrice + endPrice) / 2;
            const midLine = series.createPriceLine({
              price: midPrice,
              color: '#673AB7',
              lineWidth: 2,
              lineStyle: 0, // Solid
              title: 'Trendline',
              axisLabelVisible: true,
            });
            
            newLines.push(startLine, endLine, midLine);
          } catch (error) {
            console.error('Error creating trendline:', error);
          }
          break;
        }
      }
      
      indicatorLinesRef.current = newLines;
    };
    
    addIndicator();
    
  }, [indicator, data]);

  const handleIndicatorChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    setIndicator(e.target.value);
  };

  return (
    <div className="w-full">
      <div className="flex justify-between items-center mb-4">
        <div className="text-xl font-semibold">{symbol} Stock Chart</div>
        <div className="flex items-center space-x-4">
          <div className="flex items-center">
            <label htmlFor="indicator" className="mr-2 text-sm text-emerald-700">Indicator:</label>
            <select
              id="indicator"
              value={indicator}
              onChange={handleIndicatorChange}
              className="px-3 py-1 border border-emerald-300 rounded text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
            >
              <option value="none">None</option>
              <option value="sma20">SMA (20)</option>
              <option value="sma50">SMA (50)</option>
              <option value="bollinger">Bollinger Bands</option>
              <option value="support">Support Level</option>
              <option value="resistance">Resistance Level</option>
              <option value="trendline">Trendline</option>
            </select>
          </div>
        </div>
      </div>
      
      <div 
        ref={chartContainerRef} 
        className="w-full"
      />
    </div>
  );
};

export default StockChart;