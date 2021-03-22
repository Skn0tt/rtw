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

test("Multiple synchronous sends trigger multiple synchronous evaluations", (done) => {
  const input = makeLiveValue<number, [number]>(
    (startFrom: number) => (send) => {
      const timer = setTimeout(() => {
        send(startFrom);
        send(startFrom + 1);
        send(startFrom + 2);
      }, 1);

      return () => {
        clearTimeout(timer);
      };
    }
  );

  const double = makeDerivedValue((startFrom: number) => () => {
    return input(startFrom) * 2;
  });

  const result: number[] = [];
  double.subscribe([3], (v) => result.push(v));

  setTimeout(() => {
    expect(result).toEqual([6, 8, 10]);
    done();
  }, 5);
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

test("alternating inputs", (done) => {
  const events: string[] = [];

  const inputA = makeLiveValue<string, []>(() => (send) => {
    setTimeout(() => {
      send("1 - a");
    }, 1);

    setTimeout(() => {
      send("3 - a");
    }, 3);

    return () => {
      events.push("cleanup - a");
    };
  });

  const inputB = makeLiveValue<string, []>(() => (send) => {
    setTimeout(() => {
      send("2 - b");
    }, 2);

    setTimeout(() => {
      send("4 - b");
    }, 4);

    return () => {
      events.push("cleanup - b");
    };
  });

  const alternating = makeDerivedValue(() => {
    let useA = true;
    return () => {
      if (useA) {
        useA = false;
        return inputA();
      } else {
        useA = true;
        return inputB();
      }
    };
  });

  const subscription = alternating.subscribe([], (v) => events.push(v));

  setTimeout(() => {
    subscription.close();

    expect(events).toEqual([
      // first derive: useA is flipped, inputA suspends, alternating is now child of inputA
      // inputA sends: useA is flipped, inputB suspends, alternating is now child of inputA and inputB
      // inputB sends: useA is flipped, inputA returns "3 - a"
      "3 - a",
      // inputA sends: useA is flipped, inputB returns "2 - b"
      "2 - b",
      // inputB sends: useA is flipped, inputA returns "3 - a"
      "3 - a",
      // cleanup is called
      "cleanup - a",
      "cleanup - b",
    ]);

    done();
  }, 10);
});

test("get the most recent of two inputs", (done) => {
  const events: string[] = [];

  const inputA = makeLiveValue<string, []>(() => (send) => {
    setTimeout(() => {
      send("1 - a");
    }, 1);

    setTimeout(() => {
      send("3 - a");
    }, 3);

    return () => {
      events.push("cleanup - a");
    };
  });

  const inputB = makeLiveValue<string, []>(() => (send) => {
    setTimeout(() => {
      send("2 - b");
    }, 2);

    setTimeout(() => {
      send("4 - b");
    }, 4);

    return () => {
      events.push("cleanup - b");
    };
  });

  const mostRecent = makeDerivedValue(() => {
    let lastA: string | null = null;
    let lastB: string | null = null;
    return () => {
      const a = inputA();
      const b = inputB();

      if (lastA !== a) {
        lastA = a;
        return a;
      }

      if (lastB !== b) {
        lastB = b;
        return b;
      }

      return a;
    };
  });

  const subscription = mostRecent.subscribe([], (v) => events.push(v));

  setTimeout(() => {
    subscription.close();

    expect(events).toEqual([
      "1 - a",
      "2 - b",
      "3 - a",
      "4 - b",
      "cleanup - a",
      "cleanup - b",
    ]);

    done();
  }, 10);
});
