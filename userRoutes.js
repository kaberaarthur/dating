const express = require('express');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const { v4: uuidv4 } = require('uuid');
const db = require('./dbPromise');

const router = express.Router();
const JWT_SECRET = 'gE4jiApK5sCdBx4';
const REFRESH_TOKEN_SECRET = 'N0p4$$word?';
const REFRESH_TOKEN_EXPIRY = '1000d';
const ACCESS_TOKEN_EXPIRY = '12000h';

// Middleware to verify access tokens
const authenticateToken = (req, res, next) => {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];
    if (!token) return res.status(401).json({ error: 'Access token required' });

    jwt.verify(token, JWT_SECRET, (err, user) => {
        if (err) return res.status(403).json({ error: 'Invalid token' });
        req.user = user;
        next();
    });
};


router.post('/register', async (req, res) => {
    const { name, email, password, phone, auth_provider = 'manual', email_verified = false, phone_verified = false, two_fa_enabled = false } = req.body;

    if (!name || !email || !password || !phone) {
        return res.status(400).json({ error: 'All fields are required' });
    }

    try {
        const hashedPassword = await bcrypt.hash(password, 10);
        const created_at = new Date();
        const tokenExpiry = new Date(Date.now() + 1000 * 60 * 60 * 24 * 1000); // Example: 1000 days from now

        const user_type = "customer";

        // Generate refresh token first
        const refreshToken = jwt.sign(
            { email },
            REFRESH_TOKEN_SECRET,
            { expiresIn: REFRESH_TOKEN_EXPIRY }
        );

        const query = `
            INSERT INTO users (name, email, password, phone, user_type, auth_provider, email_verified, phone_verified, 2fa_enabled, created_at, refresh_token, token_expiry) 
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `;
        const [result] = await db.execute(query, [
            name,
            email,
            hashedPassword,
            phone,
            user_type,
            auth_provider,
            email_verified,
            phone_verified,
            two_fa_enabled,
            created_at,
            refreshToken,
            tokenExpiry,
        ]);

        const userId = result.insertId;

        // Generate access token
        const accessToken = jwt.sign(
            { id: userId, email, user_type },
            JWT_SECRET,
            { expiresIn: ACCESS_TOKEN_EXPIRY }
        );

        res.status(201).json({
            message: 'User registered successfully',
            accessToken,
            refreshToken,
            user: { id: userId, name, email, phone, user_type, created_at },
        });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Database error', details: err.message });
    }
});


// Login: Include 'active' in the JWT token
router.post('/login', async (req, res) => {
    const { email, password } = req.body;
    if (!email || !password) return res.status(400).json({ error: 'Email and password are required' });

    try {
        const [rows] = await db.execute('SELECT * FROM users WHERE email = ?', [email]);
        if (rows.length === 0) return res.status(401).json({ error: 'No User Found' });

        const user = rows[0];

        if (user.locked_until && new Date(user.locked_until) > new Date()) {
            return res.status(403).json({ error: 'Account is locked. Try again later.' });
        }

        const isValidPassword = await bcrypt.compare(password, user.password);
        if (!isValidPassword) {
            const attempts = user.login_attempts + 1;
            const lockDuration = 15 * 60 * 1000;
            const lockedUntil = attempts >= 5 ? new Date(Date.now() + lockDuration) : null;

            await db.execute('UPDATE users SET login_attempts = ?, locked_until = ? WHERE id = ?', [
                attempts,
                lockedUntil,
                user.id,
            ]);

            return res.status(401).json({ error: 'Invalid credentials' });
        }

        await db.execute('UPDATE users SET login_attempts = 0, last_login = NOW() WHERE id = ?', [user.id]);

        const accessToken = jwt.sign(
            { id: user.id, email: user.email, user_type: user.user_type, active: user.active },
            JWT_SECRET,
            { expiresIn: ACCESS_TOKEN_EXPIRY }
        );
        const refreshToken = jwt.sign(
            { id: user.id, email: user.email, user_type: user.user_type, active: user.active },
            REFRESH_TOKEN_SECRET,
            { expiresIn: REFRESH_TOKEN_EXPIRY }
        );

        // Store refresh token in the database
        await db.execute('UPDATE users SET refresh_token = ? WHERE id = ?', [refreshToken, user.id]);

        res.json({ accessToken, refreshToken, user_id:user.id });
    } catch (err) {
        res.status(500).json({ error: 'Database error', details: err.message });
    }
});

// Endpoint to edit user details
router.patch('/edit-user/:id', authenticateToken, async (req, res) => {
    const { id } = req.params;
    const { name, email, phone, active } = req.body;
    const userId = req.user.id;
    const userType = req.user.user_type;

    try {
        const [rows] = await db.execute('SELECT * FROM users WHERE id = ?', [id]);
        if (rows.length === 0) return res.status(404).json({ error: 'User not found' });

        const user = rows[0];
        if (user.id !== userId && userType !== 'admin' && userType !== 'superadmin') {
            return res.status(403).json({ error: 'You are not authorized to edit this user' });
        }

        const fieldsToUpdate = [];
        const values = [];

        if (name) fieldsToUpdate.push('name = ?'), values.push(name);
        if (email) fieldsToUpdate.push('email = ?'), values.push(email);
        if (phone) fieldsToUpdate.push('phone = ?'), values.push(phone);
        if (active !== undefined) fieldsToUpdate.push('active = ?'), values.push(active);

        if (fieldsToUpdate.length === 0) {
            return res.status(400).json({ error: 'No fields to update' });
        }

        const query = `UPDATE users SET ${fieldsToUpdate.join(', ')} WHERE id = ?`;
        values.push(id);

        const [result] = await db.execute(query, values);
        if (result.affectedRows === 0) {
            return res.status(404).json({ error: 'User not found or not updated' });
        }

        res.status(200).json({ message: 'User updated successfully' });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Server error', details: err.message });
    }
});

// Activate or deactivate a user
router.post("/toggle-user-status", authenticateToken, async (req, res) => {
    const { user_id, active } = req.body; // Get user ID and new active status
  
    if (typeof user_id !== "number" || typeof active !== "number") {
      return res.status(400).json({ error: "Invalid input data" });
    }
  
    try {
      // Update user's active status
      const [result] = await db.execute(
        "UPDATE users SET active = ? WHERE id = ?",
        [active, user_id]
      );
  
      if (result.affectedRows === 0) {
        return res.status(404).json({ error: "User not found" });
      }
  
      res.status(200).json({ message: "User status updated successfully" });
    } catch (error) {
      console.error("Error updating user status:", error);
      res.status(500).json({ error: "Server error" });
    }
  });
  


// View profile
router.get('/profile', authenticateToken, async (req, res) => {
    try {
        const [rows] = await db.execute('SELECT id, name, email, phone, user_type, active, created_at, last_login FROM users WHERE id = ?', [req.user.id]);
        if (rows.length === 0) return res.status(404).json({ error: 'User not found' });

        res.json(rows[0]);
    } catch (err) {
        res.status(500).json({ error: 'Database error', details: err.message });
    }
});

// Request password reset
router.post('/reset-password', async (req, res) => {
    const { email } = req.body;
    if (!email) return res.status(400).json({ error: 'Email is required' });

    try {
        const [rows] = await db.execute('SELECT id FROM users WHERE email = ?', [email]);
        if (rows.length === 0) return res.status(404).json({ error: 'Email not found' });

        const token = uuidv4();
        const expiry = new Date(Date.now() + 3600000); // 1 hour from now
        await db.execute('INSERT INTO password_resets (user_id, token, expires_at) VALUES (?, ?, ?)', [rows[0].id, token, expiry]);

        // Send token to user (e.g., via email)
        res.json({ message: 'Password reset link generated', token });
    } catch (err) {
        res.status(500).json({ error: 'Database error', details: err.message });
    }
});

// Reset password using token
router.post('/reset-password/:token', async (req, res) => {
    const { token } = req.params;
    const { newPassword } = req.body;
    if (!newPassword) return res.status(400).json({ error: 'New password is required' });

    try {
        const [rows] = await db.execute('SELECT user_id FROM password_resets WHERE token = ? AND expires_at > NOW()', [token]);
        if (rows.length === 0) return res.status(400).json({ error: 'Invalid or expired token' });

        const hashedPassword = await bcrypt.hash(newPassword, 10);
        await db.execute('UPDATE users SET password = ? WHERE id = ?', [hashedPassword, rows[0].user_id]);
        await db.execute('DELETE FROM password_resets WHERE token = ?', [token]);

        res.json({ message: 'Password reset successfully' });
    } catch (err) {
        res.status(500).json({ error: 'Database error', details: err.message });
    }
});

// Validate tokens
router.post('/token', async (req, res) => {
    const { token } = req.body;
    if (!token) return res.status(400).json({ error: 'Refresh token is required' });

    try {
        const user = jwt.verify(token, REFRESH_TOKEN_SECRET);

        const [rows] = await db.execute('SELECT * FROM users WHERE id = ? AND refresh_token = ?', [user.id, token]);
        if (rows.length === 0) return res.status(403).json({ error: 'Invalid refresh token' });

        const accessToken = jwt.sign({ id: user.id, email: user.email, user_type: user.user_type }, JWT_SECRET, {
            expiresIn: ACCESS_TOKEN_EXPIRY,
        });

        res.json({ accessToken });
    } catch (err) {
        res.status(403).json({ error: 'Invalid token', details: err.message });
    }
});

// Logout endpoint
// Delete the access token on the browser as well - manually
router.post('/logout', authenticateToken, async (req, res) => {
    const { token } = req.body;
    const user_id = req.user.id;

    // console.log(token);
    // console.log(user_id);

    if (!token) return res.status(400).json({ error: 'Refresh token is required' });

    try {
        // Decode the refresh token to get the user details (optional for logging purposes)
        const user = jwt.verify(token, REFRESH_TOKEN_SECRET);

        // Invalidate the refresh token in the database
        const [result] = await db.execute('UPDATE users SET refresh_token = NULL WHERE id = ? AND refresh_token = ?', [
            user_id,
            token,
        ]);

        if (result.affectedRows === 0) {
            return res.status(400).json({ error: 'Invalid refresh token' });
        }

        // Successfully logged out
        res.status(200).json({ message: 'Logged out successfully' });
    } catch (err) {
        // Handle token errors
        res.status(403).json({ error: 'Invalid or expired token', details: err.message });
    }
});

module.exports = router;
