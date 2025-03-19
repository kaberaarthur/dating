const express = require('express');
const db = require('../dbPromise'); // MySQL pool connection
const authenticateToken = require('../customMiddleware'); // Authentication middleware
const { updateSubscriptionIfExpired, waitForPayment, updateSuperlikesRecord } = require("./functions");
const axios = require("axios");


// Load environment variables
require('dotenv').config();

// Access the authorization token
const authorizationToken = process.env.PAYHERO_AUTHORIZATION_TOKEN;
const channelID = process.env.PAYHERO_CHANNEL_ID;
const callback_url = process.env.CALLBACK_URL;

const router = express.Router();

// Send a superlike
router.post("/send", authenticateToken, async (req, res) => {
    const { id } = req.user;
    const { receiver_id, amount } = req.body;
    const sender_id = id;

    if (!sender_id || !receiver_id || !amount || amount <= 0) {
        return res.status(400).json({ success: false, error: "Invalid request data." });
    }

    try {
        // Check sender's superlikes balance
        const [senderRecord] = await db.execute(
            "SELECT amount FROM superlikes_record WHERE user_id = ?",
            [sender_id]
        );

        if (senderRecord.length === 0 || senderRecord[0].amount < amount) {
            return res.status(400).json({
                success: false,
                message: "You have insufficient superlikes to send the number of superlikes you have entered.",
            });
        }

        // Deduct the amount from sender
        const newSenderAmount = senderRecord[0].amount - amount;
        await db.execute(
            "UPDATE superlikes_record SET amount = ?, date_updated = NOW() WHERE user_id = ?",
            [newSenderAmount, sender_id]
        );

        // Check if receiver already has a record
        const [receiverRecord] = await db.execute(
            "SELECT amount FROM superlikes_record WHERE user_id = ?",
            [receiver_id]
        );

        if (receiverRecord.length === 0) {
            // Receiver has no record, create a new one
            await db.execute(
                "INSERT INTO superlikes_record (user_id, amount, date_updated) VALUES (?, ?, NOW())",
                [receiver_id, amount]
            );
        } else {
            // Update receiver's superlikes count
            const newReceiverAmount = receiverRecord[0].amount + amount;
            await db.execute(
                "UPDATE superlikes_record SET amount = ?, date_updated = NOW() WHERE user_id = ?",
                [newReceiverAmount, receiver_id]
            );
        }

        res.status(200).json({
            success: true,
            message: `User ${sender_id} has sent ${amount} likes to User ${receiver_id}`,
        });

    } catch (error) {
        console.error("Error processing superlikes transfer:", error);
        res.status(500).json({ success: false, error: "Server error." });
    }
});

router.post("/buy", authenticateToken, async (req, res) => {
    const { id } = req.user; // Extract user ID from token
    const { amount, phone } = req.body;

    if (!id || !amount) {
        return res.status(400).json({ error: "All fields are required." });
    }

    try {
        // Make a request to fetch user profile using the same authentication token
        const profileResponse = await axios.get("http://localhost:5000/api/user-profiles/my-profile", {
            headers: {
                Authorization: req.headers.authorization, // Forward the token
                "Content-Type": "application/json",
            },
        });

        const userProfile = profileResponse.data; // Store the response in a constant

        // Consider the return value (modify this logic as needed)
        if (!userProfile || userProfile.active === 0) {
            return res.status(403).json({ error: "User profile is inactive." });
        }

        console.log("User Profile: ", userProfile)

        const paymentData = {
            "amount": Number(amount) * 1,
            "phone_number": phone,
            "channel_id": channelID, 
            "provider": "m-pesa", 
            "external_reference": "INV-009",
            "callback_url": callback_url
        };

        {/* Make Payment */}
        try {
            const response = await fetch('https://backend.payhero.co.ke/api/v2/payments', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': authorizationToken,
                },
                body: JSON.stringify(paymentData),
            });
    
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
    
            const data = await response.json();
    
            const { success, status, reference, CheckoutRequestID } = data;
    
            // Insert into MySQL database
            const insertQuery = `
                INSERT INTO mpesa_requests (success, status, reference, checkout_request_id, phone)
                VALUES (?, ?, ?, ?, ?)
            `;
    
            const [result] = await db.execute(insertQuery, [
                success, 
                status,
                reference,
                CheckoutRequestID,
                userProfile.phone
            ]);
    
            console.log('Data inserted successfully:', result.insertId);
    
            // ✅ Wait for payment before sending response
            try {
                const paymentResult = await waitForPayment(CheckoutRequestID);
                const upResult =  await updateSuperlikesRecord(id, amount);
    
                if(upResult.success = true){
                    res.status(200).json({data: paymentResult, success: true}); // Send the payment details to the client
                } else {
                    res.status(500).json({ message: "Error Buying Superlikes", success: false });
                }
                
            } catch (error) {
                res.status(error.status || 500).json({ error: error.message });
            }
    
        } catch (error) {
            console.error('Error:', error.message);
            res.status(500).json({ error: 'Server error' });
        }

        {/* Make Payment */}

    } catch (error) {
        console.error("Error fetching user profile:", error);
        res.status(500).json({ error: "Failed to fetch user profile" });
    }
});

router.get("/count", authenticateToken, async (req, res) => {
    const { id } = req.user; // Extract user ID from the token

    try {
        const [rows] = await db.execute(
            "SELECT amount FROM superlikes_record WHERE user_id = ? LIMIT 1",
            [id]
        );

        if (rows.length > 0) {
            res.json({ amount: rows[0].amount });
        } else {
            res.json({ amount: 0 });
        }
    } catch (error) {
        console.error("Database error:", error);
        res.status(500).json({ error: "Database error" });
    }
});

router.post("/withdraw", authenticateToken, async (req, res) => {
    const { id } = req.user; // Extract user ID from the token
    const { amount } = req.body;

    if (!amount || isNaN(amount) || amount <= 0) {
        return res.status(400).json({ message: "Invalid withdrawal amount." });
    }

    try {
        const [userRecord] = await db.query(
            "SELECT amount FROM superlikes_record WHERE user_id = ?",
            [id]
        );
    
        if (!userRecord || userRecord.length === 0) {
            return res.status(404).json({ message: "User not found." });
        }
    
        const userAmount = userRecord[0].amount;
    
        if (userAmount < amount) {
            return res.status(400).json({ message: "Insufficient amount." });
        }
    
        // Deduct amount (optional: depending on your logic, you might update it here)
        await db.query(
            "UPDATE superlikes_record SET amount = amount - ? WHERE user_id = ?",
            [amount, id]
        );
    
        // Create withdrawal record
        await db.query(
            "INSERT INTO superlikes_withdrawals (user_id, amount, status) VALUES (?, ?, 'pending')",
            [id, amount]
        );
    
        res.status(200).json({ message: "Withdrawal request submitted successfully." });
    
    } catch (error) {
        console.error("Withdrawal Error:", error);
        res.status(500).json({ message: "Internal server error." });
    }    
});

router.get("/withdrawals", authenticateToken, async (req, res) => {
    try {
        const [withdrawals] = await db.query(
            `SELECT 
                u.id, 
                u.name, 
                u.phone, 
                COUNT(w.id) AS transaction_count, 
                SUM(w.amount) AS total_amount, 
                GROUP_CONCAT(w.id ORDER BY w.created_at DESC) AS transaction_ids
             FROM superlikes_withdrawals w
             JOIN users u ON w.user_id = u.id
             WHERE w.status = 'pending'
             GROUP BY u.id, u.name, u.phone`
        );

        res.status(200).json({ withdrawals });

    } catch (error) {
        console.error("Error fetching pending withdrawals:", error);
        res.status(500).json({ message: "Internal server error." });
    }
});


router.post("/withdrawals/complete", authenticateToken, async (req, res) => {
    const { user_id } = req.body;

    if (!user_id) {
        return res.status(400).json({ message: "User ID is required." });
    }

    try {
        const [existingWithdrawals] = await db.query(
            "SELECT id FROM superlikes_withdrawals WHERE user_id = ? AND status = 'pending'",
            [user_id]
        );

        if (existingWithdrawals.length === 0) {
            return res.status(404).json({ message: "No pending withdrawals found for this user." });
        }

        await db.query(
            "UPDATE superlikes_withdrawals SET status = 'completed' WHERE user_id = ? AND status = 'pending'",
            [user_id]
        );

        res.status(200).json({ message: "All pending withdrawals marked as completed." });

    } catch (error) {
        console.error("Error completing withdrawals:", error);
        res.status(500).json({ message: "Internal server error." });
    }
});


module.exports = router;