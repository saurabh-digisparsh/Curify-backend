// razorpay ships `export = Razorpay` (CommonJS). `import = require` is the correct
// form — a default import resolves to a non-constructor at runtime under Node's interop.
import Razorpay = require('razorpay');

// Single Razorpay client for the app, built from env. KEY_ID/KEY_SECRET are
// asserted present at boot (assertRequiredEnv in main.ts), so no fallbacks here.
export const RAZORPAY_CLIENT = 'RAZORPAY_CLIENT';

export const razorpayProvider = {
  provide: RAZORPAY_CLIENT,
  useFactory: (): Razorpay =>
    new Razorpay({
      key_id: process.env.RAZORPAY_KEY_ID as string,
      key_secret: process.env.RAZORPAY_KEY_SECRET as string,
    }),
};
