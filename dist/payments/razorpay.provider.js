"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.razorpayProvider = exports.RAZORPAY_CLIENT = void 0;
const Razorpay = require("razorpay");
exports.RAZORPAY_CLIENT = 'RAZORPAY_CLIENT';
exports.razorpayProvider = {
    provide: exports.RAZORPAY_CLIENT,
    useFactory: () => new Razorpay({
        key_id: process.env.RAZORPAY_KEY_ID,
        key_secret: process.env.RAZORPAY_KEY_SECRET,
    }),
};
//# sourceMappingURL=razorpay.provider.js.map