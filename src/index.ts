export interface Template<Arguments extends any[], Result> {
  (...args: Arguments): Result;
  subscribe(args: Arguments, onValue: (v: Result) => void): void;
}

interface Stream<Result> {
  // template: Template<Arguments, Result>;
  // arguments: Arguments;
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

function getStream<Result>(
  templateDerive: Function,
  args: any[]
): Stream<Result> | undefined {
  return allStreams.find(s => {
    return s.derive === templateDerive && arrShallowEqual(args, s.args);
  });
}

function makeStream<Result>(
  templateDerive: Function,
  args: any[],
  name: string,
  notify: () => void
): Stream<Result> {
  const stream: Stream<Result> = {
    name,
    dependents: new Set(),
    derive: templateDerive,
    args,
    notify,
    lastValue: null as any,
  };

  allStreams.push(stream);

  return stream;
}

let currentlyEvaluatingStream: Stream<any> | null = null;

export function makeTemplate<Arguments extends any[], Result>(
  derive: (...args: Arguments) => Result,
  name: string
): Template<Arguments, Result> {
  const wrapper: Template<Arguments, Result> = (...args) => {
    let stream = getStream<Result>(derive, args);
    if (!stream) {
      stream = makeStream(derive, args, name, () => {
        const oldEvaluatingStream = currentlyEvaluatingStream;
        currentlyEvaluatingStream = stream!;
        stream!.lastValue = derive(...args);
        currentlyEvaluatingStream = oldEvaluatingStream;

        stream!.dependents.forEach(dependent => dependent.notify());
      });
    }

    if (currentlyEvaluatingStream) {
      stream.dependents.add(currentlyEvaluatingStream);
    } else {
      throw new Error('halp');
    }

    const oldEvaluatingStream = currentlyEvaluatingStream;
    currentlyEvaluatingStream = stream;
    stream.lastValue = derive(...args);
    currentlyEvaluatingStream = oldEvaluatingStream;

    return stream.lastValue;
  };

  wrapper.subscribe = (args, onValue) => {
    let stream = getStream<Result>(derive, args);
    if (!stream) {
      stream = makeStream(derive, args, name, () => {
        const lastEvaluatingStream = currentlyEvaluatingStream;
        currentlyEvaluatingStream = stream!;
        stream!.lastValue = derive(...args);
        currentlyEvaluatingStream = lastEvaluatingStream;
        onValue(stream!.lastValue);
      });
    }

    try {
      const lastEvaluatingStream = currentlyEvaluatingStream;
      currentlyEvaluatingStream = stream;
      stream.lastValue = derive(...args);
      currentlyEvaluatingStream = lastEvaluatingStream;
      onValue(stream.lastValue);
    } catch (error) {
      if (!error.then) {
        throw error;
      }

      error.then(() => {
        wrapper.subscribe(args, onValue);
      });
    }
  };

  return wrapper;
}

export function useState<T>(_initial: T): [T, (v: T) => void] {
  return null as any;
}

export function makeInput<T, Arguments extends any[]>(
  connect: (send: (v: T) => void) => (...args: Arguments) => void
): (...args: Arguments) => T {
  let lastValue: T | null = null;
  let hasValue = false;
  let resolve: (() => void) | null = null;

  let dependents = new Set<Stream<any>>();

  let isConnected = false;

  return function input(...args: Arguments) {
    if (!isConnected) {
      connect(v => {
        hasValue = true;
        lastValue = v;

        dependents.forEach(dependent => {
          dependent.notify();
        });

        resolve?.();
        resolve = null;
      })(...args);

      isConnected = true;
      if (currentlyEvaluatingStream) {
        dependents.add(currentlyEvaluatingStream);
      } else {
        throw new Error('halp');
      }
    }
    if (!hasValue) {
      throw new Promise<void>(_resolve => {
        resolve = _resolve;
      });
    }

    return lastValue!;
  };
}
