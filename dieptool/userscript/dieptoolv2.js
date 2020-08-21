// ==UserScript==
// @name         Diep.io Tool v2
// @description  made with much love.
// @version      4.1.5
// @author       Cazka#9552
// @namespace    *://diep.io/*
// @match        *://diep.io/*
// @grant        GM_info
// @grant        GM_addStyle
// ==/UserScript==
'use strict';

/*
 *   C O N S T A N T S
 */
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
const MAIN_URL = 'wss://dieptool-bycazka.me/';
const BACKUP_URL = 'wss://ff7ffb71ec81.eu.ngrok.io/';

/*
 *   C L A S S E S
 */
class PowWorker {
    constructor() {
        this.worker = new Worker(this._getWorkerPath());
        this.nextJobId = 0;
        this.workerCallbacks = {};
        this.worker.onmessage = (e) => this._onmessage(e);
    }
    _getWorkerPath() {
        return (
            window.location.protocol +
            '//' +
            window.location.hostname +
            window.location.pathname +
            'pow_worker.js'
        );
    }
    _onmessage(e) {
        const data = e.data;
        const id = data[0];
        this.workerCallbacks[id](data.slice(1));
    }
    solve(prefix, difficulty, cb) {
        const id = this.nextJobId++;
        this.worker.postMessage([id, 'solve', prefix, difficulty]);
        this.workerCallbacks[id] = cb;
    }
}
/*
 * This is from @cx88 with little modifications made by me.
 * https://github.com/cx88/diepssect/blob/master/diep-bot/coder.js
 */
const convo = new ArrayBuffer(4);
const u8 = new Uint8Array(convo);
const u16 = new Uint16Array(convo);
const u32 = new Uint32Array(convo);
const float = new Float32Array(convo);
const endianSwap = (val) =>
    ((val & 0xff) << 24) | ((val & 0xff00) << 8) | ((val >> 8) & 0xff00) | ((val >> 24) & 0xff);
class Reader {
    constructor(content) {
        this.at = 0;
        this.buffer = new Uint8Array(content);
    }
    u8() {
        const out = this.buffer[this.at++];
        this.assertNotOOB();
        return out;
    }
    u16() {
        u8.set(this.buffer.subarray(this.at, (this.at += 2)));
        this.assertNotOOB();
        return u16[0];
    }
    u32() {
        u8.set(this.buffer.subarray(this.at, (this.at += 4)));
        this.assertNotOOB();
        return u32[0];
    }
    float() {
        u8.set(this.buffer.subarray(this.at, (this.at += 4)));
        this.assertNotOOB();
        return float[0];
    }
    vu() {
        let out = 0;
        let at = 0;
        while (this.buffer[this.at] & 0x80) {
            out |= (this.buffer[this.at++] & 0x7f) << at;
            at += 7;
        }
        out |= this.buffer[this.at++] << at;
        this.assertNotOOB();
        return out;
    }
    vi() {
        let out = this.vu();
        const sign = out & 1;
        out >>= 1;
        if (sign) out = ~out;
        this.assertNotOOB();
        return out;
    }
    vf() {
        u32[0] = endianSwap(this.vi());
        this.assertNotOOB();
        return float[0];
    }
    string() {
        let out;
        const at = this.at;
        while (this.buffer[this.at]) this.at++;
        out = new TextDecoder().decode(this.buffer.subarray(at, this.at++));
        this.assertNotOOB();
        return out;
    }
    buf() {
        let out;
        const length = this.vu();
        out = this.buffer.slice(this.at, this.at + length);
        this.at += length;
        this.assertNotOOB();
        return out;
    }
    flush() {
        const slice = this.buffer.slice(this.at);
        this.at += slice.length;
        return slice;
    }
    isEOF() {
        return this.at === this.buffer.byteLength;
    }
    assertNotOOB() {
        if (this.at > this.buffer.byteLength) {
            throw new Error(`Error at ${this.at}: Out of Bounds.\n${this.debugStringFullBuffer()}`);
        }
    }
    debugStringFullBuffer() {
        const s = this.buffer.reduce((acc, x, i) => {
            x = x.toString(16).padStart(2, 0).toUpperCase();
            if (this.at === i) x = `>${x}`;
            if (i % 16 === 0) acc = `${acc}\n${x}`;
            else acc = `${acc} ${x}`;
            return acc;
        }, '');
        return s.trim();
    }
}
class Writer {
    constructor() {
        this.length = 0;
        this.buffer = new Uint8Array(16384);
    }
    u8(num) {
        this.buffer[this.length] = num;
        this.length += 1;
        return this;
    }
    u16(num) {
        u16[0] = num;
        this.buffer.set(u8, this.length);
        this.length += 2;
        return this;
    }
    u32(num) {
        u32[0] = num;
        this.buffer.set(u8, this.length);
        this.length += 4;
        return this;
    }
    float(num) {
        float[0] = num;
        this.buffer.set(u8, this.length);
        this.length += 4;
        return this;
    }
    vu(num) {
        do {
            let part = num;
            num >>>= 7;
            if (num) part |= 0x80;
            this.buffer[this.length++] = part;
        } while (num);
        return this;
    }
    vi(num) {
        const sign = (num & 0x80000000) >>> 31;
        if (sign) num = ~num;
        const part = (num << 1) | sign;
        this.vu(part);
        return this;
    }
    vf(num) {
        float[0] = num;
        this.vi(endianSwap(u32[0]));
        return this;
    }
    string(str) {
        const bytes = new TextEncoder().encode(str);
        this.buffer.set(bytes, this.length);
        this.length += bytes.length;
        this.buffer[this.length++] = 0;
        return this;
    }
    buf(buf) {
        const length = buf.byteLength;
        this.vu(length);
        this.buffer.set(buf, this.length);
        this.length += length;
        return this;
    }
    out() {
        return this.buffer.slice(0, this.length);
    }
    dump() {
        return Array.from(this.buffer.subarray(0, this.length))
            .map((r) => r.toString(16).padStart(2, 0))
            .join(' ');
    }
}
class DTSocket {
    constructor(url, options) {
        this.url = url;
        this._socket;
        this._options = options;
        this.connect();
    }

    connect() {
        this.socket = new WebSocket(this.url);
        this.socket.binaryType = 'arraybuffer';
        this.socket.onopen = () => {
            this._onopen();
            if (this.onopen) this.onopen();
        };
        this.socket.onmessage = (event) => {
            this._onmessage(event);
            if (this.onmessage) this.onmessage(event);
        };
        this.socket.onclose = (event) => {
            this._onclose(event);
            if (this.onclose) this.onclose(event);
        };
    }

    _onopen() {
        this.send('heartbeat');
        this.send('initial', {
            version: this._options.version,
            authToken: this._options.authToken,
        });
    }

    _onmessage(event) {
        const reader = new Reader(event.data);
        switch (reader.vu()) {
            case 0: {
                const authToken = reader.string();

                if (this.onauthtoken) this.onauthtoken(authToken);
                break;
            }
            case 1: {
                const buffer = reader.buf();

                if (this.oncustom_diep_serverbound) this.oncustom_diep_serverbound(buffer);
                break;
            }
            case 2: {
                const buffer = reader.buf();

                if (this.oncustom_diep_clientbound) this.oncustom_diep_clientbound(buffer);
                break;
            }
            case 3: {
                if (this.onaccept) this.onaccept();
                break;
            }
            case 4: {
                const link = reader.string();

                if (this.onpublic_sbx_link) this.onpublic_sbx_link(link);
                break;
            }
            case 5: {
                const latency = Date.now() - this.lastPing;
                this.send('heartbeat');
                this.lastPing = Date.now();

                if (this.onlatency) this.onlatency(latency);
                break;
            }
            case 6: {
                if (!this._pow_worker) this._pow_worker = new PowWorker();
                const id = reader.vu();
                const difficulty = reader.vu();
                const prefix = reader.string();

                this._pow_worker.solve(prefix, difficulty, (result) =>
                    nodeSocket_send('pow_result', { id, result })
                );
                break;
            }
        }
    }

    _onclose(event) {}

    send(type, content) {
        if (this.isClosed()) return;
        const writer = new Writer();

        switch (type) {
            case 'initial': {
                const { version, authToken } = content;
                writer.vu(0);
                writer.string(version);
                writer.string(authToken);
                break;
            }
            case 'diep_serverbound': {
                const { buffer } = content;
                writer.vu(1);
                writer.buf(buffer);
                break;
            }
            case 'diep_clientbound': {
                const { buffer } = content;
                writer.vu(2);
                writer.buf(buffer);
                break;
            }
            case 'update': {
                const { id, value } = content;
                writer.vu(3);
                writer.vu(id);
                writer.string(value);
                break;
            }
            case 'command': {
                const { id, value } = content;
                writer.vu(4);
                writer.vu(id);
                writer.vu(value);
                break;
            }
            case 'heartbeat': {
                writer.vu(5);
                break;
            }
            case 'pow_result': {
                const { id, result } = content;
                writer.vu(6);
                writer.vu(id);
                writer.string(result);
                break;
            }
            default:
                console.error('unrecognized packet type:', type);
        }
        this.socket.send(writer.out());
    }

    isClosed() {
        if (this.socket) return this.socket.readyState !== WebSocket.OPEN;
        return true;
    }
}
/*
 *   H E L P E R   F U N C T I O N S
 */
function UTF8ToString(utf8 = '') {
    return decodeURI(
        utf8
            .split('')
            .map((c) => `%${c.charCodeAt(0).toString(16)}`)
            .join('')
    );
}
function parseParty(data) {
    let party = '';
    for (let i = 1; i < data.byteLength; i++) {
        let byte = data[i].toString(16).split('');
        if (byte.length === 1) {
            party += byte[0] + '0';
        } else {
            party += byte[1] + byte[0];
        }
    }
    return party;
}
function parseQuery(q) {
    const parsed = {};
    q.substring(1)
        .split('&')
        .forEach((e) => {
            e = e.split('=');
            parsed[e[0]] = e[1];
        });
    return parsed;
}
function updateInformation(type, data) {
    const updates = {
        [UPDATE.NAME](data) {
            let name = new TextDecoder().decode(data.slice(1, data.length - 1));
            return name;
        },
        [UPDATE.SERVER_PARTY]({ url, party }) {
            let [userURL, userParty] = gUserInfo[UPDATE.SERVER_PARTY].split(':');
            if (url) {
                userURL = url.match(/(?<=wss:\/\/).[0-9a-z]{3}(?=.s.m28n.net\/)/)[0];
                userParty = '';
            }
            if (party) {
                userParty = parseParty(party);
            }
            return `${userURL}:${userParty}`;
        },
        [UPDATE.GAMEMODE](data) {
            let gamemode = new TextDecoder().decode(data.slice(1, data.length)).split('\u0000')[0];
            return gamemode;
        },
    };
    gUserInfo[type] = updates[type](data);
    dtSocket.send('update', { id: type, value: gUserInfo[type] });
}
function _send(data) {
    dtSocket.send('diep_serverbound', { buffer: data });

    if (data[0] === 10) {
        const d = new Int8Array(data);
        const time = Date.now() - this.lastPow;
        setTimeout(() => this._send(d), 5000 - time);
        return;
    }
    if (gSendIsBlocked && data[0] === 1) return;
    if (data[0] === 2) updateInformation(UPDATE.NAME, data);
    this._send(data);
}
function _onmessage(event) {
    const data = new Uint8Array(event.data);
    dtSocket.send('diep_clientbound', { buffer: data });

    if (data[0] === 4) updateInformation(UPDATE.GAMEMODE, data);
    else if (data[0] === 6) updateInformation(UPDATE.SERVER_PARTY, { party: data });
    else if (data[0] === 10) gReadyToInit = true;
    else if (data[0] === 11) this.lastPow = Date.now();
    this._onmessage(event);
}
function addButton(parent, text, onclick, keyCode) {
    let button = document.createElement('button');
    parent.appendChild(button);
    button.innerHTML = text;
    button.keyCode = keyCode;
    button.onclick = onclick;
    button.style['background-color'] = guiColors[guiButtons.length % guiColors.length];
    guiButtons.push(button);
    return button;
}
function onBtnHead(){
    if(!window.localStorage['DTTOKEN']){
        window.location.href = 'https://discord.com/api/oauth2/authorize?client_id=737680273860329553&redirect_uri=https%3A%2F%2Fdiep.io&response_type=code&scope=identify&prompt=none';
    }
    else {

    }
}
function onBtnDiscord(){
    window.location.href = 'https://discord.gg/8saC9pq';
}

(function hijackWebSocket() {
    const wsInstances = new Set();
    window.WebSocket.prototype._send = window.WebSocket.prototype.send;
    window.WebSocket.prototype.send = function (data) {
        if (this.url.match(/s.m28n.net/) && data instanceof Int8Array) {
            _send.call(this, data);

            if (!wsInstances.has(this)) {
                wsInstances.add(this);
                gWebSocket = this;
                if (updateInformation) updateInformation(UPDATE.SERVER_PARTY, { url: this.url });

                this._onmessage = this.onmessage;
                this.onmessage = function (event) {
                    _onmessage.call(this, event);
                };
            }
        } else this._send(data);
    };
})();
(function freezeMouse() {
    const canvas = document.getElementById('canvas');
    canvas._onmousemove = canvas.onmousemove;
    canvas.onmousemove = function (e) {
        if (!gSendIsBlocked) this._onmousemove(e);
    };
})();
(function removeAnnoyingAlert() {
    unsafeWindow._alert = unsafeWindow.alert;
    unsafeWindow.alert = function (msg) {
        if (msg.startsWith('Your browser version')) return;
        this._alert(msg);
    };
})();
(function authCallback() {
    const query = parseQuery(window.location.search);
    if (query.code) {
        window.localStorage['DTTOKEN'] = query.code;
        window.location.href = '';
    } else if (query.error) {
        window.localStorage['DTTOKEN'] = '';
        window.location.href = '';
    }
})();

/*
 *   M A I N
 */
const gUserInfo = {
    [UPDATE.NAME]: UTF8ToString(window.localStorage.name),
    [UPDATE.SERVER_PARTY]: '',
    [UPDATE.GAMEMODE]: window.localStorage.gamemode,
};
let gWebSocket;
let gSendIsBlocked = false;
let gReadyToInit = false;

/*
 *   G U I
 */
GM_addStyle(`
.gui-dieptool button{display:block;font-family:Ubuntu;color:#fff;text-shadow:-.1em -.1em 0 #000,0 -.1em 0 #000,.1em -.1em 0 #000,.1em 0 0 #000,.1em .1em 0 #000,0 .1em 0 #000,-.1em .1em 0 #000,-.1em 0 0 #000;opacity:.8;border:none;padding:.3em .5em;width:100%;transition:all .15s}.gui-dieptool{top:0;left:0;position:absolute}.gui-dieptool button:active:not([disabled]){filter:brightness(.9)}.gui-dieptool button:hover:not([disabled]):not(:active){filter:brightness(1.1)}
`);
const guiColors = [
    '#E8B18A',
    '#E666EA',
    '#9566EA',
    '#6690EA',
    '#E7D063',
    '#EA6666',
    '#92EA66',
    '#66EAE6',
];
const guiButtons = [];

const guiDiepTool = document.createElement('div');
guiDiepTool.className = 'gui-dieptool';
document.body.appendChild(guiDiepTool);

const btnHead = addButton(guiDiepTool, 'Login to DiepTool', onBtnHead);
const btnDiscord = addButton(guiDiepTool, 'Discord Server', onBtnDiscord);


/*
 *   D T   S O C K E T
 */
const dtSocket = new DTSocket(MAIN_URL, {
    version: GM_info.script.version,
    authToken: window.localStorage.DTTOKEN,
});
dtSocket.onopen = function () {
    console.log('connected to DT server');
};
dtSocket.onclose = function (event) {
    console.log('disconnected from DT server');
    if (this.url === MAIN_URL) {
        console.log('Using backup url');
        this.url = BACKUP_URL;
        this.connect();
    } else {
        this.url = MAIN_URL;
        console.log('Please try again later.');
    }
};
dtSocket.onauthtoken = function(authToken){
    window.localStorage['DTTOKEN'] = authToken
};
dtSocket.oncustom_diep_serverbound = function(buffer){
    gWebSocket._send(buffer);
}
dtSocket.oncustom_diep_clientbound = function(buffer) {
    gWebSocket._onmessage({ data: buffer });
}
dtSocket.onaccept = function() {
    btnHead.innerHTML = 'Connected';
    const int = setInterval(() => {
        if (gReadyToInit) {
            clearInterval(int);

            for (let [key, value] of Object.entries(gUserInfo)) {
                this.send('update', { id: key, value });
            }
        }
    }, 50);
};
//dtSocket.onlatency = function(latency){
//console.log(latency);
//}