const db = require('../dbPromise'); // MySQL pool connection

const updateSuperlikesRecord = async (user_id, amount) => {
    try {
        // Find existing record
        const [existingRecords] = await db.execute(
            "SELECT id, amount FROM superlikes_record WHERE user_id = ?",
            [user_id]
        );

        if (existingRecords.length === 0) {
            // No record exists, create a new one
            await db.execute(
                "INSERT INTO superlikes_record (user_id, amount, date_updated) VALUES (?, ?, NOW())",
                [user_id, amount]
            );
            console.log(`New record created for user ${user_id} with ${amount} superlikes.`);
            return { success: true, message: `New record created for user ${user_id} with ${amount} superlikes.` };
        } else {
            // Record exists, update it
            const newAmount = existingRecords[0].amount + amount;
            await db.execute(
                "UPDATE superlikes_record SET amount = ?, date_updated = NOW() WHERE user_id = ?",
                [newAmount, user_id]
            );
            console.log(`Updated superlikes for user ${user_id}: new amount = ${newAmount}`);
            return { success: true, message: `Updated superlikes for user ${user_id}: new amount = ${newAmount}`};
        }
    } catch (error) {
        console.error("Error updating superlikes record:", error);
        return { success: false, message: "Error updating superlikes record" };
    }
};

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

async function waitForPayment(checkoutRequestId) {
    const timeout = 180000; // 3 minutes in milliseconds
    const interval = 5000; // Check every 5 seconds

    const startTime = Date.now();

    return new Promise(async (resolve, reject) => {
        const checkDatabase = async () => {
            try {
                const [rows] = await db.execute(
                    'SELECT * FROM mpesa_payments WHERE checkout_request_id = ?',
                    [checkoutRequestId]
                );

                if (rows.length > 0) {
                    resolve(rows[0]); // Payment found, resolve promise
                    return;
                }

                if (Date.now() - startTime >= timeout) {
                    reject({ status: 401, message: "We could not find your payment, contact support" });
                    return;
                }

                setTimeout(checkDatabase, interval);
            } catch (error) {
                reject({ status: 500, message: "Database error", error });
            }
        };

        checkDatabase();
    });
}

  
module.exports = { updateSubscriptionIfExpired, waitForPayment, updateSuperlikesRecord };