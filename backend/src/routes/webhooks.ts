// backend/src/routes/webhooks.ts
import express from 'express';
import { stripe } from '../config/stripe';
import { SubscriptionService } from '../services/SubscriptionService';
import { UserModel } from '../models/User';
import { pool } from '../config/database';

const router = express.Router();

// Stripe webhook endpoint (raw body needed)
router.post('/stripe', express.raw({ type: 'application/json' }), async (req: any, res: any) => {
    const sig = req.headers['stripe-signature'];
    
    let event;
    
    try {
        event = stripe.webhooks.constructEvent(req.body, sig, process.env.STRIPE_WEBHOOK_SECRET!);
    } catch (err: any) {
        console.error('Webhook signature verification failed:', err.message);
        return res.status(400).send(`Webhook Error: ${err.message}`);
    }

    // Check if we've already processed this event (idempotency)
    const existingEvent = await pool.query(
        'SELECT id FROM stripe_webhook_events WHERE stripe_event_id = $1',
        [event.id]
    );

    if (existingEvent.rows.length > 0) {
        console.log('Event already processed:', event.id);
        return res.json({ received: true });
    }

    // Record the event
    await pool.query(
        'INSERT INTO stripe_webhook_events (stripe_event_id, event_type) VALUES ($1, $2)',
        [event.id, event.type]
    );

    try {
        // Handle the event
        switch (event.type) {
            case 'customer.subscription.created':
                await SubscriptionService.handleSubscriptionCreated(event.data.object);
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

            case 'customer.subscription.trial_will_end':
                await handleTrialWillEnd(event.data.object);
                break;

            default:
                console.log(`Unhandled event type: ${event.type}`);
        }

        // Mark event as processed
        await pool.query(
            'UPDATE stripe_webhook_events SET processed = TRUE WHERE stripe_event_id = $1',
            [event.id]
        );

        res.json({ received: true });

    } catch (error) {
        console.error('Error processing webhook:', error);
        res.status(500).json({ error: 'Error processing webhook' });
    }
});

async function handleSubscriptionUpdated(subscription: any) {
    console.log('Subscription updated:', subscription.id);
    
    const userId = subscription.metadata.userId;
    if (!userId) return;

    // Update subscription in database
    await pool.query(`
        UPDATE subscriptions 
        SET status = $1, 
            current_period_start = $2,
            current_period_end = $3,
            cancel_at_period_end = $4,
            updated_at = NOW()
        WHERE stripe_subscription_id = $5
    `, [
        subscription.status,
        new Date(subscription.current_period_start * 1000),
        new Date(subscription.current_period_end * 1000),
        subscription.cancel_at_period_end,
        subscription.id
    ]);

    // Update user subscription status
    await pool.query(`
        UPDATE users 
        SET subscription_status = $1, updated_at = NOW()
        WHERE id = $2
    `, [subscription.status, userId]);
}

async function handleSubscriptionDeleted(subscription: any) {
    console.log('Subscription deleted:', subscription.id);
    
    const userId = subscription.metadata.userId;
    if (!userId) return;

    // Update subscription status
    await pool.query(`
        UPDATE subscriptions 
        SET status = 'canceled', updated_at = NOW()
        WHERE stripe_subscription_id = $1
    `, [subscription.id]);

    // Downgrade user to free tier
    await UserModel.updateSubscription(userId, 'free');
    
    await pool.query(`
        UPDATE users 
        SET subscription_status = 'canceled', updated_at = NOW()
        WHERE id = $1
    `, [userId]);
}

async function handlePaymentSucceeded(invoice: any) {
    console.log('Payment succeeded for invoice:', invoice.id);
    
    if (invoice.subscription) {
        // Get subscription details
        const subscription = await stripe.subscriptions.retrieve(invoice.subscription);
        const userId = subscription.metadata.userId;
        
        if (userId) {
            // Update user status to active
            await pool.query(`
                UPDATE users 
                SET subscription_status = 'active', updated_at = NOW()
                WHERE id = $1
            `, [userId]);
        }
    }
}

async function handlePaymentFailed(invoice: any) {
    console.log('Payment failed for invoice:', invoice.id);
    
    if (invoice.subscription) {
        const subscription = await stripe.subscriptions.retrieve(invoice.subscription);
        const userId = subscription.metadata.userId;
        
        if (userId) {
            // Update user status to past_due
            await pool.query(`
                UPDATE users 
                SET subscription_status = 'past_due', updated_at = NOW()
                WHERE id = $1
            `, [userId]);
            
            // TODO: Send email notification about failed payment
        }
    }
}

async function handleTrialWillEnd(subscription: any) {
    console.log('Trial will end for subscription:', subscription.id);
    
    const userId = subscription.metadata.userId;
    if (userId) {
        // TODO: Send email notification about trial ending
        console.log(`Trial ending soon for user: ${userId}`);
    }
}

export default router;