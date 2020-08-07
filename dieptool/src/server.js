'use strict';

const DiepSocket = require('diepsocket');
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
        this.ips = new Set();
        this.blacklist = new Set();
        //this.createSbx();

        wss.on('connection', (ws, req) => {
            const ip = req.headers['x-forwarded-for']
                ? req.headers['x-forwarded-for'].split(/\s*,\s*/)[0]
                : req.connection.remoteAddress;
            if (this.ips.has(ip) || this.blacklist.has(ip)) {
                ws.close();
                return;
            }
            this.ips.add(ip);
            ws.on('close', () => this.ips.delete(ip));

            const client = new Client(ws, ip);
            client.once('initial', (content) => this.oninitial(client, content));
            client.on('error', (err) => {});
        });

        this.connectionLog = [];
        setInterval(() => {
            this.connectionLog.push({ x: Date.now(), y: this.users.size });
            // reset connectionLog at midnight
            if (new Date().getHours() === 0 && new Date().getMinutes() <= 5)
                this.connectionLog = [];
        }, 1000 * 60 * 5);
    }

    async createSbx() {
        const link = await DiepSocket.findServerSync('sandbox');
        const bot = new DiepSocket(link);
        let int;
        bot.on('error', () => {});
        bot.on('accept', () => {
            this.public_sbx = bot.link;
            this.users.forEach((user) => user.emit('public_sbx', this.public_sbx));
            int = setInterval(() => {
                bot.spawn('DT');
                bot.move();
            }, 4 * 60 * 1000);
            setTimeout(() => bot.close(), 60 * 60 * 1000);
        });
        bot.on('close', () => {
            clearInterval(int);
            this.createSbx();
        });
    }

    oninitial(client, content) {
        switch (content.authToken) {
            case 'user':
                this.userManager(new User(client, content.version, content.authToken));
                break;
            case process.env.ADMINAUTHTOKEN:
                this.adminManager(client);
                break;
            case process.env.MODERATORAUTHTOKEN:
                this.moderatorManager(client);
                break;
            default:
                client.close();
                break;
        }
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
        user.emit('public_sbx', this.public_sbx);
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
