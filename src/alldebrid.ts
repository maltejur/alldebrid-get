import axios from "axios";
import fs from "fs";
import path from "path";
import { exit } from "process";
import colors from "@colors/colors";

let apikey: string | undefined;

const agent = "alldebrid-get";
const appdataFolder = path.join(
  process.env.APPDATA ||
    (process.platform == "darwin"
      ? process.env.HOME + "/Library/Preferences"
      : process.env.HOME + "/.local/share"),
  "alldebrid-get"
);
if (!fs.existsSync(appdataFolder))
  fs.mkdirSync(appdataFolder, { recursive: true });
const configFile = path.join(appdataFolder, "config.json");
axios.defaults.baseURL = "https://api.alldebrid.com/v4";

export function loadConfig() {
  if (!fs.existsSync(configFile)) fs.writeFileSync(configFile, "{}");
  const config = JSON.parse(fs.readFileSync(configFile).toString());
  apikey = config.apikey;
}

export async function updateConfig(changes: Object) {
  let config = JSON.parse((await fs.promises.readFile(configFile)).toString());
  config = { ...config, ...changes };
  apikey = config.apikey;
  await fs.promises.writeFile(configFile, JSON.stringify(config));
}

async function get(
  path: string,
  { params }: { params?: Record<string, any> } = {}
) {
  const response = await axios.get(path, {
    params: { agent, ...(apikey ? { apikey } : {}), ...params },
  });
  const { status, data, error } = response.data;
  if (status === "success") return data;
  else if (status === "error" && error) {
    console.error(`\r${"✖ ".red}${"\ralldebrid error:".gray} ${error.message}`);
    exit(1);
  } else throw Error(JSON.stringify(error || response.data));
}

export interface GetPinResponse {
  pin: string;
  check: string;
  expires_in: number;
  user_url: string;
  base_url: string;
  check_url: string;
}
export async function getPin(): Promise<GetPinResponse> {
  return get("/pin/get");
}

export interface CheckPinResponse {
  activated: boolean;
  expires_in: number;
  apikey?: string;
}
export async function checkPin(
  check: string,
  pin: string
): Promise<CheckPinResponse> {
  const response: CheckPinResponse = await get("/pin/check", {
    params: { check, pin },
  });
  if (response.apikey) {
    await updateConfig({ apikey: response.apikey });
  }
  return response;
}

export async function isLoggedIn() {
  if (!apikey) return false;
  const response = await axios.get("/user", { params: { agent, apikey } });
  return response.data.status === "success";
}

export interface PartialMagnet {
  magnet: string;
  name: string;
  id: number;
  hash: string;
  size: number;
  ready: boolean;
  error?: { code: string; message: string };
}
export interface UploadMagentResponse {
  magnets: PartialMagnet[];
}
export async function uploadMagnet(
  magnet: string
): Promise<UploadMagentResponse> {
  return get("/magnet/upload", { params: { "magnets[]": magnet } });
}

export interface Magnet {
  id: number;
  filename: string;
  size: number;
  status: string;
  statusCode: number;
  downloaded: number;
  uploaded: number;
  seeders: number;
  downloadSpeed: number;
  uploadSpeed: number;
  uploadDate: number;
  completionDate: number;
  links: {
    link: string;
    filename: string;
    size: number;
    files: unknown[];
  }[];
}
export interface MagnetStatusResponse {
  magnets: Magnet;
}
export async function magnetStatus(id?: number): Promise<MagnetStatusResponse> {
  return get("/magnet/status", { params: { ...(id ? { id } : {}) } });
}

export interface UnlockLinkResponse {
  link: string;
  host: string;
  filename: string;
  paws: boolean;
  filesize: number;
  streams: {
    id: string;
    ext: string;
    quality: string | number;
    filesize: number;
    proto: string;
    name?: string;
    tb?: number;
    abr?: number;
  }[];
  id: string;
  hostDomain: string;
}
export async function unlockLink(link: string): Promise<UnlockLinkResponse> {
  return get("/link/unlock", { params: { link } });
}

loadConfig();
