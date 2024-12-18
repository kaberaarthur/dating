const express = require('express');
const db = require('../dbPromise'); // MySQL promise-based connection
const authenticateToken = require('../customMiddleware'); // Middleware for authentication

const router = express.Router();

// Middleware to ensure admin or superadmin privileges
function requireAdminOrSuperAdmin(req, res, next) {
    const { user_type } = req.user;
    if (user_type === 'admin' || user_type === 'superadmin') {
        return next();
    }
    return res.status(403).json({ error: 'Access denied. Only admin or superadmin can perform this action.' });
}

// CREATE a new plan
router.post('/', authenticateToken, requireAdminOrSuperAdmin, async (req, res) => {
    const { name, description, price_male, price_female, features } = req.body;

    if (!name || !price_male || !price_female) {
        return res.status(400).json({ error: 'Name, price_male, and price_female are required.' });
    }

    try {
        const [result] = await db.execute(
            `INSERT INTO plans (name, description, price_male, price_female, features) VALUES (?, ?, ?, ?, ?)`,
            [
                name,
                description || null,
                price_male,
                price_female,
                features ? JSON.stringify(features) : null,
            ]
        );

        res.status(201).json({
            id: result.insertId,
            name,
            description,
            price_male,
            price_female,
            features,
        });
    } catch (error) {
        console.error(error);
        if (error.code === 'ER_DUP_ENTRY') {
            res.status(409).json({ error: 'A plan with this name already exists.' });
        } else {
            res.status(500).json({ error: 'Server error.' });
        }
    }
});

// READ all plans with optional filters
router.get('/', authenticateToken, async (req, res) => {
    const { price_male, price_female, created_after, created_before } = req.query;

    const filters = [];
    const values = [];

    if (price_male) {
        filters.push('price_male = ?');
        values.push(price_male);
    }

    if (price_female) {
        filters.push('price_female = ?');
        values.push(price_female);
    }

    if (created_after) {
        filters.push('created_at >= ?');
        values.push(created_after);
    }

    if (created_before) {
        filters.push('created_at <= ?');
        values.push(created_before);
    }

    const whereClause = filters.length ? `WHERE ${filters.join(' AND ')}` : '';

    try {
        const [rows] = await db.execute(
            `SELECT * FROM plans ${whereClause} ORDER BY created_at DESC`
            , values
        );
        res.status(200).json(rows);
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Server error.' });
    }
});

// READ a single plan by ID
router.get('/:id', authenticateToken, async (req, res) => {
    const { id } = req.params;

    try {
        const [rows] = await db.execute('SELECT * FROM plans WHERE id = ?', [id]);
        if (rows.length === 0) {
            return res.status(404).json({ error: 'Plan not found.' });
        }
        res.status(200).json(rows[0]);
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Server error.' });
    }
});

// UPDATE a plan partially
router.patch('/:id', authenticateToken, requireAdminOrSuperAdmin, async (req, res) => {
    const { id } = req.params;
    const updates = req.body;

    if (!updates || Object.keys(updates).length === 0) {
        return res.status(400).json({ error: 'No fields to update.' });
    }

    const fields = Object.keys(updates).map((field) => {
        if (field === 'features') {
            return `${field} = ?`;
        }
        return `${field} = ?`;
    }).join(', ');

    const values = Object.entries(updates).map(([field, value]) => 
        field === 'features' ? JSON.stringify(value) : value
    );

    try {
        const [result] = await db.execute(
            `UPDATE plans SET ${fields}, updated_at = current_timestamp() WHERE id = ?`,
            [...values, id]
        );

        if (result.affectedRows === 0) {
            return res.status(404).json({ error: 'Plan not found.' });
        }

        // Fetch the updated plan
        const [updatedPlan] = await db.execute('SELECT * FROM plans WHERE id = ?', [id]);

        if (updatedPlan.length === 0) {
            return res.status(404).json({ error: 'Plan not found after update.' });
        }

        res.status(200).json({
            message: 'Plan updated successfully.',
            updatedPlan: updatedPlan[0],
        });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Server error.' });
    }
});


// DELETE a plan
router.delete('/:id', authenticateToken, requireAdminOrSuperAdmin, async (req, res) => {
    const { id } = req.params;

    try {
        const [result] = await db.execute('DELETE FROM plans WHERE id = ?', [id]);
        if (result.affectedRows === 0) {
            return res.status(404).json({ error: 'Plan not found.' });
        }

        res.status(200).json({ message: 'Plan deleted successfully.' });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Server error.' });
    }
});

module.exports = router;
