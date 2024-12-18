const express = require('express');
const db = require('../dbPromise'); // MySQL connection
const authenticateToken = require('../customMiddleware'); // Token-based authentication

const router = express.Router();

// CREATE a new match
router.post('/', authenticateToken, async (req, res) => {
    const { user_id, matched_user_id, compatibility_score, is_liked } = req.body;

    if (!user_id || !matched_user_id) {
        return res.status(400).json({ error: 'user_id and matched_user_id are required.' });
    }

    try {
        const [result] = await db.execute(
            `INSERT INTO matching (user_id, matched_user_id, compatibility_score, is_liked, matched_date) 
            VALUES (?, ?, ?, ?, ?)`,
            [
                user_id,
                matched_user_id,
                compatibility_score || 0.00,
                is_liked || 0,
                new Date(),
            ]
        );
        res.status(201).json({
            id: result.insertId,
            user_id,
            matched_user_id,
            compatibility_score: compatibility_score || 0.00,
            is_liked: is_liked || 0,
            is_mutual: 0,
            matched_date: new Date(),
        });
    } catch (error) {
        console.error(error);
        if (error.code === 'ER_DUP_ENTRY') {
            res.status(409).json({ error: 'Match already exists between these users.' });
        } else {
            res.status(500).json({ error: 'Server error.' });
        }
    }
});

// READ all matches for a user
router.get('/', authenticateToken, async (req, res) => {
    const { user_id, is_mutual, is_liked, page = 1, limit = 10 } = req.query;

    if (!user_id) {
        return res.status(400).json({ error: 'user_id is required.' });
    }

    const filters = ['user_id = ?'];
    const values = [user_id];

    if (is_mutual !== undefined) {
        filters.push('is_mutual = ?');
        values.push(parseInt(is_mutual));
    }
    if (is_liked !== undefined) {
        filters.push('is_liked = ?');
        values.push(parseInt(is_liked));
    }

    const whereClause = filters.length ? `WHERE ${filters.join(' AND ')}` : '';
    const offset = (page - 1) * limit;

    try {
        const [rows] = await db.execute(
            `SELECT * FROM matching ${whereClause} ORDER BY matched_date DESC LIMIT ? OFFSET ?`,
            [...values, parseInt(limit), parseInt(offset)]
        );
        res.status(200).json(rows);
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Server error.' });
    }
});

// READ a single match by ID
router.get('/:id', authenticateToken, async (req, res) => {
    const { id } = req.params;

    try {
        const [rows] = await db.execute(`SELECT * FROM matching WHERE id = ?`, [id]);
        if (rows.length === 0) {
            return res.status(404).json({ error: 'Match not found.' });
        }
        res.status(200).json(rows[0]);
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Server error.' });
    }
});

// PARTIAL UPDATE a match (e.g., mark as liked or mutual)
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
            `UPDATE matching SET ${fields} WHERE id = ?`,
            [...values, id]
        );
        if (result.affectedRows === 0) {
            return res.status(404).json({ error: 'Match not found.' });
        }
        res.status(200).json({ message: 'Match updated successfully.' });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Server error.' });
    }
});

// DELETE a match
router.delete('/:id', authenticateToken, async (req, res) => {
    const { id } = req.params;

    try {
        const [result] = await db.execute(`DELETE FROM matching WHERE id = ?`, [id]);
        if (result.affectedRows === 0) {
            return res.status(404).json({ error: 'Match not found.' });
        }
        res.status(200).json({ message: 'Match deleted successfully.' });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Server error.' });
    }
});

module.exports = router;
