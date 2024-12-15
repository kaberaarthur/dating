const express = require('express');
const db = require('../dbPromise');  // Import the MySQL pool connection
const authenticateToken = require('../customMiddleware');  // Import the authenticateToken middleware

const router = express.Router();

// Create a new user profile
router.post('/', authenticateToken, async (req, res) => {
    const { name, date_of_birth, gender, bio, interests } = req.body;
    const user_id = req.user.id;  // Get the user ID from the JWT

    if (!name || !date_of_birth || !gender) {
        return res.status(400).json({ error: 'Name, date of birth, and gender are required' });
    }

    try {
        const [result] = await db.execute(
            'INSERT INTO user_profiles (user_id, name, date_of_birth, gender, bio, interests) VALUES (?, ?, ?, ?, ?, ?)',
            [user_id, name, date_of_birth, gender, bio, JSON.stringify(interests)]
        );
        res.status(201).json({ id: result.insertId, name, date_of_birth, gender, bio, interests });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Server error' });
    }
});

// Get user profile
router.get('/:id', authenticateToken, async (req, res) => {
    const { id } = req.params;
    const user_id = req.user.id;

    if (parseInt(id) !== user_id) {
        return res.status(403).json({ error: 'You can only view your own profile.' });
    }

    try {
        const [rows] = await db.execute('SELECT * FROM user_profiles WHERE user_id = ?', [user_id]);
        if (rows.length === 0) {
            return res.status(404).json({ error: 'Profile not found' });
        }
        res.status(200).json(rows[0]);
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Server error' });
    }
});

// Update user profile
router.patch('/:id', authenticateToken, async (req, res) => {
    const { id } = req.params;
    const { name, date_of_birth, gender, bio, interests } = req.body;
    const user_id = req.user.id;

    if (parseInt(id) !== user_id) {
        return res.status(403).json({ error: 'You can only update your own profile.' });
    }

    const fieldsToUpdate = [];
    const values = [];

    if (name) {
        fieldsToUpdate.push('name = ?');
        values.push(name);
    }
    if (date_of_birth) {
        fieldsToUpdate.push('date_of_birth = ?');
        values.push(date_of_birth);
    }
    if (gender) {
        fieldsToUpdate.push('gender = ?');
        values.push(gender);
    }
    if (bio) {
        fieldsToUpdate.push('bio = ?');
        values.push(bio);
    }
    if (interests) {
        fieldsToUpdate.push('interests = ?');
        values.push(JSON.stringify(interests));
    }

    if (fieldsToUpdate.length === 0) {
        return res.status(400).json({ error: 'No fields to update' });
    }

    try {
        const query = `UPDATE user_profiles SET ${fieldsToUpdate.join(', ')} WHERE user_id = ? AND id = ?`;
        values.push(user_id, id);
        const [result] = await db.execute(query, values);

        if (result.affectedRows === 0) {
            return res.status(404).json({ error: 'Profile not found or not owned by user' });
        }

        res.status(200).json({ message: 'Profile updated successfully' });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Server error' });
    }
});

// Delete user profile
router.delete('/:id', authenticateToken, async (req, res) => {
    const { id } = req.params;
    const user_id = req.user.id;

    if (parseInt(id) !== user_id) {
        return res.status(403).json({ error: 'You can only delete your own profile.' });
    }

    try {
        const [result] = await db.execute('DELETE FROM user_profiles WHERE id = ? AND user_id = ?', [id, user_id]);

        if (result.affectedRows === 0) {
            return res.status(404).json({ error: 'Profile not found or not owned by user' });
        }

        res.status(200).json({ message: 'Profile deleted successfully' });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Server error' });
    }
});

module.exports = router;
