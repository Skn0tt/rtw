import { makeInput, makeTemplate } from "../src";

test("Easy Mapping", () => {
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

  expect(result).toEqual([6, 8, 10]);
});
