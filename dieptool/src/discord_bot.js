'use strict';
const fetch = require('node-fetch');
const Discord = require('discord.js');

const GUILD_ID = '727270183181221931';
class DiscordBot {
    constructor() {
        this._client = new Discord.Client();
        this._client.login(process.env.DISCORD_TOKEN);
        this._client.on('ready', () => {
            console.log('Discord is ready!');
            this._ready();
        });
    }
    async _ready(){
        this._guild = await this._client.guilds.fetch(GUILD_ID);
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

    async getUserInfo(auth) {
        const res = await fetch('https://discordapp.com/api/users/@me', {
            headers: {
                authorization: `${auth.token_type} ${auth.access_token}`,
            },
        }).then((res) => res.json());
        return res;
    }

    async getUserRoles(user_id){        
        const members = this._guild.members;
        const user = await members.fetch(user_id);
        const roles = [];
        user.roles.cache.forEach((value) => {
            roles.push({id: value.id, name: value.name});
        });
        return roles;
    }
}

module.exports = new DiscordBot();
