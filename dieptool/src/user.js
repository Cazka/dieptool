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

const CLIENT_VERSION = '4.2.6';
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
    SPINBOT: 4,
};
const PERMISSIONS = {
    AFK: 1,
    JOIN_BOTS: 2,
    MULTIBOX: 4,
    CLUMP: 8,
    SPINBOT: 16,
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
        this.permissions = options.permissions;
        this.link;
        this.name;
        this.gamemode;

        // Status
        this.timeConnected = Date.now();
        this.status;
        this.multibox = false;
        this.afk = false;
        this.clump = false;
        this.spinbot = false;

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
        this.tankXFixed = 0.1;
        this.tankYFixed = 0.1;

        // CLUMP
        this.entityId;
        this.tankX = 0;
        this.tankY = 0;

        // Initialize
        this.socket.on('close', (code, reason) => {
            super.emit('close', code, reason);
        });

        if (version !== CLIENT_VERSION) {
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
    ondiep_serverbound(buffer) {
        switch (buffer[0]) {
            case 0x01: {
                let content;
                try {
                    content = new DiepParser(buffer).serverbound().content;
                } catch (error) {}

                if (this.afk) {
                    const deltaX = this.tankXFixed - this.tankX;
                    const deltaY = this.tankYFixed - this.tankY;
                    const length = Math.sqrt(deltaX ** 2 + deltaY ** 2);

                    const tolerance = 2 * 50;
                    if (length > tolerance) {
                        content = {
                            flags: content.flags | DiepSocket.INPUT.gamepad,
                            mouseX: content.mouseX,
                            mouseY: content.mouseY,
                            velocityX: deltaX / length,
                            velocityY: deltaY / length,
                        };
                    }
                }
                if (this.multibox) {
                    if (!this.clump) this.bots.forEach((bot) => bot.sendBinary(buffer));
                    else {
                        const tolerance = (4 + this.bots.size / 4) * 50;
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
                if (this.spinbot) {
                    const now = Date.now() / 50;
                    const mx = Math.cos(now) * 1000000;
                    const my = Math.sin(now) * 1000000;
                    content = {
                        flags: content.flags,
                        mouseX: mx,
                        mouseY: my,
                        velocityX: content.velocityX,
                        velocityY: content.velocityY,
                    };
                }
                if (this.afk || this.spinbot) {
                    this.socket.send('custom_diep_serverbound', {
                        buffer: new DiepBuilder({ type: 'input', content }).serverbound(),
                    });
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
                    if (this.botsMaximum === 1) {
                        setTimeout(
                            () =>
                                this.sendNotification(
                                    '🌌 Please consider becoming a patreon if you enjoy using DiepTool 🌌'
                                ),
                            1000 * 5
                        );
                        const int = setInterval(
                            () =>
                                this.sendNotification(
                                    '🌌 Please consider becoming a patreon if you enjoy using DiepTool 🌌'
                                ),
                            1000 * 60 * 10
                        );
                        this.socket.on('close', () => clearInterval(int));
                    }
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
    oncommand(id, value) {
        if (this.rateLimited) {
            this.sendNotification('slow down', color.RED, 5000, 'slow_down');
            return;
        }
        this.rateLimited = true;
        setTimeout(() => (this.rateLimited = false), this.rateLimitTime);

        console.log(`${this.socket.ip} used command: ${id}`);
        switch (id) {
            case COMMAND.AFK:
                if (!(this.permissions & PERMISSIONS.AFK)) {
                    this.sendNotification('Missing Permission', color.RED, 5000, 'no_permission');
                    return;
                }
                if (!!value === this.afk) return;
                this.sendNotification(`AFK: ${!!value ? 'ON' : 'OFF'}`, '#e8c100', 5000, 'afk');
                this.afk = !!value;

                if (this.afk) {
                    this.tankXFixed = this.tankX;
                    this.tankYFixed = this.tankY;
                }
                break;
            case COMMAND.JOIN_BOTS:
                if (!(this.permissions & PERMISSIONS.JOIN_BOTS)) {
                    this.sendNotification('Missing Permission', color.RED, 5000, 'no_permission');
                    return;
                }
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
                if (!(this.permissions & PERMISSIONS.MULTIBOX)) {
                    this.sendNotification('Missing Permission', color.RED, 5000, 'no_permission');
                    return;
                }
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
                if (!(this.permissions & PERMISSIONS.CLUMP)) {
                    this.sendNotification('Missing Permission', color.RED, 5000, 'no_permission');
                    return;
                }
                if (!!value === this.clump) return;
                this.sendNotification(`Clump: ${!!value ? 'ON' : 'OFF'}`, '#004aeb', 5000, 'clump');
                this.clump = !!value;
                break;
            case COMMAND.SPINBOT:
                if (!(this.permissions & PERMISSIONS.SPINBOT)) {
                    this.sendNotification('Missing Permission', color.RED, 5000, 'no_permission');
                    return;
                }
                if (!!value === this.spinbot) return;
                this.sendNotification(
                    `Spinbot: ${!!value ? 'ON' : 'OFF'}`,
                    '#ea6666',
                    5000,
                    'spinbot'
                );
                this.spinbot = !!value;
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
            if (bot.link !== this.link) this.socket.close(4000, 'bot link and user link mismatch');

            this.joinBots(--amount, i);
        });
        bot.on('error', (err) => {
            this.joinBots(amount, ++i);
        });
    }
    onpow_result(id, result) {
        const bot = Array.from(this.bots).find((bot) => bot.id === id);
        if (bot)
            setTimeout(() => bot.send('pow_result', { result }), 9000 - (Date.now() - bot.lastPow));
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

module.exports = User;
