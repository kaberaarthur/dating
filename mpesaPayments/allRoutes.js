const express = require('express');
const db = require('../dbPromise'); // MySQL pool connection
const authenticateToken = require('../customMiddleware'); // Middleware for token authentication

const router = express.Router();

// CREATE a new Mpesa payment
router.post('/', authenticateToken, async (req, res) => {
    const {
        amount,
        checkout_request_id,
        external_reference,
        merchant_request_id,
        mpesa_receipt_number,
        phone,
        result_code,
        result_desc,
        status
    } = req.body;

    // Validate required fields
    if (
        amount === undefined || 
        !checkout_request_id || 
        !external_reference || 
        !merchant_request_id || 
        !mpesa_receipt_number || 
        !phone || 
        result_code === undefined || 
        !result_desc || 
        !status
    ) {
        return res.status(400).json({ error: 'All fields are required.' });
    }

    try {
        const [result] = await db.execute(
            `INSERT INTO mpesa_payments (amount, checkout_request_id, external_reference, merchant_request_id, mpesa_receipt_number, phone, result_code, result_desc, status) 
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [
                amount,
                checkout_request_id,
                external_reference,
                merchant_request_id,
                mpesa_receipt_number,
                phone,
                result_code,
                result_desc,
                status
            ]
        );
        res.status(201).json({
            id: result.insertId,
            amount,
            checkout_request_id,
            external_reference,
            merchant_request_id,
            mpesa_receipt_number,
            phone,
            result_code,
            result_desc,
            status
        });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Server error.' });
    }
});

// READ all Mpesa payments (with optional pagination)
router.get('/', authenticateToken, async (req, res) => {
    const { page = 1, limit = 10 } = req.query;

    try {
        const offset = (page - 1) * limit;
        const [rows] = await db.execute(
            `SELECT * FROM mpesa_payments ORDER BY created_at DESC LIMIT ? OFFSET ?`,
            [parseInt(limit), parseInt(offset)]
        );
        res.status(200).json(rows);
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Server error.' });
    }
});

// READ a single Mpesa payment by ID
router.get('/:id', authenticateToken, async (req, res) => {
    const { id } = req.params;

    try {
        const [rows] = await db.execute(`SELECT * FROM mpesa_payments WHERE id = ?`, [id]);
        if (rows.length === 0) {
            return res.status(404).json({ error: 'Mpesa payment not found.' });
        }
        res.status(200).json(rows[0]);
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Server error.' });
    }
});

// PARTIAL UPDATE a Mpesa payment
router.patch('/:id', authenticateToken, async (req, res) => {
    const { id } = req.params;
    const updates = req.body;

    // Generate dynamic update query
    const fields = Object.keys(updates).map((field) => `${field} = ?`).join(', ');
    const values = Object.values(updates);

    try {
        const [result] = await db.execute(
            `UPDATE mpesa_payments SET ${fields} WHERE id = ?`,
            [...values, id]
        );
        if (result.affectedRows === 0) {
            return res.status(404).json({ error: 'Mpesa payment not found.' });
        }
        res.status(200).json({ message: 'Mpesa payment updated successfully.' });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Server error.' });
    }
});

// DELETE a Mpesa payment
router.delete('/:id', authenticateToken, async (req, res) => {
    const { id } = req.params;

    try {
        const [result] = await db.execute(`DELETE FROM mpesa_payments WHERE id = ?`, [id]);
        if (result.affectedRows === 0) {
            return res.status(404).json({ error: 'Mpesa payment not found.' });
        }
        res.status(200).json({ message: 'Mpesa payment deleted successfully.' });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Server error.' });
    }
});

module.exports = router;
