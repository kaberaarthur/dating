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
  

  router.get('/', authenticateToken, async (req, res) => {
    const user_id = req.user.id;

    const values = [user_id, user_id]; // Always include sender and receiver filters
    let whereClause = 'WHERE (sender_id = ? OR receiver_id = ?)';

    try {      
        const [rows] = await db.execute(
            `SELECT * FROM messages ${whereClause} ORDER BY timestamp DESC`,
            values
        );

        // Transform the data into the desired format
        const formattedData = rows.reduce((result, row) => {
            const isRequesterSender = row.sender_id === user_id;

            // Check if a conversation with this contact already exists
            let conversation = result.find(
                (conv) => conv.id === (isRequesterSender ? row.receiver_id : row.sender_id)
            );

            if (!conversation) {
                // Add a new conversation
                conversation = {
                    id: isRequesterSender ? row.receiver_id : row.sender_id,
                    name: isRequesterSender ? row.receiver_name : row.sender_name,
                    profilePicture: isRequesterSender
                        ? row.receiver_profile_picture
                        : row.sender_profile_picture,
                    conversation: [],
                };
                result.push(conversation);
            }

            // Format timestamp to include date and time
            const formattedTimestamp = new Date(row.timestamp).toLocaleString([], { 
                weekday: 'short', 
                year: 'numeric', 
                month: 'short', 
                day: 'numeric', 
                hour: '2-digit', 
                minute: '2-digit' 
            });

            // Add the message to the conversation
            conversation.conversation.push({
                sender: isRequesterSender ? 'You' : row.sender_name,
                message: row.message,
                timestamp: formattedTimestamp,
            });

            return result;
        }, []);

        res.status(200).json(formattedData);
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Server error.' });
    }
});

router.get('/messages-limit', authenticateToken, async (req, res) => {
  const user_id = req.user.id;
  const currentDate = new Date(); // Current date: March 15, 2025 based on system date

  try {
      // Get subscription information
      const [subscriptionRows] = await db.execute(
          'SELECT end_date FROM subscriptions WHERE user_id = ?',
          [user_id]
      );

      // Get user profile information
      const [profileRows] = await db.execute(
          'SELECT gender, created_at FROM user_profiles WHERE user_id = ?',
          [user_id]
      );

      // Get count of messages sent (more efficient than selecting all columns)
      const [messagesSentResult] = await db.execute(
          'SELECT COUNT(*) as sentCount FROM messages WHERE sender_id = ?',
          [user_id]
      );
      const messagesSent = messagesSentResult[0].sentCount;

      // If no profile exists, return error
      if (!profileRows.length) {
          return res.status(404).json({ error: 'User profile not found' });
      }

      const { gender, created_at } = profileRows[0];
      const accountCreationDate = new Date(created_at);
      const daysSinceCreation = Math.floor(
          (currentDate - accountCreationDate) / (1000 * 60 * 60 * 24)
      );

      let baseMessageLimit = 0;
      const hasActiveSubscription = subscriptionRows.length > 0 && 
          new Date(subscriptionRows[0].end_date) > currentDate;

      if (hasActiveSubscription) {
          // Active subscription: unlimited messages for both genders
          baseMessageLimit = 1000000;
      } else {
          // No active subscription
          if (gender === 'female') {
              // Females: 50 messages for first 5 days, then 0
              if (daysSinceCreation <= 5) {
                  baseMessageLimit = 50;
              } else {
                  baseMessageLimit = 0;
              }
          } else if (gender === 'male') {
              // Males: 30 messages for first day, then 0
              if (daysSinceCreation <= 1) {
                  baseMessageLimit = 30;
              } else {
                  baseMessageLimit = 0;
              }
          } else {
              // Unknown gender: default to 0
              baseMessageLimit = 0;
          }
      }

      // Calculate remaining messages by subtracting sent messages
      const remainingMessageLimit = Math.max(0, baseMessageLimit - messagesSent);

      res.status(200).json({
          messageLimit: remainingMessageLimit,  // Now represents remaining messages
          messagesSent: messagesSent,           // Added for frontend info
          hasActiveSubscription,
          daysSinceCreation,
          gender
      });
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
