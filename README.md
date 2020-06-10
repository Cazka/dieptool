# dieptool

## The Protocol

### Encodings

Every Packet contains a ID followed with the data.
IDs will always be one byte and are encoded in `uint8`.
The data has his own encoding described in the sections below.

There are only three encodings: uint, String and TypedArrays.
The String is always the last datastructure in a packet.

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

This packet is used to identify ourself by sending the authToken. The authToken is stored in the webbrowsers localStorage. When the localStroge is missing the authToken, the standart `'user'` token will be sent.

| Offset | Size(s) | Value Type | Description |
| ------ | ------- | ---------- | ----------- |
| +0     | 1 byte  | `uint`     | packet id   |
| +1     | n bytes | `String`   | authToken   |

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

| Offset | Size(s) | Value Type | Description |
| ------ | ------- | ---------- | ----------- |
| +0     | 1 byte  | `uint`     | packet id   |
| +1     | 1 byte  | `uint`     | update id   |
| +2     | n bytes | `String`   | data        |

#### `02` command

This packet is used to execute commands.

Currently all commands:

| ID   | Description |
| ---- | ----------- |
| `00` | Join Bots   |
| `01` | Multibox    |
| `02` | AFK         |

also:

| ID   | Boolean |
| ---- | ------- |
| `00` | FALSE   |
| `01` | TRUE    |

| Offset | Size(s) | Value Type         | Description |
| ------ | ------- | ------------------ | ----------- |
| +0     | 1 byte  | `uint`             | packet id   |
| +1     | 1 byte  | `uint`             | command id  |
| +2     | n bytes | `uint` \| `String` | data        |

#### `08` heartbeat

| Offset | Size(s) | Value Type | Description |
| ------ | ------- | ---------- | ----------- |
| +0     | 1 byte  | `uint`     | packet id   |

#### `09` diep.io serverbound

| Offset | Size(s) | Value Type  | Description        |
| ------ | ------- | ----------- | ------------------ |
| +0     | 1 byte  | `uint`      | packet id          |
| +1     | n bytes | `Int8Array` | serverbound packet |

#### `a0` diep.io clientbound

| Offset | Size(s) | Value Type   | Description        |
| ------ | ------- | ------------ | ------------------ |
| +0     | 1 byte  | `uint`       | packet id          |
| +1     | n bytes | `Uint8Array` | clientbound packet |

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
| +1     | n bytes | `String`   | authToken   |

#### `08` heartbeat

| Offset | Size(s) | Value Type | Description |
| ------ | ------- | ---------- | ----------- |
| +0     | 1 byte  | `uint`     | packet id   |

#### `09` custom diep.io serverbound

to display custom notifications and more...

| Offset | Size(s) | Value Type   | Description        |
| ------ | ------- | ------------ | ------------------ |
| +0     | 1 byte  | `uint`       | packet id          |
| +1     | n bytes | `TypedArray` | serverbound packet |

#### `a0` custom diep.io serverbound

to send movement packets and more...

| Offset | Size(s) | Value Type   | Description        |
| ------ | ------- | ------------ | ------------------ |
| +0     | 1 byte  | `uint`       | packet id          |
| +1     | n bytes | `TypedArray` | clientbound packet |
