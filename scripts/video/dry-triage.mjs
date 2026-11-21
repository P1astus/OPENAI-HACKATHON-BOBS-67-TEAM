// Local Responses API fixture. Only the three scripted model inputs are accepted.
import { createServer } from "node:http";
import { setTimeout as pause } from "node:timers/promises";

const fixtures = [
  {
    suffix: "Report: The heating is cold in every room since this morning.",
    trade: "heating",
    urgency: "urgent",
    summary: "Heating has been cold in every room since this morning.",
  },
  {
    suffix: "Report: I'm locked out, the key broke off in the front door lock.",
    trade: "locksmith",
    urgency: "urgent",
    summary: "Key broke off in the front door lock, leaving the flat inaccessible.",
  },
  {
    suffix: "Clarification from the owner: Called Lena: the hallway radiator is ice cold.",
    trade: "heating",
    urgency: "normal",
    summary: "The hallway radiator is ice cold.",
  },
];

const server = createServer({ requestTimeout: 10_000 }, async (request, response) => {
  const send = (status, body) => {
    response.writeHead(status, { "content-type": "application/json" });
    response.end(JSON.stringify(body));
  };
  if (request.method !== "POST" || request.url !== "/v1/responses") {
    send(404, { error: { message: "Expected POST /v1/responses." } });
    return;
  }

  try {
    const chunks = [];
    let size = 0;
    for await (const chunk of request) {
      size += chunk.length;
      if (size > 32_768) {
        send(413, { error: { message: "Fixture request exceeded 32 KiB." } });
        return;
      }
      chunks.push(chunk);
    }
    const body = JSON.parse(Buffer.concat(chunks).toString("utf8"));
    const input = body.input?.at(-1)?.content;
    const fixture = fixtures.find(({ suffix }) => typeof input === "string" && input.endsWith(suffix));
    if (body.text?.format?.name !== "triage" || !fixture) {
      send(422, { error: { message: "No fixture for this triage input." } });
      return;
    }

    const { trade, urgency, summary } = fixture;
    // Give the app's own progress labels time to appear.
    await pause(2400);
    send(200, {
      id: "resp_centrix_dry_run",
      object: "response",
      status: "completed",
      output: [{
        id: "msg_centrix_dry_run",
        type: "message",
        role: "assistant",
        status: "completed",
        content: [{
          type: "output_text",
          annotations: [],
          text: JSON.stringify({ trade, urgency, summary, confidence: 0.98, is_repair: true }),
        }],
      }],
    });
  } catch {
    send(400, { error: { message: "Invalid fixture request." } });
  }
});

server.listen(3156, "127.0.0.1", () => {
  console.log("Pitch triage fixture listening at http://127.0.0.1:3156/v1");
});
