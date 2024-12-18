const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');

// Route Imports
const userRoutes = require('./userRoutes');
const userProfiles = require('./userProfiles/allRoutes');
const userImages = require('./userImages/allRoutes');
const plans = require('./plans/allRoutes');
const subscriptions = require('./subscriptions/allRoutes');
const messages = require('./messages/allRoutes');

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

// Health Check Endpoint
app.get('/', (req, res) => {
    res.send('API is running...');
});

// Start the server
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});
