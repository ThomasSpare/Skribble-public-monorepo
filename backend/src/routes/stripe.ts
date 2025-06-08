// backend/src/routes/stripe.ts
import express from 'express';
import { body, validationResult } from 'express-validator';
import { authenticateToken } from '../middleware/auth';
import { SubscriptionService } from '../services/SubscriptionService';
import { STRIPE_PRICES } from '../config/stripe';
import { pool } from '../config/database';

const router = express.Router();

// Create checkout session
router.post('/create-checkout-session', 
    authenticateToken,
    [
        body('priceId').isIn(Object.values(STRIPE_PRICES).flatMap(p => [p.monthly, p.yearly])),
        body('referralCode').optional().isString().trim()
    ],
    async (req: any, res: any) => {
        try {
            const errors = validationResult(req);
            if (!errors.isEmpty()) {
                return res.status(400).json({
                    success: false,
                    error: { message: 'Invalid input', details: errors.array() }
                });
            }

            const { priceId, referralCode } = req.body;
            const userId = req.user.id;

            const session = await SubscriptionService.createCheckoutSession(
                userId, 
                priceId, 
                referralCode
            );

            res.json({
                success: true,
                data: session
            });

        } catch (error: any) {
            console.error('Checkout session error:', error);
            res.status(500).json({
                success: false,
                error: { message: error.message || 'Failed to create checkout session' }
            });
        }
    }
);

// Start free trial
router.post('/start-trial', authenticateToken, async (req: any, res: any) => {
    try {
        const userId = req.user.id;
        
        // Check if user already has or had a trial
        const hasTrialActive = await SubscriptionService.isTrialActive(userId);
        if (hasTrialActive) {
            return res.status(400).json({
                success: false,
                error: { message: 'Trial already active' }
            });
        }

        await SubscriptionService.startFreeTrial(userId);

        res.json({
            success: true,
            message: 'Free trial started successfully'
        });

    } catch (error: any) {
        console.error('Start trial error:', error);
        res.status(500).json({
            success: false,
            error: { message: error.message || 'Failed to start trial' }
        });
    }
});

// Generate referral code
router.post('/generate-referral-code', authenticateToken, async (req: any, res: any) => {
    try {
        const userId = req.user.id;
        const referralCode = await SubscriptionService.generateReferralCode(userId);

        res.json({
            success: true,
            data: { referralCode }
        });

    } catch (error: any) {
        console.error('Generate referral code error:', error);
        res.status(500).json({
            success: false,
            error: { message: error.message || 'Failed to generate referral code' }
        });
    }
});

// Get referral stats
router.get('/referral-stats', authenticateToken, async (req: any, res: any) => {
    try {
        const userId = req.user.id;
        const stats = await SubscriptionService.getReferralStats(userId);

        res.json({
            success: true,
            data: stats
        });

    } catch (error: any) {
        console.error('Get referral stats error:', error);
        res.status(500).json({
            success: false,
            error: { message: error.message || 'Failed to get referral stats' }
        });
    }
});

// Cancel subscription
router.post('/cancel-subscription', authenticateToken, async (req: any, res: any) => {
    try {
        const userId = req.user.id;
        await SubscriptionService.cancelSubscription(userId);

        res.json({
            success: true,
            message: 'Subscription cancelled successfully'
        });

    } catch (error: any) {
        console.error('Cancel subscription error:', error);
        res.status(500).json({
            success: false,
            error: { message: error.message || 'Failed to cancel subscription' }
        });
    }
});

// Get subscription status
router.get('/subscription-status', authenticateToken, async (req: any, res: any) => {
    try {
        const userId = req.user.id;
        
        // Check trial status
        const isTrialActive = await SubscriptionService.isTrialActive(userId);
        
        // Get subscription info from database
        const subResult = await pool.query(`
            SELECT s.*, u.subscription_tier, u.trial_start_date, u.trial_end_date
            FROM subscriptions s
            RIGHT JOIN users u ON u.id = s.user_id
            WHERE u.id = $1
        `, [userId]);

        const userData = subResult.rows[0];
        
        res.json({
            success: true,
            data: {
                subscriptionTier: userData?.subscription_tier || 'free',
                isTrialActive,
                trialStartDate: userData?.trial_start_date,
                trialEndDate: userData?.trial_end_date,
                subscriptionStatus: userData?.status || 'inactive',
                currentPeriodEnd: userData?.current_period_end
            }
        });

    } catch (error: any) {
        console.error('Get subscription status error:', error);
        res.status(500).json({
            success: false,
            error: { message: error.message || 'Failed to get subscription status' }
        });
    }
});

export default router;