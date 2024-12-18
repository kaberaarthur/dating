const express = require('express');
const db = require('../dbPromise'); // MySQL connection with promises
const authenticateToken = require('../customMiddleware'); // Middleware for user authentication

const router = express.Router();

// CREATE a feature access record
router.post('/', authenticateToken, async (req, res) => {
    const { user_id, feature, access_start, access_end, is_active } = req.body;

    if (!user_id || !feature || !access_start || !access_end) {
        return res.status(400).json({ error: 'user_id, feature, access_start, and access_end are required.' });
    }

    try {
        const [result] = await db.execute(
            `INSERT INTO features_access (user_id, feature, access_start, access_end, is_active) 
             VALUES (?, ?, ?, ?, ?)`,
            [
                user_id,
                feature,
                access_start,
                access_end,
                is_active || 0,
            ]
        );
        res.status(201).json({
            id: result.insertId,
            user_id,
            feature,
            access_start,
            access_end,
            is_active: is_active || 0,
            created_at: new Date(),
            updated_at: new Date(),
        });
    } catch (error) {
        console.error(error);
        if (error.code === 'ER_DUP_ENTRY') {
            res.status(409).json({ error: 'Feature access already exists for this user and feature.' });
        } else {
            res.status(500).json({ error: 'Server error.' });
        }
    }
});

// READ all feature access records for a user
router.get('/', authenticateToken, async (req, res) => {
    const { user_id, feature, is_active } = req.query;

    if (!user_id) {
        return res.status(400).json({ error: 'user_id is required.' });
    }

    const filters = ['user_id = ?'];
    const values = [user_id];

    if (feature) {
        filters.push('feature = ?');
        values.push(feature);
    }
    if (is_active !== undefined) {
        filters.push('is_active = ?');
        values.push(parseInt(is_active));
    }

    const whereClause = filters.length ? `WHERE ${filters.join(' AND ')}` : '';

    try {
        const [rows] = await db.execute(
            `SELECT * FROM features_access ${whereClause} ORDER BY created_at DESC`
        );
        res.status(200).json(rows);
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Server error.' });
    }
});

// READ a single feature access record by ID
router.get('/:id', authenticateToken, async (req, res) => {
    const { id } = req.params;

    try {
        const [rows] = await db.execute(`SELECT * FROM features_access WHERE id = ?`, [id]);
        if (rows.length === 0) {
            return res.status(404).json({ error: 'Feature access record not found.' });
        }
        res.status(200).json(rows[0]);
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Server error.' });
    }
});

// PARTIAL UPDATE a feature access record
router.patch('/:id', authenticateToken, async (req, res) => {
    const { id } = req.params;
    const updates = req.body;

    if (!updates || Object.keys(updates).length === 0) {
        return res.status(400).json({ error: 'No fields to update.' });
    }

    const fields = Object.keys(updates).map((field) => `${field} = ?`).join(', ');
    const values = Object.values(updates);

    try {
        const [result] = await db.execute(
            `UPDATE features_access SET ${fields}, updated_at = current_timestamp() WHERE id = ?`,
            [...values, id]
        );
        if (result.affectedRows === 0) {
            return res.status(404).json({ error: 'Feature access record not found.' });
        }
        res.status(200).json({ message: 'Feature access record updated successfully.' });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Server error.' });
    }
});

// DELETE a feature access record
router.delete('/:id', authenticateToken, async (req, res) => {
    const { id } = req.params;

    try {
        const [result] = await db.execute(`DELETE FROM features_access WHERE id = ?`, [id]);
        if (result.affectedRows === 0) {
            return res.status(404).json({ error: 'Feature access record not found.' });
        }
        res.status(200).json({ message: 'Feature access record deleted successfully.' });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Server error.' });
    }
});

module.exports = router;
