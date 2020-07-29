const DiepSocket = require('diepsocket');

const hexcolor = 'ff0000';
const color = hexcolor.startsWith('#') ? parseInt(hexcolor.slice(1),16) : parseInt(hexcolor,16);
console.log(color);
//const packet = new DiepBuilder('message', { message, color, time, unique }).clientbound();
