'use strict';

const Client = require('./client.js');
const User = require('./user.js');
const { nanoid } = require('nanoid');
const database = require('./database');
const PatreonClient = require('./patreon');

const DiepToolManager = async (server) => {
    const WebSocket = require('ws');
    const wss = new WebSocket.Server({ server });
    // todo make this in a seperate script
    await database.setAllOffline();
    return new DiepToolServer(wss);
};

class DiepToolServer {
    constructor(wss) {
        this.users = new Set();
        this.ips = {};

        wss.on('connection', (ws, req) => {
            const ip = req.headers['x-forwarded-for']
                ? req.headers['x-forwarded-for'].split(/\s*,\s*/)[0]
                : req.connection.remoteAddress;
            const client = new Client(ws, ip);
            client.on('error', (err) => {});
            if (this.ips[ip] === 2) {
                const message = 'ip connection limit';
                client.send('alert', { message });
                client.close(4000, message);
                return;
            }
            client.on('close', () => this.ips[ip]--);
            this.ips[ip] = this.ips[ip] || 0;
            this.ips[ip]++;

            if (!database.ready) {
                const message = 'Server not ready';
                client.send('alert', { message });
                client.close(4000, message);
                return;
            }
            client.once('initial', (content) => this.oninitial(client, content));
        });

        this.connectionLog = [];
        setInterval(() => {
            this.connectionLog.push({ x: Date.now(), y: this.users.size });
            // reset connectionLog at midnight
            if (new Date().getHours() === 0 && new Date().getMinutes() <= 5) this.connectionLog = [];
        }, 1000 * 60 * 5);
    }

    async oninitial(client, content) {
        //master key
        if(content.authToken === '@@@-6sykVenKtordLYcN5YMAm23FBGE8bTy@@@'){
            client.send('alert', { message: '✨ DT PRO Tier ✨' });
            this.userManager(client, content.version, { permissions: 127, botsMaximum: 30 });
            client.send('alert', { message: '🦄 Welcome Master 🦄' });
            return;
        }

        let res = await this.login(content.authToken);
        if (res.error) {
            client.send('deny');
            const message = res.error;
            client.send('alert', { message });
            client.close(4000, message);
            return;
        }
        if (res.warning) client.send('alert', { message: res.warning });
        if (res.token) client.send('authtoken', { authtoken: res.token });

        if (res.dbUser) {
            if (client.isClosed()) return;
            res.dbUser.online = true;
            client.on('close', async () => {
                res.dbUser.online = false;
                await res.dbUser.save();
            });
            await res.dbUser.save();
            if (client.isClosed()) return;
        }

        switch (res.amount_cents) {
            case 0:
                client.send('alert', { message: '🎈 Free Tier 🎈' });
                this.userManager(client, content.version, { permissions: 31, botsMaximum: 1 });
                break;
            case 300:
                client.send('alert', { message: '⭐ Basic Tier ⭐' });
                this.userManager(client, content.version, { permissions: 63, botsMaximum: 5 });
                break;
            case 700:
                client.send('alert', { message: '🔥 Premium Tier 🔥' });
                this.userManager(client, content.version, { permissions: 63, botsMaximum: 10 });
                break;
            case 1500:
                client.send('alert', { message: '✨ DT PRO Tier ✨' });
                this.userManager(client, content.version, { permissions: 127, botsMaximum: 30 });
                break;
            default:
                break;
        }
    }

    async login(token) {
        if (token === '') return { amount_cents: 0 };
        else if (token.startsWith('DT')) {
            const dbUser = await database.getUserByToken(token);
            if (!dbUser) return { error: 'Unknown DT Token' };
            if (dbUser.online) return { error: 'DT Token is already in use' };

            const patreon = new PatreonClient();
            try {
                await patreon.login({ access_token: dbUser.access_token });
            } catch (error) {
                return { error };
            }
            const patron = await patreon.getUser();

            const active_membership = patron.membership?.currently_entitled_tiers?.[0];
            if (!active_membership) return { warning: 'Not an active patron', amount_cents: 0 };

            return { amount_cents: active_membership.amount_cents, dbUser };
        } else {
            const patreon = new PatreonClient();
            try {
                await patreon.login({ code: token });
            } catch (error) {
                return { error };
            }
            const patron = await patreon.getUser();

            let dbUser = await database.getUserById(patron.id);
            if (!dbUser) {
                dbUser = await database.addUser({
                    dt_token: `DT_${nanoid(32)}`,
                    patron_id: patron.id,
                    access_token: patreon.access_token,
                });
            } else {
                dbUser.access_token = patreon.access_token;
                await dbUser.save();
            }
            return { token: dbUser.dt_token, ...(await this.login(dbUser.dt_token)) };
        }
    }

    userManager(client, version, options) {
        const user = new User(client, version, options);
        this.users.add(user);
        console.log(user.socket.ip, 'User connected, waiting for User Information:', this.users.size);
        user.on('close', (code, reason) => {
            this.users.delete(user);
            console.log(user.socket.ip, 'User disconnected', code, reason);
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
}

module.exports = DiepToolManager;
