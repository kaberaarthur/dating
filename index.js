const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const path = require('path');


// Route Imports
const userRoutes = require('./userRoutes');
const userProfiles = require('./userProfiles/allRoutes');
const userImages = require('./userImages/allRoutes');
const plans = require('./plans/allRoutes');
const subscriptions = require('./subscriptions/allRoutes');
const messages = require('./messages/allRoutes');
const matching = require('./matching/allRoutes');
const mpesaRequests = require('./mpesaRequests/allRoutes');
const imageUploadRoutes = require('./uploadphoto/allRoutes');

const app = express();

// Middleware
app.use(cors());
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
app.use('/api/image-upload', imageUploadRoutes);

// Health Check Endpoint
app.get('/', (req, res) => {
    res.send('API is running...');
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
