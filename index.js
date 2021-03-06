'use strict';

require('dotenv').config();
const express = require('express');
const session = require('express-session');
const bodyParser = require('body-parser');
const rateLimit = require('express-rate-limit');

const app = express();
const server = require('http').createServer(app);

// start dieptool
const DiepTool = require('./dieptool')(server);

// Middleware
app.use(express.static('public'));
app.use(
    '/login',
    rateLimit({
        windowMs: 1 * 60 * 1000, // 1 minute
        max: 5,
    })
);
app.use(
    session({
        secret: process.env.SESSION_SECRET,
        resave: true,
        saveUninitialized: true,
        maxAge: 30 * 60 * 1000, // 30 minutes
    })
);
app.use(
    bodyParser.urlencoded({
        extended: true,
    })
);
app.use(bodyParser.json());

// Routes
app.get('/dieptool.user.js', (req, res) => {
    res.download(__dirname + '/dieptool/userscript/dieptool.user.js');
})
app.get('/dieptool_dev.user.js', (req, res) => {
    res.download(__dirname + '/dieptool/userscript/dieptool_dev.user.js');
})
app.get('/', (req, res) => {
    if (req.session.loggedIn){
        if(req.session.username === 'admin') res.sendFile(__dirname + '/views/dashboard/admin.html');
    }
    else res.sendFile(__dirname + '/views/');
});
app.get('/logout', (req, res) => {
    if (req.session.loggedIn) req.session.loggedIn = false;
    res.redirect('/');
});
app.post('/login', (req, res) => {
    const username = req.body.username + '';
    const password = req.body.password + '';
    if (username === 'admin' && password === process.env.ADMIN_PASSWORD) {
        req.session.loggedIn = true;
        req.session.username = username;
    }
    res.redirect('/');
});

server.listen(3000, () => {
    console.log('listening on port 3000');
});