// backend/src/services/SubscriptionService.ts
import { stripe, STRIPE_PRICES, TRIAL_PERIOD_DAYS, STRIPE_PLAN_TO_TIER } from '../config/stripe';
import { pool } from '../config/database';
import { UserModel } from '../models/User';
import { v4 as uuidv4 } from 'uuid';

export class SubscriptionService {
    
    // Start free trial for new user
    static async startFreeTrial(userId: string): Promise<void> {
        const trialStart = new Date();
        const trialEnd = new Date(trialStart.getTime() + (TRIAL_PERIOD_DAYS * 24 * 60 * 60 * 1000));

        await pool.query(`
            UPDATE users 
            SET trial_start_date = $1, trial_end_date = $2, subscription_tier = 'indie'
            WHERE id = $3
        `, [trialStart, trialEnd, userId]);
    }

    // Check if user's trial is still active
    static async isTrialActive(userId: string): Promise<boolean> {
        const result = await pool.query(`
            SELECT trial_start_date, trial_end_date 
            FROM users 
            WHERE id = $1
        `, [userId]);

        if (result.rows.length === 0) return false;
        
        const { trial_start_date, trial_end_date } = result.rows[0];
        if (!trial_start_date || !trial_end_date) return false;

        const now = new Date();
        return now >= trial_start_date && now <= trial_end_date;
    }

    // Create Stripe checkout session
    static async createCheckoutSession(
        userId: string, 
        priceId: string, 
        referralCode?: string
    ): Promise<{ sessionId: string; url: string }> {
        
        const user = await UserModel.findById(userId);
        if (!user) throw new Error('User not found');

        // Create or get Stripe customer
        let customerId = user.stripeCustomerId;
        if (!customerId) {
            const customer = await stripe.customers.create({
                email: user.email,
                metadata: { userId: user.id }
            });
            customerId = customer.id;
            await UserModel.updateSubscription(userId, user.subscriptionTier, customerId);
        }

        // Check if user has active trial
        const hasActiveTrial = await this.isTrialActive(userId);
        
        const sessionParams: any = {
            customer: customerId,
            payment_method_types: ['card'],
            line_items: [{
                price: priceId,
                quantity: 1,
            }],
            mode: 'subscription',
            success_url: `${process.env.FRONTEND_URL}/dashboard?session_id={CHECKOUT_SESSION_ID}`,
            cancel_url: `${process.env.FRONTEND_URL}/pricing`,
            metadata: {
                userId,
                ...(referralCode && { referralCode })
            },
            subscription_data: {
                metadata: {
                    userId,
                    ...(referralCode && { referralCode })
                }
            }
        };

        // Add trial if user hasn't used it yet
        if (!hasActiveTrial && !user.trialStartDate) {
            sessionParams.subscription_data.trial_period_days = TRIAL_PERIOD_DAYS;
        }

        const session = await stripe.checkout.sessions.create(sessionParams);
        
        return {
            sessionId: session.id,
            url: session.url!
        };
    }

    // Handle successful subscription (called from webhook)
    static async handleSubscriptionCreated(subscription: any): Promise<void> {
        const userId = subscription.metadata.userId;
        const referralCode = subscription.metadata.referralCode;
        
        if (!userId) {
            console.error('No userId in subscription metadata');
            return;
        }

        // Update user subscription
        const tier = STRIPE_PLAN_TO_TIER[subscription.items.data[0].price.id];
        await UserModel.updateSubscription(userId, tier, subscription.customer);

        // Save subscription details
        await pool.query(`
            INSERT INTO subscriptions (
                user_id, stripe_subscription_id, stripe_customer_id, status,
                current_period_start, current_period_end, plan_id,
                trial_start, trial_end
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
            ON CONFLICT (stripe_subscription_id) 
            DO UPDATE SET
                status = EXCLUDED.status,
                current_period_start = EXCLUDED.current_period_start,
                current_period_end = EXCLUDED.current_period_end,
                updated_at = NOW()
        `, [
            userId,
            subscription.id,
            subscription.customer,
            subscription.status,
            new Date(subscription.current_period_start * 1000),
            new Date(subscription.current_period_end * 1000),
            tier,
            subscription.trial_start ? new Date(subscription.trial_start * 1000) : null,
            subscription.trial_end ? new Date(subscription.trial_end * 1000) : null
        ]);

        // Handle referral if present
        if (referralCode) {
            await this.processReferral(referralCode, userId);
        }
    }

    // Process referral reward
    static async processReferral(referralCode: string, newUserId: string): Promise<void> {
        try {
            // Find the referral
            const referralResult = await pool.query(`
                SELECT r.*, u.stripe_customer_id, u.id as referrer_id
                FROM referrals r
                JOIN users u ON u.id = r.referrer_user_id
                WHERE r.referral_code = $1 AND r.status = 'pending'
            `, [referralCode]);

            if (referralResult.rows.length === 0) return;

            const referral = referralResult.rows[0];

            // Update referral status
            await pool.query(`
                UPDATE referrals 
                SET status = 'completed', 
                    referred_user_id = $1, 
                    conversion_date = NOW(),
                    updated_at = NOW()
                WHERE id = $2
            `, [newUserId, referral.id]);

            // Grant 1 month free to referrer
            await this.grantFreeMonth(referral.referrer_id, referral.stripe_customer_id);

            // Mark reward as granted
            await pool.query(`
                UPDATE referrals 
                SET reward_granted = TRUE, updated_at = NOW()
                WHERE id = $1
            `, [referral.id]);

        } catch (error) {
            console.error('Error processing referral:', error);
        }
    }

    // Grant free month to referrer
    static async grantFreeMonth(userId: string, stripeCustomerId: string): Promise<void> {
        try {
            // Create a 100% discount coupon for 1 month
            const coupon = await stripe.coupons.create({
                percent_off: 100,
                duration: 'once',
                duration_in_months: 1,
                name: 'Referral Reward - 1 Month Free',
                metadata: { type: 'referral_reward', userId }
            });

            // Apply to customer
            await stripe.customers.createDiscount(stripeCustomerId, {
                coupon: coupon.id
            });

        } catch (error) {
            console.error('Error granting free month:', error);
        }
    }

    // Generate referral code for user
    static async generateReferralCode(userId: string): Promise<string> {
        const user = await UserModel.findById(userId);
        if (!user) throw new Error('User not found');

        // Create unique referral code
        const referralCode = `${user.username.toLowerCase()}-${Math.random().toString(36).substr(2, 6)}`;

        await pool.query(`
            INSERT INTO referrals (referrer_user_id, referral_code)
            VALUES ($1, $2)
            ON CONFLICT (referrer_user_id, referred_user_id) DO NOTHING
        `, [userId, referralCode]);

        return referralCode;
    }

    // Get user's referral stats
    static async getReferralStats(userId: string) {
        const result = await pool.query(`
            SELECT 
                referral_code,
                COUNT(CASE WHEN status = 'completed' THEN 1 END) as successful_referrals,
                COUNT(CASE WHEN status = 'pending' THEN 1 END) as pending_referrals,
                SUM(CASE WHEN reward_granted THEN 1 ELSE 0 END) as rewards_earned
            FROM referrals 
            WHERE referrer_user_id = $1
            GROUP BY referral_code
        `, [userId]);

        return result.rows[0] || {
            referral_code: null,
            successful_referrals: 0,
            pending_referrals: 0,
            rewards_earned: 0
        };
    }

    // Cancel subscription
    static async cancelSubscription(userId: string): Promise<void> {
        const subscription = await pool.query(`
            SELECT stripe_subscription_id 
            FROM subscriptions 
            WHERE user_id = $1 AND status = 'active'
        `, [userId]);

        if (subscription.rows.length === 0) {
            throw new Error('No active subscription found');
        }

        const stripeSubscriptionId = subscription.rows[0].stripe_subscription_id;
        
        // Cancel at period end in Stripe
        await stripe.subscriptions.update(stripeSubscriptionId, {
            cancel_at_period_end: true
        });

        // Update local record
        await pool.query(`
            UPDATE subscriptions 
            SET cancel_at_period_end = TRUE, updated_at = NOW()
            WHERE stripe_subscription_id = $1
        `, [stripeSubscriptionId]);
    }
}