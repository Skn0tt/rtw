export interface LiveValue<Arguments extends any[], Result> {
  (...args: Arguments): Result;
  subscribe(args: Arguments, onValue: (v: Result) => void): void;
}

interface Stream<Result> {
  hasValue: boolean;
  lastValue: Result;
  notify(): void;
  dependents: Set<Stream<any>>;
  derive: Function;
  args: any[];
  name: string;
}

function arrShallowEqual(a: any[], b: any[]) {
  return a.length === b.length && a.every((value, index) => b[index] === value);
}

let currentlyEvaluatingStream: Stream<any> | null = null;

function withStream(stream: Stream<any>, doIt: () => void) {
  const oldEvaluatingStream = currentlyEvaluatingStream;
  currentlyEvaluatingStream = stream;
  doIt();
  currentlyEvaluatingStream = oldEvaluatingStream;
}

export function makeDerivedValue<Arguments extends any[], Result>(
  makeDerive: (...args: Arguments) => () => Result,
  name: string
): LiveValue<Arguments, Result> {
  const wrapper: LiveValue<Arguments, Result> = (...args) => {
    const stream = findOrMakeStream(
      {
        args,
        name,
        notify() {
          withStream(stream, () => {
            stream.lastValue = stream.derive();
            stream.hasValue = true;
          });

          stream.dependents.forEach((dependent) => dependent.notify());
        },
      },
      makeDerive
    );

    if (currentlyEvaluatingStream) {
      stream.dependents.add(currentlyEvaluatingStream);
    } else {
      throw new Error("halp");
    }

    if (!stream.hasValue) {
      withStream(stream, () => {
        stream.lastValue = stream.derive();
        stream.hasValue = true;
      });
    }

    return stream.lastValue;
  };

  const streams: Stream<Result>[] = [];
  function findOrMakeStream(
    { args, name, notify }: Pick<Stream<Result>, "args" | "name" | "notify">,
    makeDerive: (...args: Arguments) => () => Result
  ): Stream<Result> {
    const foundStream = streams.find((s) => {
      return arrShallowEqual(args, s.args);
    });

    if (foundStream) {
      return foundStream;
    }

    const stream: Stream<Result> = {
      name,
      dependents: new Set(),
      derive: makeDerive(...(args as any)),
      args,
      notify,
      hasValue: false,
      lastValue: null as any,
    };
    streams.push(stream);
    return stream;
  }
  wrapper.subscribe = (args, onValue) => {
    const stream = findOrMakeStream(
      {
        args,
        name,
        notify() {
          withStream(stream, () => {
            stream.lastValue = stream.derive();
            stream.hasValue = true;
          });

          onValue(stream.lastValue);
        },
      },
      makeDerive
    );

    try {
      stream.notify();
    } catch (error) {
      if (!error.then) {
        throw error;
      }
    }
  };

  return wrapper;
}

export function makeLiveValue<T, Arguments extends any[]>(
  connect: (...args: Arguments) => (send: (v: T) => void) => void
): (...args: Arguments) => T {
  let lastValue: T | null = null;
  let hasValue = false;
  let resolve: (() => void) | null = null;

  let dependents = new Set<Stream<any>>();

  let isConnected = false;

  return function input(...args: Arguments) {
    if (!isConnected) {
      connect(...args)((v) => {
        hasValue = true;
        lastValue = v;

        dependents.forEach((dependent) => {
          dependent.notify();
        });

        resolve?.();
        resolve = null;
      });

      isConnected = true;
    }

    if (currentlyEvaluatingStream) {
      dependents.add(currentlyEvaluatingStream);
    } else {
      throw new Error("halp");
    }

    if (!hasValue) {
      throw new Promise<void>((_resolve) => {
        resolve = _resolve;
      });
    }

    return lastValue!;
  };
}
