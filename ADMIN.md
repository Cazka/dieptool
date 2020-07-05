# dieptool

## Admin Protocol

### Encodings

All Datatypes: `uint8`, `uint16`, `String`
Strings end with `00`

### Serverbound Packets

| ID   | Description |
| ---- | ----------- |
| `00` | login       |
| `08` | heartbeat   |
| `40` | command     |

#### `00` login

This packet is used to identify ourself by sending the authToken. The authToken is stored in the webbrowsers localStorage. When the localStroge is missing the authToken, the standart `'user'` token will be sent.

| Offset | Size(s) | Value Type | Description |
| ------ | ------- | ---------- | ----------- |
| +0     | 1 byte  | `uint8`    | packet id   |
| +1     | n bytes | `String`   | authToken   |

#### `08` heartbeat

| Offset | Size(s) | Value Type | Description |
| ------ | ------- | ---------- | ----------- |
| +0     | 1 byte  | `uint8`    | packet id   |

#### `40` command

| ID   | Description  |
| ---- | ------------ |
| `00` | notification |
| `01` | ban          |

| Offset | Size(s) | Value Type | Description |
| ------ | ------- | ---------- | ----------- |
| +0     | 1 byte  | `uint8`    | packet id   |
| +1     | n bytes | `uint8`    | command id  |

#### Notification

| Offset | Size(s) | Value Type | Description  |
| ------ | ------- | ---------- | ------------ |
| +2     | n bytes | `String`   | notification |
| +x     | n bytes | `String`   | hexcolor     |
| +x     | n bytes | `var uint` | time         |
| +x     | n bytes | `String`   | unique       |

#### Ban

| Offset | Size(s) | Value Type | Description |
| ------ | ------- | ---------- | ----------- |
| +2     | n bytes | `String`   | ip          |

### Clientbound Packets

| ID   | Description  |
| ---- | ------------ |
| `08` | heartbeat    |
| `40` | player count |
| `41` | player data  |
| `42` | player chart |

#### `08` heartbeat

| Offset | Size(s) | Value Type | Description |
| ------ | ------- | ---------- | ----------- |
| +0     | 1 byte  | `uint8`    | packet id   |

#### `40` player count

| Offset | Size(s) | Value Type | Description  |
| ------ | ------- | ---------- | ------------ |
| +0     | 1 byte  | `uint8`    | packet id    |
| +1     | 2 bytes | `uint16`   | player count |

#### `41` player data

| Offset | Size(s) | Value Type    | Description |
| ------ | ------- | ------------- | ----------- |
| +0     | 1 byte  | `uint8`       | packet id   |
| +1     | n bytes | `json String` | player data |

#### `42` player chart

| Offset | Size(s) | Value Type    | Description  |
| ------ | ------- | ------------- | ------------ |
| +0     | 1 byte  | `uint8`       | packet id    |
| +1     | n bytes | `json String` | player chart |
