'use strict';

const EventEmitter = require('events');
const DiepSocket = require('diepsocket');
const DiepParser = DiepSocket.Parser;
const DiepBuilder = DiepSocket.Builder;
const fs = require('fs');
const ipv6pool = fs.readFileSync(__dirname +'/ipv6').toString('utf-8').split('\n');

const UPDATE = {
    SERVER_PARTY: 0,
    NAME: 1,
    GAMEMODE: 2,
};
const COMMAND = {
    JOIN_BOTS: 0,
    MULTIBOX: 1,
    AFK: 2,
};

const color = {
    PINK: '#ff00ff',
    GREEN: '#00ff00',
    RED: '#ff0000',
    LIGHT_PINK: '#ffcf40',
};

class User extends EventEmitter {
    constructor(socket, {version, authToken}) {
        super();
        // Socket information
        this.socket = socket;
        this.latency = 0;

        // User information
        this.version = version;
        this.authToken = authToken;
        this.link;
        this.name;
        this.gamemode;

        // Status
        this.timeConnected = Date.now();
        this.status;
        this.statusTimeout;
        this.multibox = false;
        this.afk = false;

        // Flags
        this.welcomeMessageSend = false;
        this.rateLimited = false;
        this.rateLimitTime = 100;

        // Bots
        this.bots = new Set();
        this.botCounter = 0;
        this.botsjoining = false;
        this.botsMaximum = 5;
        this.botname = () => {
            if (!this.name) return 'DT';
            return this.name.startsWith('DT') ? this.name : `DT ${this.name}`;
        };

        // Gameplay
        this.upgradePath = {};
        this.tankPath = [];
        this.public_sandbox;
        super.on('public-sbx-link', (link) => (this.public_sandbox = link));

        // AFK
        this.slow = false;
        this.mouseX;
        this.mouseY;
        this.mouseXFixed;
        this.mouseYFixed;

        // Initialize
        this.socket.on('close', (reason) => {
            super.emit('close', reason);
        });

        if(version !== process.env.CLIENT_VERSION){
            this.sendNotification('Please update DiepTool!', color.RED, 60000, 'outdated');
            this.socket.close();
            return;
        }
        
        
        this.socket.send('accept');

        this.socket.on('diep_serverbound', (content) => this.ondiep_serverbound(content));
        this.socket.on('diep_clientbound', (content) => this.ondiep_clientbound(content));

        this.socket.on('latency', (latency) => (this.latency = latency));
        this.socket.on('update', (content) => this.onupdate(content));
        this.socket.on('command', (content) => this.oncommand(content));
        this.socket.on('pow_result', (content) => this.onpow_result(content));
    }
    /*
     *    E V E N T   H A N D L E R S
     */
    onupdate({ id, value }) {
        console.log(`${this.socket.ip} received update id: ${id} -> ${value}`);

        switch (id) {
            case UPDATE.SERVER_PARTY:
                const [server, party] = value?.split(':');
                try {
                    this.link = DiepSocket.getLink(server, party);
                } catch (error) {
                    console.log(
                        `${this.socket.ip} couldn't update link: ${server},${party}\n${error}`
                    );
                    this.socket.close();
                    return;
                }
                this.gamemode = undefined;
                this.bots.forEach((bot) => bot.close());
                break;
            case UPDATE.NAME:
                this.name = value;
                break;
            case UPDATE.GAMEMODE:
                if (this.gamemode) return;
                this.gamemode = value;
                if (
                    ![
                        'dom',
                        'ffa',
                        'tag',
                        'maze',
                        'teams',
                        '4teams',
                        'sandbox',
                        'survival',
                    ].includes(this.gamemode)
                )
                    this.socket.close();
                break;
            default:
                console.error(`UPDATE NOT RECOGNIZED: ${id} with data ${data}`);
                this.sendNotification('Please reinstall DiepTool', color.red, 0);
                this.socket.close();
                break;
        }
    }
    ondiep_serverbound({ buffer }) {
        switch (buffer[0]) {
            case 0x01:
                this.updatePosition(buffer);
                if (this.multibox && this.gamemode != 'sandbox') {
                    this.bots.forEach((bot) => bot.sendBinary(buffer));
                }
                if (this.afk) {
                    buffer = this.stayAFK(buffer);
                    this.socket.send('custom_diep_serverbound', buffer);
                }
                break;
            case 0x02:
                if (!this.welcomeMessage) {
                    this.welcomeMessage = true;
                    this.sendNotification(undefined, undefined, 1, 'adblock');
                    this.sendNotification('💎Made by Cazka💎', '#f5e042');
                    this.sendNotification('🔥 Thank you for using Diep.io Tool 🔥', color.GREEN);
                }

                this.upgradePath = {};
                this.tankPath = [];
                break;
            case 0x03:
                const category = buffer[1];
                const points = buffer[2];
                if (!this.upgradePath[category]) this.upgradePath[category] = 0;
                if (points === 1) this.upgradePath[category] += 2;
                else this.upgradePath[category] = points;
                break;
            case 0x04:
                this.tankPath.push(buffer[1]);
                break;
        }
    }
    ondiep_clientbound(data) {
        /*switch (data[0]) {
            case 0x02: {
                this.name = new TextDecoder().decode(data.slice(1, data.length - 1));
                break;
            }
            case 0x04: {
                this.gamemode = new TextDecoder()
                    .decode(data.slice(1, data.length))
                    .split('\u0000')[0];
                break;
            }
            case 0x06: {
                let party = '';
                for (let i = 1; i < data.byteLength; i++) {
                    let byte = data[i].toString(16).split('');
                    if (byte.length === 1) {
                        party += byte[0] + '0';
                    } else {
                        party += byte[1] + byte[0];
                    }
                }
                this.party = party;
                break;
            }
        }*/
    }
    oncommand({id, value}) {
        if (this.rateLimited) {
            this.sendNotification('slow down', color.RED);
            return;
        }
        this.rateLimited = true;
        setTimeout(() => (this.rateLimited = false), this.rateLimitTime);

        console.log(`${this.socket.ip} used command: ${id}`);
        switch (id) {
            case COMMAND.JOIN_BOTS:
                if (this.public_sandbox === this.link)
                    return this.sendNotification('bots free zone 🎯');
                if (this.bots.size >= this.botsMaximum) {
                    this.sendNotification(`You cant have more than ${this.botsMaximum} bots`);
                    return;
                }
                if (this.botsJoining) return;
                if (!this.link) return;

                const amount = value;
                this.botsJoining = true;
                this.joinBots(amount);
                this.sendNotification(`Joining ${amount} bots`, color.PINK);
                break;
            case COMMAND.MULTIBOX:
                if (this.gamemode === 'sandbox')
                    return this.sendNotification('disabled in sandbox 🎈');
                if (!!value === this.multibox) return;
                this.sendNotification(`Multiboxing ${!!value ? 'enabled' : 'disabled'}`, color.PINK);
                this.multibox = !!value;
                break;
            case COMMAND.AFK:
                if (!!value === this.afk) return;
                this.sendNotification(
                    `AFK ${!!value ? 'enabled' : 'disabled'}`,
                    color.PINK,
                    5000,
                    'afk'
                );
                this.afk = !!value;
                break;
            default:
                this.sendNotification(
                    `This feature will be available in the next update!`,
                    color.GREEN
                );
        }
    }
    /*
     *    C O M M A N D S
     */
    joinBots(amount, i = 0) {
        if (i >= ipv6pool.length) {
            this.sendNotification(
                `Not enough Proxies available. You have ${this.bots.size} bots`,
                color.GREEN
            );
            this.botsJoining = false;
            return;
        }
        if (amount === 0 || this.bots.size >= this.botsMaximum) {
            this.sendNotification(
                `Bots joined succesfully. You have ${this.bots.size} bots`,
                color.GREEN
            );
            this.botsJoining = false;
            return;
        }
        // initialize bot
        let bot = new DiepSocket(this.link, { ipv6: ipv6pool[i], forceTeam: true });
        this.bots.add(bot);
        bot.id = this.botCounter++;
        bot.once('accept', () => {
            let int = setInterval(() => {
                bot.spawn(this.botname());
                // upgrade path
                for (let [key, value] of Object.entries(this.upgradePath)) {
                    bot.sendBinary(new Uint8Array([3, key, value]));
                }
                // tank path
                this.tankPath.forEach((upgrade) => bot.sendBinary(new Uint8Array([4, upgrade])));
            }, 1000);
            bot.on('message', ({message}) => {
                if (message.startsWith(`You've killed`))
                    this.sendNotification(message, color.LIGHT_PINK, 6000);
            });
            bot.on('close', () => {
                clearInterval(int);
                this.bots.delete(bot);
            });

            if (this.socket.isClosed()) bot.close();
            this.socket.on('close', () => bot.close());
            if (bot.gamemode !== this.gamemode) this.socket.close(); // when someone fakes gamemode this will check.

            bot.removeAllListeners('error');
            this.joinBots(--amount, i);
        });
        bot.on('pow_request', ({difficulty, prefix}) => {
            this.socket.send('pow_request', { id: bot.id, difficulty, prefix });
        });
        bot.once('error', () => {
            bot.removeAllListeners('accept');
            this.joinBots(amount, ++i);
            this.bots.delete(bot);
        });
    }
    onpow_result({ id, result }) {
        const bot = Array.from(this.bots).find((bot) => bot.id === id);
        if (bot) bot.send('pow_result', { result });
    }
    /*
     *    A F K
     */
    stayAFK(data) {
        if (this.slow) return data;
        this.slow = true;

        // BLOCKWIDTH = 50 units.
        const tolerance = 2 * 50;
        const euclid_distance = Math.sqrt(
            Math.pow(this.mouseX - this.mouseXFixed, 2) +
                Math.pow(this.mouseY - this.mouseYFixed, 2)
        );

        // there is probably a better function to calc the speed relative to the distance from the fixed position. if you have a better one pls tell me.
        let timeout = (-Math.log(euclid_distance - 150) + 5.3) * 100;
        timeout = timeout !== timeout || timeout >= 250 ? 250 : timeout <= 0 ? 0 : timeout;
        setTimeout(() => (this.slow = false), timeout);
        const flags = this.calcFlags();
        if (euclid_distance > tolerance) return changeFlags(data, flags);
        return data;
    }
    calcFlags() {
        let flags = 2048;
        const distanceX = this.mouseX - this.mouseXFixed;
        const distanceY = this.mouseY - this.mouseYFixed;
        if (distanceX > 0) {
            flags += 4; // move west
        } else if (distanceX < 0) {
            flags += 16; //move east
        }
        if (distanceY > 0) {
            flags += 2; // move north
        } else if (distanceY < 0) {
            flags += 8; // move south
        }
        return flags;
    }

    /*
     *    H E L P E R   F U N C T I O N S
     */
    sendNotification(message, hexcolor = '0', time = 5000, unique = '') {
        const color = hexcolor.startsWith('#')
            ? parseInt(hexcolor.slice(1), 16)
            : parseInt(hexcolor, 16);
        const packet = new DiepBuilder({type:'message', content: {message, color, time, unique }}).clientbound();

        this.socket.send('custom_diep_clientbound', {buffer: packet});
        this.updateStatus(message);
    }
    updatePosition(data) {
        const packet = new DiepParser(data).serverbound().content;

        this.mouseX = packet.mouseX;
        this.mouseY = packet.mouseY;

        if (!this.afk) {
            this.mouseXFixed = this.mouseX;
            this.mouseYFixed = this.mouseY;
        }
    }
    ban(reason) {
        this.sendNotification(reason, color.RED, 10000);
        super.emit('ban', this.socket.ip);
    }
    toDataObject() {
        return {
            authKey: this.authKey,
            ip: this.socket.ip,
            version: this.version,
            name: this.name,
            wsURL: this.wsURL,
            party: this.party,
            link: this.link,
            gamemode: this.gamemode,
            status: this.status,
            time: this.timeConnected,
            latency: this.latency,
            bots: this.bots.size,
        };
    }
    updateStatus(message) {
        clearTimeout(this.statusTimeout);
        this.status = message;
        this.statusTimeout = setTimeout(() => (this.status = 'nothing'), 5000);
    }
}

const displayUserInfo = (user) => {
    console.log('ip:', user.ip);
    console.log('version:', user.version);
    console.log('authkey:', user.authKey);
    console.log('name:', user.name);
    console.log('wsURL:', user.wsURL);
    console.log('party:', user.party);
    console.log('link:', user.link);
    console.log('gamemode:', user.gamemode);
};

const changeFlags = (data, flags) => {
    const parsed = new DiepParser(data).serverbound().content;

    flags |= parsed.flags;

    const packet = new DiepBuilder({type: 'input', content:{
        parsed,
        flags
    }}).serverbound();
    return packet;
};

module.exports = User;
