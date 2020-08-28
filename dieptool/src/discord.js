'use strict';
const fetch = require('node-fetch');
const Discord = require('discord.js');

const GUILD_ID = '727270183181221931';
const patreon_role = '740570890613555252';
const basic_role = '747796163843063858';
const premium_role = '747796333410123797';
const dtpro_role = '747796297733373993';

class DiscordBot {
    constructor() {
        this._client = new Discord.Client();
        this.ready = false;
        this._client.login(process.env.DISCORD_TOKEN);
        this._client.on('ready', () => this._ready());
    }
    async _ready() {
        this.ready = true;
        console.log('Discord is ready!');
        this._guild = this._client.guilds.cache.get(GUILD_ID);
    }
    async exchangeToken(code) {
        const data = {
            client_id: process.env.DISCORD_CLIENT_ID,
            client_secret: process.env.DISCORD_CLIENT_SECRET,
            grant_type: 'authorization_code',
            code,
            redirect_uri: 'https://diep.io',
            scope: 'identify',
        };
        const res = await fetch('https://discordapp.com/api/oauth2/token', {
            method: 'POST',
            body: new URLSearchParams(data),
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded',
            },
        }).then((res) => res.json());
        return res;
    }

    async refreshToken(refresh_token) {
        const data = {
            client_id: process.env.DISCORD_CLIENT_ID,
            client_secret: process.env.DISCORD_CLIENT_SECRET,
            grant_type: 'refresh_token',
            refresh_token,
            redirect_uri: 'https://diep.io',
            scope: 'identify',
        };
        const res = await fetch('https://discordapp.com/api/oauth2/token', {
            method: 'POST',
            body: new URLSearchParams(data),
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded',
            },
        }).then((res) => res.json());
        return res;
    }

    async apiFetch(auth) {
        const res = await fetch('https://discordapp.com/api/users/@me', {
            headers: {
                authorization: `${auth.token_type} ${auth.access_token}`,
            },
        }).then((res) => res.json());
        return res;
    }

    _getUser(user_id) {
        return this._guild.member(user_id);
    }

    getRoles(user_id) {
        const user = this._getUser(user_id);
        const roles = user?.roles.cache.map((x) => {
            return { id: x.id, name: x.name };
        });
        return roles || [];
    }

    isInGuild(user_id) {
        return this._getUser(user_id) ? true : false;
    }

    isPatreon(user_id) {
        const user = this._getUser(user_id);
        return user.roles.cache.has(patreon_role);
    }

    isBasic(user_id) {
        const user = this._getUser(user_id);
        return user.roles.cache.has(basic_role);
    }

    isPremium(user_id) {
        const user = this._getUser(user_id);
        return user.roles.cache.has(premium_role);
    }

    isDT_PRO(user_id) {
        const user = this._getUser(user_id);
        return user.roles.cache.has(dtpro_role);
    }
}

module.exports = new DiscordBot();
