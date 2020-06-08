# dieptool

## The Protocol

### Encodings

IDs will always be one byte. and should be read as uint.
Every other datatype will be a `String` in UTF8 with `0x00` indicating their end.

when we redirect diep.io packets. these are send as raw bytes, which means we skip the ID and read the rest how it is.

### Serverbound Packets

| ID   | Description                |
| ---- | -------------------------- |
| `00` | login                      |
| `01` | update                     |
| `02` | command                    |
| `09` | diep.io serverbound packet |
| `10` | diep.io clientbound packet |

#### `00` login

This packet is used to identify ourself by sending the authToken.

| Offset | Size(s) | Value Type | Description |
| ------ | ------- | ---------- | ----------- |
| +0     | 1 byte  | `uint`     | packet id   |
| +1     | n byte  | `String`+0 | authToken   |

#### `01` update

This packet is used to update user information.
A user information contains a ID and is followed by the information.
Its possible to update more than one information by repeating the id+string.

Currently all user information:

| ID   | Description   |
| ---- | ------------- |
| `00` | version       |
| `01` | name          |
| `02` | WebSocket URL |
| `03` | party code    |
| `04` | gamemode      |

| OFFSET | Size(s) | Value Type | Description |
| ------ | ------- | ---------- | ----------- |
| +0     | 1 byte  | `uint`     | packet id   |
| +1     | 1 byte  | `uint`     | update id   |
| +2     | n byte  | `String`+0 | data        |

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
