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
| `08` | heartbeat                  |
| `09` | diep.io serverbound packet |
| `a0` | diep.io clientbound packet |

#### `00` login

This packet is used to identify ourself by sending the authToken. The authToken is stored in the webbrowsers localStorage, when the localStroge is missing the authToken the standart `'user'` token will be sent.

| Offset | Size(s) | Value Type | Description |
| ------ | ------- | ---------- | ----------- |
| +0     | 1 byte  | `uint`     | packet id   |
| +1     | n byte  | `String`+0 | authToken   |

#### `01` update

This packet is used to update user information.
A user information contains an update-ID followed by the information.

Currently all user information:

| ID   | Description   |
| ---- | ------------- |
| `00` | version       |
| `01` | name          |
| `02` | WebSocket URL |
| `03` | party code    |
| `04` | gamemode      |

| Offset | Size(s)  | Value Type | Description   |
| ------ | -------- | ---------- | ------------- |
| +0     | 1 byte   | `uint`     | packet id     |
| +1     | 1 byte   | `uint`     | update id     |
| +2     | n byte   | `String`+0 | data          |

#### `02` command

This packet is used to execute commands.

Currently all commands:

| ID   | Description |
| ---- | ----------- |
| `00` | Join Bots   |
| `01` | Multibox    |
| `02` | AFK         |

| Offset | Size(s) | Value Type | Description |
| ------ | ------- | ---------- | ----------- |
| +0     | 1 byte  | `uint`     | packet id   |
| +1     | 1 byte  | `uint`     | command id  |
| +2     | 1 byte  | `uint`     | data        |

#### `08` heartbeat

| Offset | Size(s) | Value Type | Description |
| ------ | ------- | ---------- | ----------- |
| +0     | 1 byte  | `uint`     | packet id   |

#### `09` diep.io serverbound

| Offset | Size(s)  | Value Type  | Description        |
| ------ | -------- | ----------- | ------------------ |
| +0     | 1 byte   | `uint`      | packet id          |
| +1     | ... byte | `Int8Array` | serverbound packet |

#### `a0` diep.io clientbound

| Offset | Size(s)  | Value Type   | Description        |
| ------ | -------- | ------------ | ------------------ |
| +0     | 1 byte   | `uint`       | packet id          |
| +1     | ... byte | `Uint8Array` | clientbound packet |

### Clientbound Packets

| ID   | Description                |
| ---- | -------------------------- |
| `00` | send a new authToken       |
| `08` | heartbeat                  |
| `09` | custom diep.io serverbound |
| `a0` | custom diep.io clientbound |

#### `00` send a new authToken

If the client uses the standart authToken `'user'`, we will sent a unique authToken
to the client, which will be stored in localStorage.

| Offset | Size(s) | Value Type | Description |
| ------ | ------- | ---------- | ----------- |
| +0     | 1 byte  | `uint`     | packet id   |
| +1     | n byte  | `String`   | authToken   |

#### `08` heartbeat

| Offset | Size(s) | Value Type | Description |
| ------ | ------- | ---------- | ----------- |
| +0     | 1 byte  | `uint`     | packet id   |

#### `09` custom diep.io serverbound

to display custom notifications and more...

| Offset | Size(s)  | Value Type    | Description        |
| ------ | -------- | ------------- | ------------------ |
| +0     | 1 byte   | `uint`        | packet id          |
| +1     | ... byte | `ArrayBuffer` | serverbound packet |

#### `a0` custom diep.io serverbound

to send movement packets and more...

| Offset | Size(s)  | Value Type    | Description        |
| ------ | -------- | ------------- | ------------------ |
| +0     | 1 byte   | `uint`        | packet id          |
| +1     | ... byte | `ArrayBuffer` | clientbound packet |
