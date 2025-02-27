const express = require('express');
const db = require('../dbPromise'); // Import the MySQL pool connection
const authenticateToken = require('../customMiddleware'); // Import the authenticateToken middleware

const router = express.Router();

// Create a new user profile
router.post('/', authenticateToken, async (req, res) => {
    const { name, date_of_birth, gender, bio, reason, interests, county, town } = req.body;
    const user_id = req.user.id; // Get the user ID from the JWT

    if (!name || !date_of_birth || !gender || !county || !town) {
        return res.status(400).json({ error: 'Name, date of birth, gender, county, and town are required' });
    }

    try {
        const [result] = await db.execute(
            'INSERT INTO user_profiles (user_id, name, date_of_birth, gender, bio, reason, interests, county, town) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
            [user_id, name, date_of_birth, gender, bio, reason, JSON.stringify(interests), county, town]
        );
        res.status(201).json({ id: result.insertId, name, date_of_birth, gender, bio, reason, interests, county, town });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Server error' });
    }
});

// Get all user profiles with optional name filter
router.get("/my-profile", authenticateToken, async (req, res) => {
    const userId = req.user.id; // Get the user id from the token

    if (!userId) {
        return res.status(400).json({ error: "User ID not found in token" });
    }

    try {
        let query = `
            SELECT 
                up.id, 
                up.user_id, 
                up.name, 
                up.created_at, 
                up.profile_picture, 
                up.images_updated, 
                up.details_updated, 
                u.last_login, 
                u.active, 
                u.phone, 
                u.email, 
                u.user_type
            FROM user_profiles up
            JOIN users u ON up.user_id = u.id
            WHERE up.user_id = ?
        `;
        
        const [rows] = await db.execute(query, [userId]);

        if (rows.length === 0) {
            return res.status(404).json({ error: "Profile not found" });
        }

        res.status(200).json(rows[0]); // Return the first result (since user_id should be unique)
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: "Server error" });
    }
});

// Get all user profiles with optional name filter
router.get("/", authenticateToken, async (req, res) => {
    const { name } = req.query; // Get the 'name' query parameter

    try {
        let query = `
            SELECT 
                up.id, 
                up.user_id, 
                up.name, 
                up.created_at, 

                u.last_login, 
                u.active, 
                u.phone, 
                u.email, 
                u.user_type
            FROM user_profiles up
            JOIN users u ON up.user_id = u.id
        `;
        
        let values = [];

        // If a name is provided, filter by name
        if (name) {
            query += " WHERE up.name LIKE ?";
            values.push(`%${name}%`);
        }

        const [rows] = await db.execute(query, values);

        if (rows.length === 0) {
            return res.status(404).json({ error: "No profiles found" });
        }

        res.status(200).json(rows);
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: "Server error" });
    }
});

// Get user profile
router.get('/one', authenticateToken, async (req, res) => {
    const { id } = req.params;
    const user_id = req.user.id; // Get the user ID from the JWT token
    const user_type = req.user.user_type; // Get the user type from the JWT token

    try {
        const [rows] = await db.execute('SELECT * FROM user_profiles WHERE user_id = ?', [user_id]);
        if (rows.length === 0) {
            return res.status(404).json({ error: 'Profile not found' });
        }

        const profileUserId = rows[0].user_id;
        if (profileUserId !== user_id && user_type !== 'admin' && user_type !== 'superadmin') {
            return res.status(403).json({ error: 'You are not authorized to view this profile.' });
        }

        res.status(200).json(rows[0]);
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Server error' });
    }
});

// Update user profile
router.patch('/one', authenticateToken, async (req, res) => {
    const user_id = req.user.id;
    const user_type = req.user.user_type;

    const {
        name, date_of_birth, gender, bio, reason, interests, county, town,
        career, education, height, fitness, religion, images_updated
    } = req.body;

    try {
        // Check if user profile exists
        const [rows] = await db.execute('SELECT user_id FROM user_profiles WHERE user_id = ?', [user_id]);
        if (rows.length === 0) return res.status(404).json({ error: 'Profile not found' });

        // Authorization check
        if (rows[0].user_id !== user_id && !['admin', 'superadmin'].includes(user_type)) {
            return res.status(403).json({ error: 'Unauthorized to edit this profile.' });
        }

        const fieldsToUpdate = [];
        const values = [];

        const fields = {
            name, date_of_birth, gender, bio, reason, interests, county, town,
            career, education, height, fitness, religion, images_updated
        };

        Object.entries(fields).forEach(([key, value]) => {
            if (value !== undefined) {  // Only include fields that are present in req.body
                fieldsToUpdate.push(`${key} = ?`);
                values.push(key === "interests" ? JSON.stringify(value) : value);
            }
        });

        // Ensure `details_updated` is set to `1`
        fieldsToUpdate.push(`details_updated = ?`);
        values.push(1);

        if (!fieldsToUpdate.length) return res.status(400).json({ error: 'No fields to update' });

        values.push(user_id);
        const query = `UPDATE user_profiles SET ${fieldsToUpdate.join(', ')} WHERE user_id = ?`;
        const [result] = await db.execute(query, values);

        if (result.affectedRows === 0) return res.status(404).json({ error: 'Profile not found or not updated' });

        res.status(200).json({ message: 'Profile updated successfully' });
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Server error' });
    }
});


// Delete user profile
router.delete('/:id', authenticateToken, async (req, res) => {
    const { id } = req.params;
    const user_id = req.user.id;
    const user_type = req.user.user_type;

    try {
        const [rows] = await db.execute('SELECT * FROM user_profiles WHERE id = ?', [id]);
        if (rows.length === 0) {
            return res.status(404).json({ error: 'Profile not found' });
        }

        const profileUserId = rows[0].user_id;
        if (profileUserId !== user_id && user_type !== 'admin' && user_type !== 'superadmin') {
            return res.status(403).json({ error: 'You are not authorized to edit this profile.' });
        }

        const [result] = await db.execute('DELETE FROM user_profiles WHERE id = ?', [id]);

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
