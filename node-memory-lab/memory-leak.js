const express = require('express');
const app = express();
let data = [];
app.get("/",(req,res)=>{
    //let data = [];
    for(let i=0;i<1000000;i++){
        data.push({index:i,time:new Date()});
    }
    console.log("Memory usage",process.memoryUsage().heapUsed/1024/1024,"MB");
    console.log("Data length",data.length);
    console.log("Memory total",process.memoryUsage().heapTotal/1024/1024,"MB");
    res.send("Data added!");
})
process.nextTick(() => {
  console.log("A");
  process.nextTick(() => console.log("B"));
});
process.nextTick(() => console.log("C"));
app.listen(3000,()=>{
    console.log("Server is running on port 3000");
})