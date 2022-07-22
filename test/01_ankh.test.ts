import { time, loadFixture } from "@nomicfoundation/hardhat-network-helpers";
import { anyValue } from "@nomicfoundation/hardhat-chai-matchers/withArgs";
import { expect } from "chai";
import { ethers, network } from "hardhat";
import { json } from "hardhat/internal/core/params/argumentTypes";
const fetch = require("node-fetch");

const error = {
  "ownable": "Ownable: caller is not the owner",
  "Can not increase supply": "A6",
  "Mint has not started yet": "A4",
  "Wrong price": "A1",
  "Trying to mint too many tokens": "A2",
  "Max supply has been reached": "A3",
  "Wrong signature": "A5",
  "Can not set max supply under the current supply": "A7",
  "You don't own this token": "A8",
  "URI has been frozen": "A10",
  "No shares for this account": "A11",
  "No remaining payment": "A12"
}

const accessControlRevert = (address : string) => {
  return `AccessControl: account ${address.toLowerCase()} is missing role 0x0000000000000000000000000000000000000000000000000000000000000000`
}

const roles = {
  "ADMIN": "0x0000000000000000000000000000000000000000000000000000000000000000",
  "SIGNER": "0xe2f4eaae4a9751e85a3e4a7b9587827a877f29914755229b07a7b2da98285f70",
  "FREE_SIGNER": "0xc0d53b6b38dafcad2617ec1d5660bc901206f6e857c2d4538ad90ae7220802f5"
}

const SIGNER_ADDRESS = "0x3A19c2a585CC0a1d4e46589B546B811f927D1C9F";

const prices = {
  og: "200000000000000000",
  whitelist: "200000000000000000",
  public: "250000000000000000"
}

const stakeHolders = [
  {
    // ANKH
    address: "0x1111111111111111111111111111111111111111",
    shares: 905
  },
  {
    // PARTNER
    address: "0x89eE264B58972a85040E027B78B4Cf3cFa8694C4",
    shares: 70
  },
  {
    // NEFTURE
    address: "0x06440798CCBf8aD53046D50F048816a2fF502B84",
    shares: 25
  }
]

describe("Ankh", function () {
  // We define a fixture to reuse the same setup in every test.
  // We use loadFixture to run this setup once, snapshot that state,
  // and reset Hardhat Network to that snapshopt in every test.
  async function deployAnkhContract() {

    // Contracts are deployed using the first signer/account by default
    const [owner, minter, ogMinter] = await ethers.getSigners();

    const ECDSA = await ethers.getContractFactory("ECDSALibrary");
    const ecdsa = await ECDSA.deploy();

    const ANKH = await ethers.getContractFactory("Ankh", {
      libraries: {
        ECDSALibrary: ecdsa.address
      }
    });
    const ownerAnkh = await ANKH.deploy();
    const minterAnkh = await ownerAnkh.connect(minter);
    const ogMinterAnkh = await ownerAnkh.connect(ogMinter);

    return { ownerAnkh, minterAnkh, ogMinterAnkh, owner, minter, ogMinter };
  }

  describe("Deployment", function () {
    // Deploys and checks if the contract is setup correctly
    it("Can deploy contracts", async () => {
      const { ownerAnkh, owner, minter } = await loadFixture(deployAnkhContract);

      expect(ownerAnkh.address).to.not.be.undefined;
    });

    it("Interfaces are set correctly", async () => {
      const { ownerAnkh, owner, minter } = await loadFixture(deployAnkhContract);

      // ERC165
      expect(await ownerAnkh.supportsInterface("0x01ffc9a7")).to.be.true;

      // ERC721
      expect(await ownerAnkh.supportsInterface("0x80ac58cd")).to.be.true;

      // ERC721Metadata
      expect(await ownerAnkh.supportsInterface("0x5b5e139f")).to.be.true;
    });

    it("All default parameters are set correctly", async () => {
      const { ownerAnkh, owner, minter } = await loadFixture(deployAnkhContract);

      // tokenURI

      // Uri is not frozen
      expect(await ownerAnkh.isUriFrozenForEver()).to.be.false;

      // Sale time is very big
      expect(await ownerAnkh.getSaleTime()).to.equal(
        ethers.BigNumber.from(
          "0x62DD5E70"
        )
      );
      
      // Price of tokens
      const [ogPrice, whiteslitPrice, publicPrice] = await ownerAnkh.getPrices();
      expect(ogPrice).to.equal(ethers.BigNumber.from(prices.og));
      expect(whiteslitPrice).to.equal(ethers.BigNumber.from(prices.whitelist));
      expect(publicPrice).to.equal(ethers.BigNumber.from(prices.public));
      
      // Max mint per transactions
      const [maxOgMint, maxWhitelistMint, maxPublicMint] = await ownerAnkh.getMaxMintsPerTx();
      expect(maxOgMint).to.equal(5);
      expect(maxWhitelistMint).to.equal(3);
      expect(maxPublicMint).to.equal(3);

      // Max supply
      expect(await ownerAnkh.getMaxSupply()).to.equal(4500);
    });
  });

  describe("Setup", function () {
    // Can change various properties in the smart contract

    it("Can't change price if not owner", async () => {
      const { minterAnkh, owner, minter } = await loadFixture(deployAnkhContract);

      await expect(minterAnkh.setSalePrices(
        ethers.BigNumber.from("1000000"), 
        ethers.BigNumber.from("2000000"), 
        ethers.BigNumber.from("3000000")
      )).to.be.revertedWith(error["ownable"])

      const [ogPrice, whiteslitPrice, publicPrice] = await minterAnkh.getPrices();
      expect(ogPrice).to.equal(ethers.BigNumber.from(prices.og));
      expect(whiteslitPrice).to.equal(ethers.BigNumber.from(prices.whitelist));
      expect(publicPrice).to.equal(ethers.BigNumber.from(prices.public));
    });

    it("Can change prices", async () => {
      const { ownerAnkh, minterAnkh, owner, minter } = await loadFixture(deployAnkhContract);

      await ownerAnkh.setSalePrices(
        ethers.BigNumber.from("250000000000000000"), 
        ethers.BigNumber.from("350000000000000000"), 
        ethers.BigNumber.from("450000000000000000")
      )

      const [ogPrice, whiteslitPrice, publicPrice] = await minterAnkh.getPrices();
      expect(ogPrice).to.equal(ethers.BigNumber.from("250000000000000000"));
      expect(whiteslitPrice).to.equal(ethers.BigNumber.from("350000000000000000"));
      expect(publicPrice).to.equal(ethers.BigNumber.from("450000000000000000"));
    });

    it("Can't change max mint per transaction", async () => {
      const { ownerAnkh, minterAnkh, owner, minter } = await loadFixture(deployAnkhContract);

      await expect(minterAnkh.setMaxMintsPerTx(5, 4, 3)).to.be.revertedWith(error["ownable"]);
    });

    it("Change max mint per transaction", async () => {
      const { ownerAnkh, minterAnkh, owner, minter } = await loadFixture(deployAnkhContract);

      await ownerAnkh.setMaxMintsPerTx(6, 5, 4);

      const [maxOgMint, maxWhitelistMint, maxPublicMint] = await ownerAnkh.getMaxMintsPerTx();
      expect(maxOgMint).to.equal(6);
      expect(maxWhitelistMint).to.equal(5);
      expect(maxPublicMint).to.equal(4);
    });

    it("Can't reduce max supply if not owner", async () => {
      const { ownerAnkh, minterAnkh, owner, minter } = await loadFixture(deployAnkhContract);

      await expect(minterAnkh.reduceMaxSupply(20)).to.be.revertedWith(error["ownable"]);
    });

    it("Can't increase max supply", async () => {
      const { ownerAnkh, minterAnkh, owner, minter } = await loadFixture(deployAnkhContract);

      await expect(ownerAnkh.reduceMaxSupply(20000)).to.be.revertedWith(error["Can not increase supply"]);
    });

    it("Can't set max supply under current supply", async () => {
      const { ownerAnkh, ogMinterAnkh, owner, ogMinter } = await loadFixture(deployAnkhContract);
      await (await ownerAnkh.setSaleTime(2000)).wait();

      await ownerAnkh.grantRole(
        roles["SIGNER"],
        SIGNER_ADDRESS
      )

      const signature = await fetch(`http://localhost:3001/api/getMintSignature?address=${ogMinter.address}`).then((res: { json: () => any; }) => res?.json()).then((json: { signature: any; }) => json.signature);
      
      const receipt = await (await ogMinterAnkh.ogMint(
        4,
        signature,
        { value: ethers.BigNumber.from(prices.og).mul(4) }
      ))

      await expect(ownerAnkh.reduceMaxSupply(3)).to.be.revertedWith(error["Can not set max supply under the current supply"])
    });

    it("Reduce max supply", async () => {
      const { ownerAnkh, minterAnkh, owner, minter } = await loadFixture(deployAnkhContract);
      
      await ownerAnkh.reduceMaxSupply(20);

      expect(await ownerAnkh.getMaxSupply()).to.equal(20);
    });

    it("Can't change sale time if not owner", async () => {
      const { ownerAnkh, minterAnkh, owner, minter } = await loadFixture(deployAnkhContract);

      await expect(minterAnkh.setSaleTime(
        Math.floor((new Date()).getTime()/1000)
      )).to.be.revertedWith(error["ownable"]);
    });

    it("Change sale time", async () => {
      const { ownerAnkh, minterAnkh, owner, minter } = await loadFixture(deployAnkhContract);

      await ownerAnkh.setSaleTime(
        Math.floor((new Date()).getTime()/1000)
      );
    });

    it("Can't change base URI if not owner", async () => {
      const { ownerAnkh, minterAnkh, owner, minter } = await loadFixture(deployAnkhContract);

      await expect(minterAnkh.setBaseURI(
        "ipfs://hash"
      )).to.be.revertedWith(error["ownable"]);
    });

    it("Can set base URI", async () => {
      const { ownerAnkh, ogMinterAnkh, owner, ogMinter } = await loadFixture(deployAnkhContract);

      await ownerAnkh.setBaseURI("ipfs://hash/");

      await (await ownerAnkh.setSaleTime(2000)).wait();

      await ownerAnkh.grantRole(
        roles["SIGNER"],
        SIGNER_ADDRESS
      )

      const signature = await fetch(`http://localhost:3001/api/getMintSignature?address=${ogMinter.address}`).then((res: { json: () => any; }) => res?.json()).then((json: { signature: any; }) => json.signature);
      
      const receipt = await (await ogMinterAnkh.ogMint(
        4,
        signature,
        { value: ethers.BigNumber.from(prices.og).mul(4) }
      ))

      expect(await ownerAnkh.tokenURI(1)).to.equal("ipfs://hash/1");
    });

    it("Can't give roles if not owner", async () => {
      const { ownerAnkh, minterAnkh, owner, minter } = await loadFixture(deployAnkhContract);

      await expect(minterAnkh.grantRole(
        roles["SIGNER"],
        owner.address
      )).to.be.revertedWith(accessControlRevert(minter.address));
    });

    it("Can give roles if owner", async () => {
      const { ownerAnkh, minterAnkh, owner, minter } = await loadFixture(deployAnkhContract);

      await ownerAnkh.grantRole(
        roles["SIGNER"],
        owner.address
      );
      
      expect(await ownerAnkh.hasRole(roles["SIGNER"], owner.address)).to.be.true;
      expect(await ownerAnkh.hasRole(roles["SIGNER"], minter.address)).to.be.false;
    });
  });

  describe("Pre sale", function () {

    it("Can't og mint if sale is not started", async () => {
      const { ownerAnkh, minterAnkh, owner, minter } = await loadFixture(deployAnkhContract);

      await expect(minterAnkh.ogMint(
        1, 
        "0xdb3381732d690805cef0bfbd8e9520b80ac6d4137e99d220d9dedcd064b01235264395736fb4aa03d18df80e6e88ae85fe303789c8de9f9cf3a02fdcdf1fc3051c", 
        { value: ethers.BigNumber.from(prices.og) }
      )).to.be.rejectedWith(error["Mint has not started yet"]);
    });

    it("Can't whiteliste mint if sale is not started", async () => {
      const { ownerAnkh, minterAnkh, owner, minter } = await loadFixture(deployAnkhContract);

      await expect(minterAnkh.whitelistMint(
        1, 
        "0xdb3381732d690805cef0bfbd8e9520b80ac6d4137e99d220d9dedcd064b01235264395736fb4aa03d18df80e6e88ae85fe303789c8de9f9cf3a02fdcdf1fc3051c", 
        { value: ethers.BigNumber.from(prices.whitelist) }
      )).to.be.rejectedWith(error["Mint has not started yet"]);
    });

    it("Can't public mint if sale is not started", async () => {
      const { ownerAnkh, minterAnkh, owner, minter } = await loadFixture(deployAnkhContract);

      await expect(minterAnkh.publicMint(
        1, 
        { value: ethers.BigNumber.from(prices.public) }
      )).to.be.rejectedWith(error["Mint has not started yet"]);
    });

    it("Can't start sale if not owner", async () => {
      const { ownerAnkh, minterAnkh, owner, minter } = await loadFixture(deployAnkhContract);

      await expect(minterAnkh.setSaleTime(0)).to.be.revertedWith(error["ownable"]);
    });

    it("Can start sale", async () => {
      const { ownerAnkh, minterAnkh, owner, minter } = await loadFixture(deployAnkhContract);

      await (await ownerAnkh.setSaleTime(2000)).wait();

      expect(await minterAnkh.getSaleTime()).to.equal(2000);
    });
  })

  describe("mint", function () {
    describe("og mint", function () {
      it("Can't og mint if price is wrong", async () => {
        const { ownerAnkh, ogMinterAnkh, owner, ogMinter } = await loadFixture(deployAnkhContract);
        await (await ownerAnkh.setSaleTime(2000)).wait();
        
        await expect(ogMinterAnkh.ogMint(
          2,
          "0xdb3381732d690805cef0bfbd8e9520b80ac6d4137e99d220d9dedcd064b01235264395736fb4aa03d18df80e6e88ae85fe303789c8de9f9cf3a02fdcdf1fc3051c",
          { value: ethers.BigNumber.from(prices.og).mul(3) }
        )).to.be.revertedWith(error["Wrong price"]);
      });
  
      it("Can't og mint if maxOgMintPerTx is too much", async () => {
        const { ownerAnkh, ogMinterAnkh, owner, ogMinter } = await loadFixture(deployAnkhContract);
        await (await ownerAnkh.setSaleTime(2000)).wait();
        
        await expect(ogMinterAnkh.ogMint(
          6,
          "0xdb3381732d690805cef0bfbd8e9520b80ac6d4137e99d220d9dedcd064b01235264395736fb4aa03d18df80e6e88ae85fe303789c8de9f9cf3a02fdcdf1fc3051c",
          { value: ethers.BigNumber.from(prices.og).mul(6) }
        )).to.be.revertedWith(error["Trying to mint too many tokens"]);
      });
  
      it("Can't og mint if sold out", async () => {
        const { ownerAnkh, ogMinterAnkh, owner, ogMinter } = await loadFixture(deployAnkhContract);
        await (await ownerAnkh.setSaleTime(2000)).wait();

        await (await ownerAnkh.reduceMaxSupply(10)).wait();
        await (await ownerAnkh.setMaxMintsPerTx(4, 3, 8)).wait();
        await ownerAnkh.publicMint(8, { value: ethers.BigNumber.from(prices.public).mul(8) })
        
        await expect(ogMinterAnkh.ogMint(
          3,
          "0xdb3381732d690805cef0bfbd8e9520b80ac6d4137e99d220d9dedcd064b01235264395736fb4aa03d18df80e6e88ae85fe303789c8de9f9cf3a02fdcdf1fc3051c",
          { value: ethers.BigNumber.from(prices.og).mul(3) }
        )).to.be.revertedWith(error["Max supply has been reached"]);
      });

      it("Can't og mint if signature is wrong", async () => {
        const { ownerAnkh, ogMinterAnkh, owner, ogMinter } = await loadFixture(deployAnkhContract);
        await (await ownerAnkh.setSaleTime(2000)).wait();
        
        await expect(ogMinterAnkh.ogMint(
          2,
          "0xdb3381732d690805cef0bfbd8e9520b80ac6d4137e99d220d9dedcd064b01235264395736fb4aa03d18df80e6e88ae85fe303789c8de9f9cf3a02fdcdf1fc3051c",
          { value: ethers.BigNumber.from(prices.og).mul(2) }
        )).to.be.revertedWith(error["Wrong signature"]);
      });
  
      it("Can og mint", async () => {
        const { ownerAnkh, ogMinterAnkh, owner, ogMinter } = await loadFixture(deployAnkhContract);
        await (await ownerAnkh.setSaleTime(2000)).wait();

        await ownerAnkh.grantRole(
          roles["SIGNER"],
          SIGNER_ADDRESS
        )

        const signature = await fetch(`http://localhost:3001/api/getMintSignature?address=${ogMinter.address}`).then((res: { json: () => any; }) => res?.json()).then((json: { signature: any; }) => json.signature);
        
        const receipt = await (await ogMinterAnkh.ogMint(
          2,
          signature,
          { value: ethers.BigNumber.from(prices.og).mul(2) }
        )).wait();

        expect(await ownerAnkh.totalSupply()).to.equal(2);
  
        expect(receipt.events?.filter(ev => ev.event === "Transfer").length).to.equal(2);
        
        for (let index = 1; index <= 2; index++) {
          // from
          expect(parseInt(receipt
            .events
            ?.filter(ev => ev.event === "Transfer" && parseInt(ev.args?.tokenId) === index)[0]
            .args
            ?.from
          )).to.equal(0);
          // to
          expect(receipt
            .events
            ?.filter(ev => ev.event === "Transfer" && parseInt(ev.args?.tokenId) === index)[0]
            .args
            ?.to
          ).to.equal(ogMinter.address);
          // tokenId
          expect(parseInt(receipt
            .events
            ?.filter(ev => ev.event === "Transfer" && parseInt(ev.args?.tokenId) === index)[0]
            .args
            ?.tokenId
          )).to.equal(index);
        }
      });
    });

    describe("Whitelist mint", function () {
      it("Can't whitelist mint if price is wrong", async () => {
        const { ownerAnkh, minterAnkh, owner, minter } = await loadFixture(deployAnkhContract);
        await (await ownerAnkh.setSaleTime(2000)).wait();
        
        await expect(minterAnkh.whitelistMint(
          2,
          "0xdb3381732d690805cef0bfbd8e9520b80ac6d4137e99d220d9dedcd064b01235264395736fb4aa03d18df80e6e88ae85fe303789c8de9f9cf3a02fdcdf1fc3051c",
          { value: ethers.BigNumber.from(prices.whitelist).mul(3) }
        )).to.be.revertedWith(error["Wrong price"]);
      });
  
      it("Can't whitelist mint if maxOgMintPerTx is too much", async () => {
        const { ownerAnkh, minterAnkh, owner, minter } = await loadFixture(deployAnkhContract);
        await (await ownerAnkh.setSaleTime(2000)).wait();
        
        await expect(minterAnkh.whitelistMint(
          4,
          "0xdb3381732d690805cef0bfbd8e9520b80ac6d4137e99d220d9dedcd064b01235264395736fb4aa03d18df80e6e88ae85fe303789c8de9f9cf3a02fdcdf1fc3051c",
          { value: ethers.BigNumber.from(prices.whitelist).mul(4) }
        )).to.be.revertedWith(error["Trying to mint too many tokens"]);
      });
  
      it("Can't whitelist mint if sold out", async () => {
        const { ownerAnkh, minterAnkh, owner, minter } = await loadFixture(deployAnkhContract);
        await (await ownerAnkh.setSaleTime(2000)).wait();

        await (await ownerAnkh.reduceMaxSupply(10)).wait();
        await (await ownerAnkh.setMaxMintsPerTx(4, 3, 8)).wait();
        await ownerAnkh.publicMint(8, { value: ethers.BigNumber.from(prices.public).mul(8) })
        
        await expect(minterAnkh.whitelistMint(
          3,
          "0xdb3381732d690805cef0bfbd8e9520b80ac6d4137e99d220d9dedcd064b01235264395736fb4aa03d18df80e6e88ae85fe303789c8de9f9cf3a02fdcdf1fc3051c",
          { value: ethers.BigNumber.from(prices.whitelist).mul(3) }
        )).to.be.revertedWith(error["Max supply has been reached"]);
      });

      it("Can't whitelist mint if signature is wrong", async () => {
        const { ownerAnkh, minterAnkh, owner, minter } = await loadFixture(deployAnkhContract);
        await (await ownerAnkh.setSaleTime(2000)).wait();
        
        await expect(minterAnkh.whitelistMint(
          2,
          "0xdb3381732d690805cef0bfbd8e9520b80ac6d4137e99d220d9dedcd064b01235264395736fb4aa03d18df80e6e88ae85fe303789c8de9f9cf3a02fdcdf1fc3051c",
          { value: ethers.BigNumber.from(prices.whitelist).mul(2) }
        )).to.be.revertedWith(error["Wrong signature"]);
      });
  
      it("Can whitelist mint", async () => {
        const { ownerAnkh, minterAnkh, owner, minter } = await loadFixture(deployAnkhContract);
        await (await ownerAnkh.setSaleTime(2000)).wait();

        await ownerAnkh.grantRole(
          roles["SIGNER"],
          SIGNER_ADDRESS
        )

        const signature = await fetch(`http://localhost:3001/api/getMintSignature?address=${minter.address}`).then((res: { json: () => any; }) => res?.json()).then((json: { signature: any; }) => json.signature);
        
        const receipt = await (await minterAnkh.whitelistMint(
          2,
          signature,
          { value: ethers.BigNumber.from(prices.whitelist).mul(2) }
        ))
      });
    });
  
    describe("Public mint", function () {
      it("Can't public mint if price is wrong", async () => {
        const { ownerAnkh, minterAnkh, owner, minter } = await loadFixture(deployAnkhContract);
        await (await ownerAnkh.setSaleTime(2000)).wait();
        
        await expect(minterAnkh.publicMint(
          2,
          { value: ethers.BigNumber.from(prices.public).mul(3) }
        )).to.be.revertedWith(error["Wrong price"]);
      });
  
      it("Can't public mint if maxOgMintPerTx is too much", async () => {
        const { ownerAnkh, minterAnkh, owner, minter } = await loadFixture(deployAnkhContract);
        await (await ownerAnkh.setSaleTime(2000)).wait();
        
        await expect(minterAnkh.publicMint(
          4,
          { value: ethers.BigNumber.from(prices.public).mul(4) }
        )).to.be.revertedWith(error["Trying to mint too many tokens"]);
      });
  
      it("Can't public mint if sold out", async () => {
        const { ownerAnkh, minterAnkh, owner, minter } = await loadFixture(deployAnkhContract);
        await (await ownerAnkh.setSaleTime(2000)).wait();

        await (await ownerAnkh.reduceMaxSupply(10)).wait();
        await (await ownerAnkh.setMaxMintsPerTx(4, 3, 8)).wait();
        await ownerAnkh.publicMint(8, { value: ethers.BigNumber.from(prices.public).mul(8) })
        
        await expect(minterAnkh.publicMint(
          3,
          { value: ethers.BigNumber.from(prices.public).mul(3) }
        )).to.be.revertedWith(error["Max supply has been reached"]);
      });
      
      it("Can public mint", async () => {
        const { ownerAnkh, minterAnkh, owner, minter } = await loadFixture(deployAnkhContract);

        await (await ownerAnkh.setSaleTime(0)).wait();
  
        const tx = await minterAnkh.publicMint(1, { value: ethers.BigNumber.from(prices.public).mul(1)});
        const receipt = await tx.wait();
  
        expect(await ownerAnkh.totalSupply()).to.equal(1);
  
        expect(receipt.events?.filter(ev => ev.event === "Transfer").length).to.equal(1);
        
        // from
        expect(parseInt(
          receipt.events
            ?.filter(ev => ev.event === "Transfer")[0]
            .args
            ?.from
        )).to.equal(0);
  
        // to
        expect(
          receipt
            .events
            ?.filter(ev => ev.event === "Transfer")[0]
            .args
            ?.to
        ).to.equal(minter.address);
        
        // tokenId
        expect(parseInt(
          receipt.events
            ?.filter(ev => ev.event === "Transfer")[0]
            .args
            ?.tokenId
        )).to.equal(1);
      });
    });
    
    describe("FreeClaim mint", function () {
      it("Can't freeClaim if maxPublicMintPerTx is too much", async () => {
        const { ownerAnkh, minterAnkh, owner, minter } = await loadFixture(deployAnkhContract);
        await (await ownerAnkh.setSaleTime(2000)).wait();
        
        await expect(minterAnkh.freeClaim(
          4,
          "0xdb3381732d690805cef0bfbd8e9520b80ac6d4137e99d220d9dedcd064b01235264395736fb4aa03d18df80e6e88ae85fe303789c8de9f9cf3a02fdcdf1fc3051c"
        )).to.be.revertedWith(error["Trying to mint too many tokens"]);
      });
  
      it("Can't freeClaim if sold out", async () => {
        const { ownerAnkh, minterAnkh, owner, minter } = await loadFixture(deployAnkhContract);
        await (await ownerAnkh.setSaleTime(2000)).wait();

        await (await ownerAnkh.reduceMaxSupply(10)).wait();
        await (await ownerAnkh.setMaxMintsPerTx(4, 3, 8)).wait();
        await ownerAnkh.publicMint(8, { value: ethers.BigNumber.from(prices.public).mul(8) })
        
        await expect(minterAnkh.freeClaim(
          3,
          "0xdb3381732d690805cef0bfbd8e9520b80ac6d4137e99d220d9dedcd064b01235264395736fb4aa03d18df80e6e88ae85fe303789c8de9f9cf3a02fdcdf1fc3051c"
        )).to.be.revertedWith(error["Max supply has been reached"]);
      });

      it("Can't freeClaim if signature is wrong", async () => {
        const { ownerAnkh, minterAnkh, owner, minter } = await loadFixture(deployAnkhContract);
        await (await ownerAnkh.setSaleTime(2000)).wait();
        
        await expect(minterAnkh.freeClaim(
          2,
          "0xdb3381732d690805cef0bfbd8e9520b80ac6d4137e99d220d9dedcd064b01235264395736fb4aa03d18df80e6e88ae85fe303789c8de9f9cf3a02fdcdf1fc3051c"
        )).to.be.revertedWith(error["Wrong signature"]);
      });
  
      it("Can freeClaim", async () => {
        const { ownerAnkh, minterAnkh, owner, minter } = await loadFixture(deployAnkhContract);

        await ownerAnkh.grantRole(
          roles["FREE_SIGNER"],
          SIGNER_ADDRESS
        )

        const signature = await fetch(`http://localhost:3001/api/getFreeMintSignature?address=${minter.address}&quantity=2&nonce=1`).then((res: { json: () => any; }) => res?.json()).then((json: { signature: any; }) => json.signature);
        
        const receipt = await (await minterAnkh.freeClaim(
          2,
          signature
        ))
      });

      it("Can't freeClaim twice with the same signature", async () => {
        const { ownerAnkh, minterAnkh, owner, minter } = await loadFixture(deployAnkhContract);

        await ownerAnkh.grantRole(
          roles["FREE_SIGNER"],
          SIGNER_ADDRESS
        )

        const signature = await fetch(`http://localhost:3001/api/getFreeMintSignature?address=${minter.address}&quantity=2&nonce=1`).then((res: { json: () => any; }) => res?.json()).then((json: { signature: any; }) => json.signature);
        
        const receipt = await (await minterAnkh.freeClaim(
          2,
          signature
        ))
        
        await expect(minterAnkh.freeClaim(
          2,
          signature
        )).to.be.revertedWith(error["Wrong signature"]);
      });
  
      it("Nonce is increased", async () => {
        const { ownerAnkh, minterAnkh, owner, minter } = await loadFixture(deployAnkhContract);
        
        expect(await ownerAnkh.getNonce(minter.address)).to.equal(0); // 1

        await ownerAnkh.grantRole(
          roles["FREE_SIGNER"],
          SIGNER_ADDRESS
        )

        const signature = await fetch(`http://localhost:3001/api/getFreeMintSignature?address=${minter.address}&quantity=2&nonce=1`).then((res: { json: () => any; }) => res?.json()).then((json: { signature: any; }) => json.signature);
        
        const receipt = await (await minterAnkh.freeClaim(
          2,
          signature
        ))

        expect(await ownerAnkh.getNonce(minter.address)).to.equal(1); // 1
      });
    }); 
    
    describe("Airdrop", function () {
      //
      
      it("Can't airdrop if sold out", async () => {
        const { ownerAnkh, minterAnkh, owner, minter } = await loadFixture(deployAnkhContract);
        await (await ownerAnkh.setSaleTime(2000)).wait();

        await (await ownerAnkh.reduceMaxSupply(10)).wait();
        await (await ownerAnkh.setMaxMintsPerTx(4, 3, 8)).wait();
        await ownerAnkh.publicMint(8, { value: ethers.BigNumber.from(prices.public).mul(8) })
        
        await expect(ownerAnkh.airdrop(
          3,
          minter.address          
        )).to.be.revertedWith(error["Max supply has been reached"]);
      });

      it("Can't airdrop if not owner", async () => {
        const { ownerAnkh, minterAnkh, owner, minter } = await loadFixture(deployAnkhContract);

        await expect(minterAnkh.airdrop(
          3,
          minter.address          
        )).to.be.revertedWith(error["ownable"]);
      })
      
      it("Can airdrop", async () => {
        const { ownerAnkh, minterAnkh, owner, minter } = await loadFixture(deployAnkhContract);

        const receipt = await (await ownerAnkh.airdrop(
          3,
          minter.address          
        )).wait();
        
        expect(await ownerAnkh.totalSupply()).to.equal(3);
        expect(await minterAnkh.ownerOf(1)).to.equal(minter.address);
        expect(await minterAnkh.ownerOf(2)).to.equal(minter.address);
        expect(await minterAnkh.ownerOf(3)).to.equal(minter.address);

        expect(receipt.events?.filter(ev => ev.event === "Transfer").length).to.equal(3);
        
        for (let index = 1; index <= 3; index++) {
          // from
          expect(parseInt(receipt
            .events
            ?.filter(ev => ev.event === "Transfer" && parseInt(ev.args?.tokenId) === index)[0]
            .args
            ?.from
          )).to.equal(0);
          // to
          expect(receipt
            .events
            ?.filter(ev => ev.event === "Transfer" && parseInt(ev.args?.tokenId) === index)[0]
            .args
            ?.to
          ).to.equal(minter.address);
          // tokenId
          expect(parseInt(receipt
            .events
            ?.filter(ev => ev.event === "Transfer" && parseInt(ev.args?.tokenId) === index)[0]
            .args
            ?.tokenId
          )).to.equal(index);
        }
      });
    });   

    describe("Burn", function () {
      it("Can't burn somebody else's token", async () => {
        const { ownerAnkh, minterAnkh, owner, minter } = await loadFixture(deployAnkhContract);

        await (await ownerAnkh.setSaleTime(0)).wait();
  
        const tx = await minterAnkh.publicMint(1, { value: ethers.BigNumber.from(prices.public) });
        const receipt = await tx.wait();

        await expect(ownerAnkh.burn(1)).to.be.revertedWith(error["You don't own this token"])
      })

      it("Can burn token", async () => {
        const { ownerAnkh, minterAnkh, owner, minter } = await loadFixture(deployAnkhContract);

        await (await ownerAnkh.setSaleTime(0)).wait();
  
        const tx = await minterAnkh.publicMint(1, { value: ethers.BigNumber.from(prices.public) });
        const receipt = await tx.wait();

        await (await minterAnkh.burn(1)).wait();

        expect(await ownerAnkh.totalSupply()).to.equal(0);
        // await expect(ownerAnkh.ownerOf(1)).to.be.revertedWith("OwnerQueryForNonexistentToken()");

        await (await ownerAnkh.publicMint(2, { value: ethers.BigNumber.from(prices.public).mul(2) })).wait();
        expect(await ownerAnkh.totalSupply()).to.equal(2);
        expect(await ownerAnkh.ownerOf(2)).to.equal(owner.address);
        expect(await ownerAnkh.ownerOf(3)).to.equal(owner.address);
      })
    })
  });

  describe("Withdrawals", function () {
    it("Can't withdraw eth if not stake holder", async () => {
      const { ownerAnkh, minterAnkh, ogMinterAnkh, owner, minter, ogMinter } = await loadFixture(deployAnkhContract);

      await expect(minterAnkh.withdraw(minter.address)).to.be.revertedWith(error["No shares for this account"]);
    })

    it("Can withdraw all stake holders", async () => {
      const { ownerAnkh, minterAnkh, ogMinterAnkh, owner, minter, ogMinter } = await loadFixture(deployAnkhContract);
      await (await ownerAnkh.setSaleTime(2000)).wait();

      await ownerAnkh.grantRole(
        roles["SIGNER"],
        SIGNER_ADDRESS
      )

      let tx = await minterAnkh.publicMint(2, { value: ethers.BigNumber.from(prices.public).mul(2)});
      let receipt = await tx.wait();

      let signature = await fetch(`http://localhost:3001/api/getMintSignature?address=${ogMinter.address}`).then((res: { json: () => any; }) => res?.json()).then((json: { signature: any; }) => json.signature);
      receipt = await (await ogMinterAnkh.ogMint(
        2,
        signature,
        { value: ethers.BigNumber.from(prices.og).mul(2) }
      )).wait();

      signature = await fetch(`http://localhost:3001/api/getMintSignature?address=${minter.address}`).then((res: { json: () => any; }) => res?.json()).then((json: { signature: any; }) => json.signature);
      receipt = await (await minterAnkh.whitelistMint(
        2,
        signature,
        { value: ethers.BigNumber.from(prices.whitelist).mul(2) }
      )).wait();
      
      const totalReceivedContract = await ethers.provider.getBalance(
        ownerAnkh.address
      );

      for (let index = 0; index < stakeHolders.length; index++) {
        const _address = stakeHolders[index].address;
        const previousBalance = await ethers.provider.getBalance(_address);
        
        await ownerAnkh.withdraw(_address);

        const newBalance = await ethers.provider.getBalance(_address);

        expect(newBalance.sub(previousBalance)).to.equal(totalReceivedContract.mul(stakeHolders[index].shares).div(1000))
      }
      
    })

  });

  describe("Collection's lifespan", function () {
    it("Can freeze metadata", async () => {
      const { ownerAnkh, minterAnkh, owner, minter } = await loadFixture(deployAnkhContract);

      await ownerAnkh.freezeMetadata();
      expect(await ownerAnkh.isUriFrozenForEver()).to.be.true;

      await expect(ownerAnkh.setBaseURI("newBaseUri")).to.be.revertedWith(error["URI has been frozen"]);
    })

    it("Can transfer ownership", async () => {
      const { ownerAnkh, minterAnkh, owner, minter } = await loadFixture(deployAnkhContract);
      
      await (await ownerAnkh.transferOwnership(minter.address)).wait();

      await (await minterAnkh.setSaleTime(4000)).wait();

      expect(await ownerAnkh.getSaleTime()).to.equal(4000);
    })

    it("Can give Admin role", async () => {
      const { ownerAnkh, minterAnkh, owner, minter } = await loadFixture(deployAnkhContract);
      
      expect(await ownerAnkh.hasRole(roles["ADMIN"], minter.address)).to.be.false;
      
      await (await ownerAnkh.grantRole(roles["ADMIN"], minter.address));

      expect(await ownerAnkh.hasRole(roles["ADMIN"], minter.address)).to.be.true;

    })

    it("Can revoke roles", async () => {
      const { ownerAnkh, minterAnkh, owner, minter } = await loadFixture(deployAnkhContract);
      
      expect(await ownerAnkh.hasRole(roles["ADMIN"], owner.address)).to.be.true;
      
      await (await ownerAnkh.revokeRole(roles["ADMIN"], owner.address));

      expect(await ownerAnkh.hasRole(roles["ADMIN"], owner.address)).to.be.false;
    })
  })
});
