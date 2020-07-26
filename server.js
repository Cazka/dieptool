'use strict';

require('dotenv').config();
const express = require('express');
const session = require('express-session');
const bodyParser = require('body-parser');
const rateLimit = require('express-rate-limit');

const app = express();
const server = require('http').createServer(app);

const diepServer = require('./dieptool/server.js')(server); // run Diep Server

server.listen(3000, () => {
    console.log('listening on port 3000');
});

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

app.get('/', (req, res) => {
    if (req.session.loggedin){
        if(req.session.username === 'admin') res.sendFile(__dirname + '/views/dashboard/admin.html');
        if(req.session.username === 'moderator') res.sendFile(__dirname + '/views/dashboard/moderator.html');
    }
    else res.sendFile(__dirname + '/views/');
});
app.get('/logout', (req, res) => {
    if (req.session.loggedin) req.session.loggedin = false;
    res.redirect('/');
});
app.get('/status', (req, res) => {
    res.send('coming soon');
});
app.post('/login', (req, res) => {
    const username = req.body.username + '';
    const password = req.body.password + '';
    if (username === 'admin' && password === process.env.ADMIN_PASSWORD) {
        req.session.loggedin = true;
        req.session.username = username;
    }
    else if(username === 'moderator' && password === process.env.MODERATOR_PASSWORD){
        req.session.loggedin = true;
        req.session.username = username;
    }
    res.redirect('/');
});
