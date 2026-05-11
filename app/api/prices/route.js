export const runtime = 'edge';

// Cache price responses for 60s on Vercel's edge network
// so multiple users (or rapid refreshes) don't hammer the free APIs
export const revalidate = 60;

async function fetchStocks(symbols, fxRate) {
  // Primary: Yahoo Finance
  try {
    const res = await fetch(
      `https://query1.finance.yahoo.com/v7/finance/quote?symbols=${symbols}`,
      { headers: { 'Accept': 'application/json', 'User-Agent': 'Mozilla/5.0' } }
    );
    if (!res.ok) throw new Error(`Yahoo ${res.status}`);
    const data = await res.json();
    const quotes = data?.quoteResponse?.result || [];
    if (!quotes.length) throw new Error('No quotes');
    const prices = {};
    quotes.forEach(q => {
      if (!q.regularMarketPrice) return;
      prices[q.symbol] = q.currency === 'PHP'
        ? +q.regularMarketPrice.toFixed(2)
        : +(q.regularMarketPrice * fxRate).toFixed(2);
    });
    return { prices, source: 'Yahoo Finance' };
  } catch (e) {
    // Fallback: Yahoo Finance alternate host
    try {
      const res = await fetch(
        `https://query2.finance.yahoo.com/v7/finance/quote?symbols=${symbols}`,
        { headers: { 'Accept': 'application/json', 'User-Agent': 'Mozilla/5.0' } }
      );
      if (!res.ok) throw new Error(`Yahoo2 ${res.status}`);
      const data = await res.json();
      const quotes = data?.quoteResponse?.result || [];
      const prices = {};
      quotes.forEach(q => {
        if (!q.regularMarketPrice) return;
        prices[q.symbol] = q.currency === 'PHP'
          ? +q.regularMarketPrice.toFixed(2)
          : +(q.regularMarketPrice * fxRate).toFixed(2);
      });
      return { prices, source: 'Yahoo Finance (alt)' };
    } catch (e2) {
      throw new Error(`All stock sources failed: ${e.message}, ${e2.message}`);
    }
  }
}

async function fetchCrypto(ids) {
  // Primary: CoinGecko
  try {
    const res = await fetch(
      `https://api.coingecko.com/api/v3/simple/price?ids=${ids}&vs_currencies=php,usd`,
      { headers: { 'Accept': 'application/json' } }
    );
    if (!res.ok) throw new Error(`CoinGecko ${res.status}`);
    const data = await res.json();
    const prices = {};
    Object.entries(data).forEach(([id, val]) => {
      if (val.php) prices[id] = val.php;
    });
    return { prices, source: 'CoinGecko' };
  } catch (e) {
    throw new Error(`Crypto source failed: ${e.message}`);
  }
}

async function fetchFxRate(from, to) {
  try {
    const res = await fetch(`https://open.er-api.com/v6/latest/${from}`);
    if (!res.ok) throw new Error('FX fetch failed');
    const data = await res.json();
    return data.rates?.[to] || null;
  } catch { return null; }
}

export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const type = searchParams.get('type');

  try {
    if (type === 'stock') {
      const symbols = searchParams.get('symbols');
      const fxRate = parseFloat(searchParams.get('fxRate') || '61.45');
      if (!symbols) return Response.json({ error: 'symbols required' }, { status: 400 });
      const result = await fetchStocks(symbols, fxRate);
      return Response.json(result);
    }

    if (type === 'crypto') {
      const ids = searchParams.get('ids');
      if (!ids) return Response.json({ error: 'ids required' }, { status: 400 });
      const result = await fetchCrypto(ids);
      return Response.json(result);
    }

    if (type === 'fx') {
      const from = searchParams.get('from') || 'USD';
      const to = searchParams.get('to') || 'PHP';
      const rate = await fetchFxRate(from, to);
      return Response.json({ rate, source: 'ExchangeRate-API' });
    }

    return Response.json({ error: 'type must be stock, crypto, or fx' }, { status: 400 });
  } catch (err) {
    return Response.json({ error: err.message }, { status: 500 });
  }
}
