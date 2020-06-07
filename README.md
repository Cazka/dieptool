# dieptool

## The Protocol

### Encodings

Currently i use only Strings in UTF8. the packets with id 09 are the only exception.

### Serverbound Packets

| ID   | Description         |
| ---- | ------------------- |
| `00` | login               |
| `01` | update              |
| `02` | command             |
| `09` | diep.io serverbound |
| `10` | diep.io clientbound |

#### `00` login

This packet is used to tell the server who we are.  
`{varuint}` packetid The packet id  
`{String}` authToken The Authentication Token

#### `02` update

This packet is used to send user information to the server that may have changed.  
The last two datatypes can be repeated to update more information.  
Currently all user information:
- {String} version The version of the users script
- {String} name The name the user choose ingame
- {String} wsURL The server websocket url
- {String} party The server partycode
- {String} gamemode The server gamemode

`{varuint}` packetid The packet id  
`{String}` type  
`{String}` value

#### `03` command

This packet is used to execute commands.
Currently all commands:
- {String} type
- {String} value

`{varuint}` packetid The packet id  
`{String}` type
`{varuint}` value

#### `09` diep.io serverbound

`{varuint}` packetid The packet id  
`...*` serverbound packet

#### `10` diep.io clientbound

`{varuint}` packetid The packet id  
`...*` clientbound packet

### Clientbound Packets

| ID   | Description                |
| ---- | -------------------------- |
| `09` | custom diep.io serverbound |
| `10` | custom diep.io clientbound |
