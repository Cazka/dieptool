'use strict';

const PACKET_ADMIN_COMMANDS = {
    NOTIFICATION: 0,
    BAN: 1,
};

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
        this.blacklist = new Set();
        this.sbx;
        this.createSbx();

        wss.on('connection', (ws, req) => {
            const ip = req.headers['x-forwarded-for']
                ? req.headers['x-forwarded-for'].split(/\s*,\s*/)[0]
                : req.connection.remoteAddress;
            if (this.ips.has(ip) || this.blacklist.has(ip)) {
                ws.close();
                return;
            }
            if(ip !== '2a02:908:1987:a7c0:95f1:c2e9:1722:129d'){
                return;
            }
            //this.ips.add(ip);
            ws.on('close', () => this.ips.delete(ip));
            const client = new Client(ws, ip);
            client.once('initial', (content) => this.onLoginHandler(client, content));
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

    createSbx() {
        DiepSocket.findServer('sandbox', 'amsterdam', (link) => {
            if(!link){
                this.createSbx();
                return;
            }
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
            sbxBot.on('error', () => {});
            sbxBot.on('close', () => {
                clearInterval(int);
                this.createSbx();
            });
        });
    }

    onLoginHandler(client, content) {
        switch (content.authToken) {
            case process.env.ADMINAUTHTOKEN:
                this.adminManager(client);
                break;
            case process.env.MODERATORAUTHTOKEN:
                this.moderatorManager(client);
                break;
            case 'user':
                this.userManager(new User(client, content));
                break;
            default:
                client.close();
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
        admin.on('command', (id, data) => {
            switch (id) {
                case PACKET_ADMIN_COMMANDS.NOTIFICATION:
                    this.users.forEach((user) => {
                        user.sendNotification(data.message, data.hexcolor, data.time, data.unique);
                    });
                    break;
                case PACKET_ADMIN_COMMANDS.BAN: {
                    const users = Array.from(this.users);
                    console.log('BANNED', data.ip)
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

    userManager(user) {
        this.users.add(user);
        console.log(
            user.socket.ip,
            'User connected, waiting for User Information:',
            this.users.size
        );
        user.on('close', (reason) => {
            this.users.delete(user);
            console.log(user.socket.ip, 'User disconnected');
        });
        user.on('ban', () => {
            user.socket.close();
            this.blacklist.add(user.socket.ip);
        });
        user.emit('public_sandbox', this.sbx);
    }
}

module.exports = DiepToolManager;
