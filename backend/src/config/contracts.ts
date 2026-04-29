import path from "path";
import fs from "fs";

export interface ContractAddresses {
  credentialNFT: string;
  reputationToken: string;
}

export interface NetworkConfig {
  chainId: number;
  name: string;
}

export interface SharedConfig {
  contracts: ContractAddresses;
  network: NetworkConfig;
}

const SHARED_CONFIG_PATH = path.resolve(
  __dirname,
  "../../../shared-config.json"
);

export function loadSharedConfig(): SharedConfig {
  const raw = fs.readFileSync(SHARED_CONFIG_PATH, "utf-8");
  return JSON.parse(raw) as SharedConfig;
}

export function getContractAddresses(): ContractAddresses {
  const config = loadSharedConfig();
  return config.contracts;
}
