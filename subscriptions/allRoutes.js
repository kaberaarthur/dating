const express = require('express');
const db = require('../dbPromise'); // MySQL pool connection
const authenticateToken = require('../customMiddleware'); // Middleware for token authentication

const router = express.Router();

// Middleware to check for admin or superadmin privileges
function requireAdminOrSuperAdmin(req, res, next) {
    const { user_type } = req.user;
    if (user_type === 'admin' || user_type === 'superadmin') {
        return next();
    }
    return res.status(403).json({ error: 'Access denied. Only admin or superadmin can perform this action.' });
}

// CREATE a new subscription
router.post('/', authenticateToken, requireAdminOrSuperAdmin, async (req, res) => {
    const { user_id, subscription_type, start_date, end_date, price, payment_method, payment_status, transaction_id, plan_id } = req.body;

    if (!user_id || !subscription_type || !start_date || !price || !payment_method || !payment_status || !plan_id) {
        return res.status(400).json({ error: 'Missing required fields.' });
    }

    try {
        const [result] = await db.execute(
            `INSERT INTO subscriptions 
            (user_id, subscription_type, start_date, end_date, price, payment_method, payment_status, transaction_id, plan_id) 
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [user_id, subscription_type, start_date, end_date, price, payment_method, payment_status, transaction_id, plan_id]
        );

        res.status(201).json({
            id: result.insertId,
            user_id,
            subscription_type,
            start_date,
            end_date,
            price,
            payment_method,
            payment_status,
            transaction_id,
            plan_id,
        });
    } catch (error) {
        console.error(error);
        if (error.code === 'ER_DUP_ENTRY') {
            res.status(409).json({ error: 'Transaction ID already exists.' });
        } else {
            res.status(500).json({ error: 'Server error.' });
        }
    }
});

// READ all subscriptions (with optional filters)
router.get('/', authenticateToken, async (req, res) => {
    const { user_id, subscription_type, payment_status, plan_id, page = 1, limit = 10 } = req.query;

    const filters = [];
    const values = [];

    if (user_id) {
        filters.push('user_id = ?');
        values.push(user_id);
    }
    if (subscription_type) {
        filters.push('subscription_type = ?');
        values.push(subscription_type);
    }
    if (payment_status) {
        filters.push('payment_status = ?');
        values.push(payment_status);
    }
    if (plan_id) {
        filters.push('plan_id = ?');
        values.push(plan_id);
    }

    const whereClause = filters.length ? `WHERE ${filters.join(' AND ')}` : '';
    const offset = (page - 1) * limit;

    try {
        const [rows] = await db.execute(
            `SELECT * FROM subscriptions ${whereClause} ORDER BY created_at DESC LIMIT ? OFFSET ?`,
            [...values, parseInt(limit, 10), parseInt(offset, 10)]
        );
        res.status(200).json(rows);
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Server error.' });
    }
});

// READ a single subscription by ID
router.get('/:id', authenticateToken, async (req, res) => {
    const { id } = req.params;

    try {
        const [rows] = await db.execute(`SELECT * FROM subscriptions WHERE id = ?`, [id]);
        if (rows.length === 0) {
            return res.status(404).json({ error: 'Subscription not found.' });
        }
        res.status(200).json(rows[0]);
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Server error.' });
    }
});

// PARTIAL UPDATE a subscription
router.patch('/:id', authenticateToken, requireAdminOrSuperAdmin, async (req, res) => {
    const { id } = req.params;
    const updates = req.body;

    if (!updates || Object.keys(updates).length === 0) {
        return res.status(400).json({ error: 'No fields to update.' });
    }

    const fields = Object.keys(updates).map((field) => `${field} = ?`).join(', ');
    const values = Object.values(updates);

    try {
        const [result] = await db.execute(
            `UPDATE subscriptions SET ${fields}, updated_at = current_timestamp() WHERE id = ?`,
            [...values, id]
        );
        if (result.affectedRows === 0) {
            return res.status(404).json({ error: 'Subscription not found.' });
        }
        res.status(200).json({ message: 'Subscription updated successfully.' });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Server error.' });
    }
});

// DELETE a subscription
router.delete('/:id', authenticateToken, requireAdminOrSuperAdmin, async (req, res) => {
    const { id } = req.params;

    try {
        const [result] = await db.execute(`DELETE FROM subscriptions WHERE id = ?`, [id]);
        if (result.affectedRows === 0) {
            return res.status(404).json({ error: 'Subscription not found.' });
        }
        res.status(200).json({ message: 'Subscription deleted successfully.' });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Server error.' });
    }
});

module.exports = router;
