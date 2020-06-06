'use strict';

require('dotenv').config();
const express = require('express');
const session = require('express-session');
const bodyParser = require('body-parser');
const rateLimit = require('express-rate-limit');

const app = express();
const server = require('http').createServer(app);

const diepServer = require('./DiepTool/server.js')(server); // run Diep Server

server.listen(process.env.PORT || 3000);

app.use(express.static('public'));
app.use(
    '/login',
    rateLimit({
        windowMs: 1 * 60 * 1000, // 1 hour
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
    if (req.session.loggedin) res.sendFile(__dirname + '/dashboard/');
    else res.sendFile(__dirname + '/views/');
});
app.post('/login', (req, res) => {
    const username = req.body.username + '';
    const password = req.body.password + '';
    if (username === process.env.USER && password === process.env.PASSWORD) {
        req.session.loggedin = true;
        req.session.username = username;
    }
    res.redirect('/');
});
app.get('/logout', (req, res) => {
    if (req.session.loggedin) req.session.loggedin = false;
    res.redirect('/');
});
