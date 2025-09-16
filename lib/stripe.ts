import Stripe from 'stripe';

const secretKey = process.env.STRIPE_SECRET_KEY as string;

if (!secretKey) {
  // eslint-disable-next-line no-console
  console.warn('[billing] STRIPE_SECRET_KEY is not set. Billing APIs will be disabled.');
}

export const stripe = secretKey
  ? new Stripe(secretKey, {
      apiVersion: '2024-06-20',
    })
  : (null as unknown as Stripe);

export function isStripeEnabled(): boolean {
  return Boolean(secretKey);
}


