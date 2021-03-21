import { makeDerivedValue, makeLiveValue, useState } from "../src";

interface WikipediaEvent {
  type: "change" | "other";
  username: string;
  page: string;
}

const wiki = makeLiveValue<WikipediaEvent, []>((send) => () => {
  /*
  send({
    type: 'change',
    username: 'paul',
    page: 'Hallo Welt',
  });
  */

  setTimeout(() => {
    setInterval(() => {
      send({
        type: "change",
        username: "paul",
        page: "Hallo Welt",
      });
    }, 1000);
  }, 100);

  /*
  setInterval(() => {
    send({
      type: 'change',
      username: 'thomas',
      page: 'Hallo Welt',
    });
  }, 3000);
  */

  /*
  const req = https.get(
    'https://stream.wikimedia.org/v2/stream/recentchange',
    res => {
      res.on('data', data => {
        // console.log(data.toString());
        send({
          type: 'change',
          username: 'paul',
          page: 'Hallo Welt',
        });
      });
    }
  );
  */

  return () => {
    // req.end();
  };
});

interface AuthResult {
  role: "customer" | "admin";
}

const auth = makeLiveValue<AuthResult, [AuthContext]>((send) => (ctx) => {
  if (ctx.userId === "bert") {
    send({
      role: "admin",
    });
  } else {
    send({
      role: "customer",
    });
  }
});

interface WikipediaUser {
  username: string;
}

// let _bestenliste: Record<string, number> = {};

const bestenliste = makeDerivedValue((ctx: AuthContext) => {
  const authdata = auth(ctx);
  if (authdata.role !== "admin") {
    throw new Error("Unauthorized");
  }

  const wikidata = wiki();
  const [bestenliste, setBestenliste] = useState<Record<string, number>>({});
  if (wikidata.type === "change") {
    setBestenliste(({
      ...bestenliste,
      [wikidata.username]: (bestenliste[wikidata.username] ?? 0) + 1
    }))
  }

  // console.log({bestenliste})

  return bestenliste;
}, "bestenliste");

const top100 = makeDerivedValue((ctx: AuthContext) => {
  const v = bestenliste(ctx);

  return Object.entries(v)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 100)
    .map(([username, score]) => ({ username, score }));
}, "top100");

interface AuthContext {
  userId: string;
}

const top10 = makeDerivedValue((auth: AuthContext): WikipediaUser[] => {
  const v = top100(auth);
  return v.slice(0, 10);
}, "top10");

top10.subscribe(
  [
    {
      userId: "bert",
    },
  ],
  (top10) => {
    console.log(top10);
  }
);
