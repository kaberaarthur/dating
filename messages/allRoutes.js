const express = require('express');
const db = require('../dbPromise'); // MySQL pool connection
const authenticateToken = require('../customMiddleware'); // Middleware for token authentication

const router = express.Router();

// CREATE a new message
router.post('/', authenticateToken, async (req, res) => {
    const { sender_id, receiver_id, message } = req.body;

    if (!sender_id || !receiver_id || !message) {
        return res.status(400).json({ error: 'sender_id, receiver_id, and message are required.' });
    }

    try {
        const [result] = await db.execute(
            `INSERT INTO messages (sender_id, receiver_id, message) VALUES (?, ?, ?)`,
            [sender_id, receiver_id, message]
        );
        res.status(201).json({
            id: result.insertId,
            sender_id,
            receiver_id,
            message,
            timestamp: new Date(),
            is_read: 0,
        });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Server error.' });
    }
});

// READ all messages (with optional filters)
router.get('/', authenticateToken, async (req, res) => {
    const { sender_id, receiver_id, is_read, page = 1, limit = 10 } = req.query;

    const filters = [];
    const values = [];
    if (sender_id) {
        filters.push('sender_id = ?');
        values.push(sender_id);
    }
    if (receiver_id) {
        filters.push('receiver_id = ?');
        values.push(receiver_id);
    }
    if (is_read !== undefined) {
        filters.push('is_read = ?');
        values.push(parseInt(is_read));
    }

    const whereClause = filters.length ? `WHERE ${filters.join(' AND ')}` : '';
    const offset = (page - 1) * limit;

    try {
        const [rows] = await db.execute(
            `SELECT * FROM messages ${whereClause} ORDER BY timestamp DESC LIMIT ? OFFSET ?`,
            [...values, parseInt(limit), parseInt(offset)]
        );
        res.status(200).json(rows);
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Server error.' });
    }
});

// READ a single message by ID
router.get('/:id', authenticateToken, async (req, res) => {
    const { id } = req.params;

    try {
        const [rows] = await db.execute(`SELECT * FROM messages WHERE id = ?`, [id]);
        if (rows.length === 0) {
            return res.status(404).json({ error: 'Message not found.' });
        }
        res.status(200).json(rows[0]);
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Server error.' });
    }
});

// PARTIAL UPDATE a message (e.g., marking as read)
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
            `UPDATE messages SET ${fields} WHERE id = ?`,
            [...values, id]
        );
        if (result.affectedRows === 0) {
            return res.status(404).json({ error: 'Message not found.' });
        }
        res.status(200).json({ message: 'Message updated successfully.' });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Server error.' });
    }
});

// DELETE a message
router.delete('/:id', authenticateToken, async (req, res) => {
    const { id } = req.params;

    try {
        const [result] = await db.execute(`DELETE FROM messages WHERE id = ?`, [id]);
        if (result.affectedRows === 0) {
            return res.status(404).json({ error: 'Message not found.' });
        }
        res.status(200).json({ message: 'Message deleted successfully.' });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Server error.' });
    }
});

module.exports = router;
