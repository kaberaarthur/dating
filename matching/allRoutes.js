const express = require('express');
const db = require('../dbPromise'); // MySQL connection
const authenticateToken = require('../customMiddleware'); // Token-based authentication

const router = express.Router();

// CREATE or UPDATE a match
router.post('/', authenticateToken, async (req, res) => {
    const { matched_user_id, compatibility_score, is_liked } = req.body;

    if (!req.user || !req.user.id) {
        return res.status(400).json({ error: 'User ID is missing in token.' });
    }

    const user_id = req.user.id; // Extract user_id from the token
    console.log("User ID", user_id);

    if (!matched_user_id) {
        return res.status(400).json({ error: 'matched_user_id is required.' });
    }

    try {
        // Check if a match already exists
        const [existingMatch] = await db.execute(
            `SELECT * FROM matching 
            WHERE (user_id = ? AND matched_user_id = ?) 
               OR (user_id = ? AND matched_user_id = ?)`,
            [user_id, matched_user_id, matched_user_id, user_id]
        );

        if (existingMatch.length > 0) {
            // If a match exists, update the matched_date field
            await db.execute(
                `UPDATE matching 
                SET matched_date = ? 
                WHERE (user_id = ? AND matched_user_id = ?) 
                   OR (user_id = ? AND matched_user_id = ?)`,
                [new Date(), user_id, matched_user_id, matched_user_id, user_id]
            );

            return res.status(200).json({
                message: 'Match updated successfully.',
                user_id,
                matched_user_id,
                updated_date: new Date(),
            });
        } else {
            // Insert a new match if it doesn't exist
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

            return res.status(201).json({
                id: result.insertId,
                user_id,
                matched_user_id,
                compatibility_score: compatibility_score || 0.00,
                is_liked: is_liked || 0,
                is_mutual: 0,
                matched_date: new Date(),
            });
        }
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Server error.' });
    }
});


// READ all matches for a user
router.get('/mylikes', authenticateToken, async (req, res) => {
    const { is_liked, page = 1, limit = 10 } = req.query;

    if (!req.user || !req.user.id) {
        return res.status(400).json({ error: 'User ID is missing in token.' });
    }

    const user_id = req.user.id;

    const filters = ['m.user_id = ?', 'm.is_mutual = 0']; // Add the `is_mutual = 0` filter
    const values = [user_id];

    if (is_liked !== undefined) {
        filters.push('m.is_liked = ?');
        values.push(parseInt(is_liked));
    }

    const whereClause = `WHERE ${filters.join(' AND ')}`;
    const offset = (page - 1) * limit;

    try {
        const [rows] = await db.execute(
            `SELECT 
                m.id AS match_id,
                m.compatibility_score,
                m.is_liked,
                m.is_mutual,
                m.matched_date,
                u.name AS matched_user_name,
                u.date_of_birth,
                u.reason,
                u.interests,
                u.profile_picture
             FROM 
                matching m
             JOIN 
                user_profiles u ON m.matched_user_id = u.user_id
             ${whereClause}
             ORDER BY m.matched_date DESC
             LIMIT ? OFFSET ?`,
            [...values, parseInt(limit), parseInt(offset)]
        );

        res.status(200).json(rows);
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Server error.' });
    }
});


// Get All Documents
router.get('/', authenticateToken, async (req, res) => {

    try {
        const [rows] = await db.execute(`SELECT * FROM matching`);
        if (rows.length === 0) {
            return res.status(404).json({ error: 'Match not found.' });
        }
        res.status(200).json(rows);
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Server error.' });
    }
});

// PARTIAL UPDATE a match (e.g., mark as liked or mutual)
router.patch('/:id', authenticateToken, async (req, res) => {
    const { id } = req.params;
    const updates = req.body;

    if (!req.user || !req.user.id) {
        return res.status(400).json({ error: 'User ID is missing in token.' });
    }

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
