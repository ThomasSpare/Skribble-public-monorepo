// backend/src/routes/stripe.ts
import express, { Request, Response } from 'express';
import { body, validationResult } from 'express-validator';
import { authenticateToken } from '../middleware/auth';
import { stripe } from '../config/stripe';
import { UserModel } from '../models/User';
import { pool } from '../config/database';

const router = express.Router();

// Test route
router.get('/test', (req, res) => {
  res.json({
    success: true,
    message: 'Stripe routes are working!',
    timestamp: new Date().toISOString()
  });
});

// Create Stripe customer and subscription
router.post('/create-subscription', [
  authenticateToken,
  body('priceId').notEmpty(),
  body('tier').isIn(['indie', 'producer', 'studio']),
  body('referralCode').optional()
], async (req: Request, res: Response) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        error: { message: 'Validation failed', details: errors.array() }
      });
    }

    const { priceId, tier, referralCode } = req.body;
    const userId = req.user!.userId;

    // Get user info
    const user = await UserModel.findById(userId);
    if (!user) {
      return res.status(404).json({
        success: false,
        error: { message: 'User not found' }
      });
    }

    let customer;

    // Create or retrieve Stripe customer
    if (user.stripe_customer_id) {
      customer = await stripe.customers.retrieve(user.stripe_customer_id);
    } else {
      customer = await stripe.customers.create({
        email: user.email,
        metadata: {
          userId: userId,
          username: user.username
        }
      });

      // Update user with Stripe customer ID
      await UserModel.update(userId, { stripeCustomerId: customer.id });
    }

    // Handle referral code if provided
    let couponId = null;
    if (referralCode) {
      // Verify referral code exists
      const referrer = await pool.query(
        'SELECT id FROM users WHERE referral_code = $1',
        [referralCode]
      );

      if (referrer.rows.length > 0) {
        // Create a one-time discount coupon for first month free
        const coupon = await stripe.coupons.create({
          duration: 'once',
          amount_off: 1900, // $19 off (approximate first month)
          currency: 'usd',
          metadata: {
            referralCode: referralCode,
            newUserId: userId
          }
        });
        couponId = coupon.id;

        // Track the referral
        await pool.query(
          'UPDATE users SET referred_by = $1 WHERE id = $2',
          [referralCode, userId]
        );
      }
    }

    // Create subscription
    const subscription = await stripe.subscriptions.create({
      customer: customer.id,
      items: [{ price: priceId }],
      payment_behavior: 'default_incomplete',
      payment_settings: { save_default_payment_method: 'on_subscription' },
      expand: ['latest_invoice.payment_intent'],
      coupon: couponId || undefined,
      metadata: {
        userId: userId,
        tier: tier,
        referralCode: referralCode || ''
      }
    });

    res.json({
      success: true,
      data: {
        subscriptionId: subscription.id,
        clientSecret: (subscription.latest_invoice as any)?.payment_intent?.client_secret,
        customerId: customer.id
      }
    });

  } catch (error) {
    console.error('Create subscription error:', error);
    res.status(500).json({
      success: false,
      error: { message: 'Failed to create subscription' }
    });
  }
});

// Generate referral code
router.post('/generate-referral-code', authenticateToken, async (req: Request, res: Response) => {
  try {
    const userId = req.user!.userId;

    // Check if user already has a referral code
    const user = await UserModel.findById(userId);
    if (!user) {
      return res.status(404).json({
        success: false,
        error: { message: 'User not found' }
      });
    }

    let referralCode;
    
    // Generate new referral code if user doesn't have one
    if (!user.referral_code) {
      referralCode = await UserModel.generateReferralCode();
    } else {
      // Return existing referral code
      referralCode = user.referral_code;
    }

    res.json({
      success: true,
      data: { referralCode }
    });

  } catch (error) {
    console.error('Generate referral code error:', error);
    res.status(500).json({
      success: false,
      error: { message: 'Failed to generate referral code' }
    });
  }
});

// Get referral stats
router.get('/referral-stats', authenticateToken, async (req: Request, res: Response) => {
  try {
    const userId = req.user!.userId;
    const stats = await UserModel.getReferralStats(userId);

    res.json({
      success: true,
      data: stats
    });

  } catch (error) {
    console.error('Get referral stats error:', error);
    res.status(500).json({
      success: false,
      error: { message: 'Failed to fetch referral stats' }
    });
  }
});

// Handle successful subscription (webhook or manual confirmation)
router.post('/subscription-success', [
  authenticateToken,
  body('subscriptionId').notEmpty(),
  body('tier').isIn(['indie', 'producer', 'studio'])
], async (req: Request, res: Response) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        error: { message: 'Validation failed', details: errors.array() }
      });
    }

    const { subscriptionId, tier } = req.body;
    const userId = req.user!.userId;

    // Verify subscription with Stripe
    const subscription = await stripe.subscriptions.retrieve(subscriptionId);
    
    if (subscription.status === 'active' || subscription.status === 'trialing') {
      // Update user subscription tier
      await UserModel.updateSubscription(userId, tier, subscription.customer as string);

      // If this was a referral, give the referrer a credit
      const user = await pool.query('SELECT referred_by FROM users WHERE id = $1', [userId]);
      if (user.rows[0]?.referred_by) {
        const referralCode = user.rows[0].referred_by;
        
        // Find the referrer
        const referrer = await pool.query(
          'SELECT id FROM users WHERE referral_code = $1',
          [referralCode]
        );

        if (referrer.rows.length > 0) {
          // Create a credit for the referrer (this could be implemented as account credit)
          // For now, we'll just track it in the database
          await pool.query(`
            INSERT INTO referral_credits (user_id, amount, description, created_at)
            VALUES ($1, $2, $3, NOW())
            ON CONFLICT DO NOTHING
          `, [
            referrer.rows[0].id,
            1900, // $19 credit
            `Referral bonus for user ${userId}`
          ]);
        }
      }

      res.json({
        success: true,
        data: { message: 'Subscription activated successfully' }
      });
    } else {
      res.status(400).json({
        success: false,
        error: { message: 'Subscription not active' }
      });
    }

  } catch (error) {
    console.error('Subscription success error:', error);
    res.status(500).json({
      success: false,
      error: { message: 'Failed to process subscription success' }
    });
  }
});

// Cancel subscription
router.post('/cancel-subscription', authenticateToken, async (req: Request, res: Response) => {
  try {
    const userId = req.user!.userId;
    
    const user = await UserModel.findById(userId);
    if (!user || !user.stripe_customer_id) {
      return res.status(404).json({
        success: false,
        error: { message: 'No subscription found' }
      });
    }

    // Get active subscriptions
    const subscriptions = await stripe.subscriptions.list({
      customer: user.stripe_customer_id,
      status: 'active'
    });

    if (subscriptions.data.length === 0) {
      return res.status(404).json({
        success: false,
        error: { message: 'No active subscription found' }
      });
    }

    // Cancel the first active subscription
    const subscription = subscriptions.data[0];
    await stripe.subscriptions.update(subscription.id, {
      cancel_at_period_end: true
    });

    res.json({
      success: true,
      data: { message: 'Subscription will be canceled at period end' }
    });

  } catch (error) {
    console.error('Cancel subscription error:', error);
    res.status(500).json({
      success: false,
      error: { message: 'Failed to cancel subscription' }
    });
  }
});

// Webhook endpoint for Stripe events
router.post('/webhook', express.raw({ type: 'application/json' }), async (req: Request, res: Response) => {
  const sig = req.headers['stripe-signature'];
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

  if (!sig || !webhookSecret) {
    return res.status(400).send('Missing signature or webhook secret');
  }

  let event;

  try {
    event = stripe.webhooks.constructEvent(req.body, sig, webhookSecret);
  } catch (err: any) {
    console.log(`Webhook signature verification failed:`, err.message);
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }

  try {
    switch (event.type) {
      case 'customer.subscription.created':
      case 'customer.subscription.updated':
        const subscription = event.data.object;
        const userId = subscription.metadata.userId;
        const tier = subscription.metadata.tier;

        if (userId && tier && subscription.status === 'active') {
          await UserModel.updateSubscription(userId, tier, subscription.customer as string);
        }
        break;

      case 'customer.subscription.deleted':
        const deletedSubscription = event.data.object;
        const deletedUserId = deletedSubscription.metadata.userId;

        if (deletedUserId) {
          await UserModel.updateSubscription(deletedUserId, 'free');
        }
        break;

      default:
        console.log(`Unhandled event type ${event.type}`);
    }

    res.json({ received: true });
  } catch (error) {
    console.error('Webhook processing error:', error);
    res.status(500).json({ error: 'Webhook processing failed' });
  }
});

router.post('/create-checkout-session', [
  authenticateToken,
  body('priceId').notEmpty(),
  body('tier').isIn(['indie', 'producer', 'studio']),
  body('referralCode').optional()
], async (req: Request, res: Response) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        error: { message: 'Validation failed', details: errors.array() }
      });
    }

    const { priceId, tier, referralCode } = req.body;
    const userId = req.user!.userId;

    // Get user info
    const userResult = await pool.query(
      'SELECT id, email, username FROM users WHERE id = $1',
      [userId]
    );

    if (userResult.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: { message: 'User not found' }
      });
    }

    const user = userResult.rows[0];

    // Check if referral code is valid
    let couponId = null;
    if (referralCode) {
      const referrer = await pool.query(
        'SELECT id FROM users WHERE referral_code = $1',
        [referralCode]
      );

      if (referrer.rows.length > 0) {
        // Create a one-time discount coupon for referral
        try {
          const coupon = await stripe.coupons.create({
            duration: 'once',
            percent_off: 100, // First month 100% off
            name: 'Referral Discount',
            metadata: {
              referralCode: referralCode,
              newUserId: userId,
              referrerId: referrer.rows[0].id
            }
          });
          couponId = coupon.id;
        } catch (couponError) {
          console.error('Failed to create coupon:', couponError);
          // Continue without coupon if creation fails
        }
      }
    }

    // Create Stripe Checkout Session
    const session = await stripe.checkout.sessions.create({
      customer_email: user.email,
      payment_method_types: ['card'],
      line_items: [
        {
          price: priceId,
          quantity: 1,
        },
      ],
      mode: 'subscription',
      allow_promotion_codes: true,
      discounts: couponId ? [{ coupon: couponId }] : undefined,
      success_url: `${process.env.FRONTEND_URL || 'http://localhost:3000'}/dashboard?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${process.env.FRONTEND_URL || 'http://localhost:3000'}/payment?plan=${tier}&ref=${referralCode || ''}`,
      metadata: {
        userId: userId,
        tier: tier,
        referralCode: referralCode || '',
      },
      subscription_data: {
        metadata: {
          userId: userId,
          tier: tier,
          referralCode: referralCode || '',
        },
        trial_period_days: referralCode ? 0 : 14, // No trial if referral gives free month
      },
    });

    // Track the referral in database if valid
    if (referralCode && couponId) {
      try {
        await pool.query(
          'UPDATE users SET referred_by = $1 WHERE id = $2',
          [referralCode, userId]
        );
      } catch (dbError) {
        console.error('Failed to update referral in database:', dbError);
      }
    }

    res.json({
      success: true,
      data: {
        checkoutUrl: session.url,
        sessionId: session.id
      }
    });

  } catch (error) {
    console.error('Create checkout session error:', error);
    res.status(500).json({
      success: false,
      error: { message: 'Failed to create checkout session' }
    });
  }
});

// Handle successful checkout (called by Stripe webhook or redirect)
router.post('/checkout-success', [
  body('sessionId').notEmpty()
], async (req: Request, res: Response) => {
  try {
    const { sessionId } = req.body;

    // Retrieve the checkout session from Stripe
    const session = await stripe.checkout.sessions.retrieve(sessionId, {
      expand: ['subscription']
    });

    if (!session.metadata?.userId) {
      return res.status(400).json({
        success: false,
        error: { message: 'Invalid session - missing user ID' }
      });
    }

    const userId = session.metadata.userId;
    const tier = session.metadata.tier;
    const referralCode = session.metadata.referralCode;

    // Update user subscription status
    await pool.query(
      `UPDATE users 
       SET subscription_tier = $1, subscription_status = 'active', 
           stripe_customer_id = $2, updated_at = NOW()
       WHERE id = $3`,
      [tier, session.customer, userId]
    );

    // If this was a referral, give the referrer a credit/reward
    if (referralCode) {
      try {
        const referrer = await pool.query(
          'SELECT id FROM users WHERE referral_code = $1',
          [referralCode]
        );

        if (referrer.rows.length > 0) {
          // You could implement a credits system here
          // For now, just log the successful referral
          console.log(`Successful referral: ${referralCode} -> ${userId}`);
        }
      } catch (referralError) {
        console.error('Failed to process referral reward:', referralError);
      }
    }

    res.json({
      success: true,
      data: {
        message: 'Subscription activated successfully',
        tier: tier,
        customerId: session.customer
      }
    });

  } catch (error) {
    console.error('Checkout success error:', error);
    res.status(500).json({
      success: false,
      error: { message: 'Failed to process checkout success' }
    });
  }
});

// Get checkout session status (for frontend to check)
router.get('/checkout-session/:sessionId', async (req: Request, res: Response) => {
  try {
    const { sessionId } = req.params;

    const session = await stripe.checkout.sessions.retrieve(sessionId);

    res.json({
      success: true,
      data: {
        status: session.payment_status,
        customerEmail: session.customer_email,
        metadata: session.metadata
      }
    });

  } catch (error) {
    console.error('Get checkout session error:', error);
    res.status(500).json({
      success: false,
      error: { message: 'Failed to retrieve checkout session' }
    });
  }
});

export default router;