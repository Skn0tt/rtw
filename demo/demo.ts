import { makeDerivedValue, makeLiveValue } from "../src";

interface WikipediaEvent {
  type: "change" | "other";
  username: string;
  page: string;
}

const wiki = makeLiveValue<WikipediaEvent, []>(() => (send) => {
  setTimeout(() => {
    setInterval(() => {
      send({
        type: "change",
        username: "paul",
        page: "Hallo Welt",
      });
    }, 1000);
  }, 100);

  return () => {
    // req.end();
  };
});

interface AuthResult {
  role: "customer" | "admin";
}

const auth = makeLiveValue<AuthResult, [AuthContext]>((ctx) => (send) => {
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

const bestenliste = makeDerivedValue((ctx: AuthContext) => {
  const bestenliste: Record<string, number> = {};

  return () => {
    const authdata = auth(ctx);
    if (authdata.role !== "admin") {
      throw new Error("Unauthorized");
    }

    const wikidata = wiki();
    if (wikidata.type === "change") {
      bestenliste[wikidata.username] =
        (bestenliste[wikidata.username] ?? 0) + 1;
    }

    return bestenliste;
  };
}, "bestenliste");

const top100 = makeDerivedValue(
  (ctx: AuthContext) => () => {
    const v = bestenliste(ctx);

    return Object.entries(v)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 100)
      .map(([username, score]) => ({ username, score }));
  },
  "top100"
);

interface AuthContext {
  userId: string;
}

const top10 = makeDerivedValue(
  (auth: AuthContext) => () => {
    return top100(auth).slice(0, 10);
  },
  "top10"
);

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
