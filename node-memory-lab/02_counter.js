function createCounter(){
    let count = 0;
    return{
        increment(){
            count++;
            return count;
        },
        decrement(){
            count--;
            return count;
        }
    }
}

const counter = createCounter();