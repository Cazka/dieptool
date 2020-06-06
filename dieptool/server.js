const Client = require('./client.js');
const Admin = require('./admin.js');
const User = require('./user.js');
const Buddy = require('./buddy.js');

const DiepToolManager = (server) => {
    const WebSocket = require('ws');
    const wss = new WebSocket.Server({ server });
    new DiepToolManager(wss);
};

class DiepToolServer {
    constructor(wss) {
        this.users = new Set();
        this.buddies = new Set();
        this.ips = new Set();

        wss.on('connection', (ws, req) => {
            const ip = req.headers['x-forwarded-for'].split(/\s*,\s*/)[0];
            const client = new Client(ws);

            client.on('close', () => {});
            client.on('error', (err) => {});
        });

        this.connectionLog = [];
        setInterval(
            () => this.connectionLog.push({ x: Date.now(), y: this.users.size }),
            1000 * 60 * 5
        );
    }

    onLoginHandler(client, authKey) {
        switch (authKey) {
            case process.env.ADMINAUTHKEY:
                this.adminManager(new Admin(client));
                break;
            case process.env.BUDDYAUTHKEY:
                this.buddyManager(new Buddy(client));
                break;
            case 'user':
                this.userManager(new User(client, authKey, this.buddies));
                break;
        }
    }

    adminManager(admin) {
        console.log('Admin connected');

        admin.on('req player count', () => {
            admin.emit('player count', this.users.size);
            admin.emit(
                'player table',
                Array.from(this.users).map((user) => user.toDataObject())
            );
        });
        admin.emit('player chart', this.connectionLog);
    }

    userManager(user) {
        this.users.add(user);
        console.log(user.ip, 'User connected, waiting for User Information:', this.users.size);

        user.on('close', (reason) => {
            console.log(user.ip, 'User disconnected reason: ', reason);
            this.users.delete(user);
        });
    }

    buddyManager(buddy) {
        this.buddies.add(buddy);
        console.log('Buddy connected:', this.buddies.size);

        buddy.on('close', (reason) => {
            this.buddies.delete(buddy);
            console.error('buddy closed: ', this.buddies.size, ' reason: ', reason);
        });
    }
}

module.exports = DiepToolManager;
