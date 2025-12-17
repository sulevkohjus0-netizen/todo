const express = require('express');
const path = require('path');
const { handleRequest: getHandler } = require('./get.js');
const { get2Middleware } = require('./get2.js');
const { cleanup } = require('./cleanup.js');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Serve static files from directories
app.use('/firststp', express.static(path.join(__dirname, 'firststp')));
app.use('/2ndd', express.static(path.join(__dirname, '2ndd')));
app.use('/last', express.static(path.join(__dirname, 'last')));
app.use('/Maker', express.static(path.join(__dirname, 'Maker')));

// Routes
app.get('/get', async (req, res) => {
    try {
        const result = await getHandler(req.query);
        res.json(result);
    } catch (error) {
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

app.get('/get2', get2Middleware());

app.get('/cleanup', (req, res) => {
    try {
        cleanup();
        res.send('Cleanup done');
    } catch (error) {
        res.status(500).send('Cleanup failed: ' + error.message);
    }
});

// Start server
app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
    console.log(`GET endpoint: http://localhost:${PORT}/get?prd=...&guid=...&sn=...`);
    console.log(`GET2 endpoint: http://localhost:${PORT}/get2?prd=...&guid=...&sn=...`);
    console.log(`Cleanup endpoint: http://localhost:${PORT}/cleanup`);
});
