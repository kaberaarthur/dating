const express = require('express');
const db = require('../dbPromise');  // Import MySQL pool connection
const authenticateToken = require('../customMiddleware');  // Import middleware

const router = express.Router();

// Create a new user image
router.post('/', authenticateToken, async (req, res) => {
    const { image_url, is_profile_picture } = req.body;
    const user_id = req.user.id; // Get user ID from token

    if (!image_url) {
        return res.status(400).json({ error: 'Image URL is required' });
    }

    try {
        const [result] = await db.execute(
            'INSERT INTO user_images (user_id, image_url, is_profile_picture) VALUES (?, ?, ?)',
            [user_id, image_url, is_profile_picture || 0]
        );
        res.status(201).json({ id: result.insertId, user_id, image_url, is_profile_picture });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Server error' });
    }
});

// Get a single image by ID
router.get('/:id', authenticateToken, async (req, res) => {
    const { id } = req.params;

    try {
        const [rows] = await db.execute('SELECT * FROM user_images WHERE id = ?', [id]);
        if (rows.length === 0) {
            return res.status(404).json({ error: 'Image not found' });
        }

        const imageUserId = rows[0].user_id;
        if (imageUserId !== req.user.id) {
            return res.status(403).json({ error: 'You are not authorized to view this image.' });
        }

        res.status(200).json(rows[0]);
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Server error' });
    }
});

// Get all images for a specific user
router.get('/user/:user_id', authenticateToken, async (req, res) => {
    const { user_id } = req.params;

    if (parseInt(user_id, 10) !== req.user.id) {
        return res.status(403).json({ error: 'You are not authorized to view these images.' });
    }

    try {
        const [rows] = await db.execute('SELECT * FROM user_images WHERE user_id = ?', [user_id]);
        res.status(200).json(rows);
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Server error' });
    }
});

// Get all images with pagination
router.get('/', authenticateToken, async (req, res) => {
    const { page = 1, limit = 10 } = req.query;  // Default page 1, limit 10

    const offset = (page - 1) * limit;

    try {
        const [rows] = await db.execute(
            'SELECT * FROM user_images ORDER BY uploaded_at DESC LIMIT ? OFFSET ?',
            [parseInt(limit, 10), parseInt(offset, 10)]
        );

        const [totalResult] = await db.execute('SELECT COUNT(*) AS total FROM user_images');
        const total = totalResult[0].total;

        const response = {
            images: rows,
            pagination: {
                total,
                currentPage: parseInt(page, 10),
                totalPages: Math.ceil(total / limit),
                limit: parseInt(limit, 10),
            },
        };

        res.status(200).json(response);
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Server error' });
    }
});

// Update a user image
router.patch('/:id', authenticateToken, async (req, res) => {
    const { id } = req.params;
    const { image_url, is_profile_picture } = req.body;

    try {
        const [rows] = await db.execute('SELECT * FROM user_images WHERE id = ?', [id]);
        if (rows.length === 0) {
            return res.status(404).json({ error: 'Image not found' });
        }

        const imageUserId = rows[0].user_id;
        if (imageUserId !== req.user.id) {
            return res.status(403).json({ error: 'You are not authorized to update this image.' });
        }

        const [result] = await db.execute(
            'UPDATE user_images SET image_url = COALESCE(?, image_url), is_profile_picture = COALESCE(?, is_profile_picture) WHERE id = ?',
            [image_url, is_profile_picture, id]
        );

        if (result.affectedRows === 0) {
            return res.status(400).json({ error: 'No changes were made.' });
        }

        res.status(200).json({ message: 'Image updated successfully.' });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Server error' });
    }
});

// Delete a user image
router.delete('/:id', authenticateToken, async (req, res) => {
    const { id } = req.params;

    try {
        const [rows] = await db.execute('SELECT * FROM user_images WHERE id = ?', [id]);
        if (rows.length === 0) {
            return res.status(404).json({ error: 'Image not found' });
        }

        const imageUserId = rows[0].user_id;
        if (imageUserId !== req.user.id) {
            return res.status(403).json({ error: 'You are not authorized to delete this image.' });
        }

        await db.execute('DELETE FROM user_images WHERE id = ?', [id]);
        res.status(200).json({ message: 'Image deleted successfully.' });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Server error' });
    }
});

module.exports = router;
