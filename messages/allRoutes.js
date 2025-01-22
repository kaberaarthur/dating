const express = require('express');
const db = require('../dbPromise'); // MySQL pool connection
const authenticateToken = require('../customMiddleware'); // Middleware for token authentication

const router = express.Router();

// Function to get Profile details from 'profiles' table
const getUserProfile = async (sender_id) => {
    try {
      // Validate the sender_id
      if (!sender_id) {
        throw new Error('sender_id is required.');
      }
  
      // Execute the SQL query to get the profile
      const [rows] = await db.execute(
        `SELECT * FROM user_profiles WHERE user_id = ?`,
        [sender_id]
      );
  
      // Check if the profile exists
      if (rows.length === 0) {
        throw new Error(`No profile found for user_id: ${sender_id}`);
      }
  
      // console.log('Profile fetched successfully:', rows[0]);
      return rows[0];
    } catch (error) {
      // Log the error
      console.error('Error fetching profile:', error.message);
      throw error;
    }
};

// CREATE a new message
router.post('/', authenticateToken, async (req, res) => {
    const sender_id = req.user.id;
  
    const { receiver_id, message } = req.body;
  
    // Validate required fields
    if (!receiver_id || !message) {
      return res.status(400).json({
        error: 'receiver_id and message are required.',
      });
    }
  
    try {
      // Fetch sender profile
      const sender_profile = await getUserProfile(sender_id);
      console.log('Sender Profile:', sender_profile);
  
      // Check if sender profile is valid and has a name
      if (!sender_profile || !sender_profile.name) {
        return res.status(400).json({
          error: 'Sender profile is invalid or incomplete.',
        });
      }
  
      // Fetch receiver profile
      const receiver_profile = await getUserProfile(receiver_id);
      console.log('Receiver Profile:', receiver_profile);
  
      // Ensure receiver profile exists
      if (!receiver_profile) {
        return res.status(400).json({
          error: 'Receiver profile not found.',
        });
      }
  
      // Extract necessary fields from profiles
      const sender_name = sender_profile.name;
      const sender_profile_picture = sender_profile.profile_picture || null;
      const receiver_name = receiver_profile.name;
      const receiver_profile_picture = receiver_profile.profile_picture || null;
  
      // Insert message into the database
      const [result] = await db.execute(
        `INSERT INTO messages (sender_id, receiver_id, sender_name, receiver_name, sender_profile_picture, receiver_profile_picture, message)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [
          sender_id,
          receiver_id,
          sender_name,
          receiver_name,
          sender_profile_picture,
          receiver_profile_picture,
          message,
        ]
      );
  
      // Respond with success and inserted message details
      res.status(201).json({
        id: result.insertId,
        sender_id,
        receiver_id,
        sender_name,
        receiver_name,
        sender_profile_picture,
        receiver_profile_picture,
        message,
        timestamp: new Date(),
        is_read: 0,
      });
    } catch (error) {
      console.error('Error creating message:', error.message);
      res.status(500).json({ error: 'Server error.' });
    }
  });
  


// READ all messages (with optional filters)
router.get('/', authenticateToken, async (req, res) => {
    const user_id = req.user.id; // Getting the user_id from the authenticated token
    const { is_read, page = 1, limit = 10 } = req.query;

    // console.log("User ID: ", user_id);

    const filters = ['(sender_id = ? OR receiver_id = ?)'];  // Check if user_id is either sender or receiver
    const values = [user_id, user_id];  // Set the user_id for both sender and receiver checks

    if (is_read !== undefined) {
        filters.push('is_read = ?');
        values.push(parseInt(is_read)); // Optional filter for read/unread status
    }

    const whereClause = `WHERE ${filters.join(' AND ')}`;
    const offset = (page - 1) * limit;

    try {
        const [rows] = await db.execute(
            `SELECT * FROM messages ${whereClause} ORDER BY timestamp DESC LIMIT ? OFFSET ?`,
            [...values, parseInt(limit), parseInt(offset)]
        );
        res.status(200).json(rows); // Return the filtered messages
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Server error.' });
    }
});

// DELETE a message
router.delete('/:id', authenticateToken, async (req, res) => {
    const { id } = req.params;
    const user_id = req.user.id; // Getting the user_id from the authenticated token

    console.log("User ID: ", user_id);

    try {
        // First, check if the message exists and if the user is the sender
        const [message] = await db.execute(
            `SELECT * FROM messages WHERE id = ? AND sender_id = ?`,
            [id, user_id]
        );

        // If no message is found or the user is not the sender, return a 404 error
        if (message.length === 0) {
            return res.status(404).json({ error: 'Message not found or you do not have permission to delete it.' });
        }

        // Proceed with deletion if the user is the sender
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
