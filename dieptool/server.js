'use strict';

const Client = require('./client.js');
const User = require('./user.js');
const DiepSocket = require('diepsocket');

const DiepToolManager = (server) => {
    const WebSocket = require('ws');
    const wss = new WebSocket.Server({ server });
    new DiepToolServer(wss);
};

class DiepToolServer {
    constructor(wss) {
        this.users = new Set();
        this.ips = new Set();
        this.sbx;
        this.createSbx();

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
        setInterval(() => {
            this.connectionLog.push({ x: Date.now(), y: this.users.size });
            // reset connectionLog at midnight
            if (new Date().getHours() === 0) this.connectionLog = [];
        }, 1000 * 60 * 5);
    }

    createSbx() {
        DiepSocket.findServer('sandbox', 'amsterdam', (link) => {
            let sbxBot = new DiepSocket(link);
            let int;
            sbxBot.on('accept', () => {
                int = setInterval(() => {
                    sbxBot.spawn('DT');
                    sbxBot.move();
                }, 1000 * 60);
                this.sbx = sbxBot.link;
                this.users.forEach((user) => user.emit('public_sandbox', this.sbx));
            });
            sbxBot.on('close', () => {
                clearInterval(int);
                this.createSbx();
            });
        });
    }

    onLoginHandler(client, authToken) {
        switch (authToken) {
            case process.env.ADMINAUTHTOKEN:
                this.adminManager(client);
                break;
            case process.env.MODERATORAUTHTOKEN:
                this.moderatorManager(client);
                break;
            case 'user':
                this.userManager(new User(client, authToken));
                break;
        }
    }

    adminManager(admin) {
        console.log('Admin connected');

        admin.send(42, [this.connectionLog]);
        const int = setInterval(() => {
            admin.send(40, [this.users.size]);
            admin.send(41, [Array.from(this.users).map((user) => user.toDataObject())]);
        }, 100);
        admin.on('close', () => {
            clearInterval(int);
        });
    }

    moderatorManager(moderator) {
        console.log('Moderator connected');

        moderator.send(42, [this.connectionLog]);
        const int = setInterval(() => {
            moderator.send(40, [this.users.size]);
            moderator.send(41, [
                Array.from(this.users).map((user) => {
                    user = user.toDataObject();
                    return {
                        name: user.name,
                        link: user.link,
                        gamemode: user.gamemode,
                        time: user.time,
                        latency: user.latency,
                    };
                }),
            ]);
        }, 100);
        moderator.on('close', () => {
            clearInterval(int);
        });
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
