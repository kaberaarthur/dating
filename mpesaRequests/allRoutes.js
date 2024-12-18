const express = require('express');
const db = require('../dbPromise'); // MySQL pool connection
const authenticateToken = require('../customMiddleware'); // Middleware for token authentication

const router = express.Router();

// CREATE a new Mpesa request
router.post('/', authenticateToken, async (req, res) => {
    const { success, status, reference, checkout_request_id, phone } = req.body;

    // Validate required fields
    if (success === undefined || !status || !reference || !checkout_request_id || !phone) {
        return res.status(400).json({ error: 'All fields are required.' });
    }

    try {
        const [result] = await db.execute(
            `INSERT INTO mpesa_requests (success, status, reference, checkout_request_id, phone) 
            VALUES (?, ?, ?, ?, ?)`,
            [success, status, reference, checkout_request_id, phone]
        );
        res.status(201).json({ id: result.insertId, success, status, reference, checkout_request_id, phone });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Server error.' });
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

// READ a single Mpesa request by ID
router.get('/:id', authenticateToken, async (req, res) => {
    const { id } = req.params;

    try {
        const [rows] = await db.execute(`SELECT * FROM mpesa_requests WHERE id = ?`, [id]);
        if (rows.length === 0) {
            return res.status(404).json({ error: 'Mpesa request not found.' });
        }
        res.status(200).json(rows[0]);
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Server error.' });
    }
});

// PARTIAL UPDATE an Mpesa request
router.patch('/:id', authenticateToken, async (req, res) => {
    const { id } = req.params;
    const updates = req.body;

    // Only admin or superadmin can update
    const user_type = req.user.user_type;
    if (user_type !== 'admin' && user_type !== 'superadmin') {
        return res.status(403).json({ error: 'Access denied. Only admin or superadmin can update a request.' });
    }

    // Generate dynamic update query
    const fields = Object.keys(updates).map((field) => `${field} = ?`).join(', ');
    const values = Object.values(updates);

    try {
        const [result] = await db.execute(
            `UPDATE mpesa_requests SET ${fields} WHERE id = ?`,
            [...values, id]
        );
        if (result.affectedRows === 0) {
            return res.status(404).json({ error: 'Mpesa request not found.' });
        }
        res.status(200).json({ message: 'Mpesa request updated successfully.' });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Server error.' });
    }
});

// DELETE an Mpesa request
router.delete('/:id', authenticateToken, async (req, res) => {
    const { id } = req.params;

    // Only admin or superadmin can delete
    const user_type = req.user.user_type;
    if (user_type !== 'admin' && user_type !== 'superadmin') {
        return res.status(403).json({ error: 'Access denied. Only admin or superadmin can delete a request.' });
    }

    try {
        const [result] = await db.execute(`DELETE FROM mpesa_requests WHERE id = ?`, [id]);
        if (result.affectedRows === 0) {
            return res.status(404).json({ error: 'Mpesa request not found.' });
        }
        res.status(200).json({ message: 'Mpesa request deleted successfully.' });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Server error.' });
    }
});

module.exports = router;
