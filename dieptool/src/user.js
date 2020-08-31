'use strict';

const EventEmitter = require('events');
const DiepSocket = require('diepsocket');
const DiepParser = DiepSocket.Parser;
const DiepBuilder = DiepSocket.Builder;
const fs = require('fs');
const ipv6pool = fs
    .readFileSync(__dirname + '/ipv6')
    .toString('utf-8')
    .split('\n');

const UPDATE = {
    SERVER_PARTY: 0,
    NAME: 1,
    GAMEMODE: 2,
};

const COMMAND = {
    JOIN_BOTS: 0,
    MULTIBOX: 1,
    AFK: 2,
    CLUMP: 3,
};

const color = {
    PINK: '#ff00ff',
    GREEN: '#00ff00',
    RED: '#ff0000',
    LIGHT_PINK: '#ffcf40',
};

class User extends EventEmitter {
    constructor(socket, version, dbUser, options) {
        super();
        // Socket information
        this.socket = socket;
        this.latency = 0;

        // User information
        this.dbUser = dbUser;
        this.link;
        this.name;
        this.gamemode;

        // Status
        this.timeConnected = Date.now();
        this.status;
        this.multibox = false;
        this.afk = false;
        this.clump = false;

        // Flags
        this.welcomeMessageSend = false;
        this.rateLimited = false;
        this.rateLimitTime = 100;

        // Bots
        this.bots = new Set();
        this.botCounter = 0;
        this.botsjoining = false;
        this.botsMaximum = options.botsMaximum;
        this.botname = () => {
            if (!this.name) return 'DT';
            return this.name.startsWith('DT') ? this.name : `DT ${this.name}`;
        };

        // Gameplay
        this.upgradeStats = {};
        this.upgradeStatsOrder = [];
        this.upgradeTanks = [];
        this.resetUpgrades = () => {
            this.upgradeStats = {};
            this.upgradeStatsOrder = [];
            this.upgradeTanks = [];
        };

        // AFK
        this.slow = false;
        this.mouseX = 0;
        this.mouseY = 0;
        this.mouseXFixed;
        this.mouseYFixed;

        // CLUMP
        this.entityId;
        this.tankX = 0;
        this.tankY = 0;

        // Initialize
        this.socket.on('close', (code, reason) => {
            super.emit('close', code, reason);
        });

        if (version !== process.env.CLIENT_VERSION) {
            this.socket.send('alert', { message: 'Please update DiepTool to the newest version' });
            this.socket.close(
                4000,
                `outdated client expected: ${process.env.CLIENT_VERSION}, got: ${version}`
            );
            return;
        }

        this.socket.send('accept');
        this.socket.on('diep_serverbound', ({ buffer }) => this.ondiep_serverbound(buffer));
        this.socket.on('diep_clientbound', ({ buffer }) => this.ondiep_clientbound(buffer));

        this.socket.on('latency', (latency) => (this.latency = latency));
        this.socket.on('update', ({ id, value }) => this.onupdate(id, value));
        this.socket.on('command', ({ id, value }) => this.oncommand(id, value));
        this.socket.on('pow_result', ({ id, result }) => this.onpow_result(id, result));
    }
    /*
     *    E V E N T   H A N D L E R S
     */
    onupdate(id, value) {
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
                break;
            default:
                this.sendNotification('Please reinstall DiepTool', color.red, 0);
                this.socket.close(4000, `UPDATE NOT RECOGNIZED: ${id} with data ${value}`);
                break;
        }
    }
    ondiep_serverbound(buffer) {
        switch (buffer[0]) {
            case 0x01: {
                let content;
                try {
                    content = new DiepParser(buffer).serverbound().content;
                    this.updatePosition(content.mouseX, content.mouseY);
                } catch (error) {}

                if (this.multibox) {
                    if (!this.clump) this.bots.forEach((bot) => bot.sendBinary(buffer));
                    else {
                        const tolerance = 5 * 50;
                        this.bots.forEach((bot) => {
                            const euclid_distance = Math.sqrt(
                                Math.pow(bot.position.x - this.tankX, 2) +
                                    Math.pow(bot.position.y - this.tankY, 2)
                            );
                            if (euclid_distance > tolerance) {
                                bot.moveTo(
                                    { x: this.tankX, y: this.tankY },
                                    content.flags & 129,
                                    content.mouseX,
                                    content.mouseY
                                );
                            } else {
                                bot.sendBinary(buffer);
                            }
                        });
                    }
                }
                if (this.afk) {
                    buffer = this.stayAFK(buffer);
                    this.socket.send('custom_diep_serverbound', { buffer });
                }
                break;
            }
            case 0x02: {
                if (!this.welcomeMessage) {
                    this.welcomeMessage = true;
                    this.sendNotification(undefined, undefined, 1, 'adblock');
                    this.sendNotification(
                        `💎 Welcome back ${this.dbUser.username.split('#')[0]} 💎`,
                        '#f5e042'
                    );
                    this.sendNotification('🔥 Thank you for using DiepTool 🔥', color.GREEN);
                }
                this.resetUpgrades();
                break;
            }
            case 0x03: {
                const { id, level } = new DiepParser(buffer).serverbound().content;
                if (!this.upgradeStats[id]) {
                    this.upgradeStats[id] = 0;
                    this.upgradeStatsOrder.push(id);
                }
                if (level === -1) this.upgradeStats[id]++;
                else this.upgradeStats[id] = level;
                break;
            }
            case 0x04: {
                const { id } = new DiepParser(buffer).serverbound().content;
                this.upgradeTanks.push(id);
                break;
            }
        }
    }
    ondiep_clientbound(buffer) {
        const packet = new DiepParser(buffer).clientbound();

        switch (packet.type) {
            case 'update': {
                if (packet.content.id) this.entityId = packet.content.id;
                else if (packet.content.parse) {
                    const pos = packet.content.parse(this.entityId);
                    this.tankX = pos?.x || this.tankX;
                    this.tankY = pos?.y || this.tankY;
                }
            }
        }
    }
    oncommand(id, value) {
        if (this.rateLimited) {
            this.sendNotification('slow down', color.RED, 5000, 'slow_down');
            return;
        }
        this.rateLimited = true;
        setTimeout(() => (this.rateLimited = false), this.rateLimitTime);

        console.log(`${this.socket.ip} used command: ${id}`);
        switch (id) {
            case COMMAND.JOIN_BOTS:
                if (this.bots.size >= this.botsMaximum) {
                    this.sendNotification(
                        `You cant have more than ${this.botsMaximum} bots`,
                        undefined,
                        5000,
                        'max_bots'
                    );
                    return;
                }
                if (this.botsJoining) return;
                if (!this.link) return;

                this.botsJoining = true;
                let amount = value;
                amount =
                    this.bots.size + amount > this.botsMaximum
                        ? this.botsMaximum - this.bots.size
                        : amount;
                this.sendNotification(`Joining ${amount} bots`, '#e300eb', 5000, 'join_bots');
                this.joinBots(amount);
                break;
            case COMMAND.MULTIBOX:
                if (!!value === this.multibox) return;
                this.sendNotification(
                    `Multiboxing: ${!!value ? 'ON' : 'OFF'}`,
                    '#5200eb',
                    5000,
                    'multibox'
                );
                this.multibox = !!value;
                break;
            case COMMAND.CLUMP:
                if (!!value === this.clump) return;
                this.sendNotification(`Clump: ${!!value ? 'ON' : 'OFF'}`, '#004aeb', 5000, 'clump');
                this.clump = !!value;
                break;
            case COMMAND.AFK:
                if (!!value === this.afk) return;
                this.sendNotification(`AFK: ${!!value ? 'ON' : 'OFF'}`, '#e8c100', 5000, 'afk');
                this.afk = !!value;
                break;
            default:
                this.sendNotification(
                    `This feature will be available in the next update!`,
                    color.GREEN,
                    5000,
                    'unknown_command'
                );
        }
    }
    /*
     *    C O M M A N D S
     */
    joinBots(amount, i = 0) {
        if (i >= ipv6pool.length) {
            this.sendNotification(
                `Can't join bots because your team is full. You have ${this.bots.size} bots`,
                color.GREEN
            );
            this.botsJoining = false;
            return;
        }
        if (amount === 0 || this.bots.size >= this.botsMaximum) {
            this.sendNotification(
                `Bots joined succesfully. You have ${this.bots.size} bots`,
                color.GREEN,
                5000,
                'join_bots_successful'
            );
            this.botsJoining = false;
            return;
        }
        // initialize bot
        let bot = new DiepSocket(this.link, { ipv6: ipv6pool[i], forceTeam: true });
        bot.id = this.botCounter++;
        bot.on('open', () => {
            this.bots.add(bot);
            bot.on('close', () => this.bots.delete(bot));
            bot.on('pow_request', ({ difficulty, prefix }) => {
                bot.lastPow = Date.now();
                this.socket.send('pow_request', { id: bot.id, difficulty, prefix });
            });
        });
        bot.on('accept', () => {
            let int = setInterval(() => {
                bot.spawn(this.botname());
                // upgrade path
                this.upgradeStatsOrder.forEach((id) => {
                    bot.send('upgrade_stat', { id, level: this.upgradeStats[id] });
                });
                // tank path
                this.upgradeTanks.forEach((id) => bot.send('upgrade_tank', { id }));
            }, 1000);
            bot.on('close', () => clearInterval(int));
            bot.on('message', ({ message }) => {
                if (message.startsWith(`You've killed`))
                    this.sendNotification(message, color.LIGHT_PINK, 6000);
            });

            if (this.socket.isClosed()) bot.close();
            this.socket.on('close', () => bot.close());
            if (bot.gamemode !== this.gamemode)
                this.socket.close(4000, 'bot gamemode and user gamemode mismatch');

            this.joinBots(--amount, i);
        });
        bot.on('error', () => this.joinBots(amount, ++i));
    }
    onpow_result(id, result) {
        const bot = Array.from(this.bots).find((bot) => bot.id === id);
        if (bot)
            setTimeout(() => bot.send('pow_result', { result }), 9000 - (Date.now() - bot.lastPow));
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
        const packet = new DiepBuilder({
            type: 'message',
            content: { message, color, time, unique },
        }).clientbound();

        this.socket.send('custom_diep_clientbound', { buffer: packet });
        this.updateStatus(message);
    }
    updatePosition(mouseX, mouseY) {
        this.mouseX = mouseX;
        this.mouseY = mouseY;

        if (!this.afk) {
            this.mouseXFixed = this.mouseX;
            this.mouseYFixed = this.mouseY;
        }
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
        this.status = message;
        setTimeout(() => {
            if (this.status === message) this.status = 'nothing';
        }, 5000);
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
    let parsed;
    try {
        parsed = new DiepParser(data).serverbound().content;
    } catch (error) {
        return data;
    }

    flags |= parsed.flags;

    const packet = new DiepBuilder({
        type: 'input',
        content: {
            flags,
            mouseX: parsed.mouseX,
            mouseY: parsed.mouseY,
        },
    }).serverbound();
    return packet;
};

module.exports = User;
