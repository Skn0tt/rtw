import { makeLiveValue, makeDerivedValue } from "../src";

test("Only the most current value is passed down", () => {
  const input = makeLiveValue<number, [number]>(
    (startFrom: number) => (send) => {
      send(startFrom);
      send(startFrom + 1);
      send(startFrom + 2);

      return () => {};
    }
  );

  const double = makeDerivedValue((startFrom: number) => () => {
    return input(startFrom) * 2;
  });

  const result: number[] = [];
  double.subscribe([3], (v) => result.push(v));

  expect(result).toEqual([10]);
});

test("simple mapping", (done) => {
  const input = makeLiveValue<number, [number]>(
    (startFrom: number) => (send) => {
      send(startFrom);
      const timer1 = setTimeout(() => {
        send(startFrom + 1);
      }, 1);
      const timer2 = setTimeout(() => {
        send(startFrom + 2);
      }, 2);

      return () => {
        clearTimeout(timer1);
        clearTimeout(timer2);
      };
    }
  );

  let doubleExecutionCounter = 0;

  const double = makeDerivedValue((startFrom: number) => () => {
    doubleExecutionCounter++;
    return input(startFrom) * 2;
  });

  const result: number[] = [];
  double.subscribe([3], (v) => result.push(v));

  setTimeout(() => {
    expect(result).toEqual([6, 8, 10]);
    expect(doubleExecutionCounter).toEqual(3);
    done();
  }, 5);
});
