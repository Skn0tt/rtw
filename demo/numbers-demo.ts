import { makeDerivedValue, makeLiveValue } from "../src";

const input = makeLiveValue<number, []>(() => (send) => {
  const timer = setInterval(() => {
    send(Math.random());
  }, 500);

  return () => {
    clearInterval(timer);
  };
});

const input2 = makeLiveValue<number, []>(() => (send) => {
  const timer = setInterval(() => {
    send(Math.random());
  }, 1000);

  return () => {
    clearInterval(timer);
  };
});

const sum = makeDerivedValue(() => {
  return () => {
    const firstInput = input();
    const secondInput = input2();
    return firstInput + secondInput;
  };
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

// min.subscribe([], (v) => console.log("min", v));
// average.subscribe([], (v) => console.log("avg ", v));
// difference.subscribe([], (v) => console.log("difference: ", v));
// input.subscribe([], (v) => console.log("input: ", v));
// input2.subscribe([], (v) => console.log("input2: ", v));
const sumSubscription = sum.subscribe([], (v) => console.log("sum: ", v));

setTimeout(() => {
  sumSubscription.close();
}, 5000);
