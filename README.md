# dieptool

## The Protocol

### Encodings

So. I was thinking allot about how I encode the packets to increase performance.
This is what i came up with:

The first Byte will always indicate the packet id, which means I'm restricted to 256 packets which is good enough.
The next bytes are either varuint or strings.

Clientbound packets will not use varuint.

Note: Strings will end with a 00 byte.

### Serverbound Packets

| ID   | Description                |
| ---- | -------------------------- |
| `00` | login                      |
| `01` | update                     |
| `02` | command                    |
| `03` | request new authToken      |
| `09` | diep.io serverbound packet |
| `10` | diep.io clientbound packet |

#### `00` login

This packet is used to tell the server who we are.  
First byte packetid The packet id  
`{String}` authToken The Authentication Token

#### `01` update

This packet is used to send user information to the server that may have changed.  
The last two datatypes can be repeated to update more information.  
Currently all user information at once:

-   {String} version The version of the users script
-   {String} name The name the user choose ingame
-   {String} wsURL The server websocket url
-   {String} party The server partycode
-   {String} gamemode The server gamemode

First byte packetid The packet id  
`{String}` type  
`{String}` value

#### `02` command

This packet is used to execute commands.
Currently all commands:

-   {String} 'joinBots'
-   {String} amount

-   {String} 'afk'
-   {String} boolean

-   {String} 'multibox'
-   {String} boolean

First byte packetid The packet id  
`{String}` type
`{String}` value

#### `03` request new authToken

This packet is used to requst a new authtoken. 5 authtoken per ip per day.
First byte packetid The packet id

#### `09` diep.io serverbound

First byte packetid The packet id  
`...Buffer` serverbound packet

#### `10` diep.io clientbound

First byte packetid The packet id  
`...Buffer` clientbound packet

### Clientbound Packets

| ID   | Description                |
| ---- | -------------------------- |
| `00` | send a new authtoken       |
| `09` | custom diep.io serverbound |
| `09` | custom diep.io serverbound |
| `10` | custom diep.io clientbound |
