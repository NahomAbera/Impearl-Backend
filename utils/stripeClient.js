const Stripe = require('stripe');

let stripe;

const getStripe = () => {
  if (!stripe) {
    if (!process.env.STRIPE_SECRET_KEY) {
      throw new Error('STRIPE_SECRET_KEY is not configured');
    }
    stripe = new Stripe(process.env.STRIPE_SECRET_KEY, {
      apiVersion: '2024-06-20',
    });
  }
  return stripe;
};

const getFeePercent = () => {
  const pct = Number(process.env.PLATFORM_FEE_PERCENT || 10);
  return pct / 100;
};

const calculatePaymentBreakdown = (baseUsd) => {
  const baseCents = Math.round(Number(baseUsd || 0) * 100);
  const feeCents = Math.round(baseCents * getFeePercent());
  const totalCents = baseCents + feeCents;
  return { baseCents, feeCents, totalCents };
};

module.exports = { getStripe, calculatePaymentBreakdown };
