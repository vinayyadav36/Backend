'use strict';
/**
 * Trading & Investment Module - Service
 * Implements backtesting engines, technical indicators, risk metrics
 */

/**
 * Calculate Simple Moving Average
 */
function sma(data, period) {
  const result = [];
  for (let i = 0; i < data.length; i++) {
    if (i < period - 1) { result.push(null); continue; }
    const slice = data.slice(i - period + 1, i + 1);
    result.push(slice.reduce((a, b) => a + b, 0) / period);
  }
  return result;
}

/**
 * Calculate RSI
 */
function rsi(data, period = 14) {
  const result = [];
  for (let i = 0; i < data.length; i++) {
    if (i < period) { result.push(null); continue; }
    let gains = 0, losses = 0;
    for (let j = i - period + 1; j <= i; j++) {
      const change = data[j] - data[j - 1];
      if (change > 0) gains += change;
      else losses += Math.abs(change);
    }
    const avgGain = gains / period;
    const avgLoss = losses / period;
    if (avgLoss === 0) { result.push(100); continue; }
    const rs = avgGain / avgLoss;
    result.push(100 - (100 / (1 + rs)));
  }
  return result;
}

/**
 * Calculate EMA
 */
function ema(data, period) {
  const k = 2 / (period + 1);
  const result = [];
  let prev = null;
  for (let i = 0; i < data.length; i++) {
    if (i < period - 1) { result.push(null); continue; }
    if (i === period - 1) {
      prev = data.slice(0, period).reduce((a, b) => a + b, 0) / period;
      result.push(prev);
      continue;
    }
    prev = data[i] * k + prev * (1 - k);
    result.push(prev);
  }
  return result;
}

/**
 * Calculate MACD
 */
function macd(data, fast = 12, slow = 26, signal = 9) {
  const fastEma = ema(data, fast);
  const slowEma = ema(data, slow);
  const macdLine = fastEma.map((v, i) => (v !== null && slowEma[i] !== null) ? v - slowEma[i] : null);
  const signalLine = ema(macdLine.filter(v => v !== null), signal);
  const histogram = [];
  let sIdx = 0;
  for (let i = 0; i < macdLine.length; i++) {
    if (macdLine[i] === null) { histogram.push(null); continue; }
    const sig = signalLine[sIdx] !== undefined ? signalLine[sIdx++] : null;
    histogram.push(sig !== null ? macdLine[i] - sig : null);
  }
  return { macdLine, signalLine, histogram };
}

/**
 * Backtest SMA Crossover strategy
 */
function backtestSMA(priceData, shortPeriod = 10, longPeriod = 50, initialCapital = 100000) {
  if (!priceData || priceData.length < longPeriod + 5) {
    throw new Error(`Need at least ${longPeriod + 5} data points`);
  }
  const prices = priceData.map(d => typeof d === 'object' ? d.close || d.price || d : d);
  const shortSma = sma(prices, shortPeriod);
  const longSma = sma(prices, longPeriod);

  let cash = initialCapital;
  let shares = 0;
  let position = null;
  const trades = [];
  const equity = [{ index: 0, value: initialCapital }];

  for (let i = longPeriod; i < prices.length; i++) {
    const prev = i - 1;
    if (shortSma[prev] === null || longSma[prev] === null) continue;

    const crossedAbove = shortSma[prev] < longSma[prev] && shortSma[i] > longSma[i];
    const crossedBelow = shortSma[prev] > longSma[prev] && shortSma[i] < longSma[i];

    if (crossedAbove && position !== 'long' && cash > 0) {
      shares = Math.floor(cash / prices[i]);
      const cost = shares * prices[i];
      cash -= cost;
      position = 'long';
      trades.push({ index: i, date: priceData[i]?.date || i, type: 'BUY', price: prices[i], shares, value: cost });
    } else if (crossedBelow && position === 'long' && shares > 0) {
      const revenue = shares * prices[i];
      cash += revenue;
      const entry = trades.filter(t => t.type === 'BUY').pop();
      const pnl = entry ? revenue - entry.value : 0;
      trades.push({ index: i, date: priceData[i]?.date || i, type: 'SELL', price: prices[i], shares, value: revenue, pnl });
      shares = 0;
      position = null;
    }
    equity.push({ index: i, date: priceData[i]?.date || i, value: cash + shares * prices[i] });
  }

  const finalValue = cash + shares * prices[prices.length - 1];
  const sellTrades = trades.filter(t => t.type === 'SELL');
  const wins = sellTrades.filter(t => t.pnl > 0).length;

  return {
    initialCapital,
    finalValue,
    totalReturn: ((finalValue - initialCapital) / initialCapital) * 100,
    totalTrades: sellTrades.length,
    profitableTrades: wins,
    winRate: sellTrades.length > 0 ? (wins / sellTrades.length) * 100 : 0,
    sharpeRatio: calculateSharpe(equity.map((e, i) => i === 0 ? 0 : (e.value - equity[i - 1].value) / equity[i - 1].value)),
    maxDrawdown: calculateMaxDrawdown(equity.map(e => e.value)),
    equityCurve: equity,
    trades,
    parameters: { shortPeriod, longPeriod },
  };
}

/**
 * Backtest RSI strategy
 */
function backtestRSI(priceData, period = 14, oversold = 30, overbought = 70, initialCapital = 100000) {
  if (!priceData || priceData.length < period + 5) {
    throw new Error(`Need at least ${period + 5} data points`);
  }
  const prices = priceData.map(d => typeof d === 'object' ? d.close || d.price || d : d);
  const rsiValues = rsi(prices, period);

  let cash = initialCapital;
  let shares = 0;
  let position = null;
  const trades = [];
  const equity = [{ index: 0, value: initialCapital }];

  for (let i = period + 1; i < prices.length; i++) {
    if (rsiValues[i] === null) continue;

    const buySignal = rsiValues[i - 1] <= oversold && rsiValues[i] > oversold;
    const sellSignal = rsiValues[i - 1] >= overbought && rsiValues[i] < overbought;

    if (buySignal && position !== 'long' && cash > 0) {
      shares = Math.floor(cash / prices[i]);
      const cost = shares * prices[i];
      cash -= cost;
      position = 'long';
      trades.push({ index: i, date: priceData[i]?.date || i, type: 'BUY', price: prices[i], shares, value: cost, rsi: rsiValues[i] });
    } else if (sellSignal && position === 'long' && shares > 0) {
      const revenue = shares * prices[i];
      cash += revenue;
      const entry = trades.filter(t => t.type === 'BUY').pop();
      const pnl = entry ? revenue - entry.value : 0;
      trades.push({ index: i, date: priceData[i]?.date || i, type: 'SELL', price: prices[i], shares, value: revenue, pnl, rsi: rsiValues[i] });
      shares = 0;
      position = null;
    }
    equity.push({ index: i, date: priceData[i]?.date || i, value: cash + shares * prices[i] });
  }

  const finalValue = cash + shares * prices[prices.length - 1];
  const sellTrades = trades.filter(t => t.type === 'SELL');
  const wins = sellTrades.filter(t => t.pnl > 0).length;

  return {
    initialCapital,
    finalValue,
    totalReturn: ((finalValue - initialCapital) / initialCapital) * 100,
    totalTrades: sellTrades.length,
    profitableTrades: wins,
    winRate: sellTrades.length > 0 ? (wins / sellTrades.length) * 100 : 0,
    sharpeRatio: calculateSharpe(equity.map((e, i) => i === 0 ? 0 : (e.value - equity[i - 1].value) / equity[i - 1].value)),
    maxDrawdown: calculateMaxDrawdown(equity.map(e => e.value)),
    equityCurve: equity,
    trades,
    parameters: { period, oversold, overbought },
  };
}

/**
 * Backtest MACD strategy
 */
function backtestMACD(priceData, fast = 12, slow = 26, signal = 9, initialCapital = 100000) {
  const prices = priceData.map(d => typeof d === 'object' ? d.close || d.price || d : d);
  const { macdLine, signalLine } = macd(prices, fast, slow, signal);

  let cash = initialCapital;
  let shares = 0;
  let position = null;
  const trades = [];
  const equity = [{ index: 0, value: initialCapital }];

  for (let i = slow + signal; i < prices.length; i++) {
    if (macdLine[i] === null || signalLine[i] === null) continue;
    const crossedAbove = macdLine[i - 1] < signalLine[i - 1] && macdLine[i] >= signalLine[i];
    const crossedBelow = macdLine[i - 1] > signalLine[i - 1] && macdLine[i] <= signalLine[i];

    if (crossedAbove && position !== 'long' && cash > 0) {
      shares = Math.floor(cash / prices[i]);
      cash -= shares * prices[i];
      position = 'long';
      trades.push({ index: i, type: 'BUY', price: prices[i], shares });
    } else if (crossedBelow && position === 'long' && shares > 0) {
      const revenue = shares * prices[i];
      cash += revenue;
      const entry = trades.filter(t => t.type === 'BUY').pop();
      trades.push({ index: i, type: 'SELL', price: prices[i], shares, pnl: entry ? revenue - entry.shares * entry.price : 0 });
      shares = 0;
      position = null;
    }
    equity.push({ index: i, value: cash + shares * prices[i] });
  }

  const finalValue = cash + shares * prices[prices.length - 1];
  const sellTrades = trades.filter(t => t.type === 'SELL');
  const wins = sellTrades.filter(t => t.pnl > 0).length;
  return {
    initialCapital, finalValue,
    totalReturn: ((finalValue - initialCapital) / initialCapital) * 100,
    totalTrades: sellTrades.length, profitableTrades: wins,
    winRate: sellTrades.length > 0 ? (wins / sellTrades.length) * 100 : 0,
    sharpeRatio: calculateSharpe(equity.map((e, i) => i === 0 ? 0 : (e.value - equity[i - 1].value) / equity[i - 1].value)),
    maxDrawdown: calculateMaxDrawdown(equity.map(e => e.value)),
    equityCurve: equity, trades, parameters: { fast, slow, signal },
  };
}

/**
 * Calculate Sharpe Ratio
 */
function calculateSharpe(returns, riskFreeRate = 0.05 / 252) {
  const validReturns = returns.filter(r => r !== null && !isNaN(r));
  if (validReturns.length < 2) return 0;
  const mean = validReturns.reduce((a, b) => a + b, 0) / validReturns.length;
  const variance = validReturns.reduce((a, b) => a + Math.pow(b - mean, 2), 0) / validReturns.length;
  const stdDev = Math.sqrt(variance);
  if (stdDev === 0) return 0;
  return ((mean - riskFreeRate) / stdDev) * Math.sqrt(252);
}

/**
 * Calculate Maximum Drawdown
 */
function calculateMaxDrawdown(equityCurve) {
  let peak = equityCurve[0];
  let maxDD = 0;
  for (const val of equityCurve) {
    if (val > peak) peak = val;
    const dd = (peak - val) / peak;
    if (dd > maxDD) maxDD = dd;
  }
  return maxDD * 100;
}

/**
 * Calculate Value at Risk (Historical Simulation)
 */
function calculateVaR(returns, confidence = 0.95) {
  const sorted = [...returns].filter(r => !isNaN(r)).sort((a, b) => a - b);
  if (sorted.length === 0) return 0;
  const index = Math.floor((1 - confidence) * sorted.length);
  return Math.abs(sorted[index] || 0);
}

/**
 * Generate trading signals from price data
 */
function generateSignals(priceData, strategy = 'sma', params = {}) {
  const prices = priceData.map(d => typeof d === 'object' ? d.close || d.price || d : d);
  const signals = [];

  if (strategy === 'sma') {
    const { short = 10, long = 50 } = params;
    const shortSma = sma(prices, short);
    const longSma = sma(prices, long);
    for (let i = 1; i < prices.length; i++) {
      if (shortSma[i] === null || longSma[i] === null) continue;
      if (shortSma[i - 1] < longSma[i - 1] && shortSma[i] >= longSma[i]) signals.push({ index: i, signal: 'BUY', price: prices[i], indicator: 'SMA_CROSS' });
      else if (shortSma[i - 1] > longSma[i - 1] && shortSma[i] <= longSma[i]) signals.push({ index: i, signal: 'SELL', price: prices[i], indicator: 'SMA_CROSS' });
    }
  } else if (strategy === 'rsi') {
    const { period = 14, oversold = 30, overbought = 70 } = params;
    const rsiVals = rsi(prices, period);
    for (let i = 1; i < prices.length; i++) {
      if (rsiVals[i] === null) continue;
      if (rsiVals[i - 1] <= oversold && rsiVals[i] > oversold) signals.push({ index: i, signal: 'BUY', price: prices[i], rsi: rsiVals[i], indicator: 'RSI' });
      else if (rsiVals[i - 1] >= overbought && rsiVals[i] < overbought) signals.push({ index: i, signal: 'SELL', price: prices[i], rsi: rsiVals[i], indicator: 'RSI' });
    }
  }

  return signals;
}

/**
 * Position sizing using percent risk
 */
function simulateTrade(portfolio, signal, riskPercent = 2) {
  const capital = portfolio.cash || 0;
  const riskAmount = capital * (riskPercent / 100);
  const quantity = Math.floor(riskAmount / signal.price);
  return {
    symbol: signal.symbol || 'UNKNOWN',
    type: signal.signal,
    quantity,
    price: signal.price,
    total: quantity * signal.price,
    riskAmount,
  };
}

module.exports = { sma, ema, rsi, macd, backtestSMA, backtestRSI, backtestMACD, calculateSharpe, calculateMaxDrawdown, calculateVaR, generateSignals, simulateTrade };
