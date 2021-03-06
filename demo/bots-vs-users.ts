import { makeDerivedValue, makeLiveValue } from "../src";
import https from "https";

interface WikiEvent {
  user: string;
  bot: boolean;
  minor: boolean;
}

const wiki = makeLiveValue<WikiEvent, []>(() => (send) => {
  const request = https.get(
    "https://stream.wikimedia.org/v2/stream/recentchange",
    (res) => {
      res.on("data", (buf: Buffer) => {
        const line = buf.toString();
        if (line.startsWith("data:")) {
          const json = line.slice("data: ".length);
          try {
            if (Math.random() < 0.5) {
              send(JSON.parse(json));
            }
          } catch (error) {
            // do nothing
          }
        }
      });
    }
  );

  return () => {
    request.destroy();
  };
});

const mostActiveUsers = makeDerivedValue(() => {
  const record: Record<string, number> = {};
  return () => {
    const action = wiki();
    record[action.user] = (record[action.user] ?? 0) + 1;
    return record;
  };
});

function arrShallowEqual(a: any[], b: any[]): boolean {
  return a.length === b.length && a.every((value, index) => value === b[index]);
}

const top10ActiveUsers = makeDerivedValue(
  () => () => {
    return Object.entries(mostActiveUsers())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .map(([username]) => username);
  },
  {
    propagate(a, b) {
      return !arrShallowEqual(a, b);
    },
  }
);

const numberOfBotEdits = makeDerivedValue(
  () => {
    let count = 0;
    return () => {
      const action = wiki();
      if (action.bot) {
        count++;
      }
      return count;
    };
  },
  {
    propagate: (a, b) => a !== b,
  }
);

const numberOfHumanEdits = makeDerivedValue(
  () => {
    let count = 0;
    return () => {
      const action = wiki();
      if (!action.bot) {
        count++;
      }
      return count;
    };
  },
  {
    propagate: (a, b) => a !== b,
  }
);

const botsVsHumans = makeDerivedValue(
  () => () => {
    const human = numberOfHumanEdits();
    const bots = numberOfBotEdits();

    return bots / (human + bots);
  },
  {
    propagate: (a, b) => a !== b,
  }
);

const sub = botsVsHumans.subscribe([], (value) => {
  console.log(value);
});

setTimeout(() => {
  sub.close();
}, 10000);
