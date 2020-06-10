# dieptool

## The Protocol

### Encodings

All Datatypes: `uint8`, `uint16`, `String`, `Uint8Array`
Strings end with `00`;
If the packet contains `Uint8Array` its also the last datatype.

### Serverbound Packets

| ID   | Description                |
| ---- | -------------------------- |
| `00` | login                      |
| `01` | update                     |
| `02` | command                    |
| `08` | heartbeat                  |
| `09` | diep.io serverbound packet |
| `10` | diep.io clientbound packet |

#### `00` login

This packet is used to identify ourself by sending the authToken. The authToken is stored in the webbrowsers localStorage. When the localStroge is missing the authToken, the standart `'user'` token will be sent.

| Offset | Size(s) | Value Type | Description |
| ------ | ------- | ---------- | ----------- |
| +0     | 1 byte  | `uint8`    | packet id   |
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
| +0     | 1 byte  | `uint8`    | packet id   |
| +1     | 1 byte  | `uint8`    | update id   |
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

| Offset | Size(s) | Value Type          | Description                         |
| ------ | ------- | ------------------- | ----------------------------------- |
| +0     | 1 byte  | `uint8`             | packet id                           |
| +1     | 1 byte  | `uint8`             | command id                          |
| +2     | n bytes | `uint8` \| `String` | data Datatype depends on command id |

#### `08` heartbeat

| Offset | Size(s) | Value Type | Description |
| ------ | ------- | ---------- | ----------- |
| +0     | 1 byte  | `uint8`    | packet id   |

#### `09` diep.io serverbound

| Offset | Size(s) | Value Type   | Description        |
| ------ | ------- | ------------ | ------------------ |
| +0     | 1 byte  | `uint8`      | packet id          |
| +1     | n bytes | `Uint8Array` | serverbound packet |

#### `10` diep.io clientbound

| Offset | Size(s) | Value Type   | Description        |
| ------ | ------- | ------------ | ------------------ |
| +0     | 1 byte  | `uint8`      | packet id          |
| +1     | n bytes | `Uint8Array` | clientbound packet |

### Clientbound Packets

| ID   | Description                |
| ---- | -------------------------- |
| `00` | authToken       |
| `01` | accept                     |
| `08` | heartbeat                  |
| `09` | custom diep.io serverbound |
| `10` | custom diep.io clientbound |

#### `00` authToken

If the client uses the standart authToken `'user'`, we will sent a unique authToken
to the client, which will be stored in localStorage.

| Offset | Size(s) | Value Type | Description |
| ------ | ------- | ---------- | ----------- |
| +0     | 1 byte  | `uint8`    | packet id   |
| +1     | n bytes | `String`   | authToken   |

#### `01` accept

| Offset | Size(s) | Value Type | Description |
| ------ | ------- | ---------- | ----------- |
| +0     | 1 byte  | `uint8`    | packet id   |

#### `08` heartbeat

| Offset | Size(s) | Value Type | Description |
| ------ | ------- | ---------- | ----------- |
| +0     | 1 byte  | `uint8`    | packet id   |

#### `09` custom diep.io serverbound

to display custom notifications and more...

| Offset | Size(s) | Value Type   | Description        |
| ------ | ------- | ------------ | ------------------ |
| +0     | 1 byte  | `uint8`      | packet id          |
| +1     | n bytes | `Uint8Array` | serverbound packet |

#### `10` custom diep.io serverbound

to send movement packets and more...

| Offset | Size(s) | Value Type   | Description        |
| ------ | ------- | ------------ | ------------------ |
| +0     | 1 byte  | `uint8`      | packet id          |
| +1     | n bytes | `Uint8Array` | clientbound packet |
