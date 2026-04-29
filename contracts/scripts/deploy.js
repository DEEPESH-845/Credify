const hre = require("hardhat");
const fs = require("fs");
const path = require("path");

const SHARED_CONFIG_PATH = path.resolve(__dirname, "../../shared-config.json");

async function main() {
  const [deployer] = await hre.ethers.getSigners();
  const network = await hre.ethers.provider.getNetwork();

  console.log("Deploying contracts with account:", deployer.address);
  console.log(
    "Account balance:",
    hre.ethers.formatEther(await hre.ethers.provider.getBalance(deployer.address))
  );
  console.log("Network:", network.name, "(chainId:", network.chainId.toString(), ")");
  console.log("---");

  // 1. Deploy CredentialNFT
  console.log("Deploying CredentialNFT...");
  const CredentialNFT = await hre.ethers.getContractFactory("CredentialNFT");
  const credentialNFT = await CredentialNFT.deploy();
  await credentialNFT.waitForDeployment();
  const credentialNFTAddress = await credentialNFT.getAddress();
  console.log("CredentialNFT deployed to:", credentialNFTAddress);

  // 2. Deploy ReputationToken
  console.log("Deploying ReputationToken...");
  const ReputationToken = await hre.ethers.getContractFactory("ReputationToken");
  const reputationToken = await ReputationToken.deploy();
  await reputationToken.waitForDeployment();
  const reputationTokenAddress = await reputationToken.getAddress();
  console.log("ReputationToken deployed to:", reputationTokenAddress);

  console.log("---");

  // 3. Write deployed addresses to shared config
  const sharedConfig = {
    contracts: {
      credentialNFT: credentialNFTAddress,
      reputationToken: reputationTokenAddress,
    },
    network: {
      chainId: Number(network.chainId),
      name: network.name === "unknown" ? "localhost" : network.name,
    },
  };

  fs.writeFileSync(SHARED_CONFIG_PATH, JSON.stringify(sharedConfig, null, 2) + "\n");
  console.log("Shared config written to:", SHARED_CONFIG_PATH);
  console.log(JSON.stringify(sharedConfig, null, 2));
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("Deployment failed:", error);
    process.exit(1);
  });
