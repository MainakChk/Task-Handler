const express = require('express');
const cors = require('cors');
const path = require('path');

const taskRoutes = require('./routes/taskRoutes');
const authRoutes = require('./routes/authRoutes');
const adminRoutes = require('./routes/adminRoutes');

const app = express();
const PORT = process.env.PORT || 5000;

app.use(cors());
app.use(express.json());

// Serve frontend static files
app.use(express.static(path.join(__dirname, '../Frontend')));

// Mount API routes
app.use('/', authRoutes);
app.use('/', taskRoutes);
app.use('/api', adminRoutes);

// Catch-all route for frontend SPA
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, '../Frontend/index.html'));
});

app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
