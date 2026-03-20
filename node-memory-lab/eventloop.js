// process.nextTick(() => {
//   console.log("A");
//   Promise.resolve().then(() => console.log("B"));
// });
// Promise.resolve().then(() => console.log("C"));
// console.log("Shraddha"); 
// output: Shraddha
// A
// C
// B
// setTimeout(() => console.log("timeout"), 0);
// setImmediate(() => console.log("immediate"));
// output may vary based on the environment, 
// it can be timeout
// immediate or immediate
// timeout


// const fs = require("fs");
// fs.readFile(__filename, () => {
//   setTimeout(() => console.log("timeout"), 0);
//   setImmediate(() => console.log("immediate"));
// });
// output will always be
// immediate
// timeout
// bcz Inside I/O phase:
// next phase is check → setImmediate
// timers come later

// setTimeout(() => console.log("timeout"), 0);
// function loop() {
//   process.nextTick(loop);
// }
// loop();
// output- nothing prints bcz nextTick keeps running infinitely ,event loop never reaches timers 
// that leads to starvation 

// console.log("1");
// setTimeout(() => console.log("2"), 0);
// setImmediate(() => console.log("3"));
// process.nextTick(() => console.log("4"));
// Promise.resolve().then(() => console.log("5"));
// console.log("6");
// output - 1
// 6
// 4
// 5
// 2 or 3 (⚠️ depends) Sync → 1, 6 nextTick → 4 Promise → 5 Timers / Immediate → race
//Q9: Promise recursion vs nextTick recursion
// function loop() {
//   Promise.resolve().then(loop);
// }
// loop();
// setTimeout(() => console.log("timeout"), 0);
// output - timeout (eventually runs) - Promise allows event loop to continue
// No starvation like nextTick

// console.log("start");
// process.nextTick(() => {
//   console.log("A");
//   Promise.resolve().then(() => console.log("B"));
// });
// Promise.resolve().then(() => {
//   console.log("C");
//   process.nextTick(() => console.log("D"));
// });
// setTimeout(() => console.log("E"), 0);
// console.log("end");
// output - start end A C B D E 
// sync - start end
// nextTick - A (schedules B)
// promise queue C B (C schedules D)
// nextTick again D 
// timers E 
// imp - 1. Sync
// 2. nextTick queue
// 3. Promise microtask queue
// 4. Event loop phases

// async function test() {
//   console.log("1");
//   await Promise.resolve();
//   console.log("2");
// }
// console.log("3");
// test();
// console.log("4");
// output 3 1 4 2