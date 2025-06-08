import Stripe from 'stripe';

if (!process.env.STRIPE_SECRET_KEY) {
  throw new Error('STRIPE_SECRET_KEY is required');
}

export const stripe = new Stripe(process.env.STRIPE_SECRET_KEY, {
  apiVersion: '2025-04-30.basil', // Updated to latest API version
  typescript: true,
});
export const STRIPE_PLAN_TO_TIER = {
  price_indie_monthly: 'indie',
  price_indie_yearly: 'indie',
  price_producer_monthly: 'producer',
  price_producer_yearly: 'producer',
  price_studio_monthly: 'studio',
  price_studio_yearly: 'studio'
};

export const STRIPE_CONFIG = {
  publishableKey: process.env.STRIPE_PUBLISHABLE_KEY || '',
  webhookSecret: process.env.STRIPE_WEBHOOK_SECRET || '',
  plans: {
    indie: {
      monthly: 'price_indie_monthly',
      yearly: 'price_indie_yearly'
    },
    producer: {
      monthly: 'price_producer_monthly', 
      yearly: 'price_producer_yearly'
    },
    studio: {
      monthly: 'price_studio_monthly',
      yearly: 'price_studio_yearly'
    }

  }
};
export const STRIPE_WEBHOOK_EVENTS = {
  SUBSCRIPTION_CREATED: 'customer.subscription.created',
  SUBSCRIPTION_UPDATED: 'customer.subscription.updated',
  SUBSCRIPTION_DELETED: 'customer.subscription.deleted',
  INVOICE_PAYMENT_SUCCEEDED: 'invoice.payment_succeeded',
  INVOICE_PAYMENT_FAILED: 'invoice.payment_failed',
  TRIAL_WILL_END: 'customer.subscription.trial_will_end'
};
export const STRIPE_PRICES = {
  indie: {
    monthly: STRIPE_CONFIG.plans.indie.monthly,
    yearly: STRIPE_CONFIG.plans.indie.yearly
  },
  producer: {
    monthly: STRIPE_CONFIG.plans.producer.monthly,
    yearly: STRIPE_CONFIG.plans.producer.yearly
  },
  studio: {
    monthly: STRIPE_CONFIG.plans.studio.monthly,
    yearly: STRIPE_CONFIG.plans.studio.yearly
  }
};
export const STRIPE_PRICE_IDS = Object.values(STRIPE_PRICES).flatMap(p => [p.monthly, p.yearly]);
export const STRIPE_PRICE_TITLES = {
  [STRIPE_PRICES.indie.monthly]: 'Indie Monthly',
  [STRIPE_PRICES.indie.yearly]: 'Indie Yearly',
  [STRIPE_PRICES.producer.monthly]: 'Producer Monthly',
  [STRIPE_PRICES.producer.yearly]: 'Producer Yearly',
  [STRIPE_PRICES.studio.monthly]: 'Studio Monthly',
  [STRIPE_PRICES.studio.yearly]: 'Studio Yearly'
};

export const TRIAL_PERIOD_DAYS = 14; // Default trial period in days
export const TRIAL_START_DATE = new Date('2024-01-01'); // Example fixed trial start date
export const TRIAL_END_DATE = new Date('2024-01-15'); // Example fixed trial end date
export const isTrialActive = (trialStartDate: Date | null, trialEndDate: Date | null): boolean => {
  if (!trialStartDate || !trialEndDate) return false;
  const now = new Date();
  return now >= trialStartDate && now <= trialEndDate;
};




