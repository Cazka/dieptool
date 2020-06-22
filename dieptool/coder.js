'use strict';

const convo = new ArrayBuffer(4);
const u8 = new Uint8Array(convo);
const u16 = new Uint16Array(convo);
const i32 = new Uint32Array(convo);
const float = new Float32Array(convo);

let endianSwap = (val) =>
    ((val & 0xff) << 24) | ((val & 0xff00) << 8) | ((val >> 8) & 0xff00) | ((val >> 24) & 0xff);

class Writer {
    constructor() {
        this.length = 0;
        this.buffer = new Uint8Array(4096);
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
        let sign = (num & 0x80000000) >>> 31;
        if (sign) num = ~num;
        let part = (num << 1) | sign;
        this.vu(part);
        return this;
    }
    vf(num) {
        float[0] = num;
        this.vi(endianSwap(i32[0]));
        return this;
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
    string(str) {
        let bytes = new TextEncoder().encode(str);
        this.buffer.set(bytes, this.length);
        this.length += bytes.length;
        this.buffer[this.length++] = 0;
        return this;
    }
    array(arr) {
        this.buffer.set(arr, this.length);
        this.length += arr.byteLength;
        return this;
    }
    out() {
        return this.buffer.slice(0, this.length);
    }
}
class Reader {
    constructor(content) {
        this.at = 0;
        this.buffer = new Uint8Array(content);
    }
    vu() {
        let out = 0;
        let at = 0;
        while (this.buffer[this.at] & 0x80) {
            out |= (this.buffer[this.at++] & 0x7f) << at;
            at += 7;
        }
        out |= this.buffer[this.at++] << at;
        return out;
    }
    vi() {
        let out = this.vu();
        let sign = out & 1;
        out >>= 1;
        if (sign) out = ~out;
        return out;
    }
    vf() {
        i32[0] = endianSwap(this.vi());
        return float[0];
    }
    u8() {
        return this.buffer[this.at++];
    }
    u16() {
        u8.set(this.buffer.subarray(this.at, (this.at += 2)));
        return u16[0];
    }
    string() {
        let at = this.at;
        while (this.buffer[this.at]) this.at++;
        return new TextDecoder().decode(this.buffer.subarray(at, this.at++));
    }
    array() {
        return this.buffer.slice(this.at);
    }
}

module.exports = { Reader, Writer };
