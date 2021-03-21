import { makeInput, makeTemplate } from "../src";

test("Only the most current value is passed down", () => {
  const input = makeInput<number, [number]>((send) => (startFrom: number) => {
    send(startFrom);
    send(startFrom + 1);
    send(startFrom + 2);
  });

  const double = makeTemplate((startFrom: number) => {
    return input(startFrom) * 2;
  }, "double");

  const result: number[] = [];
  double.subscribe([3], (v) => result.push(v));

  expect(result).toEqual([10]);
});

test("simple mapping", (done) => {
  const input = makeInput<number, [number]>((send) => (startFrom: number) => {
    send(startFrom);
    setTimeout(() => {
      send(startFrom + 1);
    }, 1);
    setTimeout(() => {
      send(startFrom + 2);
    }, 2);
  });

  const double = makeTemplate((startFrom: number) => {
    return input(startFrom) * 2;
  }, "double");

  const result: number[] = [];
  double.subscribe([3], (v) => result.push(v));

  setTimeout(() => {
    expect(result).toEqual([6, 8, 10]);
    done();
  }, 5);
});
