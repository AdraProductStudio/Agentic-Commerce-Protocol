import CheckoutSession from "@/models/CheckoutSession";
import Stripe from "stripe";
import { connectDB } from "@/lib/mongodb";
import cron from "node-cron";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

/* ------------------------------------------
   ✅ Cancel Expired Pending Sessions
------------------------------------------ */
export async function cancelExpiredSessions() {
  await connectDB();

  const now = new Date();

  // Find expired pending sessions
  const expiredSessions = await CheckoutSession.find({
    status: "pending",
    expiresAt: { $lt: now },
  });

  for (const session of expiredSessions) {
    console.log("⏳ Cancelling expired session:", session.session_id);

    // Cancel Stripe PaymentIntent if exists
    if (session.stripePaymentIntentId) {
      try {
        await stripe.paymentIntents.cancel(session.stripePaymentIntentId);
        console.log("✅ Stripe PaymentIntent cancelled");
      } catch (err) {
        console.log("⚠️ Stripe cancel error ignored:", err.message);
      }
    }

    // Mark session cancelled in DB
    session.status = "cancelled";
    session.cancelledAt = new Date();

    await session.save();

    console.log("✅ Session cancelled in DB:", session.session_id);
  }

  console.log("✅ Expired pending sessions cancelled:", expiredSessions.length);
}

/* ------------------------------------------
   ✅ Local Cron Scheduler
   Auto Runs Every 5 Minutes
   
------------------------------------------ */
function startCronAutomatically() {
  // cron.schedule("*/5 * * * * *", async () => { // 6 field means 5 seconds for testing
  cron.schedule("*/15 * * * *", async () => { // 5 field means 5 minutes
    console.log("🧹 Cron cleanup running...");
    await cancelExpiredSessions();
  });

  console.log("✅ Local cron started (every 5 minutes)");
}

/* ------------------------------------------
   ✅ AUTO START CRON WHEN FILE LOADS
------------------------------------------ */
if (process.env.NODE_ENV !== "production") {
  startCronAutomatically();
}
