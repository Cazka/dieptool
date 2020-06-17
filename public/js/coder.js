'use strict';

const convo = new ArrayBuffer(4);
const u8 = new Uint8Array(convo);
const u16 = new Uint16Array(convo);

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