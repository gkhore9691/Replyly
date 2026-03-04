#!/usr/bin/env node

import { Command } from "commander";
import { createLoginCommand } from "./commands/login";
import { createLogoutCommand } from "./commands/logout";
import { createProjectsCommand } from "./commands/projects";
import { createEventsCommand } from "./commands/events";
import { createReplayCommand } from "./commands/replay";
import { createTailCommand } from "./commands/tail";

const program = new Command();

program
  .name("replayly")
  .description("Replayly CLI - Replay production requests locally")
  .version("0.1.0");

program.addCommand(createLoginCommand());
program.addCommand(createLogoutCommand());
program.addCommand(createProjectsCommand());
program.addCommand(createEventsCommand());
program.addCommand(createReplayCommand());
program.addCommand(createTailCommand());

program.parse();
