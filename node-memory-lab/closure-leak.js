function createLeak() {
  let bigData = new Array(1000000).fill("🔥");

  return function () {
    console.log(bigData.length);
  };
}

const leak = createLeak();

setInterval(() => {
  leak();
}, 1000);