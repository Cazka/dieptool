# diep-protocol
low level parser and builder for diep.io packets.

## Example

```js
const input = [1,128,16,136,147,128,8,136,131,134,12];
const packet = new Parser(input).serverbound();

console.log(packet)
//----------------
{
  id: 01,
  type: 'input',
  content: {
    flags: 2049,
    mouseX: 0,
    mouseY: 0
  }
}
```

## notice

All packets have this basic structure: 
```js
{
  id: number
  type: string
  content: object
}
```

Without these people this parser wouldn't be possible:  
@HueHanaejistla, he is the reason why i started to develop scripts for this game. He teached me all the basics on how to establish a WebSocket connection to the diep.io servers. 

@shlong, without the DMC discord server i wouldn't have meet all the other devs.

@diep.io, he is the master of the 00 packet and helped me more than anyone else. His knowledge about the game is incredible.

@Excigma, he was responsible for motivating me to parse the 00 packet. We both tried to do it but he stopped and left me alone :(

@CX88, amazing guy, he did so much work on deciphering the protocol. he deserves respect and he is also the creator of arras.io.

@Pola, he is a nice guy.

@shadam, even though i dont like him, his work is still marvellous and also motivated me.
