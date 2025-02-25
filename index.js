const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const path = require('path');

// Call DB
const db = require('./dbPromise');


// Route Imports
const userRoutes = require('./userRoutes');
const userProfiles = require('./userProfiles/allRoutes');
const userImages = require('./userImages/allRoutes');
const plans = require('./plans/allRoutes');
const subscriptions = require('./subscriptions/allRoutes');
const messages = require('./messages/allRoutes');
const matching = require('./matching/allRoutes');
const mpesaRequests = require('./mpesaRequests/allRoutes');
const mpesaPayments = require('./mpesaPayments/allRoutes');
const imageUploadRoutes = require('./uploadphoto/allRoutes');
const NewImageUploadRoutes = require('./uploadphoto/uploadRoute');
const superlikesRoutes = require('./superlikes/allRoutes');

const app = express();

// CORS configuration
const corsOptions = {
    origin: '*', // Allow all origins (or specify allowed origins as an array)
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'], // Allowed methods
    allowedHeaders: ['Content-Type', 'Authorization'], // Allowed headers
};

// Use CORS middleware
app.use(cors(corsOptions));

// Other Middleware
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

// Global Error Handling
app.use((err, req, res, next) => {
    console.error(err.stack);
    res.status(500).send({ error: 'Something went wrong!' });
});

// User Routes
app.use('/api/users', userRoutes);
app.use('/api/user-profiles', userProfiles);
app.use('/api/user-images', userImages);
app.use('/api/plans', plans);
app.use('/api/subscriptions', subscriptions);
app.use('/api/messages', messages);
app.use('/api/matching', matching);
app.use('/api/mpesa-requests', mpesaRequests);
app.use('/api/mpesa-payments', mpesaPayments);
app.use('/api/image-upload', imageUploadRoutes);
app.use('/api/new-image-upload', NewImageUploadRoutes);
app.use('/api/superlikes', superlikesRoutes);

// Health Check Endpoint
app.get('/', async (req, res) => {
    try {
        const [results] = await db.query('SELECT * FROM messages WHERE (sender_id = 4 OR receiver_id = 4) ORDER BY timestamp DESC LIMIT 10 OFFSET 0');
        console.log(results);
        res.json(results); // Send results as JSON
    } catch (err) {
        console.error('Database query error:', err);
        res.status(500).send('Internal Server Error');
    }
});

app.get('/upload-one', (req, res, next) => {
    res.sendFile(path.join(__dirname, 'test.html'), (err) => {
        if (err) {
            next(err); // Pass errors to the global error handler
        }
    });
});

app.get('/upload-many', (req, res, next) => {
    res.sendFile(path.join(__dirname, 'test2.html'), (err) => {
        if (err) {
            next(err); // Pass errors to the global error handler
        }
    });
});

// Start the server
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});
