import { makeDerivedValue, makeLiveValue } from "../src";

const input = makeLiveValue<number, []>(() => (send) => {
  setInterval(() => {
    const x: number = Math.random();
    console.log("new Number: ", x);
    send(x);
  }, 500);
});

const average = makeDerivedValue(() => {
  let n = 0;
  let avg = 0;
  return () => {
    const newNumber = input();
    avg = (n * avg + newNumber) / (n + 1);
    n++;
    return avg;
  };
});

const min = makeDerivedValue(() => {
  let minNumber: number = 1;
  return () => {
    const newNumber = input();
    minNumber = Math.min(minNumber, newNumber);
    return minNumber;
  };
});

const difference = makeDerivedValue(() => () => {
  const currentMin = min();
  const currentAvg = average();
  return currentAvg - currentMin;
});

min.subscribe([], (v) => console.log("min", v));
average.subscribe([], (v) => console.log("avg ", v));
difference.subscribe([], (v) => console.log("difference: ", v));
