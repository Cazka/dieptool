// ==UserScript==
// @name         Diep.io Tool
// @description  made with much love.
// @version      4.2.7
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
    SPINBOT: 4,
};
const SERVERS = [
    'wss://amsterdam.dieptool-bycazka.me',
    'wss://la.dieptool-bycazka.me',
    'wss://miami.dieptool-bycazka.me',
];
/*
 *   C L A S S E S
 */
class PowWorker {
    constructor() {
        this.worker = new Worker(this._getWorkerPath());
        this.nextJobId = 0;
        this.busy = false;
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
    terminate() {
        this.worker.terminate();
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
    constructor() {
        this._socket;
        this._lastPing = Date.now();
        this._pow_workers = [...Array(6)].map((x) => new PowWorker());
        this.accepted = false;
    }

    get region() {
        return new URL(this._socket.url).host.split('.')[0];
    }

    connect(url) {
        this._socket = new WebSocket(url);
        this._socket.binaryType = 'arraybuffer';
        this._socket.onopen = () => {
            this._onopen();
            if (this.onopen) this.onopen();
        };
        this._socket.onmessage = (event) => {
            this._onmessage(event);
            if (this.onmessage) this.onmessage(event);
        };
        this._socket.onclose = (event) => {
            this._onclose(event);
            if (this.onclose) this.onclose(event);
        };
    }
    _onopen() {
        this.send('heartbeat');
        this.send('initial', {
            version: GM_info.script.version,
            authToken: window.localStorage.DTTOKEN,
        });
    }
    _onmessage(event) {
        const reader = new Reader(event.data);
        switch (reader.vu()) {
            case 0: {
                const authToken = reader.string();

                window.localStorage.DTTOKEN = authToken;
                break;
            }
            case 1: {
                const buffer = reader.buf();

                if (this.oncustom_diep_serverbound) this.oncustom_diep_serverbound(buffer);
                break;
            }
            case 2: {
                const buffer = reader.buf();

                gWebSocket._onmessage({ data: buffer });
                break;
            }
            case 3: {
                this.accepted = true;
                if (this.onaccept) this.onaccept();
                break;
            }
            case 4: {
                if (this.ondeny) this.ondeny();
                break;
            }
            case 5: {
                const latency = Date.now() - this._lastPing;
                this.send('heartbeat');
                this._lastPing = Date.now();

                if (this.onlatency) this.onlatency(latency);
                break;
            }
            case 6: {
                const id = reader.vu();
                const difficulty = reader.vu();
                const prefix = reader.string();

                //look for a worker thats not busy, but definetly take the last one
                for (let i = 0; i < this._pow_workers.length; i++) {
                    if (!this._pow_workers[i].busy || i + 1 === this._pow_workers.length) {
                        this._pow_workers[i].busy = true;
                        this._pow_workers[i].solve(prefix, difficulty, (result) => {
                            this._pow_workers[i].busy = false;
                            this.send('pow_result', { id, result });
                        });
                        return;
                    }
                }
                break;
            }
            case 7: {
                const message = reader.string();

                if (this.onalert) this.onalert(message);
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
        this._socket.send(writer.out());
    }

    isClosed() {
        if (this._socket) return this._socket.readyState !== WebSocket.OPEN;
        return true;
    }

    static findServerPreference(urls) {
        return new Promise((resolve, reject) => {
            const timeout = setTimeout(() => resolve(), 5000);
            for (let i = 0; i < urls.length; i++) {
                const ws = new WebSocket(urls[i]);
                ws.onopen = function () {
                    clearTimeout(timeout);
                    ws.close();
                    resolve(ws.url);
                };
            }
        });
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
function enableGui() {
    guiBody.style.display = 'block';
}
function disableGui() {
    guiBody.style.display = 'none';
}
async function onBtnHead() {
    if (dtSocket.isClosed()) {
        if (!window.localStorage.DTTOKEN)
            window.location.href =
                'https://discord.com/api/oauth2/authorize?client_id=737680273860329553&redirect_uri=https%3A%2F%2Fdiep.io&response_type=code&scope=identify&prompt=none';
        else {
            const url = await DTSocket.findServerPreference(SERVERS);
            if (!url) {
                console.log('Please try again later.');
                btnHead.innerHTML = 'Please try again later';
                return;
            }
            this.innerHTML = 'Connecting...';
            dtSocket.connect(url);
        }
    } else if (dtSocket.accepted) {
        if (guiBody.style.display === 'block') disableGui();
        else enableGui();
    }
}
function onBtnJoinBots() {
    dtSocket.send('command', { id: COMMAND.JOIN_BOTS, value: 5 });
}
function onBtnMultibox() {
    this.active = !this.active;
    if (this.active) {
        this.innerHTML = 'Multiboxing: ON';
        dtSocket.send('command', { id: COMMAND.MULTIBOX, value: 1 });
    } else {
        this.innerHTML = 'Multiboxing: OFF';
        dtSocket.send('command', { id: COMMAND.MULTIBOX, value: 0 });
    }
}
function onBtnAfk() {
    this.active = !this.active;
    if (this.active) {
        gAfk = true;
        this.innerHTML = 'AFK: ON';
        dtSocket.send('command', { id: COMMAND.AFK, value: 1 });
    } else {
        gAfk = false;
        this.innerHTML = 'AFK: OFF';
        dtSocket.send('command', { id: COMMAND.AFK, value: 0 });
    }
}
function onBtnClump() {
    this.active = !this.active;
    if (this.active) {
        this.innerHTML = 'Clump: ON';
        dtSocket.send('command', { id: COMMAND.CLUMP, value: 1 });
    } else {
        this.innerHTML = 'Clump: OFF';
        dtSocket.send('command', { id: COMMAND.CLUMP, value: 0 });
    }
}
function onBtnSpinbot() {
    this.active = !this.active;
    if (this.active) {
        gSpinbot = true;
        this.innerHTML = 'Spinbot: ON';
        dtSocket.send('command', { id: COMMAND.SPINBOT, value: 1 });
    } else {
        gSpinbot = false;
        this.innerHTML = 'Spinbot: OFF';
        dtSocket.send('command', { id: COMMAND.SPINBOT, value: 0 });
    }
}
function onBtnDiscord() {
    window.open('https://discord.gg/8saC9pq');
}
function onBtnPatreon() {
    window.open('https://www.patreon.com/dieptool');
}

function _send(data) {
    dtSocket.send('diep_serverbound', { buffer: data });
    if (data[0] === 2) updateInformation(UPDATE.NAME, data);
    if (data[0] === 10) {
        const d = new Int8Array(data);
        const time = Date.now() - this.lastPow;
        setTimeout(() => this._send(d), 5000 - time);
        return;
    }
    if (data[0] === 1) {
        if (gSpinbot) {
            const reader = new Reader(data);
            const id = reader.vu();
            if (reader.vu() & 1 && !gAfk) {
                gCSBisBlocked = true;
            } else {
                gCSBisBlocked = false;
                return;
            }
        }

        if (gAfk) return;
    }
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
(function enableShortcuts() {
    document.addEventListener('keydown', (event) => {
        if (document.getElementById('textInputContainer').style.display === 'block') return;
        guiButtons.forEach((button) => {
            if (button.keyCode === event.code) button.onclick();
        });
    });
})();
(function freezeMouse() {
    const canvas = document.getElementById('canvas');
    canvas._onmousemove = canvas.onmousemove;
    canvas.onmousemove = function (e) {
        if (!gFreezeMouse) this._onmousemove(e);
    };
})();
(function removeAnnoyingAlert() {
    unsafeWindow._alert = unsafeWindow.alert;
    unsafeWindow.alert = function (msg) {
        if (msg.startsWith('Your browser version')) return;
        unsafeWindow._alert(msg);
    };
})();
(function authCallback() {
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
    const query = parseQuery(window.location.search);
    if (query.code) {
        window.localStorage.DTTOKEN = query.code;
        window.history.pushState(null, 'diep.io', 'https://diep.io/');
    } else if (query.error) {
        window.localStorage.DTTOKEN = '';
        window.history.pushState(null, 'diep.io', 'https://diep.io/');
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
let gAfk = false;
let gFreezeMouse = false;
let gSpinbot = false;
let gCSBisBlocked = false;
let gReadyToInit = false;
let dtSocket = new DTSocket();
/*
 *   G U I
 */
GM_addStyle(`
.gui-dieptool button{display:block;font-family:Ubuntu;color:#fff;text-shadow:-.1em -.1em 0 #000,0 -.1em 0 #000,.1em -.1em 0 #000,.1em 0 0 #000,.1em .1em 0 #000,0 .1em 0 #000,-.1em .1em 0 #000,-.1em 0 0 #000;opacity:.8;border:0;padding:.3em .5em;width:100%;transition:all .15s}.gui-dieptool{top:0;left:0;position:absolute}.gui-dieptool button:active:not([disabled]){filter:brightness(.9)}.gui-dieptool button:hover:not([disabled]):not(:active){filter:brightness(1.1)}
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

const guiHead = document.createElement('div');
guiDiepTool.appendChild(guiHead);

const guiBody = document.createElement('div');
guiDiepTool.appendChild(guiBody);

//add buttons
let btnHead;
if (window.localStorage.DTTOKEN) {
    btnHead = addButton(guiHead, 'Connecting...', onBtnHead);
    addButton(guiBody, 'Join Bots', onBtnJoinBots, 'KeyJ');
    addButton(guiBody, 'Multiboxing: OFF', onBtnMultibox, 'KeyF');
    addButton(guiBody, 'Clump: OFF', onBtnClump, 'KeyX');
    addButton(guiBody, 'AFK: OFF', onBtnAfk, 'KeyQ');
    addButton(guiBody, 'Spinbot OFF', onBtnSpinbot);
    disableGui();
} else {
    btnHead = addButton(guiHead, 'Login to DiepTool', onBtnHead);
    addButton(guiBody, 'Discord Server', onBtnDiscord);
    addButton(guiBody, 'Membership', onBtnPatreon);
}

(async function initializeSocket() {
    const url = await DTSocket.findServerPreference(SERVERS);
    console.log('found server preference', url);
    if (!url) {
        console.log('Please try again later.');
        btnHead.innerHTML = 'Please try again later';
        return;
    }
    dtSocket.onclose = function () {
        console.log('disconnected from DT server');
        btnHead.innerHTML = 'Disconnected';
        disableGui();
    };
    dtSocket.onaccept = function () {
        this.onlatency = (latency) => (btnHead.innerHTML = `${latency} ms ${this.region} DiepTool`);
        const int = setInterval(() => {
            if (gReadyToInit) {
                clearInterval(int);

                for (let [key, value] of Object.entries(gUserInfo))
                    this.send('update', { id: key, value });
            }
        }, 100);
    };
    dtSocket.ondeny = function () {
        window.localStorage.DTTOKEN = '';
        setTimeout(() => window.location.reload(), 4000);
    };
    dtSocket.onalert = function (message) {
        console.log('DiepTool alert:', message);
        const btnAlert = addButton(guiHead, message);
        setTimeout(() => btnAlert.parentNode.removeChild(btnAlert), 4000);
    };
    dtSocket.oncustom_diep_serverbound = function (data) {
        if (!gCSBisBlocked) gWebSocket._send(data);
    };

    if (window.localStorage.DTTOKEN) dtSocket.connect(url);
})();
