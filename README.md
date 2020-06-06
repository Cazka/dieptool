# dieptool

## The Protocol

### Serverbound Packets

| ID   | Description         |
| ---- | ------------------- |
| `00` | login               |
| `01` | init                |
| `02` | update              |
| `03` | command             |
| `09` | diep.io serverbound |
| `10` | diep.io clientbound |

#### `00` login

`{varuint}` id
`{String}` authToken

#### `01` init

`{varuint}` id  
`{String}` version  
`{String}` name  
`{String}` wsURL  
`{String}` party  
`{String}` gamemode

#### `02` update

`{varuint}` id  
`{String}` type  
`{String}` value

#### `03` command

`{varuint}` id  
`{String}` type
`{varuint}` value

#### `09` diep.io serverbound

`{varuint}` id
`...*` serverbound packet

#### `10` diep.io clientbound

### Clientbound Packets

| ID   | Description                |
| ---- | -------------------------- |
| `09` | custom diep.io serverbound |
| `09` | custom diep.io clientbound |
