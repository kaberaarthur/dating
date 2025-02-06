const express = require('express');
const db = require('../dbPromise'); // MySQL pool connection
const authenticateToken = require('../customMiddleware'); // Middleware for token authentication

// Load environment variables
require('dotenv').config();

// Access the authorization token
const authorizationToken = process.env.PAYHERO_AUTHORIZATION_TOKEN;
const channelID = process.env.PAYHERO_CHANNEL_ID;


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

    paymentData = {
        "amount": plan_price,
        "phone_number": phone,
        "channel_id": channelID, 
        "provider": "m-pesa", 
        "external_reference": "INV-009",
        "callback_url": "https://example.com/callback.php"
    }

    // console.log("Payment Data: ", paymentData);

    // Fetch POST request
    fetch('https://backend.payhero.co.ke/api/v2/payments', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': authorizationToken,
        },
        body: JSON.stringify(paymentData),
    })
        .then(response => {
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            return response.json();
        })
        .then(async (data) => {
            // Extract response values
            const { success, status, reference, CheckoutRequestID } = data;
        
            // Insert into MySQL database
            const insertQuery = `
                INSERT INTO mpesa_requests (success, status, reference, checkout_request_id, phone)
                VALUES (?, ?, ?, ?, ?)
            `;
        
            try {
                const [result] = await db.execute(insertQuery, [
                    success, // Store as is (true/false)
                    status,
                    reference,
                    CheckoutRequestID,
                    phone
                ]);
                console.log('Data inserted successfully:', result.insertId);
            } catch (error) {
                console.error('Database insert error:', error);
            }
        })
        .catch(error => {
            console.error('Error:', error.message);
        });

    res.status(200).json({message: "Payment request mad successfully"});
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
