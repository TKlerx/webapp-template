// MIT-licensed analysis fixture. Never execute or deploy this file.
import express from "express";
import { unsafeShell, safeProgram } from "./wrappers";

const app = express();
app.get("/unsafe", (request, response) => {
  unsafeShell(request.query.command as string);
  response.end("done");
});
app.get("/safe", (request, response) => {
  safeProgram(request.query.argument as string);
  response.end("done");
});
