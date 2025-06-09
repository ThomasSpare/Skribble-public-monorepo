import Stripe from 'stripe';

if (!process.env.STRIPE_SECRET_KEY) {
  throw new Error('STRIPE_SECRET_KEY is required');
}

export const stripe = new Stripe(process.env.STRIPE_SECRET_KEY, {
  apiVersion: '2023-10-16', // Compatible with current Stripe package
  typescript: true,
});

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