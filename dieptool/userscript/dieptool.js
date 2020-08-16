// ==UserScript==
// @name         Diep.io Tool
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
 *    E N U M S   A N D   C O N S T A N T S
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
const JOIN_BOTS_AMOUNT = 10;
const MAIN_URL = 'wss://dieptool-bycazka.me/';
const BACKUP_URL = 'wss://ff7ffb71ec81.eu.ngrok.io/';
let DT_URL = MAIN_URL;
/*
 *    G L O B A L   V A R I A B L E S
 */
const gUserInfo = {
    [UPDATE.NAME]: UTF8ToString(window.localStorage.name),
    [UPDATE.SERVER_PARTY]: '',
    [UPDATE.GAMEMODE]: window.localStorage.gamemode,
};
let gWebSocket;
let gReadyToInit = false;
let gSendIsBlocked = false;
let gWorker;
let gFailedConnections = 0;
if (!window.localStorage.DTTOKEN) window.localStorage.DTTOKEN = 'user';
/*
 *    G U I
 */
GM_addStyle(
    `.gui-dieptool button{display:block;font-family:Ubuntu;color:#fff;text-shadow:-.1em -.1em 0 #000,0 -.1em 0 #000,.1em -.1em 0 #000,.1em 0 0 #000,.1em .1em 0 #000,0 .1em 0 #000,-.1em .1em 0 #000,-.1em 0 0 #000;opacity:.8;border:none;padding:.3em .5em;width:100%;transition:all .15s}.gui-dieptool{top:0;left:0;position:absolute}.gui-dieptool button:active:not([disabled]){filter:brightness(.9)}.gui-dieptool button:hover:not([disabled]):not(:active){filter:brightness(1.1)}`
);
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
guiHead.className = 'gui-header';
guiDiepTool.appendChild(guiHead);

const guiBody = document.createElement('div');
guiBody.className = 'gui-body';
guiDiepTool.appendChild(guiBody);

const guiBtnHead = addButton('Not connected', null, onBtnHead, guiHead);
const guiBtnJoinBots = addButton(`Join ${JOIN_BOTS_AMOUNT} bots`, 'KeyJ', onBtnJoinBots, guiBody);
const guiBtnMultibox = addButton('Enable Multiboxing', 'KeyF', onBtnMultibox, guiBody);
const guiBtnClump = addButton('Enable Clump', 'KeyX', onBtnClump, guiBody);
const guiBtnAfk = addButton('Enable AFK', 'KeyQ', onBtnAfk, guiBody);
const guiBtnSbx = addButton('Join Public Sandbox', null, onBtnSbx, guiBody);
const guiBtnUpdate = addButton('Check for updates', null, onBtnUpdate, guiBody);
const guiBtnSupport = addButton('Membership', null, onBtnSupport, guiBody);

// Enable keyboard shortcuts
document.addEventListener('keydown', (event) => {
    if (document.getElementById('textInputContainer').style['display'] === 'block') return;
    guiButtons.forEach((button) => {
        if (button.keyCode === event.code) button.onclick();
    });
});

enableGUI();

function addButton(text, keyCode, onclick, parent) {
    let button = document.createElement('button');
    parent.appendChild(button);
    button.innerHTML = text;
    button.keyCode = keyCode;
    button.onclick = onclick;
    button.style['background-color'] = guiColors[guiButtons.length % guiColors.length];
    guiButtons.push(button);
    return button;
}

/*
 *    B U T T O N   E V E N T H A N D L E R S
 */
function updateLatency(latency) {
    guiBtnHead.innerHTML = `${latency} ms DiepTool`;
}
function onBtnHead() {
    if (isClosed()) dtSocket = openSocket();
    if (guiBody.style.display === 'block') disableGUI();
    else enableGUI();
}
function onBtnJoinBots() {
    nodeSocket_send('command', { id: COMMAND.JOIN_BOTS, value: JOIN_BOTS_AMOUNT });
    if (!gWorker) gWorker = new PowWorker();
}
function onBtnMultibox() {
    this.state = !this.state;
    if (this.state) {
        this.innerHTML = 'Disable Multiboxing';
        nodeSocket_send('command', { id: COMMAND.MULTIBOX, value: 1 });
    } else {
        this.innerHTML = 'Enable Multiboxing';
        nodeSocket_send('command', { id: COMMAND.MULTIBOX, value: 0 });
    }
}
function onBtnClump() {
    this.state = !this.state;
    if (this.state) {
        guiBtnClump.innerHTML = 'Disable Clump';
        nodeSocket_send('command', { id: COMMAND.CLUMP, value: 1 });
    } else {
        guiBtnClump.innerHTML = 'Enable Clump';
        nodeSocket_send('command', { id: COMMAND.CLUMP, value: 0 });
    }
}
function onBtnAfk() {
    this.state = !this.state;
    if (this.state) {
        gSendIsBlocked = true;
        guiBtnAfk.innerHTML = 'Disable AFK';
        nodeSocket_send('command', { id: COMMAND.AFK, value: 1 });
    } else {
        gSendIsBlocked = false;
        guiBtnAfk.innerHTML = 'Enable AFK';
        nodeSocket_send('command', { id: COMMAND.AFK, value: 0 });
    }
}
async function onBtnSbx() {
    const res = await window.fetch('https://dieptool-sbx.glitch.me');
    window.location.href = (await res.json()).link;
    if (gWebSocket && gWebSocket.readyState === window.WebSocket.OPEN) gWebSocket.close();
    else window.location.reload();
    setTimeout(() => (window.location.hash = ''), 2000);
}
function onBtnUpdate() {
    this.confirm = !this.confirm;
    if (this.confirm) {
        guiBtnUpdate.innerHTML = 'Open in new tab?';
        setTimeout(() => {
            guiBtnUpdate.innerHTML = 'Check for Updates';
            this.confirm = false;
        }, 3000);
    } else {
        window.open('https://greasyfork.org/scripts/401910-diep-io-tool');
        guiBtnUpdate.innerHTML = 'Check for Updates';
    }
}
function onBtnSupport() {
    this.confirm = !this.confirm;
    if (this.confirm) {
        guiBtnSupport.innerHTML = 'Open in new tab?';
        setTimeout(() => {
            guiBtnSupport.innerHTML = 'Membership';
            this.confirm = false;
        }, 3000);
    } else {
        window.open('https://www.patreon.com/dieptool');
        guiBtnSupport.innerHTML = 'Membership';
    }
}

/*
 *    N O D E   W E B S O C K E T
 */
let dtSocket = openSocket();
function openSocket() {
    if (gFailedConnections > 10 && DT_URL !== BACKUP_URL) {
        console.log('using backup url');
        DT_URL = BACKUP_URL;
        gFailedConnections = 0;
    }
    if (gFailedConnections > 10) {
        gFailedConnections = 0;
        guiBtnHead.innerHTML = 'please try again later!';
        return;
    }
    gFailedConnections++;
    guiBtnHead.innerHTML = 'connecting...';
    let socket = new WebSocket(DT_URL);
    socket.binaryType = 'arraybuffer';
    socket.onopen = onDtOpen;
    socket.onmessage = onmessage;
    socket.onclose = onclose;
    return socket;
}

/*
 *    H I J A C K   S E N D ( )
 */
const wsInstances = new Set();
window.WebSocket.prototype._send = window.WebSocket.prototype.send;
window.WebSocket.prototype.send = function (data) {
    if (this.url.match(/s.m28n.net/) && data instanceof Int8Array) {
        if (!(gSendIsBlocked && data[0] === 1)) {
            if (data[0] === 10) delayPow(new Int8Array(data));
            else this._send(data);
        }
        nodeSocket_send('diep_serverbound', { buffer: data });

        if (!wsInstances.has(this)) {
            wsInstances.add(this);
            gWebSocket = this;
            update(UPDATE.SERVER_PARTY, { url: this.url });

            this._onmessage = this.onmessage;
            this.onmessage = function (event) {
                this._onmessage(event);
                const data = new Uint8Array(event.data);
                nodeSocket_send('diep_clientbound', { buffer: data });

                if (data[0] === 4) update(UPDATE.GAMEMODE, data);
                else if (data[0] === 6) update(UPDATE.SERVER_PARTY, { party: data });
                else if (data[0] === 10) gReadyToInit = true;
                else if (data[0] === 11) gWebSocket.lastPow = Date.now();
            };
        }
        if (data[0] === 2) update(UPDATE.NAME, data);
    } else this._send(data);
};
/*
 *    H E L P E R   F U N C T I O N S
 */
function update(type, data) {
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
                let p = '';
                for (let i = 1; i < party.byteLength; i++) {
                    let byte = party[i].toString(16).split('');
                    if (byte.length === 1) {
                        p += byte[0] + '0';
                    } else {
                        p += byte[1] + byte[0];
                    }
                }
                userParty = p;
            }
            return `${userURL}:${userParty}`;
        },
        [UPDATE.GAMEMODE](data) {
            let gamemode = new TextDecoder().decode(data.slice(1, data.length)).split('\u0000')[0];
            return gamemode;
        },
    };
    gUserInfo[type] = updates[type](data);
    nodeSocket_send('update', { id: type, value: gUserInfo[type] });
}
function nodeSocket_send(type, content) {
    if (isClosed()) return;
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
    dtSocket.send(writer.out());
}
function isClosed() {
    if (dtSocket) return dtSocket.readyState !== WebSocket.OPEN;
    return true;
}
function enableGUI() {
    guiBody.style.display = 'block';
}
function disableGUI() {
    guiBody.style.display = 'none';
}
function UTF8ToString(utf8 = '') {
    return decodeURI(
        utf8
            .split('')
            .map((c) => `%${c.charCodeAt(0).toString(16)}`)
            .join('')
    );
}
function delayPow(data) {
    const time = Date.now() - gWebSocket.lastPow;
    setTimeout(() => gWebSocket._send(data), 5000 - time);
}
!function freezeMouse() {
    const canvas = document.getElementById('canvas');
    canvas._onmousemove = canvas.onmousemove;
    canvas.onmousemove = function (e) {
        if (!gSendIsBlocked) this._onmousemove(e);
    };
}();
!function removeAnnoyingAlert() {
    window._alert = window.alert;
    window.alert = function (msg) {
        if (msg.startsWith('Your browser version')) return;
        this._alert(msg);
    };
}();

/*
 *    N O D E S O C K E T   E V E N T H A N D L E R
 */
function onDtOpen() {
    console.log('connected to node.js Server');
    nodeSocket_send('heartbeat');
    nodeSocket_send('initial', {
        version: GM_info.script.version,
        authToken: window.localStorage.DTTOKEN,
    });
    dtSocket.lastPing = Date.now();
    gFailedConnections = 0;
}
function onDtMessage(event) {
    const reader = new Reader(event.data);
    switch (reader.vu()) {
        case 0: {
            const authToken = reader.string();

            window.localStorage.DTTOKEN = authToken;
            break;
        }
        case 1: {
            const buffer = reader.buf();

            gWebSocket._send(buffer);
            break;
        }
        case 2: {
            const buffer = reader.buf();

            gWebSocket._onmessage({ data: buffer });
            break;
        }
        case 3: {
            const int = setInterval(() => {
                if (gReadyToInit) {
                    clearInterval(int);

                    for (let [key, value] of Object.entries(gUserInfo)) {
                        nodeSocket_send('update', { id: key, value });
                    }
                }
            }, 50);
            break;
        }
        case 4: {
            const link = reader.string();

            globalPublic_sbx = link;
            break;
        }
        case 5: {
            updateLatency(Date.now() - dtSocket.lastPing);
            nodeSocket_send('heartbeat');
            dtSocket.lastPing = Date.now();
            break;
        }
        case 6: {
            const id = reader.vu();
            const difficulty = reader.vu();
            const prefix = reader.string();

            gWorker.solve(prefix, difficulty, (result) => {
                nodeSocket_send('pow_result', { id, result });
            });
            break;
        }
    }
}
function onDtClose(event) {
    console.log('disconnected from node.js Server');
    guiBtnHead.innerHTML = 'disconnected';
    if (event.code === 1006) dtSocket = openSocket();
}

/*
 * H E L P E R   C L A S S
 */
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
        this.at--;
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
        this.buffer = new Uint8Array(8192);
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
