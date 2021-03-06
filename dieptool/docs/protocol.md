# dieptool

## The Protocol

### Serverbound Packets

| ID   | Description      |
| ---- | ---------------- |
| `00` | initial          |
| `01` | diep_serverbound |
| `02` | diep_clientbound |
| `03` | update           |
| `04` | command          |
| `05` | heartbeat        |
| `06` | pow-result       |

#### `00` intitial

This packet is used whenever we start a connection. it has the client's version number and the users authtoken.

| index | Value Type | Description |
| ----- | ---------- | ----------- |
| 0     | `vu`       | packet id   |
| 1     | `string`   | version     |
| 2     | `string`   | authToken   |

#### `01` diep_serverbound

| index | Value Type | Description        |
| ----- | ---------- | ------------------ |
| 0     | `vu`       | packet id          |
| 1     | `vu`       | packet count       |
| 2     | `buffer`   | serverbound packet |

#### `02` diep_clientbound

| index | Value Type | Description        |
| ----- | ---------- | ------------------ |
| 0     | `vu`       | packet id          |
| 1     | `vu`       | packet count       |
| 2     | `buffer`   | clientbound packet |

#### `03` update

This packet is used to update user information.
A user information contains an update-ID followed by the information.

Currently all user information:

| ID   | Description  |
| ---- | ------------ |
| `00` | server:party |
| `01` | name         |
| `02` | gamemode     |

| index | Value Type | Description  |
| ----- | ---------- | ------------ |
| 0     | `vu`       | packet id    |
| 1     | `vu`       | update id    |
| 2     | `string`   | update value |

#### `04` command

This packet is used to execute commands.

Currently all commands:

| ID   | Description | Data           |
| ---- | ----------- | -------------- |
| `00` | Join Bots   | amount of bots |
| `01` | Multibox    | on/off         |
| `02` | AFK         | on/off         |

| index | Value Type | Description   |
| ----- | ---------- | ------------- |
| 0     | `vu`       | packet id     |
| 1     | `vu`       | command id    |
| 2     | `vu`       | command value |

#### `05` heartbeat

| index | Value Type | Description |
| ----- | ---------- | ----------- |
| 0     | `vu`       | packet id   |

#### `06` pow_result

| index | Value Type | Description |
| ----- | ---------- | ----------- |
| 0     | `vu`       | packet id   |
| 0     | `vu`       | pow id      |
| 0     | `string`   | result      |

### Clientbound Packets

| ID   | Description             |
| ---- | ----------------------- |
| `00` | authToken               |
| `01` | custom_diep_serverbound |
| `02` | custom_diep_clientbound |
| `03` | accept                  |
| `04` | deny                    |
| `05` | heartbeat               |
| `06` | pow_request             |
| `07` | alert                   |

#### `00` authtoken

When the client sends the discord access-grant- token we respond with an unqiue authtoken.

| index | Value Type | Description |
| ----- | ---------- | ----------- |
| 0     | `vu`       | packet id   |
| 1     | `string`   | authToken   |

#### `01` custom_diep_serverbound

| index | Value Type | Description        |
| ----- | ---------- | ------------------ |
| 0     | `vu`       | packet id          |
| 1     | `vu`       | packet count       |
| 2     | `buffer`   | serverbound packet |

#### `02` custom_diep_clientbound

| index | Value Type | Description        |
| ----- | ---------- | ------------------ |
| 0     | `vu`       | packet id          |
| 1     | `vu`       | packet count       |
| 2     | `buffer`   | clientbound packet |

#### `03` accept

| index | Value Type | Description |
| ----- | ---------- | ----------- |
| 0     | `vu`       | packet id   |

#### `04` deny

Is send when the DT_TOKEN or the CODE is invalid

| index | Value Type | Description |
| ----- | ---------- | ----------- |
| 0     | `vu`       | packet id   |
| 1     | `string`   | reason      |

#### `05` heartbeat

| index | Value Type | Description |
| ----- | ---------- | ----------- |
| 0     | `vu`       | packet id   |

#### `06` pow_request

| index | Value Type | Description |
| ----- | ---------- | ----------- |
| 0     | `vu`       | packet id   |
| 1     | `vu`       | pow id      |
| 2     | `vu`       | difficulty  |
| 3     | `string`   | prefix      |

#### `07` alert

| index | Value Type | Description |
| ----- | ---------- | ----------- |
| 0     | `vu`       | packet id   |
| 3     | `string`   | message     |
