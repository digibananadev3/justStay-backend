import User from "../models/user.model.js";
import WalletTransaction from "../models/walletTransaction.model.js";

const rewardPercentages = {
  1: 5,
  2: 3,
  3: 1,
  4: 1,
};

const processBookingReward = async (booking, session) => {
  const user = await User.findById(booking.userId).session(session);

  if (!user) return;

  const referralPath = user.referralPath || [];

  // ✅ Supports 1 to 4 levels automatically
  if (referralPath.length === 0) return;

  const bookingAmount = booking.priceSummary?.totalAmount || 0;

  if (bookingAmount <= 0) return;

  for (let i = 0; i < referralPath.length && i < 4; i++) {
    const level = i + 1;
    const refUserId = referralPath[i];

    if (!rewardPercentages[level]) continue;

    // Prevent self reward
    if (String(refUserId) === String(user._id)) continue;

    const rewardAmount =
      (bookingAmount * rewardPercentages[level]) / 100;


    if (rewardAmount <= 0) continue;

    // ✅ Atomic wallet update (safer than .save())
    const updatedUser = await User.findByIdAndUpdate(
      refUserId,
      {
        $inc: {
          "wallet.balance": rewardAmount,
          "wallet.totalEarned": rewardAmount,
          "referralStats.totalEarnings": rewardAmount,
        },
      },
      { new: true, session }
    );

    if (!updatedUser) continue;

    // ✅ Create transaction record
    await WalletTransaction.create(
      [
        {
          userId: refUserId,
          type: "CREDIT",
          source: `REFERRAL_LEVEL_${level}`,
          amount: rewardAmount,
          balanceAfter: updatedUser.wallet.balance,
          bookingId: booking._id,
          status: "completed",
          note: `Level ${level} referral reward from booking ${booking.bookingCode}`,
        },
      ],
      { session }
    );
  }
};

export default { processBookingReward };