// backend/src/routes/stripe.ts
import express from 'express';
import Stripe from 'stripe';
import { authenticateToken } from '../middleware/auth';
import { pool } from '../config/database';
import { User, ApiResponse } from '@/types';

const router = express.Router();

// Define subscription-specific interfaces that extend your base types
interface SubscriptionInfo {
  tier: string;
  status: string;
  currentPeriodEnd?: string;
  cancelAtPeriodEnd?: boolean;
  trialEnd?: string | null;
  paymentMethod?: {
    type: string;
    last4: string;
    expiryMonth: number;
    expiryYear: number;
  };
}

interface AuthenticatedRequest extends express.Request {
  user: {
    userId: string;
    email: string;
  };
}

interface ReferralStats {
  referral_code: string | null;
  successful_referrals: number;
  pending_referrals: number;
  rewards_earned: number;
}

// Initialize Stripe
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: '2023-10-16',
  typescript: true,
});

// Create checkout session with trial support
router.post('/create-checkout-session', authenticateToken, async (req: AuthenticatedRequest, res: express.Response<ApiResponse<{ url: string }>>) => {
  try {
    const { priceId, referralCode } = req.body;
    const userId = req.user.userId;

    // Get or create Stripe customer
    let customer = await getOrCreateCustomer(userId);

    // Check if user has existing subscription
    const existingSubscription = await stripe.subscriptions.list({
      customer: customer.id,
      status: 'active',
      limit: 1
    });

    if (existingSubscription.data.length > 0) {
      return res.status(400).json({
        success: false,
        error: { message: 'User already has an active subscription' }
      });
    }

    // Setup session parameters
    const sessionParams: Stripe.Checkout.SessionCreateParams = {
      customer: customer.id,
      payment_method_types: ['card'],
      line_items: [{
        price: priceId,
        quantity: 1,
      }],
      mode: 'subscription',
      success_url: `${process.env.FRONTEND_URL}/dashboard?success=true&session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${process.env.FRONTEND_URL}/pricing?canceled=true`,
      metadata: {
        userId: userId,
        referralCode: referralCode || ''
      },
      subscription_data: {
        trial_period_days: 30, // 1 month trial
        metadata: {
          userId: userId,
          referralCode: referralCode || ''
        }
      }
    };

    // Apply referral discount if code provided
    if (referralCode) {
      const isValidReferral = await validateReferralCode(referralCode, userId);
      if (isValidReferral) {
        sessionParams.discounts = [{
          coupon: 'first_month_free' // Create this coupon in Stripe dashboard
        }];
      }
    }

    const session = await stripe.checkout.sessions.create(sessionParams);

    res.json({
      success: true,
      data: { url: session.url! }
    });

  } catch (error) {
    console.error('Checkout session error:', error);
    res.status(500).json({
      success: false,
      error: { message: 'Failed to create checkout session' }
    });
  }
});

// Start free trial (no payment required)
router.post('/start-trial', authenticateToken, async (req: AuthenticatedRequest, res: express.Response<ApiResponse<{ message: string }>>) => {
  try {
    const userId = req.user.userId;

    // Check if user already had a trial
    const existingUser = await pool.query(
      'SELECT subscription_tier, trial_used, created_at FROM users WHERE id = $1',
      [userId]
    );

    if (existingUser.rows[0].trial_used) {
      return res.status(400).json({
        success: false,
        error: { message: 'Trial already used' }
      });
    }

    // Update user to trial status
    await pool.query(
      `UPDATE users 
       SET subscription_tier = 'indie_trial', 
           trial_used = true, 
           trial_end_date = NOW() + INTERVAL '30 days'
       WHERE id = $1`,
      [userId]
    );

    // Log the trial start event
    await pool.query(
      `INSERT INTO subscription_analytics (user_id, event_type, tier, metadata)
       VALUES ($1, $2, $3, $4)`,
      [userId, 'trial_started', 'indie_trial', JSON.stringify({ trial_days: 30 })]
    );

    res.json({
      success: true,
      data: { message: 'Trial started successfully' }
    });

  } catch (error) {
    console.error('Trial start error:', error);
    res.status(500).json({
      success: false,
      error: { message: 'Failed to start trial' }
    });
  }
});

// Generate referral code
router.post('/generate-referral-code', authenticateToken, async (req: AuthenticatedRequest, res: express.Response<ApiResponse<{ referralCode: string }>>) => {
  try {
    const userId = req.user.userId;
    
    // Generate unique referral code
    const referralCode = `REF${userId.slice(0, 8).toUpperCase()}${Date.now().toString(36).toUpperCase()}`;
    
    await pool.query(
      'UPDATE users SET referral_code = $1 WHERE id = $2',
      [referralCode, userId]
    );

    res.json({
      success: true,
      data: { referralCode }
    });

  } catch (error) {
    console.error('Referral code generation error:', error);
    res.status(500).json({
      success: false,
      error: { message: 'Failed to generate referral code' }
    });
  }
});

// Get referral stats
router.get('/referral-stats', authenticateToken, async (req: AuthenticatedRequest, res: express.Response<ApiResponse<ReferralStats>>) => {
  try {
    const userId = req.user.userId;

    const stats = await pool.query(`
      SELECT 
        u.referral_code,
        COUNT(CASE WHEN r.status = 'completed' THEN 1 END) as successful_referrals,
        COUNT(CASE WHEN r.status = 'pending' THEN 1 END) as pending_referrals,
        COALESCE(u.referral_rewards_earned, 0) as rewards_earned
      FROM users u
      LEFT JOIN referrals r ON u.id = r.referrer_user_id
      WHERE u.id = $1
      GROUP BY u.id, u.referral_code, u.referral_rewards_earned
    `, [userId]);

    const result = stats.rows[0] || {
      referral_code: null,
      successful_referrals: 0,
      pending_referrals: 0,
      rewards_earned: 0
    };

    res.json({
      success: true,
      data: result
    });

  } catch (error) {
    console.error('Referral stats error:', error);
    res.status(500).json({
      success: false,
      error: { message: 'Failed to fetch referral stats' }
    });
  }
});

// Get subscription info
router.get('/subscription-info', authenticateToken, async (req: AuthenticatedRequest, res: express.Response<ApiResponse<SubscriptionInfo>>) => {
  try {
    const userId = req.user.userId;

    const userResult = await pool.query(`
      SELECT subscription_tier, subscription_status, stripe_customer_id, 
             stripe_subscription_id, trial_end_date
      FROM users WHERE id = $1
    `, [userId]);

    const user = userResult.rows[0];
    
    // Initialize with base subscription info
    const subscriptionInfo: SubscriptionInfo = {
      tier: user.subscription_tier,
      status: user.subscription_status || 'inactive'
    };

    // If user has a Stripe subscription, get detailed info
    if (user.stripe_subscription_id) {
      try {
        const subscription = await stripe.subscriptions.retrieve(user.stripe_subscription_id);
        
        // Update subscription info with Stripe data
        subscriptionInfo.status = subscription.status;
        subscriptionInfo.currentPeriodEnd = new Date(subscription.current_period_end * 1000).toISOString();
        subscriptionInfo.cancelAtPeriodEnd = subscription.cancel_at_period_end;
        subscriptionInfo.trialEnd = subscription.trial_end ? new Date(subscription.trial_end * 1000).toISOString() : null;

        // Get payment method if available
        if (subscription.default_payment_method) {
          const paymentMethod = await stripe.paymentMethods.retrieve(subscription.default_payment_method as string);
          if (paymentMethod.card) {
            subscriptionInfo.paymentMethod = {
              type: paymentMethod.card.brand,
              last4: paymentMethod.card.last4,
              expiryMonth: paymentMethod.card.exp_month,
              expiryYear: paymentMethod.card.exp_year
            };
          }
        }
      } catch (stripeError) {
        console.error('Error fetching Stripe subscription:', stripeError);
        // Continue with basic info if Stripe fails
      }
    }

    // Add trial info if applicable
    if (user.trial_end_date && user.subscription_tier.includes('trial')) {
      subscriptionInfo.trialEnd = user.trial_end_date;
    }

    res.json({
      success: true,
      data: subscriptionInfo
    });

  } catch (error) {
    console.error('Subscription info error:', error);
    res.status(500).json({
      success: false,
      error: { message: 'Failed to fetch subscription info' }
    });
  }
});

// Create billing portal session
router.post('/create-portal-session', authenticateToken, async (req: AuthenticatedRequest, res: express.Response<ApiResponse<{ url: string }>>) => {
  try {
    const userId = req.user.userId;
    
    const userResult = await pool.query(
      'SELECT stripe_customer_id FROM users WHERE id = $1',
      [userId]
    );

    const user = userResult.rows[0];
    if (!user.stripe_customer_id) {
      return res.status(400).json({
        success: false,
        error: { message: 'No billing account found' }
      });
    }

    const session = await stripe.billingPortal.sessions.create({
      customer: user.stripe_customer_id,
      return_url: `${process.env.FRONTEND_URL}/dashboard`
    });

    res.json({
      success: true,
      data: { url: session.url }
    });

  } catch (error) {
    console.error('Portal session error:', error);
    res.status(500).json({
      success: false,
      error: { message: 'Failed to create billing portal session' }
    });
  }
});

// Validate referral code (public endpoint)
router.post('/validate-referral', async (req: express.Request, res: express.Response<ApiResponse<{ valid: boolean; referrerName?: string }>>) => {
  try {
    const { referralCode } = req.body;

    if (!referralCode) {
      return res.status(400).json({
        success: false,
        error: { message: 'Referral code required' }
      });
    }

    const referrer = await pool.query(
      'SELECT id, username FROM users WHERE referral_code = $1',
      [referralCode]
    );

    if (referrer.rows.length === 0) {
      return res.json({
        success: false,
        error: { message: 'Invalid referral code' }
      });
    }

    res.json({
      success: true,
      data: { 
        valid: true,
        referrerName: referrer.rows[0].username 
      }
    });

  } catch (error) {
    console.error('Referral validation error:', error);
    res.status(500).json({
      success: false,
      error: { message: 'Failed to validate referral code' }
    });
  }
});

// Webhook handler for Stripe events
router.post('/webhook', express.raw({ type: 'application/json' }), async (req: express.Request, res: express.Response) => {
  const sig = req.headers['stripe-signature'];
  let event;

  try {
    event = stripe.webhooks.constructEvent(req.body, sig as string, process.env.STRIPE_WEBHOOK_SECRET!);
  } catch (err: any) {
    console.error('Webhook signature verification failed:', err.message);
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }

  try {
    switch (event.type) {
      case 'checkout.session.completed':
        await handleCheckoutCompleted(event.data.object);
        break;
      case 'customer.subscription.created':
        await handleSubscriptionCreated(event.data.object);
        break;
      case 'customer.subscription.updated':
        await handleSubscriptionUpdated(event.data.object);
        break;
      case 'customer.subscription.deleted':
        await handleSubscriptionDeleted(event.data.object);
        break;
      case 'invoice.payment_succeeded':
        await handlePaymentSucceeded(event.data.object);
        break;
      case 'invoice.payment_failed':
        await handlePaymentFailed(event.data.object);
        break;
      default:
        console.log(`Unhandled event type: ${event.type}`);
    }

    res.json({ received: true });
  } catch (error) {
    console.error('Webhook handler error:', error);
    res.status(500).json({ error: 'Webhook handler failed' });
  }
});

// Helper functions
async function getOrCreateCustomer(userId: string) {
  const user = await pool.query('SELECT * FROM users WHERE id = $1', [userId]);
  const userData = user.rows[0];

  if (userData.stripe_customer_id) {
    try {
      return await stripe.customers.retrieve(userData.stripe_customer_id);
    } catch (error) {
      // Customer doesn't exist in Stripe, create new one
    }
  }

  // Create new customer
  const customer = await stripe.customers.create({
    email: userData.email,
    metadata: { userId: userId }
  });

  // Update user with customer ID
  await pool.query(
    'UPDATE users SET stripe_customer_id = $1 WHERE id = $2',
    [customer.id, userId]
  );

  return customer;
}

async function validateReferralCode(referralCode: string, userId: string): Promise<boolean> {
  const referrer = await pool.query(
    'SELECT id FROM users WHERE referral_code = $1 AND id != $2',
    [referralCode, userId]
  );

  if (referrer.rows.length === 0) return false;

  // Check if this referral already exists (using your table structure)
  const existingReferral = await pool.query(
    'SELECT id FROM referrals WHERE referrer_user_id = $1 AND referred_user_id = $2',
    [referrer.rows[0].id, userId]
  );

  if (existingReferral.rows.length > 0) return false;

  // Create referral record (using your table structure)
  await pool.query(
    'INSERT INTO referrals (referrer_user_id, referred_user_id, referral_code, status) VALUES ($1, $2, $3, $4)',
    [referrer.rows[0].id, userId, referralCode, 'pending']
  );

  return true;
}

async function handleCheckoutCompleted(session: any): Promise<void> {
  const userId = session.metadata.userId;
  const referralCode = session.metadata.referralCode;

  if (referralCode) {
    // Mark referral as completed and award rewards (using your table structure)
    await pool.query(`
      UPDATE referrals 
      SET status = 'completed', completed_at = NOW() 
      WHERE referred_user_id = $1 AND status = 'pending'
    `, [userId]);

    // Award referral rewards to both parties
    const referrer = await pool.query(
      'SELECT referrer_user_id FROM referrals WHERE referred_user_id = $1',
      [userId]
    );

    if (referrer.rows.length > 0) {
      await pool.query(
        'UPDATE users SET referral_rewards_earned = COALESCE(referral_rewards_earned, 0) + 1 WHERE id = $1',
        [referrer.rows[0].referrer_user_id]
      );
    }
  }

  // Log the event
  await pool.query(
    'INSERT INTO subscription_analytics (user_id, event_type, stripe_event_id, metadata) VALUES ($1, $2, $3, $4)',
    [userId, 'checkout_completed', session.id, JSON.stringify(session)]
  );
}

async function handleSubscriptionCreated(subscription: any): Promise<void> {
  const userId = subscription.metadata.userId;
  const priceId = subscription.items.data[0].price.id;
  
  // Map price ID to tier
  const tierMap: Record<string, string> = {
    [process.env.STRIPE_PRICE_INDIE_MONTHLY!]: 'indie',
    [process.env.STRIPE_PRICE_PRODUCER_MONTHLY!]: 'producer',
    [process.env.STRIPE_PRICE_STUDIO_MONTHLY!]: 'studio'
  };

  const tier = tierMap[priceId] || 'indie';

  await pool.query(`
    UPDATE users 
    SET subscription_tier = $1, 
        stripe_subscription_id = $2,
        subscription_status = $3
    WHERE id = $4
  `, [tier, subscription.id, subscription.status, userId]);

  // Log the event
  await pool.query(
    'INSERT INTO subscription_analytics (user_id, event_type, tier, stripe_event_id, metadata) VALUES ($1, $2, $3, $4, $5)',
    [userId, 'subscription_created', tier, subscription.id, JSON.stringify(subscription)]
  );
}

async function handleSubscriptionUpdated(subscription: any): Promise<void> {
  await pool.query(`
    UPDATE users 
    SET subscription_status = $1
    WHERE stripe_subscription_id = $2
  `, [subscription.status, subscription.id]);
}

async function handleSubscriptionDeleted(subscription: any): Promise<void> {
  await pool.query(`
    UPDATE users 
    SET subscription_tier = 'free',
        subscription_status = 'cancelled',
        stripe_subscription_id = NULL
    WHERE stripe_subscription_id = $1
  `, [subscription.id]);
}

async function handlePaymentSucceeded(invoice: any): Promise<void> {
  // Log successful payment
  await pool.query(
    'INSERT INTO subscription_analytics (user_id, event_type, amount_cents, stripe_event_id, metadata) VALUES ((SELECT id FROM users WHERE stripe_customer_id = $1), $2, $3, $4, $5)',
    [invoice.customer, 'payment_succeeded', invoice.amount_paid, invoice.id, JSON.stringify(invoice)]
  );
}

async function handlePaymentFailed(invoice: any): Promise<void> {
  // Handle failed payment - update user status
  await pool.query(`
    UPDATE users 
    SET subscription_status = 'past_due'
    WHERE stripe_customer_id = $1
  `, [invoice.customer]);

  // Log failed payment
  await pool.query(
    'INSERT INTO subscription_analytics (user_id, event_type, amount_cents, stripe_event_id, metadata) VALUES ((SELECT id FROM users WHERE stripe_customer_id = $1), $2, $3, $4, $5)',
    [invoice.customer, 'payment_failed', invoice.amount_due, invoice.id, JSON.stringify(invoice)]
  );
}

export default router;