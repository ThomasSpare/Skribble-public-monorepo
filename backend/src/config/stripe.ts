// backend/src/config/stripe.ts
import Stripe from 'stripe';

if (!process.env.STRIPE_SECRET_KEY) {
    throw new Error('STRIPE_SECRET_KEY is required');
}

export const stripe = new Stripe(process.env.STRIPE_SECRET_KEY, {
    apiVersion: '2024-11-20.acacia',
});

// Price IDs from your Stripe Dashboard (you'll create these in Stripe)
export const STRIPE_PRICES = {
    indie: {
        monthly: process.env.STRIPE_PRICE_INDIE_MONTHLY || 'price_indie_monthly',
        yearly: process.env.STRIPE_PRICE_INDIE_YEARLY || 'price_indie_yearly'
    },
    producer: {
        monthly: process.env.STRIPE_PRICE_PRODUCER_MONTHLY || 'price_producer_monthly', 
        yearly: process.env.STRIPE_PRICE_PRODUCER_YEARLY || 'price_producer_yearly'
    },
    studio: {
        monthly: process.env.STRIPE_PRICE_STUDIO_MONTHLY || 'price_studio_monthly',
        yearly: process.env.STRIPE_PRICE_STUDIO_YEARLY || 'price_studio_yearly'
    }
} as const;

export const TRIAL_PERIOD_DAYS = 7;

// Subscription tier mapping
export const STRIPE_PLAN_TO_TIER: Record<string, 'indie' | 'producer' | 'studio'> = {
    [STRIPE_PRICES.indie.monthly]: 'indie',
    [STRIPE_PRICES.indie.yearly]: 'indie',
    [STRIPE_PRICES.producer.monthly]: 'producer',
    [STRIPE_PRICES.producer.yearly]: 'producer',
    [STRIPE_PRICES.studio.monthly]: 'studio',
    [STRIPE_PRICES.studio.yearly]: 'studio',
};
