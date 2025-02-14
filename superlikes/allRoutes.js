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
    const { amount } = req.body;

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
            "phone_number": userProfile.phone,
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

module.exports = router;