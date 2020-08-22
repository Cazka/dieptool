'use strict';

const fetch = require('node-fetch');
const Client = require('./client.js');
const User = require('./user/user.js');

const DiepToolManager = (server) => {
    const WebSocket = require('ws');
    const wss = new WebSocket.Server({ server });
    return new DiepToolServer(wss);
};

class DiepToolServer {
    constructor(wss) {
        this.users = new Set();

        wss.on('connection', (ws, req) => {
            const ip = req.headers['x-forwarded-for']
                ? req.headers['x-forwarded-for'].split(/\s*,\s*/)[0]
                : req.connection.remoteAddress;

            const client = new Client(ws, ip);
            client.on('error', (err) => {});
            client.once('initial', (content) => this.oninitial(client, content));
        });

        this.connectionLog = [];
        setInterval(() => {
            this.connectionLog.push({ x: Date.now(), y: this.users.size });
            // reset connectionLog at midnight
            if (new Date().getHours() === 0 && new Date().getMinutes() <= 5)
                this.connectionLog = [];
        }, 1000 * 60 * 5);
    }

    async oninitial(client, content) {
        if (content.authToken.startsWith('DT_')) {
        } else {
            const data = {
                client_id: process.env.DISCORD_CLIENT_ID,
                client_secret: process.env.DISCORD_CLIENT_SECRET,
                grant_type: 'authorization_code',
                redirect_uri: 'https://diep.io',
                code: content.authToken,
                scope: 'identify',
            };
            const result = await fetch('https://discordapp.com/api/oauth2/token', {
                method: 'POST',
                body: new URLSearchParams(data),
                headers: {
                    'Content-Type': 'application/x-www-form-urlencoded',
                },
            }).then((res) => res.json());
            if (result.error) {
                client.send('deny');
                client.close(4000, result.error_description);
                return;
            }
            console.log(result);
            const user_info = await fetch('https://discordapp.com/api/users/@me', {
                        headers: {
                            authorization: `${result.token_type} ${result.access_token}`,
                        },
                    }).then(res => res.json());
            console.log(user_info);
        }
        this.userManager(new User(client, content.version, content.authToken));
    }

    userManager(user) {
        this.users.add(user);
        console.log(
            user.socket.ip,
            'User connected, waiting for User Information:',
            this.users.size
        );
        user.on('close', (code, reason) => {
            this.users.delete(user);
            console.log(user.socket.ip, 'User disconnected reason:', code, reason);
        });
        user.on('ban', (reason) => {
            user.socket.close(4000, `User got banned: ${reason}`);
            this.blacklist.add(user.socket.ip);
        });
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
        admin.on('command', (id, data) => {
            switch (id) {
                case PACKET_ADMIN_COMMANDS.NOTIFICATION:
                    this.users.forEach((user) => {
                        user.sendNotification(data.message, data.hexcolor, data.time, data.unique);
                    });
                    break;
                case PACKET_ADMIN_COMMANDS.BAN: {
                    const users = Array.from(this.users);
                    console.log('BANNED', data.ip);
                    for (let i = 0; i < users.length; i++) {
                        if (users[i].socket.ip === data.ip) {
                            users[i].ban('you have been banned');
                            break;
                        }
                    }
                    this.blacklist.add(data.ip);
                    break;
                }
            }
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
}

module.exports = DiepToolManager;
