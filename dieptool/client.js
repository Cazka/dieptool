'use strict';

const EventEmitter = require('events');
const { Writer, Reader } = require('./coder.js');

/*
 * G E N E R A L   P A C K E T S
 */
const PACKET_GENERAL_SERVERBOUND = {
    LOGIN: 0,
    HEARTBEAT: 8,
};
const PACKET_GENERAL_CLIENTBOUND = {
    HEARTBEAT: 8,
};
/*
 * U S E R   P A C K E T S
 */
const PACKET_USER_SERVERBOUND = {
    UPDATE: 1,
    COMMAND: 2,
    SERVERBOUND: 9,
    CLIENTBOUND: 10,
};
const PACKET_USER_CLIENTBOUND = {
    AUTHTOKEN: 0,
    ACCEPT: 1,
    PUBLIC_SANDBOX: 2,
    CUSTOM_SERVERBOUND: 9,
    CUSTOM_CLIENTBOUND: 10,
};
/*
 * A D M I N   P A C K E T S
 */
const PACKET_ADMIN_SERVERBOUND = {};
const PACKET_ADMIN_CLIENTBOUND = {
    PLAYER_COUNT: 40,
    PLAYER_DATA: 41,
    PLAYER_CHART: 42,
};

class Client extends EventEmitter {
    constructor(socket, ip) {
        super();
        this.socket = socket;
        this.ip = ip;
        this.lastPing = Date.now();

        this.socket.on('message', (data) => this.onMessage(data));
        this.socket.on('close', () => super.emit('close'));
        this.socket.on('error', (err) => super.emit('error', err));
    }

    onMessage(data) {
        const reader = new Reader(data);
        switch (reader.u8()) {
            // G E N E R A L
            case PACKET_GENERAL_SERVERBOUND.LOGIN: {
                const authToken = reader.string();
                super.emit('login', authToken);
                break;
            }
            case PACKET_GENERAL_SERVERBOUND.HEARTBEAT: {
                const now = Date.now();
                super.emit('latency', now - this.lastPing);
                this.send(PACKET_GENERAL_CLIENTBOUND.HEARTBEAT);
                this.lastPing = now;
                break;
            }
            // U S E R
            case PACKET_USER_SERVERBOUND.UPDATE: {
                const id = reader.u8();
                const update = reader.string();
                super.emit('update', id, update);
                break;
            }
            case PACKET_USER_SERVERBOUND.COMMAND: {
                const id = reader.u8();
                const command = reader.u8();
                super.emit('command', id, command);
                break;
            }
            case PACKET_USER_SERVERBOUND.SERVERBOUND: {
                super.emit('serverbound', reader.array());
                break;
            }
            case PACKET_USER_SERVERBOUND.CLIENTBOUND: {
                super.emit('clientbound', reader.array());
                break;
            }
            // A D M I N
            default:
                console.log('not recognized packet: ', data);
                break;
        }
    }

    send(id, data = []) {
        if (this.isClosed()) return;

        const writer = new Writer().u8(id);
        switch (id) {
            case PACKET_USER_CLIENTBOUND.AUTHTOKEN:
                writer.string(data[0]);
                break;
            case PACKET_USER_CLIENTBOUND.ACCEPT:
                break;
            case PACKET_USER_CLIENTBOUND.PUBLIC_SANDBOX:
                writer.string(data[0]);
                break;
            case PACKET_USER_CLIENTBOUND.CUSTOM_CLIENTBOUND:
                writer.array(data);
                break;
            case PACKET_USER_CLIENTBOUND.CUSTOM_SERVERBOUND:
                writer.array(data);
                break;
            // A D M I N
            case PACKET_ADMIN_CLIENTBOUND.PLAYER_COUNT:
                writer.u16(data[0]);
                break;
            case PACKET_ADMIN_CLIENTBOUND.PLAYER_DATA:
                writer.string(JSON.stringify(data[0]));
                break;
            case PACKET_ADMIN_CLIENTBOUND.PLAYER_CHART:
                writer.string(JSON.stringify(data[0]));
                break;
        }
        this.socket.send(writer.out());
    }

    close() {
        try {
            this.socket.close();
        } catch (error) {
            this.socket.terminate();
        }
    }

    isClosed() {
        return this.socket.readyState !== this.socket.OPEN;
    }
}

module.exports = Client;
