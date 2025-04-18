
import React, { useState, useRef, useEffect } from 'react';
import { MessageSquare, Send, TrendingUp, Camera, X, AlertTriangle, Info } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import axios from 'axios';

// Define the props interface for the component
interface FinanceChatbotProps {
  stockData: any[];
  candleData: any[];
  selectedStock: string;
  timeframe: string;
  chartType: 'line' | 'candlestick';
}

const FinanceChatbot: React.FC<FinanceChatbotProps> = ({ 
  stockData, 
  candleData, 
  selectedStock, 
  timeframe, 
  chartType 
}) => {
  // State management
  const [isOpen, setIsOpen] = useState(false);
  const [input, setInput] = useState('');
  const [messages, setMessages] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [capturing, setCapturing] = useState(false);
  const [apiKey, setApiKey] = useState("AIzaSyDYraZrXVcJMxs2_83m4ueFrvl9cL_QI0s"); // Pre-set API key
  const [fundamentalData, setFundamentalData] = useState<any>(null);
  const messagesEndRef = useRef(null);
  const screenshotImageRef = useRef<string | null>(null);
  
  // Updated API Configuration for Gemini 2.0
  const GEMINI_MODEL = "gemini-2.0-flash"; // Using the flash model for faster responses
  const GEMINI_API_URL = `https://generativelanguage.googleapis.com/v1/models/${GEMINI_MODEL}:generateContent`;
  
  // Auto-scroll to bottom of messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Initial welcome message
  useEffect(() => {
    setMessages([
      { 
        type: 'bot', 
        content: "Hello! I'm your Indian Stock Market Assistant powered by vector research. How can I help you today?",
        isInfo: false
      },
      {
        type: 'bot',
        content: "I can analyze the current stock chart and provide information on whether you should buy or sell, at what price, and any patterns I detect.",
        isDisclaimer: true
      },
      {
        type: 'bot',
        content: "Simply ask me to 'analyze this chart' or 'should I buy or sell?'",
        isInfo: true
      }
    ]);
  }, []);
  
  // Update messages when stock changes to notify the user
  useEffect(() => {
    if (messages.length > 3) { // Only do this after initial messages
      setMessages(prev => [...prev, { 
        type: 'bot', 
        content: `Stock changed to ${selectedStock}. Ask me to analyze this chart for updated information.`,
        isInfo: true
      }]);
    }
    // When stock changes, fetch fundamental data
    fetchFundamentalData(selectedStock);
  }, [selectedStock]);

  // Function to fetch fundamental data
  const fetchFundamentalData = async (stockSymbol: string) => {
    // Skip fetching for indices like SENSEX and NIFTY
    if (stockSymbol === 'SENSEX' || stockSymbol === 'NIFTY') {
      setFundamentalData(null);
      return;
    }
    
    try {
      // In a real implementation, you would call an actual API here
      // For now, we'll simulate the data fetch with some realistic values
      const mockData = getMockFundamentalData(stockSymbol);
      setFundamentalData(mockData);
    } catch (error) {
      console.error("Error fetching fundamental data:", error);
      setFundamentalData(null);
    }
  };

  // Mock fundamental data based on stock symbol
  const getMockFundamentalData = (stockSymbol: string) => {
    // Define some realistic ranges for different sectors
    const sectors: Record<string, any> = {
      'RELIANCE': {
        sector: 'Energy/Telecom',
        pe: { min: 18, max: 25 },
        pb: { min: 1.8, max: 2.5 },
        debt: { min: 250000, max: 300000 }, // in crores
        profit: { min: 14000, max: 18000 } // in crores
      },
      'TCS': {
        sector: 'IT',
        pe: { min: 25, max: 35 },
        pb: { min: 8, max: 12 },
        debt: { min: 0, max: 100 }, // in crores
        profit: { min: 9000, max: 12000 } // in crores
      },
      'HDFCBANK': {
        sector: 'Banking',
        pe: { min: 18, max: 25 },
        pb: { min: 3, max: 4.5 },
        debt: { min: 0, max: 0 }, // Not applicable for banks
        profit: { min: 10000, max: 13000 } // in crores
      },
      'DEFAULT': {
        sector: 'Mixed',
        pe: { min: 15, max: 30 },
        pb: { min: 1.5, max: 4 },
        debt: { min: 1000, max: 50000 }, // in crores
        profit: { min: 500, max: 5000 } // in crores
      }
    };
    
    // Get appropriate range based on stock symbol or use default
    const range = sectors[stockSymbol] || sectors['DEFAULT'];
    
    // Generate random values within realistic ranges
    const randomInRange = (min: number, max: number) => {
      return Math.round((Math.random() * (max - min) + min) * 100) / 100;
    };
    
    return {
      sector: range.sector,
      pe: randomInRange(range.pe.min, range.pe.max),
      pb: randomInRange(range.pb.min, range.pb.max),
      debtToEquity: randomInRange(0.2, 1.5),
      totalDebt: Math.round(randomInRange(range.debt.min, range.debt.max)),
      lastQuarterProfit: Math.round(randomInRange(range.profit.min, range.profit.max)),
      yearOnYearGrowth: randomInRange(-15, 25)
    };
  };

  // Function to handle API errors consistently
  const handleApiError = (error: any) => {
    console.error("API Error:", error);
    
    if (error.response) {
      const status = error.response.status;
      if (status === 403) {
        return "API access denied. Your API key may be invalid or has reached its quota limit. Try updating your API key with '/apikey YOUR_NEW_KEY'";
      } else if (status === 429) {
        return "Too many requests to the API. Please wait a moment before trying again.";
      } else if (status === 404 || status === 400) {
        return "API endpoint not found or bad request. The Gemini API services may have changed. Check if you're using the correct endpoints.";
      }
    } else if (error.message && error.message.includes('Network Error')) {
      return "Network connection error. Please check your internet connection.";
    }
    
    return `Error: ${error.message || "Unknown error"}. Please try again or update your API key with '/apikey YOUR_NEW_KEY'`;
  };

  // Convert current chart data to text for analysis
  const getCurrentChartDataAsText = () => {
    if (!stockData || stockData.length === 0) {
      return "No chart data available for analysis.";
    }
    
    const data = chartType === 'line' ? stockData : candleData;
    const firstPrice = data[0]?.price || data[0]?.close || 0;
    const lastPrice = data[data.length - 1]?.price || data[data.length - 1]?.close || 0;
    const change = lastPrice - firstPrice;
    const percentChange = ((change / firstPrice) * 100).toFixed(2);
    const isPositive = change >= 0;
    
    let points = [];
    // Take at most 20 data points for analysis to avoid overloading
    const step = Math.max(1, Math.floor(data.length / 20));
    for (let i = 0; i < data.length; i += step) {
      if (points.length >= 20) break;
      
      const item = data[i];
      if (chartType === 'line') {
        points.push(`${item.date}: ${item.price}`);
      } else {
        points.push(`${item.date}: Open=${item.open}, Close=${item.close}, High=${item.high}, Low=${item.low}`);
      }
    }
    
    // Add fundamental data if available
    let fundamentalText = '';
    if (fundamentalData && selectedStock !== 'SENSEX' && selectedStock !== 'NIFTY') {
      fundamentalText = `
Fundamental Analysis:
Sector: ${fundamentalData.sector}
PE Ratio: ${fundamentalData.pe}
PB Ratio: ${fundamentalData.pb}
Last Quarter Profit: ₹${fundamentalData.lastQuarterProfit} Cr
Total Debt: ₹${fundamentalData.totalDebt} Cr
Debt-to-Equity: ${fundamentalData.debtToEquity}
Year-on-Year Growth: ${fundamentalData.yearOnYearGrowth}%
`;
    }
    
    return `
Current Stock: ${selectedStock.replace('.NS', '')}
Timeframe: ${timeframe}
Chart Type: ${chartType}
Current Price: ${lastPrice}
Change: ${change > 0 ? '+' : ''}${change.toFixed(2)} (${isPositive ? '+' : ''}${percentChange}%)
Trend Direction: ${isPositive ? 'Upward' : 'Downward'}
${fundamentalText}
Sample Data Points:
${points.join('\n')}
`;
  };

  // Function to analyze current stock chart
  const analyzeCurrentChart = async () => {
    setLoading(true);
    
    try {
      const chartData = getCurrentChartDataAsText();
      
      const requestData = {
        contents: [
          {
            parts: [
              { 
                text: `You are a professional Indian stock market analyst. Analyze the following stock data and provide a clear, concise analysis with the following format:

1. BUY/SELL RECOMMENDATION: Start with a clear "BUY" or "SELL" recommendation. This is the most important part.
2. PRICE TARGET: For a BUY, provide an entry price range. For a SELL, provide an exit target.
3. KEY LEVELS: Identify specific support and resistance price levels.
4. PATTERNS: Identify any notable chart patterns (e.g., head and shoulders, double top, trend lines).
5. FUNDAMENTAL ANALYSIS: Comment on PE ratio, PB ratio, debt, and last quarter profit if available.
6. RATIONALE: Very briefly explain your recommendation based on both technical and fundamental analysis.

IMPORTANT FORMATTING INSTRUCTIONS:
- Do NOT use asterisks, markdown, or any special formatting
- Keep your analysis concise (2-3 sentences per section)
- Always start with a clear BUY or SELL recommendation
- Focus on the data provided, including fundamental metrics when available
- If you don't have enough information for a section, SKIP IT completely - don't include placeholders
- Use plain language a retail investor would understand

Data to analyze:
${chartData}`
              }
            ]
          }
        ],
        generationConfig: {
          maxOutputTokens: 450,
          temperature: 0.2
        }
      };
      
      const response = await axios.post(
        `${GEMINI_API_URL}?key=${apiKey}`,
        requestData,
        { headers: { 'Content-Type': 'application/json' } }
      );
      
      if (!response.data || !response.data.candidates || response.data.candidates.length === 0) {
        throw new Error("Empty response from API");
      }
      
      const candidate = response.data.candidates[0];
      if (!candidate.content || !candidate.content.parts || candidate.content.parts.length === 0) {
        throw new Error("Invalid response format from API");
      }
      
      const responseText = candidate.content.parts[0].text;
      
      // Process the response to create a clean, structured analysis
      const cleanText = responseText.replace(/\*/g, ''); // Remove all asterisks
      
      // Extract the main sections
      const extractSection = (sectionTitle: string) => {
        // Create regex patterns to match different possible section formats
        const patterns = [
          new RegExp(`${sectionTitle}:\\s*(.*?)(?=\\n\\d+\\.|\\n[A-Z_]+:|$)`, 'is'),
          new RegExp(`\\d+\\.\\s*${sectionTitle}:\\s*(.*?)(?=\\n\\d+\\.|\\n[A-Z_]+:|$)`, 'is'),
          new RegExp(`\\d+\\.\\s*${sectionTitle}\\s*(.*?)(?=\\n\\d+\\.|\\n[A-Z_]+:|$)`, 'is'),
        ];
        
        // Try each pattern
        for (const pattern of patterns) {
          const match = cleanText.match(pattern);
          if (match && match[1]) {
            return match[1].trim();
          }
        }
        
        return null; // Return null if no match is found
      };
      
      // Extract the key sections
      const recommendation = extractSection('BUY/SELL RECOMMENDATION') || 
                            extractSection('RECOMMENDATION') || 
                            extractSection('BUY') || 
                            extractSection('SELL');
      
      const priceTarget = extractSection('PRICE TARGET') || 
                         extractSection('TARGET') || 
                         extractSection('PRICE');
      
      const keyLevels = extractSection('KEY LEVELS') || 
                       extractSection('LEVELS');
      
      const patterns = extractSection('PATTERNS') || 
                      extractSection('PATTERN');
      
      // New fundamental analysis section
      const fundamentalAnalysis = extractSection('FUNDAMENTAL ANALYSIS') ||
                                 extractSection('FUNDAMENTALS');
      
      const rationale = extractSection('RATIONALE') || 
                       extractSection('REASON') || 
                       extractSection('ANALYSIS');
      
      // If we didn't get a recommendation, try to determine one from the text
      let finalRecommendation = recommendation;
      if (!finalRecommendation) {
        if (cleanText.toLowerCase().includes('buy')) {
          finalRecommendation = "BUY";
        } else if (cleanText.toLowerCase().includes('sell')) {
          finalRecommendation = "SELL";
        } else {
          finalRecommendation = "HOLD/NEUTRAL";
        }
      }
      
      // Create the analysis object with only the sections that have content
      const analysisResult: Record<string, string> = {
        disclaimer: "This analysis is for educational purposes only and not financial advice. Past patterns don't guarantee future results."
      };
      
      if (finalRecommendation) analysisResult.recommendation = finalRecommendation;
      if (priceTarget) analysisResult.priceTarget = priceTarget;
      if (keyLevels) analysisResult.keyLevels = keyLevels;
      if (patterns) analysisResult.patterns = patterns;
      if (fundamentalAnalysis) analysisResult.fundamentalAnalysis = fundamentalAnalysis;
      if (rationale) analysisResult.rationale = rationale;
      
      // Add the full response as a fallback if we couldn't parse it properly
      if (!recommendation && !priceTarget && !keyLevels && !patterns && !fundamentalAnalysis && !rationale) {
        analysisResult.fullResponse = cleanText;
      }
      
      // Send analysis to the user
      setMessages(prev => [...prev, { 
        type: 'bot', 
        content: analysisResult,
        hasScreenshot: false
      }]);
      
    } catch (error) {
      console.error("Analysis API error:", error);
      setMessages(prev => [...prev, { 
        type: 'bot', 
        content: handleApiError(error),
        isError: true
      }]);
    } finally {
      setLoading(false);
    }
  };

  // Improved screen capture function
  const captureScreen = async () => {
    setCapturing(true);
    setMessages(prev => [...prev, { 
      type: 'bot', 
      content: "Please select the screen with your chart to analyze. I'll provide insights about buy/sell decisions and patterns.",
      isPrompt: true
    }]);
    
    try {
      // Request screen capture permission with corrected constraints
      const stream = await navigator.mediaDevices.getDisplayMedia({ 
        video: true,
        audio: false
      });
      
      // Create video element to display the screen capture
      const video = document.createElement("video");
      video.srcObject = stream;
      
      // Wait for video metadata to load with proper type handling
      await new Promise<void>((resolve) => {
        video.onloadedmetadata = () => {
          video.play();
          resolve();
        };
      });
      
      // Create canvas to capture frame
      const canvas = document.createElement("canvas");
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      const ctx = canvas.getContext("2d");
      ctx?.drawImage(video, 0, 0, canvas.width, canvas.height);
      
      // Get the image data
      const imageUrl = canvas.toDataURL("image/jpeg", 0.8);
      
      // Stop all tracks
      stream.getTracks().forEach(track => track.stop());
      
      // Store reference to image (for display)
      screenshotImageRef.current = imageUrl;
      
      // Add capture confirmation message
      setMessages(prev => [...prev, { 
        type: 'bot', 
        content: "I've captured your screen. Instead, let me analyze the current chart data directly for more accurate results.",
        isInfo: true
      }]);
      
      // Process the current chart data instead of the image
      analyzeCurrentChart();
      
    } catch (captureError: any) {
      console.error("Screen capture error:", captureError);
      setMessages(prev => [...prev, { 
        type: 'bot', 
        content: captureError.message || "Screen capture was canceled or failed. Let me analyze the current chart data instead.",
        isInfo: true
      }]);
      
      // Fall back to analyzing current chart data
      analyzeCurrentChart();
    } finally {
      setCapturing(false);
    }
  };

  // Updated test connection function to use the correct endpoint
  const testConnection = async () => {
    try {
      const response = await axios.post(
        `${GEMINI_API_URL}?key=${apiKey}`,
        {
          contents: [{
            parts: [{
              text: "Respond with 'API Connection Successful' if you receive this message."
            }]
          }],
          generationConfig: {
            maxOutputTokens: 20
          }
        },
        { headers: { 'Content-Type': 'application/json' } }
      );
      
      return response.data && response.data.candidates && response.data.candidates.length > 0;
    } catch (error) {
      console.error("API test error:", error);
      return false;
    }
  };

  // Handle form submission
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || loading || capturing) return;

    // Add user message
    const userMessage = { type: 'user', content: input };
    setMessages(prev => [...prev, userMessage]);
    
    const userInput = input.trim();
    setInput('');
    
    // Handle API key update command
    if (userInput.toLowerCase().startsWith("/apikey ")) {
      const newApiKey = userInput.substring(8).trim();
      if (newApiKey) {
        setApiKey(newApiKey);
        localStorage.setItem('geminiApiKey', newApiKey);
        setMessages(prev => [...prev, { 
          type: 'bot', 
          content: "API key updated successfully!",
          isInfo: true
        }]);
      } else {
        setMessages(prev => [...prev, { 
          type: 'bot', 
          content: "Please provide a valid API key after the /apikey command.",
          isError: true
        }]);
      }
      return;
    }
    
    // Check if the message is asking for chart analysis
    const analysisKeywords = [
      "analyze", "analyse", "chart", "graph", "buy", "sell", 
      "should i buy", "should i sell", "pattern", "recommend",
      "what do you think", "what's your opinion"
    ];
    
    const isAnalysisRequest = analysisKeywords.some(
      keyword => userInput.toLowerCase().includes(keyword)
    );
    
    if (isAnalysisRequest || userInput.toLowerCase() === "analyze this chart") {
      // Instead of screen capture, directly analyze current chart data
      analyzeCurrentChart();
      return;
    }
    
    // Handle screen capture request
    const screenAnalysisKeywords = [
      "screen", "capture", "screenshot", "look at my screen", 
      "what do you see", "what's on my screen"
    ];
    
    const isScreenCaptureRequest = screenAnalysisKeywords.some(
      keyword => userInput.toLowerCase().includes(keyword)
    );
    
    if (isScreenCaptureRequest) {
      captureScreen();
      return;
    }
    
    // Handle help command
    if (userInput.toLowerCase() === 'help' || userInput.toLowerCase() === '/help') {
      setMessages(prev => [...prev, { 
        type: 'bot', 
        content: `Here are some commands you can use:
        
1. Ask for chart analysis: "Analyze this chart" or "Should I buy or sell?"
2. Get specific pattern detection: "What patterns do you see?"
3. Ask about support/resistance: "What are the support and resistance levels?"
4. Ask about fundamentals: "What are the fundamentals of this stock?"
5. Update API key: "/apikey YOUR_NEW_API_KEY"
6. Get help: "/help" or "help"
7. Test connection: "/test" or "test connection"

I'll provide information specifically about the stock chart you're currently viewing.`,
        isInfo: true
      }]);
      return;
    }
    
    // Handle fundamentals request
    const fundamentalKeywords = [
      "fundamental", "pe ratio", "pb ratio", "debt", "profit", "financial", 
      "balance sheet", "quarterly"
    ];
    
    const isFundamentalRequest = fundamentalKeywords.some(
      keyword => userInput.toLowerCase().includes(keyword)
    );
    
    if (isFundamentalRequest) {
      if (fundamentalData && selectedStock !== 'SENSEX' && selectedStock !== 'NIFTY') {
        setMessages(prev => [...prev, { 
          type: 'bot', 
          content: {
            fundamentalAnalysis: `PE Ratio: ${fundamentalData.pe}, PB Ratio: ${fundamentalData.pb}, Last Quarter Profit: ₹${fundamentalData.lastQuarterProfit} Cr, Total Debt: ₹${fundamentalData.totalDebt} Cr, Debt-to-Equity: ${fundamentalData.debtToEquity}, Year-on-Year Growth: ${fundamentalData.yearOnYearGrowth}%`,
            sector: `Sector: ${fundamentalData.sector}`,
            disclaimer: "Fundamental data is for educational purposes only and may not reflect the most current values."
          }
        }]);
      } else {
        setMessages(prev => [...prev, { 
          type: 'bot', 
          content: "Fundamental data is not available for this stock or index.",
          isInfo: true
        }]);
      }
      return;
    }
    
    // Handle system test command
    if (userInput.toLowerCase() === '/test' || userInput.toLowerCase() === 'test connection') {
      setLoading(true);
      try {
        const isConnected = await testConnection();
        if (isConnected) {
          setMessages(prev => [...prev, { 
            type: 'bot', 
            content: "API Connection Successful!",
            isInfo: true
          }]);
        } else {
          setMessages(prev => [...prev, { 
            type: 'bot', 
            content: "API Connection Failed. Please check your API key and try again.",
            isError: true
          }]);
        }
      } catch (error) {
        console.error("API test error:", error);
        setMessages(prev => [...prev, { 
          type: 'bot', 
          content: handleApiError(error),
          isError: true
        }]);
      } finally {
        setLoading(false);
      }
      return;
    }
    
    // For any other queries, analyze the current chart
    setLoading(true);
    
    try {
      // Default to chart analysis for any stock-related queries
      analyzeCurrentChart();
    } catch (error) {
      console.error("API Call Error:", error);
      
      setMessages(prev => [...prev, { 
        type: 'bot', 
        content: handleApiError(error),
        isError: true
      }]);
    } finally {
      setLoading(false);
    }
  };

  // Render formatted analysis content with improved section labeling
  const renderAnalysisContent = (content: any) => {
    if (typeof content === 'string') {
      return content;
    }
    
    // If we have fullResponse from fallback, just show that
    if (content.fullResponse) {
      return (
        <div className="space-y-3">
          <div className="font-medium flex items-center gap-2">
            <TrendingUp className="w-4 h-4 text-blue-600" />
            <span>Analysis for {selectedStock.replace('.NS', '')}:</span>
          </div>
          <div className="text-sm whitespace-pre-line">{content.fullResponse}</div>
          
          {content.disclaimer && (
            <div className="text-xs text-yellow-600 mt-2 border-t pt-2 border-yellow-200">
              {content.disclaimer}
            </div>
          )}
        </div>
      );
    }
    
    // Map of section keys to their display titles
    const sectionTitles = {
      recommendation: "Recommendation",
      priceTarget: "Price Target",
      keyLevels: "Key Price Levels",
      patterns: "Chart Patterns",
      fundamentalAnalysis: "Fundamental Analysis",
      sector: "Sector",
      rationale: "Rationale"
    };
    
    // Create an array of sections that have content
    const sections = Object.keys(content)
      .filter(key => key !== 'disclaimer' && content[key])
      .map(key => ({
        key,
        title: sectionTitles[key as keyof typeof sectionTitles] || key,
        content: content[key]
      }));
    
    return (
      <div className="space-y-3">
        <div className="font-medium flex items-center gap-2">
          <TrendingUp className="w-4 h-4 text-blue-600" />
          <span>Analysis for {selectedStock.replace('.NS', '')}:</span>
        </div>
        
        {/* Highlight the recommendation if available */}
        {content.recommendation && (
          <div className="bg-blue-50 p-2 rounded-md border border-blue-100">
            <div className="font-medium">Recommendation:</div>
            <div className="text-lg font-bold">
              {content.recommendation}
            </div>
          </div>
        )}
        
        {/* Standard sections */}
        {sections
          .filter(section => section.key !== 'recommendation') // Skip recommendation as it's already shown
          .map(section => (
            <div key={section.key} className="space-y-1">
              <div className="font-medium">
                {section.title}:
              </div>
              <p className="text-sm">{section.content}</p>
            </div>
          ))
        }
        
        {content.disclaimer && (
          <div className="text-xs text-yellow-600 mt-2 border-t pt-2 border-yellow-200">
            {content.disclaimer}
          </div>
        )}
      </div>
    );
  };

  return (
    <>
      {/* Chat button */}
      <motion.button
        className="fixed bottom-4 right-4 bg-blue-500 text-white p-4 rounded-full shadow-lg hover:bg-blue-600 z-50"
        whileHover={{ scale: 1.1 }}
        whileTap={{ scale: 0.9 }}
        onClick={() => setIsOpen(true)}
      >
        <MessageSquare className="h-6 w-6" />
      </motion.button>

      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 20 }}
            className="fixed bottom-20 right-4 w-96 bg-white rounded-lg shadow-xl z-50 border border-gray-200"
          >
            {/* Chatbot Header */}
            <div className="p-4 border-b border-gray-200 flex justify-between items-center bg-gray-50">
              <div className="flex items-center gap-2">
                <MessageSquare className="h-5 w-5 text-blue-600" />
                <h3 className="text-lg font-semibold text-gray-800">Stock Analysis Assistant</h3>
              </div>
              <button onClick={() => setIsOpen(false)} className="text-gray-500 hover:text-gray-700">
                <X className="h-5 w-5" />
              </button>
            </div>
            
            {/* Chat Messages */}
            <div className="h-96 overflow-y-auto p-4 space-y-4">
              {messages.map((message, index) => (
                <motion.div 
                  key={index} 
                  initial={{ opacity: 0, y: 10 }} 
                  animate={{ opacity: 1, y: 0 }} 
                  className={`flex ${message.type === 'user' ? "justify-end" : "justify-start"}`}
                >
                  <div className={`max-w-[80%] p-3 rounded-lg ${
                    message.type === 'user' 
                      ? "bg-blue-500 text-white" 
                      : message.isDisclaimer || message.isPrompt
                        ? "bg-yellow-50 border border-yellow-200 text-gray-800" 
                        : message.isError
                          ? "bg-red-50 border border-red-200 text-gray-800"
                          : message.isInfo
                            ? "bg-blue-50 border border-blue-200 text-gray-800"
                            : "bg-gray-100 text-gray-800"
                    } ${message.isDisclaimer || message.isPrompt || message.isError || message.isInfo ? "flex items-start gap-2" : ""}`}
                  >
                    {message.isDisclaimer && <AlertTriangle className="h-5 w-5 flex-shrink-0 mt-0.5 text-yellow-500" />}
                    {message.isPrompt && <Camera className="h-5 w-5 flex-shrink-0 mt-0.5 text-blue-500" />}
                    {message.isError && <AlertTriangle className="h-5 w-5 flex-shrink-0 mt-0.5 text-red-500" />}
                    {message.isInfo && <Info className="h-5 w-5 flex-shrink-0 mt-0.5 text-blue-500" />}
                    
                    <div>
                      {typeof message.content === 'object' 
                        ? renderAnalysisContent(message.content) 
                        : typeof message.content === 'string'
                          ? <div className="whitespace-pre-line">{message.content}</div>
                          : message.content}
                      
                      {message.hasScreenshot && screenshotImageRef.current && (
                        <div className="mt-2">
                          <img 
                            src={screenshotImageRef.current} 
                            alt="Chart Screenshot" 
                            className="w-full h-auto rounded-md border border-gray-200 mt-1" 
                          />
                        </div>
                      )}
                    </div>
                  </div>
                </motion.div>
              ))}
              
              {/* Loading indicator */}
              {loading && (
                <motion.div 
                  initial={{ opacity: 0 }} 
                  animate={{ opacity: 1 }} 
                  className="flex justify-start"
                >
                  <div className="bg-gray-100 text-gray-800 p-3 rounded-lg flex items-center space-x-2">
                    <div className="w-2 h-2 bg-blue-500 rounded-full animate-bounce" />
                    <div className="w-2 h-2 bg-blue-500 rounded-full animate-bounce delay-100" />
                    <div className="w-2 h-2 bg-blue-500 rounded-full animate-bounce delay-200" />
                  </div>
                </motion.div>
              )}
              
              {/* Capturing indicator */}
              {capturing && (
                <motion.div 
                  initial={{ opacity: 0 }} 
                  animate={{ opacity: 1 }} 
                  className="flex justify-start"
                >
                  <div className="bg-blue-50 border border-blue-200 text-gray-800 p-3 rounded-lg flex items-center space-x-2">
                    <Camera className="h-5 w-5 text-blue-500 animate-pulse" />
                    <span>Capturing your screen...</span>
                  </div>
                </motion.div>
              )}
              
              <div ref={messagesEndRef} />
            </div>
            
            {/* Disclaimer */}
            <div className="p-2 border-t border-gray-200">
              <div className="bg-gray-50 rounded-lg p-2 text-xs text-gray-600 flex items-start gap-2">
                <Info className="h-4 w-4 flex-shrink-0 mt-0.5 text-yellow-500" />
                <span>Analysis is for educational purposes only. Not financial advice.</span>
              </div>
            </div>
            
            {/* Input Form */}
            <form onSubmit={handleSubmit} className="p-4 border-t border-gray-200">
              <div className="flex space-x-2">
                <input 
                  type="text" 
                  value={input} 
                  onChange={(e) => setInput(e.target.value)} 
                  placeholder="Ask 'Should I buy this stock?' or 'Analyze chart'" 
                  disabled={loading || capturing} 
                  className="flex-1 bg-gray-100 text-gray-800 rounded-lg px-4 py-2 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500" 
                />
                <motion.button 
                  whileHover={{ scale: 1.05 }} 
                  whileTap={{ scale: 0.95 }} 
                  type="submit" 
                  disabled={loading || capturing || !input.trim()} 
                  className="bg-blue-500 text-white p-2 rounded-lg hover:bg-blue-600 disabled:opacity-50"
                >
                  <Send className="h-5 w-5" />
                </motion.button>
              </div>
            </form>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
};

export default FinanceChatbot;