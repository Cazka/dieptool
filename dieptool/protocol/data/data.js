const fs = require('fs');
const path = require('path');

const CLIENTBOUND = retrieveDataSpecs(path.join(__dirname, 'clientbound'));
const SERVERBOUND = retrieveDataSpecs(path.join(__dirname, 'serverbound'));

function retrieveDataSpecs(dataPath){
    const obj = {};
    const files = fs.readdirSync(dataPath)
    for (let i = 0; i < files.length; i++) {
        const data = require(path.join(dataPath, files[i]));
        if( !usesInterface(data)){
            const err = new Error(
                `'${path.join(dataPath, files[i])}' does not match the interface`
            );
            throw err;
        }
        if (obj[data.id]) {
            const err = new Error(
                `${dataPath}: ${obj[data.id].type} and ${data.type} share the same id.`
            );
            throw err;
        }
        obj[data.id] = data;
    }
    obj.getFromType = function(type){
        for (let [key, value] of Object.entries(this)) {
            if(value.type === type) return this[key];
        }
        const err = new Error(`cannot find: ${type}`);
        throw err;
    };
    return obj;
}
function usesInterface(data) {
    if (!data) return false;
    if (data.id === undefined) return false;
    if (!data.type) return false;
    if (!data.parse) return false;
    if (!data.build) return false;
    return true;
}

module.exports = { SERVERBOUND, CLIENTBOUND };
