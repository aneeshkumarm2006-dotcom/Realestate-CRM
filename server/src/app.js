const express = require('express');
const cors = require('cors');
const passport = require('./config/passport');

const app = express();

// CORS — allow the frontend client
app.use(
  cors({
    origin: process.env.CLIENT_URL,
    credentials: true,
  })
);

// Body parsing
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Passport (stateless — no session middleware)
app.use(passport.initialize());

// Health check
app.get('/', (req, res) => {
  res.json({ status: 'ok', service: 'macan-api' });
});

// Routes
app.use('/auth', require('./routes/auth'));
// Org/workspace router mounted under both prefixes (F3 surface rename). The
// MongoDB collection stays `organisations`; the API exposes "Workspace".
const orgsRouter = require('./routes/orgs');
app.use('/api/orgs', orgsRouter);
app.use('/api/workspaces', orgsRouter);
app.use('/api/boards', require('./routes/boards'));
app.use('/api/dashboard', require('./routes/dashboard'));
app.use('/api', require('./routes/groups'));
app.use('/api', require('./routes/automations'));
app.use('/api/tasks', require('./routes/tasks'));
app.use('/api', require('./routes/comments'));
app.use('/api', require('./routes/updates'));
app.use('/api', require('./routes/activity'));
app.use('/api/notifications', require('./routes/notifications'));
app.use('/api/analytics', require('./routes/analytics'));
app.use('/api/productivity', require('./routes/productivity'));
app.use('/api/profile', require('./routes/profile'));
app.use('/api/search', require('./routes/search'));
app.use('/api/proxy', require('./routes/proxy'));

module.exports = app;
