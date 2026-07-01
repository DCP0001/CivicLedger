import { ethers } from "hardhat";

async function main() {
  const [deployer] = await ethers.getSigners();

  console.log("Deploying contract with the account:", deployer.address);
  console.log("Account balance:", (await deployer.provider.getBalance(deployer.address)).toString());

  const SecureVote = await ethers.getContractFactory("SecureVote");
  const secureVote = await SecureVote.deploy();

  await secureVote.waitForDeployment();

  const contractAddress = await secureVote.getAddress();
  console.log("SecureVote contract deployed to:", contractAddress);
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
