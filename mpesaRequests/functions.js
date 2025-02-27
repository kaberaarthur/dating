const db = require('../dbPromise'); // MySQL pool connection

async function updateSubscriptionIfExpired(userId, addDays) {
    console.log(`Starting Subscription Update for User ${userId} with ${addDays} Days`);

    try {
        // Fetch the current subscription
        let rows = await db.query(
            "SELECT end_date, payment_status FROM subscriptions WHERE user_id = ? LIMIT 1",
            [userId]
        );

        rows = rows[0]
        console.log("Rows: ", rows);

        const now = new Date();
        now.setHours(now.getHours() + 4); // Adjust for time zone

        if (rows.length === 0) {
            // No subscription found → Create new subscription
            const newEndDate = new Date(now);
            newEndDate.setDate(newEndDate.getDate() + addDays);

            await db.query(
                "INSERT INTO subscriptions (user_id, subscription_type, start_date, end_date, payment_status) VALUES (?, ?, ?, ?, ?)",
                [userId, "paid", now, newEndDate, "paid"]
            );

            console.log("New subscription created ending on ", newEndDate.toISOString() );

            return { success: true, message: "New subscription created", newEndDate: newEndDate.toISOString() };
        }

        let { end_date, payment_status } = rows[0];

        if (end_date && new Date(end_date) >= now) {
            return { success: false, message: "Subscription is still active" };
        }

        // Subscription expired → Extend it
        let newEndDate = new Date(now);
        newEndDate.setDate(newEndDate.getDate() + addDays);

        await db.query(
            "UPDATE subscriptions SET end_date = ?, payment_status = ? WHERE user_id = ?",
            [newEndDate, payment_status === "unpaid" ? "paid" : payment_status, userId]
        );

        return { success: true, message: "Subscription updated", newEndDate: newEndDate.toISOString() };
    } catch (error) {
        console.error("Error updating subscription:", error);
        return { success: false, message: error.message };
    }
}
  
  module.exports = { updateSubscriptionIfExpired };