export interface LiveValue<Arguments extends any[], Result> {
  (...args: Arguments): Result;
  subscribe(args: Arguments, onValue: (v: Result) => void): void;
}

interface Evaluatable {
  evaluate(): void;
}

interface Stream<Result> extends Evaluatable {
  hasValue: boolean;
  lastValue: Result;
  children: Set<Evaluatable>;
  derive(): Result;
  args: any[];
}

function arrShallowEqual(a: any[], b: any[]) {
  return a.length === b.length && a.every((value, index) => b[index] === value);
}

let currentlyEvaluatingStream: Stream<any> | null = null;

function deriveStream(stream: Stream<any>) {
  const oldEvaluatingStream = currentlyEvaluatingStream;
  currentlyEvaluatingStream = stream;

  stream.lastValue = stream.derive();
  stream.hasValue = true;

  currentlyEvaluatingStream = oldEvaluatingStream;
}

export function makeDerivedValue<Result, Arguments extends any[]>(
  makeDerive: (...args: Arguments) => () => Result
): LiveValue<Arguments, Result> {
  const streams: Stream<Result>[] = [];
  function findOrMakeStream(args: Stream<any>["args"]): Stream<Result> {
    const foundStream = streams.find((s) => {
      return arrShallowEqual(args, s.args);
    });

    if (foundStream) {
      return foundStream;
    }

    const stream: Stream<Result> = {
      children: new Set(),
      derive: makeDerive(...(args as any)),
      args,
      evaluate() {
        try {
          deriveStream(stream);
          stream.children.forEach((dependent) => dependent.evaluate());
        } catch (error) {
          if (!error.then) {
            throw error;
          }
        }
      },
      hasValue: false,
      lastValue: null as any,
    };
    streams.push(stream);
    return stream;
  }

  const wrapper: LiveValue<Arguments, Result> = (...args) => {
    if (!currentlyEvaluatingStream) {
      throw new Error("halp");
    }

    const stream = findOrMakeStream(args);
    stream.children.add(currentlyEvaluatingStream);

    if (!stream.hasValue) {
      deriveStream(stream);
    }

    return stream.lastValue;
  };

  wrapper.subscribe = (args, onValue) => {
    const stream = findOrMakeStream(args);

    stream.children.add({
      evaluate() {
        onValue(stream.lastValue);
      },
    });

    stream.evaluate();
  };

  return wrapper;
}

interface LiveValueInstance<Result, Arguments> {
  args: Arguments;
  children: Set<Evaluatable>;
  lastValue: Result;
  hasValue: boolean;
  resolve?: () => void;
}

export function makeLiveValue<Result, Arguments extends any[]>(
  connect: (...args: Arguments) => (send: (v: Result) => void) => void
): LiveValue<Arguments, Result> {
  const instances: LiveValueInstance<Result, Arguments>[] = [];
  function findOrMakeInstance(
    args: Arguments
  ): LiveValueInstance<Result, Arguments> {
    const found = instances.find((i) => {
      return arrShallowEqual(args, i.args);
    });

    if (found) {
      return found;
    }

    const instance: LiveValueInstance<Result, Arguments> = {
      children: new Set(),
      args,
      hasValue: false,
      lastValue: null as any,
    };
    instances.push(instance);

    function send(value: Result) {
      instance.hasValue = true;
      instance.lastValue = value;

      instance.children.forEach((dependent) => {
        dependent.evaluate();
      });

      instance.resolve?.();
      instance.resolve = undefined;
    }

    connect(...args)(send);

    return instance;
  }

  const input: LiveValue<Arguments, Result> = (...args) => {
    if (!currentlyEvaluatingStream) {
      throw new Error("halp");
    }

    const instance = findOrMakeInstance(args);
    instance.children.add(currentlyEvaluatingStream);

    if (!instance.hasValue) {
      throw new Promise<void>((_resolve) => {
        instance.resolve = _resolve;
      });
    }

    return instance.lastValue;
  };

  input.subscribe = (args, onValue) => {
    const instance = findOrMakeInstance(args);
    instance.children.add({
      evaluate() {
        onValue(instance.lastValue);
      },
    });
  };

  return input;
}
