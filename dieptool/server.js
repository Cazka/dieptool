'use strict';

const Client = require('./client.js');
const User = require('./user.js');

const DiepToolManager = (server) => {
    const WebSocket = require('ws');
    const wss = new WebSocket.Server({ server });
    new DiepToolServer(wss);
};

class DiepToolServer {
    constructor(wss) {
        this.users = new Set();
        this.buddies = new Set();
        this.ips = new Set();

        wss.on('connection', (ws, req) => {
            const ip = req.headers['x-forwarded-for']
                ? req.headers['x-forwarded-for'].split(/\s*,\s*/)[0]
                : req.connection.remoteAddress;
            if (this.ips.has(ip)) {
                ws.close();
                return;
            }
            this.ips.add(ip);
            ws.on('close', () => this.ips.delete(ip));
            const client = new Client(ws, ip);
            client.once('login', (authToken) => this.onLoginHandler(client, authToken));
            client.on('error', (err) => {});
        });

        this.connectionLog = [];
        setInterval(
            () => this.connectionLog.push({ x: Date.now(), y: this.users.size }),
            1000 * 60 * 5
        );
        // reset connectionLog every 24 hours
        setInterval(() => (this.connectionLog = []), 1000 * 60 * 60 * 24);
    }

    onLoginHandler(client, authToken) {
        switch (authToken) {
            case process.env.ADMINAUTHTOKEN:
                this.adminManager(client);
                break;
            case 'user':
                this.userManager(new User(client, authToken, this.buddies));
                break;
        }
    }

    adminManager(admin) {
        console.log('Admin connected');

        setInterval(() => {
            admin.send(40, [this.users.size]);
            admin.send(41, [Array.from(this.users).map((user) => user.toDataObject())]);
        }, 100);
        admin.send(42, [this.connectionLog]);
    }

    userManager(user) {
        this.users.add(user);
        console.log(
            user.socket.ip,
            'User connected, waiting for User Information:',
            this.users.size
        );

        user.on('close', (reason) => {
            console.log(user.socket.ip, 'User disconnected reason: ', reason);
            this.users.delete(user);
        });
    }
}

module.exports = DiepToolManager;
