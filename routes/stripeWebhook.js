const Contract = require('../models/Contract');
const Notification = require('../models/Notification');
const BusinessProfile = require('../models/BusinessProfile');
const { getStripe } = require('../utils/stripeClient');

module.exports = async (req, res) => {
  const stripe = getStripe();
  const sig = req.headers['stripe-signature'];
  let event;

  try {
    event = stripe.webhooks.constructEvent(req.body, sig, process.env.STRIPE_WEBHOOK_SECRET);
  } catch (err) {
    console.error('Stripe webhook signature error:', err.message);
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }

  if (event.type === 'checkout.session.completed') {
    const session = event.data.object;
    const contractId = session.metadata?.contractId;
    if (contractId) {
      const contract = await Contract.findById(contractId);
      if (contract) {
        contract.paymentStatus = 'held';
        contract.paidAt = new Date();
        contract.paymentIntentId = session.payment_intent;
        contract.checkoutSessionId = session.id;
        contract.freelancerRequestedRelease = false;
        await contract.save();

        try {
          const businessProfile = await BusinessProfile.findById(contract.business);
          await Notification.create({
            user: businessProfile?.user,
            type: 'payment_held',
            title: 'Payment held in escrow',
            message: `${contract.title} payment is now held. Release when work is complete.`,
            relatedContract: contract._id,
          });
        } catch (err) {
          console.error('Notification error after payment hold:', err.message);
        }
      }
    }
  }

  res.json({ received: true });
};
