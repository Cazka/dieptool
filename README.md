# dieptool

## The Protocol

### Serverbound

| ID   | Description         |
| ---- | ------------------- |
| `00` | login               |
| `01` | init                |
| `02` | update              |
| `03` | command             |
| `fe` | diep.io serverbound |
| `ff` | diep.io clientbound |

### Clientbound

| ID   | Description                |
| ---- | -------------------------- |
| `fe` | custom diep.io serverbound |
| `ff` | custom diep.io clientbound |
