'use client';
import { storage } from '../lib/db';
import { useState, useEffect, useMemo, useRef } from 'react';
import {
  Wallet, Gem, Building2, TrendingUp, LineChart as LineIcon,
  Plus, Trash2, X, ArrowRight, RefreshCw,
  PiggyBank, Receipt, Coins, Briefcase, Sparkles, AlertCircle,
  LayoutDashboard, BarChart3, Target, Pencil, Lightbulb,
  Download, Upload, CandlestickChart, CreditCard, Home, Landmark,
  Banknote, FileText, History, Wallet as WalletIcon, Flag,
  Calendar, ChevronLeft, ChevronRight, Calculator, Tag,
  Shield, Car, Heart, Music, Camera, Plane,
  GraduationCap, BookOpen, Smartphone, Save, Star
} from 'lucide-react';
import {
  LineChart, Line, AreaChart, Area,
  PieChart as RPie, Pie, Cell,
  BarChart, Bar,
  XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid,
  ReferenceLine
} from 'recharts';

// ===== THEME =====
const T = {
  bg:          '#0A0A0A',
  surface:     '#111111',
  surface2:    '#1A1A1A',
  surface3:    '#222222',
  border:      '#1F1F1F',
  border2:     '#2A2A2A',
  accent:      '#00C896',
  accentBright:'#00E5A8',
  accentDim:   '#00956E',
  text:        '#F0F0F0',
  textDim:     '#8A8A8A',
  textFaint:   '#444444',
  green:       '#00C896',
  greenBg:     'rgba(0, 200, 150, 0.12)',
  red:         '#FF4D4D',
  redBg:       'rgba(255, 77, 77, 0.12)',
  blue:        '#6B8FB5',
  blueBg:      'rgba(107, 143, 181, 0.12)',
  purple:      '#9B7FE8',
  purpleBg:    'rgba(155, 127, 232, 0.12)',
};

// ===== CONFIG =====
// Keys use pw_ prefix - confirmed working in storage diagnostics
const STORAGE_KEY = 'pw_pat_v4';
const STORAGE_VERSION = 11;
const INSTALL_FLAG = 'pw_installed_v4';
const SNAPSHOT_KEY = 'pw_pat_snaps';
const BACKUP_PREFIX = 'pw_pat_bk';
const BACKUP_INDEX_KEY = 'pw_pat_bkidx';
const BACKUP_MAX_SLOTS = 5;
const BACKUP_MIN_INTERVAL_MS = 60 * 1000;
const DEFAULT_USDPHP = 61.45;

// Tax treatment options for income items
const TAX_TREATMENTS = {
  none:           { label: 'No deduction',                                short: 'Gross' },
  salary:         { label: 'Salary (BIR + SSS/PhilHealth/Pag-IBIG)',      short: 'Net of tax' },
  selfemployed8:  { label: 'Self-employed 8% flat tax',                   short: '8% flat' },
};

const ASSET_CATEGORIES = {
  bank:       { label: 'Bank Accounts',      short: 'Bank',      icon: Landmark,  color: T.accent,    tint: 'rgba(0, 200, 150, 0.12)' },
  insurance:  { label: 'Insurance & VUL',    short: 'Insurance', icon: Shield,    color: '#5C8A8A', tint: 'rgba(92, 138, 138, 0.12)' },
  tangible:   { label: 'Tangible Assets',    short: 'Tangible',  icon: Gem,       color: '#B8865C', tint: 'rgba(184, 134, 92, 0.12)' },
  realestate: { label: 'Real Estate',        short: 'Property',  icon: Home,      color: '#A47148', tint: 'rgba(164, 113, 72, 0.12)' },
  vehicles:   { label: 'Vehicles',           short: 'Vehicle',   icon: Car,       color: '#7A8B9E', tint: 'rgba(122, 139, 158, 0.12)' },
  business:   { label: 'Business Ventures',  short: 'Business',  icon: Building2, color: '#9A8262', tint: 'rgba(154, 130, 98, 0.12)' },
  other:      { label: 'Other Assets',       short: 'Other',     icon: Coins,     color: '#7E8C7A', tint: 'rgba(126, 140, 122, 0.12)' },
};

// Icon set available for user-created custom categories.
// Keyed by name (string) so we can serialize the choice to storage and reconstruct on load.
const CUSTOM_CATEGORY_ICONS = {
  Coins, Gem, Shield, Home, Car, Building2, Briefcase, PiggyBank, Landmark, Wallet,
  Sparkles, Tag, Star, Flag, Heart, Music, Camera, Plane, GraduationCap,
  BookOpen, Smartphone,
};

// Curated color palette for custom categories — dark fintech palette: accent green, purple, blue, neutrals.
const CUSTOM_CATEGORY_COLORS = [
  '#00C896', '#00E5A8', '#B8865C', '#A47148',
  '#9A8262', '#7E8C7A', '#5C8A8A', '#7A8B9E',
  '#9B7FE8', '#C25450', '#6B9E50', '#6B8FB5',
];

// Convert hex like '#7A8B9E' to a low-alpha rgba tint for backgrounds (matches the existing built-ins).
const hexToTint = (hex, alpha = 0.12) => {
  const h = hex.replace('#', '');
  const r = parseInt(h.slice(0, 2), 16);
  const g = parseInt(h.slice(2, 4), 16);
  const b = parseInt(h.slice(4, 6), 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
};

// Build the effective category map by merging built-ins + user-defined customs.
// Custom category records have shape { id, label, iconKey, color }; their `id` becomes the asset.category value.
const buildCategoryMap = (customCategories) => {
  const merged = { ...ASSET_CATEGORIES };
  (customCategories || []).forEach(c => {
    merged[c.id] = {
      label: c.label,
      short: c.label,
      icon: CUSTOM_CATEGORY_ICONS[c.iconKey] || Coins,
      color: c.color || '#7E8C7A',
      tint: hexToTint(c.color || '#7E8C7A'),
      isCustom: true,
      iconKey: c.iconKey, // preserve so the edit modal can pre-select
    };
  });
  return merged;
};

const DEBT_TYPES = {
  creditcard: { label: 'Credit Card',  icon: CreditCard },
  loan:       { label: 'Personal Loan',icon: Banknote },
  mortgage:   { label: 'Mortgage',     icon: Home },
  carloan:    { label: 'Car Loan',     icon: Briefcase },
  other:      { label: 'Other Debt',   icon: FileText },
};

const INCOME_TYPES = {
  salary:     { label: 'Salary',     icon: Briefcase },
  commission: { label: 'Commission', icon: Sparkles },
  dividend:   { label: 'Dividend',   icon: Coins },
  business:   { label: 'Business',   icon: Building2 },
  other:      { label: 'Other',      icon: PiggyBank }
};

// Spending categories used by BOTH recurring expenses and daily spending log
const SPEND_CATEGORIES = {
  food:          { label: 'Food & Dining',         color: '#C25450' },
  groceries:     { label: 'Groceries',             color: '#A04A47' },
  transport:     { label: 'Transport',             color: '#6B8FB5' },
  housing:       { label: 'Housing & Rent',        color: '#9A8262' },
  utilities:     { label: 'Utilities & Bills',     color: '#B8865C' },
  subscriptions: { label: 'Subscriptions',         color: '#9D7FBF' },
  shopping:      { label: 'Shopping',              color: '#9B7FE8' },
  entertainment: { label: 'Entertainment',         color: '#7E8C7A' },
  health:        { label: 'Health & Wellness',     color: '#6B9E50' },
  personal:      { label: 'Personal Care',         color: '#00C896' },
  travel:        { label: 'Travel',                color: '#A04A47' },
  gifts:         { label: 'Gifts & Donations',     color: '#9D7FBF' },
  debt_payment:  { label: 'Debt Payments',         color: '#C25450' },
  savings:       { label: 'Savings & Investment',  color: '#6B9E50' },
  other:         { label: 'Other',                 color: '#7E8C7A' },
};

const PAYMENT_METHODS = ['Cash', 'Debit Card', 'Credit Card', 'GCash', 'Maya', 'Bank Transfer', 'Other'];

const FREQUENCIES = {
  monthly:   { label: 'Monthly',   factor: 1 },
  quarterly: { label: 'Quarterly', factor: 1/3 },
  annual:    { label: 'Annual',    factor: 1/12 },
  yearly:    { label: 'Yearly',    factor: 1/12 },
};

const CURRENCIES = ['PHP', 'USD', 'EUR', 'GBP', 'JPY', 'SGD', 'HKD'];

// ===== HELPERS =====
const uid = () => Math.random().toString(36).slice(2, 10);
const fmt = (n) => '₱' + Math.round(n || 0).toLocaleString('en-PH');
const fmtFull = (n) => '₱' + (Number(n) || 0).toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const fmtSign = (n) => (n >= 0 ? '+' : '') + fmt(n);
const fmtK = (n) => {
  const v = n || 0;
  if (Math.abs(v) >= 1_000_000) return '₱' + (v / 1_000_000).toFixed(1) + 'M';
  if (Math.abs(v) >= 1_000) return '₱' + (v / 1_000).toFixed(0) + 'K';
  return '₱' + Math.round(v);
};
const fmtPct = (n) => (n >= 0 ? '+' : '') + (n * 100).toFixed(1) + '%';
const toMonthly = (item) => Number(item.amount || 0) * (FREQUENCIES[item.frequency]?.factor ?? 1);
const toMonthlyGross = toMonthly;
const holdingValue = (h) => Number(h.shares || 0) * Number(h.currentPrice || 0);
const holdingCost = (h) => Number(h.shares || 0) * Number(h.avgCost || 0);
// Return null when avgCost is 0 or missing — means "no cost basis provided, don't show P&L"
const holdingPL = (h) => (h.avgCost && Number(h.avgCost) > 0) ? holdingValue(h) - holdingCost(h) : null;
const holdingPLPct = (h) => (h.avgCost && Number(h.avgCost) > 0 && holdingCost(h) > 0) ? (holdingValue(h) - holdingCost(h)) / holdingCost(h) : null;
const ago = (iso) => {
  if (!iso) return 'never';
  const ms = Date.now() - new Date(iso).getTime();
  const m = Math.floor(ms / 60000);
  if (m < 1) return 'just now';
  if (m < 60) return m + 'm ago';
  const h = Math.floor(m / 60);
  if (h < 24) return h + 'h ago';
  const d = Math.floor(h / 24);
  if (d < 30) return d + 'd ago';
  return Math.floor(d / 30) + 'mo ago';
};
const toPHP = (amount, currency, rates) => {
  if (!currency || currency === 'PHP') return Number(amount || 0);
  const rate = rates[currency] || 1;
  return Number(amount || 0) * rate;
};
const todayISO = () => new Date().toISOString().slice(0, 10);
const ymd = (date) => new Date(date).toISOString().slice(0, 10);
const startOfMonth = (date) => { const d = new Date(date); d.setDate(1); return d; };
const startOfWeek = (date) => { const d = new Date(date); const day = d.getDay(); d.setDate(d.getDate() - day); return d; };
const daysBetween = (a, b) => Math.ceil((new Date(b) - new Date(a)) / (1000 * 60 * 60 * 24));
const monthLabel = (date) => new Date(date).toLocaleDateString('en-US', { month: 'short', year: 'numeric' });

// Custom label resolution. customLabels is an object keyed like "asset.tangible" or "debt.creditcard"
const labelFor = (scope, key, fallback, customLabels) => {
  const customKey = `${scope}.${key}`;
  return (customLabels && customLabels[customKey]) || fallback;
};

// ===== PHILIPPINES TAX (BIR 2024+ TRAIN-Reform brackets, monthly) =====
// Annual brackets converted to monthly equivalents
const PH_TAX_BRACKETS = [
  { upTo: 250_000,   rate: 0,    base: 0 },
  { upTo: 400_000,   rate: 0.15, base: 0 },
  { upTo: 800_000,   rate: 0.20, base: 22_500 },
  { upTo: 2_000_000, rate: 0.25, base: 102_500 },
  { upTo: 8_000_000, rate: 0.30, base: 402_500 },
  { upTo: Infinity,  rate: 0.35, base: 2_202_500 },
];
// SSS, PhilHealth, Pag-IBIG approximations (employee share, monthly, rough)
const calcContributions = (monthlyGross) => {
  // SSS 2024: max ~1750 employee contribution at high end
  const sss = Math.min(monthlyGross * 0.045, 1750);
  // PhilHealth 2024: 5% split, employee 2.5%, capped
  const philhealth = Math.min(Math.max(monthlyGross * 0.025, 250), 2500);
  // Pag-IBIG: 2% capped at 200
  const pagibig = Math.min(monthlyGross * 0.02, 200);
  return { sss, philhealth, pagibig, total: sss + philhealth + pagibig };
};
const calcPHTax = (monthlyGross) => {
  if (monthlyGross <= 0) return { tax: 0, takehome: 0, contributions: { total: 0, sss: 0, philhealth: 0, pagibig: 0 }, effectiveRate: 0 };
  const annualGross = monthlyGross * 12;
  const contribs = calcContributions(monthlyGross);
  const annualContribs = contribs.total * 12;
  const taxableAnnual = Math.max(0, annualGross - annualContribs);
  let tax = 0;
  let lastUpTo = 0;
  for (const b of PH_TAX_BRACKETS) {
    if (taxableAnnual <= b.upTo) {
      tax = b.base + (taxableAnnual - lastUpTo) * b.rate;
      break;
    }
    lastUpTo = b.upTo;
  }
  const monthlyTax = tax / 12;
  const takehome = monthlyGross - contribs.total - monthlyTax;
  return {
    tax: monthlyTax,
    takehome,
    contributions: contribs,
    effectiveRate: monthlyGross > 0 ? (contribs.total + monthlyTax) / monthlyGross : 0,
    annualTax: tax,
    taxableAnnual
  };
};

// Apply tax treatment to a monthly gross figure to get takehome.
// Returns { net, deductions, breakdown } where breakdown is a per-line description.
const applyTaxTreatment = (monthlyGross, treatment) => {
  if (!treatment || treatment === 'none' || monthlyGross <= 0) {
    return { net: monthlyGross, deductions: 0, breakdown: null };
  }
  if (treatment === 'salary') {
    const t = calcPHTax(monthlyGross);
    return {
      net: t.takehome,
      deductions: monthlyGross - t.takehome,
      breakdown: {
        sss: t.contributions.sss,
        philhealth: t.contributions.philhealth,
        pagibig: t.contributions.pagibig,
        tax: t.tax,
        effectiveRate: t.effectiveRate,
      }
    };
  }
  if (treatment === 'selfemployed8') {
    // 8% flat tax on annual gross above ₱250K threshold
    const annualGross = monthlyGross * 12;
    const annualTax = Math.max(0, annualGross - 250_000) * 0.08;
    const monthlyTax = annualTax / 12;
    return {
      net: monthlyGross - monthlyTax,
      deductions: monthlyTax,
      breakdown: {
        tax: monthlyTax,
        effectiveRate: monthlyGross > 0 ? monthlyTax / monthlyGross : 0,
      }
    };
  }
  return { net: monthlyGross, deductions: 0, breakdown: null };
};

// Net monthly income for an income item respecting its taxTreatment field
const toMonthlyNet = (item) => {
  const gross = toMonthlyGross(item);
  return applyTaxTreatment(gross, item.taxTreatment).net;
};

// ===== SEED =====
const SEED_INCOME = [];
const SEED_EXPENSES = [];
const SEED_CUSTOM_CATEGORIES = [];

const HOLDING_TAGS = {
  core:        { label: 'Core Hold',         color: T.accent,   bg: 'rgba(0, 200, 150, 0.15)' },
  confluence:  { label: 'Strong Confluence', color: T.green,  bg: T.greenBg },
  watch:       { label: 'Under Review',      color: T.blue,   bg: T.blueBg },
  offsystem:   { label: 'Off-System',        color: T.red,    bg: T.redBg },
  speculative: { label: 'Speculative',       color: T.purple, bg: T.purpleBg },
};

// Asset types for the Investments tab. Stocks/ETFs (default), crypto, and PH mutual funds/UITFs all
// share the same data shape but have type-specific UI labels, decimal precision, and price-refresh logic.
const ASSET_TYPES = {
  stock:  {
    label: 'Stock / ETF',
    short: 'Stock',
    unitLabel: 'Shares',
    pricePlaceholder: '245',
    sharesPlaceholder: '100',
    tickerPlaceholder: 'META, SPY, JFC',
    namePlaceholder: 'Meta Platforms',
    brokerPlaceholder: 'Interactive Brokers, COL, BPI Trade',
    color: T.purple,
    bg: T.purpleBg,
    decimals: 4,
    uppercase: true,
  },
  crypto: {
    label: 'Crypto',
    short: 'Crypto',
    unitLabel: 'Coins',
    pricePlaceholder: '6100000',
    sharesPlaceholder: '0.5',
    tickerPlaceholder: 'BTC, ETH, SOL',
    namePlaceholder: 'Bitcoin',
    brokerPlaceholder: 'Binance, Coins.ph, PDAX',
    color: '#F7931A', // bitcoin orange
    bg: 'rgba(247, 147, 26, 0.12)',
    decimals: 8,
    uppercase: true,
  },
  fund:   {
    label: 'PH Mutual Fund / UITF',
    short: 'Fund',
    unitLabel: 'Units',
    pricePlaceholder: '1.234',
    sharesPlaceholder: '10000',
    tickerPlaceholder: 'BPI Money Market Fund',
    namePlaceholder: 'BPI Short Term Fund',
    brokerPlaceholder: 'BPI, BDO, Sun Life, COL Fund Source',
    color: T.blue,
    bg: T.blueBg,
    decimals: 4,
    uppercase: false, // fund names are proper nouns; preserve case
  },
};
const getAssetType = (h) => ASSET_TYPES[h.assetType] || ASSET_TYPES.stock;

// ===== ROOT =====
export default function Patrimony() {
  const [view, setView] = useState('overview');
  const [assets, setAssets] = useState([]);
  const [holdings, setHoldings] = useState([]);
  const [debts, setDebts] = useState([]);
  const [income, setIncome] = useState([]);
  const [expenses, setExpenses] = useState([]); // recurring monthly
  const [spending, setSpending] = useState([]); // daily transactions
  const [goals, setGoals] = useState([]);
  const [envelopes, setEnvelopes] = useState({}); // { categoryKey: monthlyCap }
  const [snapshots, setSnapshots] = useState([]); // [{ date, netWorth, grossAssets, totalDebt, liquidCash, stocksValue }]
  const [customLabels, setCustomLabels] = useState({}); // { 'asset.tangible': 'Watches', 'debt.creditcard': 'Cards', ... }
  const [customCategories, setCustomCategories] = useState([]); // [{ id, label, iconKey, color }]
  // Auto-backup tracking: lastBackupAt is the timestamp of the most recent ring-buffer write,
  // displayed under the header so the user knows backups are running. recoveryOffer holds a
  // candidate restore from a backup slot when main storage is empty/corrupt on boot.
  const [lastBackupAt, setLastBackupAt] = useState(null);
  const [recoveryOffer, setRecoveryOffer] = useState(null);
  const [saveToast, setSaveToast] = useState(null);
  const [storageError, setStorageError] = useState(null);
  const [storageAvailable, setStorageAvailable] = useState(true); // assume OK until proven otherwise
  // Debounce refs — prevent concurrent/rapid storage writes that cause rate limit errors
  const persistTimer = useRef(null);
  const pendingJson = useRef(null);
  const [fxRates, setFxRates] = useState({ USD: DEFAULT_USDPHP, EUR: 70, GBP: 82, JPY: 0.42, SGD: 47, HKD: 7.9 });
  const [loaded, setLoaded] = useState(false);
  const [modal, setModal] = useState(null);
  const [forecastMonths, setForecastMonths] = useState(12);
  const [refreshing, setRefreshing] = useState(false);
  const [refreshMsg, setRefreshMsg] = useState(null);
  const [quickSpend, setQuickSpend] = useState(false);

  // Safe storage read — non-existent keys throw; this returns null instead.
  const storageGet = async (key) => {
    try { return await storage.get(key); } catch { return null; }
  };

  // Helper: read all valid backup slots, sorted newest first.
  const readAllBackups = async () => {
    try {
      const idxRaw = await storageGet(BACKUP_INDEX_KEY);
      if (!idxRaw || !idxRaw.value) return [];
      const idx = JSON.parse(idxRaw.value);
      const results = [];
      for (const entry of idx) {
        const slotRaw = await storageGet(BACKUP_PREFIX + entry.slot);
        if (slotRaw && slotRaw.value) {
          try {
            results.push({ slot: entry.slot, timestamp: entry.timestamp, data: JSON.parse(slotRaw.value) });
          } catch {}
        }
      }
      results.sort((a, b) => b.timestamp.localeCompare(a.timestamp));
      return results;
    } catch { return []; }
  };

  // Apply a data blob to state. Idempotently merges seed income/expenses by ID
  // so they always appear even when existing storage data is found.
  const applyDataBlob = (d) => {
    if (!d) return;
    setAssets(d.assets || []);
    const migHoldings = (d.holdings || []).map(h => ({ ...h, assetType: h.assetType || 'stock' }));
    setHoldings(migHoldings);
    setDebts(d.debts || []);
    // Income: merge seeds with stored, add seeds missing by ID
    const storedIncome = (d.income || []).map(i => ({ ...i, taxTreatment: i.taxTreatment || 'none' }));
    const storedIncomeIds = new Set(storedIncome.map(i => i.id));
    const missingIncome = SEED_INCOME.filter(s => !storedIncomeIds.has(s.id));
    setIncome([...storedIncome, ...missingIncome]);
    // Expenses: migrate essential flag, merge seeds missing by ID
    const DEFAULT_ESSENTIAL = { housing: true, food: true, transport: true, utilities: true, debt_payment: true, savings: true, subscriptions: false, personal: false, other: false };
    const storedExp = (d.expenses || []).map(e => ({ ...e, essential: e.essential !== undefined ? e.essential : (DEFAULT_ESSENTIAL[e.category] ?? false) }));
    const storedExpIds = new Set(storedExp.map(e => e.id));
    const missingExp = SEED_EXPENSES.filter(s => !storedExpIds.has(s.id));
    setExpenses([...storedExp, ...missingExp]);
    setSpending(d.spending || []);
    setGoals(d.goals || []);
    setEnvelopes(d.envelopes || {});
    setCustomLabels(d.customLabels || {});
    const storedCats = d.customCategories || [];
    const storedCatIds = new Set(storedCats.map(c => c.id));
    const missingCats = SEED_CUSTOM_CATEGORIES.filter(s => !storedCatIds.has(s.id));
    setCustomCategories([...storedCats, ...missingCats]);
    if (d.fxRates) setFxRates(d.fxRates);
  };

  // Load — READ ONLY, zero writes on boot to avoid rate limits / storage errors.
  useEffect(() => {
    (async () => {
      let found = false;
      // Try current key first
      const tryKeys = ['pw_pat_v3', 'pat9', 'patrimony_store_v8', 'patrimony_data'];
      for (const key of tryKeys) {
        if (found) break;
        const r = await storageGet(key);
        if (r && r.value) {
          try {
            const d = JSON.parse(r.value);
            if (d.assets?.length || d.holdings?.length || d.income?.length) {
              applyDataBlob(d);
              found = true;
            }
          } catch {}
        }
      }
      // Try backup slots if no main data found
      if (!found) {
        const backups = await readAllBackups();
        const useful = backups.find(b => b.data.assets?.length || b.data.holdings?.length || b.data.income?.length);
        if (useful) {
          setRecoveryOffer({
            data: useful.data,
            source: 'auto-backup',
            timestamp: useful.timestamp,
            itemCount: (useful.data.assets?.length || 0) + (useful.data.holdings?.length || 0) +
                       (useful.data.income?.length || 0) + (useful.data.spending?.length || 0),
          });
        }
      }
      // Default seeds if nothing found — applyDataBlob({}) runs the full merge
      // so ALL seed data loads: assets, holdings, income, expenses, custom categories
      if (!found) {
        applyDataBlob({});
      }
      // Load snapshots (read only)
      const snapR = await storageGet(SNAPSHOT_KEY);
      if (snapR && snapR.value) {
        try { setSnapshots(JSON.parse(snapR.value)); } catch {}
      }
      // Read backup timestamp for indicator (read only)
      const idxRaw = await storageGet(BACKUP_INDEX_KEY);
      if (idxRaw && idxRaw.value) {
        try {
          const idx = JSON.parse(idxRaw.value);
          const newest = [...idx].sort((a, b) => b.timestamp.localeCompare(a.timestamp))[0];
          if (newest) setLastBackupAt(newest.timestamp);
        } catch {}
      }
      setLoaded(true);
    })();
  }, []);

  // On fresh install, wipe ALL previous storage so no old data bleeds through
  useEffect(() => {
    (async () => {
      const installed = await storage.get(INSTALL_FLAG);
      if (!installed) {
        const { keys } = await storage.list('pw_');
        for (const k of keys) { try { await storage.delete(k); } catch {} }
        await storage.set(INSTALL_FLAG, '1');
      }
    })();
  }, []);

  const persist = (overrides = {}) => {
    const payload = {
      version: STORAGE_VERSION,
      assets, holdings, debts, income, expenses,
      spending, goals, envelopes, customLabels, customCategories, fxRates,
      ...overrides,
    };
    pendingJson.current = JSON.stringify(payload);
    setSaveToast('saved');
    setTimeout(() => setSaveToast(null), 1200);
    clearTimeout(persistTimer.current);
    persistTimer.current = setTimeout(async () => {
      const json = pendingJson.current;
      if (!json) return;
      try {
        await storage.set(STORAGE_KEY, json);
        // Backup 5s later
        setTimeout(() => { writeBackup(JSON.parse(json)).catch(() => {}); }, 5000);
      } catch (err) {
        console.error('Persist failed:', err);
        setSaveToast('error');
        setTimeout(() => setSaveToast(null), 4000);
      }
    }, 800);
  };

  // Write a backup snapshot to a ring-buffer slot.
  // Throttled to BACKUP_MIN_INTERVAL_MS so rapid edits don't hammer storage —
  // if the most recent backup is fresh, we update it in place instead of consuming a new slot.
  const writeBackup = async (payload) => {
    try {
      const idxRaw = await storageGet(BACKUP_INDEX_KEY);
      let idx = [];
      if (idxRaw && idxRaw.value) {
        try { idx = JSON.parse(idxRaw.value); } catch { idx = []; }
      }
      const now = new Date().toISOString();
      const nowMs = Date.parse(now);
      const newest = [...idx].sort((a, b) => b.timestamp.localeCompare(a.timestamp))[0];
      const recent = newest && (nowMs - Date.parse(newest.timestamp)) < BACKUP_MIN_INTERVAL_MS;
      let targetSlot;
      if (recent) {
        // Update the most recent slot in place to avoid churning the ring buffer
        targetSlot = newest.slot;
        idx = idx.map(e => e.slot === targetSlot ? { slot: targetSlot, timestamp: now } : e);
      } else {
        // Pick the next slot in the ring (lowest unused, or oldest if full)
        const usedSlots = new Set(idx.map(e => e.slot));
        let chosen = null;
        for (let i = 1; i <= BACKUP_MAX_SLOTS; i++) {
          if (!usedSlots.has(i)) { chosen = i; break; }
        }
        if (chosen === null) {
          // Ring is full — overwrite the oldest
          const oldest = [...idx].sort((a, b) => a.timestamp.localeCompare(b.timestamp))[0];
          chosen = oldest.slot;
          idx = idx.filter(e => e.slot !== chosen);
        }
        targetSlot = chosen;
        idx.push({ slot: targetSlot, timestamp: now });
      }
      await storage.set(BACKUP_PREFIX + targetSlot, JSON.stringify({ ...payload, _backupAt: now }));
      await storage.set(BACKUP_INDEX_KEY, JSON.stringify(idx));
      setLastBackupAt(now);
    } catch (err) { console.warn('writeBackup error:', err); }
  };

  const persistSnapshots = async (snaps) => {
    for (let i = 0; i < 2; i++) {
      try { await storage.set(SNAPSHOT_KEY, JSON.stringify(snaps)); return; }
      catch { if (i === 0) await new Promise(r => setTimeout(r, 2000)); }
    }
  };

  const upsert = (list, item) => item.id ? list.map(x => x.id === item.id ? item : x) : [...list, { ...item, id: uid() }];

  const saveAsset    = async (item) => { const next = upsert(assets, item); setAssets(next); await persist({ assets: next }); };
  const deleteAsset  = async (id)   => { const next = assets.filter(a => a.id !== id); setAssets(next); await persist({ assets: next }); };
  const saveHolding  = async (item) => {
    const payload = { ...item, lastUpdated: item.lastUpdated || new Date().toISOString() };
    const next = upsert(holdings, payload);
    setHoldings(next); await persist({ holdings: next });
  };
  const deleteHolding= async (id)   => { const next = holdings.filter(h => h.id !== id); setHoldings(next); await persist({ holdings: next }); };
  const saveDebt     = async (item) => { const next = upsert(debts, item); setDebts(next); await persist({ debts: next }); };
  const deleteDebt   = async (id)   => { const next = debts.filter(d => d.id !== id); setDebts(next); await persist({ debts: next }); };
  const saveIncome   = async (item) => { const next = upsert(income, item); setIncome(next); await persist({ income: next }); };
  const deleteIncome = async (id)   => { const next = income.filter(a => a.id !== id); setIncome(next); await persist({ income: next }); };
  const saveExpense  = async (item) => { const next = upsert(expenses, item); setExpenses(next); await persist({ expenses: next }); };
  const deleteExpense= async (id)   => { const next = expenses.filter(a => a.id !== id); setExpenses(next); await persist({ expenses: next }); };
  const saveSpend    = async (item) => { const next = upsert(spending, item); setSpending(next); await persist({ spending: next }); };
  const deleteSpend  = async (id)   => { const next = spending.filter(s => s.id !== id); setSpending(next); await persist({ spending: next }); };
  const saveGoal     = async (item) => { const next = upsert(goals, item); setGoals(next); await persist({ goals: next }); };
  const deleteGoal   = async (id)   => { const next = goals.filter(g => g.id !== id); setGoals(next); await persist({ goals: next }); };
  const saveEnvelopes= async (next) => { setEnvelopes(next); await persist({ envelopes: next }); };
  const saveFx       = async (next) => { setFxRates(next); await persist({ fxRates: next }); };
  const saveLabel    = async (scope, key, label) => {
    // Special scope used by Wealth tab when renaming a custom category inline.
    // The "label" param here is actually the full updated category object.
    if (scope === 'custom_rename' && label && typeof label === 'object') {
      const next = customCategories.map(c => c.id === key ? label : c);
      setCustomCategories(next);
      await persist({ customCategories: next });
      return;
    }
    const ck = `${scope}.${key}`;
    const next = { ...customLabels };
    if (label && label.trim()) next[ck] = label.trim();
    else delete next[ck]; // empty restores default
    setCustomLabels(next);
    await persist({ customLabels: next });
  };
  // Custom-category management.
  // saveCategory upserts; if it's new, it gets a stable id prefixed with "cat_" so we can distinguish from built-ins.
  const saveCategory = async (item) => {
    const payload = item.id ? item : { ...item, id: 'cat_' + uid() };
    const next = item.id
      ? customCategories.map(c => c.id === item.id ? payload : c)
      : [...customCategories, payload];
    setCustomCategories(next);
    await persist({ customCategories: next });
  };
  // deleteCategory: reassigns any assets in this category to 'other' before removing it,
  // so we never orphan asset data. The Wealth tab confirms with the user before calling this.
  const deleteCategory = async (categoryId) => {
    const reassignedAssets = assets.map(a => a.category === categoryId ? { ...a, category: 'other' } : a);
    const nextCustom = customCategories.filter(c => c.id !== categoryId);
    setAssets(reassignedAssets);
    setCustomCategories(nextCustom);
    await persist({ assets: reassignedAssets, customCategories: nextCustom });
  };

  // Refresh stock prices
  const refreshPrices = async () => {
    if (holdings.length === 0) return;
    setRefreshing(true);
    setRefreshMsg(null);

    const stockHoldings = holdings.filter(h => (h.assetType || 'stock') === 'stock');
    const cryptoHoldings = holdings.filter(h => h.assetType === 'crypto');
    const now = new Date().toISOString();
    let updated = [...holdings];
    let updatedCount = 0;
    const errors = [];

    // ── STOCKS via /api/prices (server-side proxy, no CORS issues) ────────────
    if (stockHoldings.length > 0) {
      const symbols = [...new Set(stockHoldings.map(h => h.ticker))].join(',');
      try {
        const res = await fetch(`/api/prices?type=stock&symbols=${symbols}&fxRate=${fxRates.USD}`);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const { prices, error } = await res.json();
        if (error) throw new Error(error);
        Object.entries(prices).forEach(([symbol, phpPrice]) => {
          updated = updated.map(h =>
            h.ticker === symbol ? { ...h, currentPrice: phpPrice, lastUpdated: now } : h
          );
          updatedCount++;
        });
      } catch (e) { errors.push(`Stocks: ${e.message}`); }
    }

    // ── CRYPTO via /api/prices ────────────────────────────────────────────────
    if (cryptoHoldings.length > 0) {
      const ID_MAP = {
        BTC: 'bitcoin', ETH: 'ethereum', SOL: 'solana', BNB: 'binancecoin',
        XRP: 'ripple', ADA: 'cardano', DOGE: 'dogecoin', MATIC: 'matic-network',
        DOT: 'polkadot', AVAX: 'avalanche-2', LINK: 'chainlink', UNI: 'uniswap',
        ATOM: 'cosmos', LTC: 'litecoin', BCH: 'bitcoin-cash',
      };
      const tickers = [...new Set(cryptoHoldings.map(h => h.ticker.toUpperCase()))];
      const ids = tickers.map(t => ID_MAP[t] || t.toLowerCase()).join(',');
      try {
        const res = await fetch(`/api/prices?type=crypto&ids=${ids}`);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const { prices, error } = await res.json();
        if (error) throw new Error(error);
        cryptoHoldings.forEach(h => {
          const id = ID_MAP[h.ticker.toUpperCase()] || h.ticker.toLowerCase();
          const phpPrice = prices[id];
          if (!phpPrice) return;
          updated = updated.map(h2 =>
            h2.id === h.id ? { ...h2, currentPrice: phpPrice, lastUpdated: now } : h2
          );
          updatedCount++;
        });
      } catch (e) { errors.push(`Crypto: ${e.message}`); }
    }

    setHoldings(updated);
    if (updatedCount > 0) await persist({ holdings: updated });

    const note = errors.length ? ` | Issues: ${errors.join('; ')}` : '';
    setRefreshMsg({
      tone: updatedCount > 0 ? 'good' : 'warn',
      text: updatedCount > 0
        ? `Live prices updated for ${updatedCount} holding${updatedCount === 1 ? '' : 's'}.${note}`
        : `No prices updated.${note} PH funds update manually.`,
    });
    setRefreshing(false);
    setTimeout(() => setRefreshMsg(null), 15000);
  };

  const exportData = () => {
    const blob = new Blob([JSON.stringify({
      version: STORAGE_VERSION, exportedAt: new Date().toISOString(),
      assets, holdings, debts, income, expenses, spending, goals, envelopes,
      customLabels, customCategories, fxRates, snapshots
    }, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `patrimony-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  // Build effective category map (built-ins + customs) once per change.
  // Used everywhere we need to look up a category by key — Wealth tab, totals, allocation pie, asset modal.
  const categoryMap = useMemo(() => buildCategoryMap(customCategories), [customCategories]);

  // ===== DERIVED =====
  const totals = useMemo(() => {
    const byCategory = {};
    // Initialize buckets for every category (built-in + custom) so missing categories show as zero
    // rather than undefined when computing percentages.
    Object.keys(categoryMap).forEach(k => byCategory[k] = 0);
    let totalCost = 0;
    assets.forEach(a => {
      const phpVal = toPHP(a.value, a.currency, fxRates);
      // Asset's category might be a deleted custom category id (rare; we reassign on delete).
      // Fall back to 'other' so totals don't get a stranded bucket.
      const cat = categoryMap[a.category] ? a.category : 'other';
      byCategory[cat] = (byCategory[cat] || 0) + phpVal;
      totalCost += toPHP(a.cost ?? a.value, a.currency, fxRates);
    });
    const stocksValue = holdings.reduce((s, h) => s + holdingValue(h), 0);
    const stocksCost = holdings.reduce((s, h) => s + holdingCost(h), 0);
    byCategory.stocks = stocksValue;
    totalCost += stocksCost;

    const grossAssets = Object.values(byCategory).reduce((s, v) => s + v, 0);
    const totalDebt = debts.reduce((s, d) => s + Number(d.balance || 0), 0);
    const monthlyDebtService = debts.reduce((s, d) => s + Number(d.monthlyPayment || 0), 0);
    const netWorth = grossAssets - totalDebt;
    const unrealizedGain = grossAssets - totalCost;
    const liquidCash = assets.filter(a => a.category === 'bank').reduce((s, a) => s + toPHP(a.value, a.currency, fxRates), 0);

    const monthlyIncomeGross = income.reduce((s, i) => s + toMonthlyGross(i), 0);
    const monthlyIncomeNet = income.reduce((s, i) => s + toMonthlyNet(i), 0);
    const monthlyDeductions = monthlyIncomeGross - monthlyIncomeNet;
    // monthlyIncome is the SPENDABLE/takehome — that's what flows into expenses, savings, forecast.
    // This is the right default since you can't spend what's been withheld for tax.
    const monthlyIncome = monthlyIncomeNet;
    const monthlyRecurringExpenses = expenses.reduce((s, e) => s + Number(e.amount || 0), 0);

    // Daily spending — current month
    const monthStart = startOfMonth(new Date());
    const thisMonthSpend = spending.filter(s => new Date(s.date) >= monthStart);
    const monthlyVariableSpending = thisMonthSpend.reduce((s, x) => s + Number(x.amount || 0), 0);
    const monthlyExpenses = monthlyRecurringExpenses + monthlyVariableSpending;
    const monthlyNet = monthlyIncome - monthlyExpenses;
    const savingsRate = monthlyIncome > 0 ? monthlyNet / monthlyIncome : 0;

    const incomeByType = {};
    Object.keys(INCOME_TYPES).forEach(k => incomeByType[k] = 0);
    income.forEach(i => { incomeByType[i.type] = (incomeByType[i.type] || 0) + toMonthlyNet(i); });

    const spendingByCategory = {};
    Object.keys(SPEND_CATEGORIES).forEach(k => spendingByCategory[k] = 0);
    expenses.forEach(e => { spendingByCategory[e.category] = (spendingByCategory[e.category] || 0) + Number(e.amount || 0); });
    thisMonthSpend.forEach(s => { spendingByCategory[s.category] = (spendingByCategory[s.category] || 0) + Number(s.amount || 0); });

    return {
      byCategory, grossAssets, totalDebt, netWorth, unrealizedGain, totalCost,
      liquidCash, stocksValue, stocksCost, monthlyDebtService,
      monthlyIncome, monthlyIncomeGross, monthlyIncomeNet, monthlyDeductions,
      monthlyExpenses, monthlyRecurringExpenses, monthlyVariableSpending,
      monthlyNet, savingsRate, incomeByType, spendingByCategory,
    };
  }, [assets, holdings, debts, income, expenses, spending, fxRates, categoryMap]);

  // Auto-snapshot once per day when net worth value is computed (and changes)
  useEffect(() => {
    if (!loaded) return;
    const today = todayISO();
    const last = snapshots[snapshots.length - 1];
    const snap = {
      date: today,
      netWorth: Math.round(totals.netWorth),
      grossAssets: Math.round(totals.grossAssets),
      totalDebt: Math.round(totals.totalDebt),
      liquidCash: Math.round(totals.liquidCash),
      stocksValue: Math.round(totals.stocksValue),
    };
    let next;
    if (!last) {
      next = [snap];
    } else if (last.date === today) {
      // Update today's snapshot in place
      next = [...snapshots.slice(0, -1), snap];
    } else {
      next = [...snapshots, snap];
    }
    // Only persist if changed — delay by 5s to avoid rate limiting on boot
    if (JSON.stringify(next) !== JSON.stringify(snapshots)) {
      setSnapshots(next);
      setTimeout(() => persistSnapshots(next), 5000);
    }
  }, [totals.netWorth, totals.grossAssets, totals.totalDebt, totals.liquidCash, totals.stocksValue, loaded]);

  const forecast = useMemo(() => {
    const data = [];
    for (let m = 0; m <= forecastMonths; m++) {
      data.push({
        month: m,
        label: m === 0 ? 'Now' : `M${m}`,
        cash: Math.round(totals.liquidCash + totals.monthlyNet * m),
        netWorth: Math.round(totals.netWorth + totals.monthlyNet * m)
      });
    }
    return data;
  }, [totals, forecastMonths]);

  const milestones = useMemo(() => {
    if (totals.monthlyNet <= 0) return [];
    const targets = [100_000, 500_000, 1_000_000, 5_000_000, 10_000_000];
    return targets
      .filter(t => t > totals.liquidCash)
      .map(t => ({ target: t, months: Math.ceil((t - totals.liquidCash) / totals.monthlyNet) }))
      .filter(m => m.months <= 600).slice(0, 3);
  }, [totals]);

  const insights = useMemo(() => {
    const out = [];
    if (totals.monthlyNet < 0) {
      out.push({ tone: 'warn', title: 'Cash flow negative this month',
        body: `Spending ${fmt(Math.abs(totals.monthlyNet))} more than earning. Variable spending alone is ${fmt(totals.monthlyVariableSpending)}.` });
    } else if (totals.savingsRate < 0.1 && totals.monthlyIncome > 0) {
      out.push({ tone: 'warn', title: `Savings rate ${(totals.savingsRate * 100).toFixed(0)}%`,
        body: `Below the 10% baseline. Daily spending may be the lever — review the spending tab.` });
    } else if (totals.savingsRate >= 0.2 && totals.monthlyIncome > 0) {
      out.push({ tone: 'good', title: `${(totals.savingsRate * 100).toFixed(0)}% savings rate`,
        body: `Strong. Surplus is best deployed via index funds, dividend stocks, or topping up savings goals.` });
    }
    if (totals.totalDebt > 0 && totals.netWorth > 0) {
      const debtRatio = totals.totalDebt / totals.grossAssets;
      if (debtRatio > 0.4) {
        out.push({ tone: 'warn', title: 'High debt-to-assets ratio',
          body: `Debt is ${(debtRatio * 100).toFixed(0)}% of gross assets. Reducing high-rate debt usually beats market returns.` });
      }
    }
    if (totals.monthlyDebtService > 0 && totals.monthlyIncome > 0) {
      const dti = totals.monthlyDebtService / totals.monthlyIncome;
      if (dti > 0.36) {
        out.push({ tone: 'warn', title: `DTI is ${(dti * 100).toFixed(0)}%`,
          body: `Debt service over 36% of income — refinancing or aggressive paydown helps.` });
      }
    }
    // Envelope breaches
    Object.entries(envelopes).forEach(([catKey, cap]) => {
      const spent = totals.spendingByCategory[catKey] || 0;
      const label = customLabels[`spend.${catKey}`] || SPEND_CATEGORIES[catKey]?.label || catKey;
      if (cap > 0 && spent > cap) {
        out.push({ tone: 'warn', title: `Over budget: ${label}`,
          body: `Spent ${fmt(spent)} of a ${fmt(cap)} cap (${((spent / cap) * 100).toFixed(0)}%). Pace adjustment needed.` });
      } else if (cap > 0 && spent / cap > 0.85) {
        out.push({ tone: 'note', title: `Approaching cap: ${label}`,
          body: `${((spent / cap) * 100).toFixed(0)}% used (${fmt(spent)} of ${fmt(cap)}).` });
      }
    });
    // Goals behind pace
    goals.forEach(g => {
      const today = new Date();
      const target = new Date(g.targetDate);
      if (target < today) return;
      const totalDays = daysBetween(g.startDate || g.createdAt || today, g.targetDate);
      const elapsed = daysBetween(g.startDate || g.createdAt || today, today);
      const expectedProgress = totalDays > 0 ? (elapsed / totalDays) * Number(g.targetAmount) : 0;
      const actualProgress = Number(g.currentAmount || 0);
      const behind = expectedProgress - actualProgress;
      if (behind > 0 && behind / Number(g.targetAmount) > 0.1) {
        out.push({ tone: 'note', title: `${g.name} is behind pace`,
          body: `${fmt(behind)} short of where you'd expect. Need ${fmt((Number(g.targetAmount) - actualProgress) / Math.max(1, Math.ceil(daysBetween(today, g.targetDate) / 30)))}/mo to catch up.` });
      }
    });

    if (totals.incomeByType.dividend > 0) {
      out.push({ tone: 'good', title: 'Dividends working for you',
        body: `${fmt(totals.incomeByType.dividend)}/mo passive — ${fmt(totals.incomeByType.dividend * 12)}/yr.` });
    }
    if (holdings.length > 0) {
      const stockPL = totals.stocksValue - totals.stocksCost;
      const offSystem = holdings.filter(h => h.tag === 'offsystem');
      if (offSystem.length > 0) {
        const offValue = offSystem.reduce((s, h) => s + holdingValue(h), 0);
        out.push({ tone: 'note', title: `${offSystem.length} off-system position${offSystem.length === 1 ? '' : 's'}`,
          body: `${fmt(offValue)} sits in trades flagged off-system. Position size discipline.` });
      }
      if (stockPL !== 0 && totals.stocksCost > 0) {
        const stockPLPct = (stockPL / totals.stocksCost) * 100;
        out.push({ tone: stockPL >= 0 ? 'good' : 'note',
          title: `Stocks ${stockPL >= 0 ? 'up' : 'down'} ${Math.abs(stockPLPct).toFixed(1)}%`,
          body: `${holdings.length} positions. Unrealized: ${fmtSign(stockPL)}.` });
      }
    }
    return out;
  }, [totals, holdings, envelopes, goals, customLabels]);

  if (!loaded) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: T.bg }}>
        <div style={{ color: T.textDim }}>Loading Patrimony…</div>
      </div>
    );
  }

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght@9..144,300;9..144,400;9..144,500&family=Inter:wght@300;400;500;600;700&family=DM+Mono:wght@400;500&display=swap');
        * { font-family: 'Inter', system-ui, -apple-system, sans-serif; }
        .font-display { font-family: 'Fraunces', 'Iowan Old Style', Georgia, serif; font-weight: 400; letter-spacing: -0.015em; }
        .num { font-family: 'DM Mono', ui-monospace, monospace; font-feature-settings: 'tnum'; }
        .grain { background-image: radial-gradient(circle at 1px 1px, rgba(255,255,255,0.018) 1px, transparent 0); background-size: 4px 4px; }
        .fade-in { animation: fadeIn 0.4s ease-out; }
        @keyframes fadeIn { from { opacity: 0; transform: translateY(4px); } to { opacity: 1; transform: translateY(0); } }
        .gold-stripe { background: linear-gradient(90deg, transparent 0%, ${T.accent} 30%, ${T.accentBright} 50%, ${T.accent} 70%, transparent 100%); height: 1px; opacity: 0.6; }
        .spin { animation: spin 1s linear infinite; }
        @keyframes spin { to { transform: rotate(360deg); } }
        ::selection { background: ${T.accent}; color: ${T.bg}; }
        .scrollbar-thin::-webkit-scrollbar { height: 8px; width: 8px; }
        .scrollbar-thin::-webkit-scrollbar-thumb { background: ${T.border2}; border-radius: 4px; }
        .scrollbar-thin::-webkit-scrollbar-track { background: ${T.surface}; }
        button, input, select, textarea { font-family: inherit; }
        .fab { box-shadow: 0 8px 24px rgba(0, 200, 150, 0.35), 0 0 0 1px rgba(0, 200, 150, 0.5); }
      `}</style>

      <div className="min-h-screen pb-24 grain" style={{ background: T.bg, color: T.text }}>
        {/* RECOVERY OFFER — appears when load detected backup data but main storage was empty.
            Critical UX: never silently auto-restore (could blow away a deliberate fresh start).
            Always ask, and explain what was found. */}
        {recoveryOffer && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4"
            style={{ background: 'rgba(15, 14, 12, 0.92)', backdropFilter: 'blur(6px)' }}>
            <div className="rounded-2xl w-full max-w-md p-6 fade-in"
              style={{ background: T.surface, border: `1px solid ${T.accent}` }}>
              <div className="flex items-center gap-3 mb-4">
                <div className="w-12 h-12 rounded-full flex items-center justify-center" style={{ background: 'rgba(0, 200, 150,0.15)', color: T.accent }}>
                  <Save className="w-6 h-6" />
                </div>
                <div>
                  <h3 className="font-display text-2xl" style={{ color: T.accent }}>Previous data found</h3>
                  <p className="text-xs" style={{ color: T.textFaint }}>From {ago(recoveryOffer.timestamp)}</p>
                </div>
              </div>
              <p className="text-sm mb-2" style={{ color: T.text }}>
                A previous version of Patrimony saved an automatic backup containing <strong>{recoveryOffer.itemCount}</strong> {recoveryOffer.itemCount === 1 ? 'item' : 'items'} (assets, holdings, income, spending). Restore it now?
              </p>
              <p className="text-xs mb-5 italic" style={{ color: T.textFaint }}>
                If you decline, Patrimony starts with seed data and your backup stays safe in storage — you can restore it later from the header button.
              </p>
              <div className="flex gap-2">
                <button onClick={() => setRecoveryOffer(null)} className="flex-1 py-2.5 rounded-full text-sm hover:bg-white/5"
                  style={{ border: `1px solid ${T.border2}`, color: T.text }}>
                  Start fresh
                </button>
                <button onClick={async () => {
                  applyDataBlob(recoveryOffer.data);
                  // Persist immediately so this becomes the new main storage
                  await persist({
                    assets: recoveryOffer.data.assets || [],
                    holdings: (recoveryOffer.data.holdings || []).map(h => ({ ...h, assetType: h.assetType || 'stock' })),
                    debts: recoveryOffer.data.debts || [],
                    income: (recoveryOffer.data.income || []).map(i => ({ ...i, taxTreatment: i.taxTreatment || 'none' })),
                    expenses: recoveryOffer.data.expenses || [],
                    spending: recoveryOffer.data.spending || [],
                    goals: recoveryOffer.data.goals || [],
                    envelopes: recoveryOffer.data.envelopes || {},
                    customLabels: recoveryOffer.data.customLabels || {},
                    customCategories: recoveryOffer.data.customCategories || [],
                    fxRates: recoveryOffer.data.fxRates || fxRates,
                  });
                  setRecoveryOffer(null);
                }} className="flex-1 py-2.5 rounded-full text-sm transition-all"
                  style={{ background: T.accent, color: T.bg, fontWeight: 500 }}>
                  Restore
                </button>
              </div>
            </div>
          </div>
        )}

        {/* SAVE TOAST */}
        {saveToast && (
          <div className="fixed top-4 right-4 z-50 px-4 py-2.5 rounded-xl text-sm font-medium flex items-center gap-2 fade-in"
            style={{
              background: saveToast === 'saved' ? T.greenBg : saveToast === 'memory' ? 'rgba(0, 200, 150,0.15)' : T.redBg,
              color: saveToast === 'saved' ? T.green : saveToast === 'memory' ? T.accent : T.red,
              border: `1px solid ${saveToast === 'saved' ? T.green : saveToast === 'memory' ? T.accent : T.red}`,
            }}>
            {saveToast === 'saved' ? <Sparkles className="w-4 h-4" /> : <AlertCircle className="w-4 h-4" />}
            {saveToast === 'saved' ? 'Saved' : saveToast === 'memory' ? 'In memory only' : 'Save failed!'}
          </div>
        )}

        {/* PERSISTENT STORAGE ERROR BANNER */}
        {storageError && (
          <div className="px-4 py-3 text-sm flex items-center gap-3"
            style={{ background: 'rgba(0, 200, 150,0.12)', color: T.accent, borderBottom: `1px solid ${T.accent}` }}>
            <AlertCircle className="w-4 h-4 shrink-0" />
            <div className="flex-1">Auto-save unavailable this session. Your data is safe while the app is open.</div>
            <button onClick={exportData}
              className="px-3 py-1.5 rounded-full text-xs font-medium whitespace-nowrap"
              style={{ background: T.accent, color: T.bg }}>
              <Save className="w-3 h-3 inline mr-1" />Backup now
            </button>
            <button onClick={() => setStorageError(null)} className="p-1"><X className="w-4 h-4" /></button>
          </div>
        )}

        {/* HEADER */}
        <header className="px-6 md:px-10 pt-8 pb-6" style={{ borderBottom: `1px solid ${T.border}` }}>
          <div className="max-w-6xl mx-auto">
            <div className="flex items-baseline justify-between flex-wrap gap-4">
              <div>
                <div className="flex items-center gap-2 text-xs uppercase tracking-[0.25em] mb-2" style={{ color: T.textFaint }}>
                  <span className="w-6 h-px" style={{ background: T.border2 }}></span>
                  Personal Wealth Ledger
                </div>
                <h1 className="font-display text-4xl md:text-5xl">
                  <span style={{ color: T.accent }}>Patrimony</span>{' '}
                  <span className="italic" style={{ color: T.textFaint, fontSize: '0.6em', verticalAlign: 'middle' }}>v9</span>
                </h1>
                <div className="flex items-center gap-2 mt-3">
                  <button onClick={exportData} className="px-2.5 py-1 rounded-full text-xs flex items-center gap-1.5 hover:bg-white/5"
                    style={{ border: `1px solid ${T.border2}`, color: T.textDim }} title="Save all data to a JSON file">
                    <Save className="w-3 h-3" /> Backup
                  </button>
                  <label className="px-2.5 py-1 rounded-full text-xs flex items-center gap-1.5 hover:bg-white/5 cursor-pointer"
                    style={{ border: `1px solid ${T.border2}`, color: T.textDim }} title="Restore from a previous backup">
                    <Upload className="w-3 h-3" /> Restore
                    <input type="file" accept=".json,application/json" className="hidden"
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (!file) return;
                        const reader = new FileReader();
                        reader.onload = async (ev) => {
                          try {
                            const d = JSON.parse(ev.target.result);
                            // Sanity check: must look like Patrimony backup
                            if (!d.version || (!d.assets && !d.holdings && !d.income)) {
                              alert('This file does not look like a Patrimony backup.');
                              return;
                            }
                            const itemCount = (d.assets?.length || 0) + (d.holdings?.length || 0) + (d.income?.length || 0) + (d.spending?.length || 0);
                            if (!window.confirm(`Restore from this backup? It contains ${itemCount} items and will replace everything currently in Patrimony.`)) {
                              return;
                            }
                            // Replace state from backup
                            applyDataBlob(d);
                            // Save main data first, snapshots later
                            await persist({
                              assets: d.assets || [],
                              holdings: (d.holdings || []).map(h => ({ ...h, assetType: h.assetType || 'stock' })),
                              debts: d.debts || [],
                              income: (d.income || []).map(i => ({ ...i, taxTreatment: i.taxTreatment || 'none' })),
                              expenses: d.expenses || [],
                              spending: d.spending || [],
                              goals: d.goals || [],
                              envelopes: d.envelopes || {},
                              customLabels: d.customLabels || {},
                              customCategories: d.customCategories || [],
                              fxRates: d.fxRates || fxRates,
                            });
                            // Snapshots saved after a delay to avoid rate limit
                            if (d.snapshots) {
                              setSnapshots(d.snapshots);
                              setTimeout(() => persistSnapshots(d.snapshots), 3000);
                            }
                          } catch (err) { alert('Could not parse backup file: ' + err.message); }
                          finally { e.target.value = ''; }
                        };
                        reader.readAsText(file);
                      }} />
                  </label>
                  {/* Auto-backup indicator: tiny pulse + relative time. Confirms the safety net is running. */}
                  {lastBackupAt && (
                    <span className="text-xs flex items-center gap-1.5" style={{ color: T.textFaint }} title={`Auto-backup at ${new Date(lastBackupAt).toLocaleString()}`}>
                      <span className="w-1.5 h-1.5 rounded-full" style={{ background: T.green }}></span>
                      auto-saved {ago(lastBackupAt)}
                    </span>
                  )}
                </div>
              </div>
              <div className="text-right">
                <div className="text-xs uppercase tracking-widest mb-1" style={{ color: T.textFaint }}>Net Worth</div>
                <div className="font-display text-5xl md:text-6xl num" style={{ letterSpacing: '-0.03em' }}>{fmt(totals.netWorth)}</div>
                <div className="text-sm mt-1 num flex items-center justify-end gap-3" style={{ color: T.textDim }}>
                  {totals.totalDebt > 0 && <span style={{ color: T.red }}>−{fmtK(totals.totalDebt)} debt</span>}
                  {totals.unrealizedGain !== 0 && (
                    <span style={{ color: totals.unrealizedGain >= 0 ? T.green : T.red }}>
                      {totals.unrealizedGain >= 0 ? '↑' : '↓'} {fmtK(Math.abs(totals.unrealizedGain))}
                    </span>
                  )}
                  {totals.monthlyNet !== 0 && (
                    <span style={{ color: totals.monthlyNet >= 0 ? T.green : T.red }}>
                      {totals.monthlyNet >= 0 ? '+' : ''}{fmtK(totals.monthlyNet)}/mo
                    </span>
                  )}
                </div>
              </div>
            </div>
            <div className="gold-stripe mt-6"></div>
          </div>
        </header>

        {/* TABS */}
        <nav className="px-6 md:px-10 sticky top-0 z-20 backdrop-blur"
          style={{ borderBottom: `1px solid ${T.border}`, background: T.bg + 'd9' }}>
          <div className="max-w-6xl mx-auto flex gap-1.5 overflow-x-auto scrollbar-thin py-2.5">
            {[
              { id: 'overview',  label: 'Overview',  Icon: LayoutDashboard },
              { id: 'wealth',    label: 'Wealth',    Icon: Briefcase },
              { id: 'stocks',    label: 'Investments', Icon: CandlestickChart },
              { id: 'spending',  label: 'Spending',  Icon: WalletIcon },
              { id: 'budget',    label: 'Budget',    Icon: Calculator },
              { id: 'goals',     label: 'Goals',     Icon: Flag },
              { id: 'debts',     label: 'Debts',     Icon: CreditCard },
              { id: 'cashflow',  label: 'Cash Flow', Icon: BarChart3 },
              { id: 'forecast',  label: 'Forecast',  Icon: LineIcon },
              { id: 'history',   label: 'History',   Icon: History },
              { id: 'tax',       label: 'Tax',       Icon: FileText },
              { id: 'insights',  label: 'Insights',  Icon: Lightbulb }
            ].map(t => (
              <button key={t.id} onClick={() => setView(t.id)}
                className="text-sm transition-all flex items-center gap-2 whitespace-nowrap"
                style={{
                  background: view === t.id ? T.accent : 'transparent',
                  color: view === t.id ? T.bg : T.textDim,
                  fontWeight: view === t.id ? 600 : 400,
                  borderRadius: '999px',
                  padding: '6px 16px'
                }}>
                <t.Icon className="w-4 h-4" /> {t.label}
              </button>
            ))}
          </div>
        </nav>

        <main className="max-w-6xl mx-auto px-6 md:px-10 pt-8">
          {view === 'overview' && (
            <Overview totals={totals} forecast={forecast} insights={insights} milestones={milestones}
              holdings={holdings} debts={debts} spending={spending} goals={goals} snapshots={snapshots}
              customLabels={customLabels} categoryMap={categoryMap} setView={setView} />
          )}
          {view === 'wealth' && (
            <Wealth assets={assets} totals={totals} fxRates={fxRates} customLabels={customLabels}
              customCategories={customCategories} categoryMap={categoryMap}
              onAdd={() => setModal({ kind: 'asset' })}
              onEdit={(a) => setModal({ kind: 'asset', editing: a })}
              onDelete={deleteAsset}
              onEditFx={() => setModal({ kind: 'fx' })}
              onAddCategory={() => setModal({ kind: 'category' })}
              onEditCategory={(c) => setModal({ kind: 'category', editing: c })}
              onDeleteCategory={deleteCategory}
              onSaveLabel={saveLabel} />
          )}
          {view === 'stocks' && (
            <Stocks holdings={holdings} totals={totals} refreshing={refreshing} refreshMsg={refreshMsg}
              onAdd={() => setModal({ kind: 'holding' })}
              onEdit={(h) => setModal({ kind: 'holding', editing: h })}
              onDelete={deleteHolding}
              onRefresh={refreshPrices} onExport={exportData}
              onImport={() => setModal({ kind: 'import' })} />
          )}
          {view === 'spending' && (
            <Spending spending={spending} totals={totals} envelopes={envelopes} customLabels={customLabels}
              onAdd={() => setModal({ kind: 'spend' })}
              onEdit={(s) => setModal({ kind: 'spend', editing: s })}
              onDelete={deleteSpend}
              onSaveLabel={saveLabel} />
          )}
          {view === 'budget' && (
            <Budget envelopes={envelopes} totals={totals} expenses={expenses} customLabels={customLabels}
              onSave={saveEnvelopes} onSaveLabel={saveLabel} />
          )}
          {view === 'goals' && (
            <Goals goals={goals} assets={assets} fxRates={fxRates}
              onAdd={() => setModal({ kind: 'goal' })}
              onEdit={(g) => setModal({ kind: 'goal', editing: g })}
              onDelete={deleteGoal} />
          )}
          {view === 'debts' && (
            <Debts debts={debts} totals={totals} customLabels={customLabels}
              onAdd={() => setModal({ kind: 'debt' })}
              onEdit={(d) => setModal({ kind: 'debt', editing: d })}
              onDelete={deleteDebt}
              onSaveLabel={saveLabel} />
          )}
          {view === 'cashflow' && (
            <CashFlow income={income} expenses={expenses} totals={totals} customLabels={customLabels}
              onAddIncome={() => setModal({ kind: 'income' })}
              onEditIncome={(i) => setModal({ kind: 'income', editing: i })}
              onDeleteIncome={deleteIncome}
              onAddExpense={() => setModal({ kind: 'expense' })}
              onEditExpense={(e) => setModal({ kind: 'expense', editing: e })}
              onDeleteExpense={deleteExpense}
              onSaveLabel={saveLabel} />
          )}
          {view === 'forecast' && (
            <Forecast totals={totals} forecast={forecast} months={forecastMonths}
              setMonths={setForecastMonths} milestones={milestones}
              expenses={expenses} income={income} />
          )}
          {view === 'history' && (
            <HistoryView snapshots={snapshots} totals={totals} />
          )}
          {view === 'tax' && (
            <TaxView income={income} totals={totals} holdings={holdings} />
          )}
          {view === 'insights' && (
            <Insights insights={insights} totals={totals} />
          )}
        </main>

        {/* Floating Quick Spend */}
        {!modal && (
          <button onClick={() => setModal({ kind: 'spend' })}
            className="fixed bottom-6 right-6 z-30 fab w-14 h-14 rounded-full flex items-center justify-center hover:scale-105 transition-transform"
            style={{ background: T.accent, color: T.bg }}>
            <Plus className="w-6 h-6" strokeWidth={2.5} />
          </button>
        )}

        {modal && (
          <Modal kind={modal.kind} editing={modal.editing} onClose={() => setModal(null)}
            fxRates={fxRates} onSaveFx={saveFx} assets={assets} customLabels={customLabels}
            categoryMap={categoryMap}
            onSave={async (item) => {
              if (modal.kind === 'asset')    await saveAsset(item);
              if (modal.kind === 'holding')  await saveHolding(item);
              if (modal.kind === 'debt')     await saveDebt(item);
              if (modal.kind === 'income')   await saveIncome(item);
              if (modal.kind === 'expense')  await saveExpense(item);
              if (modal.kind === 'spend')    await saveSpend(item);
              if (modal.kind === 'goal')     await saveGoal(item);
              if (modal.kind === 'category') await saveCategory(item);
              setModal(null);
            }}
            onImport={modal.kind === 'import' ? (incoming) => {
              const next = [...holdings, ...incoming];
              setHoldings(next);
              persist({ holdings: next });
              setModal(null);
              setRefreshMsg({ tone: 'good', text: `Imported ${incoming.length} holding${incoming.length === 1 ? '' : 's'}.` });
              setTimeout(() => setRefreshMsg(null), 5000);
            } : null} />
        )}
      </div>
    </>
  );
}

// ===== OVERVIEW =====
function Overview({ totals, forecast, insights, milestones, holdings, spending, goals, snapshots, categoryMap, setView }) {
  const allocationData = Object.entries(totals.byCategory)
    .filter(([, v]) => v > 0)
    .map(([k, v]) => ({
      name: k === 'stocks' ? 'Investments' : categoryMap[k]?.short || k,
      value: v,
      color: k === 'stocks' ? T.purple : (categoryMap[k]?.color || T.textDim),
      key: k
    }));
  const stockPL = totals.stocksValue - totals.stocksCost;
  const today = todayISO();
  const todaySpending = spending.filter(s => s.date === today).reduce((sum, s) => sum + Number(s.amount || 0), 0);
  const recentSnaps = snapshots.slice(-30);
  const nwTrend = recentSnaps.length >= 2 ? recentSnaps[recentSnaps.length - 1].netWorth - recentSnaps[0].netWorth : 0;

  return (
    <div className="fade-in space-y-6">

      {/* 1. HERO — net worth + spark line */}
      <div className="grid md:grid-cols-3 gap-4 items-start">
        <div className="md:col-span-2" style={{ background: T.surface, borderRadius: 16, padding: '28px 32px', boxShadow: '0 2px 12px rgba(0,0,0,0.4)', border: `1px solid ${T.border}` }}>
          <div className="text-xs uppercase tracking-widest mb-2" style={{ color: T.textFaint }}>Net Worth</div>
          <div className="font-display num" style={{ fontSize: 'clamp(2.5rem,6vw,4rem)', letterSpacing: '-0.03em', color: T.text, lineHeight: 1 }}>
            {fmt(totals.netWorth)}
          </div>
          <div className="flex items-center gap-3 mt-3">
            {recentSnaps.length >= 2 && (
              <span className="text-sm num font-medium" style={{ color: nwTrend >= 0 ? T.green : T.red }}>
                {nwTrend >= 0 ? '↑' : '↓'} {fmtK(Math.abs(nwTrend))}
                {recentSnaps[0]?.netWorth > 0 && (
                  <span className="ml-1.5 text-xs font-normal" style={{ color: T.textFaint }}>
                    ({((nwTrend / recentSnaps[0].netWorth) * 100).toFixed(1)}% · {recentSnaps.length}d)
                  </span>
                )}
              </span>
            )}
            <button onClick={() => setView('history')} className="text-xs flex items-center gap-1 hover:gap-2 transition-all" style={{ color: T.accent }}>
              Full history <ArrowRight className="w-3 h-3" />
            </button>
          </div>
          {recentSnaps.length >= 3 && (
            <div className="h-16 mt-4 -mx-2">
              <ResponsiveContainer>
                <AreaChart data={recentSnaps} margin={{ top: 4, right: 4, bottom: 0, left: 4 }}>
                  <defs>
                    <linearGradient id="heroGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor={T.accent} stopOpacity={0.25} />
                      <stop offset="100%" stopColor={T.accent} stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <Area type="monotone" dataKey="netWorth" stroke={T.accent} strokeWidth={2} fill="url(#heroGrad)" dot={false} />
                  <Tooltip contentStyle={{ background: T.surface2, border: `1px solid ${T.border2}`, borderRadius: 8, fontSize: 11, color: T.text }} formatter={(v) => fmt(v)} labelStyle={{ color: T.textFaint }} />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>
        <div style={{ background: T.surface, borderRadius: 16, padding: '28px 24px', boxShadow: '0 2px 12px rgba(0,0,0,0.4)', border: `1px solid ${T.border}` }}>
          <div className="text-xs uppercase tracking-widest mb-2" style={{ color: T.textFaint }}>Today's Spending</div>
          <div className="font-display num text-3xl" style={{ letterSpacing: '-0.02em', color: todaySpending > 0 ? T.red : T.textDim }}>{fmt(todaySpending)}</div>
          <div className="text-xs mt-1.5" style={{ color: T.textFaint }}>{spending.filter(s => s.date === today).length} transactions today</div>
          <div className="mt-4 pt-4" style={{ borderTop: `1px solid ${T.border}` }}>
            <div className="text-xs uppercase tracking-widest mb-1" style={{ color: T.textFaint }}>Liquid Cash</div>
            <div className="text-xl num font-medium" style={{ color: T.text }}>{fmtK(totals.liquidCash)}</div>
            <div className="text-xs mt-0.5" style={{ color: T.textFaint }}>
              {totals.grossAssets > 0 ? Math.round((totals.liquidCash / totals.grossAssets) * 100) : 0}% of gross assets
            </div>
          </div>
        </div>
      </div>

      {/* 2. THREE STAT CARDS */}
      <div className="grid grid-cols-3 gap-4">
        {[
          { label: 'Total Assets',      value: totals.grossAssets, color: T.green,  sub: `${Object.values(totals.byCategory).filter(v => v > 0).length} categories` },
          { label: 'Total Liabilities', value: totals.totalDebt,   color: T.red,    sub: totals.monthlyDebtService > 0 ? `${fmtK(totals.monthlyDebtService)}/mo service` : 'No debt' },
          { label: 'Net Cash Flow',     value: totals.monthlyNet,  color: totals.monthlyNet >= 0 ? T.green : T.red, sub: `${(totals.savingsRate * 100).toFixed(0)}% savings rate` },
        ].map(({ label, value, color, sub }) => (
          <div key={label} style={{ background: T.surface, borderRadius: 16, padding: '20px 24px', boxShadow: '0 2px 12px rgba(0,0,0,0.4)', border: `1px solid ${T.border}` }}>
            <div className="text-xs uppercase tracking-widest mb-2" style={{ color: T.textFaint }}>{label}</div>
            <div className="font-display num text-2xl md:text-3xl" style={{ letterSpacing: '-0.02em', color }}>{fmtK(value)}</div>
            <div className="text-xs mt-1.5" style={{ color: T.textFaint }}>{sub}</div>
          </div>
        ))}
      </div>

      {/* 3. WEALTH BREAKDOWN DONUT + 4. ACCOUNTS LIST */}
      <div className="grid md:grid-cols-2 gap-4">
        <Card>
          <CardHeader title="Wealth Breakdown" subtitle="Assets vs liabilities" />
          {(totals.grossAssets + totals.totalDebt) === 0 ? (
            <EmptyTile text="No assets or liabilities yet." actionLabel="Add an asset" onAction={() => setView('wealth')} />
          ) : (
            <div className="flex items-center gap-6 mt-4">
              <div className="w-36 h-36 shrink-0 relative">
                <ResponsiveContainer>
                  <RPie>
                    <Pie
                      data={[
                        { name: 'Assets',      value: totals.grossAssets },
                        { name: 'Liabilities', value: totals.totalDebt || 0.001 },
                      ]}
                      dataKey="value" innerRadius={44} outerRadius={68} paddingAngle={3} stroke="none"
                    >
                      <Cell fill={T.accent} />
                      <Cell fill={T.purple} />
                    </Pie>
                  </RPie>
                </ResponsiveContainer>
                <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                  <div className="text-[10px] uppercase tracking-wider" style={{ color: T.textFaint }}>Net</div>
                  <div className="text-sm num font-semibold" style={{ color: T.text }}>{fmtK(totals.netWorth)}</div>
                </div>
              </div>
              <div className="flex-1 space-y-4">
                {[
                  { name: 'Assets',      value: totals.grossAssets, color: T.accent,
                    pct: (totals.grossAssets + totals.totalDebt) > 0 ? (totals.grossAssets / (totals.grossAssets + totals.totalDebt)) * 100 : 100 },
                  { name: 'Liabilities', value: totals.totalDebt,   color: T.purple,
                    pct: (totals.grossAssets + totals.totalDebt) > 0 ? (totals.totalDebt / (totals.grossAssets + totals.totalDebt)) * 100 : 0 },
                ].map(d => (
                  <div key={d.name}>
                    <div className="flex items-center justify-between mb-1.5">
                      <div className="flex items-center gap-2">
                        <span className="w-2 h-2 rounded-full shrink-0" style={{ background: d.color }}></span>
                        <span className="text-sm" style={{ color: T.text }}>{d.name}</span>
                      </div>
                      <div className="text-right">
                        <span className="text-sm num font-medium" style={{ color: d.color }}>{fmtK(d.value)}</span>
                        <span className="text-xs num ml-2" style={{ color: T.textFaint }}>{d.pct.toFixed(1)}%</span>
                      </div>
                    </div>
                    <div className="h-1.5 rounded-full" style={{ background: T.surface3 }}>
                      <div className="h-1.5 rounded-full transition-all" style={{ width: `${d.pct}%`, background: d.color }}></div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </Card>

        {/* 4. ACCOUNTS LIST */}
        <Card>
          <div className="flex items-baseline justify-between mb-4">
            <CardHeader title="Asset Accounts" subtitle={`${allocationData.length} categories`} inline />
            <button onClick={() => setView('wealth')} className="text-sm flex items-center gap-1 hover:gap-2 transition-all" style={{ color: T.accent }}>
              Manage <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>
          {allocationData.length === 0 ? (
            <EmptyTile text="No assets yet." actionLabel="Add an asset" onAction={() => setView('wealth')} />
          ) : (
            <div className="space-y-0.5">
              {allocationData.map(d => {
                const pct = totals.grossAssets > 0 ? (d.value / totals.grossAssets) * 100 : 0;
                const CatIcon = categoryMap[d.key]?.icon || Coins;
                return (
                  <button key={d.key} onClick={() => setView('wealth')}
                    className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl hover:bg-white/5 transition-colors text-left">
                    <div className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0"
                      style={{ background: categoryMap[d.key]?.tint || T.surface2 }}>
                      <CatIcon className="w-4 h-4" style={{ color: d.color }} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-medium truncate" style={{ color: T.text }}>{d.name}</div>
                      <div className="text-xs" style={{ color: T.textFaint }}>{pct.toFixed(1)}% of assets</div>
                    </div>
                    <div className="text-sm num font-medium" style={{ color: T.text }}>{fmtK(d.value)}</div>
                    <ChevronRight className="w-4 h-4 shrink-0" style={{ color: T.textFaint }} />
                  </button>
                );
              })}
            </div>
          )}
        </Card>
      </div>

      {/* 5. MONTHLY CASH FLOW BAR */}
      <Card>
        <div className="flex items-baseline justify-between mb-5">
          <CardHeader title="Monthly Cash Flow" subtitle="Income vs expenses this month" inline />
          <button onClick={() => setView('cashflow')} className="text-sm flex items-center gap-1 hover:gap-2 transition-all" style={{ color: T.accent }}>
            Details <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>
        <div className="flex items-end gap-4 mb-3">
          <div className="flex-1">
            <div className="flex items-center justify-between mb-1.5">
              <span className="text-xs" style={{ color: T.textFaint }}>Income</span>
              <span className="text-sm num font-medium" style={{ color: T.green }}>{fmtK(totals.monthlyIncome)}</span>
            </div>
            <div className="h-2 rounded-full" style={{ background: T.surface3 }}>
              <div className="h-2 rounded-full" style={{ width: '100%', background: T.green }}></div>
            </div>
          </div>
          <div className="flex-1">
            <div className="flex items-center justify-between mb-1.5">
              <span className="text-xs" style={{ color: T.textFaint }}>Expenses</span>
              <span className="text-sm num font-medium" style={{ color: T.red }}>{fmtK(totals.monthlyExpenses)}</span>
            </div>
            <div className="h-2 rounded-full" style={{ background: T.surface3 }}>
              <div className="h-2 rounded-full" style={{ width: `${totals.monthlyIncome > 0 ? Math.min((totals.monthlyExpenses / totals.monthlyIncome) * 100, 100) : 0}%`, background: T.red }}></div>
            </div>
          </div>
          <div className="shrink-0 px-4 py-2.5 rounded-2xl text-center"
            style={{ background: totals.monthlyNet >= 0 ? T.greenBg : T.redBg, border: `1px solid ${totals.monthlyNet >= 0 ? T.green : T.red}` }}>
            <div className="text-[10px] uppercase tracking-wider mb-0.5" style={{ color: T.textFaint }}>Net</div>
            <div className="text-base num font-semibold" style={{ color: totals.monthlyNet >= 0 ? T.green : T.red }}>
              {totals.monthlyNet >= 0 ? '↑' : '↓'} {fmtK(Math.abs(totals.monthlyNet))}
            </div>
          </div>
        </div>
        {totals.monthlyIncome > 0 && (
          <div className="text-xs pt-3" style={{ color: T.textFaint, borderTop: `1px solid ${T.border}` }}>
            Savings rate:{' '}
            <span className="num font-medium" style={{ color: totals.savingsRate >= 0.2 ? T.green : totals.savingsRate >= 0.1 ? T.textDim : T.red }}>
              {(totals.savingsRate * 100).toFixed(0)}%
            </span>
            {totals.savingsRate >= 0.2 && <span className="ml-1">· Strong</span>}
            {totals.savingsRate > 0 && totals.savingsRate < 0.1 && <span className="ml-1">· Below 10% baseline</span>}
            {totals.savingsRate < 0 && <span className="ml-1">· Negative — review spending</span>}
          </div>
        )}
      </Card>

      {/* Savings Goals snapshot */}
      {goals.length > 0 && (
        <Card>
          <div className="flex items-baseline justify-between mb-4">
            <CardHeader title="Savings Goals" subtitle={`${goals.length} active`} inline />
            <button onClick={() => setView('goals')} className="text-sm flex items-center gap-1 hover:gap-2 transition-all" style={{ color: T.accent }}>
              All goals <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>
          <div className="grid md:grid-cols-2 gap-3">
            {goals.slice(0, 4).map(g => <GoalProgressCard key={g.id} goal={g} compact />)}
          </div>
        </Card>
      )}

      {/* Investments snapshot */}
      {holdings.length > 0 && (() => {
        const typeCounts = {};
        holdings.forEach(h => { const t = h.assetType || 'stock'; typeCounts[t] = (typeCounts[t] || 0) + 1; });
        const typeSummary = Object.entries(typeCounts)
          .map(([t, c]) => `${c} ${ASSET_TYPES[t]?.short.toLowerCase() || t}${c === 1 ? '' : 's'}`)
          .join(' · ');
        return (
          <Card>
            <div className="flex items-baseline justify-between mb-4">
              <CardHeader title="Investments" subtitle={typeSummary} inline />
              <button onClick={() => setView('stocks')} className="text-sm flex items-center gap-1 hover:gap-2 transition-all" style={{ color: T.accent }}>
                Manage <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </div>
            <div className="grid grid-cols-3 gap-4 mb-5">
              <Stat label="Market Value"   value={fmt(totals.stocksValue)} compact />
              <Stat label="Cost Basis"     value={fmt(totals.stocksCost)} compact />
              <Stat label="Unrealized P&L" value={fmtSign(stockPL)} compact accent={stockPL >= 0 ? T.green : T.red}
                hint={totals.stocksCost > 0 ? fmtPct(stockPL / totals.stocksCost) : ''} />
            </div>
            <div className="space-y-2">
              {[...holdings].sort((a, b) => holdingValue(b) - holdingValue(a)).slice(0, 5).map(h => {
                const pl = holdingPL(h); const plPct = holdingPLPct(h);
                const at = getAssetType(h);
                return (
                  <div key={h.id} className="flex items-center gap-3 py-2" style={{ borderBottom: `1px solid ${T.border}` }}>
                    <div className="font-medium w-20 truncate">{h.ticker}</div>
                    {h.assetType && h.assetType !== 'stock' && (
                      <span className="text-[10px] px-1.5 py-0.5 rounded uppercase tracking-wider whitespace-nowrap"
                        style={{ background: at.bg, color: at.color }}>{at.short}</span>
                    )}
                    <div className="text-sm flex-1 truncate" style={{ color: T.textDim }}>{h.name}</div>
                    {h.tag && HOLDING_TAGS[h.tag] && (
                      <span className="text-xs px-2 py-0.5 rounded-full"
                        style={{ background: HOLDING_TAGS[h.tag].bg, color: HOLDING_TAGS[h.tag].color }}>
                        {HOLDING_TAGS[h.tag].label}
                      </span>
                    )}
                    <div className="text-sm num text-right w-24">{fmtK(holdingValue(h))}</div>
                    <div className="text-sm num text-right w-20" style={{ color: pl === null ? T.textFaint : pl >= 0 ? T.green : T.red }}>
                      {pl === null ? '—' : fmtPct(plPct)}
                    </div>
                  </div>
                );
              })}
            </div>
          </Card>
        );
      })()}

      {/* Top Insights */}
      {insights.length > 0 && (
        <Card>
          <CardHeader title="Top Insights" subtitle="What your numbers are telling you" />
          <div className="space-y-2.5 mt-3">
            {insights.slice(0, 3).map((ins, i) => <InsightTile key={i} ins={ins} compact />)}
            {insights.length > 3 && (
              <button onClick={() => setView('insights')} className="text-sm flex items-center gap-1 hover:gap-2 transition-all" style={{ color: T.accent }}>
                See {insights.length - 3} more <ArrowRight className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        </Card>
      )}
    </div>
  );
}

// ===== WEALTH =====
function Wealth({ assets, totals, fxRates, customLabels, customCategories, categoryMap, onAdd, onEdit, onDelete, onEditFx, onAddCategory, onEditCategory, onDeleteCategory, onSaveLabel }) {
  // Order: built-in categories first (in their declared order), then custom categories
  const orderedKeys = [
    ...Object.keys(ASSET_CATEGORIES),
    ...customCategories.map(c => c.id),
  ];
  const grouped = orderedKeys.map(key => {
    const def = categoryMap[key];
    if (!def) return null;
    const customKey = `asset.${key}`;
    // Custom categories store their label directly; built-ins use the customLabels override system.
    const isCustom = !!def.isCustom;
    const effectiveLabel = isCustom ? def.label : (customLabels[customKey] || def.label);
    const items = assets.filter(a => a.category === key);
    return {
      key, ...def,
      label: effectiveLabel,
      defaultLabel: def.label,
      // Built-ins are "customized" if customLabels has an override; customs are always shown with edit affordance
      customized: !isCustom && !!customLabels[customKey],
      isCustom,
      items,
      totalPHP: items.reduce((s, a) => s + toPHP(a.value, a.currency, fxRates), 0),
    };
  }).filter(Boolean);

  // Confirm before deleting a custom category. If items exist, they get reassigned to 'Other Assets'.
  const handleDeleteCategory = (group) => {
    const itemCount = group.items.length;
    const msg = itemCount === 0
      ? `Delete the "${group.label}" category?`
      : `Delete "${group.label}"? ${itemCount} ${itemCount === 1 ? 'item' : 'items'} will be moved to Other Assets.`;
    if (window.confirm(msg)) onDeleteCategory(group.key);
  };

  return (
    <div className="fade-in space-y-5">
      <div className="flex items-baseline justify-between flex-wrap gap-3">
        <div>
          <h2 className="font-display text-3xl">Wealth</h2>
          <p className="text-sm mt-1" style={{ color: T.textDim }}>
            Bank accounts, insurance, property, vehicles, businesses, anything else. Hover any title to rename it. Add custom categories so nothing has to fall into "Other".
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button onClick={onEditFx} className="px-3 py-2 rounded-full text-sm hover:bg-white/5"
            style={{ border: `1px solid ${T.border2}`, color: T.textDim }}>FX rates</button>
          <button onClick={onAddCategory} className="px-3 py-2 rounded-full text-sm flex items-center gap-1.5 hover:bg-white/5"
            style={{ border: `1px solid ${T.border2}`, color: T.textDim }}>
            <Plus className="w-3.5 h-3.5" /> Category
          </button>
          <button onClick={onAdd} className="px-4 py-2.5 rounded-full text-sm flex items-center gap-2 hover:opacity-90"
            style={{ background: T.accent, color: T.bg, fontWeight: 500 }}>
            <Plus className="w-4 h-4" /> Add asset
          </button>
        </div>
      </div>
      {grouped.map(g => (
        <Card key={g.key}>
          <div className="flex items-center justify-between mb-3 gap-3">
            <div className="flex items-center gap-3 min-w-0">
              <div className="w-10 h-10 rounded-full flex items-center justify-center shrink-0" style={{ background: g.tint, color: g.color }}>
                <g.icon className="w-5 h-5" />
              </div>
              <div className="min-w-0">
                <div className="flex items-center gap-1.5 flex-wrap">
                  <EditableLabel
                    currentValue={g.label}
                    defaultValue={g.defaultLabel}
                    customized={g.customized}
                    onSave={(newLabel) => {
                      // For custom categories, rename means updating the category record itself.
                      // For built-ins, rename writes to customLabels (previous v5 behavior).
                      if (g.isCustom) {
                        // Calling onEditCategory with a renamed object would open the modal; instead just save inline.
                        // We piggyback on the same persistence by re-saving the custom category with a new label.
                        const cat = customCategories.find(c => c.id === g.key);
                        if (cat) onSaveLabel('custom_rename', g.key, { ...cat, label: newLabel || cat.label });
                      } else {
                        onSaveLabel('asset', g.key, newLabel);
                      }
                    }}
                    className="font-display text-xl"
                  />
                  {g.isCustom && (
                    <span className="text-[10px] px-1.5 py-0.5 rounded uppercase tracking-wider"
                      style={{ background: T.surface3, color: T.textFaint, letterSpacing: '0.05em' }}>Custom</span>
                  )}
                </div>
                <div className="text-xs" style={{ color: T.textFaint }}>{g.items.length} {g.items.length === 1 ? 'item' : 'items'}</div>
              </div>
            </div>
            <div className="flex items-center gap-3 shrink-0">
              <div className="text-right">
                <div className="font-display text-2xl num">{fmt(g.totalPHP)}</div>
                {totals.grossAssets > 0 && (
                  <div className="text-xs num" style={{ color: T.textFaint }}>{((g.totalPHP / totals.grossAssets) * 100).toFixed(0)}% of gross</div>
                )}
              </div>
              {/* Edit/delete affordances only for custom categories */}
              {g.isCustom && (
                <div className="flex gap-1">
                  <button onClick={() => onEditCategory(customCategories.find(c => c.id === g.key))}
                    className="p-1.5 rounded hover:bg-white/5" title="Edit category">
                    <Pencil className="w-3.5 h-3.5" style={{ color: T.textDim }} />
                  </button>
                  <button onClick={() => handleDeleteCategory(g)}
                    className="p-1.5 rounded hover:bg-white/5" title="Delete category">
                    <Trash2 className="w-3.5 h-3.5" style={{ color: T.textDim }} />
                  </button>
                </div>
              )}
            </div>
          </div>
          {g.items.length === 0 ? (
            <p className="text-sm italic py-3" style={{ color: T.textFaint, borderTop: `1px solid ${T.border}` }}>
              No {g.label.toLowerCase()} yet.
            </p>
          ) : (
            <ul style={{ borderTop: `1px solid ${T.border}` }}>
              {g.items.map(item => {
                const phpVal = toPHP(item.value, item.currency, fxRates);
                const isFx = item.currency && item.currency !== 'PHP';
                return (
                  <li key={item.id} className="py-3 flex items-center gap-3 group" style={{ borderBottom: `1px solid ${T.border}` }}>
                    <div className="flex-1 min-w-0">
                      <div className="font-medium truncate">{item.name}</div>
                      {item.notes && <div className="text-xs truncate" style={{ color: T.textFaint }}>{item.notes}</div>}
                    </div>
                    <div className="text-right">
                      {isFx && (
                        <div className="text-xs num" style={{ color: T.textFaint }}>
                          {item.currency} {Number(item.value).toLocaleString('en-US', { maximumFractionDigits: 2 })}
                        </div>
                      )}
                      <div className="num font-medium">{fmt(phpVal)}</div>
                    </div>
                    <div className="flex gap-1">
                      <button onClick={() => onEdit(item)} className="p-1.5 rounded hover:bg-white/5"><Pencil className="w-3.5 h-3.5" style={{ color: T.textDim }} /></button>
                      <button onClick={() => onDelete(item.id)} className="p-1.5 rounded hover:bg-white/5"><Trash2 className="w-3.5 h-3.5" style={{ color: T.textDim }} /></button>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </Card>
      ))}
    </div>
  );
}

// ===== STOCKS =====
function Stocks({ holdings, totals, refreshing, refreshMsg, onAdd, onEdit, onDelete, onRefresh, onExport, onImport }) {
  const [typeFilter, setTypeFilter] = useState('all');

  // Compute per-type totals so we can show a breakdown when the user holds multiple types
  const breakdown = {};
  Object.keys(ASSET_TYPES).forEach(t => {
    const items = holdings.filter(h => (h.assetType || 'stock') === t);
    breakdown[t] = {
      count: items.length,
      value: items.reduce((s, h) => s + holdingValue(h), 0),
      cost: items.reduce((s, h) => s + holdingCost(h), 0),
    };
  });
  const typesPresent = Object.entries(breakdown).filter(([, b]) => b.count > 0).map(([t]) => t);
  const stockPL = totals.stocksValue - totals.stocksCost;
  const filtered = typeFilter === 'all' ? holdings : holdings.filter(h => (h.assetType || 'stock') === typeFilter);
  const sorted = [...filtered].sort((a, b) => holdingValue(b) - holdingValue(a));
  const oldestUpdate = holdings.reduce((oldest, h) => !h.lastUpdated ? oldest : (!oldest || h.lastUpdated < oldest ? h.lastUpdated : oldest), null);

  const subtitle = (() => {
    if (holdings.length === 0) return 'Stocks, ETFs, crypto, and PH mutual funds — all in one place.';
    const parts = typesPresent.map(t => {
      const c = breakdown[t].count;
      return `${c} ${ASSET_TYPES[t].short.toLowerCase()}${c === 1 ? '' : 's'}`;
    });
    return `${parts.join(' · ')} · syncs with trading journal`;
  })();

  return (
    <div className="fade-in space-y-5">
      <div className="flex items-baseline justify-between flex-wrap gap-3">
        <div>
          <h2 className="font-display text-3xl">Investments</h2>
          <p className="text-sm mt-1" style={{ color: T.textDim }}>{subtitle}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button onClick={onImport} className="px-3 py-2 rounded-full text-sm flex items-center gap-1.5 hover:bg-white/5" style={{ border: `1px solid ${T.border2}`, color: T.textDim }}>
            <Upload className="w-3.5 h-3.5" /> Import
          </button>
          <button onClick={onExport} className="px-3 py-2 rounded-full text-sm flex items-center gap-1.5 hover:bg-white/5" style={{ border: `1px solid ${T.border2}`, color: T.textDim }}>
            <Download className="w-3.5 h-3.5" /> Export
          </button>
          <button onClick={onRefresh} disabled={refreshing || holdings.length === 0}
            className="px-3 py-2 rounded-full text-sm flex items-center gap-1.5 hover:bg-white/5 disabled:opacity-50"
            style={{ border: `1px solid ${T.border2}`, color: T.textDim }}>
            <RefreshCw className={`w-3.5 h-3.5 ${refreshing ? 'spin' : ''}`} />
            {refreshing ? 'Refreshing…' : 'Refresh prices'}
          </button>
          <button onClick={onAdd} className="px-3.5 py-2 rounded-full text-sm flex items-center gap-1.5 hover:opacity-90" style={{ background: T.accent, color: T.bg, fontWeight: 500 }}>
            <Plus className="w-3.5 h-3.5" /> Add
          </button>
        </div>
      </div>

      {refreshMsg && (
        <div className="p-3 rounded-xl text-sm flex items-center gap-2" style={{
          background: refreshMsg.tone === 'good' ? T.greenBg : T.redBg,
          color: refreshMsg.tone === 'good' ? T.green : T.red
        }}>
          {refreshMsg.tone === 'good' ? <Sparkles className="w-4 h-4" /> : <AlertCircle className="w-4 h-4" />}
          {refreshMsg.text}
        </div>
      )}

      {holdings.length > 0 && (
        <Card>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <Stat label="Market Value" value={fmt(totals.stocksValue)} />
            <Stat label="Cost Basis" value={fmt(totals.stocksCost)} />
            <Stat label="Unrealized P&L" value={fmtSign(stockPL)} accent={stockPL >= 0 ? T.green : T.red} hint={totals.stocksCost > 0 ? fmtPct(stockPL / totals.stocksCost) : ''} />
            <Stat label="Last Updated" value={oldestUpdate ? ago(oldestUpdate) : 'never'} hint={holdings.length > 1 ? 'oldest of holdings' : ''} />
          </div>
        </Card>
      )}

      {/* Per-type breakdown — only shown if user holds more than one asset type */}
      {typesPresent.length > 1 && (
        <Card>
          <CardHeader title="By Asset Type" subtitle="Distribution across your investment categories" />
          <div className="space-y-3 mt-4">
            {typesPresent.map(t => {
              const at = ASSET_TYPES[t];
              const b = breakdown[t];
              const pct = totals.stocksValue > 0 ? (b.value / totals.stocksValue) * 100 : 0;
              const pl = b.value - b.cost;
              return (
                <div key={t}>
                  <div className="flex items-center justify-between text-sm mb-1.5">
                    <div className="flex items-center gap-2">
                      <span className="w-2.5 h-2.5 rounded-full" style={{ background: at.color }}></span>
                      <span className="font-medium">{at.label}</span>
                      <span className="text-xs num" style={{ color: T.textFaint }}>· {b.count} {b.count === 1 ? 'position' : 'positions'}</span>
                    </div>
                    <div className="flex items-baseline gap-3 num">
                      {b.cost > 0 && pl !== null && (
                        <span className="text-xs" style={{ color: pl >= 0 ? T.green : T.red }}>{fmtSign(pl)}</span>
                      )}
                      <span className="font-medium">{fmt(b.value)}</span>
                      <span className="text-xs" style={{ color: T.textFaint }}>{pct.toFixed(0)}%</span>
                    </div>
                  </div>
                  <div className="w-full h-1.5 rounded-full overflow-hidden" style={{ background: T.surface2 }}>
                    <div className="h-full rounded-full" style={{ width: pct + '%', background: at.color }}></div>
                  </div>
                </div>
              );
            })}
          </div>
        </Card>
      )}

      {/* Type filter pills — only shown when there's something to filter between */}
      {typesPresent.length > 1 && (
        <div className="flex gap-1 p-1 rounded-full w-fit" style={{ background: T.surface2 }}>
          <button onClick={() => setTypeFilter('all')} className="px-4 py-1.5 rounded-full text-sm transition-all"
            style={{ background: typeFilter === 'all' ? T.accent : 'transparent', color: typeFilter === 'all' ? T.bg : T.textDim, fontWeight: typeFilter === 'all' ? 500 : 400 }}>
            All ({holdings.length})
          </button>
          {typesPresent.map(t => (
            <button key={t} onClick={() => setTypeFilter(t)} className="px-4 py-1.5 rounded-full text-sm transition-all"
              style={{ background: typeFilter === t ? T.accent : 'transparent', color: typeFilter === t ? T.bg : T.textDim, fontWeight: typeFilter === t ? 500 : 400 }}>
              {ASSET_TYPES[t].short} ({breakdown[t].count})
            </button>
          ))}
        </div>
      )}

      <Card>
        {holdings.length === 0 ? (
          <div className="py-10 text-center">
            <CandlestickChart className="w-10 h-10 mx-auto mb-3" style={{ color: T.textFaint }} />
            <p className="text-sm mb-4" style={{ color: T.textDim }}>No holdings yet.</p>
            <button onClick={onAdd} className="px-4 py-2 rounded-full text-sm inline-flex items-center gap-1.5" style={{ background: T.accent, color: T.bg }}>
              <Plus className="w-3.5 h-3.5" /> Add first holding
            </button>
          </div>
        ) : sorted.length === 0 ? (
          <p className="text-sm italic py-6 text-center" style={{ color: T.textFaint }}>No {ASSET_TYPES[typeFilter]?.short.toLowerCase()} holdings yet.</p>
        ) : (
          <div className="overflow-x-auto -mx-6 px-6 scrollbar-thin">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-xs uppercase tracking-widest" style={{ color: T.textFaint, borderBottom: `1px solid ${T.border}` }}>
                  <th className="text-left py-2 pr-3 font-normal">Symbol</th>
                  <th className="text-right py-2 px-3 font-normal num">Units</th>
                  <th className="text-right py-2 px-3 font-normal num">Avg Cost</th>
                  <th className="text-right py-2 px-3 font-normal num">Current</th>
                  <th className="text-right py-2 px-3 font-normal num">Value</th>
                  <th className="text-right py-2 px-3 font-normal num">P&L</th>
                  <th className="text-left py-2 px-3 font-normal">Tag</th>
                  <th className="text-right py-2 pl-3 font-normal">Updated</th>
                  <th className="w-16"></th>
                </tr>
              </thead>
              <tbody>
                {sorted.map(h => {
                  const pl = holdingPL(h); const plPct = holdingPLPct(h);
                  const tag = HOLDING_TAGS[h.tag];
                  const at = getAssetType(h);
                  // Crypto needs 8-decimal display; stocks/funds 4 is enough.
                  const sharesDisplay = Number(h.shares || 0).toLocaleString('en-PH', { maximumFractionDigits: at.decimals });
                  return (
                    <tr key={h.id} className="group" style={{ borderBottom: `1px solid ${T.border}` }}>
                      <td className="py-3 pr-3">
                        <div className="flex items-center gap-2">
                          <span className="font-medium truncate max-w-[140px]" title={h.ticker}>{h.ticker}</span>
                          {/* Type badge — only when not 'stock' to keep table clean for the common case */}
                          {h.assetType && h.assetType !== 'stock' && (
                            <span className="text-[10px] px-1.5 py-0.5 rounded uppercase tracking-wider whitespace-nowrap"
                              style={{ background: at.bg, color: at.color }}>{at.short}</span>
                          )}
                        </div>
                        {h.name && <div className="text-xs truncate max-w-[160px]" style={{ color: T.textFaint }}>{h.name}</div>}
                      </td>
                      <td className="text-right py-3 px-3 num">{sharesDisplay}</td>
                      <td className="text-right py-3 px-3 num" style={{ color: T.textDim }}>{h.avgCost ? fmt(h.avgCost) : <span style={{ color: T.textFaint }}>—</span>}</td>
                      <td className="text-right py-3 px-3 num">{fmt(h.currentPrice)}</td>
                      <td className="text-right py-3 px-3 num font-medium">{fmt(holdingValue(h))}</td>
                      <td className="text-right py-3 px-3 num" style={{ color: pl === null ? T.textFaint : pl >= 0 ? T.green : T.red }}>
                        {pl === null ? <span style={{ color: T.textFaint }}>—</span> : (
                          <><div>{fmtSign(pl)}</div><div className="text-xs">{fmtPct(plPct)}</div></>
                        )}
                      </td>
                      <td className="py-3 px-3">
                        {tag && <span className="text-xs px-2 py-0.5 rounded-full whitespace-nowrap" style={{ background: tag.bg, color: tag.color }}>{tag.label}</span>}
                      </td>
                      <td className="text-right py-3 pl-3 text-xs" style={{ color: T.textFaint }}>{ago(h.lastUpdated)}</td>
                      <td className="text-right py-3">
                        <div className="flex gap-1 justify-end">
                          <button onClick={() => onEdit(h)} className="p-1.5 rounded hover:bg-white/5"><Pencil className="w-3.5 h-3.5" style={{ color: T.textDim }} /></button>
                          <button onClick={() => onDelete(h.id)} className="p-1.5 rounded hover:bg-white/5"><Trash2 className="w-3.5 h-3.5" style={{ color: T.textDim }} /></button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  );
}

// ===== SPENDING (DAILY LOG) =====
function Spending({ spending, totals, envelopes, customLabels, onAdd, onEdit, onDelete, onSaveLabel }) {
  const [filterCategory, setFilterCategory] = useState('all');
  const [filterMonth, setFilterMonth] = useState(() => todayISO().slice(0, 7));
  const catLabel = (k) => customLabels[`spend.${k}`] || SPEND_CATEGORIES[k]?.label || k;

  const filtered = spending.filter(s => {
    if (filterCategory !== 'all' && s.category !== filterCategory) return false;
    if (filterMonth && !s.date.startsWith(filterMonth)) return false;
    return true;
  }).sort((a, b) => b.date.localeCompare(a.date));

  // Group by date
  const grouped = {};
  filtered.forEach(s => {
    if (!grouped[s.date]) grouped[s.date] = [];
    grouped[s.date].push(s);
  });

  const today = todayISO();
  const todayItems = spending.filter(s => s.date === today);
  const todayTotal = todayItems.reduce((sum, s) => sum + Number(s.amount || 0), 0);

  // This week
  const weekStart = ymd(startOfWeek(new Date()));
  const weekItems = spending.filter(s => s.date >= weekStart);
  const weekTotal = weekItems.reduce((sum, s) => sum + Number(s.amount || 0), 0);

  // This month
  const monthStart = ymd(startOfMonth(new Date()));
  const monthItems = spending.filter(s => s.date >= monthStart);
  const monthTotal = monthItems.reduce((sum, s) => sum + Number(s.amount || 0), 0);
  const dayOfMonth = new Date().getDate();
  const dailyAvg = dayOfMonth > 0 ? monthTotal / dayOfMonth : 0;

  // Top categories this month
  const monthByCat = {};
  monthItems.forEach(s => { monthByCat[s.category] = (monthByCat[s.category] || 0) + Number(s.amount || 0); });
  const topCats = Object.entries(monthByCat).sort((a, b) => b[1] - a[1]).slice(0, 5);

  // Last 30 days bar chart
  const last30 = [];
  for (let i = 29; i >= 0; i--) {
    const d = new Date(); d.setDate(d.getDate() - i);
    const date = ymd(d);
    const total = spending.filter(s => s.date === date).reduce((sum, s) => sum + Number(s.amount || 0), 0);
    last30.push({ date: date.slice(8), full: date, total });
  }

  return (
    <div className="fade-in space-y-5">
      <div className="flex items-baseline justify-between flex-wrap gap-3">
        <div>
          <h2 className="font-display text-3xl">Daily Spending</h2>
          <p className="text-sm mt-1" style={{ color: T.textDim }}>Track every transaction. Tap the gold + button anywhere to log.</p>
        </div>
        <button onClick={onAdd} className="px-4 py-2.5 rounded-full text-sm flex items-center gap-2 hover:opacity-90" style={{ background: T.accent, color: T.bg, fontWeight: 500 }}>
          <Plus className="w-4 h-4" /> Log spending
        </button>
      </div>

      <Card>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Stat label="Today" value={fmt(todayTotal)} hint={`${todayItems.length} transaction${todayItems.length === 1 ? '' : 's'}`} accent={T.accent} />
          <Stat label="This Week" value={fmt(weekTotal)} hint={`${weekItems.length} transactions`} />
          <Stat label="This Month" value={fmt(monthTotal)} hint={`avg ${fmtK(dailyAvg)}/day`} />
          <Stat label="Projected Month" value={fmt(dailyAvg * 30)} hint="at current pace" accent={T.purple} />
        </div>
      </Card>

      {last30.some(d => d.total > 0) && (
        <Card>
          <CardHeader title="Last 30 Days" subtitle="Daily spending pulse" />
          <div className="h-40 mt-4">
            <ResponsiveContainer>
              <BarChart data={last30} margin={{ top: 10, right: 0, bottom: 0, left: 0 }}>
                <XAxis dataKey="date" stroke={T.textFaint} tick={{ fontSize: 10, fill: T.textFaint }} axisLine={false} tickLine={false} interval={4} />
                <YAxis stroke={T.textFaint} tick={{ fontSize: 10, fill: T.textFaint }} axisLine={false} tickLine={false} tickFormatter={fmtK} width={50} />
                <Tooltip contentStyle={{ background: T.surface2, border: `1px solid ${T.border2}`, borderRadius: 12, fontSize: 12, color: T.text }}
                  formatter={(v) => fmt(v)} labelFormatter={(l, p) => p[0]?.payload?.full || l} />
                <Bar dataKey="total" fill={T.accent} radius={[3, 3, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Card>
      )}

      {topCats.length > 0 && (
        <Card>
          <CardHeader title="Top Categories This Month" subtitle="Where the money goes" />
          <div className="space-y-3 mt-4">
            {topCats.map(([catKey, amount]) => {
              const cat = SPEND_CATEGORIES[catKey];
              const cap = envelopes[catKey] || 0;
              const pct = monthTotal > 0 ? (amount / monthTotal) * 100 : 0;
              const overCap = cap > 0 && amount > cap;
              return (
                <div key={catKey}>
                  <div className="flex items-center justify-between text-sm mb-1.5">
                    <div className="flex items-center gap-2">
                      <span className="w-2 h-2 rounded-full" style={{ background: cat?.color || T.textDim }}></span>
                      <span>{catLabel(catKey)}</span>
                      {cap > 0 && (
                        <span className="text-xs num" style={{ color: overCap ? T.red : T.textFaint }}>
                          ({fmtK(cap)} cap)
                        </span>
                      )}
                    </div>
                    <div className="num">
                      <span style={{ color: overCap ? T.red : T.text }}>{fmt(amount)}</span>
                      <span className="ml-2 text-xs" style={{ color: T.textFaint }}>{pct.toFixed(0)}%</span>
                    </div>
                  </div>
                  <div className="w-full h-1.5 rounded-full overflow-hidden" style={{ background: T.surface2 }}>
                    <div className="h-full rounded-full" style={{
                      width: cap > 0 ? Math.min(100, (amount / cap) * 100) + '%' : pct + '%',
                      background: overCap ? T.red : (cat?.color || T.accent)
                    }}></div>
                  </div>
                </div>
              );
            })}
          </div>
        </Card>
      )}

      <Card>
        <div className="flex items-center justify-between mb-4 flex-wrap gap-3">
          <CardHeader title="Transactions" subtitle={`${filtered.length} entr${filtered.length === 1 ? 'y' : 'ies'}`} inline />
          <div className="flex gap-2">
            <input type="month" value={filterMonth} onChange={(e) => setFilterMonth(e.target.value)}
              className="px-3 py-1.5 rounded-lg text-sm num"
              style={{ background: T.surface2, border: `1px solid ${T.border2}`, color: T.text, colorScheme: 'dark' }} />
            <select value={filterCategory} onChange={(e) => setFilterCategory(e.target.value)}
              className="px-3 py-1.5 rounded-lg text-sm"
              style={{ background: T.surface2, border: `1px solid ${T.border2}`, color: T.text }}>
              <option value="all">All categories</option>
              {Object.keys(SPEND_CATEGORIES).map(k => <option key={k} value={k} style={{ background: T.surface }}>{catLabel(k)}</option>)}
            </select>
          </div>
        </div>

        {Object.keys(grouped).length === 0 ? (
          <div className="py-10 text-center">
            <WalletIcon className="w-10 h-10 mx-auto mb-3" style={{ color: T.textFaint }} />
            <p className="text-sm mb-4" style={{ color: T.textDim }}>No transactions for this period.</p>
            <button onClick={onAdd} className="px-4 py-2 rounded-full text-sm inline-flex items-center gap-1.5" style={{ background: T.accent, color: T.bg }}>
              <Plus className="w-3.5 h-3.5" /> Log first transaction
            </button>
          </div>
        ) : (
          <div className="space-y-5">
            {Object.entries(grouped).map(([date, items]) => {
              const dayTotal = items.reduce((s, x) => s + Number(x.amount || 0), 0);
              const d = new Date(date);
              const isToday = date === today;
              const label = isToday ? 'Today' : d.toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' });
              return (
                <div key={date}>
                  <div className="flex items-baseline justify-between mb-2 pb-2" style={{ borderBottom: `1px solid ${T.border}` }}>
                    <div className="flex items-baseline gap-3">
                      <span className="font-medium" style={{ color: isToday ? T.accent : T.text }}>{label}</span>
                      <span className="text-xs num" style={{ color: T.textFaint }}>{date}</span>
                    </div>
                    <span className="num font-medium">{fmt(dayTotal)}</span>
                  </div>
                  <ul className="space-y-1">
                    {items.map(s => {
                      const cat = SPEND_CATEGORIES[s.category];
                      return (
                        <li key={s.id} className="flex items-center gap-3 py-2 group">
                          <span className="w-2 h-2 rounded-full shrink-0" style={{ background: cat?.color || T.textDim }}></span>
                          <div className="flex-1 min-w-0">
                            <div className="text-sm font-medium truncate">{s.merchant || catLabel(s.category)}</div>
                            <div className="text-xs flex items-center gap-2 flex-wrap" style={{ color: T.textFaint }}>
                              <span>{catLabel(s.category)}</span>
                              {s.paymentMethod && <span>· {s.paymentMethod}</span>}
                              {s.tag && <span className="px-1.5 py-0.5 rounded" style={{ background: T.surface2, color: T.accent }}>#{s.tag}</span>}
                              {s.notes && <span className="italic">· {s.notes}</span>}
                            </div>
                          </div>
                          <div className="num font-medium whitespace-nowrap">{fmt(s.amount)}</div>
                          <div className="flex gap-1">
                            <button onClick={() => onEdit(s)} className="p-1.5 rounded hover:bg-white/5"><Pencil className="w-3.5 h-3.5" style={{ color: T.textDim }} /></button>
                            <button onClick={() => onDelete(s.id)} className="p-1.5 rounded hover:bg-white/5"><Trash2 className="w-3.5 h-3.5" style={{ color: T.textDim }} /></button>
                          </div>
                        </li>
                      );
                    })}
                  </ul>
                </div>
              );
            })}
          </div>
        )}
      </Card>
    </div>
  );
}

// ===== BUDGET (ENVELOPES) =====
function Budget({ envelopes, totals, expenses, customLabels, onSave, onSaveLabel }) {
  const [drafts, setDrafts] = useState(envelopes);
  const [dirty, setDirty] = useState(false);

  useEffect(() => { setDrafts(envelopes); setDirty(false); }, [envelopes]);

  const handleChange = (catKey, value) => {
    const next = { ...drafts, [catKey]: Number(value) || 0 };
    if (Number(value) === 0) delete next[catKey];
    setDrafts(next);
    setDirty(true);
  };

  const handleSave = () => { onSave(drafts); setDirty(false); };

  const totalCap = Object.values(drafts).reduce((s, v) => s + Number(v || 0), 0);
  const totalSpent = Object.entries(drafts).reduce((s, [k]) => s + (totals.spendingByCategory[k] || 0), 0);

  // Suggest caps: use recurring expense + 1.2x last month's variable as starting point
  const suggestCap = (catKey) => {
    const recurring = expenses.filter(e => e.category === catKey).reduce((s, e) => s + Number(e.amount || 0), 0);
    const variable = totals.spendingByCategory[catKey] || 0;
    return Math.round((recurring + variable * 1.2) / 100) * 100;
  };

  return (
    <div className="fade-in space-y-5">
      <div className="flex items-baseline justify-between flex-wrap gap-3">
        <div>
          <h2 className="font-display text-3xl">Budget Envelopes</h2>
          <p className="text-sm mt-1" style={{ color: T.textDim }}>Set monthly caps per category. Hover any category name to rename it. Warns at 85% and 100%.</p>
        </div>
        {dirty && (
          <button onClick={handleSave} className="px-4 py-2.5 rounded-full text-sm flex items-center gap-2 hover:opacity-90" style={{ background: T.accent, color: T.bg, fontWeight: 500 }}>
            Save caps
          </button>
        )}
      </div>

      <Card>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
          <Stat label="Total Monthly Cap" value={fmt(totalCap)} hint={Object.keys(drafts).length + ' categories'} />
          <Stat label="Spent So Far" value={fmt(totalSpent)} accent={totalSpent > totalCap && totalCap > 0 ? T.red : T.text}
            hint={totalCap > 0 ? `${(totalSpent / totalCap * 100).toFixed(0)}% of cap` : ''} />
          <Stat label="Remaining" value={fmt(Math.max(0, totalCap - totalSpent))} accent={T.green}
            hint={totalCap > 0 && totalSpent > totalCap ? `over by ${fmt(totalSpent - totalCap)}` : ''} />
        </div>
      </Card>

      <Card>
        <CardHeader title="Categories" subtitle="Type a number to set the cap. Leave at 0 to skip." />
        <div className="space-y-3 mt-5">
          {Object.entries(SPEND_CATEGORIES).map(([catKey, cat]) => {
            const cap = drafts[catKey] || 0;
            const spent = totals.spendingByCategory[catKey] || 0;
            const pct = cap > 0 ? Math.min(100, (spent / cap) * 100) : 0;
            const overCap = cap > 0 && spent > cap;
            const nearCap = cap > 0 && pct >= 85 && !overCap;
            const suggestion = suggestCap(catKey);
            const customKey = `spend.${catKey}`;
            const effectiveLabel = customLabels[customKey] || cat.label;
            return (
              <div key={catKey} className="p-3 rounded-xl" style={{ background: T.surface2, border: `1px solid ${T.border}` }}>
                <div className="flex items-center justify-between mb-2 flex-wrap gap-2">
                  <div className="flex items-center gap-2">
                    <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ background: cat.color }}></span>
                    <EditableLabel
                      currentValue={effectiveLabel}
                      defaultValue={cat.label}
                      customized={!!customLabels[customKey]}
                      onSave={(newLabel) => onSaveLabel('spend', catKey, newLabel)}
                      className="font-medium"
                    />
                    {spent > 0 && (
                      <span className="text-xs num" style={{ color: T.textFaint }}>· {fmt(spent)} spent</span>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    {suggestion > 0 && cap === 0 && (
                      <button onClick={() => handleChange(catKey, suggestion)} className="text-xs px-2 py-1 rounded hover:bg-white/5" style={{ color: T.accent }}>
                        suggest: {fmtK(suggestion)}
                      </button>
                    )}
                    <div className="flex items-center gap-1.5">
                      <span className="text-xs" style={{ color: T.textFaint }}>₱</span>
                      <input type="number" value={cap || ''} onChange={(e) => handleChange(catKey, e.target.value)}
                        placeholder="0" min="0"
                        className="w-28 px-2.5 py-1.5 rounded text-sm text-right num"
                        style={{ background: T.surface, border: `1px solid ${T.border2}`, color: T.text }} />
                    </div>
                  </div>
                </div>
                {cap > 0 && (
                  <div className="w-full h-2 rounded-full overflow-hidden" style={{ background: T.surface }}>
                    <div className="h-full rounded-full transition-all" style={{
                      width: pct + '%',
                      background: overCap ? T.red : (nearCap ? T.accent : cat.color)
                    }}></div>
                  </div>
                )}
                {overCap && (
                  <p className="text-xs mt-1.5" style={{ color: T.red }}>Over by {fmt(spent - cap)} this month</p>
                )}
                {nearCap && (
                  <p className="text-xs mt-1.5" style={{ color: T.accent }}>{(100 - pct).toFixed(0)}% remaining</p>
                )}
              </div>
            );
          })}
        </div>
      </Card>

      <div className="text-xs italic px-2" style={{ color: T.textFaint }}>
        Envelopes combine your <strong style={{ color: T.text, fontStyle: 'normal' }}>recurring monthly expenses</strong> and <strong style={{ color: T.text, fontStyle: 'normal' }}>daily spending log</strong> so the cap reflects total category spend. The "suggest" number is recurring + 1.2× this month's variable spend so far.
      </div>
    </div>
  );
}

// ===== GOALS =====
function Goals({ goals, assets, fxRates, onAdd, onEdit, onDelete }) {
  const active = goals.filter(g => Number(g.currentAmount || 0) < Number(g.targetAmount || 0));
  const achieved = goals.filter(g => Number(g.currentAmount || 0) >= Number(g.targetAmount || 0));

  return (
    <div className="fade-in space-y-5">
      <div className="flex items-baseline justify-between flex-wrap gap-3">
        <div>
          <h2 className="font-display text-3xl">Savings Goals</h2>
          <p className="text-sm mt-1" style={{ color: T.textDim }}>Targets with deadlines. Linked accounts auto-update. Manual adjustments override.</p>
        </div>
        <button onClick={onAdd} className="px-4 py-2.5 rounded-full text-sm flex items-center gap-2 hover:opacity-90" style={{ background: T.accent, color: T.bg, fontWeight: 500 }}>
          <Plus className="w-4 h-4" /> Add goal
        </button>
      </div>

      {goals.length === 0 ? (
        <Card>
          <div className="py-10 text-center">
            <Flag className="w-10 h-10 mx-auto mb-3" style={{ color: T.textFaint }} />
            <p className="text-sm mb-1" style={{ color: T.textDim }}>No goals yet. Set one to start tracking pace.</p>
            <p className="text-xs mb-4" style={{ color: T.textFaint }}>Examples: emergency fund, Japan trip, house down payment, new car.</p>
            <button onClick={onAdd} className="px-4 py-2 rounded-full text-sm inline-flex items-center gap-1.5" style={{ background: T.accent, color: T.bg }}>
              <Plus className="w-3.5 h-3.5" /> First goal
            </button>
          </div>
        </Card>
      ) : (
        <>
          {active.length > 0 && (
            <div className="grid md:grid-cols-2 gap-4">
              {active.map(g => <GoalProgressCard key={g.id} goal={g} onEdit={() => onEdit(g)} onDelete={() => onDelete(g.id)} />)}
            </div>
          )}
          {achieved.length > 0 && (
            <div>
              <div className="text-xs uppercase tracking-widest mb-3 mt-6" style={{ color: T.textFaint }}>Achieved</div>
              <div className="grid md:grid-cols-2 gap-4">
                {achieved.map(g => <GoalProgressCard key={g.id} goal={g} onEdit={() => onEdit(g)} onDelete={() => onDelete(g.id)} achieved />)}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}

function GoalProgressCard({ goal, onEdit, onDelete, compact, achieved }) {
  const target = Number(goal.targetAmount || 0);
  const current = Number(goal.currentAmount || 0);
  const pct = target > 0 ? Math.min(100, (current / target) * 100) : 0;
  const today = new Date();
  const targetDate = new Date(goal.targetDate);
  const startDate = new Date(goal.startDate || goal.createdAt || today);
  const totalDays = Math.max(1, daysBetween(startDate, targetDate));
  const elapsed = Math.max(0, daysBetween(startDate, today));
  const remaining = daysBetween(today, targetDate);
  const expectedPct = totalDays > 0 ? Math.min(100, (elapsed / totalDays) * 100) : 0;
  const ahead = pct >= expectedPct;
  const monthlyNeed = remaining > 0 ? (target - current) / Math.max(1, Math.ceil(remaining / 30)) : 0;

  return (
    <Card>
      <div className="flex items-start justify-between mb-3 group">
        <div className="flex-1 min-w-0">
          <div className={`font-display ${compact ? 'text-lg' : 'text-xl'} truncate`}>{goal.name}</div>
          <div className="text-xs mt-0.5" style={{ color: T.textFaint }}>
            {achieved ? 'Achieved' : remaining > 0 ? `${remaining} day${remaining === 1 ? '' : 's'} left` : `${Math.abs(remaining)} days overdue`}
            {goal.linkedAssetId && <span> · auto-tracked</span>}
          </div>
        </div>
        {!compact && (
          <div className="flex gap-1">
            <button onClick={onEdit} className="p-1.5 rounded hover:bg-white/5"><Pencil className="w-3.5 h-3.5" style={{ color: T.textDim }} /></button>
            <button onClick={onDelete} className="p-1.5 rounded hover:bg-white/5"><Trash2 className="w-3.5 h-3.5" style={{ color: T.textDim }} /></button>
          </div>
        )}
      </div>

      <div className="flex items-baseline justify-between mb-2">
        <span className="font-display text-2xl num">{fmt(current)}</span>
        <span className="text-sm num" style={{ color: T.textFaint }}>of {fmtK(target)}</span>
      </div>

      <div className="w-full h-2 rounded-full overflow-hidden mb-2" style={{ background: T.surface2 }}>
        {/* Expected pace marker */}
        {!achieved && expectedPct > 0 && expectedPct < 100 && (
          <div className="relative h-full">
            <div className="h-full rounded-full transition-all" style={{
              width: pct + '%',
              background: achieved ? T.green : (ahead ? T.green : T.accent)
            }}></div>
            <div className="absolute top-0 bottom-0 w-px" style={{ left: expectedPct + '%', background: T.textDim, opacity: 0.5 }}></div>
          </div>
        )}
        {(achieved || expectedPct >= 100) && (
          <div className="h-full rounded-full" style={{ width: pct + '%', background: T.green }}></div>
        )}
      </div>

      {!compact && !achieved && (
        <div className="flex items-center justify-between text-xs num" style={{ color: T.textFaint }}>
          <span>{pct.toFixed(0)}% saved</span>
          {!achieved && remaining > 0 && (
            <span style={{ color: ahead ? T.green : T.accent }}>
              {ahead ? '✓ on pace' : `need ${fmtK(monthlyNeed)}/mo`}
            </span>
          )}
        </div>
      )}
      {compact && (
        <div className="text-xs num" style={{ color: T.textFaint }}>
          {pct.toFixed(0)}% · {fmtK(target - current)} to go
        </div>
      )}
      {goal.notes && !compact && (
        <p className="text-xs mt-3 italic" style={{ color: T.textFaint }}>{goal.notes}</p>
      )}
    </Card>
  );
}

// ===== DEBTS =====
function Debts({ debts, totals, customLabels, onAdd, onEdit, onDelete, onSaveLabel }) {
  const grouped = Object.keys(DEBT_TYPES).map(key => {
    const def = DEBT_TYPES[key];
    const customKey = `debt.${key}`;
    return {
      key, ...def,
      label: customLabels[customKey] || def.label,
      defaultLabel: def.label,
      customized: !!customLabels[customKey],
      items: debts.filter(d => d.type === key),
      total: debts.filter(d => d.type === key).reduce((s, d) => s + Number(d.balance || 0), 0),
    };
  }).filter(g => g.items.length > 0);

  return (
    <div className="fade-in space-y-5">
      <div className="flex items-baseline justify-between flex-wrap gap-3">
        <div>
          <h2 className="font-display text-3xl">Debts</h2>
          <p className="text-sm mt-1" style={{ color: T.textDim }}>What you owe. Subtracted from gross to give true net worth.</p>
        </div>
        <button onClick={onAdd} className="px-4 py-2.5 rounded-full text-sm flex items-center gap-2 hover:opacity-90" style={{ background: T.red, color: '#fff', fontWeight: 500 }}>
          <Plus className="w-4 h-4" /> Add debt
        </button>
      </div>

      <Card>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
          <Stat label="Total Owed" value={fmt(totals.totalDebt)} accent={T.red} />
          <Stat label="Monthly Service" value={fmt(totals.monthlyDebtService)}
            hint={totals.monthlyIncome > 0 ? `${(totals.monthlyDebtService / totals.monthlyIncome * 100).toFixed(0)}% DTI` : ''} />
          <Stat label="Net Worth Impact" value={'−' + fmt(totals.totalDebt)} hint="subtracted from gross" accent={T.red} />
        </div>
      </Card>

      {debts.length === 0 ? (
        <Card>
          <div className="py-10 text-center">
            <CreditCard className="w-10 h-10 mx-auto mb-3" style={{ color: T.textFaint }} />
            <p className="text-sm" style={{ color: T.textDim }}>No debts logged.</p>
          </div>
        </Card>
      ) : grouped.map(g => (
        <Card key={g.key}>
          <div className="flex items-center justify-between mb-3 gap-3">
            <div className="flex items-center gap-3 min-w-0">
              <div className="w-10 h-10 rounded-full flex items-center justify-center shrink-0" style={{ background: T.redBg, color: T.red }}>
                <g.icon className="w-5 h-5" />
              </div>
              <div className="min-w-0">
                <EditableLabel
                  currentValue={g.label}
                  defaultValue={g.defaultLabel}
                  customized={g.customized}
                  onSave={(newLabel) => onSaveLabel('debt', g.key, newLabel)}
                  className="font-display text-xl"
                />
                <div className="text-xs" style={{ color: T.textFaint }}>{g.items.length} {g.items.length === 1 ? 'account' : 'accounts'}</div>
              </div>
            </div>
            <div className="text-right shrink-0">
              <div className="font-display text-2xl num" style={{ color: T.red }}>{fmt(g.total)}</div>
            </div>
          </div>
          <ul style={{ borderTop: `1px solid ${T.border}` }}>
            {g.items.map(item => (
              <li key={item.id} className="py-3 flex items-center gap-3 group" style={{ borderBottom: `1px solid ${T.border}` }}>
                <div className="flex-1 min-w-0">
                  <div className="font-medium truncate">{item.name}</div>
                  <div className="text-xs flex items-center gap-3" style={{ color: T.textFaint }}>
                    {item.monthlyPayment > 0 && <span>{fmt(item.monthlyPayment)}/mo</span>}
                    {item.interestRate > 0 && <span>{Number(item.interestRate).toFixed(2)}% APR</span>}
                  </div>
                </div>
                <div className="num font-medium" style={{ color: T.red }}>{fmt(item.balance)}</div>
                <div className="flex gap-1">
                  <button onClick={() => onEdit(item)} className="p-1.5 rounded hover:bg-white/5"><Pencil className="w-3.5 h-3.5" style={{ color: T.textDim }} /></button>
                  <button onClick={() => onDelete(item.id)} className="p-1.5 rounded hover:bg-white/5"><Trash2 className="w-3.5 h-3.5" style={{ color: T.textDim }} /></button>
                </div>
              </li>
            ))}
          </ul>
        </Card>
      ))}
    </div>
  );
}

// ===== CASH FLOW =====
function CashFlow({ income, expenses, totals, customLabels, onAddIncome, onEditIncome, onDeleteIncome, onAddExpense, onEditExpense, onDeleteExpense, onSaveLabel }) {
  const expensePieData = Object.entries(totals.spendingByCategory)
    .filter(([, v]) => v > 0)
    .map(([k, v]) => ({
      name: customLabels[`spend.${k}`] || SPEND_CATEGORIES[k]?.label || k,
      value: v,
      color: SPEND_CATEGORIES[k]?.color || T.textDim
    }));
  const hasDeductions = totals.monthlyDeductions > 0;

  return (
    <div className="fade-in space-y-6">
      <div>
        <h2 className="font-display text-3xl">Cash Flow</h2>
        <p className="text-sm mt-1" style={{ color: T.textDim }}>
          Recurring income and expenses. Daily variable spending lives in the Spending tab.
          {hasDeductions && ' Income shown is takehome (after tax + government contributions).'}
        </p>
      </div>

      <Card>
        <div className="grid md:grid-cols-3 gap-6">
          <div>
            <div className="text-xs uppercase tracking-widest mb-1" style={{ color: T.textFaint }}>
              Monthly In {hasDeductions && <span style={{ color: T.accent }}>· takehome</span>}
            </div>
            <div className="font-display text-3xl num" style={{ color: T.green }}>{fmt(totals.monthlyIncome)}</div>
            <div className="text-xs mt-1 num" style={{ color: T.textFaint }}>
              Annual: {fmt(totals.monthlyIncome * 12)}
              {hasDeductions && (
                <span> · Gross {fmtK(totals.monthlyIncomeGross)} − {fmtK(totals.monthlyDeductions)} deductions</span>
              )}
            </div>
          </div>
          <div>
            <div className="text-xs uppercase tracking-widest mb-1" style={{ color: T.textFaint }}>Monthly Out</div>
            <div className="font-display text-3xl num" style={{ color: T.red }}>{fmt(totals.monthlyExpenses)}</div>
            <div className="text-xs mt-1 num" style={{ color: T.textFaint }}>
              {fmtK(totals.monthlyRecurringExpenses)} fixed + {fmtK(totals.monthlyVariableSpending)} variable
            </div>
          </div>
          <div className="md:pl-6" style={{ borderLeft: `1px solid ${T.border}` }}>
            <div className="text-xs uppercase tracking-widest mb-1" style={{ color: T.textFaint }}>Net</div>
            <div className="font-display text-3xl num" style={{ color: totals.monthlyNet >= 0 ? T.green : T.red }}>
              {totals.monthlyNet >= 0 ? '+' : ''}{fmt(totals.monthlyNet)}
            </div>
            <div className="text-xs mt-1 num" style={{ color: T.textFaint }}>Annual: {fmtSign(totals.monthlyNet * 12)}</div>
          </div>
        </div>
      </Card>

      <Card>
        <div className="flex items-center justify-between mb-4">
          <CardHeader title="Income" subtitle="Salary, commissions, dividends, business. Toggle tax treatment per item." inline />
          <button onClick={onAddIncome} className="px-3.5 py-2 rounded-full text-sm flex items-center gap-1.5 hover:opacity-90" style={{ background: T.accent, color: T.bg, fontWeight: 500 }}>
            <Plus className="w-3.5 h-3.5" /> Add
          </button>
        </div>
        {income.length === 0 ? (
          <p className="text-sm italic py-4" style={{ color: T.textFaint }}>No income added yet.</p>
        ) : (
          <ul>
            {income.map(item => {
              const ITS = INCOME_TYPES[item.type];
              const grossMonthly = toMonthlyGross(item);
              const treatment = item.taxTreatment || 'none';
              const { net: netMonthly, deductions, breakdown } = applyTaxTreatment(grossMonthly, treatment);
              const hasTax = treatment !== 'none';
              return (
                <li key={item.id} className="py-3 flex items-center gap-3 group" style={{ borderBottom: `1px solid ${T.border}` }}>
                  <div className="w-9 h-9 rounded-full flex items-center justify-center shrink-0" style={{ background: T.greenBg, color: T.green }}>
                    <ITS.icon className="w-4 h-4" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="font-medium truncate flex items-center gap-2">
                      {item.name}
                      {hasTax && (
                        <span className="text-[10px] px-1.5 py-0.5 rounded uppercase tracking-wider"
                          style={{ background: T.purpleBg, color: T.purple, letterSpacing: '0.05em' }}>
                          {TAX_TREATMENTS[treatment]?.short}
                        </span>
                      )}
                    </div>
                    <div className="text-xs" style={{ color: T.textFaint }}>
                      {ITS.label} · {FREQUENCIES[item.frequency]?.label || item.frequency}
                      {hasTax && breakdown && treatment === 'salary' && (
                        <span> · −{fmtK(breakdown.tax)} tax, −{fmtK(breakdown.sss + breakdown.philhealth + breakdown.pagibig)} contrib</span>
                      )}
                      {hasTax && breakdown && treatment === 'selfemployed8' && (
                        <span> · −{fmtK(breakdown.tax)} (8% flat)</span>
                      )}
                    </div>
                  </div>
                  <div className="text-right">
                    {hasTax ? (
                      <>
                        <div className="num font-medium">{fmt(netMonthly)}<span className="text-xs" style={{ color: T.textFaint }}>/mo net</span></div>
                        <div className="text-xs num" style={{ color: T.textFaint }}>
                          {fmt(item.amount)}{item.frequency !== 'monthly' ? ' ' + (FREQUENCIES[item.frequency]?.label || item.frequency).toLowerCase() : '/mo'} gross
                        </div>
                      </>
                    ) : (
                      <>
                        <div className="num font-medium">{fmt(item.amount)}</div>
                        {item.frequency !== 'monthly' && <div className="text-xs num" style={{ color: T.textFaint }}>{fmt(grossMonthly)}/mo avg</div>}
                      </>
                    )}
                  </div>
                  <div className="flex gap-1">
                    <button onClick={() => onEditIncome(item)} className="p-1.5 rounded hover:bg-white/5"><Pencil className="w-3.5 h-3.5" style={{ color: T.textDim }} /></button>
                    <button onClick={() => onDeleteIncome(item.id)} className="p-1.5 rounded hover:bg-white/5"><Trash2 className="w-3.5 h-3.5" style={{ color: T.textDim }} /></button>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </Card>

      <Card>
        <div className="flex items-center justify-between mb-4">
          <CardHeader title="Recurring Expenses" subtitle="Fixed monthly outflows (rent, subscriptions, utilities)" inline />
          <button onClick={onAddExpense} className="px-3.5 py-2 rounded-full text-sm flex items-center gap-1.5 hover:opacity-90" style={{ background: T.accent, color: T.bg, fontWeight: 500 }}>
            <Plus className="w-3.5 h-3.5" /> Add
          </button>
        </div>
        {expenses.length === 0 ? (
          <p className="text-sm italic py-4" style={{ color: T.textFaint }}>No recurring expenses yet.</p>
        ) : (
          <div className="grid md:grid-cols-2 gap-6">
            <ul>
              {expenses.map(item => (
                <li key={item.id} className="py-3 flex items-center gap-3" style={{ borderBottom: `1px solid ${T.border}` }}>
                  <div className="w-9 h-9 rounded-full flex items-center justify-center shrink-0"
                    style={{ background: item.essential ? T.greenBg : T.redBg, color: item.essential ? T.green : T.red }}>
                    <Receipt className="w-4 h-4" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="font-medium truncate">{item.name}</div>
                    <div className="flex items-center gap-2 text-xs" style={{ color: T.textFaint }}>
                      <span>{customLabels[`spend.${item.category}`] || SPEND_CATEGORIES[item.category]?.label || item.category}</span>
                      <span className="px-1.5 py-0.5 rounded text-[10px]"
                        style={{ background: item.essential ? T.greenBg : T.redBg, color: item.essential ? T.green : T.red }}>
                        {item.essential ? 'Essential' : 'Non-essential'}
                      </span>
                    </div>
                  </div>
                  <div className="num font-medium">{fmt(item.amount)}</div>
                  <div className="flex gap-1">
                    <button onClick={() => onEditExpense(item)} className="p-2 rounded-lg" style={{ background: T.surface2 }}>
                      <Pencil className="w-3.5 h-3.5" style={{ color: T.textDim }} />
                    </button>
                    <button onClick={() => onDeleteExpense(item.id)} className="p-2 rounded-lg" style={{ background: T.surface2 }}>
                      <Trash2 className="w-3.5 h-3.5" style={{ color: T.textDim }} />
                    </button>
                  </div>
                </li>
              ))}
            </ul>
            {expensePieData.length > 0 && (
              <div className="h-56">
                <ResponsiveContainer>
                  <RPie>
                    <Pie data={expensePieData} dataKey="value" innerRadius={45} outerRadius={80} paddingAngle={2} stroke="none">
                      {expensePieData.map((d, i) => <Cell key={i} fill={d.color} />)}
                    </Pie>
                    <Tooltip contentStyle={{ background: T.surface2, border: `1px solid ${T.border2}`, borderRadius: 12, fontSize: 12, color: T.text }} formatter={(v) => fmt(v)} />
                  </RPie>
                </ResponsiveContainer>
              </div>
            )}
          </div>
        )}
      </Card>
    </div>
  );
}

// ===== FORECAST =====
function Forecast({ totals, forecast, months, setMonths, milestones, expenses, income }) {
  const [mode, setMode] = useState('full'); // 'full' | 'essential'
  const range = [6, 12, 24, 60];

  // Essential-only totals
  const essentialExpenses = expenses.filter(e => e.essential);
  const nonEssentialExpenses = expenses.filter(e => !e.essential);
  const essentialTotal = essentialExpenses.reduce((s, e) => s + Number(e.amount || 0), 0);
  const nonEssentialTotal = nonEssentialExpenses.reduce((s, e) => s + Number(e.amount || 0), 0);
  const essentialMonthlyNet = totals.monthlyIncomeNet - essentialTotal;
  const fullMonthlyNet = totals.monthlyNet;

  // Build essential-only forecast
  const essentialForecast = [];
  for (let m = 0; m <= months; m++) {
    essentialForecast.push({
      month: m,
      label: m === 0 ? 'Now' : `M${m}`,
      cash: Math.round(totals.liquidCash + essentialMonthlyNet * m),
      netWorth: Math.round(totals.netWorth + essentialMonthlyNet * m),
    });
  }

  const activeForecast = mode === 'essential' ? essentialForecast : forecast;
  const activeMonthlyNet = mode === 'essential' ? essentialMonthlyNet : fullMonthlyNet;
  const endCash = activeForecast[activeForecast.length - 1]?.cash || totals.liquidCash;
  const endNetWorth = activeForecast[activeForecast.length - 1]?.netWorth || totals.netWorth;

  // Salary cliff: find any income that ends soon
  const salaryItems = income.filter(i => i.notes?.toLowerCase().includes('june') || i.notes?.toLowerCase().includes('ends'));
  const hasSalaryCliff = salaryItems.length > 0;

  return (
    <div className="fade-in space-y-6">
      <div className="flex items-baseline justify-between flex-wrap gap-3">
        <div>
          <h2 className="font-display text-3xl">Forecast</h2>
          <p className="text-sm mt-1" style={{ color: T.textDim }}>Where your money is heading at current pace.</p>
        </div>
        <div className="flex gap-1 p-1 rounded-full" style={{ background: T.surface2 }}>
          {range.map(r => (
            <button key={r} onClick={() => setMonths(r)} className="px-4 py-1.5 rounded-full text-sm transition-all"
              style={{ background: months === r ? T.accent : 'transparent', color: months === r ? T.bg : T.textDim, fontWeight: months === r ? 500 : 400 }}>
              {r === 60 ? '5y' : `${r}mo`}
            </button>
          ))}
        </div>
      </div>

      {/* Salary cliff warning */}
      {hasSalaryCliff && (
        <div className="p-4 rounded-xl flex gap-3" style={{ background: 'rgba(0, 200, 150,0.1)', border: `1px solid ${T.accent}` }}>
          <AlertCircle className="w-5 h-5 shrink-0 mt-0.5" style={{ color: T.accent }} />
          <div className="text-sm" style={{ color: T.text }}>
            <strong style={{ color: T.accent }}>Income cliff ahead.</strong> Your salary ends in June. After that, monthly income drops to dividends only (~{fmt(totals.monthlyIncomeNet - 200000 * 0.775)}/mo estimated). The forecast below assumes current income continues — use Essential Only mode to see your floor.
          </div>
        </div>
      )}

      {/* Mode toggle */}
      {expenses.length > 0 && (
        <div className="grid grid-cols-2 gap-3">
          {[
            { id: 'full', label: 'Full Lifestyle', sub: `${fmt(totals.monthlyExpenses)}/mo · all expenses`, color: T.blue },
            { id: 'essential', label: 'Essential Only', sub: `${fmt(essentialTotal)}/mo · saves ${fmt(nonEssentialTotal)}/mo`, color: T.green },
          ].map(opt => (
            <button key={opt.id} onClick={() => setMode(opt.id)}
              className="p-4 rounded-xl text-left transition-all"
              style={{
                background: mode === opt.id ? 'rgba(0, 200, 150,0.1)' : T.surface,
                border: `1.5px solid ${mode === opt.id ? T.accent : T.border}`,
              }}>
              <div className="font-medium text-sm" style={{ color: mode === opt.id ? T.accent : T.text }}>{opt.label}</div>
              <div className="text-xs mt-1" style={{ color: T.textFaint }}>{opt.sub}</div>
            </button>
          ))}
        </div>
      )}

      <Card>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
          <Stat label="Liquid Today" value={fmt(totals.liquidCash)} />
          <Stat label={`Liquid in ${months}mo`} value={fmt(endCash)}
            accent={endCash >= totals.liquidCash ? T.green : T.red} hint={fmtSign(endCash - totals.liquidCash)} />
          <Stat label="Monthly Net" value={fmtSign(activeMonthlyNet)}
            accent={activeMonthlyNet >= 0 ? T.green : T.red}
            hint={mode === 'essential' ? 'essential only' : 'all expenses'} />
          <Stat label={`Net Worth in ${months}mo`} value={fmt(endNetWorth)}
            accent={endNetWorth >= totals.netWorth ? T.green : T.red} hint={fmtSign(endNetWorth - totals.netWorth)} />
        </div>
        {totals.monthlyIncome === 0 && totals.monthlyExpenses === 0 ? (
          <EmptyTile text="Add income and expenses to project your future." />
        ) : (
          <div className="h-72">
            <ResponsiveContainer>
              <LineChart data={activeForecast} margin={{ top: 10, right: 16, bottom: 0, left: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke={T.border} vertical={false} />
                <XAxis dataKey="label" stroke={T.textDim} tick={{ fontSize: 11, fill: T.textDim }} axisLine={false} tickLine={false} />
                <YAxis stroke={T.textDim} tick={{ fontSize: 11, fill: T.textDim }} axisLine={false} tickLine={false} tickFormatter={fmtK} width={60} />
                <Tooltip contentStyle={{ background: T.surface2, border: `1px solid ${T.border2}`, borderRadius: 12, fontSize: 12, color: T.text }} formatter={(v) => fmt(v)} />
                <Line type="monotone" dataKey="cash" stroke={T.accent} strokeWidth={2.5} dot={false} name="Liquid Cash" />
                <Line type="monotone" dataKey="netWorth" stroke={T.blue} strokeWidth={2.5} dot={false} name="Net Worth" strokeDasharray="4 4" />
              </LineChart>
            </ResponsiveContainer>
          </div>
        )}
        <div className="flex items-center gap-5 mt-4 text-sm" style={{ color: T.textDim }}>
          <span className="flex items-center gap-2"><span className="w-3 h-0.5" style={{ background: T.accent }}></span>Liquid Cash</span>
          <span className="flex items-center gap-2"><span className="w-3 h-0 border-t border-dashed" style={{ borderColor: T.blue }}></span>Net Worth</span>
        </div>
      </Card>

      {/* Essential vs Non-essential breakdown */}
      {expenses.length > 0 && (
        <Card>
          <CardHeader title="Expense Breakdown" subtitle="Tap any expense in Cash Flow to toggle essential/non-essential" />
          <div className="space-y-4 mt-5">
            <div>
              <div className="flex items-center justify-between text-sm mb-2">
                <span className="font-medium" style={{ color: T.green }}>Essential ({essentialExpenses.length} items)</span>
                <span className="num font-medium">{fmt(essentialTotal)}/mo</span>
              </div>
              {essentialExpenses.map(e => (
                <div key={e.id} className="flex justify-between text-sm py-1.5" style={{ borderBottom: `1px solid ${T.border}` }}>
                  <span style={{ color: T.textDim }}>{e.name}</span>
                  <span className="num">{fmt(Number(e.amount))}</span>
                </div>
              ))}
            </div>
            <div>
              <div className="flex items-center justify-between text-sm mb-2">
                <span className="font-medium" style={{ color: T.red }}>Non-essential ({nonEssentialExpenses.length} items)</span>
                <span className="num font-medium">{fmt(nonEssentialTotal)}/mo</span>
              </div>
              {nonEssentialExpenses.map(e => (
                <div key={e.id} className="flex justify-between text-sm py-1.5" style={{ borderBottom: `1px solid ${T.border}` }}>
                  <span style={{ color: T.textDim }}>{e.name}</span>
                  <span className="num">{fmt(Number(e.amount))}</span>
                </div>
              ))}
            </div>
            <div className="p-3 rounded-xl text-sm" style={{ background: T.greenBg }}>
              <div className="flex justify-between">
                <span style={{ color: T.green }}>Monthly savings if you cut non-essentials</span>
                <span className="num font-medium" style={{ color: T.green }}>+{fmt(nonEssentialTotal)}</span>
              </div>
              <div className="flex justify-between mt-1 text-xs" style={{ color: T.textFaint }}>
                <span>Annually</span>
                <span className="num">+{fmt(nonEssentialTotal * 12)}/yr</span>
              </div>
            </div>
          </div>
        </Card>
      )}

      {milestones.length > 0 && (
        <Card>
          <CardHeader title="Milestones" subtitle="When liquid cash reaches key marks" />
          <div className="space-y-3 mt-4">
            {milestones.map(m => (
              <div key={m.target} className="flex items-center gap-4 p-4" style={{ border: `1px solid ${T.border}`, background: T.surface, borderRadius: '16px', boxShadow: '0 2px 12px rgba(0,0,0,0.4)' }}>
                <Target className="w-5 h-5 shrink-0" style={{ color: T.accent }} />
                <div className="flex-1">
                  <div className="font-display text-xl num">{fmt(m.target)}</div>
                  <div className="text-xs" style={{ color: T.textFaint }}>liquid cash target</div>
                </div>
                <div className="text-right">
                  <div className="font-medium num">{m.months} {m.months === 1 ? 'month' : 'months'}</div>
                  {m.months >= 12 && <div className="text-xs num" style={{ color: T.textFaint }}>{(m.months / 12).toFixed(1)} years</div>}
                </div>
              </div>
            ))}
          </div>
        </Card>
      )}
    </div>
  );
}

// ===== HISTORY =====
function HistoryView({ snapshots, totals }) {
  const [range, setRange] = useState(90);
  const sliced = snapshots.slice(-range);
  const earliest = sliced[0];
  const latest = sliced[sliced.length - 1];
  const change = (earliest && latest) ? latest.netWorth - earliest.netWorth : 0;
  const changePct = (earliest && earliest.netWorth > 0) ? change / earliest.netWorth : 0;

  // Monthly aggregation for longer ranges
  const dataToShow = range > 90 ? aggregateByMonth(sliced) : sliced;

  function aggregateByMonth(snaps) {
    const byMonth = {};
    snaps.forEach(s => {
      const m = s.date.slice(0, 7);
      byMonth[m] = s; // last snap of the month wins
    });
    return Object.entries(byMonth).map(([m, s]) => ({ ...s, date: m })).sort((a, b) => a.date.localeCompare(b.date));
  }

  return (
    <div className="fade-in space-y-5">
      <div className="flex items-baseline justify-between flex-wrap gap-3">
        <div>
          <h2 className="font-display text-3xl">Net Worth History</h2>
          <p className="text-sm mt-1" style={{ color: T.textDim }}>
            Auto-snapshotted daily · {snapshots.length} day{snapshots.length === 1 ? '' : 's'} of data
          </p>
        </div>
        <div className="flex gap-1 p-1 rounded-full" style={{ background: T.surface2 }}>
          {[7, 30, 90, 365, 9999].map(r => (
            <button key={r} onClick={() => setRange(r)} className="px-3 py-1.5 rounded-full text-sm transition-all"
              style={{ background: range === r ? T.accent : 'transparent', color: range === r ? T.bg : T.textDim, fontWeight: range === r ? 500 : 400 }}>
              {r === 7 ? '7d' : r === 30 ? '30d' : r === 90 ? '90d' : r === 365 ? '1y' : 'All'}
            </button>
          ))}
        </div>
      </div>

      {snapshots.length < 2 ? (
        <Card>
          <div className="py-10 text-center">
            <History className="w-10 h-10 mx-auto mb-3" style={{ color: T.textFaint }} />
            <p className="text-sm" style={{ color: T.textDim }}>Need at least 2 days of snapshots to chart history.</p>
            <p className="text-xs mt-1" style={{ color: T.textFaint }}>Each day you open Patrimony, a snapshot is taken automatically.</p>
          </div>
        </Card>
      ) : (
        <>
          <Card>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <Stat label="Period Start" value={fmt(earliest?.netWorth || 0)} hint={earliest?.date} />
              <Stat label="Today" value={fmt(latest?.netWorth || 0)} />
              <Stat label="Change" value={fmtSign(change)} accent={change >= 0 ? T.green : T.red} />
              <Stat label="Change %" value={fmtPct(changePct)} accent={change >= 0 ? T.green : T.red} />
            </div>
          </Card>

          <Card>
            <CardHeader title="Net Worth Over Time" subtitle={range > 90 ? 'monthly snapshots' : 'daily snapshots'} />
            <div className="h-80 mt-5">
              <ResponsiveContainer>
                <AreaChart data={dataToShow} margin={{ top: 10, right: 16, bottom: 0, left: 0 }}>
                  <defs><linearGradient id="histG" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor={T.accent} stopOpacity={0.3} />
                    <stop offset="100%" stopColor={T.accent} stopOpacity={0} />
                  </linearGradient></defs>
                  <CartesianGrid strokeDasharray="3 3" stroke={T.border} vertical={false} />
                  <XAxis dataKey="date" stroke={T.textDim} tick={{ fontSize: 10, fill: T.textDim }} axisLine={false} tickLine={false} />
                  <YAxis stroke={T.textDim} tick={{ fontSize: 11, fill: T.textDim }} axisLine={false} tickLine={false} tickFormatter={fmtK} width={60} domain={['auto', 'auto']} />
                  <Tooltip contentStyle={{ background: T.surface2, border: `1px solid ${T.border2}`, borderRadius: 12, fontSize: 12, color: T.text }} formatter={(v) => fmt(v)} />
                  <Area type="monotone" dataKey="netWorth" stroke={T.accent} strokeWidth={2.5} fill="url(#histG)" name="Net Worth" />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </Card>

          <Card>
            <CardHeader title="Components Over Time" subtitle="Liquid cash, stocks, total assets" />
            <div className="h-72 mt-5">
              <ResponsiveContainer>
                <LineChart data={dataToShow} margin={{ top: 10, right: 16, bottom: 0, left: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke={T.border} vertical={false} />
                  <XAxis dataKey="date" stroke={T.textDim} tick={{ fontSize: 10, fill: T.textDim }} axisLine={false} tickLine={false} />
                  <YAxis stroke={T.textDim} tick={{ fontSize: 11, fill: T.textDim }} axisLine={false} tickLine={false} tickFormatter={fmtK} width={60} />
                  <Tooltip contentStyle={{ background: T.surface2, border: `1px solid ${T.border2}`, borderRadius: 12, fontSize: 12, color: T.text }} formatter={(v) => fmt(v)} />
                  <Line type="monotone" dataKey="liquidCash" stroke={T.accent} strokeWidth={2} dot={false} name="Liquid Cash" />
                  <Line type="monotone" dataKey="stocksValue" stroke={T.purple} strokeWidth={2} dot={false} name="Stocks" />
                  <Line type="monotone" dataKey="grossAssets" stroke={T.blue} strokeWidth={2} dot={false} name="Gross Assets" />
                </LineChart>
              </ResponsiveContainer>
            </div>
            <div className="flex items-center gap-5 mt-3 text-sm flex-wrap" style={{ color: T.textDim }}>
              <span className="flex items-center gap-2"><span className="w-3 h-0.5" style={{ background: T.accent }}></span>Liquid Cash</span>
              <span className="flex items-center gap-2"><span className="w-3 h-0.5" style={{ background: T.purple }}></span>Stocks</span>
              <span className="flex items-center gap-2"><span className="w-3 h-0.5" style={{ background: T.blue }}></span>Gross Assets</span>
            </div>
          </Card>
        </>
      )}
    </div>
  );
}

// ===== TAX VIEW =====
function TaxView({ income, totals, holdings }) {
  // Filter by explicit taxTreatment now — not by income type.
  // Salary-treatment items get BIR + contributions math.
  // 8%-flat items get the self-employed math.
  // none-treatment items don't appear in tax breakdowns at all.
  const salaryItems = income.filter(i => i.taxTreatment === 'salary');
  const selfEmpItems = income.filter(i => i.taxTreatment === 'selfemployed8');
  const untaxedItems = income.filter(i => !i.taxTreatment || i.taxTreatment === 'none');
  const dividendItems = income.filter(i => i.type === 'dividend');

  const salaryGross = salaryItems.reduce((s, i) => s + toMonthlyGross(i), 0);
  const selfEmpGross = selfEmpItems.reduce((s, i) => s + toMonthlyGross(i), 0);
  const untaxedGross = untaxedItems.reduce((s, i) => s + toMonthlyGross(i), 0);
  const dividendGross = dividendItems.reduce((s, i) => s + toMonthlyGross(i), 0);

  const salaryTax = calcPHTax(salaryGross);
  const selfEmpAnnual = selfEmpGross * 12;
  const selfEmp8Annual = Math.max(0, selfEmpAnnual - 250_000) * 0.08;
  const selfEmpMonthlyTax = selfEmp8Annual / 12;

  // US dividends — informational only; not auto-deducted from cash flow unless user toggles a treatment
  const usDividendWithholding = dividendGross * 0.25;
  const dividendNet = dividendGross - usDividendWithholding;

  const stockUnrealizedPL = totals.stocksValue - totals.stocksCost;

  // Header totals reflect the actual tax treatments configured on income items
  const totalGross = totals.monthlyIncomeGross;
  const totalTakehome = totals.monthlyIncomeNet;
  const totalDeductions = totals.monthlyDeductions;
  const overallEffective = totalGross > 0 ? totalDeductions / totalGross : 0;

  const noTreatmentSet = salaryItems.length === 0 && selfEmpItems.length === 0;

  return (
    <div className="fade-in space-y-5">
      <div>
        <h2 className="font-display text-3xl">Tax Insights</h2>
        <p className="text-sm mt-1" style={{ color: T.textDim }}>
          Philippines · BIR brackets · gross-to-takehome math.
          Set <strong style={{ color: T.text }}>tax treatment</strong> on individual income items to control what's deducted.
        </p>
      </div>

      <Card>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Stat label="Monthly Gross" value={fmt(totalGross)} />
          <Stat label="Monthly Takehome" value={fmt(totalTakehome)} accent={T.green} />
          <Stat label="Auto-Deducted" value={fmt(totalDeductions)} accent={T.red}
            hint={dividendGross > 0 ? `+ ${fmt(usDividendWithholding)} dividend withholding` : ''} />
          <Stat label="Effective Rate" value={`${(overallEffective * 100).toFixed(1)}%`} accent={T.purple}
            hint={noTreatmentSet ? 'no treatments set' : ''} />
        </div>
      </Card>

      {noTreatmentSet && income.length > 0 && (
        <Card>
          <div className="flex items-start gap-3 p-2">
            <AlertCircle className="w-5 h-5 shrink-0 mt-0.5" style={{ color: T.accent }} />
            <div>
              <div className="font-medium mb-1">No tax deductions configured</div>
              <p className="text-sm" style={{ color: T.textDim }}>
                Your income items currently use the "No deduction" treatment, so all amounts you've entered are treated as takehome. To enable BIR / SSS / PhilHealth / Pag-IBIG auto-deduction on a salary, edit the income item and switch the tax treatment. Commissions and dividends can stay untaxed if you handle that separately.
              </p>
            </div>
          </div>
        </Card>
      )}

      {salaryGross > 0 && (
        <Card>
          <CardHeader title="Salary Income (with deductions)"
            subtitle={`${salaryItems.length} item${salaryItems.length === 1 ? '' : 's'} · ${fmt(salaryGross)}/mo gross · BIR withholding + government contributions applied`} />
          <div className="grid md:grid-cols-2 gap-4 mt-5">
            <div className="space-y-3">
              <Row label="Gross monthly" value={fmt(salaryGross)} />
              <Row label="SSS (employee share)" value={`−${fmt(salaryTax.contributions.sss)}`} dim />
              <Row label="PhilHealth (2.5%)" value={`−${fmt(salaryTax.contributions.philhealth)}`} dim />
              <Row label="Pag-IBIG" value={`−${fmt(salaryTax.contributions.pagibig)}`} dim />
              <Row label="Withholding tax" value={`−${fmt(salaryTax.tax)}`} dim />
              <div style={{ borderTop: `1px solid ${T.border}`, paddingTop: 8 }}>
                <Row label="Net takehome" value={fmt(salaryTax.takehome)} bold accent={T.green} />
              </div>
            </div>
            <div className="space-y-3">
              <Row label="Annual gross" value={fmt(salaryGross * 12)} />
              <Row label="Annual taxable" value={fmt(salaryTax.taxableAnnual)} dim />
              <Row label="Annual tax" value={fmt(salaryTax.annualTax)} dim />
              <Row label="Effective tax rate" value={`${(salaryTax.effectiveRate * 100).toFixed(1)}%`} dim />
              <Row label="Annual takehome" value={fmt(salaryTax.takehome * 12)} bold accent={T.green} />
            </div>
          </div>
        </Card>
      )}

      {selfEmpGross > 0 && (
        <Card>
          <CardHeader title="Self-Employed 8% Flat Tax"
            subtitle={`${selfEmpItems.length} item${selfEmpItems.length === 1 ? '' : 's'} · ${fmt(selfEmpGross)}/mo · 8% flat applied above ₱250K annual threshold`} />
          <div className="space-y-3 mt-5">
            <Row label="Monthly gross" value={fmt(selfEmpGross)} />
            <Row label="Annual gross" value={fmt(selfEmpAnnual)} dim />
            <Row label="Less: ₱250K threshold" value={`−${fmt(Math.min(250_000, selfEmpAnnual))}`} dim />
            <Row label="Taxable above threshold" value={fmt(Math.max(0, selfEmpAnnual - 250_000))} dim />
            <Row label="8% tax" value={`−${fmt(selfEmp8Annual)}/yr (${fmt(selfEmpMonthlyTax)}/mo)`} dim />
            <div style={{ borderTop: `1px solid ${T.border}`, paddingTop: 8 }}>
              <Row label="Monthly net (after 8% tax)" value={fmt(selfEmpGross - selfEmpMonthlyTax)} bold accent={T.green} />
            </div>
          </div>
          <p className="text-xs mt-4 italic" style={{ color: T.textFaint }}>
            Assumes 8% flat rate elected at BIR registration (valid below ₱3M annual gross). If using graduated rates instead, tax is higher but expenses are deductible.
          </p>
        </Card>
      )}

      {untaxedGross > 0 && (
        <Card>
          <CardHeader title="No-Deduction Income"
            subtitle={`${untaxedItems.length} item${untaxedItems.length === 1 ? '' : 's'} · ${fmt(untaxedGross)}/mo · treated as takehome`} />
          <div className="space-y-2 mt-4">
            {untaxedItems.map(i => (
              <div key={i.id} className="flex items-center justify-between text-sm py-2" style={{ borderBottom: `1px solid ${T.border}` }}>
                <div>
                  <span style={{ color: T.text }}>{i.name}</span>
                  <span className="text-xs ml-2" style={{ color: T.textFaint }}>{INCOME_TYPES[i.type]?.label} · {FREQUENCIES[i.frequency]?.label || i.frequency}</span>
                </div>
                <span className="num">{fmt(toMonthlyGross(i))}/mo</span>
              </div>
            ))}
          </div>
          <p className="text-xs mt-4 italic" style={{ color: T.textFaint }}>
            These items don't have a tax treatment set, so the full amount is counted as takehome. If any of these are taxable in reality, you may be over-counting your spendable income — adjust the treatment per item via the Cash Flow tab.
          </p>
        </Card>
      )}

      {dividendGross > 0 && (
        <Card>
          <CardHeader title="Dividend Income (US Stocks)" subtitle="W-8BEN treaty rate · 25% US withholding · informational only" />
          <div className="space-y-3 mt-5">
            <Row label="Monthly dividends (gross)" value={fmt(dividendGross)} />
            <Row label="US withholding (25%)" value={`−${fmt(usDividendWithholding)}`} dim />
            <Row label="Net to you" value={fmt(dividendNet)} bold accent={T.green} />
          </div>
          <p className="text-xs mt-4 italic" style={{ color: T.textFaint }}>
            US-source dividends are taxed at source via IBKR before they hit your account. Whether you also owe Philippine tax depends on your tax residency and treaty paperwork — confirm with a CPA. The amount you enter for dividend income should already be the post-IBKR-withholding figure unless you want this card as a planning view.
          </p>
        </Card>
      )}

      {holdings.length > 0 && (
        <Card>
          <CardHeader title="Capital Gains (US Stocks)" subtitle="Unrealized · for planning only" />
          <div className="space-y-3 mt-5">
            <Row label="Total cost basis" value={fmt(totals.stocksCost)} dim />
            <Row label="Current market value" value={fmt(totals.stocksValue)} />
            <Row label="Unrealized gain/loss" value={fmtSign(stockUnrealizedPL)}
              bold accent={stockUnrealizedPL >= 0 ? T.green : T.red} />
          </div>
          <p className="text-xs mt-4 leading-relaxed" style={{ color: T.textFaint }}>
            <strong style={{ color: T.text }}>Note:</strong> The Philippines generally does not tax capital gains from foreign stocks for resident citizens — those are taxed in the US (and you may owe under PH worldwide income rules above thresholds). FX gains/losses on USD held are also relevant. This is a complex area — consult a Philippine CPA familiar with cross-border investing.
          </p>
        </Card>
      )}

      <Card>
        <CardHeader title="BIR Tax Brackets (annual taxable income)" subtitle="2024+ TRAIN rates" />
        <div className="mt-4 space-y-2">
          {[
            { range: 'Up to ₱250,000',          rate: '0%',                note: 'Tax-exempt' },
            { range: '₱250,001 – ₱400,000',     rate: '15% over ₱250K',    note: '' },
            { range: '₱400,001 – ₱800,000',     rate: '₱22,500 + 20%',     note: 'over ₱400K' },
            { range: '₱800,001 – ₱2,000,000',   rate: '₱102,500 + 25%',    note: 'over ₱800K' },
            { range: '₱2,000,001 – ₱8,000,000', rate: '₱402,500 + 30%',    note: 'over ₱2M' },
            { range: 'Over ₱8,000,000',         rate: '₱2,202,500 + 35%',  note: 'over ₱8M' },
          ].map((b, i) => (
            <div key={i} className="grid grid-cols-3 gap-3 text-sm py-1.5" style={{ borderBottom: i < 5 ? `1px solid ${T.border}` : 'none' }}>
              <span className="num" style={{ color: T.textDim }}>{b.range}</span>
              <span className="num font-medium">{b.rate}</span>
              <span className="num" style={{ color: T.textFaint }}>{b.note}</span>
            </div>
          ))}
        </div>
      </Card>

      <div className="text-xs italic px-2 leading-relaxed" style={{ color: T.textFaint }}>
        Tax calculations are educated estimates using 2024 BIR brackets, SSS/PhilHealth/Pag-IBIG approximations, and standard treaty rates. Real numbers vary by employer setup, BIR registration type, allowable deductions, and treaty paperwork. Always verify with a CPA before filing or making major decisions.
      </div>
    </div>
  );
}

function Row({ label, value, dim, bold, accent }) {
  return (
    <div className="flex items-center justify-between text-sm">
      <span style={{ color: dim ? T.textDim : T.text }}>{label}</span>
      <span className={`num ${bold ? 'font-medium text-base' : ''}`} style={{ color: accent || (dim ? T.textDim : T.text) }}>{value}</span>
    </div>
  );
}

// ===== INSIGHTS =====
function Insights({ insights, totals }) {
  return (
    <div className="fade-in space-y-5">
      <div>
        <h2 className="font-display text-3xl">Insights</h2>
        <p className="text-sm mt-1" style={{ color: T.textDim }}>Honest observations across spending, debt, goals, and holdings.</p>
      </div>
      {insights.length === 0 ? (
        <Card>
          <div className="py-10 text-center">
            <Lightbulb className="w-10 h-10 mx-auto mb-3" style={{ color: T.textFaint }} />
            <p className="text-sm" style={{ color: T.textDim }}>Add more details and observations will appear here.</p>
          </div>
        </Card>
      ) : (
        <div className="space-y-3">
          {insights.map((ins, i) => <Card key={i}><InsightTile ins={ins} /></Card>)}
        </div>
      )}
      <Card>
        <CardHeader title="Quick Math" subtitle="Numbers worth keeping in mind" />
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-4">
          <Stat label="Monthly Surplus" value={fmtSign(totals.monthlyNet)} compact accent={totals.monthlyNet >= 0 ? T.green : T.red} />
          <Stat label="Annual Surplus" value={fmtSign(totals.monthlyNet * 12)} compact accent={totals.monthlyNet >= 0 ? T.green : T.red} />
          <Stat label="3mo Buffer" value={fmt(totals.monthlyExpenses * 3)} compact hint="emergency fund" />
          <Stat label="6mo Buffer" value={fmt(totals.monthlyExpenses * 6)} compact hint="conservative" />
        </div>
      </Card>
    </div>
  );
}

function InsightTile({ ins, compact }) {
  const palette = {
    warn: { bg: T.redBg,    icon: AlertCircle, color: T.red },
    good: { bg: T.greenBg,  icon: Sparkles,    color: T.green },
    note: { bg: T.purpleBg, icon: Target,      color: T.purple }
  }[ins.tone || 'note'];
  const Icon = palette.icon;
  return (
    <div className={`flex gap-3 ${compact ? 'p-3 rounded-xl' : ''}`} style={compact ? { background: palette.bg } : {}}>
      <div className="mt-0.5 shrink-0"><Icon className="w-4 h-4" style={{ color: palette.color }} /></div>
      <div className="flex-1 min-w-0">
        {ins.title && <div className={`font-medium ${compact ? 'text-sm' : 'text-base'} mb-0.5`} style={{ color: T.text }}>{ins.title}</div>}
        <p className={`${compact ? 'text-xs' : 'text-sm'} leading-relaxed`} style={{ color: T.textDim }}>{ins.body || ins.text}</p>
      </div>
    </div>
  );
}

// ===== SHARED UI =====
function Card({ children }) {
  return <div className="p-6" style={{ background: T.surface, border: `1px solid ${T.border}`, borderRadius: '16px', boxShadow: '0 2px 12px rgba(0,0,0,0.4)' }}>{children}</div>;
}
function CardHeader({ title, subtitle, inline }) {
  return (
    <div className={inline ? '' : 'mb-1'}>
      <div className="font-display text-xl">{title}</div>
      {subtitle && <div className="text-xs mt-0.5" style={{ color: T.textFaint }}>{subtitle}</div>}
    </div>
  );
}

// EditableLabel — click pencil to inline-rename a category label.
// `defaultValue` is the original (e.g., "Tangible Assets"); `currentValue` is what's shown now.
// onSave receives the new label (or empty string to clear/restore default).
function EditableLabel({ currentValue, defaultValue, onSave, className, style, customized }) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(currentValue);

  useEffect(() => { setDraft(currentValue); }, [currentValue]);

  const commit = () => {
    const trimmed = draft.trim();
    // Empty or same-as-default = clear the override
    if (!trimmed || trimmed === defaultValue) {
      onSave('');
    } else if (trimmed !== currentValue) {
      onSave(trimmed);
    }
    setEditing(false);
  };
  const cancel = () => { setDraft(currentValue); setEditing(false); };

  if (editing) {
    return (
      <div className="flex items-center gap-1.5">
        <input
          autoFocus value={draft} onChange={(e) => setDraft(e.target.value)}
          onBlur={commit}
          onKeyDown={(e) => {
            if (e.key === 'Enter') commit();
            if (e.key === 'Escape') cancel();
          }}
          placeholder={defaultValue}
          className={`px-2 py-0.5 rounded outline-none ${className || ''}`}
          style={{
            background: T.surface2,
            border: `1px solid ${T.accent}`,
            color: T.text,
            minWidth: 120,
            ...style
          }} />
      </div>
    );
  }

  return (
    <div className="flex items-center gap-1.5 group/label">
      <span className={className} style={style}>{currentValue}</span>
      <button
        onClick={(e) => { e.stopPropagation(); setEditing(true); }}
        className="p-1 rounded hover:bg-white/5 opacity-0 group-hover/label:opacity-100 transition-opacity"
        title={customized ? 'Rename (currently customized)' : 'Rename'}
        aria-label="Rename">
        <Pencil className="w-3 h-3" style={{ color: customized ? T.accent : T.textFaint }} />
      </button>
    </div>
  );
}

function Stat({ label, value, hint, accent, compact }) {
  return (
    <div>
      <div className="text-xs uppercase tracking-widest mb-1.5" style={{ color: T.textFaint }}>{label}</div>
      <div className={`font-display ${compact ? 'text-xl md:text-2xl' : 'text-2xl md:text-3xl'} num`} style={{ color: accent || T.text }}>{value}</div>
      {hint && <div className="text-xs mt-1 num" style={{ color: T.textFaint }}>{hint}</div>}
    </div>
  );
}
function EmptyTile({ text, actionLabel, onAction }) {
  return (
    <div className="py-8 text-center">
      <p className="text-sm mb-3" style={{ color: T.textDim }}>{text}</p>
      {actionLabel && (
        <button onClick={onAction} className="text-sm inline-flex items-center gap-1 hover:gap-2 transition-all" style={{ color: T.accent }}>
          {actionLabel} <ArrowRight className="w-3.5 h-3.5" />
        </button>
      )}
    </div>
  );
}

// ===== MODAL =====
function Modal({ kind, editing, onClose, onSave, fxRates, onSaveFx, onImport, assets, customLabels, categoryMap }) {
  const cl = customLabels || {};
  const spendLabel = (k) => cl[`spend.${k}`] || SPEND_CATEGORIES[k]?.label || k;
  const assetLabel = (k) => cl[`asset.${k}`] || ASSET_CATEGORIES[k]?.label || k;
  const debtLabel = (k) => cl[`debt.${k}`] || DEBT_TYPES[k]?.label || k;
  const initial = editing || (
    kind === 'asset'    ? { name: '', category: 'bank', currency: 'PHP', value: '', cost: '', notes: '' } :
    kind === 'holding'  ? { assetType: 'stock', ticker: '', name: '', shares: '', avgCost: '', currentPrice: '', broker: '', notes: '', tag: '' } :
    kind === 'debt'     ? { name: '', type: 'creditcard', balance: '', monthlyPayment: '', interestRate: '' } :
    kind === 'income'   ? { name: '', type: 'salary', amount: '', frequency: 'monthly', taxTreatment: 'none' } :
    kind === 'expense'  ? { name: '', category: 'housing', amount: '', essential: true } :
    kind === 'spend'    ? { date: todayISO(), amount: '', category: 'food', merchant: '', paymentMethod: 'Cash', tag: '', notes: '' } :
    kind === 'goal'     ? { name: '', targetAmount: '', currentAmount: '', targetDate: '', startDate: todayISO(), createdAt: new Date().toISOString(), linkedAssetId: '', notes: '' } :
    kind === 'category' ? { label: '', iconKey: 'Coins', color: CUSTOM_CATEGORY_COLORS[0] } :
    kind === 'fx'       ? { ...fxRates } :
                          { jsonText: '' }
  );
  const [form, setForm] = useState(initial);

  const valid = (() => {
    if (kind === 'asset')    return form.name && form.value !== '' && Number(form.value) >= 0;
    if (kind === 'holding')  return form.ticker && form.shares !== '' && Number(form.shares) > 0;
    if (kind === 'debt')     return form.name && form.balance !== '' && Number(form.balance) >= 0;
    if (kind === 'income')   return form.name && form.amount !== '' && Number(form.amount) >= 0;
    if (kind === 'expense')  return form.name && form.amount !== '' && Number(form.amount) >= 0;
    if (kind === 'spend')    return form.amount !== '' && Number(form.amount) > 0 && form.date && form.category;
    if (kind === 'goal')     return form.name && form.targetAmount !== '' && Number(form.targetAmount) > 0 && form.targetDate;
    if (kind === 'category') return form.label && form.label.trim().length > 0;
    if (kind === 'fx')       return Object.values(form).every(v => Number(v) > 0);
    if (kind === 'import')   return form.jsonText && form.jsonText.length > 5;
    return false;
  })();

  const handleSubmit = () => {
    if (!valid) return;
    if (kind === 'fx') { onSaveFx(form); onClose(); return; }
    if (kind === 'import') {
      try {
        const parsed = JSON.parse(form.jsonText);
        const arr = Array.isArray(parsed) ? parsed : (parsed.holdings || []);
        const valid2 = arr.filter(h => h.ticker && h.shares != null).map(h => {
          const at = ASSET_TYPES[h.assetType] ? h.assetType : 'stock';
          const upper = ASSET_TYPES[at].uppercase;
          return {
            id: uid(),
            assetType: at,
            ticker: upper ? String(h.ticker).toUpperCase() : String(h.ticker),
            name: h.name || h.ticker,
            shares: Number(h.shares) || 0,
            avgCost: Number(h.avgCost ?? h.cost ?? 0),
            currentPrice: Number(h.currentPrice ?? h.price ?? 0),
            broker: h.broker || '',
            notes: h.notes || '',
            tag: h.tag || '',
            lastUpdated: h.lastUpdated || new Date().toISOString()
          };
        });
        onImport(valid2);
      } catch (e) { alert('Invalid JSON.'); }
      return;
    }
    const payload = { ...form };
    if (kind === 'asset') {
      payload.value = Number(payload.value);
      payload.cost = payload.cost === '' ? Number(payload.value) : Number(payload.cost);
    }
    if (kind === 'holding') {
      const at = ASSET_TYPES[payload.assetType || 'stock'];
      // Funds are proper nouns ("BPI Money Market Fund") — don't uppercase. Stocks/crypto: uppercase.
      payload.ticker = at.uppercase ? String(payload.ticker).toUpperCase().trim() : String(payload.ticker).trim();
      payload.shares = Number(payload.shares);
      payload.avgCost = Number(payload.avgCost || 0);
      payload.currentPrice = Number(payload.currentPrice || payload.avgCost || 0);
      payload.assetType = payload.assetType || 'stock';
    }
    if (kind === 'debt') {
      payload.balance = Number(payload.balance);
      payload.monthlyPayment = Number(payload.monthlyPayment || 0);
      payload.interestRate = Number(payload.interestRate || 0);
    }
    if (kind === 'spend') {
      payload.amount = Number(payload.amount);
    }
    if (kind === 'goal') {
      payload.targetAmount = Number(payload.targetAmount);
      payload.currentAmount = Number(payload.currentAmount || 0);
      if (!payload.createdAt) payload.createdAt = new Date().toISOString();
    }
    if (kind === 'category') {
      payload.label = String(payload.label || '').trim();
    }
    if ('amount' in payload && kind !== 'spend') payload.amount = Number(payload.amount);
    onSave(payload);
  };

  const title = (editing ? 'Edit ' : 'Add ') + (
    kind === 'asset'    ? 'Asset' :
    kind === 'holding'  ? `${ASSET_TYPES[form.assetType || 'stock'].label} Holding` :
    kind === 'debt'     ? 'Debt' :
    kind === 'income'   ? 'Income' :
    kind === 'expense'  ? 'Expense' :
    kind === 'spend'    ? 'Transaction' :
    kind === 'goal'     ? 'Goal' :
    kind === 'category' ? 'Category' :
    kind === 'fx'       ? 'FX Rates' :
                          'Import Holdings'
  );

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: 'rgba(15, 14, 12, 0.85)', backdropFilter: 'blur(4px)' }} onClick={onClose}>
      <div className="rounded-2xl w-full max-w-md p-6 fade-in max-h-[90vh] overflow-y-auto scrollbar-thin"
        style={{ background: T.surface, border: `1px solid ${T.border2}` }} onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-5">
          <h3 className="font-display text-2xl" style={{ color: T.accent }}>{title}</h3>
          <button onClick={onClose} className="p-1.5 rounded-full hover:bg-white/5"><X className="w-4 h-4" style={{ color: T.textDim }} /></button>
        </div>

        <div className="space-y-4">
          {kind === 'spend' && (
            <>
              <div className="grid grid-cols-2 gap-3">
                <Field label="Amount (₱)">
                  <Input type="number" value={form.amount} onChange={(v) => setForm({ ...form, amount: v })} placeholder="0" min="0" step="any" num autoFocus />
                </Field>
                <Field label="Date">
                  <Input type="date" value={form.date} onChange={(v) => setForm({ ...form, date: v })} num />
                </Field>
              </div>
              <Field label="Category">
                <Select value={form.category} onChange={(v) => setForm({ ...form, category: v })}
                  options={Object.entries(SPEND_CATEGORIES).map(([k, c]) => ({ value: k, label: c.label }))} />
              </Field>
              <Field label="Merchant (optional)">
                <Input value={form.merchant || ''} onChange={(v) => setForm({ ...form, merchant: v })} placeholder="e.g. Starbucks BGC, Grab, SM Megamall" />
              </Field>
              <div className="grid grid-cols-2 gap-3">
                <Field label="Payment Method">
                  <Select value={form.paymentMethod} onChange={(v) => setForm({ ...form, paymentMethod: v })}
                    options={PAYMENT_METHODS.map(p => ({ value: p, label: p }))} />
                </Field>
                <Field label="Tag (optional)">
                  <Input value={form.tag || ''} onChange={(v) => setForm({ ...form, tag: v })} placeholder="work, date-night, etc" />
                </Field>
              </div>
              <Field label="Notes (optional)">
                <Input value={form.notes || ''} onChange={(v) => setForm({ ...form, notes: v })} placeholder="anything to remember" />
              </Field>
            </>
          )}

          {kind === 'goal' && (
            <>
              <Field label="Goal Name">
                <Input value={form.name} onChange={(v) => setForm({ ...form, name: v })} placeholder="e.g. Japan trip, Emergency fund, Down payment" autoFocus />
              </Field>
              <div className="grid grid-cols-2 gap-3">
                <Field label="Target Amount (₱)">
                  <Input type="number" value={form.targetAmount} onChange={(v) => setForm({ ...form, targetAmount: v })} placeholder="500000" min="0" num />
                </Field>
                <Field label="Current Amount (₱)">
                  <Input type="number" value={form.currentAmount} onChange={(v) => setForm({ ...form, currentAmount: v })} placeholder="0" min="0" num />
                </Field>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <Field label="Start Date">
                  <Input type="date" value={form.startDate} onChange={(v) => setForm({ ...form, startDate: v })} num />
                </Field>
                <Field label="Target Date">
                  <Input type="date" value={form.targetDate} onChange={(v) => setForm({ ...form, targetDate: v })} num />
                </Field>
              </div>
              <Field label="Linked Bank Account (optional)">
                <Select value={form.linkedAssetId || ''} onChange={(v) => setForm({ ...form, linkedAssetId: v })}
                  options={[
                    { value: '', label: '— None —' },
                    ...assets.filter(a => a.category === 'bank').map(a => ({ value: a.id, label: a.name }))
                  ]} />
              </Field>
              {form.linkedAssetId && (
                <p className="text-xs italic" style={{ color: T.textFaint }}>
                  Note: linking an account lets you reference its balance, but Patrimony doesn't auto-pull bank data — you still update the bank balance manually under Wealth, and adjust this goal's "current" as needed.
                </p>
              )}
              <Field label="Notes (optional)">
                <Input value={form.notes || ''} onChange={(v) => setForm({ ...form, notes: v })} placeholder="motivation, plan, anything" />
              </Field>
            </>
          )}

          {kind === 'asset' && (
            <>
              <Field label="Name">
                <Input value={form.name} onChange={(v) => setForm({ ...form, name: v })} placeholder="e.g. BPI Savings, Rolex, House" />
              </Field>
              <Field label="Category">
                <Select value={form.category} onChange={(v) => setForm({ ...form, category: v })}
                  options={Object.entries(categoryMap).map(([k, c]) => ({
                    value: k,
                    label: customLabels[`asset.${k}`] || c.label,
                  }))} />
              </Field>
              <div className="grid grid-cols-3 gap-3">
                <Field label="Currency">
                  <Select value={form.currency || 'PHP'} onChange={(v) => setForm({ ...form, currency: v })}
                    options={CURRENCIES.map(c => ({ value: c, label: c }))} />
                </Field>
                <Field label="Value">
                  <Input type="number" value={form.value} onChange={(v) => setForm({ ...form, value: v })} placeholder="0" min="0" num />
                </Field>
                <Field label="Cost (opt)">
                  <Input type="number" value={form.cost} onChange={(v) => setForm({ ...form, cost: v })} placeholder="cost" min="0" num />
                </Field>
              </div>
              {form.currency && form.currency !== 'PHP' && form.value && (
                <p className="text-xs italic" style={{ color: T.textFaint }}>≈ {fmt(toPHP(form.value, form.currency, fxRates))} at current rate</p>
              )}
              <Field label="Notes (optional)">
                <Input value={form.notes || ''} onChange={(v) => setForm({ ...form, notes: v })} placeholder="branch, account #, appraisal" />
              </Field>
            </>
          )}

          {kind === 'holding' && (() => {
            const at = ASSET_TYPES[form.assetType || 'stock'];
            return (
            <>
              <Field label="Asset Type">
                <Select value={form.assetType || 'stock'} onChange={(v) => setForm({ ...form, assetType: v })}
                  options={Object.entries(ASSET_TYPES).map(([k, t]) => ({ value: k, label: t.label }))} />
              </Field>
              <div className="grid grid-cols-2 gap-3">
                <Field label={form.assetType === 'fund' ? 'Fund Name' : form.assetType === 'crypto' ? 'Symbol' : 'Ticker'}>
                  <Input value={form.ticker}
                    onChange={(v) => setForm({ ...form, ticker: at.uppercase ? v.toUpperCase() : v })}
                    placeholder={at.tickerPlaceholder} />
                </Field>
                <Field label="Display Name (optional)">
                  <Input value={form.name} onChange={(v) => setForm({ ...form, name: v })} placeholder={at.namePlaceholder} />
                </Field>
              </div>
              <div className="grid grid-cols-3 gap-3">
                <Field label={at.unitLabel}>
                  <Input type="number" value={form.shares} onChange={(v) => setForm({ ...form, shares: v })}
                    placeholder={at.sharesPlaceholder} min="0" step="any" num />
                </Field>
                <Field label="Avg Cost (₱)">
                  <Input type="number" value={form.avgCost} onChange={(v) => setForm({ ...form, avgCost: v })} placeholder={at.pricePlaceholder} min="0" step="any" num />
                </Field>
                <Field label={form.assetType === 'fund' ? 'NAVPS (₱)' : 'Current (₱)'}>
                  <Input type="number" value={form.currentPrice} onChange={(v) => setForm({ ...form, currentPrice: v })} placeholder={at.pricePlaceholder} min="0" step="any" num />
                </Field>
              </div>
              {form.shares && form.currentPrice && (
                <div className="text-xs italic px-1" style={{ color: T.textFaint }}>
                  Position value: {fmt(Number(form.shares) * Number(form.currentPrice))}
                  {form.avgCost && ` · P&L: ${fmtSign((Number(form.currentPrice) - Number(form.avgCost)) * Number(form.shares))}`}
                </div>
              )}
              <Field label="System Tag (optional)">
                <Select value={form.tag || ''} onChange={(v) => setForm({ ...form, tag: v })}
                  options={[{ value: '', label: '— None —' }, ...Object.entries(HOLDING_TAGS).map(([k, t]) => ({ value: k, label: t.label }))]} />
              </Field>
              <Field label={form.assetType === 'crypto' ? 'Exchange (optional)' : form.assetType === 'fund' ? 'Provider (optional)' : 'Broker (optional)'}>
                <Input value={form.broker || ''} onChange={(v) => setForm({ ...form, broker: v })} placeholder={at.brokerPlaceholder} />
              </Field>
              <Field label="Notes (optional)">
                <Input value={form.notes || ''} onChange={(v) => setForm({ ...form, notes: v })}
                  placeholder={form.assetType === 'crypto' ? 'wallet, staking, DCA plan' : form.assetType === 'fund' ? 'fund objective, risk profile' : 'thesis, target, EMA/Fib levels'} />
              </Field>
            </>
            );
          })()}

          {kind === 'debt' && (
            <>
              <Field label="Description">
                <Input value={form.name} onChange={(v) => setForm({ ...form, name: v })} placeholder="e.g. BPI Mastercard, Personal loan" />
              </Field>
              <Field label="Type">
                <Select value={form.type} onChange={(v) => setForm({ ...form, type: v })}
                  options={Object.entries(DEBT_TYPES).map(([k, t]) => ({ value: k, label: t.label }))} />
              </Field>
              <div className="grid grid-cols-3 gap-3">
                <Field label="Balance (₱)">
                  <Input type="number" value={form.balance} onChange={(v) => setForm({ ...form, balance: v })} placeholder="0" min="0" num />
                </Field>
                <Field label="Monthly Pmt">
                  <Input type="number" value={form.monthlyPayment} onChange={(v) => setForm({ ...form, monthlyPayment: v })} placeholder="0" min="0" num />
                </Field>
                <Field label="APR (%)">
                  <Input type="number" value={form.interestRate} onChange={(v) => setForm({ ...form, interestRate: v })} placeholder="0" min="0" step="0.01" num />
                </Field>
              </div>
            </>
          )}

          {kind === 'income' && (
            <>
              <Field label="Description">
                <Input value={form.name} onChange={(v) => setForm({ ...form, name: v })} placeholder="e.g. Day job, Brand X commission" />
              </Field>
              <Field label="Type">
                <Select value={form.type} onChange={(v) => setForm({ ...form, type: v })}
                  options={Object.entries(INCOME_TYPES).map(([k, t]) => ({ value: k, label: t.label }))} />
              </Field>
              <div className="grid grid-cols-2 gap-3">
                <Field label="Amount (₱)">
                  <Input type="number" value={form.amount} onChange={(v) => setForm({ ...form, amount: v })} placeholder="0" min="0" num />
                </Field>
                <Field label="Frequency">
                  <Select value={form.frequency} onChange={(v) => setForm({ ...form, frequency: v })}
                    options={Object.entries(FREQUENCIES).map(([k, f]) => ({ value: k, label: f.label }))} />
                </Field>
              </div>
              {form.amount && form.frequency !== 'monthly' && (
                <p className="text-xs italic" style={{ color: T.textFaint }}>≈ {fmt(toMonthly({ amount: Number(form.amount), frequency: form.frequency }))}/month</p>
              )}
              <Field label="Tax Treatment">
                <Select value={form.taxTreatment || 'none'} onChange={(v) => setForm({ ...form, taxTreatment: v })}
                  options={Object.entries(TAX_TREATMENTS).map(([k, t]) => ({ value: k, label: t.label }))} />
              </Field>
              {form.amount && (() => {
                const treatment = form.taxTreatment || 'none';
                const grossMonthly = toMonthly({ amount: Number(form.amount), frequency: form.frequency || 'monthly' });
                const { net, breakdown } = applyTaxTreatment(grossMonthly, treatment);
                if (treatment === 'none') {
                  return (
                    <p className="text-xs italic" style={{ color: T.textFaint }}>
                      No deduction. Gross {fmt(grossMonthly)}/mo lands in your account as-is. Use this for commissions, cash income, or anything where you handle taxes separately.
                    </p>
                  );
                }
                if (treatment === 'salary') {
                  return (
                    <div className="text-xs p-3 rounded-lg space-y-1" style={{ background: T.surface2, border: `1px solid ${T.border}` }}>
                      <div className="flex justify-between"><span style={{ color: T.textDim }}>Monthly gross</span><span className="num">{fmt(grossMonthly)}</span></div>
                      <div className="flex justify-between"><span style={{ color: T.textFaint }}>− Withholding tax</span><span className="num" style={{ color: T.textFaint }}>{fmt(breakdown.tax)}</span></div>
                      <div className="flex justify-between"><span style={{ color: T.textFaint }}>− SSS</span><span className="num" style={{ color: T.textFaint }}>{fmt(breakdown.sss)}</span></div>
                      <div className="flex justify-between"><span style={{ color: T.textFaint }}>− PhilHealth</span><span className="num" style={{ color: T.textFaint }}>{fmt(breakdown.philhealth)}</span></div>
                      <div className="flex justify-between"><span style={{ color: T.textFaint }}>− Pag-IBIG</span><span className="num" style={{ color: T.textFaint }}>{fmt(breakdown.pagibig)}</span></div>
                      <div className="flex justify-between pt-1.5 mt-1.5 font-medium" style={{ borderTop: `1px solid ${T.border}` }}>
                        <span>Takehome</span><span className="num" style={{ color: T.green }}>{fmt(net)}</span>
                      </div>
                    </div>
                  );
                }
                if (treatment === 'selfemployed8') {
                  return (
                    <div className="text-xs p-3 rounded-lg space-y-1" style={{ background: T.surface2, border: `1px solid ${T.border}` }}>
                      <div className="flex justify-between"><span style={{ color: T.textDim }}>Monthly gross</span><span className="num">{fmt(grossMonthly)}</span></div>
                      <div className="flex justify-between"><span style={{ color: T.textFaint }}>− 8% flat tax (above ₱250K/yr threshold)</span><span className="num" style={{ color: T.textFaint }}>{fmt(breakdown.tax)}</span></div>
                      <div className="flex justify-between pt-1.5 mt-1.5 font-medium" style={{ borderTop: `1px solid ${T.border}` }}>
                        <span>Net</span><span className="num" style={{ color: T.green }}>{fmt(net)}</span>
                      </div>
                      <p className="italic mt-2" style={{ color: T.textFaint }}>Only valid if you registered with BIR for the 8% option AND your gross is under ₱3M/yr.</p>
                    </div>
                  );
                }
                return null;
              })()}
            </>
          )}

          {kind === 'expense' && (
            <>
              <Field label="Description">
                <Input value={form.name} onChange={(v) => setForm({ ...form, name: v })} placeholder="e.g. Rent, Spotify, Credit card payment" />
              </Field>
              <Field label="Category">
                <Select value={form.category} onChange={(v) => {
                  const DEFAULT_ESSENTIAL = { housing: true, food: true, transport: true, utilities: true, debt_payment: true, savings: true, subscriptions: false, personal: false, other: false };
                  setForm({ ...form, category: v, essential: DEFAULT_ESSENTIAL[v] ?? false });
                }} options={Object.entries(SPEND_CATEGORIES).map(([k, c]) => ({ value: k, label: c.label }))} />
              </Field>
              <Field label="Monthly Amount (₱)">
                <Input type="number" value={form.amount} onChange={(v) => setForm({ ...form, amount: v })} placeholder="0" min="0" num />
              </Field>
              <Field label="Type">
                <div className="flex gap-2">
                  {[{ v: true, label: '✓ Essential', hint: 'Survives a tight month' }, { v: false, label: '✗ Non-essential', hint: 'First to cut' }].map(opt => (
                    <button key={String(opt.v)} onClick={() => setForm({ ...form, essential: opt.v })}
                      className="flex-1 py-2 px-3 rounded-xl text-sm text-left transition-all"
                      style={{
                        background: form.essential === opt.v ? (opt.v ? T.greenBg : T.redBg) : T.surface2,
                        border: `1px solid ${form.essential === opt.v ? (opt.v ? T.green : T.red) : T.border2}`,
                        color: form.essential === opt.v ? (opt.v ? T.green : T.red) : T.textDim,
                      }}>
                      <div className="font-medium">{opt.label}</div>
                      <div className="text-xs opacity-70">{opt.hint}</div>
                    </button>
                  ))}
                </div>
              </Field>
            </>
          )}

          {kind === 'category' && (
            <>
              <Field label="Category Name">
                <Input value={form.label} onChange={(v) => setForm({ ...form, label: v })}
                  placeholder="e.g. Watches, Crypto Wallet, Education Fund" autoFocus />
              </Field>
              <Field label="Icon">
                <div className="grid grid-cols-8 gap-2">
                  {Object.keys(CUSTOM_CATEGORY_ICONS).map(name => {
                    const Ico = CUSTOM_CATEGORY_ICONS[name];
                    const selected = form.iconKey === name;
                    return (
                      <button key={name} onClick={() => setForm({ ...form, iconKey: name })}
                        className="aspect-square rounded-lg flex items-center justify-center transition-all"
                        style={{
                          background: selected ? hexToTint(form.color, 0.25) : T.surface2,
                          border: `1px solid ${selected ? form.color : T.border2}`,
                          color: selected ? form.color : T.textDim,
                        }}>
                        <Ico className="w-4 h-4" />
                      </button>
                    );
                  })}
                </div>
              </Field>
              <Field label="Color">
                <div className="grid grid-cols-12 gap-2">
                  {CUSTOM_CATEGORY_COLORS.map(c => {
                    const selected = form.color === c;
                    return (
                      <button key={c} onClick={() => setForm({ ...form, color: c })}
                        className="aspect-square rounded-full transition-all"
                        style={{
                          background: c,
                          border: `2px solid ${selected ? T.text : 'transparent'}`,
                          transform: selected ? 'scale(1.1)' : 'scale(1)',
                        }} />
                    );
                  })}
                </div>
              </Field>
              {/* Live preview so the choice feels real before saving */}
              {form.label && (
                <div className="p-3 rounded-xl flex items-center gap-3"
                  style={{ background: T.surface2, border: `1px solid ${T.border}` }}>
                  <div className="w-10 h-10 rounded-full flex items-center justify-center shrink-0"
                    style={{ background: hexToTint(form.color), color: form.color }}>
                    {(() => {
                      const Ico = CUSTOM_CATEGORY_ICONS[form.iconKey] || Coins;
                      return <Ico className="w-5 h-5" />;
                    })()}
                  </div>
                  <div>
                    <div className="font-display text-lg">{form.label}</div>
                    <div className="text-xs" style={{ color: T.textFaint }}>Preview</div>
                  </div>
                </div>
              )}
            </>
          )}

          {kind === 'fx' && (
            <>
              <p className="text-xs" style={{ color: T.textFaint }}>Exchange rates to PHP. Used for any non-PHP assets.</p>
              {Object.keys(form).map(curr => (
                <Field key={curr} label={`1 ${curr} = ? PHP`}>
                  <Input type="number" value={form[curr]} onChange={(v) => setForm({ ...form, [curr]: v })} placeholder="61.45" min="0" step="any" num />
                </Field>
              ))}
            </>
          )}

          {kind === 'import' && (
            <>
              <Field label="Holdings JSON">
                <textarea value={form.jsonText} onChange={(e) => setForm({ ...form, jsonText: e.target.value })}
                  rows={8} placeholder='[{"ticker":"META","shares":4.93,"avgCost":37359,"currentPrice":37407,"broker":"IBKR"}]'
                  className="w-full px-3.5 py-2.5 rounded-lg outline-none num text-xs"
                  style={{ background: T.surface2, border: `1px solid ${T.border2}`, color: T.text, fontFamily: 'DM Mono, monospace' }} />
              </Field>
              <p className="text-xs leading-relaxed" style={{ color: T.textFaint }}>
                Required: <span style={{ color: T.accent }}>ticker</span>, <span style={{ color: T.accent }}>shares</span>. Optional: assetType (stock/crypto/fund, default stock), name, avgCost, currentPrice, broker, notes, tag.
              </p>
            </>
          )}
        </div>

        <div className="flex gap-2 mt-6">
          <button onClick={onClose} className="flex-1 py-2.5 rounded-full text-sm hover:bg-white/5"
            style={{ border: `1px solid ${T.border2}`, color: T.text }}>Cancel</button>
          <button onClick={handleSubmit} disabled={!valid} className="flex-1 py-2.5 rounded-full text-sm transition-all"
            style={{
              background: valid ? T.accent : T.border2,
              color: valid ? T.bg : T.textFaint,
              fontWeight: 500,
              cursor: valid ? 'pointer' : 'not-allowed'
            }}>
            {kind === 'import' ? 'Import' : kind === 'fx' ? 'Save rates' : (editing ? 'Save' : 'Add')}
          </button>
        </div>
      </div>
    </div>
  );
}

function Field({ label, children }) {
  return (
    <label className="block">
      <span className="text-xs uppercase tracking-widest mb-1.5 block" style={{ color: T.textFaint }}>{label}</span>
      {children}
    </label>
  );
}
function Input({ value, onChange, type = 'text', placeholder, min, step, num, autoFocus }) {
  return (
    <input type={type} value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} min={min} step={step} autoFocus={autoFocus}
      className={`w-full px-3.5 py-2.5 rounded-lg outline-none ${num ? 'num' : ''}`}
      style={{ background: T.surface2, border: `1px solid ${T.border2}`, color: T.text, colorScheme: 'dark' }} />
  );
}
function Select({ value, onChange, options }) {
  return (
    <select value={value} onChange={(e) => onChange(e.target.value)}
      className="w-full px-3.5 py-2.5 rounded-lg outline-none"
      style={{ background: T.surface2, border: `1px solid ${T.border2}`, color: T.text }}>
      {options.map(o => <option key={o.value} value={o.value} style={{ background: T.surface }}>{o.label}</option>)}
    </select>
  );
}
