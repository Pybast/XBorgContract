import { ethers } from "hardhat";

async function main() {

  const ECDSA = await ethers.getContractFactory("ECDSALibrary");
  const ecdsa = await ECDSA.deploy();
  await ecdsa.deployed();

  const XBORG = await ethers.getContractFactory("Xborg", {
    libraries: {
      ECDSALibrary: ecdsa.address
    }
  });
  const xborg = await XBORG.deploy();
  await xborg.deployed();

  console.log("Xborg contract deployed on:", xborg.address);
}

// We recommend this pattern to be able to use async/await everywhere
// and properly handle errors.
main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
