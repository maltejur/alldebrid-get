#!/usr/bin/node

import { Command } from "commander";
import ora from "ora";
import colors from "@colors/colors";
import * as alldebrid from "./alldebrid.js";
import prompts from "prompts";
import { exit } from "process";
import { humanSize } from "./utils.js";
import { DownloaderHelper } from "node-downloader-helper";
import fs, { existsSync } from "fs";
import { version } from "../package.json";

const program = new Command();

program
  .name("alldebrid-get")
  .description("Get magnet links easily from alldebrid.com")
  .version(version);

function login() {
  return new Promise<void>(async (resolve, reject) => {
    let spinner = ora("Obtaining login PIN").start();
    const { pin, check, user_url, expires_in } = await alldebrid.getPin();
    spinner.stop();
    console.log(
      `Your login PIN is ${colors.bold.yellow(pin.yellow)}
Please visit ${user_url.cyan.underline} to login`
    );
    spinner = ora("Waiting for PIN confirmation").start();
    const interval = setInterval(async () => {
      const { apikey } = await alldebrid.checkPin(check, pin);
      if (apikey) {
        clearInterval(interval);
        clearTimeout(timeout);
        spinner.succeed("Login successful");
        resolve();
      }
    }, 2000);
    const timeout = setTimeout(() => {
      clearInterval(interval);
      spinner.fail("Login timed out");
      exit(1);
    }, expires_in * 1000);
  });
}

program.command("login").description("Login to alldebrid.com").action(login);

program
  .argument("<magnet_link>", "Magnet link")
  .option(
    "-O <output>|-o <output>|--output <output>",
    "Alternative output folder"
  )
  .action(async (magnet_link) => {
    const options = program.opts();
    if (!(await alldebrid.isLoggedIn())) {
      const answer = await prompts({
        type: "confirm",
        message: "You are not logged in, do you want to login now?",
        name: "login",
      });
      if (answer.login) await login();
      else exit();
    }

    let spinner = ora("Submitting magnet to alldebrid.com").start();
    const response = await alldebrid.uploadMagnet(magnet_link);
    if (response.magnets[0].error) {
      spinner.fail(
        `${"alldebrid error:".gray} ${response.magnets[0].error.message}`
      );
      exit(1);
    }
    spinner.stop();
    spinner = ora(
      `${colors.dim(response.magnets[0].name + ":")} Checking magnet status`
    ).start();
    const interval = setInterval(() => {
      alldebrid.magnetStatus(response.magnets[0].id).then(async (response) => {
        const magnet = response.magnets;
        let message = `${colors.dim(magnet.filename + ":")} ${magnet.status}`;
        // Downloading to alldebrid.com
        if (magnet.statusCode === 1) {
          message += " to alldebrid.com (";
          message += ((100 * magnet.downloaded) / magnet.size).toFixed(0);
          message += `%, ${humanSize(magnet.downloaded)}/${humanSize(
            magnet.size
          )}`;
          message += `, ${humanSize(magnet.downloadSpeed)}/s)`;
        }
        // Uploading from alldebrid.com
        if (magnet.statusCode === 3) {
          message += " from alldebrid.com (";
          message += ((100 * magnet.uploaded) / magnet.size).toFixed(0);
          message += `%, ${humanSize(magnet.uploaded)}/${humanSize(
            magnet.size
          )}`;
          message += `, ${humanSize(magnet.uploadSpeed)}/s)`;
        }
        spinner.text = message;
        if (magnet.statusCode > 4) {
          spinner.fail("alldebrid error: ".gray + magnet.status);
          exit(1);
        } else if (magnet.statusCode === 4) {
          clearInterval(interval);
          spinner.stop();
          spinner = ora(
            `${magnet.filename.dim}: Creating download link${
              magnet.links.length > 1 ? "s" : ""
            }`
          ).start();
          const links = await Promise.all(
            magnet.links.map((link) => alldebrid.unlockLink(link.link))
          );
          spinner.stop();
          spinner = ora(`${magnet.filename.dim}: Downloading to PC`).start();
          let i = 1;
          for (const link of links) {
            await new Promise<void>(async (resolve) => {
              const downloadFolder =
                options.o || options.O || options.output || ".";

              if (!existsSync(downloadFolder))
                await fs.promises.mkdir(downloadFolder, { recursive: true });

              const download = new DownloaderHelper(link.link, downloadFolder);

              download.on("progress", (stats) => {
                spinner.text = `${colors.dim(
                  link.filename +
                    (links.length > 1 ? ` (${i}/${links.length})` : "") +
                    ":"
                )} Downloading to PC (${(
                  (100 * stats.downloaded) /
                  stats.total
                ).toFixed(0)}%, ${humanSize(stats.downloaded)}/${humanSize(
                  stats.total
                )}, ${humanSize(stats.speed)}/s)`;
                if (stats.downloaded == stats.total) resolve();
              });
              download.on("end", () => resolve());
              download.on("error", (stats) => {
                spinner.fail(
                  `${colors.gray("download error:")} ${stats.message}`
                );
                exit(1);
              });

              download.start();
            });
            i += 1;
          }
          spinner.succeed(
            `Downloaded ${colors.bold(magnet.filename)} successfully (${
              links.length
            } files)`
          );
          console.log();
        }
      });
    }, 1000);
  });

program.parse();
