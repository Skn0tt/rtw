export interface LiveValue<Arguments extends any[], Result> {
  (...args: Arguments): Result;
  subscribe(args: Arguments, onValue: (v: Result) => void): void;
}

interface Stream<Result> {
  // template: Template<Arguments, Result>;
  // arguments: Arguments;
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

const allStreams: Stream<any>[] = [];

function findOrMakeStream<Result>({
  derive,
  args,
  name,
  notify,
}: Pick<
  Stream<Result>,
  "derive" | "args" | "name" | "notify"
>): Stream<Result> {
  const foundStream = allStreams.find((s) => {
    return s.derive === derive && arrShallowEqual(args, s.args);
  });

  if (foundStream) {
    return foundStream;
  }

  const stream: Stream<Result> = {
    name,
    dependents: new Set(),
    derive,
    args,
    notify,
    hasValue: false,
    lastValue: null as any,
  };

  allStreams.push(stream);

  return stream;
}

let currentlyEvaluatingStream: Stream<any> | null = null;

function withStream(stream: Stream<any>, doIt: () => void) {
  const oldEvaluatingStream = currentlyEvaluatingStream;
  currentlyEvaluatingStream = stream;
  doIt();
  currentlyEvaluatingStream = oldEvaluatingStream;
}

export function makeDerivedValue<Arguments extends any[], Result>(
  derive: (...args: Arguments) => Result,
  name: string
): LiveValue<Arguments, Result> {
  const wrapper: LiveValue<Arguments, Result> = (...args) => {
    const stream = findOrMakeStream<Result>({
      derive,
      args,
      name,
      notify() {
        const oldValue = stream.lastValue;
        withStream(stream, () => {
          stream.lastValue = derive(...args);
          stream.hasValue = true;
        });

        if (oldValue !== stream.lastValue) {
          stream.dependents.forEach((dependent) => dependent.notify());
        }
      },
    });

    if (currentlyEvaluatingStream) {
      stream.dependents.add(currentlyEvaluatingStream);
    } else {
      throw new Error("halp");
    }

    if (!stream.hasValue) {
      withStream(stream, () => {
        stream.lastValue = derive(...args);
        stream.hasValue = true;
      });
    }

    return stream.lastValue;
  };

  wrapper.subscribe = (args, onValue) => {
    const stream = findOrMakeStream<Result>({
      derive,
      args,
      name,
      notify() {
        const oldValue = stream.lastValue;
        withStream(stream, () => {
          stream.lastValue = derive(...args);
          stream.hasValue = true;
        });

        if (oldValue !== stream.lastValue) {
          onValue(stream.lastValue);
        }
      },
    });

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

export function useState<T>(_initial: T): [T, (v: T) => void] {
  return null as any;
}

export function makeLiveValue<T, Arguments extends any[]>(
  connect: (send: (v: T) => void) => (...args: Arguments) => void
): (...args: Arguments) => T {
  let lastValue: T | null = null;
  let hasValue = false;
  let resolve: (() => void) | null = null;

  let dependents = new Set<Stream<any>>();

  let isConnected = false;

  return function input(...args: Arguments) {
    if (!isConnected) {
      connect((v) => {
        hasValue = true;
        lastValue = v;

        dependents.forEach((dependent) => {
          dependent.notify();
        });

        resolve?.();
        resolve = null;
      })(...args);

      isConnected = true;
      if (currentlyEvaluatingStream) {
        dependents.add(currentlyEvaluatingStream);
      } else {
        throw new Error("halp");
      }
    }

    if (!hasValue) {
      throw new Promise<void>((_resolve) => {
        resolve = _resolve;
      });
    }

    return lastValue!;
  };
}
