const express = require('express');
const db = require('../dbPromise'); // MySQL pool connection
const authenticateToken = require('../customMiddleware'); // Authentication middleware

const router = express.Router();

// Send a superlike
router.post('/send', authenticateToken, async (req, res) => {
    const { id } = req.user;
    const { receiver_id, amount } = req.body;
    const sender_id = id;

    // console.log(`User ${sender_id} has sent ${amount} likes to ${receiver_id}`)
    res.status(200).json({message: `User ${sender_id} has sent ${amount} likes to ${receiver_id}`});

});

module.exports = router;