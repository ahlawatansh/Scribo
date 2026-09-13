import { httpsCallable } from 'firebase/functions';
import { functions } from '../firebase/functions';

export async function initializeRazorpay(totalOutstanding, farmerId) {
  const createOrder = httpsCallable(functions, 'createRazorpayOrder');
  return createOrder({ amount: totalOutstanding * 100, farmerId });
}
