const Contract = require('../models/Contract');
const Notification = require('../models/Notification');
const BusinessProfile = require('../models/BusinessProfile');
const FreelancerProfile = require('../models/FreelancerProfile');
const ServiceProviderProfile = require('../models/ServiceProviderProfile');
const User = require('../models/User');
const { getStripe } = require('../utils/stripeClient');
const { recordAuditEvent } = require('../utils/auditLogger');
const { sendEmail } = require('../utils/mailer');

const getPayeeProfile = async (contract) => {
  if (contract.targetType === 'freelancer') {
    return FreelancerProfile.findById(contract.targetFreelancer);
  }
  return ServiceProviderProfile.findById(contract.targetProvider);
};

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

          const payeeProfile = await getPayeeProfile(contract);
          const businessUser = await User.findById(businessProfile?.user);
          const payeeUser = await User.findById(payeeProfile?.user);

          recordAuditEvent({
            contractId: contract._id,
            eventType: 'payment_held',
            details: { paymentIntent: session.payment_intent },
          });

          if (businessUser?.email) {
            sendEmail({
              to: businessUser.email,
              subject: `Payment captured for ${contract.title}`,
              text: `Funds for "${contract.title}" are now held in escrow. Release them when work is complete.`,
            });
          }

          if (payeeUser?.email) {
            sendEmail({
              to: payeeUser.email,
              subject: `Escrow funded for ${contract.title}`,
              text: `The business funded "${contract.title}". Deliver the work and request release when ready.`,
            });
          }
        } catch (err) {
          console.error('Notification error after payment hold:', err.message);
        }
      }
    }
  }

  res.json({ received: true });
};
