import axios from "axios";
import fs from "fs";

let apikey: string | undefined;

const agent = "alldebrid-get";
axios.defaults.baseURL = "https://api.alldebrid.com/v4";

export function loadConfig() {
  if (!fs.existsSync("./config.json")) fs.writeFileSync("./config.json", "{}");
  const config = JSON.parse(fs.readFileSync("./config.json").toString());
  apikey = config.apikey;
}

export async function updateConfig(changes: Object) {
  let config = JSON.parse(
    (await fs.promises.readFile("./config.json")).toString()
  );
  config = { ...config, ...changes };
  apikey = config.apikey;
  await fs.promises.writeFile("./config.json", JSON.stringify(config));
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
  const response = await axios.get("/pin/get", {
    params: { agent },
  });
  const { status, data } = response.data;
  if (status === "success") return data;
  else throw Error(JSON.stringify(data?.error || response.data));
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
  const response = await axios.get("/pin/check", {
    params: { agent, check, pin },
  });
  const { status, data } = response.data;
  if (status === "success") {
    if (data.apikey) {
      await updateConfig({ apikey: data.apikey });
    }
    return data;
  } else throw Error(JSON.stringify(data?.error || response.data));
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
  const response = await axios.get("/magnet/upload", {
    params: { agent, apikey, "magnets[]": magnet },
  });
  const { status, data } = response.data;
  if (status === "success") return data;
  else throw Error(JSON.stringify(data?.error || response.data));
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
  const response = await axios.get("/magnet/status", {
    params: { agent, apikey, ...(id ? { id } : {}) },
  });
  const { status, data } = response.data;
  if (status === "success") return data;
  else throw Error(JSON.stringify(data?.error || response.data));
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
  const response = await axios.get("/link/unlock", {
    params: { agent, apikey, link },
  });
  const { status, data } = response.data;
  if (status === "success") return data;
  else throw Error(JSON.stringify(data?.error || response.data));
}

loadConfig();
