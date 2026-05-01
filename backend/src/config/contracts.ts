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

/**
 * Load contract addresses from environment variables first,
 * falling back to shared-config.json for local development.
 */
export function loadSharedConfig(): SharedConfig {
  // Production: read from environment variables
  if (process.env.CREDENTIAL_NFT_ADDRESS && process.env.REPUTATION_TOKEN_ADDRESS) {
    return {
      contracts: {
        credentialNFT: process.env.CREDENTIAL_NFT_ADDRESS,
        reputationToken: process.env.REPUTATION_TOKEN_ADDRESS,
      },
      network: {
        chainId: parseInt(process.env.CHAIN_ID || "11155111", 10),
        name: process.env.NETWORK_NAME || "sepolia",
      },
    };
  }

  // Local development: read from shared-config.json
  const raw = fs.readFileSync(SHARED_CONFIG_PATH, "utf-8");
  return JSON.parse(raw) as SharedConfig;
}

export function getContractAddresses(): ContractAddresses {
  const config = loadSharedConfig();
  return config.contracts;
}
