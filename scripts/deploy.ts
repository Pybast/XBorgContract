import { ethers } from "hardhat";

async function main() {

  const ECDSA = await ethers.getContractFactory("ECDSALibrary");
  const ecdsa = await ECDSA.deploy();
  await ecdsa.deployed();

  const ANKH = await ethers.getContractFactory("Ankh", {
    libraries: {
      ECDSALibrary: ecdsa.address
    }
  });
  const ankh = await ANKH.deploy();
  await ankh.deployed();

  console.log("Ankh contract deployed on:", ankh.address);
}

// We recommend this pattern to be able to use async/await everywhere
// and properly handle errors.
main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
