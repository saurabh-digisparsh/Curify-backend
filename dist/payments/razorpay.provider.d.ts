import Razorpay = require('razorpay');
export declare const RAZORPAY_CLIENT = "RAZORPAY_CLIENT";
export declare const razorpayProvider: {
    provide: string;
    useFactory: () => Razorpay;
};
