const express = require('express');
const db = require('../dbPromise');  // Import the MySQL pool connection
const authenticateToken = require('../customMiddleware');  // Import the authenticateToken middleware

const router = express.Router();

// Create a new user profile
router.post('/', authenticateToken, async (req, res) => {
    const { name, date_of_birth, gender, bio, reason, interests } = req.body;
    const user_id = req.user.id;  // Get the user ID from the JWT

    if (!name || !date_of_birth || !gender) {
        return res.status(400).json({ error: 'Name, date of birth, and gender are required' });
    }

    try {
        const [result] = await db.execute(
            'INSERT INTO user_profiles (user_id, name, date_of_birth, gender, bio, reason, interests) VALUES (?, ?, ?, ?, ?, ?, ?)',
            [user_id, name, date_of_birth, gender, bio, reason, JSON.stringify(interests)]
        );
        res.status(201).json({ id: result.insertId, name, date_of_birth, gender, bio, reason, interests });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Server error' });
    }
});

// Get user profile
router.get('/:id', authenticateToken, async (req, res) => {
    const { id } = req.params;
    const user_id = req.user.id;  // Get the user ID from the JWT token
    const user_type = req.user.user_type;  // Get the user type from the JWT token

    try {
        // Check if the requested profile exists in the user_profiles table
        const [rows] = await db.execute('SELECT * FROM user_profiles WHERE id = ?', [id]);
        if (rows.length === 0) {
            return res.status(404).json({ error: 'Profile not found' });
        }

        // Check if the user ID from the profile matches the user ID in the token
        const profileUserId = rows[0].user_id;
        if (profileUserId !== user_id && user_type !== 'admin' && user_type !== 'superadmin') {
            return res.status(403).json({ error: 'You are not authorized to view this profile.' });
        }

        // Return the profile data
        res.status(200).json(rows[0]);
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Server error' });
    }
    
});


// Update user profile
router.patch('/:id', authenticateToken, async (req, res) => {
    const { id } = req.params;
    const { name, date_of_birth, gender, bio, reason, interests } = req.body;
    const user_id = req.user.id;
    const user_type = req.user.user_type;

    try {
        // Check if the requested profile exists in the user_profiles table
        const [rows] = await db.execute('SELECT * FROM user_profiles WHERE id = ?', [id]);
        if (rows.length === 0) {
            return res.status(404).json({ error: 'Profile not found' });
        }

        // Check if the user ID from the profile matches the user ID in the token
        const profileUserId = rows[0].user_id;
        if (profileUserId !== user_id && user_type !== 'admin' && user_type !== 'superadmin') {
            return res.status(403).json({ error: 'You are not authorized to edit this profile.' });
        }

        // Perform the Update Here
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
        if (reason) {
            fieldsToUpdate.push('reason = ?');
            values.push(reason);
        }
        if (interests) {
            fieldsToUpdate.push('interests = ?');
            values.push(JSON.stringify(interests));
        }

        if (fieldsToUpdate.length === 0) {
            return res.status(400).json({ error: 'No fields to update' });
        }

        // Perform the Update here
        try {
            const query = `UPDATE user_profiles SET ${fieldsToUpdate.join(', ')} WHERE id = ?`;
            values.push(id);
            const [result] = await db.execute(query, values);
    
            if (result.affectedRows === 0) {
                return res.status(404).json({ error: 'Profile not found or not owned by user' });
            }
    
            res.status(200).json({ message: 'Profile updated successfully' });
        } catch (error) {
            console.error(error);
            res.status(500).json({ error: 'Server error' });
        }

    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Server error' });
    }
});

// Delete user profile
router.delete('/:id', authenticateToken, async (req, res) => {
    const { id } = req.params;
    const user_id = req.user.id;
    const user_type = req.user.user_type;

    try {
        // Check if the requested profile exists in the user_profiles table
        const [rows] = await db.execute('SELECT * FROM user_profiles WHERE id = ?', [id]);
        if (rows.length === 0) {
            return res.status(404).json({ error: 'Profile not found' });
        }

        // Check if the user ID from the profile matches the user ID in the token
        const profileUserId = rows[0].user_id;
        if (profileUserId !== user_id && user_type !== 'admin' && user_type !== 'superadmin') {
            return res.status(403).json({ error: 'You are not authorized to edit this profile.' });
        }

        // Conduct the delete function
        const [result] = await db.execute(
            'DELETE FROM user_profiles WHERE id = ?',
            [id]
        );

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
