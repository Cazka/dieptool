const arr = [];

arr.push([3,1]);
arr.push([0,3]);

arr.forEach((x) => console.log(x));
console.log(arr.some(x => x[0] === 1));
/*const arr = [];

arr.push({3:0});
arr.push({0:1});

for(let i=0; i<arr.length;i++){
    console.log(arr[i]);
}*/