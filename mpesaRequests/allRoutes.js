const express = require('express');
const db = require('../dbPromise'); // MySQL pool connection
const authenticateToken = require('../customMiddleware'); // Middleware for token authentication
const { updateSubscriptionIfExpired } = require("./functions");

// Load environment variables
require('dotenv').config();

// Access the authorization token
const authorizationToken = process.env.PAYHERO_AUTHORIZATION_TOKEN;
const channelID = 1466;
const callback_url = process.env.CALLBACK_URL;


const router = express.Router();

// Function to get the price based on gender
const getPriceBasedOnGender = (plan, profile) => {
    if (!plan || !profile) {
        throw new Error('Plan and profile details are required.');
    }

    const gender = profile.gender.toLowerCase();
    let price;

    if (gender === 'male') {
        price = parseFloat(plan.price_male);
    } else if (gender === 'female') {
        price = parseFloat(plan.price_female);
    } else {
        throw new Error('Invalid gender specified in profile details.');
    }

    return price;
};

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


router.post('/test', authenticateToken, async (req, res) => {
    const upResult =  await updateSubscriptionIfExpired(4, 30);

    if(upResult.success = true){
        res.status(200).json({ message: "Successful Request" }); // Send the payment details to the client
    } else {
        res.status(500).json({ message: "Error updating client", status: "failure" });
    }
});

// CREATE a new comprehensive Mpesa request
router.post('/', authenticateToken, async (req, res) => {
    const { phone, plan_id } = req.body;
    const user_id = req.user.id;

    // Validate required fields
    if (!plan_id || !phone) {
        return res.status(400).json({ error: 'All fields are required.' });
    }

    // Get Plan Details
    const [rows] = await db.execute(`SELECT * FROM plans WHERE id = ?`, [plan_id]);
    if (rows.length === 0) {
        return res.status(404).json({ error: 'Plan not found.' });
    }
    const planDetails = rows[0];

    // Get Profile Details
    const [profileRows] = await db.execute(`SELECT * FROM user_profiles WHERE user_id = ?`, [user_id]);
    if (profileRows.length === 0) {
        return res.status(404).json({ error: 'User profile not found.' });
    }
    const profileDetails = profileRows[0];

    const plan_price = getPriceBasedOnGender(planDetails, profileDetails);

    const paymentData = {
        "amount": plan_price,
        "phone_number": phone,
        "channel_id": channelID, 
        "provider": "m-pesa", 
        "external_reference": "INV-009",
        "callback_url": callback_url
    };

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
            console.log(`HTTP error! status: ${response.status}`);
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
            phone
        ]);

        console.log('Data inserted successfully:', result.insertId);

        // ✅ Wait for payment before sending response
        try {
            const paymentResult = await waitForPayment(CheckoutRequestID);
            const upResult =  await updateSubscriptionIfExpired(user_id, planDetails.period);

            if(upResult.success = true){
                res.status(200).json({data: paymentResult, success: true}); // Send the payment details to the client
            } else {
                res.status(500).json({ message: "Error updating client", success: false });
            }
            
        } catch (error) {
            res.status(error.status || 500).json({ error: error.message });
        }

    } catch (error) {
        console.error('Error:', error.message);
        res.status(500).json({ error: 'Server error' });
    }
});


// READ all Mpesa requests (with optional pagination)
router.get('/', authenticateToken, async (req, res) => {
    const { page = 1, limit = 10 } = req.query;

    try {
        const offset = (page - 1) * limit;
        const [rows] = await db.execute(
            `SELECT * FROM mpesa_requests ORDER BY created_at DESC LIMIT ? OFFSET ?`,
            [parseInt(limit), parseInt(offset)]
        );
        res.status(200).json(rows);
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Server error.' });
    }
});

module.exports = router;
