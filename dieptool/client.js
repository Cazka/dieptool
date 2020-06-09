'use strict';

const EventEmitter = require('events');
const { Reader, Writer } = require('./coder.js');

class Client extends EventEmitter {
    constructor(socket, ip) {
        super();
        this.socket = socket;
        this.ip = ip;
        this.socket.on('message', (data) => this.onMessage(data));
        this.socket.on('close', () => super.emit('close'));
        this.socket.on('error', (err) => super.emit('error', err));
        
    }

    onMessage(data) {
        const read = new Reader(data);
        const id = read.vu();
        switch (id) {
            case 0:
                // login
                break;
            case 1:
                // init
                break;
            case 2:
                // update
                break;
            case 3:
                // command
                break;
            case 0x08:
                this.socket.send([8]);
                break;
            case 9:
                // diep.io serverbound
                super.emit('serverbound', data);
                break;
            case 10:
                // diep.io clientbound
                break;
            default:
                //unkown packet
                console.log('not recognized packet: ', data);
                break;
        }
    }
    onLogin(data){

        super.emit('login', )
    }
}

module.exports = Client;
