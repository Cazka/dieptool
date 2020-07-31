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
| 1     | `buffer`   | serverbound packet |

#### `02` diep_clientbound

| index | Value Type | Description        |
| ----- | ---------- | ------------------ |
| 0     | `vu`       | packet id          |
| 1     | `buffer`   | clientbound packet |

#### `03` update

This packet is used to update user information.
A user information contains an update-ID followed by the information.

Currently all user information:

| ID   | Description  |
| ---- | ------------ |
| `00` | server:party |
| `01` | name         |
| `02` | gamemode     |

| index | Value Type | Description |
| ----- | ---------- | ----------- |
| 0     | `vu`       | packet id   |
| 1     | `vu`       | update id   |
| 2     | `string`   | update value |

#### `04` command

This packet is used to execute commands.

Currently all commands:

| ID   | Description | Data           |
| ---- | ----------- | -------------- |
| `00` | Join Bots   | amount of bots |
| `01` | Multibox    | on/off         |
| `02` | AFK         | on/off         |

| index | Value Type | Description  |
| ----- | ---------- | ------------ |
| 0     | `vu`       | packet id    |
| 1     | `vu`       | command id   |
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
| `00` | authtoken               |
| `01` | custom_diep_serverbound |
| `02` | custom_diep_clientbound |
| `03` | accept                  |
| `04` | public_sbx_link         |
| `05` | heartbeat               |
| `06` | pow_request             |

#### `00` authtoken

If the client uses the standart authToken `'user'`, we will sent a unique authToken
to the client, which will be stored in localStorage.

| index | Value Type | Description |
| ----- | ---------- | ----------- |
| 0     | `vu`       | packet id   |
| 1     | `string`   | authToken   |

#### `01` custom_diep_serverbound

| index | Value Type | Description        |
| ----- | ---------- | ------------------ |
| 0     | `vu`       | packet id          |
| 1     | `buffer`   | serverbound packet |

#### `02` custom_diep_clientbound

| index | Value Type | Description        |
| ----- | ---------- | ------------------ |
| 0     | `vu`       | packet id          |
| 1     | `buffer`   | clientbound packet |

#### `03` accept

| index | Value Type | Description |
| ----- | ---------- | ----------- |
| 0     | `vu`       | packet id   |

#### `04` public sandbox link

| index | Value Type | Description |
| ----- | ---------- | ----------- |
| 0     | `vu`       | packet id   |
| 1     | `string`   | sbx link    |

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
